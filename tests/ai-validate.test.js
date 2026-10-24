import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateCircuit, normalizeProps } from '../src/ai/validate.js';
import { CIRCUIT_SCHEMA } from '../src/ai/schema.js';

const base = () => ({
  title: 'LED berkedip',
  summary: 'LED di D13 lewat resistor 220 Ω.',
  feasible: true,
  parts: [
    { id: 'uno', type: 'arduino-uno', props: [] },
    { id: 'r1', type: 'resistor', props: [{ key: 'ohms', value: '220' }] },
    { id: 'led1', type: 'led', props: [{ key: 'color', value: 'red' }] },
  ],
  connections: [
    { from: 'uno:D13', to: 'r1:1' },
    { from: 'r1:2', to: 'led1:A' },
    { from: 'led1:K', to: 'uno:GND.1' },
  ],
  sketch: 'void setup(){pinMode(13,OUTPUT);}\nvoid loop(){}\n',
  substitutions: [],
  missing: [],
  changes: [],
});
const has = (errors, text) => assert.ok(errors.some((e) => e.includes(text)), `"${text}" tidak ada di ${JSON.stringify(errors)}`);

test('rangkaian sah → tanpa kesalahan', () => {
  assert.deepEqual(validateCircuit(base()), []);
});

test('komponen karangan, pin karangan, dan komponen tak dideklarasikan ditolak', () => {
  const c = base();
  c.parts.push({ id: 's1', type: 'soil-sensor', props: [] });
  c.connections.push({ from: 'led1:X', to: 'uno:D2' }, { from: 'r9:1', to: 'uno:5V' });
  const e = validateCircuit(c);
  has(e, 'unknown component type "soil-sensor"');
  has(e, 'unknown pin "X" on led1');
  has(e, 'undeclared part "r9"');
});

test('Uno wajib tepat satu ber-id uno; id unik; breadboard tidak boleh', () => {
  const c = base();
  c.parts.push({ id: 'uno2', type: 'arduino-uno', props: [] }, { id: 'r1', type: 'resistor', props: [] }, { id: 'bb', type: 'breadboard', props: [] });
  const e = validateCircuit(c);
  has(e, 'exactly one arduino-uno');
  has(e, 'duplicate id "r1"');
  has(e, 'do not declare "breadboard"');
});

test('props salah ditolak; props benar dinormalkan ke tipenya', () => {
  const c = base();
  c.parts[2].props = [{ key: 'color', value: 'ungu' }, { key: 'brightness', value: '5' }];
  const e = validateCircuit(c);
  has(e, 'invalid value "ungu" for led1.color');
  has(e, 'unknown prop "brightness" on led1');
  assert.deepEqual(normalizeProps('resistor', [{ key: 'ohms', value: '220' }]), { ohms: 220 });
});

test('sketch kosong saat feasible, sambungan ke diri sendiri, dan format pin salah ditolak', () => {
  const c = base();
  c.sketch = '  ';
  c.connections.push({ from: 'r1:1', to: 'r1:1' }, { from: 'D13', to: 'r1:2' });
  const e = validateCircuit(c);
  has(e, 'sketch is empty');
  has(e, 'connects a pin to itself');
  has(e, 'must look like "part:pin"');
});

test('skema JSON ketat: semua objek tertutup dan semua field wajib', () => {
  const walk = (s, path) => {
    if (s.type === 'object') {
      assert.equal(s.additionalProperties, false, path);
      assert.deepEqual([...s.required].sort(), Object.keys(s.properties).sort(), path);
      for (const [k, v] of Object.entries(s.properties)) walk(v, `${path}.${k}`);
    }
    if (s.type === 'array') walk(s.items, `${path}[]`);
  };
  walk(CIRCUIT_SCHEMA, 'circuit');
});
