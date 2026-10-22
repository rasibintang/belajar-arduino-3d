import { createJoystick } from '../parts/joystick.js';
import { headerPins } from './spec.js';

export default {
  type: 'joystick',
  name: 'Joystick analog',
  category: 'input',
  icon: 'joystick',
  desc: 'Dua potensiometer (X, Y) dan tombol tekan. Saat simulasi, seret tuasnya; klik untuk menekan.',
  surface: 'floor',
  create: () => createJoystick(),
  pins: headerPins({ GND: 'Ground', '+5V': '5 V', VRx: 'Sumbu X (analog)', VRy: 'Sumbu Y (analog)', SW: 'Tombol (aktif LOW)' }),
  behavior: { kind: 'joystick', vcc: '+5V', gnd: 'GND', x: 'VRx', y: 'VRy', sw: 'SW', ohms: 10000 },
};
