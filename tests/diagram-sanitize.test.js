import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeDiagram } from '../src/sandbox/sanitize.js';
import { COMPONENT_BY_TYPE } from '../src/components/index.js';
import { EXAMPLES } from '../src/sandbox/examples.js';
import { escapeHtml } from '../src/ui/highlight.js';

const textKey = COMPONENT_BY_TYPE.text.props.find((p) => p.type === 'text').key;
const ledColor = COMPONENT_BY_TYPE.led.props.find((p) => p.type === 'swatch');
const withRange = Object.values(COMPONENT_BY_TYPE).find((s) => s.props?.some((p) => p.type === 'range'));
const range = withRange.props.find((p) => p.type === 'range');

test('semua contoh bawaan lolos tanpa berubah', () => {
  for (const ex of EXAMPLES) {
    const d = structuredClone(ex.diagram);
    assert.deepEqual(sanitizeDiagram(d), ex.diagram, ex.id ?? ex.name);
  }
});

test('id komponen berisi HTML diganti id aman; kabel ikut dipetakan', () => {
  const evil = 'x<img src=1 onerror=alert(1)>';
  const d = sanitizeDiagram({
    version: 1,
    parts: [{ id: evil, type: 'led', x: 0, z: 0, rot: 0, props: {} }, { id: 'r1', type: 'resistor', x: 10, z: 0, rot: 0, props: {} }],
    wires: [{ from: `${evil}:A`, to: 'r1:1', color: 'red' }],
  });
  const id = d.parts[0].id;
  assert.match(id, /^[A-Za-z0-9_-]+$/);
  assert.notEqual(id, 'r1');
  assert.deepEqual(d.wires, [{ from: `${id}:A`, to: 'r1:1', color: 'red' }]);
});

test('id ganda dibuat unik', () => {
  const d = sanitizeDiagram({ version: 1, parts: [{ id: 'led1', type: 'led', props: {} }, { id: 'led1', type: 'led', props: {} }], wires: [] });
  assert.equal(new Set(d.parts.map((p) => p.id)).size, 2);
});

test('props dibersihkan menurut definisinya; kunci tak dikenal dibuang', () => {
  const d = sanitizeDiagram({
    version: 1,
    parts: [
      { id: 't1', type: 'text', props: { [textKey]: 'a'.repeat(500), extra: '<script>' } },
      { id: 'l1', type: 'led', props: { [ledColor.key]: '"><img src=x onerror=alert(1)>' } },
      { id: 'g1', type: withRange.type, props: { [range.key]: '"><svg onload=alert(1)>' } },
      { id: 'g2', type: withRange.type, props: { [range.key]: range.max + 1000 } },
      { id: 't2', type: 'text', props: { [textKey]: { toString: 1 } } },
    ],
    wires: [],
  });
  const [t1, l1, g1, g2, t2] = d.parts;
  assert.equal(t1.props[textKey].length, 60);
  assert.equal('extra' in t1.props, false);
  assert.equal(l1.props[ledColor.key], ledColor.value);
  assert.equal(g1.props[range.key], range.value);
  assert.equal(g2.props[range.key], range.max);
  assert.equal(t2.props[textKey], COMPONENT_BY_TYPE.text.props.find((p) => p.key === textKey).value);
});

test('kabel & posisi yang tidak sah dibuang/dinolkan', () => {
  const d = sanitizeDiagram({
    version: 1,
    parts: [{ id: 'l1', type: 'led', x: 'abc', z: Infinity, rot: '90"><x', props: {} }],
    wires: [
      { from: 'l1:A', to: 'l1:K"><img src=x>', color: 'red' },
      { from: 'l1:A', to: 'l1:K', color: 'red;background:url(x)' },
      { from: 'l1:A', to: 'l1:K', color: 'blue' },
    ],
  });
  assert.deepEqual([d.parts[0].x, d.parts[0].z, d.parts[0].rot], [0, 0, 0]);
  assert.deepEqual(d.wires, [{ from: 'l1:A', to: 'l1:K', color: 'blue' }]);
});

test('isian bukan diagram → diagram kosong', () => {
  for (const bad of [null, 'x', 42, { parts: 'x', wires: {} }]) assert.deepEqual(sanitizeDiagram(bad), { version: 1, parts: [], wires: [] });
});

test('escapeHtml juga meng-escape tanda kutip (aman untuk atribut)', () => {
  assert.equal(escapeHtml(`"a" & 'b' <c>`), '&quot;a&quot; &amp; &#39;b&#39; &lt;c&gt;');
});
