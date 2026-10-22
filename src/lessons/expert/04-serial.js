import { createRGBLed } from '../../parts/rgbled.js';
import { createResistor } from '../../parts/resistor.js';

const COLORS = {
  merah: [255, 0, 0],
  hijau: [0, 255, 0],
  biru: [0, 0, 255],
  kuning: [255, 180, 0],
  putih: [255, 255, 255],
  mati: [0, 0, 0],
};

export default {
  id: 'serial',
  title: 'Perintah Serial',
  heading: 'Perintah lewat Serial',
  serialInput: Object.keys(COLORS),
  thumb: () => {
    const led = createRGBLed();
    led.userData.setRGB(0, 200, 255);
    return led;
  },
  summary:
    'Serial Monitor tidak hanya untuk membaca — kamu juga bisa <b>mengirim</b> teks ke Arduino. Sketch membaca perintah baris demi baris lalu bertindak: ketik “merah”, “biru”, atau “mati” untuk mengubah warna LED.',
  features: [
    { icon: 'terminal', html: 'Ketik perintah di bawah Serial Monitor' },
    { icon: 'logic', html: '<code>Serial.available()</code> + <code>readStringUntil()</code>' },
    { icon: 'rgb', html: 'Perintah tak dikenal dijawab dengan pesan' },
  ],

  callouts: [
    { slot: 'tc', icon: 'rgb', title: 'LED RGB', text: 'Warnanya diatur lewat perintah teks.', anchor: (p) => p.rgb.userData.anchor },
    { slot: 'bl', icon: 'usb', title: 'USB = Serial', text: 'Teks dari komputer masuk lewat kabel USB.', anchor: (p) => p.board.userData.anchors.usb },
    { slot: 'br', icon: 'pwm', title: 'Pin ~9 ~10 ~11', text: 'Tiga warna, tiga pin PWM.', anchor: (p) => p.board.userData.pinAnchor('D10') },
  ],

  build(kit) {
    kit.board();
    kit.breadboard();
    kit.place('rgb', createRGBLed(), kit.hole('c', 13), kit.hole('c', 16));
    const span = 3 * kit.PITCH;
    kit.place('r1', createResistor({ span }), kit.hole('f', 13), kit.hole('e', 13));
    kit.place('r2', createResistor({ span }), kit.hole('f', 15), kit.hole('e', 15));
    kit.place('r3', createResistor({ span }), kit.hole('f', 16), kit.hole('e', 16));
    kit.wire(kit.pin('D9'), kit.hole('h', 13), 'red', { lift: 2 });
    kit.wire(kit.pin('D10'), kit.hole('i', 15), 'green', { lift: 6 });
    kit.wire(kit.pin('D11'), kit.hole('j', 16), 'blue', { lift: 10 });
    kit.wire(kit.pin('GND'), kit.hole('a', 14), 'black', { lift: 12 });
  },

  params: [],

  code: `const int R = 9, G = 10, B = 11;

void color(int r, int g, int b) {
  analogWrite(R, r);
  analogWrite(G, g);
  analogWrite(B, b);
}

void setup() {
  Serial.begin(9600);
  Serial.println("Ketik: merah, hijau, biru, kuning, putih, mati");
}

void loop() {
  if (!Serial.available()) return;
  String cmd = Serial.readStringUntil('\\n');
  cmd.trim();

  bool ok = true;
  if (cmd == "merah") color(255, 0, 0);
  else if (cmd == "hijau") color(0, 255, 0);
  else if (cmd == "biru") color(0, 0, 255);
  else if (cmd == "kuning") color(255, 180, 0);
  else if (cmd == "putih") color(255, 255, 255);
  else if (cmd == "mati") color(0, 0, 0);
  else ok = false;

  Serial.println(ok ? "OK: " + cmd : "Tidak dikenal: " + cmd);
}`,
  explain: [
    '<code>Serial.available()</code> memberi tahu berapa karakter sudah tiba dari komputer; 0 berarti belum ada.',
    '<code>readStringUntil(\'\\n\')</code> membaca sampai tombol Enter; <code>trim()</code> membuang spasi berlebih.',
    'Rantai <code>if … else if</code> mencocokkan perintah dan memanggil fungsi <code>color()</code>.',
    'Sketch selalu membalas, jadi pengguna tahu perintahnya diterima atau tidak.',
  ],
  tip: 'Kembangkan menjadi perintah berparameter, mis. “rgb 255 80 0” — pecah teks dengan <code>indexOf(\' \')</code> dan <code>toInt()</code>.',
  pinout: [
    { pin: '~9', to: 'Resistor → kaki merah', color: 'red' },
    { pin: '~10', to: 'Resistor → kaki hijau', color: 'green' },
    { pin: '~11', to: 'Resistor → kaki biru', color: 'blue' },
    { pin: 'GND', to: 'Katoda bersama', color: 'black' },
    { pin: 'USB', to: 'Serial dari komputer (D0/D1)' },
  ],
  specs: {
    name: 'Serial (UART)',
    rows: [
      ['Kecepatan umum', '9600 / 115200 baud'],
      ['Pin', 'D0 (RX), D1 (TX)'],
      ['Buffer masuk', '64 byte'],
      ['Akhir baris', '\\n (newline)'],
      ['Jalur', 'Lewat chip USB ATmega16U2'],
    ],
  },

  logPwm: false,
  sketch: {
    *setup(io) {
      io.mark('Serial.println("Ketik');
      io.println('Ketik: merah, hijau, biru, kuning, putih, mati');
      yield 100;
    },
    *loop(io) {
      if (!io.available()) {
        io.mark('Serial.available');
        return;
      }
      const cmd = io.readLine().trim().toLowerCase();
      io.mark('readStringUntil');
      yield 60;
      const rgb = COLORS[cmd];
      if (rgb) {
        io.mark(`cmd == "${cmd}"`);
        io.analogWrite(9, rgb[0]);
        io.analogWrite(10, rgb[1]);
        io.analogWrite(11, rgb[2]);
      } else {
        io.mark('else ok = false');
      }
      yield 60;
      io.mark('Serial.println(ok');
      io.println(rgb ? `OK: ${cmd}` : `Tidak dikenal: ${cmd}`);
    },
  },
  update(v, parts) {
    parts.rgb.userData.setRGB(v.pins[9] ?? 0, v.pins[10] ?? 0, v.pins[11] ?? 0);
  },
};
