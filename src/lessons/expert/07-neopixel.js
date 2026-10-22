import * as THREE from 'three';
import { createNeoRing } from '../../parts/neopixel.js';

const N = 12;
const COLORS = {
  red: { label: 'Merah', color: '#ff3020', rgb: [255, 40, 20] },
  teal: { label: 'Toska', color: '#00d0b0', rgb: [0, 210, 180] },
  purple: { label: 'Ungu', color: '#a040ff', rgb: [160, 60, 255] },
  amber: { label: 'Jingga', color: '#ffa000', rgb: [255, 160, 0] },
};
const c = new THREE.Color();

/** Hitung warna 12 piksel untuk satu langkah animasi. */
function frame(p, step) {
  const scale = p.bright / 255;
  const base = COLORS[p.color].rgb;
  return Array.from({ length: N }, (_, i) => {
    let rgb;
    if (p.anim === 'rainbow') {
      c.setHSL(((i / N + step * 0.02) % 1 + 1) % 1, 1, 0.5);
      rgb = [c.r * 255, c.g * 255, c.b * 255];
    } else if (p.anim === 'chase') {
      const d = (step - i + N * 100) % N;
      const tail = d === 0 ? 1 : d === 1 ? 0.35 : d === 2 ? 0.12 : 0;
      rgb = base.map((v) => v * tail);
    } else {
      const b = (Math.sin(step * 0.12) + 1) / 2;
      rgb = base.map((v) => v * (0.08 + 0.92 * b));
    }
    return rgb.map((v) => Math.round(v * scale));
  });
}

export default {
  id: 'neopixel',
  title: 'LED NeoPixel',
  heading: 'Ring NeoPixel',
  thumb: () => {
    const ring = createNeoRing();
    ring.userData.setPixels(frame({ anim: 'rainbow', color: 'red', bright: 255 }, 0));
    return ring;
  },
  summary:
    'Setiap LED NeoPixel punya chip kecil di dalamnya. Data warna dikirim berantai lewat <b>satu</b> kabel: LED pertama mengambil warnanya lalu meneruskan sisanya ke LED berikutnya. Dua belas LED RGB, cukup satu pin.',
  features: [
    { icon: 'rgb', html: '<code>setPixelColor(i, warna)</code> per LED' },
    { icon: 'pin', html: 'Satu pin data untuk semua LED' },
    { icon: 'clock', html: 'Klik ring untuk animasi, warna, dan terang' },
  ],

  callouts: [
    { slot: 'tc', icon: 'rgb', title: 'NeoPixel ring', text: 'Klik untuk mengganti animasi.', anchor: (p) => p.ring.userData.anchor },
    { slot: 'bl', icon: 'pin', title: 'Pin 6 → DIN', text: 'Data warna untuk 12 LED sekaligus.', anchor: (p) => p.board.userData.pinAnchor('D6') },
    { slot: 'br', icon: 'bolt', title: '5V · GND', text: 'Tiap LED bisa menarik hingga 60 mA.', anchor: (p) => p.board.userData.pinAnchor('5V') },
  ],

  build(kit) {
    kit.board(-82, 0);
    const ring = kit.put('ring', createNeoRing(), 30, 8);
    kit.wire(kit.pin('D6'), kit.pinOf(ring, 'DIN'), 'green', { lift: 6 });
    kit.wire(kit.pin('5V'), kit.pinOf(ring, '5V'), 'red', { lift: 4 });
    kit.wire(kit.pin('GND'), kit.pinOf(ring, 'GND'), 'black', { lift: 8 });
  },

  params: [
    {
      key: 'anim',
      part: 'ring',
      label: 'Animasi',
      type: 'choice',
      value: 'rainbow',
      options: [
        {
          value: 'rainbow',
          label: 'Pelangi',
          code: { code: '  for (int i = 0; i < 12; i++)\n    ring.setPixelColor(i, ring.ColorHSV((i * 5461 + step * 1311) % 65536));' },
        },
        { value: 'chase', label: 'Kejar', code: { code: '  ring.clear();\n  ring.setPixelColor(step % 12, ring.Color({{color.rgb}}));' } },
        { value: 'breathe', label: 'Napas', code: { code: '  float b = (sin(step * 0.12) + 1) / 2;\n  ring.fill(ring.Color({{color.rgb}}));\n  ring.setBrightness({{bright}} * b);' } },
      ],
    },
    {
      key: 'color',
      part: 'ring',
      label: 'Warna',
      type: 'swatch',
      value: 'teal',
      options: Object.entries(COLORS).map(([value, o]) => ({ value, label: o.label, color: o.color, code: { rgb: o.rgb.join(', ') } })),
    },
    { key: 'bright', part: 'ring', label: 'Kecerahan', type: 'range', min: 20, max: 255, step: 5, value: 160 },
  ],

  code: `#include <Adafruit_NeoPixel.h>

Adafruit_NeoPixel ring(12, 6, NEO_GRB + NEO_KHZ800);
int step = 0;

void setup() {
  ring.begin();
  ring.setBrightness({{bright}});
}

void loop() {
{{anim.code}}
  ring.show();
  step++;
  delay(60);
}`,
  explain: [
    '<code>Adafruit_NeoPixel ring(12, 6, …)</code>: 12 LED di pin 6, urutan warna GRB.',
    '<code>setPixelColor()</code> hanya mengubah memori; warna baru tampil setelah <code>ring.show()</code>.',
    '<code>ColorHSV()</code> memilih warna lewat rona (0–65535) — cara mudah membuat pelangi.',
    '<code>step</code> bertambah tiap putaran sehingga pola bergeser dan tampak bergerak.',
  ],
  tip: '12 LED putih penuh bisa menarik ± 720 mA — terlalu besar untuk USB. Batasi kecerahan atau pakai catu daya 5 V terpisah.',
  pinout: [
    { pin: '~6', to: 'DIN ring', color: 'green' },
    { pin: '5V', to: '5V ring', color: 'red' },
    { pin: 'GND', to: 'GND ring', color: 'black' },
  ],
  specs: {
    name: 'NeoPixel ring (WS2812B)',
    rows: [
      ['Jumlah LED', '12'],
      ['Warna', '24 bit (16,7 juta)'],
      ['Protokol', '1 kabel, 800 kHz'],
      ['Arus per LED', 'hingga 60 mA'],
      ['Tegangan', '5 V'],
    ],
  },

  logPwm: false,
  quietPins: [6],
  sketch: {
    *setup(io) {
      io.mark('ring.begin');
      io.state.step = 0;
      yield 150;
    },
    *loop(io, p) {
      io.mark(p.anim === 'rainbow' ? 'ColorHSV' : p.anim === 'chase' ? 'setPixelColor(step' : 'ring.fill');
      io.state.pixels = frame(p, io.state.step);
      io.state.step++;
      yield 60;
    },
  },
  update(v, parts) {
    parts.ring.userData.setPixels(v.running ? v.state.pixels : null);
  },
};
