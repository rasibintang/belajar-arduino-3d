import * as THREE from 'three';
import { createUltrasonic } from '../parts/ultrasonic.js';
import { createObstacle, OBSTACLES } from '../parts/obstacles.js';

const HALF_DEPTH = { car: 21, box: 15, ball: 13 };
// Skala visual: 1 cm jarak simulasi = 4 mm di scene, agar penghalang tetap terlihat dekat
const MM_PER_CM = 4;
export const pingState = { lastPing: -1e9 };

/** Animasi gelombang dari sensor ke penghalang setelah setiap ping. */
export function showPing(v, sonar) {
  const t = (v.time - pingState.lastPing) / 400;
  sonar.userData.setPing(v.running && t < 1.3 ? t : -1, 14 + v.params.dist * MM_PER_CM);
}

/** Waktu gema (µs) dari jarak penghalang; bola memantulkan suara dengan buruk. */
export function echoMicros(cm, kind) {
  const q = OBSTACLES[kind]?.echo ?? 1;
  if (Math.random() > q + 0.2) return 0; // gema hilang
  const noise = (Math.random() - 0.5) * (1 - q) * 12;
  return Math.max(0, (cm + noise) * 58);
}

/** Tambah penghalang yang bisa diseret menjauhi sensor (sumbu +z). */
export function addObstacle(kit, api, sonar, keyDist = 'dist') {
  const obstacle = createObstacle(api.params.kind ?? 'car');
  const front = sonar.userData.front.getWorldPosition(new THREE.Vector3());
  obstacle.userData.front = front;
  kit.root.add(obstacle);
  kit.parts.obstacle = obstacle;
  obstacle.userData.drag = {
    axis: new THREE.Vector3(0, 0, 1),
    get: () => api.params[keyDist] * MM_PER_CM,
    set: (mm) => api.setParam(keyDist, Math.round(mm / MM_PER_CM)),
    min: 3 * MM_PER_CM,
    max: 30 * MM_PER_CM,
  };
  return obstacle;
}

export function placeObstacle(obstacle, kind, cm) {
  const u = obstacle.userData;
  const z = u.front.z + cm * MM_PER_CM + HALF_DEPTH[kind];
  const first = u.targetZ === undefined;
  u.setKind(kind);
  u.targetZ = z;
  if (first) obstacle.position.set(u.front.x, 0, z);
}

/** Geser penghalang ke posisi tujuan dengan halus; roda mobil ikut berputar. */
export function moveObstacle(obstacle, dt) {
  const u = obstacle.userData;
  const before = obstacle.position.z;
  obstacle.position.z += (u.targetZ - before) * Math.min(1, dt * 10);
  const dz = obstacle.position.z - before;
  for (const w of u.wheels) w.rotation.x += dz / 5.5;
}

export default {
  id: 'distance',
  title: 'Ukur jarak',
  heading: 'Ukur jarak',
  thumb: () => createUltrasonic(),
  summary:
    'HC-SR04 mengirim semburan suara ultrasonik lalu mendengarkan pantulannya. Lamanya gema kembali menunjukkan seberapa jauh penghalang — klik penghalang untuk menggantinya, atau seret mendekat.',
  features: [
    { icon: 'sonar', html: 'Kirim ping, ukur gema dengan <code>pulseIn()</code>' },
    { icon: 'car', html: 'Ganti penghalang: ada yang memantul lebih baik' },
    { icon: 'clock', html: 'Atur seberapa sering mengukur' },
  ],

  callouts: [
    { slot: 'tc', icon: 'sonar', title: 'Sensor jarak', text: 'Mengirim bunyi, lalu menunggu pantulannya.', anchor: (p) => p.sonar.userData.anchor },
    { slot: 'tr', icon: 'pin', title: 'Echo', text: 'HIGH selama suara masih di perjalanan.', anchor: (p) => p.board.userData.pinAnchor('D10') },
    { slot: 'bl', icon: 'bolt', title: '5V & GND', text: 'Daya sensor langsung dari papan.', anchor: (p) => p.board.userData.pinAnchor('5V') },
    { slot: 'br', icon: 'car', title: 'Penghalang', text: 'Seret mendekat atau menjauh.', anchor: (p) => p.obstacle.userData.anchor },
  ],

  build(kit, api) {
    kit.board();
    kit.breadboard();
    const sonar = kit.place('sonar', createUltrasonic(), kit.hole('a', 14), kit.hole('a', 17));
    kit.wire(kit.pin('5V'), kit.hole('c', 14), 'red', { lift: 2 });
    kit.wire(kit.pin('D9'), kit.hole('c', 15), 'purple', { lift: 6 });
    kit.wire(kit.pin('D10'), kit.hole('c', 16), 'blue', { lift: 10 });
    kit.wire(kit.pin('GND'), kit.hole('c', 17), 'black', { lift: 14 });
    addObstacle(kit, api, sonar);
  },

  params: [
    {
      key: 'kind',
      part: 'obstacle',
      label: 'Penghalang',
      type: 'choice',
      value: 'car',
      options: Object.entries(OBSTACLES).map(([value, o]) => ({ value, label: o.label })),
    },
    { key: 'dist', part: 'obstacle', label: 'Jarak', type: 'range', min: 3, max: 30, step: 1, value: 12, unit: 'cm' },
    {
      key: 'interval',
      part: 'sonar',
      label: 'Jeda pengukuran',
      type: 'choice',
      value: 250,
      options: [100, 250, 500, 1000].map((v) => ({ value: v, label: `${v} ms` })),
    },
  ],
  apply(p, parts) {
    placeObstacle(parts.obstacle, p.kind, p.dist);
  },

  code: `const int TRIG = 9;
const int ECHO = 10;

void setup() {
  Serial.begin(9600);
  pinMode(TRIG, OUTPUT);
  pinMode(ECHO, INPUT);
}

void loop() {
  digitalWrite(TRIG, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG, LOW);

  long cm = pulseIn(ECHO, HIGH) / 58;
  Serial.println(cm);
  delay({{interval}});
}`,
  explain: [
    '<code>Serial.begin(9600)</code> membuka Serial Monitor dengan kecepatan 9600 baud.',
    'Pulsa 10 µs di <code>TRIG</code> membuat sensor memancarkan delapan gelombang 40 kHz.',
    '<code>pulseIn(ECHO, HIGH)</code> mengukur lama gema dalam mikrodetik.',
    'Dibagi 58 menjadi sentimeter (suara pergi lalu kembali).',
  ],
  tip: 'Bola lembut menyerap suara: bacaannya melompat-lompat atau 0. Itulah kenapa robot sering tertipu benda empuk.',
  pinout: [
    { pin: '5V', to: 'VCC sensor', color: 'red' },
    { pin: 'D9', to: 'Trig (pemicu)', color: 'purple' },
    { pin: 'D10', to: 'Echo (gema)', color: 'blue' },
    { pin: 'GND', to: 'GND sensor', color: 'black' },
  ],
  specs: {
    name: 'HC-SR04',
    rows: [
      ['Jangkauan', '2–400 cm'],
      ['Ketelitian', '± 3 mm'],
      ['Frekuensi', '40 kHz'],
      ['Sudut pantau', '± 15°'],
      ['Tegangan', '5 V DC'],
      ['Pemicu', 'Pulsa HIGH 10 µs'],
    ],
  },

  quietPins: [9], // TRIG berkedip tiap ping; yang dicatat cukup jaraknya
  read(pin, v) {
    if (pin === 10) return echoMicros(v.params.dist, v.params.kind);
    return 0;
  },
  sketch: {
    *setup(io) {
      pingState.lastPing = -1e9;
      io.pinMode(9, io.OUTPUT);
      io.pinMode(10, io.INPUT);
    },
    *loop(io, p) {
      // jeda kecil di antara langkah hanya agar sorotan baris kode terlihat
      io.mark('digitalWrite(TRIG, HIGH)');
      io.digitalWrite(9, io.HIGH);
      yield 40;
      io.mark('digitalWrite(TRIG, LOW)');
      io.digitalWrite(9, io.LOW);
      pingState.lastPing = io.millis();
      io.mark('pulseIn(ECHO');
      yield 120;
      const cm = Math.floor(io.pulseIn(10) / 58);
      io.mark('Serial.println');
      io.println(cm);
      yield 40;
      io.mark('delay(');
      yield p.interval;
    },
  },
  update(v, parts, dt) {
    showPing(v, parts.sonar);
    moveObstacle(parts.obstacle, dt);
  },
};
