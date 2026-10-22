import { createServo } from '../parts/servo.js';

// Ujung kabel servo (konektor 3 pin) di sisi badan: cokelat, merah, oranye
const EXIT = [11.5, 4, 0];

export default {
  type: 'servo-sg90',
  name: 'Servo SG90',
  category: 'motor',
  icon: 'servo',
  desc: 'Motor yang berputar ke sudut 0–180° sesuai pulsa di kabel sinyal.',
  surface: 'floor',
  create: () => createServo(),
  pins: [
    { id: 'GND', name: 'Ground (cokelat)', at: [EXIT[0], EXIT[1], EXIT[2] - 2.6] },
    { id: 'V+', name: '5 V (merah)', at: EXIT },
    { id: 'SIG', name: 'Sinyal (oranye)', at: [EXIT[0], EXIT[1], EXIT[2] + 2.6] },
  ],
  behavior: { kind: 'servo', signal: 'SIG', vcc: 'V+', gnd: 'GND', minPulseUs: 544, maxPulseUs: 2400 },
};
