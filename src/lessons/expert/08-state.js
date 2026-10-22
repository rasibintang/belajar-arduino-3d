import { createTrafficLight } from '../../parts/trafficlight.js';
import { createButton } from '../../parts/button.js';
import { createResistor } from '../../parts/resistor.js';
import { createBuzzer } from '../../parts/buzzer.js';
import { addLed } from '../helpers.js';

const NAMES = ['HIJAU', 'KUNING', 'MERAH', 'KEMBALI'];
const s = { state: 0, since: 0 };

export default {
  id: 'state',
  title: 'State machine',
  heading: 'State machine: penyeberangan',
  thumb: () => {
    const t = createTrafficLight();
    t.userData.set({ red: true });
    return t;
  },
  summary:
    'Program yang makin besar mudah kusut oleh <code>if</code> bersarang. <b>State machine</b> membaginya menjadi beberapa keadaan yang jelas — HIJAU, KUNING, MERAH, KEMBALI — dan aturan kapan pindah dari satu keadaan ke keadaan lain. Contohnya lampu penyeberangan jalan.',
  features: [
    { icon: 'logic', html: '<code>enum</code> + <code>switch</code> untuk tiap keadaan' },
    { icon: 'button', html: 'Tekan tombol penyeberang di tampilan 3D' },
    { icon: 'clock', html: 'Pindah keadaan pakai <code>millis()</code>, tanpa delay' },
  ],

  callouts: [
    { slot: 'tc', icon: 'traffic', title: 'Lampu kendaraan', text: 'Hijau → kuning → merah.', anchor: (p) => p.traffic.userData.anchor },
    { slot: 'tl', icon: 'button', title: 'Tombol penyeberang', text: 'Klik untuk meminta menyeberang.', anchor: (p) => p.button.userData.anchor },
    { slot: 'tr', icon: 'led', title: 'Lampu pejalan kaki', text: 'Hijau saat boleh menyeberang.', anchor: (p) => p.walk.userData.anchor },
    { slot: 'br', icon: 'sound', title: 'Buzzer', text: 'Berbunyi selama boleh menyeberang.', anchor: (p) => p.buzzer.userData.anchor },
  ],

  build(kit) {
    kit.board();
    kit.breadboard();
    kit.place('traffic', createTrafficLight(), kit.hole('a', 26), kit.hole('a', 29));
    kit.wire(kit.pin('GND.1'), kit.hole('c', 26), 'black', { lift: 2 });
    kit.wire(kit.pin('D4'), kit.hole('c', 27), 'red', { lift: 6 });
    kit.wire(kit.pin('D3'), kit.hole('c', 28), 'yellow', { lift: 10 });
    kit.wire(kit.pin('D2'), kit.hole('c', 29), 'green', { lift: 14 });

    const button = createButton();
    button.position.copy(kit.groove(5));
    kit.root.add(button);
    kit.parts.button = button;
    kit.place('pulldown', createResistor({ ohms: 10000, span: 4 * kit.PITCH }), kit.hole('b', 6), kit.hole('b', 10));
    kit.wire(kit.pin('5V'), kit.hole('j', 4), 'red', { lift: 4 });
    kit.wire(kit.pin('D7'), kit.hole('a', 6), 'blue', { lift: 8 });
    kit.wire(kit.pin('GND'), kit.hole('a', 10), 'black', { lift: 12 });

    addLed(kit, { key: 'stop', col: 12, back: true, pin: 'D12', color: 'red', wire: 'orange', lift: 2 });
    addLed(kit, { key: 'walk', col: 19, back: true, pin: 'D11', color: 'green', wire: 'green', lift: 4 });
    kit.place('buzzer', createBuzzer(), kit.hole('c', 15), kit.hole('c', 18));
    kit.wire(kit.pin('D8'), kit.hole('a', 18), 'purple', { lift: 16 });
    kit.wire(kit.hole('tn', 17), kit.hole('j', 17), 'black', { lift: -4 });
    kit.wire(kit.hole('tn', 25), kit.hole('j', 24), 'black', { lift: -4 });
    kit.wire(kit.pin('GND.2'), kit.hole('tn', 3), 'black', { lift: 6 });
    kit.wire(kit.hole('tn', 14), kit.hole('a', 15), 'black', { lift: 2 });
  },

  params: [
    { key: 'walkTime', part: 'walk', label: 'Waktu menyeberang', type: 'range', min: 2000, max: 9000, step: 500, value: 5000, unit: 'ms' },
  ],

  code: `enum State { HIJAU, KUNING, MERAH, KEMBALI };
State state = HIJAU;
unsigned long since = 0;

void enter(State s) {
  state = s;
  since = millis();
}

void cars(int pin) {
  for (int p = 2; p <= 4; p++) digitalWrite(p, p == pin);
}

void setup() {
  for (int p = 2; p <= 4; p++) pinMode(p, OUTPUT);
  pinMode(7, INPUT);
  pinMode(11, OUTPUT);
  pinMode(12, OUTPUT);
}

void loop() {
  unsigned long t = millis() - since;
  switch (state) {
    case HIJAU:
      cars(2);
      digitalWrite(12, HIGH);
      if (digitalRead(7) == HIGH) enter(KUNING);
      break;
    case KUNING:
      cars(3);
      if (t > 2000) enter(MERAH);
      break;
    case MERAH:
      cars(4);
      digitalWrite(12, LOW);
      digitalWrite(11, HIGH);
      tone(8, 1200, 40);
      if (t > {{walkTime}}) enter(KEMBALI);
      break;
    case KEMBALI:
      digitalWrite(11, LOW);
      digitalWrite(12, HIGH);
      if (t > 1500) enter(HIJAU);
      break;
  }
}`,
  explain: [
    '<code>enum State</code> memberi nama untuk tiap keadaan — jauh lebih jelas daripada angka 0, 1, 2, 3.',
    '<code>switch (state)</code> hanya menjalankan kode milik keadaan sekarang.',
    'Fungsi <code>enter()</code> berpindah keadaan dan mencatat waktunya, sehingga tiap keadaan tahu sudah berapa lama berlangsung.',
    'Tanpa <code>delay()</code>, tombol tetap terbaca kapan saja.',
  ],
  tip: 'Gambar dulu diagram keadaan di kertas (lingkaran = keadaan, panah = syarat pindah). Kodenya tinggal menyalin diagram itu.',
  pinout: [
    { pin: 'D2 · D3 · D4', to: 'Lampu hijau · kuning · merah', color: 'green' },
    { pin: 'D7', to: 'Tombol penyeberang + pull-down', color: 'blue' },
    { pin: 'D12 · D11', to: 'LED merah · hijau pejalan kaki', color: 'orange' },
    { pin: 'D8', to: 'Buzzer', color: 'purple' },
    { pin: 'GND', to: 'Jalur − breadboard', color: 'black' },
  ],
  specs: {
    name: 'Keadaan (state)',
    rows: [
      ['HIJAU', 'Kendaraan jalan, tunggu tombol'],
      ['KUNING', '2 detik, lalu MERAH'],
      ['MERAH', 'Pejalan kaki menyeberang'],
      ['KEMBALI', '1,5 detik jeda aman'],
    ],
  },

  quietPins: [2, 3, 4, 7, 11, 12],
  read(pin, v) {
    if (pin === 7) return v.parts.button.userData.pressed ? 1 : 0;
    return 0;
  },
  sketch: {
    *setup(io) {
      s.state = 0;
      s.since = 0;
      io.mark('pinMode(7');
      yield 150;
      io.log('state: HIJAU');
    },
    *loop(io, p) {
      const t = io.millis() - s.since;
      const enter = (next) => {
        s.state = next;
        s.since = io.millis();
        io.log(`state: ${NAMES[next]}`);
      };
      const cars = (pin) => [2, 3, 4].forEach((q) => io.digitalWrite(q, q === pin));
      if (s.state === 0) {
        io.mark('case HIJAU');
        cars(2);
        io.digitalWrite(12, io.HIGH);
        io.digitalWrite(11, io.LOW);
        if (io.digitalRead(7)) enter(1);
      } else if (s.state === 1) {
        io.mark('case KUNING');
        cars(3);
        if (t > 2000) enter(2);
      } else if (s.state === 2) {
        io.mark('case MERAH');
        cars(4);
        io.digitalWrite(12, io.LOW);
        io.digitalWrite(11, io.HIGH);
        if (Math.floor(t / 500) !== Math.floor((t - 20) / 500)) io.tone(8, 1200, 40);
        if (t > p.walkTime) enter(3);
      } else {
        io.mark('case KEMBALI');
        io.digitalWrite(11, io.LOW);
        io.digitalWrite(12, io.HIGH);
        if (t > 1500) enter(0);
      }
      yield 20;
    },
  },
  update(v, parts, dt) {
    parts.traffic.userData.set({ green: v.pins[2] > 0, yellow: v.pins[3] > 0, red: v.pins[4] > 0 });
    parts.stop.userData.setLevel((v.pins[12] ?? 0) / 255);
    parts.walk.userData.setLevel((v.pins[11] ?? 0) / 255);
    parts.buzzer.userData.setTone(v.tone);
    parts.buzzer.userData.tick(dt);
  },
};
