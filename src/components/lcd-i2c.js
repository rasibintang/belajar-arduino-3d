import { createLCD } from '../parts/lcd.js';
import { headerPins } from './spec.js';

export default {
  type: 'lcd-i2c',
  name: 'LCD 16×2 I²C',
  category: 'display',
  icon: 'lcd',
  desc: 'Layar dua baris × 16 karakter. Cukup 4 kabel lewat bus I²C.',
  surface: 'floor',
  create: () => createLCD(),
  props: [
    {
      key: 'address',
      label: 'Alamat I²C',
      type: 'choice',
      value: 0x27,
      options: [
        { value: 0x27, label: '0x27' },
        { value: 0x3f, label: '0x3F' },
      ],
    },
  ],
  pins: headerPins({ GND: 'Ground', VCC: '5 V', SDA: 'SDA (data)', SCL: 'SCL (detak)' }),
  behavior: { kind: 'i2c-lcd', sda: 'SDA', scl: 'SCL', vcc: 'VCC', gnd: 'GND', addressProp: 'address', cols: 16, rows: 2 },
};
