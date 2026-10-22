import { createLED, LED_COLORS } from '../parts/led.js';
import { legsAlongX } from './spec.js';

// tegangan maju tiap warna (V)
const VF = { red: 2.0, yellow: 2.1, green: 2.2, blue: 3.0, white: 3.0 };

export default {
  type: 'led',
  name: 'LED 5 mm',
  category: 'output',
  icon: 'led',
  desc: 'Menyala saat arus mengalir dari kaki panjang (+) ke kaki pendek (−). Selalu pakai resistor.',
  surface: 'breadboard',
  create: (props) => createLED({ color: props.color }),
  apply: (group, props) => group.userData.setColor(props.color),
  props: [
    {
      key: 'color',
      label: 'Warna',
      type: 'swatch',
      value: 'red',
      options: Object.entries(LED_COLORS).map(([value, { label, color }]) => ({ value, label, color })),
    },
  ],
  pins: legsAlongX([
    ['K', 'Katoda (−), kaki pendek'],
    ['A', 'Anoda (+), kaki panjang'],
  ]),
  behavior: { kind: 'led', anode: 'A', cathode: 'K', vf: VF, maxMilliamp: 20 },
};
