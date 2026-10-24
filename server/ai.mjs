// POST /api/ai — AI penyusun rangkaian. GET /api/ai — apakah fitur aktif + nama penyedia.
// Alur: login (token Supabase) → jatah harian → AI → validasi → tata letak → pemeriksaan kabel →
// kompilasi → (bila gagal dan waktu cukup) perbaikan sekali → catat pemakaian & laporan komponen.
// Kunci rahasia (penyedia AI, service role Supabase) hanya dibaca di server.
import { createClient } from '@supabase/supabase-js';
import { runPipeline } from '../src/ai/pipeline.js';
import { providerConfig, createAiClient } from './ai-client.mjs';

const MAX_PROMPT = 1000;

/** Database lewat service role (melewati RLS; hanya di server). */
function supabaseDb(env) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const run = async (q) => {
    const { data, error, count } = await q;
    if (error) throw new Error(error.message);
    return { data, count };
  };
  const startOfDay = () => new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00Z').toISOString();
  return {
    async userFromToken(token) {
      if (!token) return null;
      const { data, error } = await sb.auth.getUser(token);
      return error || !data?.user ? null : { id: data.user.id, email: data.user.email };
    },
    async isAdmin(email) {
      const { data } = await run(sb.from('admins').select('email'));
      return data.some((a) => a.email.toLowerCase() === String(email).toLowerCase());
    },
    async limit() {
      const { data } = await run(sb.from('settings').select('value').eq('key', 'ai_daily_limit').maybeSingle());
      return Number(data?.value ?? 1);
    },
    async countToday(userId) {
      const { count } = await run(sb.from('ai_usage').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('ok', true).gte('created_at', startOfDay()));
      return count ?? 0;
    },
    async recordUsage(userId, ok) {
      await run(sb.from('ai_usage').insert({ user_id: userId, ok }));
    },
    async recordRequests(userId, prompt, missing) {
      if (!missing.length) return;
      await run(sb.from('component_requests').insert(missing.map((m) => ({ user_id: userId, prompt, component: m.component }))));
    },
  };
}

/** Kompilasi lewat /api/compile di host yang sama (fungsi itu yang membawa toolchain Arduino). */
function httpCompile(req) {
  const proto = req.headers['x-forwarded-proto'] ?? 'http';
  const origin = `${proto}://${req.headers.host}`;
  return async (sketch, lang) => {
    const res = await fetch(`${origin}/api/compile`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sketch, lang }) });
    return res.json();
  };
}

function defaultDeps(req) {
  const config = providerConfig(process.env);
  return {
    info: config ? { provider: config.provider, label: config.label } : null,
    ai: config ? createAiClient(config) : null,
    db: supabaseDb(process.env),
    compile: httpCompile(req),
    now: () => Date.now(),
  };
}

async function readBody(req) {
  if (req.body !== undefined) return typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  let body = '';
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 400000) throw new Error('body too large');
  }
  return JSON.parse(body || '{}');
}

function send(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

function parseRequest(body) {
  const prompt = String(body?.prompt ?? '').trim();
  const mode = body?.mode === 'modify' ? 'modify' : body?.mode === 'new' ? 'new' : null;
  const lang = body?.lang === 'en' ? 'en' : 'id';
  if (!prompt || prompt.length > MAX_PROMPT || !mode) return null;
  const c = body.current;
  if (mode === 'modify' && !(c && Array.isArray(c.parts) && Array.isArray(c.connections) && c.diagram)) return null;
  return { prompt, mode, lang, current: mode === 'modify' ? c : null };
}

export async function handleAi(req, res, deps = defaultDeps(req)) {
  const { ai, db, info, compile, now } = deps;
  if (req.method === 'GET') return send(res, 200, { enabled: !!(ai && db), provider: (ai && db && info?.provider) || null, label: (ai && db && info?.label) || null });
  if (req.method !== 'POST') return send(res, 405, { ok: false, code: 'invalid' });
  if (!ai || !db) return send(res, 200, { ok: false, code: 'not-enabled' });

  let request;
  try {
    request = parseRequest(await readBody(req));
  } catch {
    request = null;
  }
  if (!request) return send(res, 400, { ok: false, code: 'invalid' });

  const token = /^Bearer\s+(.+)$/i.exec(req.headers.authorization ?? '')?.[1];
  const user = await db.userFromToken(token).catch(() => null);
  if (!user) return send(res, 401, { ok: false, code: 'not-signed-in' });

  const admin = await db.isAdmin(user.email).catch(() => false);
  const limit = admin ? null : await db.limit();
  const today = await db.countToday(user.id);
  if (!admin && today >= limit) return send(res, 429, { ok: false, code: 'quota', limit });

  const { outcome, result } = await runPipeline({ generate: (args) => ai.generate(args), request, compile, now });

  const missing = Array.isArray(result?.missing) ? result.missing.filter((m) => m?.component) : [];
  await db.recordRequests(user.id, request.prompt, missing).catch(() => {});
  await db.recordUsage(user.id, outcome.ok).catch(() => {});

  if (!outcome.ok) return send(res, 200, { ok: false, code: 'failed', reason: outcome.reason, details: outcome.details.slice(0, 5), missing });
  return send(res, 200, {
    ok: true,
    result,
    diagram: outcome.diagram,
    sketch: result.sketch,
    issues: outcome.issues,
    compile: outcome.compile,
    usage: { today: admin ? today : today + 1, limit },
  });
}
