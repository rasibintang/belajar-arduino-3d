import { createDHT } from '../../parts/dht.js';

export default {
  id: 'dht',
  title: 'Suhu & lembap',
  heading: 'Suhu & kelembapan',
  thumb: () => createDHT(),
  summary:
    'DHT11 mengukur suhu dan kelembapan udara, lalu mengirim hasilnya sebagai deretan bit lewat satu kabel data. Library DHT menerjemahkannya menjadi angka yang siap dipakai.',
  features: [
    { icon: 'thermo', html: '<code>readTemperature()</code> dan <code>readHumidity()</code>' },
    { icon: 'sun', html: 'Klik sensor untuk mengubah cuaca ruangan' },
    { icon: 'terminal', html: 'Hasil tampil di Serial Monitor tiap 2 detik' },
  ],

  callouts: [
    { slot: 'tc', icon: 'thermo', title: 'DHT11', text: 'Klik untuk mengubah suhu dan kelembapan.', anchor: (p) => p.dht.userData.anchor },
    { slot: 'bl', icon: 'pin', title: 'Pin 2', text: 'Satu kabel data dua arah.', anchor: (p) => p.board.userData.pinAnchor('D2') },
    { slot: 'br', icon: 'bolt', title: '5V & GND', text: 'Daya untuk sensor.', anchor: (p) => p.board.userData.pinAnchor('5V') },
  ],

  build(kit) {
    kit.board();
    kit.breadboard();
    kit.place('dht', createDHT(), kit.hole('c', 14), kit.hole('c', 16));
    kit.wire(kit.pin('5V'), kit.hole('a', 14), 'red', { lift: 2 });
    kit.wire(kit.pin('D2'), kit.hole('a', 15), 'green', { lift: 8 });
    kit.wire(kit.pin('GND'), kit.hole('a', 16), 'black', { lift: 12 });
  },

  params: [
    { key: 'temp', part: 'dht', label: 'Suhu ruangan', type: 'range', min: 10, max: 45, step: 1, value: 27, unit: '°C' },
    { key: 'hum', part: 'dht', label: 'Kelembapan', type: 'range', min: 20, max: 90, step: 1, value: 62, unit: '%' },
  ],

  code: `#include <DHT.h>

DHT dht(2, DHT11);

void setup() {
  Serial.begin(9600);
  dht.begin();
}

void loop() {
  float t = dht.readTemperature();
  float h = dht.readHumidity();

  Serial.print("Suhu: ");
  Serial.print(t);
  Serial.print(" C  Lembap: ");
  Serial.print(h);
  Serial.println(" %");
  delay(2000);
}`,
  explain: [
    '<code>DHT dht(2, DHT11)</code> memberi tahu library bahwa sensor DHT11 ada di pin 2.',
    '<code>readTemperature()</code> memberi suhu dalam °C; <code>readHumidity()</code> kelembapan relatif dalam %.',
    '<code>float</code> menyimpan angka berkoma, seperti 27.00.',
    'DHT11 lambat: beri jeda minimal 1–2 detik antar pembacaan.',
  ],
  tip: 'Jika hasilnya <code>nan</code> (not a number), sensor gagal dibaca — periksa kabel data dan jedanya.',
  pinout: [
    { pin: '5V', to: 'VCC sensor', color: 'red' },
    { pin: 'D2', to: 'DATA', color: 'green' },
    { pin: 'GND', to: 'GND sensor', color: 'black' },
  ],
  specs: {
    name: 'DHT11',
    rows: [
      ['Suhu', '0–50 °C (± 2 °C)'],
      ['Kelembapan', '20–90 % (± 5 %)'],
      ['Resolusi', '1 °C / 1 %'],
      ['Jeda minimum', '1 detik'],
      ['Tegangan', '3,3–5 V'],
      ['Antarmuka', '1 kabel (protokol khusus)'],
    ],
  },

  sketch: {
    *setup(io) {
      io.mark('dht.begin');
      yield 300;
    },
    *loop(io, p) {
      io.mark('readTemperature');
      // DHT11 hanya memberi bilangan bulat; sesekali bergeser 1 angka
      const t = p.temp + (Math.random() < 0.2 ? Math.sign(Math.random() - 0.5) : 0);
      const h = p.hum + (Math.random() < 0.3 ? Math.sign(Math.random() - 0.5) : 0);
      yield 250;
      io.mark('Serial.println');
      io.println(`Suhu: ${t.toFixed(2)} C  Lembap: ${h.toFixed(2)} %`);
      yield 150;
      io.mark('delay(2000)');
      yield 1600;
    },
  },
  update() {},
};
