import { createButton } from '../parts/button.js';
import { PITCH } from '../parts/lib.js';
import { buttonColorProp } from './inputs-extra.js';

/*
 * Tombol 4 kaki mengangkangi parit breadboard (baris e dan f).
 * Kaki di sisi kiri (1a, 1b) selalu tersambung satu sama lain, begitu juga sisi kanan
 * (2a, 2b). Saat ditekan, sisi kiri tersambung ke sisi kanan.
 */
export default {
  type: 'push-button',
  name: 'Push button',
  category: 'input',
  icon: 'button',
  desc: 'Menyambungkan dua sisi selama ditekan. Klik dan tahan di tampilan 3D.',
  surface: 'breadboard',
  create: (props) => createButton({ color: props.color }),
  props: [buttonColorProp],
  pins: [
    { id: '1a', name: 'Sisi kiri (belakang)', at: [-PITCH, 0, -3 * PITCH * 0.5] },
    { id: '1b', name: 'Sisi kiri (depan)', at: [-PITCH, 0, 3 * PITCH * 0.5] },
    { id: '2a', name: 'Sisi kanan (belakang)', at: [PITCH, 0, -3 * PITCH * 0.5] },
    { id: '2b', name: 'Sisi kanan (depan)', at: [PITCH, 0, 3 * PITCH * 0.5] },
  ],
  behavior: {
    kind: 'switch',
    always: [['1a', '1b'], ['2a', '2b']],
    pressed: [['1a', '2a']],
  },
};
