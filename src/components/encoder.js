import { createEncoder } from '../parts/encoder.js';
import { headerPins } from './spec.js';

export default {
  type: 'rotary-encoder',
  name: 'Rotary encoder KY-040',
  category: 'input',
  icon: 'knob',
  desc: 'Kenop tanpa batas: tiap “klik” mengirim pulsa di CLK dan DT. Saat simulasi, seret kenopnya.',
  surface: 'floor',
  create: () => createEncoder(),
  pins: headerPins({ CLK: 'CLK (A)', DT: 'DT (B)', SW: 'Tombol', '+': '5 V', GND: 'Ground' }),
  behavior: { kind: 'encoder', clk: 'CLK', dt: 'DT', vcc: '+', gnd: 'GND', detents: 20 },
};
