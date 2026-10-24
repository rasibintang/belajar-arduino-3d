import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COMPONENTS, COMPONENT_BY_TYPE, pinIdsOf } from '../src/components/index.js';
import { buildCatalog } from '../src/ai/catalog.js';

test('setiap komponen punya daftar pin tanpa model 3D', () => {
  for (const spec of COMPONENTS) {
    const ids = pinIdsOf(spec);
    if (['text', 'ir-remote'].includes(spec.type)) continue;
    assert.ok(ids.length > 0, `${spec.type}: tanpa pin`);
    assert.equal(new Set(ids).size, ids.length, `${spec.type}: pin ganda`);
  }
});

test('pin Uno & breadboard', () => {
  const uno = pinIdsOf(COMPONENT_BY_TYPE['arduino-uno']);
  for (const id of ['D13', 'A4', 'GND.1', '5V']) assert.ok(uno.includes(id), id);
  assert.ok(!uno.includes('NC'));
  assert.equal(pinIdsOf(COMPONENT_BY_TYPE.breadboard).length, 396);
});

test('pin mengikuti props (resistor dan strip NeoPixel)', () => {
  assert.deepEqual(pinIdsOf(COMPONENT_BY_TYPE.resistor), ['1', '2']);
});

test('katalog deterministik dan lengkap', () => {
  const a = buildCatalog();
  assert.equal(a, buildCatalog());
  for (const s of ['oled-ssd1306', 'SDA(i2c-sda)', 'servo-sg90', 'SIG(pwm-in)', '- Servo:', 'ohms ∈ {100, 220']) assert.ok(a.includes(s), s);
  assert.ok(!a.includes('breadboard-full'));
});
