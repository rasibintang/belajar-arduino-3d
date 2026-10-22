import { createEncoder } from '../../parts/encoder.js';
import { createLCD } from '../../parts/lcd.js';
import { lcdPrint, showLCD } from '../helpers.js';

const STEP = (Math.PI * 2) / 20; // 20 "klik" per putaran
const enc = { angle: 0, steps: 0, seen: 0 };

export default {
  id: 'interrupt',
  title: 'Interrupt',
  heading: 'Interrupt & rotary encoder',
  thumb: () => createEncoder(),
  summary:
    'Rotary encoder mengirim pulsa setiap kali kenop diputar satu “klik”. Pulsa itu singkat — jika <code>loop()</code> sedang sibuk, bisa terlewat. <b>Interrupt</b> membuat chip menghentikan apa pun yang sedang dikerjakan untuk mencatat pulsa, lalu kembali lagi.',
  features: [
    { icon: 'knob', html: 'Seret kenop encoder untuk memutarnya' },
    { icon: 'bolt', html: '<code>attachInterrupt()</code> pada pin 2' },
    { icon: 'lcd', html: 'Loop lambat pun tidak kehilangan langkah' },
  ],

  callouts: [
    { slot: 'bl', icon: 'knob', title: 'Rotary encoder', text: 'Seret ke kiri/kanan untuk memutar.', anchor: (p) => p.encoder.userData.anchor },
    { slot: 'tc', icon: 'bolt', title: 'Pin 2 · interrupt', text: 'Pulsa CLK memicu fungsi onTurn().', anchor: (p) => p.board.userData.pinAnchor('D2') },
    { slot: 'tr', icon: 'lcd', title: 'LCD', text: 'Menampilkan posisi dari variabel volatile.', anchor: (p) => p.lcd.userData.anchor },
  ],

  build(kit) {
    kit.board(-82, 0);
    const lcd = kit.put('lcd', createLCD(), 42, -6);
    kit.wire(kit.pin('GND'), kit.pinOf(lcd, 'GND'), 'black', { lift: 4 });
    kit.wire(kit.pin('5V'), kit.pinOf(lcd, 'VCC'), 'red', { lift: 8 });
    kit.wire(kit.pin('A4'), kit.pinOf(lcd, 'SDA'), 'blue', { lift: 2 });
    kit.wire(kit.pin('A5'), kit.pinOf(lcd, 'SCL'), 'yellow', { lift: 6 });

    const encoder = kit.put('encoder', createEncoder(), -10, 70);
    kit.wire(kit.pin('D2'), kit.pinOf(encoder, 'CLK'), 'green', { lift: 6 });
    kit.wire(kit.pin('D3'), kit.pinOf(encoder, 'DT'), 'purple', { lift: 8 });
    kit.wire(kit.pin('D4'), kit.pinOf(encoder, 'SW'), 'white', { lift: 10 });
    kit.wire(kit.pin('3V3'), kit.pinOf(encoder, '+'), 'red', { lift: 2 });
    kit.wire(kit.pin('GND.2'), kit.pinOf(encoder, 'GND'), 'black', { lift: 4 });

    enc.angle = 0;
    enc.steps = 0;
    enc.seen = 0;
    encoder.userData.knob = {
      get: () => enc.angle * 60,
      set: (v) => {
        enc.angle = v / 60;
        enc.steps = Math.round(enc.angle / STEP);
        encoder.userData.setAngle(enc.steps * STEP); // berhenti tepat di "klik"
      },
      min: -1e6,
      max: 1e6,
      speed: 1,
    };
  },

  params: [
    { key: 'refresh', part: 'lcd', label: 'Jeda loop', type: 'range', min: 50, max: 1500, step: 50, value: 500, unit: 'ms' },
  ],

  code: `#include <LiquidCrystal_I2C.h>

LiquidCrystal_I2C lcd(0x27, 16, 2);
volatile int pos = 0;

void onTurn() {
  if (digitalRead(3) == HIGH) pos++;
  else pos--;
}

void setup() {
  lcd.init();
  lcd.backlight();
  pinMode(2, INPUT);
  pinMode(3, INPUT);
  attachInterrupt(digitalPinToInterrupt(2), onTurn, FALLING);
}

void loop() {
  lcd.setCursor(0, 0);
  lcd.print("Posisi: ");
  lcd.print(pos);
  lcd.print("   ");
  delay({{refresh}});
}`,
  explain: [
    '<code>attachInterrupt()</code> menautkan fungsi <code>onTurn()</code> ke pin 2: setiap sinyal CLK turun, fungsi itu langsung dijalankan.',
    'Arah putaran dibaca dari pin DT: HIGH berarti searah jarum jam, LOW berlawanan.',
    '<code>volatile</code> memberi tahu compiler bahwa <code>pos</code> bisa berubah sewaktu-waktu di luar <code>loop()</code>.',
    'Coba jeda loop 1500 ms dan putar cepat: angka melompat, tetapi tidak ada langkah yang hilang.',
  ],
  tip: 'Di Arduino Uno hanya pin 2 dan 3 yang punya interrupt eksternal. Fungsi interrupt harus sesingkat mungkin — jangan pakai <code>delay()</code> atau <code>Serial</code> di dalamnya.',
  pinout: [
    { pin: 'D2', to: 'CLK encoder (interrupt)', color: 'green' },
    { pin: 'D3', to: 'DT encoder (arah)', color: 'purple' },
    { pin: 'D4', to: 'SW (tombol kenop)', color: 'white' },
    { pin: 'A4 · A5', to: 'SDA · SCL LCD', color: 'blue' },
  ],
  specs: {
    name: 'Rotary encoder KY-040',
    rows: [
      ['Langkah per putaran', '20'],
      ['Output', '2 sinyal kuadratur (CLK, DT)'],
      ['Tombol', 'Ya (tekan kenop)'],
      ['Putaran', 'Tanpa batas'],
      ['Interrupt Uno', 'Pin 2 dan 3'],
    ],
  },

  quietPins: [2, 3],
  sketch: {
    *setup(io) {
      enc.seen = enc.steps;
      io.state.pos = 0;
      io.mark('attachInterrupt');
      yield 200;
    },
    *loop(io, p) {
      io.mark('lcd.print(pos)');
      lcdPrint(io.state, 0, 0, `Posisi: ${io.state.pos}   `);
      yield 100;
      io.mark('delay(');
      yield Math.max(0, p.refresh - 100);
    },
  },
  update(v, parts) {
    // Setiap "klik" baru = satu interrupt, dijalankan seketika di luar loop()
    if (v.running && v.io) {
      while (enc.seen !== enc.steps) {
        const dir = Math.sign(enc.steps - enc.seen);
        enc.seen += dir;
        v.state.pos = (v.state.pos ?? 0) + dir;
        v.io.mark(dir > 0 ? 'pos++' : 'pos--');
        v.io.log(`interrupt! pos = ${v.state.pos}`);
      }
    } else {
      enc.seen = enc.steps;
    }
    showLCD(v, parts.lcd);
  },
};
