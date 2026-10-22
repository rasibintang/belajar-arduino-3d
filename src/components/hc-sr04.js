import { createUltrasonic } from '../parts/ultrasonic.js';
import { legsAlongX } from './spec.js';

export default {
  type: 'hc-sr04',
  name: 'Sensor jarak HC-SR04',
  category: 'sensor',
  icon: 'sonar',
  desc: 'Mengukur jarak 2–400 cm dengan pantulan suara ultrasonik. Transduser menghadap ke depan.',
  surface: 'breadboard',
  create: () => createUltrasonic(),
  props: [{ key: 'distance', label: 'Jarak benda (simulasi)', type: 'range', min: 2, max: 400, step: 1, value: 50, unit: 'cm' }],
  pins: legsAlongX([
    ['VCC', '5 V'],
    ['TRIG', 'Trig (pemicu)'],
    ['ECHO', 'Echo (gema)'],
    ['GND', 'Ground'],
  ]),
  behavior: { kind: 'hcsr04', vcc: 'VCC', trig: 'TRIG', echo: 'ECHO', gnd: 'GND', distanceProp: 'distance' },
};
