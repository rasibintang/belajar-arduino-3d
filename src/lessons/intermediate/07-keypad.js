import { createKeypad } from '../../parts/keypad.js';
import { addLed } from '../helpers.js';

const PINS = [9, 8, 7, 6, 5, 4, 3, 2]; // R1..R4, C1..C4
const NAMES = ['R1', 'R2', 'R3', 'R4', 'C1', 'C2', 'C3', 'C4'];
const WIRES = ['brown', 'red', 'orange', 'yellow', 'green', 'blue', 'purple', 'white'];
const s = { input: '' };

export default {
  id: 'keypad',
  title: 'Keypad & kunci',
  heading: 'Keypad & kunci kombinasi',
  thumb: () => createKeypad(),
  summary:
    'Keypad 4×4 menyusun 16 tombol dalam 4 baris dan 4 kolom, jadi cukup 8 pin. Library Keypad memindai baris demi baris untuk tahu tombol mana yang ditekan. Kita pakai untuk kunci kombinasi: ketik sandi lalu tekan #.',
  features: [
    { icon: 'keypad', html: 'Klik tombol keypad di tampilan 3D' },
    { icon: 'logic', html: 'Kumpulkan karakter dalam <code>String</code>' },
    { icon: 'led', html: 'Hijau = terbuka, merah = salah' },
  ],

  callouts: [
    { slot: 'bl', icon: 'keypad', title: 'Keypad 4×4', text: 'Ketik sandi, lalu tekan #. Tombol * menghapus.', anchor: (p) => p.keypad.userData.anchor },
    { slot: 'tc', icon: 'pins', title: 'Pin 2–9', text: '4 baris + 4 kolom = 8 kabel.', anchor: (p) => p.board.userData.pinAnchor('D6') },
    { slot: 'tr', icon: 'led', title: 'LED hijau', text: 'Menyala jika sandi benar.', anchor: (p) => p.ok.userData.anchor },
    { slot: 'br', icon: 'led', title: 'LED merah', text: 'Menyala jika sandi salah.', anchor: (p) => p.bad.userData.anchor },
  ],

  build(kit) {
    kit.board();
    kit.breadboard();
    addLed(kit, { key: 'ok', col: 6, pin: 'D12', gnd: 'GND', color: 'green', wire: 'green' });
    addLed(kit, { key: 'bad', col: 18, pin: 'D11', gnd: 'GND.1', color: 'red', wire: 'red', lift: 6 });
    const keypad = kit.put('keypad', createKeypad(), -40, 128);
    NAMES.forEach((name, i) => kit.wire(kit.pin(`D${PINS[i]}`), kit.pinOf(keypad, name), WIRES[i], { lift: 4 + i * 2 }));
  },

  params: [
    {
      key: 'password',
      part: 'keypad',
      label: 'Sandi',
      type: 'choice',
      value: '1234',
      options: ['1234', '2580', '0000'].map((v) => ({ value: v, label: v })),
    },
  ],

  code: `#include <Keypad.h>

char keys[4][4] = {
  {'1','2','3','A'},
  {'4','5','6','B'},
  {'7','8','9','C'},
  {'*','0','#','D'}
};
byte rows[4] = {9, 8, 7, 6};
byte cols[4] = {5, 4, 3, 2};
Keypad pad = Keypad(makeKeymap(keys), rows, cols, 4, 4);
String input = "";

void setup() {
  Serial.begin(9600);
  pinMode(12, OUTPUT);  // hijau
  pinMode(11, OUTPUT);  // merah
}

void loop() {
  char key = pad.getKey();
  if (!key) return;
  Serial.println(key);

  if (key == '#') {
    bool ok = (input == "{{password}}");
    digitalWrite(12, ok);
    digitalWrite(11, !ok);
    Serial.println(ok ? "Terbuka!" : "Salah");
    input = "";
  } else if (key == '*') {
    input = "";
  } else {
    input += key;
  }
}`,
  explain: [
    'Larik <code>keys</code> memetakan posisi baris/kolom ke karakter yang tercetak di tombol.',
    '<code>pad.getKey()</code> memindai keypad dan mengembalikan karakter — atau 0 jika tidak ada yang ditekan.',
    'Karakter dikumpulkan di <code>input</code>; <b>#</b> memeriksa, <b>*</b> menghapus.',
    'Perbandingan <code>input == "1234"</code> memutuskan LED mana yang menyala.',
  ],
  tip: 'Pada alat sungguhan, jangan cetak sandi ke Serial — dan batasi jumlah percobaan agar tidak bisa ditebak terus.',
  pinout: [
    ...NAMES.map((n, i) => ({ pin: `D${PINS[i]}`, to: `${n.startsWith('R') ? 'Baris' : 'Kolom'} ${n.slice(1)}`, color: WIRES[i] })),
    { pin: 'D12 · D11', to: 'LED hijau · LED merah', color: 'green' },
  ],
  specs: {
    name: 'Keypad membran 4×4',
    rows: [
      ['Tombol', '16 (0–9, A–D, *, #)'],
      ['Pin', '8 (4 baris + 4 kolom)'],
      ['Tebal', '± 0,8 mm'],
      ['Umur', '± 1 juta tekanan'],
      ['Library', 'Keypad (Mark Stanley)'],
    ],
  },

  quietPins: [...PINS],
  read(name, v) {
    if (name === 'key') return v.parts.keypad.userData.queue.shift() ?? '';
    return 0;
  },
  sketch: {
    *setup(io) {
      s.input = '';
      io.mark('pinMode(12');
      io.pinMode(12, io.OUTPUT);
      io.pinMode(11, io.OUTPUT);
      yield 100;
    },
    *loop(io, p) {
      const key = io.read('key');
      if (!key) {
        io.mark('pad.getKey');
        return;
      }
      io.mark('Serial.println(key)');
      io.println(key);
      yield 80;
      if (key === '#') {
        const ok = s.input === p.password;
        io.mark('bool ok');
        io.digitalWrite(12, ok);
        io.digitalWrite(11, !ok);
        io.println(ok ? 'Terbuka!' : 'Salah');
        s.input = '';
        yield 150;
      } else if (key === '*') {
        io.mark('input = ""', 2); // ke-0 = deklarasi, ke-1 = setelah '#'
        s.input = '';
        yield 80;
      } else {
        io.mark('input += key');
        s.input += key;
        yield 80;
      }
    },
  },
  update(v, parts) {
    parts.ok.userData.setLevel((v.pins[12] ?? 0) / 255);
    parts.bad.userData.setLevel((v.pins[11] ?? 0) / 255);
  },
};
