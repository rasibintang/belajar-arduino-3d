import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkCircuit, issueWires, ISSUE_CODES } from '../src/sim/wiring/check.js';
import { snap } from './helpers.js';

test('5V langsung ke GND → short (danger)', () => {
  const [i] = checkCircuit(snap({ uno: 'arduino-uno' }, [['uno:5V', 'uno:GND.1']]));
  assert.equal(i.code, 'short'); assert.equal(i.severity, 'danger');
  assert.deepEqual(i.nodes, ['uno:5V', 'uno:GND.1']); // pin yang dikabel, bukan aliasnya (IOREF, GND)
});
test('SDA di A2 → i2c-pin dengan fix ke A4 lewat kabel yang sama', () => {
  const s = snap({ uno: 'arduino-uno', o: 'oled-ssd1306' }, [['o:SDA', 'uno:A2']]);
  const [i] = checkCircuit(s);
  assert.equal(i.code, 'i2c-pin'); assert.equal(i.severity, 'warn');
  assert.deepEqual(i.fix, { wireId: s.wires[0].id, end: 'to', to: 'uno:A4' });
});
test('rangkaian setengah jadi (tanpa pin Arduino di net) → tanpa masalah', () => {
  assert.deepEqual(checkCircuit(snap({ uno: 'arduino-uno', bb: 'breadboard', o: 'oled-ssd1306' }, [['o:SDA', 'bb:a3']])), []);
});
test('lewat breadboard → masalah terdeteksi tanpa fix', () => {
  const s = snap({ uno: 'arduino-uno', bb: 'breadboard', o: 'oled-ssd1306' }, [['o:SDA', 'bb:a3'], ['bb:b3', 'uno:A2']]);
  const [i] = checkCircuit(s);
  assert.equal(i.code, 'i2c-pin'); assert.equal(i.fix, undefined);
  assert.equal(i.suggest, 'uno:A4'); // saran tetap ada walau tidak bisa dipindah otomatis
});
test('LED langsung D13 ke GND tanpa resistor → led-resistor (tanpa fix)', () => {
  const [i] = checkCircuit(snap({ uno: 'arduino-uno', led1: 'led' }, [['uno:D13', 'led1:A'], ['led1:K', 'uno:GND']]));
  assert.equal(i.code, 'led-resistor'); assert.equal(i.fix, undefined);
});
test('rangkaian contoh "LED + resistor" → tanpa masalah', () => {
  // sama dengan diagram contoh 'led' di src/sandbox/examples.js
  const s = snap({ uno: 'arduino-uno', bb: 'breadboard', r1: 'resistor', led1: 'led' }, [['uno:D13', 'bb:c8'], ['uno:GND.1', 'bb:a13']], [['r1:1', 'bb:d8'], ['r1:2', 'bb:d12'], ['led1:A', 'bb:b12'], ['led1:K', 'bb:b13']]);
  assert.deepEqual(checkCircuit(s), []);
});
test('servo di D2 → pwm-in dengan fix ke pin PWM bebas pertama (D3)', () => {
  const s = snap({ uno: 'arduino-uno', sv: 'servo-sg90' }, [['sv:SIG', 'uno:D2']]);
  const [i] = checkCircuit(s);
  assert.equal(i.code, 'pwm-pin'); assert.equal(i.fix.to, 'uno:D3');
});
test('VCC modul ke GND → power-reversed (danger) dengan fix ke 5V', () => {
  const s = snap({ uno: 'arduino-uno', o: 'oled-ssd1306' }, [['uno:GND', 'o:VCC']]);
  const [i] = checkCircuit(s);
  assert.equal(i.code, 'power-reversed'); assert.equal(i.severity, 'danger');
  assert.deepEqual(i.fix, { wireId: 'w1', end: 'from', to: 'uno:5V' });
});
test('VCC modul ke pin digital → power-on-signal', () => {
  const [i] = checkCircuit(snap({ uno: 'arduino-uno', o: 'oled-ssd1306' }, [['o:VCC', 'uno:D7']]));
  assert.equal(i.code, 'power-on-signal'); assert.equal(i.fix.to, 'uno:5V');
});
test('modul 3,3 V diberi 5V → vcc33-on-5v dengan fix ke 3V3', () => {
  const [i] = checkCircuit(snap({ uno: 'arduino-uno', rf: 'rfid-mfrc522' }, [['rf:3.3V', 'uno:5V']]));
  assert.equal(i.code, 'vcc33-on-5v'); assert.equal(i.fix.to, 'uno:3V3');
});
test('MOSI di D7 → spi-pin dengan fix ke D11', () => {
  const [i] = checkCircuit(snap({ uno: 'arduino-uno', rf: 'rfid-mfrc522' }, [['rf:MOSI', 'uno:D7']]));
  assert.equal(i.code, 'spi-pin'); assert.equal(i.fix.to, 'uno:D11');
});
test('keluaran analog di pin digital → analog-pin dengan fix ke A0', () => {
  const [i] = checkCircuit(snap({ uno: 'arduino-uno', pot: 'potentiometer' }, [['pot:W', 'uno:D7']]));
  assert.equal(i.code, 'analog-pin'); assert.equal(i.fix.to, 'uno:A0');
});
test('sinyal di D0 → serial-pin dengan fix ke D2', () => {
  const [i] = checkCircuit(snap({ uno: 'arduino-uno', p: 'pir-sensor' }, [['p:OUT', 'uno:D0']]));
  assert.equal(i.code, 'serial-pin'); assert.equal(i.fix.to, 'uno:D2');
});
test('setiap masalah memakai kode yang terdaftar', () => {
  const s = snap({ uno: 'arduino-uno', o: 'oled-ssd1306', p: 'pir-sensor' }, [['o:SDA', 'uno:A2'], ['p:OUT', 'uno:D1'], ['uno:5V', 'uno:GND']]);
  const issues = checkCircuit(s);
  assert.equal(issues.length, 3);
  for (const i of issues) assert.ok(ISSUE_CODES.includes(i.code));
});
test('7-segment langsung ke GND tanpa resistor → led-resistor', () => {
  const issues = checkCircuit(snap({ uno: 'arduino-uno', s7: 'seg7' }, [['uno:D2', 's7:A'], ['s7:COM1', 'uno:GND']]));
  assert.deepEqual(issues.map((i) => i.code), ['led-resistor']);
});
test('kabel yang menyala hanya kabel milik pin bermasalah, bukan semua kabel GND', () => {
  const s = snap({ uno: 'arduino-uno', o1: 'oled-ssd1306', o2: 'oled-ssd1306' }, [['o1:VCC', 'uno:GND'], ['o2:GND', 'uno:GND']]);
  const [i] = checkCircuit(s);
  assert.equal(i.code, 'power-reversed');
  assert.deepEqual(issueWires(i, s), ['w1']);
});
test('lewat breadboard: kabel dari pin komponen yang menyala', () => {
  const s = snap({ uno: 'arduino-uno', bb: 'breadboard', o: 'oled-ssd1306' }, [['o:SDA', 'bb:a3'], ['bb:b3', 'uno:A2']]);
  assert.deepEqual(issueWires(checkCircuit(s)[0], s), ['w1']);
});

const LED_PARTS = { uno: 'arduino-uno', bb: 'breadboard', r1: 'resistor', led1: 'led' };
const LED_LEGS = [['r1:1', 'bb:d8'], ['r1:2', 'bb:d12'], ['led1:A', 'bb:b12'], ['led1:K', 'bb:b13']];
test('GND di seberang parit (j13, katoda di b13) → wire-misplaced dengan saran e13', () => {
  const s = snap(LED_PARTS, [['uno:D13', 'bb:c8'], ['uno:GND.1', 'bb:j13']], LED_LEGS);
  const [i, ...rest] = checkCircuit(s);
  assert.equal(rest.length, 0);
  assert.equal(i.code, 'wire-misplaced'); assert.equal(i.severity, 'warn');
  assert.deepEqual(i.nodes, ['uno:GND.1', 'bb:j13']);
  assert.deepEqual(i.fix, { wireId: 'w2', end: 'to', to: 'bb:e13' });
  assert.deepEqual(issueWires(i, s), ['w2']);
});
test('D13 meleset satu kolom (c7, resistor di kolom 8) → saran c8', () => {
  const s = snap(LED_PARTS, [['uno:D13', 'bb:c7'], ['uno:GND.1', 'bb:a13']], LED_LEGS);
  const issues = checkCircuit(s);
  assert.deepEqual(issues.map((i) => [i.code, i.suggest]), [['wire-misplaced', 'bb:c8']]);
});
test('kabel ke jalur kosong yang jauh dari apa pun → diam (rangkaian setengah jadi)', () => {
  const s = snap(LED_PARTS, [['uno:GND.1', 'bb:j25']], LED_LEGS);
  assert.deepEqual(checkCircuit(s), []);
});
