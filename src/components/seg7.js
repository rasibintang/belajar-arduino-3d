import { createSeg7 } from '../parts/seg7.js';
import { PITCH } from '../parts/lib.js';

// kaki depan (baris e, kiri→kanan) dan belakang (baris f, kiri→kanan)
const FRONT = ['E', 'D', 'COM1', 'C', 'DP'];
const BACK = ['G', 'F', 'COM2', 'A', 'B'];
const COLORS = { red: '#ff3b2f', green: '#3fe07a', blue: '#4d8dff', yellow: '#ffd23a' };

export default {
  type: 'seg7',
  name: 'Display 7-segment',
  category: 'display',
  icon: 'lcd',
  desc: 'Satu digit angka, katoda bersama. Tiap segmen butuh resistor ± 220 Ω.',
  surface: 'breadboard',
  create: (props) => createSeg7({ color: COLORS[props.color] }),
  props: [
    {
      key: 'color',
      label: 'Warna',
      type: 'swatch',
      value: 'red',
      rebuild: true,
      options: Object.entries(COLORS).map(([value, color]) => ({ value, label: value, color })),
    },
  ],
  pins: [
    ...FRONT.map((id, i) => ({ id, name: id.startsWith('COM') ? 'Katoda bersama' : `Segmen ${id}`, at: [(i - 2) * PITCH, 0, 3.81] })),
    ...BACK.map((id, i) => ({ id, name: id.startsWith('COM') ? 'Katoda bersama' : `Segmen ${id}`, at: [(i - 2) * PITCH, 0, -3.81] })),
  ],
  behavior: { kind: 'seg7', segments: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'DP'], common: 'COM1', always: [['COM1', 'COM2']] },
};
