import { createResistor, formatOhms } from '../parts/resistor.js';
import { PITCH } from '../parts/lib.js';

const VALUES = [100, 220, 330, 1000, 4700, 10000, 100000];

export default {
  type: 'resistor',
  name: 'Resistor',
  category: 'basic',
  icon: 'resistor',
  desc: 'Membatasi arus. Nilainya dibaca dari gelang warna.',
  surface: 'breadboard',
  create: (props) => createResistor({ ohms: props.ohms, span: props.span * PITCH }),
  apply: (group, props) => group.userData.setOhms(props.ohms),
  props: [
    { key: 'ohms', label: 'Hambatan', type: 'choice', value: 220, options: VALUES.map((v) => ({ value: v, label: formatOhms(v) })) },
    // jarak kaki (dalam lubang) mengubah bentuk kaki, jadi model dibuat ulang saat diganti
    { key: 'span', label: 'Jarak kaki', type: 'choice', value: 4, rebuild: true, options: [3, 4, 5, 6].map((v) => ({ value: v, label: `${v} lubang` })) },
  ],
  pins: (props) => [
    { id: '1', name: 'Kaki 1', at: [(-props.span * PITCH) / 2, 0, 0] },
    { id: '2', name: 'Kaki 2', at: [(props.span * PITCH) / 2, 0, 0] },
  ],
  behavior: { kind: 'resistor', a: '1', b: '2', ohmsProp: 'ohms' },
};
