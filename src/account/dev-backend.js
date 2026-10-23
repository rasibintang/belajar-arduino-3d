// Akun palsu untuk pengembangan (hanya `npm run dev`, lihat index.js):
//   ?fakeauth=1        belum masuk; "Masuk dengan Google" masuk sebagai pengguna@contoh.test
//   ?fakeauth=admin    langsung masuk sebagai pengelola (admin@contoh.test)
//   ?fakeauth=offline  semua panggilan gagal (meniru Supabase tidak bisa dihubungi)
// Status masuk diingat per tab (sessionStorage); data contoh dibuat ulang setiap halaman dimuat.
import { createMemoryBackend } from './memory-backend.js';

const KEY = 'la-fakeauth';
const DIAGRAM = { version: 1, parts: [{ id: 'uno', type: 'arduino-uno', x: 0, z: 0, rot: 0, props: {} }], wires: [] };

export async function createDevBackend(mode) {
  const backend = createMemoryBackend({
    users: [
      { email: 'pengguna@contoh.test', name: 'Pengguna Contoh' },
      { email: 'admin@contoh.test', name: 'Admin Contoh' },
    ],
    admins: ['admin@contoh.test'],
    fail: mode === 'offline',
    seed: {
      projects: [
        { id: 'demo-1', email: 'pengguna@contoh.test', name: 'Penyiram tanaman', sketch: 'void setup() {}\nvoid loop() {}\n', diagram: DIAGRAM },
        { id: 'demo-2', email: 'admin@contoh.test', name: 'Uji pengelola', diagram: DIAGRAM },
      ],
      requests: [
        { email: 'pengguna@contoh.test', component: 'Sensor kelembapan tanah', prompt: 'monitoring kelembapan tanah otomatis' },
        { email: 'admin@contoh.test', component: 'sensor kelembapan tanah', prompt: 'penyiram otomatis' },
        { email: 'pengguna@contoh.test', component: 'Pompa air mini', prompt: 'pompa menyala saat tanah kering' },
      ],
      usage: [{ email: 'pengguna@contoh.test', ok: true }],
    },
  });
  let saved = null;
  try {
    saved = sessionStorage.getItem(KEY);
  } catch {
    /* sessionStorage tidak tersedia */
  }
  if (mode !== 'offline') {
    if (mode === 'admin') await backend.signInAs('admin@contoh.test');
    else if (saved) await backend.signInAs(saved);
  }
  backend.onAuthChange((u) => {
    try {
      if (u) sessionStorage.setItem(KEY, u.email);
      else sessionStorage.removeItem(KEY);
    } catch {
      /* abaikan */
    }
  });
  return backend;
}
