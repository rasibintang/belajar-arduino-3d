import { createRTC } from '../parts/rtc.js';
import { headerPins } from './spec.js';

export default {
  type: 'rtc-ds3231',
  name: 'Jam real-time DS3231',
  category: 'sensor',
  icon: 'clock',
  desc: 'Jam akurat lewat I²C (alamat 0x68). Pakai library RTClib. Waktu awal = jam komputermu.',
  surface: 'floor',
  create: () => createRTC(),
  pins: headerPins({ GND: 'Ground', VCC: '5 V', SDA: 'SDA (data)', SCL: 'SCL (detak)' }),
  behavior: { kind: 'i2c-rtc', sda: 'SDA', scl: 'SCL', vcc: 'VCC', gnd: 'GND', address: 0x68 },
};
