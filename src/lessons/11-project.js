import { createUltrasonic } from '../parts/ultrasonic.js';
import { createTrafficLight } from '../parts/trafficlight.js';
import { addObstacle, placeObstacle, moveObstacle, echoMicros, pingState, showPing } from './07-distance.js';

let lastLight = null; // lampu terakhir, agar pesan hanya ditulis saat berganti

export default {
  id: 'project',
  title: 'Buat proyek',
  heading: 'Sensor parkir',
  thumb: () => {
    const t = createTrafficLight();
    t.userData.set({ green: true });
    return t;
  },
  summary:
    'Gabungkan semuanya: sensor jarak mengawasi mobil, dan lampu lalu lintas memberi tahu pengemudi kapan harus berhenti. Klik lampu untuk menggeser ambang jaraknya.',
  features: [
    { icon: 'logic', html: 'Keputusan dengan perbandingan' },
    { icon: 'traffic', html: 'Tiga output, satu untuk tiap warna' },
    { icon: 'sonar', html: 'Memakai ulang kode jarak dari pelajaran 7' },
  ],

  callouts: [
    { slot: 'tc', icon: 'sonar', title: 'Sensor jarak', text: 'Terus mengawasi penghalang.', anchor: (p) => p.sonar.userData.anchor },
    { slot: 'tr', icon: 'traffic', title: 'Lampu lalu lintas', text: 'Klik untuk mengubah ambang jarak.', anchor: (p) => p.traffic.userData.anchor },
    { slot: 'bl', icon: 'logic', title: 'Logikamu', text: 'Perbandingan memilih lampu yang menyala.', anchor: (p) => p.board.userData.anchors.chip },
    { slot: 'br', icon: 'car', title: 'Penghalang', text: 'Seret mendekat dan lihat lampunya.', anchor: (p) => p.obstacle.userData.anchor },
  ],

  build(kit, api) {
    kit.board();
    kit.breadboard();
    const sonar = kit.place('sonar', createUltrasonic(), kit.hole('a', 6), kit.hole('a', 9));
    kit.place('traffic', createTrafficLight(), kit.hole('a', 22), kit.hole('a', 25));

    kit.wire(kit.pin('5V'), kit.hole('c', 6), 'red', { lift: 2 });
    kit.wire(kit.pin('D9'), kit.hole('c', 7), 'purple', { lift: 6 });
    kit.wire(kit.pin('D10'), kit.hole('c', 8), 'blue', { lift: 10 });
    kit.wire(kit.pin('GND'), kit.hole('c', 9), 'black', { lift: 14 });
    kit.wire(kit.pin('GND.1'), kit.hole('c', 22), 'black', { lift: 2 });
    kit.wire(kit.pin('D4'), kit.hole('c', 23), 'red', { lift: 6 });
    kit.wire(kit.pin('D3'), kit.hole('c', 24), 'yellow', { lift: 10 });
    kit.wire(kit.pin('D2'), kit.hole('c', 25), 'green', { lift: 14 });
    addObstacle(kit, api, sonar);
  },

  params: [
    { key: 'near', part: 'traffic', label: 'Merah jika ≤', type: 'range', min: 3, max: 49, step: 1, value: 10, unit: 'cm' },
    { key: 'far', part: 'traffic', label: 'Hijau jika >', type: 'range', min: 4, max: 50, step: 1, value: 25, unit: 'cm' },
    { key: 'dist', part: 'obstacle', label: 'Jarak mobil', type: 'range', min: 3, max: 30, step: 1, value: 18, unit: 'cm' },
  ],
  constrain(p, changed) {
    if (p.far <= p.near) {
      if (changed === 'near') p.far = Math.min(50, p.near + 1);
      else p.near = Math.max(3, p.far - 1);
    }
  },
  apply(p, parts) {
    placeObstacle(parts.obstacle, 'car', p.dist);
  },

  code: `const int TRIG = 9, ECHO = 10;
const int RED = 4, YLW = 3, GRN = 2;

void setup() {
  pinMode(TRIG, OUTPUT);
  pinMode(ECHO, INPUT);
  for (int p = 2; p <= 4; p++)
    pinMode(p, OUTPUT);
}

void loop() {
  digitalWrite(TRIG, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG, LOW);
  long cm = pulseIn(ECHO, HIGH) / 58;

  digitalWrite(GRN, cm > {{far}});
  digitalWrite(YLW, cm > {{near}} && cm <= {{far}});
  digitalWrite(RED, cm <= {{near}});
  delay(100);
}`,
  explain: [
    'Loop mengukur jarak persis seperti di pelajaran 7.',
    'Perbandingan seperti <code>cm &gt; 25</code> bernilai benar (1) atau salah (0).',
    'Menuliskannya langsung ke pin menyalakan atau mematikan LED — tanpa perlu <code>if</code>.',
    'Hanya satu kondisi yang bisa benar pada satu waktu, jadi tepat satu lampu menyala.',
  ],
  tip: 'Tambahkan buzzer dari pelajaran 8 yang berbunyi makin cepat saat mobil makin dekat — persis sensor parkir mobil sungguhan.',
  pinout: [
    { pin: 'D9 · D10', to: 'Trig · Echo sensor', color: 'purple' },
    { pin: 'D4', to: 'LED merah', color: 'red' },
    { pin: 'D3', to: 'LED kuning', color: 'yellow' },
    { pin: 'D2', to: 'LED hijau', color: 'green' },
    { pin: '5V · GND', to: 'Daya sensor dan modul lampu', color: 'black' },
  ],
  specs: {
    name: 'Modul lampu lalu lintas',
    rows: [
      ['LED', 'Merah, kuning, hijau 8 mm'],
      ['Resistor', 'Sudah terpasang di modul'],
      ['Tegangan', '3,3–5 V'],
      ['Pin', 'GND, R, Y, G'],
      ['Logika', 'HIGH = menyala'],
    ],
  },

  quietPins: [9, 2, 3, 4], // pergantian lampu dijelaskan dengan pesan sendiri
  read(pin, v) {
    if (pin === 10) return echoMicros(v.params.dist, 'car');
    return 0;
  },
  sketch: {
    *setup(io) {
      lastLight = null;
      io.pinMode(9, io.OUTPUT);
      io.pinMode(10, io.INPUT);
      for (let p = 2; p <= 4; p++) io.pinMode(p, io.OUTPUT);
    },
    *loop(io, p) {
      io.mark('digitalWrite(TRIG, HIGH)');
      io.digitalWrite(9, io.HIGH);
      yield 30;
      io.mark('digitalWrite(TRIG, LOW)');
      io.digitalWrite(9, io.LOW);
      pingState.lastPing = io.millis();
      io.mark('pulseIn(ECHO');
      yield 100;
      const cm = Math.floor(io.pulseIn(10) / 58);
      const light = cm <= p.near ? 'RED' : cm <= p.far ? 'YLW' : 'GRN';
      if (light !== lastLight && cm > 0) {
        lastLight = light;
        io.log(`${cm} cm · ${{ RED: 'MERAH · berhenti!', YLW: 'KUNING · pelan-pelan', GRN: 'HIJAU · aman' }[light]}`);
      }
      io.digitalWrite(2, cm > p.far);
      io.digitalWrite(3, cm > p.near && cm <= p.far);
      io.digitalWrite(4, cm <= p.near);
      io.mark(`digitalWrite(${light}`);
      yield 160;
      io.mark('delay(100)');
      yield 100;
    },
  },
  update(v, parts, dt) {
    parts.traffic.userData.set({ red: v.pins[4] > 0, yellow: v.pins[3] > 0, green: v.pins[2] > 0 });
    showPing(v, parts.sonar);
    moveObstacle(parts.obstacle, dt);
  },
};
