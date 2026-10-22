import { createBuzzer } from '../parts/buzzer.js';
import { PITCH } from '../parts/lib.js';

export default {
  type: 'buzzer',
  name: 'Buzzer piezo pasif',
  category: 'output',
  icon: 'sound',
  desc: 'Berbunyi saat pinnya dinyalakan-matikan dengan cepat — gunakan tone().',
  surface: 'breadboard',
  create: () => createBuzzer(),
  pins: [
    { id: '-', name: 'Kaki − (pendek)', at: [-1.5 * PITCH, 0, 0] },
    { id: '+', name: 'Kaki + (panjang)', at: [1.5 * PITCH, 0, 0] },
  ],
  behavior: { kind: 'buzzer', plus: '+', minus: '-' },
};
