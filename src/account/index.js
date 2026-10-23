import { readConfig } from './config.js';

let account;

/**
 * Backend akun untuk halaman ini, atau null bila fitur akun tidak aktif.
 * Urutan: `?fakeauth=…` (hanya saat pengembangan) → Supabase (bila VITE_SUPABASE_* terisi) → null.
 * Pustaka Supabase dimuat malas, jadi tanpa konfigurasi tidak ada yang diunduh.
 */
export function getAccount() {
  account ??= load();
  return account;
}

async function load() {
  try {
    if (import.meta.env?.DEV) {
      const mode = new URLSearchParams(location.search).get('fakeauth');
      if (mode) return (await import('./dev-backend.js')).createDevBackend(mode);
    }
    const config = readConfig(import.meta.env ?? {});
    if (!config) return null;
    const { createSupabaseBackend } = await import('./supabase-backend.js');
    return await createSupabaseBackend(config);
  } catch (err) {
    console.warn('Fitur akun tidak tersedia:', err);
    return null;
  }
}
