import { createRGBLed } from '../parts/rgbled.js';
import { createResistor } from '../parts/resistor.js';

const PRESETS = {
  purple: { label: 'Ungu', rgb: [170, 0, 255], color: '#aa00ff' },
  cyan: { label: 'Sian', rgb: [0, 200, 255], color: '#00c8ff' },
  orange: { label: 'Oranye', rgb: [255, 90, 0], color: '#ff5a00' },
  pink: { label: 'Merah muda', rgb: [255, 40, 120], color: '#ff2878' },
  white: { label: 'Putih', rgb: [255, 255, 255], color: '#f4f2ec' },
};

export default {
  id: 'rgb',
  title: 'Campur warna',
  heading: 'Campur warna',
  thumb: () => {
    const led = createRGBLed();
    led.userData.setRGB(170, 0, 255);
    return led;
  },
  summary:
    'LED RGB berisi tiga LED — merah, hijau, dan biru — di bawah satu lensa susu. Atur terang masing-masing dengan PWM dan cahayanya bercampur menjadi hampir semua warna.',
  features: [
    { icon: 'rgb', html: 'Klik LED untuk mencampur warna' },
    { icon: 'pwm', html: 'Tiga pin PWM: <code>9</code>, <code>10</code>, <code>11</code>' },
    { icon: 'resistor', html: 'Satu resistor untuk tiap warna' },
  ],

  callouts: [
    { slot: 'tc', icon: 'rgb', title: 'LED RGB', text: 'Tiga warna dalam satu lensa — klik untuk mencampur.', anchor: (p) => p.rgb.userData.anchor },
    { slot: 'tr', icon: 'resistor', title: 'Resistor 220 Ω', text: 'Menjaga arus tiap warna tetap aman.', anchor: (p) => p.r2.userData.anchor },
    { slot: 'bl', icon: 'pwm', title: 'Pin ~9 ~10 ~11', text: 'Satu pin PWM untuk tiap warna.', anchor: (p) => p.board.userData.pinAnchor('D10') },
    { slot: 'br', icon: 'gnd', title: 'Katoda bersama', text: 'Kaki terpanjang tersambung ke GND.', anchor: (p) => p.board.userData.pinAnchor('GND') },
  ],

  build(kit) {
    kit.board();
    kit.breadboard();
    kit.place('rgb', createRGBLed(), kit.hole('c', 13), kit.hole('c', 16));
    const span = 3 * kit.PITCH;
    kit.place('r1', createResistor({ span }), kit.hole('f', 13), kit.hole('e', 13));
    kit.place('r2', createResistor({ span }), kit.hole('f', 15), kit.hole('e', 15));
    kit.place('r3', createResistor({ span }), kit.hole('f', 16), kit.hole('e', 16));
    // kaki LED di kolom 13 (R), 14 (GND), 15 (G), 16 (B); resistor menyeberangi parit
    kit.wire(kit.pin('D9'), kit.hole('h', 13), 'red', { lift: 2 });
    kit.wire(kit.pin('D10'), kit.hole('i', 15), 'green', { lift: 6 });
    kit.wire(kit.pin('D11'), kit.hole('j', 16), 'blue', { lift: 10 });
    kit.wire(kit.pin('GND'), kit.hole('a', 14), 'black', { lift: 12 });
  },

  params: [
    {
      key: 'preset',
      part: 'rgb',
      label: 'Warna siap pakai',
      type: 'swatch',
      value: 'purple',
      options: Object.entries(PRESETS).map(([value, p]) => ({ value, label: p.label, color: p.color })),
    },
    { key: 'r', part: 'rgb', label: 'Merah', type: 'range', min: 0, max: 255, step: 1, value: 170 },
    { key: 'g', part: 'rgb', label: 'Hijau', type: 'range', min: 0, max: 255, step: 1, value: 0 },
    { key: 'b', part: 'rgb', label: 'Biru', type: 'range', min: 0, max: 255, step: 1, value: 255 },
  ],
  /** Jaga agar preset dan nilai R/G/B tetap sinkron. */
  constrain(p, changed) {
    if (changed === 'preset' && PRESETS[p.preset]) {
      [p.r, p.g, p.b] = PRESETS[p.preset].rgb;
    } else if (['r', 'g', 'b'].includes(changed)) {
      p.preset = Object.keys(PRESETS).find((k) => PRESETS[k].rgb.every((v, i) => v === [p.r, p.g, p.b][i])) ?? '';
    }
  },
  apply(p, parts, running) {
    if (!running) parts.rgb.userData.setRGB(0, 0, 0);
  },

  code: `const int RED = 9;
const int GREEN = 10;
const int BLUE = 11;

void setup() {
  pinMode(RED, OUTPUT);
  pinMode(GREEN, OUTPUT);
  pinMode(BLUE, OUTPUT);
}

void loop() {
  analogWrite(RED, {{r}});
  analogWrite(GREEN, {{g}});
  analogWrite(BLUE, {{b}});
  delay(100);
}`,
  explain: [
    'Pin <code>9</code>, <code>10</code>, dan <code>11</code> mendukung PWM, jadi tiap warna bisa diredupkan sendiri-sendiri.',
    '<code>analogWrite(RED, 170)</code> menyalakan LED merah pada 170 dari 255 — sekitar dua pertiga terangnya.',
    'Pencampuran terjadi di matamu: merah + biru tampak ungu, ketiganya penuh tampak putih.',
  ],
  tip: 'Ganti angka di kode lewat inspektor: klik LED, lalu geser Merah, Hijau, dan Biru.',
  pinout: [
    { pin: '~9', to: 'Resistor → kaki merah (R)', color: 'red' },
    { pin: '~10', to: 'Resistor → kaki hijau (G)', color: 'green' },
    { pin: '~11', to: 'Resistor → kaki biru (B)', color: 'blue' },
    { pin: 'GND', to: 'Kaki terpanjang (katoda bersama)', color: 'black' },
  ],
  specs: {
    name: 'LED RGB 5 mm',
    rows: [
      ['Jenis', 'Katoda bersama'],
      ['Kaki', '4 (R, −, G, B)'],
      ['Tegangan maju', 'R ± 2 V · G/B ± 3 V'],
      ['Arus per warna', '20 mA maks'],
      ['Lensa', 'Susu (menyebarkan cahaya)'],
    ],
  },

  logPwm: 'all', // catat setiap perubahan warna
  sketch: {
    *setup(io) {
      for (const pin of [9, 10, 11]) io.pinMode(pin, io.OUTPUT);
    },
    *loop(io, p) {
      io.mark('analogWrite(RED');
      io.analogWrite(9, p.r);
      yield 60;
      io.mark('analogWrite(GREEN');
      io.analogWrite(10, p.g);
      yield 60;
      io.mark('analogWrite(BLUE');
      io.analogWrite(11, p.b);
      yield 60;
      io.mark('delay(100)');
      yield 100;
    },
  },
  update(v, parts) {
    parts.rgb.userData.setRGB(v.pins[9] ?? 0, v.pins[10] ?? 0, v.pins[11] ?? 0);
  },
};
