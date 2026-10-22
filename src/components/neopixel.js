import { createNeoRing } from '../parts/neopixel.js';
import { headerPins } from './spec.js';

export default {
  type: 'neopixel-ring',
  name: 'NeoPixel ring 12 LED',
  category: 'output',
  icon: 'rgb',
  desc: '12 LED RGB WS2812B berantai lewat satu kabel data. Pakai library Adafruit NeoPixel.',
  surface: 'floor',
  create: () => createNeoRing(),
  pins: headerPins({ DIN: 'Data masuk', '5V': '5 V', GND: 'Ground' }),
  behavior: { kind: 'ws2812', din: 'DIN', vcc: '5V', gnd: 'GND', count: 12 },
};
