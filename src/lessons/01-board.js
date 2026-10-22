import { createArduino } from '../parts/arduino.js';

export default {
  id: 'board',
  title: 'Kenali papan',
  heading: 'Arduino Uno',
  thumb: () => createArduino(),
  summary:
    'Arduino Uno adalah papan mikrokontroler berbasis ATmega328P. Harganya terjangkau, mudah diprogram lewat USB, dan cocok untuk belajar elektronika maupun membuat prototipe.',
  features: [
    { icon: 'chip', html: 'Perangkat keras open-source' },
    { icon: 'bulb', html: 'Komunitas besar dengan ribuan contoh' },
    { icon: 'gear', html: 'Dipakai di sekolah, hobi, hingga industri' },
  ],

  callouts: [
    { slot: 'tl', icon: 'usb', title: 'Port USB', text: 'Ke komputer: untuk memprogram dan memberi daya.', anchor: (p) => p.board.userData.anchors.usb },
    { slot: 'tc', icon: 'chip', title: 'Mikrokontroler', text: 'ATmega328P menjalankan kodemu.', anchor: (p) => p.board.userData.anchors.chip },
    { slot: 'tr', icon: 'pins', title: 'Pin digital', text: 'Pin 0–13 untuk input/output digital (~ = PWM).', anchor: (p) => p.board.userData.anchors.digital },
    { slot: 'bl', icon: 'bolt', title: 'Jack daya', text: 'Daya dari adaptor 7–12 V.', anchor: (p) => p.board.userData.anchors.jack },
    { slot: 'bc', icon: 'plug', title: 'Pin daya', text: '5V, 3.3V, GND, dan VIN untuk rangkaian.', anchor: (p) => p.board.userData.anchors.power },
    { slot: 'br', icon: 'pulse', title: 'Pin analog', text: 'A0–A5 membaca sinyal analog.', anchor: (p) => p.board.userData.anchors.analog },
  ],

  build(kit) {
    kit.board(-34, 27);
  },

  params: [],
  code: `void setup() {
  pinMode(LED_BUILTIN, OUTPUT);
}

void loop() {
  digitalWrite(LED_BUILTIN, HIGH);
  delay(1000);
}`,
  explain: [
    '<code>setup()</code> dijalankan satu kali saat papan menyala atau di-reset.',
    '<code>pinMode(LED_BUILTIN, OUTPUT)</code> menjadikan pin 13 — yang tersambung ke LED “L” di papan — sebagai output.',
    '<code>loop()</code> lalu diulang terus-menerus. <code>digitalWrite(…, HIGH)</code> memberi 5 V ke pin sehingga LED menyala.',
  ],
  tip: 'Tekan <b>Run</b> untuk mengunggah: lampu TX/RX berkedip, lalu LED “L” menyala. Klik bagian papan untuk tahu fungsinya.',
  pinout: [
    { pin: 'D0–D13', to: 'Input/output digital (D0 = RX, D1 = TX)' },
    { pin: '~3 5 6 9 10 11', to: 'Pin PWM — bisa “setengah menyala” dengan analogWrite()' },
    { pin: 'A0–A5', to: 'Input analog, dibaca 0–1023 (A4/A5 juga I²C)' },
    { pin: '5V · 3.3V', to: 'Sumber tegangan untuk sensor dan modul' },
    { pin: 'GND', to: 'Ground — titik 0 V bersama' },
    { pin: 'VIN', to: 'Tegangan dari jack daya (7–12 V)' },
  ],
  specs: {
    name: 'Arduino Uno R3',
    rows: [
      ['Mikrokontroler', 'ATmega328P'],
      ['Tegangan kerja', '5 V'],
      ['Tegangan input', '7–12 V'],
      ['Pin I/O digital', '14 (6 PWM)'],
      ['Input analog', '6'],
      ['Memori flash', '32 KB'],
      ['SRAM / EEPROM', '2 KB / 1 KB'],
      ['Kecepatan clock', '16 MHz'],
      ['Ukuran', '68,6 × 53,4 mm'],
    ],
  },

  sketch: {
    *setup(io) {
      io.mark('pinMode(LED_BUILTIN');
      io.pinMode(13, io.OUTPUT);
      yield 300;
    },
    *loop(io) {
      io.mark('digitalWrite(LED_BUILTIN');
      io.digitalWrite(13, io.HIGH);
      yield 300;
      io.mark('delay(1000)');
      yield 1000;
    },
  },
};
