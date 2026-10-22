import { createRGBLed } from '../parts/rgbled.js';
import { legsAlongX } from './spec.js';

export default {
  type: 'rgb-led',
  name: 'LED RGB (katoda bersama)',
  category: 'output',
  icon: 'rgb',
  desc: 'Tiga LED — merah, hijau, biru — dalam satu lensa. Kaki terpanjang (−) ke GND.',
  surface: 'breadboard',
  create: () => createRGBLed(),
  pins: legsAlongX([
    ['R', 'Merah'],
    ['K', 'Katoda bersama (−)'],
    ['G', 'Hijau'],
    ['B', 'Biru'],
  ]),
  behavior: { kind: 'rgb-led', red: 'R', green: 'G', blue: 'B', cathode: 'K' },
};
