import { createKeypad } from '../parts/keypad.js';
import { headerPins } from './spec.js';

export const KEYPAD_LAYOUT = ['123A', '456B', '789C', '*0#D'];

export default {
  type: 'keypad-4x4',
  name: 'Keypad 4×4',
  category: 'input',
  icon: 'keypad',
  desc: '16 tombol dalam matriks 4 baris × 4 kolom. Saat simulasi, klik tombolnya.',
  surface: 'floor',
  create: () => createKeypad(),
  pins: headerPins({ R1: 'Baris 1', R2: 'Baris 2', R3: 'Baris 3', R4: 'Baris 4', C1: 'Kolom 1', C2: 'Kolom 2', C3: 'Kolom 3', C4: 'Kolom 4' }),
  behavior: { kind: 'keypad', rows: ['R1', 'R2', 'R3', 'R4'], cols: ['C1', 'C2', 'C3', 'C4'], layout: KEYPAD_LAYOUT },
};
