import { createArduino, PIN_NAMES } from '../parts/arduino.js';

const PWM = new Set(['D3', 'D5', 'D6', 'D9', 'D10', 'D11']);

/** Nama tampilan pin, mis. D9 -> "Pin digital ~9 (PWM)". */
function pinLabel(id) {
  const base = id.replace(/\.\d$/, '');
  if (/^D\d+$/.test(id)) return `Pin digital ${PWM.has(id) ? '~' : ''}${id.slice(1)}${PWM.has(id) ? ' (PWM)' : ''}`;
  if (/^A\d$/.test(id)) return `Pin analog ${id}`;
  return { GND: 'Ground (0 V)', '5V': '5 V', '3V3': '3,3 V', VIN: 'VIN (tegangan masuk)', SDA: 'SDA (I²C data)', SCL: 'SCL (I²C detak)' }[base] ?? base;
}

export default {
  type: 'arduino-uno',
  name: 'Arduino Uno R3',
  category: 'board',
  icon: 'chip',
  desc: 'Papan mikrokontroler ATmega328P: 14 pin digital, 6 pin analog.',
  surface: 'floor',
  create: () => createArduino(),
  pins: (props, group) => PIN_NAMES.filter((id) => id !== 'NC').map((id) => ({ id, name: pinLabel(id), at: group.userData.pin(id) })),
  behavior: { kind: 'mcu', chip: 'atmega328p', clockHz: 16e6 },
};
