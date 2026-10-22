import { createLEDBar } from '../../parts/ledbar.js';
import { createDIP } from '../../parts/dip.js';

const s = { leds: 0 };

export default {
  id: 'shift',
  title: 'Shift register',
  heading: 'Shift register 74HC595',
  thumb: () => createDIP({ label: '74HC595' }),
  summary:
    'Kehabisan pin? Chip 74HC595 menerima 8 bit satu per satu lewat satu kabel data, lalu mengeluarkannya serentak ke 8 output. Hanya 3 pin Arduino untuk 8 LED — dan chipnya bisa dirangkai untuk 16, 24, atau lebih.',
  features: [
    { icon: 'chip', html: '<code>shiftOut()</code> mengirim 8 bit' },
    { icon: 'pins', html: '3 pin: DATA, CLOCK, LATCH' },
    { icon: 'ledbar', html: 'Klik chip untuk mengganti pola bit' },
  ],

  callouts: [
    { slot: 'tc', icon: 'chip', title: '74HC595', text: 'Klik untuk mengganti pola.', anchor: (p) => p.chip.userData.anchor },
    { slot: 'tr', icon: 'ledbar', title: '8 output', text: 'Q0–Q7 menyala sesuai bit.', anchor: (p) => p.bar.userData.anchor },
    { slot: 'bl', icon: 'pins', title: 'Pin 11 · 12 · 13', text: 'DATA, LATCH, CLOCK.', anchor: (p) => p.board.userData.pinAnchor('D12') },
  ],

  build(kit) {
    kit.board();
    kit.breadboard();
    const chip = createDIP({ label: '74HC595', key: 'chip', name: 'Shift register 74HC595', desc: '8 bit masuk lewat satu kabel, keluar serentak di 8 pin.' });
    chip.position.copy(kit.groove(15.5));
    kit.root.add(chip);
    kit.parts.chip = chip;
    kit.place('bar', createLEDBar({ color: 'green' }), kit.hole('a', 11), kit.hole('a', 19));
    kit.wire(kit.pin('D11'), kit.hole('j', 14), 'blue', { lift: 2 });
    kit.wire(kit.pin('D12'), kit.hole('j', 15), 'purple', { lift: 6 });
    kit.wire(kit.pin('D13'), kit.hole('j', 16), 'yellow', { lift: 10 });
    kit.wire(kit.pin('5V'), kit.hole('j', 19), 'red', { lift: 4 });
    kit.wire(kit.pin('GND'), kit.hole('b', 11), 'black', { lift: 14 });
  },

  params: [
    {
      key: 'pattern',
      part: 'chip',
      label: 'Pola',
      type: 'choice',
      value: 'count',
      options: [
        { value: 'count', label: 'Hitung biner', code: { line: '  leds = leds + 1;' } },
        { value: 'knight', label: 'Geser', code: { line: '  leds = (leds == 0 || leds == 128) ? 1 : leds << 1;' } },
        { value: 'random', label: 'Acak', code: { line: '  leds = random(256);' } },
      ],
    },
    { key: 'speed', part: 'chip', label: 'Jeda', type: 'range', min: 60, max: 800, step: 20, value: 300, unit: 'ms' },
  ],

  code: `const int DATA = 11;
const int LATCH = 12;
const int CLOCK = 13;
byte leds = 0;

void setup() {
  pinMode(DATA, OUTPUT);
  pinMode(LATCH, OUTPUT);
  pinMode(CLOCK, OUTPUT);
}

void update() {
  digitalWrite(LATCH, LOW);
  shiftOut(DATA, CLOCK, LSBFIRST, leds);
  digitalWrite(LATCH, HIGH);
}

void loop() {
{{pattern.line}}
  update();
  delay({{speed}});
}`,
  explain: [
    '<code>byte leds</code> menyimpan 8 bit — satu bit untuk tiap LED.',
    '<code>LATCH</code> LOW menahan output lama selama bit baru dikirim.',
    '<code>shiftOut()</code> mengirim 8 bit lewat DATA, satu bit tiap detak CLOCK.',
    '<code>LATCH</code> HIGH menyalin kedelapan bit ke output sekaligus — LED berubah serentak.',
  ],
  tip: 'Sambungkan pin Q7′ ke DATA chip kedua dan kirim 2 byte: 16 LED, tetap 3 pin.',
  pinout: [
    { pin: 'D11', to: 'DS (DATA, pin 14 chip)', color: 'blue' },
    { pin: 'D12', to: 'ST_CP (LATCH, pin 12 chip)', color: 'purple' },
    { pin: 'D13', to: 'SH_CP (CLOCK, pin 11 chip)', color: 'yellow' },
    { pin: '5V', to: 'VCC chip', color: 'red' },
    { pin: 'GND', to: 'GND chip & modul LED', color: 'black' },
  ],
  specs: {
    name: '74HC595',
    rows: [
      ['Jenis', 'Serial-in, parallel-out'],
      ['Output', '8 (Q0–Q7)'],
      ['Tegangan', '2–6 V'],
      ['Arus per pin', '± 6 mA (maks 35 mA)'],
      ['Kecepatan', '> 25 MHz'],
      ['Kemasan', 'DIP-16'],
    ],
  },

  quietPins: [11, 12, 13],
  sketch: {
    *setup(io) {
      s.leds = 0;
      io.mark('pinMode(DATA');
      for (const pin of [11, 12, 13]) io.pinMode(pin, io.OUTPUT);
      yield 200;
    },
    *loop(io, p) {
      io.mark({ count: 'leds = leds + 1', knight: 'leds = (leds', random: 'leds = random' }[p.pattern]);
      if (p.pattern === 'count') s.leds = (s.leds + 1) & 255;
      else if (p.pattern === 'knight') s.leds = s.leds === 0 || s.leds === 128 ? 1 : (s.leds << 1) & 255;
      else s.leds = io.random(256);
      yield 60;
      io.mark('shiftOut');
      io.state.bits = s.leds;
      io.log(`shiftOut → ${s.leds.toString(2).padStart(8, '0')}  (${s.leds})`);
      yield 60;
      io.mark('delay(');
      yield Math.max(0, p.speed - 120);
    },
  },
  update(v, parts) {
    const bits = v.running ? v.state.bits ?? 0 : 0;
    parts.bar.userData.setLevels(Array.from({ length: 8 }, (_, i) => (bits >> i) & 1));
  },
};
