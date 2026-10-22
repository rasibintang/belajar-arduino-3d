import { createLED, LED_COLORS } from '../parts/led.js';
import { createResistor, formatOhms } from '../parts/resistor.js';
import { ledBrightness } from './kit.js';

export const RESISTOR_OPTIONS = [220, 330, 1000, 10000].map((v) => ({ value: v, label: formatOhms(v) }));
export const COLOR_OPTIONS = Object.entries(LED_COLORS).map(([value, { label, color }]) => ({ value, label, color }));

export default {
  id: 'blink',
  title: 'Kedipkan LED',
  heading: 'Kedipkan LED',
  thumb: () => createLED({ color: 'red' }),
  summary:
    'Rangkaian pertamamu: sebuah LED dan resistor di breadboard, dikendalikan pin 13. Menyalakan dan mematikan pin itu dengan jeda di antaranya membuat LED berkedip.',
  features: [
    { icon: 'pin', html: 'Output digital dengan <code>digitalWrite()</code>' },
    { icon: 'resistor', html: 'Klik resistor untuk mencoba nilai lain' },
    { icon: 'clock', html: 'Klik LED untuk mengganti warna dan tempo' },
  ],

  callouts: [
    { slot: 'tl', icon: 'gnd', title: 'GND', text: 'Kaki pendek (−) mengalirkan arus kembali ke papan.', anchor: (p) => p.board.userData.pinAnchor('GND.1') },
    { slot: 'tc', icon: 'pin', title: 'Pin 13', text: 'Sketch menyalakan dan mematikan pin ini.', anchor: (p) => p.board.userData.pinAnchor('D13') },
    { slot: 'tr', icon: 'led', title: 'LED', text: 'Menyala saat pin 13 bernilai HIGH.', anchor: (p) => p.led.userData.anchor },
    { slot: 'bl', icon: 'bulb', title: 'LED bawaan', text: 'LED “L” di papan ikut pin 13.', anchor: (p) => p.board.userData.anchors.led },
    { slot: 'br', icon: 'resistor', title: 'Resistor', text: 'Menahan arus agar LED tidak rusak.', anchor: (p) => p.resistor.userData.anchor },
  ],

  build(kit) {
    kit.board();
    kit.breadboard();
    kit.place('resistor', createResistor({ span: 4 * kit.PITCH }), kit.hole('d', 8), kit.hole('d', 12));
    kit.place('led', createLED(), kit.hole('b', 13), kit.hole('b', 12));
    kit.wire(kit.pin('D13'), kit.hole('c', 8), 'orange');
    kit.wire(kit.pin('GND.1'), kit.hole('a', 13), 'black', { lift: 6 });
  },

  params: [
    { key: 'color', part: 'led', label: 'Warna', type: 'swatch', value: 'red', options: COLOR_OPTIONS },
    { key: 'on', part: 'led', label: 'Nyala', type: 'range', min: 100, max: 2000, step: 50, value: 1000, unit: 'ms' },
    { key: 'off', part: 'led', label: 'Mati', type: 'range', min: 100, max: 2000, step: 50, value: 1000, unit: 'ms' },
    { key: 'ohms', part: 'resistor', label: 'Nilai resistor', type: 'choice', value: 220, options: RESISTOR_OPTIONS },
  ],
  apply(p, parts) {
    parts.led.userData.setColor(p.color);
    parts.resistor.userData.setOhms(p.ohms);
  },

  code: `const int LED_PIN = 13;

void setup() {
  pinMode(LED_PIN, OUTPUT);
}

void loop() {
  digitalWrite(LED_PIN, HIGH);
  delay({{on}});
  digitalWrite(LED_PIN, LOW);
  delay({{off}});
}`,
  explain: [
    '<code>const int LED_PIN = 13;</code> memberi nama yang mudah dibaca untuk pin 13.',
    'Di <code>setup()</code>, <code>pinMode(LED_PIN, OUTPUT)</code> membuat pin bisa mengalirkan arus.',
    '<code>loop()</code> menulis HIGH, menunggu, menulis LOW, lalu menunggu lagi. Dua jeda itu menentukan irama kedipan.',
  ],
  tip: 'Resistor yang lebih besar meloloskan arus lebih kecil: coba 10 kΩ dan lihat LED meredup.',
  pinout: [
    { pin: 'D13', to: 'Resistor → kaki panjang LED (+)', color: 'orange' },
    { pin: 'GND', to: 'Kaki pendek LED (−)', color: 'black' },
  ],
  specs: {
    name: 'LED 5 mm',
    rows: [
      ['Diameter', '5 mm'],
      ['Tegangan maju', '± 2 V (merah) – 3 V (biru/putih)'],
      ['Arus kerja', '10–20 mA'],
      ['Kaki panjang', 'Anoda (+)'],
      ['Kaki pendek', 'Katoda (−)'],
      ['Resistor umum', '220–330 Ω pada 5 V'],
    ],
  },

  sketch: {
    *setup(io) {
      io.mark('pinMode(LED_PIN');
      io.pinMode(13, io.OUTPUT);
      yield 250;
    },
    *loop(io, p) {
      io.mark('digitalWrite(LED_PIN, HIGH)');
      io.digitalWrite(13, io.HIGH);
      yield 120;
      io.mark('delay(', 0);
      yield p.on;
      io.mark('digitalWrite(LED_PIN, LOW)');
      io.digitalWrite(13, io.LOW);
      yield 120;
      io.mark('delay(', 1);
      yield p.off;
    },
  },
  update(v, parts) {
    parts.led.userData.setLevel(((v.pins[13] ?? 0) / 255) * ledBrightness(v.params.ohms));
  },
};
