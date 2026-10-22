import { createButton } from '../../parts/button.js';
import { createResistor } from '../../parts/resistor.js';
import { addLed } from '../helpers.js';

// "EEPROM" simulasi: tetap tersimpan saat sketch di-reset, dihentikan, bahkan saat halaman dimuat ulang
const KEY = 'learn-arduino:eeprom';
const eeprom = {
  get() {
    try {
      return Number(localStorage.getItem(KEY)) || 0;
    } catch {
      return this.mem ?? 0;
    }
  },
  set(v) {
    this.mem = v;
    try {
      localStorage.setItem(KEY, String(v));
    } catch {
      /* mode privat: cukup di memori */
    }
  },
};
let count = 0;

export default {
  id: 'eeprom',
  title: 'Simpan data',
  heading: 'Simpan data di EEPROM',
  thumb: () => createButton(),
  summary:
    'Variabel biasa hilang saat Arduino dimatikan atau di-reset. Chip ATmega328P punya 1024 byte <b>EEPROM</b> yang tetap menyimpan isinya tanpa listrik. Di sini kita menghitung berapa kali tombol ditekan — dan angkanya bertahan setelah reset.',
  features: [
    { icon: 'memory', html: '<code>EEPROM.read()</code> / <code>EEPROM.write()</code>' },
    { icon: 'button', html: 'Tekan tombol untuk menambah hitungan' },
    { icon: 'reset', html: 'Klik tombol RESET merah di papan: angkanya tetap!' },
  ],

  callouts: [
    { slot: 'tc', icon: 'button', title: 'Push button', text: 'Tiap tekanan disimpan ke EEPROM.', anchor: (p) => p.button.userData.anchor },
    { slot: 'tl', icon: 'reset', title: 'Tombol RESET', text: 'Klik untuk me-restart sketch.', anchor: (p) => p.board.userData.anchors.reset },
    { slot: 'bl', icon: 'memory', title: 'EEPROM', text: 'Di dalam ATmega328P — 1 KB yang tidak lupa.', anchor: (p) => p.board.userData.anchors.chip },
    { slot: 'br', icon: 'led', title: 'LED', text: 'Berkedip saat data ditulis.', anchor: (p) => p.led.userData.anchor },
  ],

  build(kit) {
    kit.board();
    kit.breadboard();
    const button = createButton();
    button.position.copy(kit.groove(20));
    kit.root.add(button);
    kit.parts.button = button;
    kit.place('pulldown', createResistor({ ohms: 10000, span: 4 * kit.PITCH }), kit.hole('c', 21), kit.hole('c', 25));
    addLed(kit, { key: 'led', col: 5, pin: 'D13', gnd: 'GND.1' });
    kit.wire(kit.pin('5V'), kit.hole('h', 19), 'red', { lift: 4 });
    kit.wire(kit.pin('D2'), kit.hole('a', 21), 'blue', { lift: 8 });
    kit.wire(kit.pin('GND'), kit.hole('a', 25), 'black', { lift: 14 });
  },

  params: [
    {
      key: 'wipe',
      part: 'button',
      label: 'Isi EEPROM',
      type: 'choice',
      value: 'keep',
      options: [
        { value: 'keep', label: 'Simpan' },
        { value: 'clear', label: 'Kosongkan' },
      ],
    },
  ],
  apply(p) {
    if (p.wipe === 'clear') {
      eeprom.set(0);
      count = 0;
      p.wipe = 'keep';
    }
  },

  code: `#include <EEPROM.h>

const int BUTTON = 2;
const int LED = 13;
byte count;

void setup() {
  Serial.begin(9600);
  pinMode(BUTTON, INPUT);
  pinMode(LED, OUTPUT);
  count = EEPROM.read(0);
  Serial.print("Tersimpan: ");
  Serial.println(count);
}

void loop() {
  if (digitalRead(BUTTON) == HIGH) {
    count++;
    EEPROM.write(0, count);
    Serial.println(count);
    digitalWrite(LED, HIGH);
    delay(300);
    digitalWrite(LED, LOW);
  }
}`,
  explain: [
    '<code>EEPROM.read(0)</code> membaca byte di alamat 0 — nilai yang tersisa dari sebelumnya.',
    'Setiap tekanan, <code>count</code> naik lalu langsung ditulis kembali dengan <code>EEPROM.write(0, count)</code>.',
    'Satu byte hanya muat 0–255; setelah 255 akan kembali ke 0. Untuk angka besar pakai <code>EEPROM.put()</code>.',
  ],
  tip: 'Tiap sel EEPROM tahan ± 100.000 kali tulis. Jangan menulis di setiap putaran loop — tulis hanya saat nilainya berubah.',
  pinout: [
    { pin: '5V', to: 'Satu sisi tombol', color: 'red' },
    { pin: 'D2', to: 'Tombol + pull-down 10 kΩ', color: 'blue' },
    { pin: 'D13', to: 'Resistor → LED', color: 'orange' },
    { pin: 'GND', to: 'Pull-down dan LED', color: 'black' },
  ],
  specs: {
    name: 'EEPROM ATmega328P',
    rows: [
      ['Ukuran', '1024 byte'],
      ['Alamat', '0–1023'],
      ['Daya tahan', '± 100.000 kali tulis/sel'],
      ['Waktu tulis', '± 3,3 ms per byte'],
      ['Isi awal', '255 (0xFF)'],
    ],
  },

  quietPins: [2, 13],
  read(pin, v) {
    if (pin === 2) return v.parts.button.userData.pressed ? 1 : 0;
    return 0;
  },
  sketch: {
    *setup(io) {
      io.pinMode(2, io.INPUT);
      io.pinMode(13, io.OUTPUT);
      io.mark('EEPROM.read(0)');
      count = eeprom.get();
      yield 200;
      io.mark('Serial.println(count)', 0);
      io.println(`Tersimpan: ${count}`);
      yield 100;
    },
    *loop(io) {
      if (!io.digitalRead(2)) {
        io.mark('if (digitalRead(BUTTON)');
        return;
      }
      count = (count + 1) & 255;
      io.mark('EEPROM.write');
      eeprom.set(count);
      io.log(`EEPROM[0] ← ${count}`);
      io.println(count);
      io.digitalWrite(13, io.HIGH);
      yield 300;
      io.digitalWrite(13, io.LOW);
    },
  },
  update(v, parts) {
    parts.led.userData.setLevel((v.pins[13] ?? 0) / 255);
  },
};
