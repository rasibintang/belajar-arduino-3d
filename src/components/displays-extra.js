import { createLCD, LCD_PARALLEL_PINS } from '../parts/lcd.js';
import { createSeg7x4 } from '../parts/seg7.js';
import { createPixels } from '../parts/pixels.js';
import { PITCH } from '../parts/lib.js';
import { headerPins } from './spec.js';
import lcdI2c from './lcd-i2c.js';

const PARALLEL_NAMES = {
  VSS: 'Ground',
  VDD: '5 V',
  V0: 'Kontras',
  RS: 'Register select',
  RW: 'Read/write (ke GND)',
  E: 'Enable',
  A: 'Lampu latar +',
  K: 'Lampu latar −',
};

function lcdParallel(cols, rows) {
  return {
    type: `lcd-${cols}x${rows}`,
    name: `LCD ${cols}×${rows} (paralel)`,
    category: 'display',
    icon: 'lcd',
    desc: 'Layar karakter dengan 16 pin. Pakai library LiquidCrystal (mode 4 bit: RS, E, D4–D7).',
    surface: 'floor',
    create: () => createLCD({ cols, rows, i2c: false }),
    pins: headerPins(Object.fromEntries(LCD_PARALLEL_PINS.map((id) => [id, PARALLEL_NAMES[id] ?? `Data ${id}`]))),
    behavior: {
      kind: 'lcd-parallel',
      rs: 'RS',
      e: 'E',
      rw: 'RW',
      vdd: 'VDD',
      vss: 'VSS',
      inputs: ['D0', 'D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7'],
      backlight: ['A', 'K'],
      cols,
      rows,
    },
  };
}

export const lcd1602 = lcdParallel(16, 2);
export const lcd2004 = lcdParallel(20, 4);

export const lcd2004i2c = {
  ...lcdI2c,
  type: 'lcd-2004-i2c',
  name: 'LCD 20×4 I²C',
  desc: 'Layar empat baris × 20 karakter lewat bus I²C. Pakai LiquidCrystal_I2C lcd(0x27, 20, 4).',
  create: () => createLCD({ cols: 20, rows: 4 }),
  behavior: { ...lcdI2c.behavior, cols: 20, rows: 4 },
};

// 5641AS: kaki 1–6 di depan (kiri→kanan), 7–12 di belakang (kanan→kiri)
const SEG4_FRONT = ['E', 'D', 'DP', 'C', 'G', 'DIG4'];
const SEG4_BACK = ['DIG1', 'A', 'F', 'DIG2', 'DIG3', 'B'];
const SEG_COLORS = { red: '#ff3b2f', green: '#3fe07a', blue: '#4d8dff', yellow: '#ffd23a' };
export const seg7x4 = {
  type: 'seg7-4digit',
  name: 'Display 7-segment 4 digit',
  category: 'display',
  icon: 'lcd',
  desc: 'Segmen A–G dan DP dipakai bersama; DIG1–DIG4 memilih digit (multipleks). Pasang resistor di jalur segmen.',
  surface: 'breadboard',
  create: (props) => createSeg7x4({ color: SEG_COLORS[props.color] }),
  props: [
    {
      key: 'color',
      label: 'Warna',
      type: 'swatch',
      value: 'red',
      rebuild: true,
      options: Object.entries(SEG_COLORS).map(([value, color]) => ({ value, label: value, color })),
    },
    {
      key: 'common',
      label: 'Jenis',
      type: 'choice',
      value: 'cathode',
      options: [
        { value: 'cathode', label: 'Katoda bersama' },
        { value: 'anode', label: 'Anoda bersama' },
      ],
    },
  ],
  pins: [
    ...SEG4_FRONT.map((id, i) => ({ id, name: `${i + 1} · ${id.startsWith('DIG') ? `Digit ${id[3]}` : `Segmen ${id}`}`, at: [(i - 2.5) * PITCH, 0, 8.89] })),
    ...SEG4_BACK.map((id, i) => ({ id, name: `${12 - i} · ${id.startsWith('DIG') ? `Digit ${id[3]}` : `Segmen ${id}`}`, at: [(i - 2.5) * PITCH, 0, -8.89] })),
  ],
  behavior: {
    kind: 'seg7mux',
    segments: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'DP'],
    digits: ['DIG1', 'DIG2', 'DIG3', 'DIG4'],
    commonProp: 'common',
  },
};

const pixelPins = headerPins({ DIN: 'Data masuk', VDD: '5 V', GND: 'Ground' });
const pixelBehavior = { kind: 'ws2812', din: 'DIN', vcc: 'VDD', gnd: 'GND' };

export const neopixel = {
  type: 'neopixel',
  name: 'NeoPixel tunggal',
  category: 'output',
  icon: 'rgb',
  desc: 'Satu LED WS2812. DOUT bisa disambung ke DIN NeoPixel berikutnya.',
  surface: 'floor',
  create: () => createPixels({ layout: 'single' }),
  pins: headerPins({ GND: 'Ground', VDD: '5 V', DIN: 'Data masuk', DOUT: 'Data keluar' }),
  behavior: { ...pixelBehavior, count: 1, dout: 'DOUT' },
};

export const neopixelStrip = {
  type: 'neopixel-strip',
  name: 'NeoPixel strip',
  category: 'output',
  icon: 'rgb',
  desc: 'Pita LED WS2812 berjajar. Jumlah LED bisa diubah.',
  surface: 'floor',
  create: (props) => createPixels({ layout: 'strip', count: props.count }),
  props: [
    {
      key: 'count',
      label: 'Jumlah LED',
      type: 'choice',
      value: 8,
      rebuild: true,
      options: [4, 8, 16, 30].map((value) => ({ value, label: String(value) })),
    },
  ],
  pins: pixelPins,
  behavior: { ...pixelBehavior, countProp: 'count' },
};

export const neopixelMatrix = {
  type: 'neopixel-matrix',
  name: 'NeoPixel matrix 8×8',
  category: 'display',
  icon: 'rgb',
  desc: '64 LED WS2812 tersusun baris demi baris (LED 0 di kiri atas).',
  surface: 'floor',
  create: () => createPixels({ layout: 'matrix', count: 64, cols: 8 }),
  pins: pixelPins,
  behavior: { ...pixelBehavior, count: 64 },
};

export const neopixelMeter = {
  type: 'neopixel-meter',
  name: 'LED bar NeoPixel 10',
  category: 'display',
  icon: 'ledbar',
  desc: 'Sepuluh LED WS2812 rapat untuk indikator level.',
  surface: 'floor',
  create: () => createPixels({ layout: 'meter', count: 10 }),
  pins: pixelPins,
  behavior: { ...pixelBehavior, count: 10 },
};
