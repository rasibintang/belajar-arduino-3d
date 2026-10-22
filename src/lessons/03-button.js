import { createButton } from '../parts/button.js';
import { createLED } from '../parts/led.js';
import { createResistor } from '../parts/resistor.js';

const state = { last: 0, lit: false };

export default {
  id: 'button',
  title: 'Tekan tombol',
  heading: 'Tekan tombol',
  thumb: () => createButton(),
  summary:
    'Input membuat papan bisa “merasakan” dunia. Push button menyambungkan pin 2 ke 5 V selama ditekan; resistor pull-down menjaga pin tetap 0 V saat tombol dilepas.',
  features: [
    { icon: 'button', html: 'Klik dan tahan tombol di tampilan 3D' },
    { icon: 'pin', html: 'Membaca pin dengan <code>digitalRead()</code>' },
    { icon: 'logic', html: 'Pilih logika “tahan” atau “saklar”' },
  ],

  callouts: [
    { slot: 'tc', icon: 'button', title: 'Push button', text: 'Klik dan tahan — pin 2 membaca HIGH.', anchor: (p) => p.button.userData.anchor },
    { slot: 'tr', icon: 'led', title: 'LED', text: 'Sketch yang memutuskan kapan menyala.', anchor: (p) => p.led.userData.anchor },
    { slot: 'bl', icon: 'pin', title: 'Pin 2 (input)', text: '<code>digitalRead()</code> melihat HIGH atau LOW.', anchor: (p) => p.board.userData.pinAnchor('D2') },
    { slot: 'br', icon: 'resistor', title: 'Pull-down', text: '10 kΩ menjaga pin 2 tetap LOW saat dilepas.', anchor: (p) => p.pulldown.userData.anchor },
  ],

  build(kit) {
    kit.board();
    const bb = kit.breadboard();
    // tombol mengangkangi parit di kolom 19–21
    const button = createButton();
    const c = bb.localToWorld(bb.userData.hole('e', 20).setZ(0));
    button.position.copy(c);
    kit.root.add(button);
    kit.parts.button = button;

    kit.place('pulldown', createResistor({ ohms: 10000, span: 4 * kit.PITCH }), kit.hole('c', 21), kit.hole('c', 25));
    kit.place('resistor', createResistor({ span: 4 * kit.PITCH }), kit.hole('d', 6), kit.hole('d', 10));
    kit.place('led', createLED(), kit.hole('b', 11), kit.hole('b', 10));

    kit.wire(kit.pin('5V'), kit.hole('h', 19), 'red', { lift: 4 });
    kit.wire(kit.pin('D2'), kit.hole('a', 21), 'blue', { lift: 8 });
    kit.wire(kit.pin('GND'), kit.hole('a', 25), 'black', { lift: 14 });
    kit.wire(kit.pin('D13'), kit.hole('c', 6), 'orange');
    kit.wire(kit.pin('GND.1'), kit.hole('a', 11), 'black', { lift: 4 });
  },

  params: [
    {
      key: 'mode',
      part: 'button',
      label: 'Logika',
      type: 'choice',
      value: 'hold',
      options: [
        {
          value: 'hold',
          label: 'Tahan',
          code: { globals: '', logic: '  int pressed = digitalRead(BUTTON);\n  digitalWrite(LED, pressed);' },
        },
        {
          value: 'toggle',
          label: 'Saklar',
          code: {
            globals: 'int last = LOW;\nbool lit = false;\n',
            logic:
              '  int now = digitalRead(BUTTON);\n  if (now == HIGH && last == LOW) {\n    lit = !lit;\n    digitalWrite(LED, lit);\n    delay(30);  // redam pantulan\n  }\n  last = now;',
          },
        },
      ],
    },
  ],

  code: `const int BUTTON = 2;
const int LED = 13;
{{mode.globals}}
void setup() {
  pinMode(BUTTON, INPUT);
  pinMode(LED, OUTPUT);
}

void loop() {
{{mode.logic}}
}`,
  explain: [
    '<code>pinMode(BUTTON, INPUT)</code> membuat pin 2 “mendengar”, bukan mengeluarkan arus.',
    '<code>digitalRead(BUTTON)</code> bernilai HIGH selama tombol ditekan, LOW jika tidak.',
    'Pada mode <b>tahan</b>, LED cukup meniru keadaan tombol.',
    'Pada mode <b>saklar</b>, sketch mengingat bacaan terakhir dan membalik LED setiap ada tekanan baru.',
  ],
  tip: 'Dengan <code>INPUT_PULLUP</code> kamu tidak perlu resistor pull-down — tetapi logikanya terbalik: ditekan = LOW.',
  pinout: [
    { pin: '5V', to: 'Satu sisi tombol', color: 'red' },
    { pin: 'D2', to: 'Sisi lain tombol + resistor 10 kΩ', color: 'blue' },
    { pin: 'GND', to: 'Ujung resistor pull-down', color: 'black' },
    { pin: 'D13', to: 'Resistor 220 Ω → LED', color: 'orange' },
  ],
  specs: {
    name: 'Push button 6×6 mm',
    rows: [
      ['Jenis', 'Momentary (kembali sendiri)'],
      ['Kaki', '4 (berpasangan tersambung)'],
      ['Tegangan maks', '12 V DC'],
      ['Arus maks', '50 mA'],
      ['Umur', '± 100.000 tekanan'],
    ],
  },

  read(pin, v) {
    if (pin === 2) return v.parts.button.userData.pressed ? 1 : 0;
    return 0;
  },
  sketch: {
    *setup(io) {
      state.last = 0;
      state.lit = false;
      io.pinMode(2, io.INPUT);
      io.pinMode(13, io.OUTPUT);
    },
    *loop(io, p) {
      if (p.mode === 'hold') {
        io.mark(io.digitalRead(2) ? 'digitalWrite(LED, pressed)' : 'digitalRead(BUTTON)');
        io.digitalWrite(13, io.digitalRead(2));
        return;
      }
      io.mark('int now');
      const now = io.digitalRead(2);
      if (now && !state.last) {
        io.mark('lit = !lit');
        state.lit = !state.lit;
        io.digitalWrite(13, state.lit);
        yield 120;
        io.mark('delay(30)');
        yield 30;
      }
      state.last = now;
    },
  },
  update(v, parts) {
    parts.led.userData.setLevel((v.pins[13] ?? 0) / 255);
  },
};
