import { createPotentiometer } from '../parts/potentiometer.js';
import { createLED } from '../parts/led.js';
import { createResistor } from '../parts/resistor.js';
import { COLOR_OPTIONS } from './02-blink.js';

export default {
  id: 'knob',
  title: 'Putar kenop',
  heading: 'Putar kenop',
  thumb: () => createPotentiometer(),
  summary:
    'Potensiometer adalah resistor dengan penggeser. Memutar kenop menggeser kaki tengahnya ke mana saja antara 0 V dan 5 V, lalu pin analog mengubah tegangan itu menjadi angka.',
  features: [
    { icon: 'knob', html: 'Seret kenop untuk memutarnya' },
    { icon: 'pulse', html: '<code>analogRead()</code> memberi 0–1023' },
    { icon: 'pwm', html: '<code>analogWrite()</code> meredupkan LED, 0–255' },
  ],

  callouts: [
    { slot: 'tc', icon: 'knob', title: 'Potensiometer', text: 'Seret kenop untuk memutarnya.', anchor: (p) => p.pot.userData.anchor },
    { slot: 'tr', icon: 'led', title: 'LED', text: 'Terangnya mengikuti kenop.', anchor: (p) => p.led.userData.anchor },
    { slot: 'bl', icon: 'pulse', title: 'Pin A0', text: 'Membaca kenop sebagai angka 0–1023.', anchor: (p) => p.board.userData.pinAnchor('A0') },
    { slot: 'br', icon: 'pwm', title: 'Pin ~9 (PWM)', text: 'Meredupkan LED dengan pulsa cepat.', anchor: (p) => p.board.userData.pinAnchor('D9') },
  ],

  build(kit, api) {
    kit.board();
    kit.breadboard();
    const pot = kit.place('pot', createPotentiometer(), kit.hole('c', 17), kit.hole('c', 19));
    pot.userData.knob = {
      get: () => api.params.value,
      set: (v) => api.setParam('value', Math.round(v)),
      min: 0,
      max: 1023,
      speed: 4,
    };
    kit.place('resistor', createResistor({ span: 4 * kit.PITCH }), kit.hole('g', 8), kit.hole('g', 12));
    kit.place('led', createLED(), kit.hole('i', 13), kit.hole('i', 12));

    kit.wire(kit.pin('5V'), kit.hole('a', 17), 'red', { lift: 2 });
    kit.wire(kit.pin('A0'), kit.hole('a', 18), 'green', { lift: 8 });
    kit.wire(kit.pin('GND'), kit.hole('a', 19), 'black', { lift: 14 });
    kit.wire(kit.pin('D9'), kit.hole('j', 8), 'orange');
    kit.wire(kit.pin('GND.1'), kit.hole('j', 13), 'black', { lift: 4 });
  },

  params: [
    { key: 'value', part: 'pot', label: 'Posisi kenop', type: 'range', min: 0, max: 1023, step: 1, value: 620 },
    { key: 'color', part: 'led', label: 'Warna', type: 'swatch', value: 'yellow', options: COLOR_OPTIONS },
  ],
  apply(p, parts) {
    parts.pot.userData.setValue(p.value);
    parts.led.userData.setColor(p.color);
  },

  code: `const int POT = A0;
const int LED = 9;

void setup() {
  Serial.begin(9600);
  pinMode(LED, OUTPUT);
}

void loop() {
  int value = analogRead(POT);
  analogWrite(LED, value / 4);
  Serial.println(value);
  delay(100);
}`,
  explain: [
    '<code>analogRead(POT)</code> mengukur tegangan kaki tengah: 0 V menjadi 0, 5 V menjadi 1023.',
    'PWM hanya sampai 255, jadi <code>value / 4</code> mengecilkan bacaan agar muat.',
    '<code>analogWrite(LED, …)</code> menyalakan-matikan pin 9 sangat cepat sehingga LED tampak redup.',
  ],
  tip: 'Tekan Run lalu buka Serial Monitor untuk melihat angkanya berubah saat kenop diputar.',
  pinout: [
    { pin: '5V', to: 'Kaki kiri potensiometer', color: 'red' },
    { pin: 'A0', to: 'Kaki tengah (wiper)', color: 'green' },
    { pin: 'GND', to: 'Kaki kanan potensiometer', color: 'black' },
    { pin: '~9', to: 'Resistor 220 Ω → LED', color: 'orange' },
  ],
  specs: {
    name: 'Potensiometer putar',
    rows: [
      ['Hambatan', '10 kΩ'],
      ['Sudut putar', '± 270°'],
      ['Kaki', '3 (ujung, wiper, ujung)'],
      ['Karakter', 'Linear (B10K)'],
      ['Daya', '0,1 W'],
    ],
  },

  logPwm: false, // Serial Monitor cukup menampilkan nilai dari Serial.println
  read(pin, v) {
    if (pin === 'A0') return v.params.value + (Math.random() - 0.5) * 3;
    return 0;
  },
  sketch: {
    *setup(io) {
      io.pinMode(9, io.OUTPUT);
    },
    *loop(io) {
      io.mark('analogRead(POT)');
      const value = io.analogRead('A0');
      io.analogWrite(9, Math.floor(value / 4));
      io.println(value);
      io.mark('delay(100)');
      yield 100;
    },
  },
  update(v, parts) {
    parts.led.userData.setLevel((v.pins[9] ?? 0) / 255);
  },
};
