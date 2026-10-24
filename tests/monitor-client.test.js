import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createReporter } from '../src/monitor/client.js';

function setup(opts = {}) {
  const sent = [];
  const timers = [];
  const r = createReporter({ page: 'sandbox', send: (payload) => sent.push(payload), setTimer: (fn) => timers.push(fn), ...opts });
  const tick = () => timers.splice(0).forEach((fn) => fn());
  return { r, sent, tick };
}

test('kejadian & metrik dikirim berkelompok setelah jeda, dengan nama halaman', () => {
  const { r, sent, tick } = setup();
  r.event('error', 'js', 'x is not defined');
  r.metric('load', 1234.5);
  assert.equal(sent.length, 0);
  tick();
  assert.deepEqual(sent, [
    {
      events: [{ level: 'error', kind: 'js', message: 'x is not defined', page: 'sandbox' }],
      metrics: [{ name: 'load', valueMs: 1234.5, ok: true, page: 'sandbox' }],
    },
  ]);
});

test('pesan yang sama hanya dikirim sekali per halaman', () => {
  const { r, sent, tick } = setup();
  for (let i = 0; i < 5; i++) r.event('warn', 'network', 'gagal memuat');
  tick();
  r.event('warn', 'network', 'gagal memuat');
  tick();
  assert.equal(sent.length, 1);
  assert.equal(sent[0].events.length, 1);
});

test('maksimal 20 kejadian per halaman (error berulang tidak membanjiri)', () => {
  const { r, sent, tick } = setup();
  for (let i = 0; i < 50; i++) r.event('error', 'js', `galat ke-${i}`);
  tick();
  assert.equal(sent.flatMap((p) => p.events).length, 20);
});

test('flush langsung mengirim antrean (dipakai saat halaman ditutup); antrean kosong → tidak mengirim', () => {
  const { r, sent } = setup();
  r.flush();
  assert.equal(sent.length, 0);
  r.metric('ai', 8000, false);
  r.flush();
  assert.deepEqual(sent[0].metrics, [{ name: 'ai', valueMs: 8000, ok: false, page: 'sandbox' }]);
  r.flush();
  assert.equal(sent.length, 1);
});

test('pesan bukan teks diubah menjadi teks dan dipotong', () => {
  const { r, sent, tick } = setup();
  r.event('error', 'promise', new Error('gagal'));
  r.event('error', 'js', 'x'.repeat(5000));
  tick();
  assert.equal(sent[0].events[0].message, 'Error: gagal');
  assert.equal(sent[0].events[1].message.length, 1000);
});
