import { phrase } from '../../i18n/lessons.js';
import { createLCD } from '../../parts/lcd.js';
import { lcdPrint, showLCD } from '../helpers.js';

const MESSAGES = ['Halo, dunia!', 'Belajar Arduino', 'Selamat pagi :)'];

export default {
  id: 'lcd',
  title: 'Layar LCD',
  heading: 'Layar LCD 16×2',
  thumb: () => {
    const lcd = createLCD();
    lcd.userData.setBacklight(true);
    lcd.userData.setText(['Halo, dunia!', 'Detik: 42'].map(phrase));
    return lcd;
  },
  summary:
    'LCD 16×2 menampilkan dua baris teks, masing-masing 16 karakter. Modul I²C di belakangnya membuat kabelnya cukup empat: dua untuk daya, dua untuk data (SDA dan SCL).',
  features: [
    { icon: 'lcd', html: '<code>lcd.print()</code> menulis teks' },
    { icon: 'pin', html: 'I²C: hanya pin A4 (SDA) dan A5 (SCL)' },
    { icon: 'clock', html: 'Baris kedua menghitung detik' },
  ],

  callouts: [
    { slot: 'tc', icon: 'lcd', title: 'LCD 16×2', text: 'Klik untuk mengganti pesan atau lampu latar.', anchor: (p) => p.lcd.userData.anchor },
    { slot: 'bl', icon: 'pulse', title: 'A4 · A5', text: 'SDA (data) dan SCL (detak) bus I²C.', anchor: (p) => p.board.userData.pinAnchor('A4') },
    { slot: 'br', icon: 'bolt', title: '5V & GND', text: 'Daya untuk layar dan lampu latarnya.', anchor: (p) => p.board.userData.pinAnchor('5V') },
  ],

  build(kit) {
    kit.board();
    const lcd = kit.put('lcd', createLCD(), 42, -2);
    kit.wire(kit.pin('GND'), kit.pinOf(lcd, 'GND'), 'black', { lift: 4 });
    kit.wire(kit.pin('5V'), kit.pinOf(lcd, 'VCC'), 'red', { lift: 8 });
    kit.wire(kit.pin('A4'), kit.pinOf(lcd, 'SDA'), 'blue', { lift: 2 });
    kit.wire(kit.pin('A5'), kit.pinOf(lcd, 'SCL'), 'yellow', { lift: 6 });
  },

  params: [
    { key: 'msg', part: 'lcd', label: 'Pesan baris 1', type: 'choice', value: MESSAGES[0], options: MESSAGES.map((m) => ({ value: m, label: m })) },
    {
      key: 'backlight',
      part: 'lcd',
      label: 'Lampu latar',
      type: 'choice',
      value: 'on',
      options: [
        { value: 'on', label: 'Nyala', code: { call: 'backlight' } },
        { value: 'off', label: 'Mati', code: { call: 'noBacklight' } },
      ],
    },
  ],

  code: `#include <Wire.h>
#include <LiquidCrystal_I2C.h>

LiquidCrystal_I2C lcd(0x27, 16, 2);

void setup() {
  lcd.init();
  lcd.{{backlight.call}}();
  lcd.setCursor(0, 0);
  lcd.print("{{msg}}");
}

void loop() {
  lcd.setCursor(0, 1);
  lcd.print("Detik: ");
  lcd.print(millis() / 1000);
  delay(1000);
}`,
  explain: [
    '<code>LiquidCrystal_I2C lcd(0x27, 16, 2)</code> menyiapkan layar di alamat I²C 0x27, ukuran 16 kolom × 2 baris.',
    '<code>lcd.setCursor(kolom, baris)</code> memindahkan kursor; hitungan dimulai dari 0.',
    '<code>lcd.print()</code> menulis teks atau angka mulai dari posisi kursor.',
    'Baris pertama ditulis sekali di <code>setup()</code>; baris kedua diperbarui tiap detik di <code>loop()</code>.',
  ],
  tip: 'Layar kosong? Putar potensiometer kecil di belakang modul I²C untuk mengatur kontras. Alamatnya bisa juga 0x3F.',
  pinout: [
    { pin: 'GND', to: 'GND modul I²C', color: 'black' },
    { pin: '5V', to: 'VCC modul I²C', color: 'red' },
    { pin: 'A4', to: 'SDA (data)', color: 'blue' },
    { pin: 'A5', to: 'SCL (detak)', color: 'yellow' },
  ],
  specs: {
    name: 'LCD 1602 + I²C',
    rows: [
      ['Tampilan', '16 × 2 karakter'],
      ['Ukuran karakter', '5 × 8 titik'],
      ['Antarmuka', 'I²C (PCF8574)'],
      ['Alamat', '0x27 atau 0x3F'],
      ['Tegangan', '5 V'],
      ['Lampu latar', 'LED, bisa dimatikan'],
    ],
  },

  sketch: {
    *setup(io, p) {
      io.mark('lcd.init');
      io.state.backlight = p.backlight === 'on';
      yield 200;
      io.mark('lcd.print("');
      lcdPrint(io.state, 0, 0, p.msg);
      io.log(`lcd: "${p.msg}"`);
      yield 200;
    },
    *loop(io) {
      io.mark('lcd.print(millis');
      lcdPrint(io.state, 0, 1, `Detik: ${Math.floor(io.millis() / 1000)}`);
      yield 150;
      io.mark('delay(1000)');
      yield 850;
    },
  },
  apply(p, parts, running) {
    // pesan & lampu latar bisa diganti saat berjalan (seolah sketch diunggah ulang)
    if (running) {
      const st = parts.lcd.userData.liveState;
      if (st) {
        lcdPrint(st, 0, 0, p.msg.padEnd(16));
        st.backlight = p.backlight === 'on';
      }
    }
  },
  update(v, parts) {
    parts.lcd.userData.liveState = v.running ? v.state : null;
    showLCD(v, parts.lcd);
  },
};
