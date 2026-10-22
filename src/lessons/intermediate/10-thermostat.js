import * as THREE from 'three';
import { createDHT } from '../../parts/dht.js';
import { createLCD } from '../../parts/lcd.js';
import { createRelay } from '../../parts/relay.js';
import { createMotor } from '../../parts/motor.js';
import { createPlug } from '../../parts/bulb.js';
import { lcdPrint, showLCD } from '../helpers.js';
import { relayClick } from './09-relay.js';

// Kipas mendinginkan ruangan perlahan; saat mati, suhu kembali ke suhu ruangan.
const room = { cool: 0, fan: false };

function reading(p) {
  return p.temp - room.cool;
}

export default {
  id: 'thermostat',
  title: 'Proyek: termostat',
  heading: 'Proyek: termostat kipas',
  thumb: () => {
    const lcd = createLCD();
    lcd.userData.setBacklight(true);
    lcd.userData.setText(['Suhu: 29.0 C', 'Kipas: NYALA']);
    return lcd;
  },
  summary:
    'Gabungkan semuanya: DHT11 mengukur suhu, LCD menampilkannya, dan relay menyalakan kipas saat ruangan terlalu panas. Kipas mendinginkan ruangan, suhu turun, lalu kipas mati lagi — sebuah sistem kendali sungguhan.',
  features: [
    { icon: 'thermo', html: 'Sensor → keputusan → aksi' },
    { icon: 'lcd', html: 'Status tampil di layar' },
    { icon: 'relay', html: 'Relay menyalakan kipas' },
  ],

  callouts: [
    { slot: 'tl', icon: 'thermo', title: 'DHT11', text: 'Klik untuk mengubah suhu ruangan.', anchor: (p) => p.dht.userData.anchor },
    { slot: 'tr', icon: 'lcd', title: 'LCD', text: 'Suhu dan status kipas.', anchor: (p) => p.lcd.userData.anchor },
    { slot: 'bl', icon: 'relay', title: 'Relay', text: 'Klik untuk mengubah batas suhu.', anchor: (p) => p.relay.userData.anchor },
    { slot: 'br', icon: 'motor', title: 'Kipas', text: 'Mendinginkan ruangan perlahan.', anchor: (p) => p.fan.userData.anchor },
  ],

  build(kit) {
    kit.board();
    kit.breadboard();
    kit.place('dht', createDHT(), kit.hole('h', 20), kit.hole('h', 22));
    // jalur daya breadboard dari 5V & GND papan
    kit.wire(kit.pin('5V'), kit.hole('tp', 3), 'red', { lift: 4 });
    kit.wire(kit.pin('GND'), kit.hole('tn', 4), 'black', { lift: 8 });
    kit.wire(kit.hole('tp', 20), kit.hole('j', 20), 'red', { lift: -4 });
    kit.wire(kit.hole('tn', 23), kit.hole('j', 22), 'black', { lift: -4 });
    kit.wire(kit.pin('D2'), kit.hole('j', 21), 'green', { lift: 4 });

    const lcd = kit.put('lcd', createLCD(), 150, 0, -0.5);
    kit.wire(kit.hole('tn', 28), kit.pinOf(lcd, 'GND'), 'black', { lift: 4 });
    kit.wire(kit.hole('tp', 27), kit.pinOf(lcd, 'VCC'), 'red', { lift: 2 });
    kit.wire(kit.pin('SDA'), kit.pinOf(lcd, 'SDA'), 'blue', { lift: 20 });
    kit.wire(kit.pin('SCL'), kit.pinOf(lcd, 'SCL'), 'yellow', { lift: 24 });

    const relay = kit.put('relay', createRelay(), -40, 72);
    kit.wire(kit.pin('D7'), kit.pinOf(relay, 'S'), 'orange', { lift: 8 });
    kit.wire(kit.hole('tp', 9), kit.pinOf(relay, '+'), 'red', { lift: 6 });
    kit.wire(kit.hole('tn', 10), kit.pinOf(relay, '-'), 'black', { lift: 10 });

    const fan = kit.put('fan', createMotor(), 40, 82);
    const plug = kit.put('plug', createPlug(), -40, 130);
    for (const part of [relay, fan, plug]) part.updateMatrixWorld(true);
    const at = (part, v) => part.localToWorld(v.clone());
    const fanPlus = fan.userData.terminals.plus.getWorldPosition(new THREE.Vector3());
    const fanMinus = fan.userData.terminals.minus.getWorldPosition(new THREE.Vector3());
    kit.wire(at(plug, plug.userData.term), at(relay, relay.userData.terms.COM), 'brown', { bare: true, radius: 1.5, lift: 4 });
    kit.wire(at(relay, relay.userData.terms.NO), fanPlus, 'red', { bare: true, radius: 1.3, lift: 4 });
    kit.wire(fanMinus, at(plug, plug.userData.term).add(new THREE.Vector3(3, 0, 0)), 'blue', { bare: true, radius: 1.5, lift: 8 });
  },

  params: [
    { key: 'temp', part: 'dht', label: 'Suhu ruangan', type: 'range', min: 18, max: 38, step: 0.5, value: 31, unit: '°C' },
    { key: 'limit', part: 'relay', label: 'Kipas nyala di atas', type: 'range', min: 20, max: 34, step: 0.5, value: 28, unit: '°C' },
  ],

  code: `#include <DHT.h>
#include <LiquidCrystal_I2C.h>

DHT dht(2, DHT11);
LiquidCrystal_I2C lcd(0x27, 16, 2);
const int RELAY = 7;
const float BATAS = {{limit}};

void setup() {
  dht.begin();
  lcd.init();
  lcd.backlight();
  pinMode(RELAY, OUTPUT);
}

void loop() {
  float t = dht.readTemperature();
  bool panas = t > BATAS;
  digitalWrite(RELAY, panas);

  lcd.setCursor(0, 0);
  lcd.print("Suhu: ");
  lcd.print(t, 1);
  lcd.print(" C  ");
  lcd.setCursor(0, 1);
  lcd.print(panas ? "Kipas: NYALA" : "Kipas: mati ");
  delay(1000);
}`,
  explain: [
    'Setiap detik sketch membaca suhu, lalu membandingkannya dengan <code>BATAS</code>.',
    'Hasil perbandingan (<code>true</code>/<code>false</code>) langsung ditulis ke pin relay.',
    'Kipas menurunkan suhu; begitu di bawah batas, relay mematikannya — lalu suhu naik lagi. Inilah <b>kendali umpan balik</b>.',
  ],
  tip: 'Kipas yang menyala-mati terlalu sering bisa cepat rusak. Tambahkan <b>histeresis</b>: nyala di atas 28 °C, mati di bawah 27 °C.',
  pinout: [
    { pin: 'D2', to: 'DATA DHT11', color: 'green' },
    { pin: 'SDA · SCL', to: 'LCD I²C', color: 'blue' },
    { pin: 'D7', to: 'Sinyal relay', color: 'orange' },
    { pin: '5V · GND', to: 'Jalur daya breadboard', color: 'red' },
    { pin: 'Relay COM · NO', to: 'Kabel daya kipas', color: 'brown' },
  ],
  specs: {
    name: 'Sistem termostat',
    rows: [
      ['Sensor', 'DHT11 (± 2 °C)'],
      ['Tampilan', 'LCD 16×2 I²C'],
      ['Aktuator', 'Relay 10 A + kipas'],
      ['Siklus', '1 detik'],
      ['Jenis kendali', 'On/off (bang-bang)'],
    ],
  },

  quietPins: [7],
  sketch: {
    *setup(io) {
      room.cool = 0;
      io.mark('dht.begin');
      io.pinMode(7, io.OUTPUT);
      yield 300;
    },
    *loop(io, p) {
      io.mark('readTemperature');
      const t = Math.round(reading(p) * 2) / 2;
      const hot = t > p.limit;
      if (hot !== room.fan) io.log(hot ? `${t.toFixed(1)} C > ${p.limit} · kipas NYALA` : `${t.toFixed(1)} C ≤ ${p.limit} · kipas mati`);
      room.fan = hot;
      yield 150;
      io.mark('digitalWrite(RELAY');
      io.digitalWrite(7, hot);
      yield 100;
      io.mark('lcd.print(t, 1)');
      lcdPrint(io.state, 0, 0, `Suhu: ${t.toFixed(1)} C  `);
      lcdPrint(io.state, 0, 1, hot ? 'Kipas: NYALA' : 'Kipas: mati ');
      yield 150;
      io.mark('delay(1000)');
      yield 600;
    },
  },
  update(v, parts, dt) {
    const on = (v.pins[7] ?? 0) > 0;
    // kipas mendinginkan hingga 5 °C; tanpa kipas, kembali ke suhu ruangan
    room.cool = on ? Math.min(5, room.cool + dt * 0.6) : Math.max(0, room.cool - dt * 0.35);
    if (!v.running) room.cool = 0;
    relayClick(on);
    parts.relay.userData.setOn(on);
    parts.relay.userData.tick(dt);
    parts.fan.userData.setSpeed(on ? 255 : 0);
    parts.fan.userData.tick(dt);
    showLCD(v, parts.lcd);
  },
};
