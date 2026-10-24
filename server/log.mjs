// POST /api/log — laporan kejadian (error/warning) dan metrik dari browser (src/monitor/client.js).
// Isian divalidasi dan dipotong, rahasia disamarkan, dibatasi per IP, lalu disimpan lewat
// server/monitor.mjs. Selalu 204 bila diterima (juga saat database belum dipasang).
import { scrub, fingerprint, createMonitor } from './monitor.mjs';

export { scrub, fingerprint };

const MAX_EVENTS = 10;
const MAX_METRICS = 10;
const BROWSER_METRICS = new Set(['load', 'ai']);
const CLEANUP_CHANCE = 0.01;

export function deviceOf(ua = '') {
  return /Mobi|Android|iPhone|iPad|iPod/i.test(ua) ? 'mobile' : 'desktop';
}

export function browserOf(ua = '') {
  if (/Edg\//.test(ua)) return 'Edge';
  if (/OPR\/|Opera/.test(ua)) return 'Opera';
  if (/SamsungBrowser/.test(ua)) return 'Samsung';
  if (/Firefox\/|FxiOS/.test(ua)) return 'Firefox';
  if (/Chrome\/|CriOS/.test(ua)) return 'Chrome';
  if (/Safari\//.test(ua)) return 'Safari';
  return 'lain';
}

const text = (v, max) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);

/** Isian permintaan → baris tabel yang aman disimpan. */
export function sanitize(body, ua = '') {
  const device = deviceOf(ua);
  const browser = browserOf(ua);
  const events = [];
  for (const e of Array.isArray(body?.events) ? body.events : []) {
    if (events.length >= MAX_EVENTS) break;
    const level = e?.level === 'error' || e?.level === 'warn' ? e.level : null;
    const kind = typeof e?.kind === 'string' && /^[a-z-]{1,20}$/.test(e.kind) ? e.kind : null;
    const raw = text(e?.message, 4000);
    if (!level || !kind || !raw) continue;
    const row = { level, source: 'browser', kind, message: scrub(raw).slice(0, 500), page: text(e.page, 40), device, browser };
    events.push({ ...row, fingerprint: fingerprint(row) });
  }
  const metrics = [];
  for (const m of Array.isArray(body?.metrics) ? body.metrics : []) {
    if (metrics.length >= MAX_METRICS) break;
    const ms = Number(m?.valueMs);
    if (!BROWSER_METRICS.has(m?.name) || !Number.isFinite(ms) || ms < 0 || ms > 600000) continue;
    metrics.push({ name: m.name, page: text(m.page, 40), device, value_ms: Math.round(ms), ok: m.ok !== false });
  }
  return { events, metrics };
}

/** Batas sederhana per IP di memori instans (cukup untuk spam ringan; serangan berat → Vercel Firewall). */
export function createRateLimit({ limit = 30, windowMs = 60000, now = Date.now } = {}) {
  const hits = new Map(); // ip -> { start, count }
  return (ip) => {
    const t = now();
    const h = hits.get(ip);
    if (!h || t - h.start >= windowMs) {
      if (hits.size > 5000) hits.clear();
      hits.set(ip, { start: t, count: 1 });
      return true;
    }
    h.count++;
    return h.count <= limit;
  };
}

const sharedLimit = createRateLimit();

async function readBody(req) {
  if (req.body !== undefined) return typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  let body = '';
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 64000) throw new Error('body too large');
  }
  return JSON.parse(body || '{}');
}

export async function handleLog(req, res, deps = { monitor: createMonitor(), allow: sharedLimit, random: Math.random }) {
  const { monitor, allow, random } = deps;
  const done = (status) => {
    res.statusCode = status;
    res.end();
  };
  if (req.method !== 'POST') return done(405);
  const ip = String(req.headers['x-forwarded-for'] ?? req.socket?.remoteAddress ?? '').split(',')[0].trim();
  if (!allow(ip)) return done(429);
  let body;
  try {
    body = await readBody(req);
  } catch {
    return done(400);
  }
  const rows = sanitize(body, req.headers['user-agent']);
  if (monitor && (rows.events.length || rows.metrics.length)) {
    await monitor.save(rows).catch(() => {});
    if (random() < CLEANUP_CHANCE) await monitor.cleanup().catch(() => {});
  }
  done(204);
}
