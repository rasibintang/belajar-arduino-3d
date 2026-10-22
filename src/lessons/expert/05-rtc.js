import { createRTC } from '../../parts/rtc.js';
import { createLCD } from '../../parts/lcd.js';
import { lcdPrint, showLCD, two } from '../helpers.js';

export default {
  id: 'rtc',
  title: 'Jam real-time',
  heading: 'Jam real-time DS3231',
  thumb: () => createRTC(),
  summary:
    '<code>millis()</code> kembali ke nol setiap Arduino dinyalakan ulang. Modul RTC DS3231 punya jam sendiri yang sangat akurat dan baterai koin, jadi tetap tahu tanggal dan jam meski Arduino mati. Bonus: chip ini juga punya sensor suhu.',
  features: [
    { icon: 'clock', html: '<code>rtc.now()</code> memberi jam, menit, detik, tanggal' },
    { icon: 'pin', html: 'Satu bus I²C untuk RTC dan LCD' },
    { icon: 'lcd', html: 'Klik LCD untuk format jam dan baris kedua' },
  ],

  callouts: [
    { slot: 'bl', icon: 'clock', title: 'RTC DS3231', text: 'Baterai koin menjaga jam tetap berjalan.', anchor: (p) => p.rtc.userData.anchor },
    { slot: 'tr', icon: 'lcd', title: 'LCD', text: 'Klik untuk mengganti tampilan.', anchor: (p) => p.lcd.userData.anchor },
    { slot: 'tc', icon: 'pulse', title: 'SDA · SCL', text: 'Dua perangkat, satu bus I²C.', anchor: (p) => p.board.userData.pinAnchor('SDA') },
  ],

  build(kit) {
    kit.board(-82, 0);
    const lcd = kit.put('lcd', createLCD(), 42, -6);
    kit.wire(kit.pin('GND'), kit.pinOf(lcd, 'GND'), 'black', { lift: 4 });
    kit.wire(kit.pin('5V'), kit.pinOf(lcd, 'VCC'), 'red', { lift: 8 });
    kit.wire(kit.pin('A4'), kit.pinOf(lcd, 'SDA'), 'blue', { lift: 2 });
    kit.wire(kit.pin('A5'), kit.pinOf(lcd, 'SCL'), 'yellow', { lift: 6 });

    const rtc = kit.put('rtc', createRTC(), -12, 68);
    kit.wire(kit.pin('GND.2'), kit.pinOf(rtc, 'GND'), 'black', { lift: 2 });
    kit.wire(kit.pin('3V3'), kit.pinOf(rtc, 'VCC'), 'red', { lift: 4 });
    kit.wire(kit.pin('SDA'), kit.pinOf(rtc, 'SDA'), 'blue', { lift: 14 });
    kit.wire(kit.pin('SCL'), kit.pinOf(rtc, 'SCL'), 'yellow', { lift: 18 });
  },

  params: [
    {
      key: 'format',
      part: 'lcd',
      label: 'Format jam',
      type: 'choice',
      value: '24',
      options: [
        { value: '24', label: '24 jam', code: { line: '  lcd.print(dua(now.hour()) + ":" + dua(now.minute()) + ":" + dua(now.second()));' } },
        {
          value: '12',
          label: '12 jam',
          code: { line: '  int h = now.hour() % 12;\n  if (h == 0) h = 12;\n  lcd.print(dua(h) + ":" + dua(now.minute()) + (now.hour() < 12 ? " AM" : " PM"));' },
        },
      ],
    },
    {
      key: 'line2',
      part: 'lcd',
      label: 'Baris kedua',
      type: 'choice',
      value: 'date',
      options: [
        { value: 'date', label: 'Tanggal', code: { line: '  lcd.print(dua(now.day()) + "/" + dua(now.month()) + "/" + String(now.year()));' } },
        { value: 'temp', label: 'Suhu chip', code: { line: '  lcd.print("Suhu: " + String(rtc.getTemperature()) + " C");' } },
      ],
    },
  ],

  code: `#include <RTClib.h>
#include <LiquidCrystal_I2C.h>

RTC_DS3231 rtc;
LiquidCrystal_I2C lcd(0x27, 16, 2);

String dua(int n) { return n < 10 ? "0" + String(n) : String(n); }

void setup() {
  rtc.begin();
  lcd.init();
  lcd.backlight();
}

void loop() {
  DateTime now = rtc.now();
  lcd.setCursor(0, 0);
{{format.line}}
  lcd.setCursor(0, 1);
{{line2.line}}
  delay(1000);
}`,
  explain: [
    '<code>rtc.now()</code> mengembalikan objek <code>DateTime</code> berisi tahun sampai detik.',
    'Fungsi <code>dua()</code> menambahkan nol di depan angka satu digit: 7 → “07”.',
    'Pada format 12 jam, <code>% 12</code> memetakan 13–23 menjadi 1–11, dan 0 menjadi 12.',
    'RTC dan LCD berbagi kabel SDA/SCL — tiap perangkat I²C punya alamat sendiri (DS3231 = 0x68, LCD = 0x27).',
  ],
  tip: 'Atur jam RTC sekali saja dengan <code>rtc.adjust(DateTime(F(__DATE__), F(__TIME__)))</code>, lalu hapus baris itu dan unggah ulang.',
  pinout: [
    { pin: 'SDA · SCL', to: 'RTC (bus I²C)', color: 'blue' },
    { pin: 'A4 · A5', to: 'LCD (bus I²C yang sama)', color: 'yellow' },
    { pin: '3.3V · GND', to: 'VCC · GND RTC', color: 'red' },
    { pin: '5V · GND', to: 'VCC · GND LCD', color: 'black' },
  ],
  specs: {
    name: 'DS3231',
    rows: [
      ['Ketelitian', '± 2 ppm (± 1 menit/tahun)'],
      ['Baterai', 'CR2032, bertahun-tahun'],
      ['Alamat I²C', '0x68'],
      ['Sensor suhu', '± 3 °C'],
      ['Alarm', '2 alarm terprogram'],
    ],
  },

  sketch: {
    *setup(io) {
      io.mark('rtc.begin');
      yield 200;
    },
    *loop(io, p) {
      io.mark('rtc.now()');
      const d = new Date();
      yield 60;
      let line1;
      if (p.format === '24') {
        line1 = `${two(d.getHours())}:${two(d.getMinutes())}:${two(d.getSeconds())}`;
      } else {
        const h = d.getHours() % 12 || 12;
        line1 = `${two(h)}:${two(d.getMinutes())}${d.getHours() < 12 ? ' AM' : ' PM'}`;
      }
      io.mark('lcd.print(dua(', 0);
      lcdPrint(io.state, 0, 0, line1.padEnd(16));
      const line2 = p.line2 === 'date' ? `${two(d.getDate())}/${two(d.getMonth() + 1)}/${d.getFullYear()}` : 'Suhu: 27.25 C';
      lcdPrint(io.state, 0, 1, line2.padEnd(16));
      yield 100;
      io.mark('delay(1000)');
      // tunggu sampai pergantian detik berikutnya agar jam tidak "melompat"
      yield 1000 - new Date().getMilliseconds();
    },
  },
  update(v, parts) {
    showLCD(v, parts.lcd);
  },
};
