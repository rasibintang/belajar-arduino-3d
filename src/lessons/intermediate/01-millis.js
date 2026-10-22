import { createLED } from '../../parts/led.js';
import { addLed } from '../helpers.js';

const s = { lastA: 0, lastB: 0, onA: false, onB: false };

export default {
  id: 'millis',
  title: 'Tanpa delay()',
  heading: 'Tanpa delay()',
  thumb: () => {
    const led = createLED({ color: 'green' });
    led.userData.setLevel(1);
    return led;
  },
  summary:
    '<code>delay()</code> membuat Arduino diam menunggu — selama itu ia tidak bisa mengerjakan hal lain. Dengan <code>millis()</code>, sketch cukup melirik jam lalu memutuskan: dua LED berkedip dengan tempo berbeda, tanpa saling menunggu.',
  features: [
    { icon: 'clock', html: '<code>millis()</code>: milidetik sejak papan menyala' },
    { icon: 'led', html: 'Dua LED, dua tempo, satu loop' },
    { icon: 'logic', html: 'Pola “sudah waktunya belum?”' },
  ],

  callouts: [
    { slot: 'tc', icon: 'clock', title: 'millis()', text: 'Jam internal chip, terus bertambah tiap milidetik.', anchor: (p) => p.board.userData.anchors.chip },
    { slot: 'tr', icon: 'led', title: 'LED A · pin 13', text: 'Berkedip mengikuti tempo A.', anchor: (p) => p.ledA.userData.anchor },
    { slot: 'bl', icon: 'logic', title: 'Tanpa menunggu', text: 'Loop berputar ribuan kali per detik.', anchor: (p) => p.board.userData.pinAnchor('D12') },
    { slot: 'br', icon: 'led', title: 'LED B · pin 12', text: 'Berkedip mengikuti tempo B.', anchor: (p) => p.ledB.userData.anchor },
  ],

  build(kit) {
    kit.board();
    kit.breadboard();
    addLed(kit, { key: 'ledA', col: 6, pin: 'D13', gnd: 'GND.1', color: 'red' });
    addLed(kit, { key: 'ledB', col: 17, back: true, pin: 'D12', gnd: 'GND', color: 'green', wire: 'yellow', lift: 8 });
  },

  params: [
    { key: 'tA', part: 'ledA', label: 'Tempo A', type: 'range', min: 100, max: 1500, step: 10, value: 500, unit: 'ms' },
    { key: 'tB', part: 'ledB', label: 'Tempo B', type: 'range', min: 100, max: 1500, step: 10, value: 330, unit: 'ms' },
  ],

  code: `const int LED_A = 13;
const int LED_B = 12;
unsigned long lastA = 0, lastB = 0;
bool onA = false, onB = false;

void setup() {
  pinMode(LED_A, OUTPUT);
  pinMode(LED_B, OUTPUT);
}

void loop() {
  unsigned long now = millis();

  if (now - lastA >= {{tA}}) {
    lastA = now;
    onA = !onA;
    digitalWrite(LED_A, onA);
  }
  if (now - lastB >= {{tB}}) {
    lastB = now;
    onB = !onB;
    digitalWrite(LED_B, onB);
  }
}`,
  explain: [
    '<code>millis()</code> mengembalikan jumlah milidetik sejak papan menyala; nilainya terus naik.',
    'Tiap LED mengingat kapan terakhir berganti (<code>lastA</code>, <code>lastB</code>).',
    'Jika selisihnya sudah mencapai tempo, LED dibalik dan waktunya dicatat ulang.',
    'Tidak ada <code>delay()</code>, jadi loop selalu siap — misalnya untuk membaca tombol di saat yang sama.',
  ],
  tip: 'Pakai <code>unsigned long</code> untuk waktu: <code>int</code> hanya sampai 32.767 ms (± 33 detik) lalu meluap.',
  pinout: [
    { pin: 'D13', to: 'Resistor → LED A (merah)', color: 'orange' },
    { pin: 'D12', to: 'Resistor → LED B (hijau)', color: 'yellow' },
    { pin: 'GND', to: 'Kaki pendek kedua LED', color: 'black' },
  ],
  specs: {
    name: 'Fungsi waktu Arduino',
    rows: [
      ['millis()', 'Milidetik sejak menyala'],
      ['Meluap setelah', '± 49,7 hari'],
      ['micros()', 'Mikrodetik, resolusi 4 µs'],
      ['delay(ms)', 'Memblokir program'],
      ['Tipe data', 'unsigned long (32 bit)'],
    ],
  },

  sketch: {
    *setup(io) {
      Object.assign(s, { lastA: 0, lastB: 0, onA: false, onB: false });
      io.mark('pinMode(LED_A');
      io.pinMode(13, io.OUTPUT);
      io.pinMode(12, io.OUTPUT);
      yield 200;
    },
    // tanpa yield: loop berputar terus (sekali per frame di simulasi)
    *loop(io, p) {
      const now = io.millis();
      if (now - s.lastA >= p.tA) {
        s.lastA = now;
        s.onA = !s.onA;
        io.digitalWrite(13, s.onA);
        io.mark('onA = !onA');
      }
      if (now - s.lastB >= p.tB) {
        s.lastB = now;
        s.onB = !s.onB;
        io.digitalWrite(12, s.onB);
        io.mark('onB = !onB');
      }
    },
  },
  update(v, parts) {
    parts.ledA.userData.setLevel((v.pins[13] ?? 0) / 255);
    parts.ledB.userData.setLevel((v.pins[12] ?? 0) / 255);
  },
};
