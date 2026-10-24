import { test } from 'node:test';
import assert from 'node:assert/strict';
import { requestCircuit, diffCircuits, logicalCircuit } from '../src/ai/client.js';
import { snap } from './helpers.js';

test('requestCircuit mengirim token & body; gagal jaringan → network', async () => {
  let seen;
  const fetchImpl = async (url, init) => {
    seen = { url, auth: init.headers.Authorization, body: JSON.parse(init.body) };
    return Response.json({ ok: true });
  };
  const out = await requestCircuit({ prompt: 'blink', mode: 'new', lang: 'id', token: 'tok', fetchImpl });
  assert.deepEqual(out, { ok: true });
  assert.deepEqual(seen, { url: '/api/ai', auth: 'Bearer tok', body: { prompt: 'blink', mode: 'new', lang: 'id', current: null } });
  const down = await requestCircuit({ prompt: 'x', mode: 'new', lang: 'id', token: 't', fetchImpl: async () => { throw new TypeError('Failed to fetch'); } });
  assert.deepEqual(down, { ok: false, code: 'network' });
});

test('diffCircuits: komponen ditambah/dihapus, props berubah, kabel, sketch', () => {
  const before = { parts: [{ id: 'uno', type: 'arduino-uno', props: {} }, { id: 'led1', type: 'led', props: { color: 'red' } }, { id: 'r1', type: 'resistor', props: {} }], connections: [{ from: 'uno:D13', to: 'r1:1' }, { from: 'r1:2', to: 'led1:A' }], sketch: 'a' };
  const after = { parts: [{ id: 'uno', type: 'arduino-uno', props: [] }, { id: 'r1', type: 'resistor', props: [{ key: 'ohms', value: '330' }] }, { id: 'bz1', type: 'buzzer', props: [] }], connections: [{ from: 'uno:D13', to: 'r1:1' }, { from: 'uno:D8', to: 'bz1:+' }], sketch: 'b' };
  assert.deepEqual(diffCircuits(before, after), { added: ['bz1'], removed: ['led1'], changedProps: ['r1'], wiresAdded: 1, wiresRemoved: 1, sketchChanged: true });
});

test('logicalCircuit: rangkaian logis dari snapshot sandbox (tanpa breadboard, alias Uno disatukan)', () => {
  const s = snap({ uno: 'arduino-uno', bb: 'breadboard', r1: 'resistor', led1: 'led' }, [['uno:D13', 'bb:c8'], ['uno:GND.1', 'bb:a13']], [['r1:1', 'bb:d8'], ['r1:2', 'bb:d12'], ['led1:A', 'bb:b12'], ['led1:K', 'bb:b13']]);
  const props = { uno: {}, bb: {}, r1: { ohms: 220 }, led1: { color: 'red' } };
  const c = logicalCircuit(s, props);
  assert.deepEqual(c.parts.map((p) => p.id).sort(), ['led1', 'r1', 'uno']);
  const pairs = c.connections.map((x) => [x.from, x.to].sort().join(' ~ ')).sort();
  assert.deepEqual(pairs, ['led1:A ~ r1:2', 'led1:K ~ uno:GND.1', 'r1:1 ~ uno:D13']);
});
