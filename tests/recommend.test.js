import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recommend } from '../src/sim/wiring/recommend.js';
import { snap } from './helpers.js';

test('GND modul → GND Arduino dan lubang kosong rel −', () => {
  const r = recommend(snap({ uno: 'arduino-uno', bb: 'breadboard', o: 'oled-ssd1306' }, []), 'o:GND');
  assert.equal(r.fn, 'gnd');
  assert.ok(r.targets.includes('uno:GND') && r.targets.includes('bb:tn5') && r.targets.includes('bb:bn5'));
  assert.ok(!r.targets.includes('uno:D13') && !r.targets.includes('bb:c5'));
});
test('SDA → A4; perangkat I²C kedua tetap disarankan ke A4 (bus bersama)', () => {
  const s = snap({ uno: 'arduino-uno', o: 'oled-ssd1306', r: 'rtc-ds3231' }, [['uno:A4', 'o:SDA']]);
  assert.ok(recommend(s, 'r:SDA').targets.includes('uno:A4'));
});
test('pin digital Arduino → jalur resistor yang menuju anoda LED (contoh D13 → bb:c8)', () => {
  const s = snap({ uno: 'arduino-uno', bb: 'breadboard', r1: 'resistor', led1: 'led' }, [], [['r1:1', 'bb:d8'], ['r1:2', 'bb:d12'], ['led1:A', 'bb:b12'], ['led1:K', 'bb:b13']]);
  const r = recommend(s, 'uno:D13');
  assert.ok(r.targets.includes('bb:c8'));
  assert.ok(!r.targets.includes('bb:d8')); // terisi kaki
  assert.ok(recommend(s, 'uno:GND').targets.includes('bb:a13')); // sisi katoda
});
test('pin digital yang sudah terpakai tidak disarankan; 5V/GND boleh bersama', () => {
  const s = snap({ uno: 'arduino-uno', p: 'pir-sensor', q: 'pir-sensor' }, [['uno:D2', 'p:OUT'], ['uno:5V', 'p:VCC']]);
  assert.ok(!recommend(s, 'q:OUT').targets.includes('uno:D2'));
  assert.ok(recommend(s, 'q:VCC').targets.includes('uno:5V'));
});
test('pin netral tanpa konteks → tanpa sorotan', () => {
  assert.deepEqual(recommend(snap({ uno: 'arduino-uno', r1: 'resistor' }, []), 'r1:1').targets, []);
});
test('servo → hanya pin PWM; encoder CLK → D2/D3; SPI MOSI → D11', () => {
  const s = snap({ uno: 'arduino-uno', sv: 'servo-sg90', e: 'rotary-encoder', rf: 'rfid-mfrc522' }, []);
  assert.deepEqual(recommend(s, 'sv:SIG').targets.filter((n) => n.startsWith('uno:')).sort(), ['uno:D10', 'uno:D11', 'uno:D3', 'uno:D5', 'uno:D6', 'uno:D9']);
  assert.deepEqual(recommend(s, 'e:CLK').targets.sort(), ['uno:D2', 'uno:D3']);
  assert.deepEqual(recommend(s, 'rf:MOSI').targets, ['uno:D11']);
});
