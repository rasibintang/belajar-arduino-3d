import { createTransistor } from '../parts/transistor.js';
import { legsAlongX } from './spec.js';

export default {
  type: 'npn-tip120',
  name: 'Transistor TIP120 (NPN)',
  category: 'basic',
  icon: 'transistor',
  desc: 'Saklar elektronik: arus kecil di basis menyambungkan kolektor ke emitor. Pakai resistor 1 kΩ di basis.',
  surface: 'breadboard',
  create: () => createTransistor(),
  pins: legsAlongX([
    ['B', 'Basis'],
    ['C', 'Kolektor'],
    ['E', 'Emitor'],
  ]),
  behavior: { kind: 'npn', base: 'B', collector: 'C', emitter: 'E', vbe: 1.2 },
};
