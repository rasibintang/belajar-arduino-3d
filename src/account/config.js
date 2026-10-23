/**
 * Konfigurasi Supabase dari variabel lingkungan Vite (.env.local / Vercel):
 *   VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
 * Kosong atau masih nilai contoh → null: fitur akun tidak tampil, situs bekerja seperti biasa.
 */
export function readConfig(env) {
  const url = String(env?.VITE_SUPABASE_URL ?? '').trim().replace(/\/+$/, '');
  const anonKey = String(env?.VITE_SUPABASE_ANON_KEY ?? '').trim();
  if (!url || !anonKey || anonKey === 'your-anon-key') return null;
  return { url, anonKey };
}
