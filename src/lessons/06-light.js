import * as THREE from 'three';
import { createLDR } from '../parts/ldr.js';
import { createLamp } from '../parts/lamp.js';
import { createLED } from '../parts/led.js';
import { createResistor } from '../parts/resistor.js';
import { glowPool } from '../parts/lib.js';

const AMBIENT = 70;
let night = null; // keadaan terakhir, agar pesan hanya ditulis saat berubah

/** Bacaan analog A0 dari jarak lampu (cm). Cahaya melemah cepat terhadap jarak. */
function lightReading(p) {
  if (!p.lamp) return AMBIENT;
  return AMBIENT + 920 * Math.pow(3 / p.dist, 1.7);
}

export default {
  id: 'light',
  title: 'Rasakan cahaya',
  heading: 'Rasakan cahaya',
  thumb: () => createLamp(),
  summary:
    'LDR (light-dependent resistor) makin mudah dilewati arus saat makin banyak cahaya mengenainya. Dipasangkan dengan resistor tetap, ia mengubah terang-gelap menjadi tegangan — pas untuk lampu malam yang menyala sendiri saat gelap.',
  features: [
    { icon: 'pulse', html: 'Membaca terang dengan <code>analogRead()</code>' },
    { icon: 'lamp', html: 'Seret lampu menjauh, atau matikan' },
    { icon: 'logic', html: 'LED menyala di bawah ambang batas' },
  ],

  callouts: [
    { slot: 'tc', icon: 'led', title: 'Lampu malam', text: 'Menyala saat bacaan berarti “gelap”.', anchor: (p) => p.led.userData.anchor },
    { slot: 'tr', icon: 'sun', title: 'Sensor cahaya', text: 'Hambatannya turun saat makin terang.', anchor: (p) => p.ldr.userData.anchor },
    { slot: 'bl', icon: 'pulse', title: 'Pin A0', text: 'Membaca pembagi tegangan, 0–1023.', anchor: (p) => p.board.userData.pinAnchor('A0') },
    { slot: 'br', icon: 'lamp', title: 'Lampu meja', text: 'Seret menjauh, atau klik untuk mematikan.', anchor: (p) => p.lamp.userData.anchor },
  ],

  build(kit, api) {
    kit.board();
    kit.breadboard();
    const ldr = kit.place('ldr', createLDR(), kit.hole('c', 20), kit.hole('c', 21));
    kit.place('divider', createResistor({ ohms: 10000, span: 4 * kit.PITCH }), kit.hole('d', 21), kit.hole('d', 25));
    kit.place('resistor', createResistor({ span: 4 * kit.PITCH }), kit.hole('g', 8), kit.hole('g', 12));
    kit.place('led', createLED({ color: 'yellow' }), kit.hole('i', 13), kit.hole('i', 12));

    kit.wire(kit.pin('5V'), kit.hole('a', 20), 'red', { lift: 2 });
    kit.wire(kit.pin('A0'), kit.hole('b', 21), 'green', { lift: 8 });
    kit.wire(kit.pin('GND'), kit.hole('a', 25), 'black', { lift: 14 });
    kit.wire(kit.pin('D9'), kit.hole('j', 8), 'orange');
    kit.wire(kit.pin('GND.1'), kit.hole('j', 13), 'black', { lift: 4 });

    // Lampu di lantai sebelah kanan, kap tepat di atas LDR pada jarak minimum
    const ldrPos = ldr.position.clone();
    const lamp = createLamp();
    // alas lampu harus di luar breadboard (tepi kanan ± x 85)
    lamp.userData.base = new THREE.Vector3(Math.max(ldrPos.x + 36, 100), 0, ldrPos.z);
    kit.root.add(lamp);
    kit.parts.lamp = lamp;
    lamp.userData.drag = {
      axis: new THREE.Vector3(1, 0, 0),
      get: () => api.params.dist * 10,
      set: (mm) => api.setParam('dist', Math.round(mm / 5) / 2),
      min: 30,
      max: 150,
    };

    const pool = glowPool('#ffcf6a', 46);
    pool.position.set(ldrPos.x, ldrPos.y + 0.3, ldrPos.z);
    kit.root.add(pool);
    kit.parts.pool = pool;
  },

  params: [
    { key: 'lamp', part: 'lamp', label: 'Lampu', type: 'choice', value: true, options: [{ value: true, label: 'Nyala' }, { value: false, label: 'Mati' }] },
    { key: 'dist', part: 'lamp', label: 'Jarak lampu', type: 'range', min: 3, max: 15, step: 0.5, value: 4, unit: 'cm' },
    { key: 'threshold', part: 'led', label: 'Ambang gelap', type: 'range', min: 50, max: 1000, step: 10, value: 400 },
  ],
  apply(p, parts) {
    const lamp = parts.lamp;
    lamp.position.copy(lamp.userData.base).x += (p.dist - 3) * 10;
    lamp.userData.setOn(p.lamp);
    const level = (lightReading(p) - AMBIENT) / 920;
    parts.pool.material.opacity = Math.min(0.9, level * 0.9);
  },

  code: `const int SENSOR = A0;
const int LED = 9;
const int DARK = {{threshold}};

void setup() {
  Serial.begin(9600);
  pinMode(LED, OUTPUT);
}

void loop() {
  int light = analogRead(SENSOR);
  Serial.println(light);
  digitalWrite(LED, light < DARK);
  delay(200);
}`,
  explain: [
    'LDR dan resistor 10 kΩ membentuk pembagi tegangan: makin terang, hambatan LDR makin kecil, tegangan di A0 makin tinggi.',
    '<code>analogRead(SENSOR)</code> mengubah tegangan itu menjadi angka 0 (gelap) sampai 1023 (sangat terang).',
    'Jika bacaan di bawah <code>DARK</code>, sketch menganggap gelap dan menyalakan LED.',
  ],
  tip: 'Geser lampu sambil melihat Serial Monitor — cahaya melemah dengan cepat seiring jarak.',
  pinout: [
    { pin: '5V', to: 'Satu kaki LDR', color: 'red' },
    { pin: 'A0', to: 'Titik tengah LDR + resistor 10 kΩ', color: 'green' },
    { pin: 'GND', to: 'Ujung resistor 10 kΩ', color: 'black' },
    { pin: '~9', to: 'Resistor 220 Ω → LED', color: 'orange' },
  ],
  specs: {
    name: 'LDR GL5528',
    rows: [
      ['Hambatan terang (10 lux)', '8–20 kΩ'],
      ['Hambatan gelap', '± 1 MΩ'],
      ['Waktu respons', '20–30 ms'],
      ['Tegangan maks', '150 V DC'],
      ['Puncak kepekaan', '540 nm (hijau-kuning)'],
    ],
  },

  read(pin, v) {
    if (pin === 'A0') return lightReading(v.params) + (Math.random() - 0.5) * 8;
    return 0;
  },
  quietPins: [9], // perubahan LED dijelaskan dengan pesan sendiri di bawah
  sketch: {
    *setup(io) {
      night = null;
      io.pinMode(9, io.OUTPUT);
    },
    *loop(io, p) {
      io.mark('analogRead(SENSOR)');
      const light = io.analogRead('A0');
      io.println(light);
      yield 60;
      io.mark('digitalWrite(LED');
      const dark = light < p.threshold;
      if (dark !== night) {
        night = dark;
        io.log(dark ? `${light} < ${p.threshold} · gelap, lampu malam NYALA` : `${light} ≥ ${p.threshold} · terang, lampu malam mati`);
      }
      io.digitalWrite(9, dark);
      yield 60;
      io.mark('delay(200)');
      yield 200;
    },
  },
  update(v, parts) {
    parts.led.userData.setLevel((v.pins[9] ?? 0) / 255);
  },
};
