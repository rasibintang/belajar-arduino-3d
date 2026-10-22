import { createLEDBar } from '../../parts/ledbar.js';
import { COLOR_OPTIONS } from '../02-blink.js';

const PINS = [2, 3, 4, 5, 6, 7, 8, 9];
const WIRES = ['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'white', 'brown'];

const BODY_ONE = '  for (int i = 0; i < N; i++)\n    digitalWrite(LEDS[i], i == pos);';
const BODY_FILL = '  for (int i = 0; i < N; i++)\n    digitalWrite(LEDS[i], i <= pos);';
const LOOP_RUN = '  for (int p = 0; p < N; p++) {\n    show(p);\n    delay({{speed}});\n  }';
const LOOP_BOUNCE =
  '  for (int p = 0; p < N; p++) {\n    show(p);\n    delay({{speed}});\n  }\n  for (int p = N - 2; p > 0; p--) {\n    show(p);\n    delay({{speed}});\n  }';

/** Urutan posisi untuk tiap pola. */
function positions(pattern) {
  const forward = [0, 1, 2, 3, 4, 5, 6, 7];
  return pattern === 'bounce' ? [...forward, 6, 5, 4, 3, 2, 1] : forward;
}

export default {
  id: 'arrays',
  title: 'Fungsi & array',
  heading: 'Fungsi & array',
  thumb: () => {
    const bar = createLEDBar();
    bar.userData.setLevels([1, 1, 1, 0, 0, 0, 0, 0]);
    return bar;
  },
  summary:
    'Delapan LED berarti delapan pin. Daripada menulis delapan baris yang mirip, simpan nomor pinnya dalam <b>array</b> lalu ulangi dengan <code>for</code>. Bungkus logika tampilan dalam <b>fungsi</b> agar loop tetap rapi.',
  features: [
    { icon: 'ledbar', html: 'Array <code>LEDS[]</code> berisi 8 nomor pin' },
    { icon: 'logic', html: 'Fungsi <code>show(pos)</code> dipanggil berulang' },
    { icon: 'clock', html: 'Klik modul LED untuk pola dan kecepatan' },
  ],

  callouts: [
    { slot: 'tc', icon: 'ledbar', title: 'Modul 8 LED', text: 'Klik untuk mengganti pola.', anchor: (p) => p.bar.userData.anchor },
    { slot: 'bl', icon: 'pins', title: 'Pin 2–9', text: 'Delapan pin berurutan — cocok untuk array.', anchor: (p) => p.board.userData.pinAnchor('D5') },
    { slot: 'br', icon: 'gnd', title: 'GND', text: 'Satu ground untuk semua LED.', anchor: (p) => p.board.userData.pinAnchor('GND') },
  ],

  build(kit) {
    kit.board();
    kit.breadboard();
    kit.place('bar', createLEDBar(), kit.hole('c', 10), kit.hole('c', 18));
    PINS.forEach((pin, i) => kit.wire(kit.pin(`D${pin}`), kit.hole('a', 11 + i), WIRES[i], { lift: i * 2.5 }));
    kit.wire(kit.pin('GND'), kit.hole('a', 10), 'black', { lift: 22 });
  },

  params: [
    {
      key: 'pattern',
      part: 'bar',
      label: 'Pola',
      type: 'choice',
      value: 'run',
      options: [
        { value: 'run', label: 'Berjalan', code: { body: BODY_ONE, loop: LOOP_RUN } },
        { value: 'bounce', label: 'Pantul', code: { body: BODY_ONE, loop: LOOP_BOUNCE } },
        { value: 'fill', label: 'Isi', code: { body: BODY_FILL, loop: LOOP_RUN } },
      ],
    },
    { key: 'speed', part: 'bar', label: 'Jeda', type: 'range', min: 40, max: 400, step: 10, value: 120, unit: 'ms' },
    { key: 'color', part: 'bar', label: 'Warna', type: 'swatch', value: 'red', options: COLOR_OPTIONS },
  ],
  apply(p, parts) {
    parts.bar.userData.setColor(p.color);
  },

  code: `const int LEDS[] = {2, 3, 4, 5, 6, 7, 8, 9};
const int N = 8;

void setup() {
  for (int i = 0; i < N; i++)
    pinMode(LEDS[i], OUTPUT);
}

void show(int pos) {
{{pattern.body}}
}

void loop() {
{{pattern.loop}}
}`,
  explain: [
    '<code>LEDS[]</code> menyimpan 8 nomor pin; <code>LEDS[0]</code> adalah 2, <code>LEDS[7]</code> adalah 9.',
    'Loop <code>for</code> di <code>setup()</code> mengatur kedelapan pin sekaligus.',
    'Fungsi <code>show(pos)</code> menyalakan LED sesuai posisi — dipanggil dari <code>loop()</code> dengan nilai berbeda.',
    'Mengganti pola cukup mengubah isi fungsi atau urutan pemanggilannya.',
  ],
  tip: 'Pada pola “isi”, <code>i &lt;= pos</code> menyalakan semua LED sampai posisi itu — seperti indikator level baterai.',
  pinout: [
    ...PINS.map((pin, i) => ({ pin: `D${pin}`, to: `LED ${i + 1}`, color: WIRES[i] })),
    { pin: 'GND', to: 'GND modul', color: 'black' },
  ],
  specs: {
    name: 'Array di Arduino',
    rows: [
      ['Indeks pertama', '0'],
      ['Indeks terakhir', 'N − 1'],
      ['Ukuran', 'Tetap, ditentukan saat dibuat'],
      ['Jumlah elemen', 'sizeof(arr) / sizeof(arr[0])'],
      ['Batas', 'Indeks di luar ukuran = bug!'],
    ],
  },

  quietPins: PINS, // log per LED terlalu ramai; cukup posisinya
  sketch: {
    *setup(io) {
      io.mark('pinMode(LEDS[i]');
      for (const pin of PINS) io.pinMode(pin, io.OUTPUT);
      yield 200;
    },
    *loop(io, p) {
      const seq = positions(p.pattern);
      for (let k = 0; k < seq.length; k++) {
        const pos = seq[k];
        io.mark('show(p)', p.pattern === 'bounce' && k >= 8 ? 1 : 0);
        PINS.forEach((pin, i) => io.digitalWrite(pin, p.pattern === 'fill' ? i <= pos : i === pos));
        io.log(`show(${pos})`);
        yield p.speed;
      }
    },
  },
  update(v, parts) {
    parts.bar.userData.setLevels(PINS.map((pin) => (v.pins[pin] ?? 0) / 255));
  },
};
