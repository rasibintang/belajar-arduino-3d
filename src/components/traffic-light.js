import { createTrafficLight } from '../parts/trafficlight.js';
import { legsAlongX } from './spec.js';

export default {
  type: 'traffic-light',
  name: 'Modul lampu lalu lintas',
  category: 'output',
  icon: 'traffic',
  desc: 'Tiga LED (merah, kuning, hijau) dengan resistor bawaan.',
  surface: 'breadboard',
  create: () => createTrafficLight(),
  // kaki modul berada 1,6 mm di belakang badan
  pins: legsAlongX(
    [
      ['GND', 'Ground'],
      ['R', 'Merah'],
      ['Y', 'Kuning'],
      ['G', 'Hijau'],
    ],
    -1.6
  ),
  behavior: {
    kind: 'indicator',
    gnd: 'GND',
    outputs: ['R', 'Y', 'G'],
    set: (group, [r, y, g]) => group.userData.set({ red: r > 0.3, yellow: y > 0.3, green: g > 0.3 }),
  },
};
