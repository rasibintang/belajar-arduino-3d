import { createButton6, createSlideSwitch, createDipSwitch8, createSlidePot } from '../parts/inputs-extra.js';
import { BUTTON_COLORS } from '../parts/button.js';
import { PITCH } from '../parts/lib.js';
import { legsAlongX, headerPins } from './spec.js';

export const buttonColorProp = {
  key: 'color',
  label: 'Warna',
  type: 'swatch',
  value: 'red',
  rebuild: true,
  options: Object.entries(BUTTON_COLORS).map(([value, color]) => ({ value, label: value, color })),
};

export const button6 = {
  type: 'push-button-6mm',
  name: 'Push button 6 mm',
  category: 'input',
  icon: 'button',
  desc: 'Tombol taktil kecil. Sisi kiri dan kanan tersambung selama ditekan.',
  surface: 'breadboard',
  create: (props) => createButton6({ color: props.color }),
  props: [buttonColorProp],
  pins: [
    { id: '1a', name: 'Sisi kiri (belakang)', at: [-PITCH / 2, 0, -3.81] },
    { id: '1b', name: 'Sisi kiri (depan)', at: [-PITCH / 2, 0, 3.81] },
    { id: '2a', name: 'Sisi kanan (belakang)', at: [PITCH / 2, 0, -3.81] },
    { id: '2b', name: 'Sisi kanan (depan)', at: [PITCH / 2, 0, 3.81] },
  ],
  behavior: { kind: 'switch', always: [['1a', '1b'], ['2a', '2b']], pressed: [['1a', '2a']] },
};

export const slideSwitch = {
  type: 'slide-switch',
  name: 'Saklar geser',
  category: 'input',
  icon: 'button',
  desc: 'Kaki tengah tersambung ke kaki kiri atau kanan. Klik saat simulasi untuk menggeser.',
  surface: 'breadboard',
  create: () => createSlideSwitch(),
  pins: legsAlongX([
    ['1', 'Kaki 1'],
    ['2', 'Kaki 2 (common)'],
    ['3', 'Kaki 3'],
  ]),
  behavior: { kind: 'slide-switch', p1: '1', common: '2', p2: '3' },
};

const DIP_FRONT = Array.from({ length: 8 }, (_, i) => `${i + 1}a`);
const DIP_BACK = Array.from({ length: 8 }, (_, i) => `${i + 1}b`);
export const dipSwitch8 = {
  type: 'dip-switch-8',
  name: 'DIP switch 8',
  category: 'input',
  icon: 'pins',
  desc: 'Delapan saklar kecil. Saklar ke-i menyambungkan kaki depan dan belakangnya saat ON.',
  surface: 'breadboard',
  create: () => createDipSwitch8(),
  pins: [
    ...DIP_FRONT.map((id, i) => ({ id, name: `Saklar ${i + 1} (depan)`, at: [(i - 3.5) * PITCH, 0, 3.81] })),
    ...DIP_BACK.map((id, i) => ({ id, name: `Saklar ${i + 1} (belakang)`, at: [(i - 3.5) * PITCH, 0, -3.81] })),
  ],
  behavior: { kind: 'dip', inputs: DIP_FRONT, outputs: DIP_BACK },
};

export const slidePot = {
  type: 'slide-pot',
  name: 'Potensiometer geser',
  category: 'input',
  icon: 'knob',
  desc: 'Seperti potensiometer, tetapi digeser. SIG memberi 0–5 V sesuai posisi.',
  surface: 'floor',
  create: () => createSlidePot(),
  apply: (group, props) => group.userData.setValue(props.value),
  props: [{ key: 'value', label: 'Posisi', type: 'range', min: 0, max: 1023, step: 1, value: 512 }],
  pins: headerPins({ VCC: '5 V', SIG: 'Sinyal', GND: 'Ground' }),
  behavior: { kind: 'pot', end1: 'VCC', wiper: 'SIG', end2: 'GND', ohms: 10000, positionProp: 'value' },
};
