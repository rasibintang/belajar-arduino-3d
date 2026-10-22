import { createLEDBar, } from '../parts/ledbar.js';
import { LED_COLORS } from '../parts/led.js';
import { legsAlongX } from './spec.js';

const OUTS = ['L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7', 'L8'];

export default {
  type: 'led-bar',
  name: 'Modul 8 LED',
  category: 'output',
  icon: 'ledbar',
  desc: 'Delapan LED dengan resistor bawaan. Pin HIGH = LED menyala; kaki paling kiri GND.',
  surface: 'breadboard',
  create: (props) => createLEDBar({ color: props.color }),
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
  pins: legsAlongX([['GND', 'Ground'], ...OUTS.map((id, i) => [id, `LED ${i + 1}`])]),
  behavior: { kind: 'indicator', gnd: 'GND', outputs: OUTS, set: (group, levels) => group.userData.setLevels(levels) },
};
