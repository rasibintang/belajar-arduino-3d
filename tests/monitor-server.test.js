import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scrub, deviceOf, browserOf, fingerprint, sanitize, createRateLimit, handleLog } from '../server/log.mjs';

const CHROME_DESKTOP = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
const SAFARI_IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';

test('scrub menyamarkan kunci API, token, dan email', () => {
  const out = scrub('gagal: key=AIzaSyA1b2C3d4E5f6G7h8I9j0KlMnOpQrStUv sk-ant-api03-abcdefghijklmnop Bearer eyJhbGciOi.abc.def oleh ani@contoh.test');
  assert.doesNotMatch(out, /AIzaSy|sk-ant|eyJhbGciOi|ani@contoh/);
  assert.match(out, /gagal/);
});

test('perangkat dan browser dari user agent', () => {
  assert.equal(deviceOf(CHROME_DESKTOP), 'desktop');
  assert.equal(deviceOf(SAFARI_IPHONE), 'mobile');
  assert.equal(browserOf(CHROME_DESKTOP), 'Chrome');
  assert.equal(browserOf(SAFARI_IPHONE), 'Safari');
  assert.equal(browserOf(''), 'lain');
});

test('sidik jari sama untuk pesan yang hanya beda angka', () => {
  const a = fingerprint({ source: 'browser', kind: 'js', message: 'gagal di baris 12', page: 'home' });
  const b = fingerprint({ source: 'browser', kind: 'js', message: 'gagal di baris 40', page: 'home' });
  const c = fingerprint({ source: 'browser', kind: 'js', message: 'gagal di baris 12', page: 'sandbox' });
  assert.equal(a, b);
  assert.notEqual(a, c);
});

test('sanitize: membuang isian tidak valid, membatasi jumlah & panjang', () => {
  const body = {
    events: [
      { level: 'error', kind: 'js', message: 'x is not defined', page: 'home' },
      { level: 'fatal', kind: 'js', message: 'level salah' },
      { level: 'warn', kind: '', message: 'tanpa jenis' },
      { level: 'warn', kind: 'network', message: 'kata '.repeat(400), page: 'p'.repeat(200) },
      ...Array.from({ length: 30 }, (_, i) => ({ level: 'warn', kind: 'js', message: `ke-${i}` })),
    ],
    metrics: [
      { name: 'load', page: 'home', valueMs: 2300.6 },
      { name: 'compile', page: 'sandbox', valueMs: 100 }, // compile hanya dari server
      { name: 'load', valueMs: -5 },
      { name: 'ai', valueMs: 9000, ok: false },
    ],
  };
  const { events, metrics } = sanitize(body, CHROME_DESKTOP);
  assert.equal(events.length, 10);
  assert.deepEqual(
    { ...events[0], fingerprint: undefined },
    { level: 'error', source: 'browser', kind: 'js', message: 'x is not defined', page: 'home', device: 'desktop', browser: 'Chrome', fingerprint: undefined }
  );
  assert.equal(events[1].message.length, 500);
  assert.equal(events[1].page.length, 40);
  assert.deepEqual(metrics, [
    { name: 'load', page: 'home', device: 'desktop', value_ms: 2301, ok: true },
    { name: 'ai', page: null, device: 'desktop', value_ms: 9000, ok: false },
  ]);
});

test('batas per IP: 30 permintaan per menit', () => {
  let t = 0;
  const allow = createRateLimit({ limit: 30, windowMs: 60000, now: () => t });
  for (let i = 0; i < 30; i++) assert.equal(allow('1.2.3.4'), true);
  assert.equal(allow('1.2.3.4'), false);
  assert.equal(allow('5.6.7.8'), true);
  t = 61000;
  assert.equal(allow('1.2.3.4'), true);
});

function fakeReq(body, { ip = '1.2.3.4', method = 'POST' } = {}) {
  return { method, body: JSON.stringify(body), headers: { 'user-agent': CHROME_DESKTOP, 'x-forwarded-for': `${ip}, 10.0.0.1` } };
}
function fakeRes() {
  const res = { statusCode: 200, headers: {}, setHeader: (k, v) => (res.headers[k] = v), end: (b) => (res.body = b ?? '') };
  return res;
}
function fakeMonitor() {
  const m = { events: [], metrics: [], cleaned: 0 };
  m.save = async ({ events, metrics }) => {
    m.events.push(...events);
    m.metrics.push(...metrics);
  };
  m.cleanup = async () => m.cleaned++;
  return m;
}

test('handleLog menyimpan kejadian & metrik yang valid (204)', async () => {
  const monitor = fakeMonitor();
  const res = fakeRes();
  await handleLog(fakeReq({ events: [{ level: 'error', kind: 'js', message: 'boom', page: 'home' }], metrics: [{ name: 'load', page: 'home', valueMs: 800 }] }), res, { monitor, allow: () => true, random: () => 0.5 });
  assert.equal(res.statusCode, 204);
  assert.equal(monitor.events.length, 1);
  assert.equal(monitor.metrics.length, 1);
  assert.equal(monitor.cleaned, 0);
});

test('handleLog: terlalu sering → 429 tanpa menyimpan; tanpa database → 204 diam', async () => {
  const monitor = fakeMonitor();
  const res = fakeRes();
  await handleLog(fakeReq({ events: [{ level: 'error', kind: 'js', message: 'boom' }] }), res, { monitor, allow: () => false, random: () => 0.5 });
  assert.equal(res.statusCode, 429);
  assert.equal(monitor.events.length, 0);
  const res2 = fakeRes();
  await handleLog(fakeReq({ events: [{ level: 'error', kind: 'js', message: 'boom' }] }), res2, { monitor: null, allow: () => true, random: () => 0.5 });
  assert.equal(res2.statusCode, 204);
});

test('handleLog sesekali menghapus data lama; metode selain POST ditolak', async () => {
  const monitor = fakeMonitor();
  await handleLog(fakeReq({ events: [{ level: 'warn', kind: 'js', message: 'x' }] }), fakeRes(), { monitor, allow: () => true, random: () => 0.001 });
  assert.equal(monitor.cleaned, 1);
  const res = fakeRes();
  await handleLog(fakeReq({}, { method: 'GET' }), res, { monitor, allow: () => true, random: () => 0.5 });
  assert.equal(res.statusCode, 405);
});
