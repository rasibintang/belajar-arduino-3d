import { createButton } from '../../parts/button.js';
import { createResistor } from '../../parts/resistor.js';
import { addLed } from '../helpers.js';

// Simulasi pantulan: sesaat setelah tombol berubah, bacaannya melompat-lompat acak
const bounce = { physical: 0, until: 0 };
const s = { count: 0, last: 0, stable: 0, changed: 0 };

export default {
  id: 'debounce',
  title: 'Redam pantulan',
  heading: 'Redam pantulan',
  thumb: () => createButton(),
  summary:
    'Kontak logam di dalam tombol memantul beberapa kali dalam hitungan milidetik. Arduino cukup cepat untuk melihat setiap pantulan — satu tekanan bisa terhitung tiga atau empat kali. Debounce menunggu sampai bacaan tenang.',
  features: [
    { icon: 'button', html: 'Tekan tombol dan lihat hitungannya' },
    { icon: 'pulse', html: 'Bandingkan “tanpa redam” dan “dengan redam”' },
    { icon: 'clock', html: 'Atur waktu tunggu debounce' },
  ],

  callouts: [
    { slot: 'tc', icon: 'button', title: 'Push button', text: 'Klik dan lepas — hitung berapa kali terbaca.', anchor: (p) => p.button.userData.anchor },
    { slot: 'tr', icon: 'led', title: 'LED', text: 'Berganti setiap hitungan bertambah.', anchor: (p) => p.led.userData.anchor },
    { slot: 'bl', icon: 'pin', title: 'Pin 2', text: 'Membaca HIGH/LOW ribuan kali per detik.', anchor: (p) => p.board.userData.pinAnchor('D2') },
    { slot: 'br', icon: 'clock', title: 'Waktu tunggu', text: 'Bacaan harus stabil sekian ms.', anchor: (p) => p.pulldown.userData.anchor },
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
      key: 'mode',
      part: 'button',
      label: 'Cara membaca',
      type: 'choice',
      value: 'naive',
      options: [
        {
          value: 'naive',
          label: 'Tanpa redam',
          code: {
            globals: '',
            logic: '  int now = digitalRead(BUTTON);\n  if (now == HIGH && last == LOW) {\n    count++;\n    Serial.println(count);\n    digitalWrite(LED, count % 2);\n  }\n  last = now;',
          },
        },
        {
          value: 'debounce',
          label: 'Dengan redam',
          code: {
            globals: 'unsigned long changed = 0;\nint stable = LOW;\n',
            logic:
              '  int now = digitalRead(BUTTON);\n  if (now != last) changed = millis();\n  if (millis() - changed > {{wait}} && now != stable) {\n    stable = now;\n    if (stable == HIGH) {\n      count++;\n      Serial.println(count);\n      digitalWrite(LED, count % 2);\n    }\n  }\n  last = now;',
          },
        },
      ],
    },
    { key: 'wait', part: 'pulldown', label: 'Waktu tunggu', type: 'range', min: 5, max: 100, step: 5, value: 30, unit: 'ms' },
  ],

  code: `const int BUTTON = 2;
const int LED = 13;
int count = 0;
int last = LOW;
{{mode.globals}}
void setup() {
  Serial.begin(9600);
  pinMode(BUTTON, INPUT);
  pinMode(LED, OUTPUT);
}

void loop() {
{{mode.logic}}
}`,
  explain: [
    'Setiap kali tombol ditekan atau dilepas, kontaknya bergetar ± 5–20 ms sebelum diam.',
    'Mode <b>tanpa redam</b> menghitung setiap perubahan LOW→HIGH — termasuk pantulan.',
    'Mode <b>dengan redam</b> mencatat kapan bacaan terakhir berubah, dan baru percaya setelah stabil selama waktu tunggu.',
  ],
  tip: 'Klik tombol beberapa kali di mode “tanpa redam”: hitungan sering melompat 2–4 sekaligus. Itulah pantulan!',
  pinout: [
    { pin: '5V', to: 'Satu sisi tombol', color: 'red' },
    { pin: 'D2', to: 'Sisi lain tombol + pull-down 10 kΩ', color: 'blue' },
    { pin: 'D13', to: 'Resistor → LED', color: 'orange' },
    { pin: 'GND', to: 'Pull-down dan LED', color: 'black' },
  ],
  specs: {
    name: 'Pantulan kontak',
    rows: [
      ['Durasi pantulan', '± 1–20 ms'],
      ['Jumlah pantulan', '2–10 kali'],
      ['Kecepatan loop', '> 100.000 kali/detik'],
      ['Waktu tunggu umum', '20–50 ms'],
      ['Alternatif', 'Kapasitor 100 nF (hardware)'],
    ],
  },

  quietPins: [2, 13], // pantulan akan membanjiri log; cukup hitungannya
  read(pin, v) {
    if (pin !== 2) return 0;
    const physical = v.parts.button.userData.pressed ? 1 : 0;
    if (physical !== bounce.physical) {
      bounce.physical = physical;
      bounce.until = v.time + 12;
    }
    return v.time < bounce.until ? (Math.random() < 0.5 ? 1 : 0) : physical;
  },
  sketch: {
    *setup(io) {
      Object.assign(s, { count: 0, last: 0, stable: 0, changed: 0 });
      io.mark('Serial.begin');
      io.pinMode(2, io.INPUT);
      io.pinMode(13, io.OUTPUT);
      yield 100;
    },
    *loop(io, p) {
      const now = io.digitalRead(2);
      if (p.mode === 'naive') {
        if (now && !s.last) {
          s.count++;
          io.println(s.count);
          io.digitalWrite(13, s.count % 2);
          io.mark('count++');
        }
      } else {
        if (now !== s.last) s.changed = io.millis();
        if (io.millis() - s.changed > p.wait && now !== s.stable) {
          s.stable = now;
          if (s.stable) {
            s.count++;
            io.println(s.count);
            io.digitalWrite(13, s.count % 2);
            io.mark('count++');
          }
        }
      }
      s.last = now;
      yield 1; // dibaca tiap 1 ms agar pantulan "terlihat"
    },
  },
  update(v, parts) {
    parts.led.userData.setLevel((v.pins[13] ?? 0) / 255);
  },
};
