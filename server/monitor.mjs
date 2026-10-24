// Pencatatan pemantauan situs ke Supabase (tabel site_events / site_metrics, lihat
// supabase/migrations/20261025000000_pemantauan.sql). Dipakai /api/log, /api/compile, dan /api/ai.
// Pencatatan tidak boleh mengganggu permintaan utama: semua kegagalan ditelan.
import { createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const KEEP_DAYS = 30;
const RECORD_TIMEOUT_MS = 1500;

/** Samarkan rahasia yang bisa ikut di pesan error: kunci API, token, email, untaian panjang. */
export function scrub(text) {
  return String(text)
    .replace(/Bearer\s+\S+/gi, 'Bearer […]')
    .replace(/eyJ[\w-]+\.[\w-]+\.[\w-]+/g, '[token]')
    .replace(/AIza[\w-]{20,}/g, '[kunci]')
    .replace(/\b(?:sk|gsk|pk|rk)[-_][\w-]{10,}/g, '[kunci]')
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[email]')
    .replace(/[A-Za-z0-9_-]{32,}/g, '[…]');
}

/** Pengelompokan: pesan yang hanya beda angka (baris, id, durasi) dianggap kejadian yang sama. */
export function fingerprint({ source, kind, message, page }) {
  const text = [source, kind, String(message).replace(/\d+/g, '#'), page ?? ''].join('|');
  return createHash('sha1').update(text).digest('hex').slice(0, 16);
}

/** Baris kejadian dari server (tanpa perangkat/browser). */
export function serverEvent({ level, kind, message, page = null }) {
  const row = { level, source: 'server', kind, message: scrub(message).slice(0, 500), page, device: null, browser: null };
  return { ...row, fingerprint: fingerprint(row) };
}

/** null bila Supabase (service role) belum dipasang. */
export function createMonitor(env = process.env) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const check = async (q) => {
    const { error } = await q;
    if (error) throw new Error(error.message);
  };
  return {
    async save({ events = [], metrics = [] }) {
      if (events.length) await check(sb.from('site_events').insert(events));
      if (metrics.length) await check(sb.from('site_metrics').insert(metrics));
    },
    async cleanup() {
      const before = new Date(Date.now() - KEEP_DAYS * 86400000).toISOString();
      await check(sb.from('site_events').delete().lt('created_at', before));
      await check(sb.from('site_metrics').delete().lt('created_at', before));
    },
  };
}

/** Catat tanpa pernah melempar dan tanpa menahan respons lebih dari 1,5 detik. */
export async function record(monitor, rows) {
  if (!monitor) return;
  const timeout = new Promise((r) => setTimeout(r, RECORD_TIMEOUT_MS).unref?.());
  await Promise.race([monitor.save(rows).catch(() => {}), timeout]);
}
