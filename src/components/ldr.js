import { createLDR } from '../parts/ldr.js';
import { legsAlongX } from './spec.js';

export default {
  type: 'ldr',
  name: 'Sensor cahaya (LDR)',
  category: 'sensor',
  icon: 'sun',
  desc: 'Hambatannya turun saat makin terang. Pasangkan dengan resistor 10 kΩ sebagai pembagi tegangan.',
  surface: 'breadboard',
  create: () => createLDR(),
  props: [{ key: 'lux', label: 'Cahaya (simulasi)', type: 'range', min: 1, max: 1000, step: 1, value: 200, unit: 'lux' }],
  pins: legsAlongX([
    ['1', 'Kaki 1'],
    ['2', 'Kaki 2'],
  ]),
  behavior: { kind: 'ldr', a: '1', b: '2', luxProp: 'lux' },
};
