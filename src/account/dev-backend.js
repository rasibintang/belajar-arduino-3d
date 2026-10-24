// Akun palsu untuk pengembangan (hanya `npm run dev`, lihat index.js):
//   ?fakeauth=1        belum masuk; "Masuk dengan Google" masuk sebagai pengguna@contoh.test
//   ?fakeauth=admin    langsung masuk sebagai pengelola (admin@contoh.test)
//   ?fakeauth=offline  semua panggilan gagal (meniru Supabase tidak bisa dihubungi)
// Status masuk diingat per tab (sessionStorage); data contoh dibuat ulang setiap halaman dimuat.
import { createMemoryBackend } from './memory-backend.js';

const KEY = 'la-fakeauth';
const DIAGRAM = { version: 1, parts: [{ id: 'uno', type: 'arduino-uno', x: 0, z: 0, rot: 0, props: {} }], wires: [] };

// contoh tab "Kondisi situs" (waktu relatif terhadap sekarang)
const ago = (h) => new Date(Date.now() - h * 3600000).toISOString();
function sampleEvents() {
  const ev = (h, o) => ({ level: 'error', source: 'browser', kind: 'js', page: 'sandbox', device: 'desktop', browser: 'Chrome', createdAt: ago(h), ...o });
  return [
    ev(0.5, { message: "TypeError: Cannot read properties of undefined (reading 'pins') @ /assets/sandbox.js:1", fingerprint: 'dev-1' }),
    ev(3, { message: "TypeError: Cannot read properties of undefined (reading 'pins') @ /assets/sandbox.js:1", fingerprint: 'dev-1', device: 'mobile', browser: 'Safari' }),
    ev(2, { level: 'warn', kind: 'account', message: 'simpan otomatis: network', fingerprint: 'dev-2' }),
    ev(5, { level: 'error', source: 'server', kind: 'compile', page: null, device: null, browser: null, message: 'arduino-cli timeout', fingerprint: 'dev-3' }),
    ev(30, { level: 'warn', kind: 'slow-load', page: 'home', device: 'mobile', message: 'halaman siap setelah 18 dtk', fingerprint: 'dev-4' }),
  ];
}
function sampleMetrics() {
  const m = (h, o) => ({ page: 'home', device: 'desktop', ok: true, createdAt: ago(h), ...o });
  return [
    ...[2100, 2600, 3400, 1900].map((v, i) => m(i + 1, { name: 'load', valueMs: v })),
    ...[6200, 9800].map((v, i) => m(i + 2, { name: 'load', device: 'mobile', valueMs: v })),
    ...[2800, 3500].map((v, i) => m(i + 1, { name: 'load', page: 'sandbox', valueMs: v })),
    ...[1800, 2200, 2500, 31000].map((v, i) => m(i + 1, { name: 'compile', page: null, device: null, valueMs: v, ok: v < 30000 })),
    m(4, { name: 'ai', page: 'sandbox', valueMs: 14000 }),
    m(6, { name: 'ai', page: 'sandbox', valueMs: 21000, ok: false }),
    m(28, { name: 'compile', page: null, device: null, valueMs: 2000 }),
  ];
}

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
      events: sampleEvents(),
      metrics: sampleMetrics(),
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
