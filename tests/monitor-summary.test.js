import { test } from 'node:test';
import assert from 'node:assert/strict';
import { percentile, groupEvents, periodStats, loadTable, opsTable } from '../src/monitor/summary.js';

const H = 3600000;
const T0 = Date.parse('2026-10-25T12:00:00Z');
const at = (hoursAgo) => new Date(T0 - hoursAgo * H).toISOString();
const ev = (o) => ({ level: 'error', source: 'browser', kind: 'js', message: 'boom', page: 'home', device: 'desktop', browser: 'Chrome', fingerprint: 'f1', createdAt: at(1), ...o });
const metric = (o) => ({ name: 'load', page: 'home', device: 'desktop', valueMs: 1000, ok: true, createdAt: at(1), ...o });

test('persentil (nearest-rank); kosong → null', () => {
  assert.equal(percentile([], 50), null);
  assert.equal(percentile([5], 95), 5);
  assert.equal(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 50), 5);
  assert.equal(percentile([10, 1, 9, 2, 8, 3, 7, 4, 6, 5], 95), 10);
});

test('kejadian dikelompokkan per sidik jari: jumlah, pertama/terakhir, perangkat, pesan terbaru', () => {
  const groups = groupEvents(
    [
      ev({ createdAt: at(5), message: 'boom lama', device: 'mobile', browser: 'Safari' }),
      ev({ createdAt: at(1), message: 'boom baru' }),
      ev({ fingerprint: 'f2', level: 'warn', kind: 'network', createdAt: at(2) }),
    ],
    []
  );
  assert.equal(groups.length, 2);
  const g = groups[0];
  assert.deepEqual(
    { fp: g.fingerprint, count: g.count, first: g.firstAt, last: g.lastAt, msg: g.message, devices: g.devices, browsers: g.browsers, resolved: g.resolved },
    { fp: 'f1', count: 2, first: at(5), last: at(1), msg: 'boom baru', devices: { desktop: 1, mobile: 1 }, browsers: ['Chrome', 'Safari'], resolved: false }
  );
});

test('kelompok selesai bila tidak ada kejadian setelah ditandai; muncul lagi bila ada', () => {
  const events = [ev({ createdAt: at(3) }), ev({ fingerprint: 'f2', createdAt: at(1) })];
  const groups = groupEvents(events, [
    { fingerprint: 'f1', resolvedAt: at(2) },
    { fingerprint: 'f2', resolvedAt: at(2) },
  ]);
  const byFp = Object.fromEntries(groups.map((g) => [g.fingerprint, g.resolved]));
  assert.deepEqual(byFp, { f1: true, f2: false });
  // belum selesai di atas, lalu error sebelum warning, lalu terbaru
  assert.equal(groups[0].fingerprint, 'f2');
});

test('urutan: belum selesai → error sebelum warning → terbaru', () => {
  const groups = groupEvents([ev({ fingerprint: 'w', level: 'warn', createdAt: at(1) }), ev({ fingerprint: 'e-old', createdAt: at(9) }), ev({ fingerprint: 'e-new', createdAt: at(2) })], []);
  assert.deepEqual(groups.map((g) => g.fingerprint), ['e-new', 'e-old', 'w']);
});

test('statistik periode: hanya data di [from, to)', () => {
  const data = {
    events: [ev({ createdAt: at(1) }), ev({ level: 'warn', createdAt: at(2) }), ev({ createdAt: at(30) })],
    metrics: [
      metric({ name: 'compile', valueMs: 2000, ok: true, createdAt: at(1) }),
      metric({ name: 'compile', valueMs: 4000, ok: false, createdAt: at(1) }),
      metric({ name: 'compile', valueMs: 9000, ok: true, createdAt: at(30) }),
      metric({ name: 'ai', ok: true, createdAt: at(3) }),
      metric({ name: 'ai', ok: false, createdAt: at(3) }),
      metric({ name: 'ai', ok: false, createdAt: at(4) }),
    ],
    users: [{ createdAt: at(1) }, { createdAt: at(40) }],
    projects: [{ updatedAt: at(1) }, { updatedAt: at(2) }, { updatedAt: at(30) }],
  };
  const s = periodStats(data, T0 - 24 * H, T0);
  assert.deepEqual(s, { errors: 1, warnings: 1, compile: { count: 2, okRate: 0.5, p50: 2000 }, ai: { ok: 1, failed: 2 }, newUsers: 1, projectsSaved: 2 });
  const prev = periodStats(data, T0 - 48 * H, T0 - 24 * H);
  assert.deepEqual(prev, { errors: 1, warnings: 0, compile: { count: 1, okRate: 1, p50: 9000 }, ai: { ok: 0, failed: 0 }, newUsers: 1, projectsSaved: 1 });
  assert.equal(periodStats({ events: [], metrics: [], users: [], projects: [] }, 0, T0).compile.okRate, null);
});

test('tabel waktu muat per halaman × perangkat; tabel kompilasi & AI', () => {
  const metrics = [
    metric({ valueMs: 1000 }),
    metric({ valueMs: 3000 }),
    metric({ device: 'mobile', valueMs: 5000 }),
    metric({ page: 'sandbox', valueMs: 2000 }),
    metric({ name: 'compile', page: null, valueMs: 1500, ok: true }),
    metric({ name: 'compile', page: null, valueMs: 2500, ok: false }),
  ];
  assert.deepEqual(loadTable(metrics), [
    { page: 'home', device: 'desktop', count: 2, p50: 1000, p95: 3000 },
    { page: 'home', device: 'mobile', count: 1, p50: 5000, p95: 5000 },
    { page: 'sandbox', device: 'desktop', count: 1, p50: 2000, p95: 2000 },
  ]);
  assert.deepEqual(opsTable(metrics), [
    { name: 'compile', count: 2, okRate: 0.5, p50: 1500, p95: 2500 },
    { name: 'ai', count: 0, okRate: null, p50: null, p95: null },
  ]);
});

test('periode: data dengan jam server sedikit di depan jam browser tetap masuk periode ini', async () => {
  const { periods } = await import('../src/monitor/summary.js');
  const { current, previous } = periods(T0, 24 * H);
  const data = { events: [], metrics: [metric({ name: 'compile', valueMs: 1900, createdAt: new Date(T0 + 90000).toISOString() })], users: [], projects: [] };
  assert.equal(periodStats(data, ...current).compile.count, 1);
  assert.deepEqual(previous, [T0 - 48 * H, T0 - 24 * H]);
});
