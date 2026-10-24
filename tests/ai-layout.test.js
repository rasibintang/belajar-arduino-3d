import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COMPONENT_BY_TYPE, pinIdsOf, defaultProps } from '../src/components/index.js';
import { connectNets } from '../src/sim/netlist.js';
import { snapshotFromTopology } from '../src/sim/wiring/snapshot.js';
import { checkCircuit } from '../src/sim/wiring/check.js';
import { layoutCircuit } from '../src/ai/layout.js';
import { normalizeProps } from '../src/ai/validate.js';

const part = (id, type, props = []) => ({ id, type, props });
const circuit = (parts, connections) => ({ title: 't', summary: '', feasible: true, parts: [part('uno', 'arduino-uno'), ...parts], connections: connections.map(([from, to]) => ({ from, to })), sketch: 'void setup(){}\nvoid loop(){}', substitutions: [], missing: [], changes: [] });

const LED = circuit([part('r1', 'resistor', [{ key: 'ohms', value: '220' }]), part('led1', 'led')], [['uno:D13', 'r1:1'], ['r1:2', 'led1:A'], ['led1:K', 'uno:GND.1']]);
const OLED = circuit([part('oled1', 'oled-ssd1306')], [['uno:A4', 'oled1:SDA'], ['uno:A5', 'oled1:SCL'], ['uno:5V', 'oled1:VCC'], ['uno:GND', 'oled1:GND']]);
const BUTTON = circuit(
  [part('btn1', 'push-button-6mm'), part('r1', 'resistor'), part('led1', 'led')],
  [['uno:D2', 'btn1:1a'], ['btn1:2a', 'uno:GND'], ['uno:D13', 'r1:1'], ['r1:2', 'led1:A'], ['led1:K', 'uno:GND.2']]
);
const SHIFT = circuit(
  [part('sr1', 'hc595'), part('r1', 'resistor'), part('led1', 'led')],
  [['uno:D11', 'sr1:DS'], ['uno:D13', 'sr1:SH_CP'], ['uno:D10', 'sr1:ST_CP'], ['uno:5V', 'sr1:VCC'], ['uno:5V', 'sr1:MR'], ['uno:GND', 'sr1:GND'], ['uno:GND', 'sr1:OE'], ['sr1:Q0', 'r1:1'], ['r1:2', 'led1:A'], ['led1:K', 'uno:GND.1']]
);

/** Komponen diagram → bagian untuk connectNets (pin dari registri, props dinormalkan). */
function netParts(list) {
  return list.map((p) => {
    const spec = COMPONENT_BY_TYPE[p.type];
    return { id: p.id, spec, pinIds: pinIdsOf(spec, { ...defaultProps(spec), ...(p.props ?? {}) }) };
  });
}
/** Net logis (maksud AI) dan net fisik (hasil tata letak), dibandingkan pada pin komponen. */
function sameConnectivity(c, { diagram, inserted }) {
  const logical = connectNets({ parts: netParts(c.parts.map((p) => ({ ...p, props: normalizeProps(p.type, p.props) }))), wires: c.connections, inserted: new Map() });
  const physical = connectNets({ parts: netParts(diagram.parts), wires: diagram.wires, inserted });
  const nodes = [...logical.nodeGroup.keys()];
  for (const a of nodes) {
    for (const b of nodes) {
      const want = logical.nodeGroup.get(a) === logical.nodeGroup.get(b);
      const got = physical.nodeGroup.get(a) === physical.nodeGroup.get(b);
      assert.equal(got, want, `${a} ~ ${b}: fisik ${got}, logis ${want}`);
    }
  }
}
const holesOf = (inserted) => [...inserted.values()].map((h) => h.slice(3));

test('LED + resistor: koneksi hasil tata letak = koneksi logis', () => {
  const out = layoutCircuit(LED);
  assert.ok(out.diagram.parts.some((p) => p.id === 'bb' && p.type === 'breadboard'));
  sameConnectivity(LED, out);
});

test('semua kaki jatuh di lubang sah dan tidak ada dua komponen berbagi jalur', () => {
  for (const c of [LED, BUTTON, SHIFT]) {
    const { inserted } = layoutCircuit(c);
    const valid = new Set(pinIdsOf(COMPONENT_BY_TYPE.breadboard));
    for (const h of holesOf(inserted)) assert.ok(valid.has(h), h);
    const owner = new Map();
    for (const [leg, hole] of inserted) {
      const m = /^bb:([a-j])(\d+)$/.exec(hole);
      const strip = `${m[2]}-${'abcde'.includes(m[1]) ? 'front' : 'back'}`;
      const id = leg.split(':')[0];
      assert.ok(!owner.has(strip) || owner.get(strip) === id, `jalur ${strip} dipakai ${owner.get(strip)} dan ${id}`);
      owner.set(strip, id);
    }
  }
});

test('tombol dan 74HC595 melintasi parit (baris e dan f)', () => {
  for (const [c, id] of [[BUTTON, 'btn1'], [SHIFT, 'sr1']]) {
    const out = layoutCircuit(c);
    const rows = new Set([...out.inserted].filter(([leg]) => leg.startsWith(`${id}:`)).map(([, h]) => h[3]));
    assert.deepEqual([...rows].sort(), ['e', 'f']);
    sameConnectivity(c, out);
  }
});

test('OLED I²C di lantai tersambung pin-ke-pin, tanpa breadboard', () => {
  const out = layoutCircuit(OLED);
  assert.ok(!out.diagram.parts.some((p) => p.type.startsWith('breadboard')));
  assert.equal(out.inserted.size, 0);
  sameConnectivity(OLED, out);
});

test('rangkaian yang benar tidak memunculkan masalah kabel', () => {
  for (const c of [LED, BUTTON, OLED, SHIFT]) {
    const { diagram, inserted } = layoutCircuit(c);
    const parts = netParts(diagram.parts).map((p) => ({ id: p.id, type: p.spec.type, pinIds: p.pinIds }));
    const s = snapshotFromTopology({ parts, wires: diagram.wires.map((w, i) => ({ id: `w${i}`, ...w })), inserted });
    assert.deepEqual(checkCircuit(s), [], c.parts.map((p) => p.type).join(','));
  }
});

test('mode ubah mempertahankan posisi komponen lama', () => {
  const first = layoutCircuit(LED).diagram;
  const moved = structuredClone(first);
  moved.parts.find((p) => p.id === 'led1').hole = 'b20';
  moved.parts.find((p) => p.id === 'uno').x = -100;
  const next = circuit([...LED.parts.slice(1), part('bz1', 'buzzer')], [...LED.connections.map((c) => [c.from, c.to]), ['uno:D8', 'bz1:+'], ['bz1:-', 'uno:GND.2']]);
  const out = layoutCircuit(next, { previous: moved });
  const get = (id) => out.diagram.parts.find((p) => p.id === id);
  assert.equal(get('led1').hole, 'b20');
  assert.equal(get('uno').x, -100);
  assert.ok(get('bz1').hole);
  sameConnectivity(next, out);
});

test('setiap komponen breadboard bisa ditata, tiap kaki di jalurnya sendiri', async () => {
  const { COMPONENTS } = await import('../src/components/index.js');
  for (const spec of COMPONENTS.filter((s) => s.surface === 'breadboard')) {
    const pins = pinIdsOf(spec);
    const c = circuit([part('x1', spec.type)], [[`uno:D2`, `x1:${pins[0]}`]]);
    const { inserted } = layoutCircuit(c);
    assert.equal(inserted.size, pins.length, spec.type);
    sameConnectivity(c, layoutCircuit(c));
  }
});
