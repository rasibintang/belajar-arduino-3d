import { createPotentiometer } from '../parts/potentiometer.js';
import { legsAlongX } from './spec.js';

export default {
  type: 'potentiometer',
  name: 'Potensiometer 10 kΩ',
  category: 'input',
  icon: 'knob',
  desc: 'Resistor putar: kaki tengah (wiper) memberi tegangan 0–5 V sesuai posisi kenop.',
  surface: 'breadboard',
  create: () => createPotentiometer(),
  apply: (group, props) => group.userData.setValue(props.value),
  props: [{ key: 'value', label: 'Posisi kenop', type: 'range', min: 0, max: 1023, step: 1, value: 512 }],
  pins: legsAlongX([
    ['1', 'Ujung 1'],
    ['W', 'Wiper (tengah)'],
    ['3', 'Ujung 2'],
  ]),
  behavior: { kind: 'pot', end1: '1', wiper: 'W', end2: '3', ohms: 10000, positionProp: 'value' },
};
