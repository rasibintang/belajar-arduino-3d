import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleCompile } from '../server/compile.mjs';

function fakeMonitor() {
  const m = { events: [], metrics: [] };
  m.save = async ({ events = [], metrics = [] }) => {
    m.events.push(...events);
    m.metrics.push(...metrics);
  };
  return m;
}

async function call(compile, monitor) {
  const res = { statusCode: 200, headers: {}, setHeader: (k, v) => (res.headers[k] = v), end: (b) => (res.body = b ? JSON.parse(b) : null) };
  let t = 0;
  await handleCompile({ method: 'POST', headers: {}, body: JSON.stringify({ sketch: 'void setup(){}\nvoid loop(){}' }) }, res, { compile, monitor, now: () => (t += 1500) });
  return res;
}

test('kompilasi berhasil → metrik compile ok dengan lamanya', async () => {
  const monitor = fakeMonitor();
  const res = await call(async () => ({ ok: true, hex: ':00' }), monitor);
  assert.equal(res.body.ok, true);
  assert.deepEqual(monitor.metrics.map((m) => [m.name, m.value_ms, m.ok]), [['compile', 1500, true]]);
  assert.equal(monitor.events.length, 0);
});

test('kesalahan sketch pengguna bukan error situs', async () => {
  const monitor = fakeMonitor();
  await call(async () => ({ ok: false, stderr: "sketch.ino:2: error: 'x' was not declared" }), monitor);
  assert.deepEqual(monitor.metrics.map((m) => m.ok), [true]);
  assert.equal(monitor.events.length, 0);
});

test('toolchain hilang / timeout / pengecualian → error server, metrik ok=false, flag tidak bocor ke respons', async () => {
  for (const compile of [async () => ({ ok: false, stderr: 'arduino-cli belum terpasang', internal: true }), async () => Promise.reject(new Error('EACCES spawn'))]) {
    const monitor = fakeMonitor();
    const res = await call(compile, monitor);
    assert.equal(res.body.ok, false);
    assert.equal('internal' in res.body, false);
    assert.deepEqual(monitor.metrics.map((m) => m.ok), [false]);
    assert.deepEqual(monitor.events.map((e) => [e.level, e.source, e.kind]), [['error', 'server', 'compile']]);
  }
});
