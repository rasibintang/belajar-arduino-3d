import { test } from 'node:test';
import assert from 'node:assert/strict';
import { connectNets } from '../src/sim/netlist.js';
import { COMPONENT_BY_TYPE } from '../src/components/index.js';

const P = (id, type, pinIds) => ({ id, spec: COMPONENT_BY_TYPE[type], pinIds });
const same = (r, a, b) => r.nodeGroup.get(a) === r.nodeGroup.get(b);

test('kabel, jalur breadboard, kaki tertancap, dan alias Uno disatukan', () => {
  const r = connectNets({
    parts: [P('uno', 'arduino-uno', ['D13', 'GND', 'GND.1', 'A4', 'SDA', '5V', 'IOREF']), P('bb', 'breadboard', ['a8', 'c8', 'f8', 'tn3', 'tn9']), P('r1', 'resistor', ['1', '2'])],
    wires: [{ from: 'uno:D13', to: 'bb:a8' }],
    inserted: new Map([['r1:1', 'bb:c8']]),
  });
  assert.ok(same(r, 'uno:D13', 'r1:1')); // kabel + jalur a–e + kaki
  assert.ok(!same(r, 'bb:c8', 'bb:f8')); // parit memisahkan a–e dan f–j
  assert.ok(same(r, 'bb:tn3', 'bb:tn9')); // rel
  assert.ok(same(r, 'uno:GND', 'uno:GND.1') && same(r, 'uno:A4', 'uno:SDA') && same(r, 'uno:5V', 'uno:IOREF'));
});
