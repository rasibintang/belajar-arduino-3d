import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pinFunction, mcuPinInfo } from '../src/sim/wiring/pin-functions.js';
import { COMPONENT_BY_TYPE as C } from '../src/components/index.js';

test('peran perilaku → fungsi', () => {
  assert.equal(pinFunction(C['oled-ssd1306'], 'SDA'), 'i2c-sda');
  assert.equal(pinFunction(C['oled-ssd1306'], 'GND'), 'gnd');
  assert.equal(pinFunction(C['rfid-mfrc522'], '3.3V'), 'vcc33');
  assert.equal(pinFunction(C['rfid-mfrc522'], 'MOSI'), 'spi-mosi');
  assert.equal(pinFunction(C['servo-sg90'], C['servo-sg90'].behavior.signal), 'pwm-in');
  assert.equal(pinFunction(C['potentiometer'], 'W'), 'analog-out');
  assert.equal(pinFunction(C['potentiometer'], '1'), 'pot-end');
  assert.equal(pinFunction(C['led'], 'A'), 'led-anode');
  assert.equal(pinFunction(C['led'], 'K'), 'led-cathode');
  assert.equal(pinFunction(C['resistor'], C['resistor'].behavior.a), 'neutral');
  assert.equal(pinFunction(C['rotary-encoder'], C['rotary-encoder'].behavior.clk), 'interrupt-out');
  assert.equal(pinFunction(C['a4988'], 'VMOT'), 'vcc5'); // cadangan dari nama pin
});
test('pin Uno, breadboard, simbol', () => {
  const U = C['arduino-uno'];
  assert.equal(pinFunction(U, 'GND.2'), 'mcu-gnd');
  assert.equal(pinFunction(U, 'D9'), 'mcu-digital');
  assert.equal(pinFunction(U, 'A0'), 'mcu-analog');
  assert.equal(pinFunction(C['breadboard'], 'tn4'), 'rail-');
  assert.equal(pinFunction(C['breadboard'], 'bp4'), 'rail+');
  assert.equal(pinFunction(C['breadboard'], 'c8'), 'hole');
  assert.equal(pinFunction(C['gnd'], 'GND'), 'supply-gnd');
  assert.deepEqual(mcuPinInfo('D11'), { pwm: true, interrupt: false, serial: false, spi: 'mosi', i2c: null, analog: false, digital: true });
  assert.equal(mcuPinInfo('SDA').i2c, 'sda');
});
test('komponen pasif tidak memakai cadangan nama pin', () => {
  assert.equal(pinFunction(C['dc-motor'], '+'), 'neutral');
  assert.equal(pinFunction(C['dc-motor'], '-'), 'neutral');
});
