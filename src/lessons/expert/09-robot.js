import * as THREE from 'three';
import { createArduino } from '../../parts/arduino.js';
import { createL298N, createWheelMotor } from '../../parts/l298n.js';
import { createUltrasonic } from '../../parts/ultrasonic.js';
import { createChassis, wall, PLATE_Y, TRACK } from '../../parts/robot.js';
import { box, mat, markPart, anchor } from '../../parts/lib.js';
import { motorSpeed } from './03-hbridge.js';

const VMAX = 170; // mm/detik pada PWM 255
const RADIUS = 92; // lingkar tabrakan robot
const START = { x: -170, z: 70, heading: 0 }; // menghadap +x: jalan lapang dulu, lalu bertemu dinding
const ARENA = { x0: -290, x1: 290, z0: -210, z1: 210 };
const OBSTACLE = { x0: 60, x1: 160, z0: -120, z1: -20 };

// pose robot: posisi (mm) dan arah hadap (rad; 0 = +x, positif = belok kiri)
const pose = { ...START };

/** Kotak-kotak penghalang (dinding + kardus) sebagai AABB di bidang xz. */
const BOXES = [
  { x0: ARENA.x0 - 20, x1: ARENA.x0, z0: ARENA.z0 - 20, z1: ARENA.z1 + 20 },
  { x0: ARENA.x1, x1: ARENA.x1 + 20, z0: ARENA.z0 - 20, z1: ARENA.z1 + 20 },
  { x0: ARENA.x0, x1: ARENA.x1, z0: ARENA.z0 - 20, z1: ARENA.z0 },
  { x0: ARENA.x0, x1: ARENA.x1, z0: ARENA.z1, z1: ARENA.z1 + 20 },
  OBSTACLE,
];

/** Jarak (mm) dari titik o ke kotak terdekat sepanjang arah d (metode slab). */
function rayDistance(ox, oz, dx, dz) {
  let best = Infinity;
  for (const b of BOXES) {
    let t0 = -Infinity;
    let t1 = Infinity;
    for (const [o, d, lo, hi] of [[ox, dx, b.x0, b.x1], [oz, dz, b.z0, b.z1]]) {
      if (Math.abs(d) < 1e-9) {
        if (o < lo || o > hi) t0 = Infinity;
      } else {
        const a = (lo - o) / d;
        const c = (hi - o) / d;
        t0 = Math.max(t0, Math.min(a, c));
        t1 = Math.min(t1, Math.max(a, c));
      }
    }
    if (t0 <= t1 && t1 > 0) best = Math.min(best, Math.max(0, t0));
  }
  return best;
}

function hits(x, z) {
  return BOXES.some((b) => {
    const cx = Math.max(b.x0, Math.min(x, b.x1));
    const cz = Math.max(b.z0, Math.min(z, b.z1));
    return Math.hypot(x - cx, z - cz) < RADIUS;
  });
}

/** Jarak sensor ke depan (cm), dihitung dari ujung depan robot. */
function sonarCm() {
  const fx = Math.cos(pose.heading);
  const fz = -Math.sin(pose.heading);
  const d = rayDistance(pose.x + fx * 92, pose.z + fz * 92, fx, fz);
  return Math.min(400, d / 10);
}

export default {
  id: 'robot',
  title: 'Proyek: robot',
  heading: 'Proyek: robot penghindar',
  thumb: () => createWheelMotor(),
  summary:
    'Proyek penutup: robot dua roda yang menjelajah sendiri. Sensor jarak di depan terus mengukur; selama jalan lapang robot maju, dan saat terlalu dekat ia berhenti, mundur, lalu berbelok mencari jalan lain. Semua materi Mahir bertemu di sini.',
  features: [
    { icon: 'robot', html: 'Tekan Run dan lihat robot menjelajah arena' },
    { icon: 'sonar', html: 'Keputusan dari jarak sensor (pelajaran Dasar 7)' },
    { icon: 'chip', html: 'Gerak dua roda lewat L298N (Mahir 3)' },
  ],

  callouts: [
    { slot: 'tc', icon: 'sonar', title: 'Sensor jarak', text: 'Klik untuk mengatur jarak aman.', anchor: (p) => p.sonar.userData.anchor },
    { slot: 'tr', icon: 'chip', title: 'L298N', text: 'Klik untuk kecepatan dan lama belok.', anchor: (p) => p.hbridge.userData.anchor },
    { slot: 'bl', icon: 'logic', title: 'Otak robot', text: 'Ukur → putuskan → gerak, berulang.', anchor: (p) => p.board.userData.anchors.chip },
    { slot: 'br', icon: 'car', title: 'Rintangan', text: 'Robot harus menghindarinya.', anchor: (p) => p.obstacle.userData.anchor },
  ],

  build(kit) {
    // --- arena ---
    const w = ARENA.x1 - ARENA.x0;
    const d = ARENA.z1 - ARENA.z0;
    for (const [bw, bd, x, z] of [
      [20, d + 40, ARENA.x0 - 10, 0],
      [20, d + 40, ARENA.x1 + 10, 0],
      [w, 20, 0, ARENA.z0 - 10],
      [w, 20, 0, ARENA.z1 + 10],
    ]) {
      const m = wall(bw, bd, 40);
      m.position.x = x;
      m.position.z = z;
      kit.root.add(m);
    }
    const obstacle = new THREE.Group();
    obstacle.add(box(OBSTACLE.x1 - OBSTACLE.x0, 70, OBSTACLE.z1 - OBSTACLE.z0, mat('#d4a464', { roughness: 0.9 }), 0, 0, 0, 2));
    obstacle.add(box(OBSTACLE.x1 - OBSTACLE.x0 + 0.4, 0.4, 16, mat('#c9b48c'), 0, 70, 0, 0));
    obstacle.position.set((OBSTACLE.x0 + OBSTACLE.x1) / 2, 0, (OBSTACLE.z0 + OBSTACLE.z1) / 2);
    obstacle.userData.anchor = anchor(obstacle, 0, 72, 0);
    markPart(obstacle, { key: 'obstacle', name: 'Kardus', desc: 'Rintangan di tengah arena.', lift: false });
    kit.root.add(obstacle);
    kit.parts.obstacle = obstacle;

    // --- robot (dibangun di titik asal, lalu digerakkan sebagai satu grup) ---
    const robot = markPart(new THREE.Group(), { key: 'robot', name: 'Robot', desc: 'Robot penghindar rintangan.', lift: false });
    kit.root.add(robot);
    kit.parts.robot = robot;
    const chassis = createChassis();
    robot.add(chassis);

    const board = createArduino();
    board.position.set(-74, PLATE_Y, 26);
    robot.add(board);
    kit.useBoard(board);

    const drv = createL298N();
    drv.position.set(32, PLATE_Y, -26);
    robot.add(drv);
    kit.parts.hbridge = drv;

    const left = createWheelMotor({ flip: true });
    left.position.set(-40, 0, -40);
    const right = createWheelMotor();
    right.position.set(-40, 0, 40);
    robot.add(left, right);
    kit.parts.left = left;
    kit.parts.right = right;

    robot.add(box(10, 6, 30, mat('#3a3d45'), 80, PLATE_Y, 0, 1));
    const sonar = createUltrasonic();
    sonar.position.set(84, PLATE_Y + 4, 0);
    sonar.rotation.y = Math.PI / 2;
    robot.add(sonar);
    kit.parts.sonar = sonar;
    robot.updateMatrixWorld(true);

    const t = (part, v) => part.localToWorld(v.clone());
    const opts = (lift, extra = {}) => ({ parent: robot, lift, ...extra });
    [['D5', 'ENA', 'white'], ['D7', 'IN1', 'orange'], ['D8', 'IN2', 'yellow'], ['D9', 'IN3', 'green'], ['D10', 'IN4', 'blue'], ['D6', 'ENB', 'purple']].forEach(
      ([pin, name, color], i) => kit.wire(kit.pin(pin), kit.pinOf(drv, name), color, opts(2 + i * 2))
    );
    const terms = drv.userData.terms;
    kit.wire(kit.pin('GND.1'), t(drv, terms.GND).add(new THREE.Vector3(1.2, 0, 0)), 'black', opts(14));
    kit.wire(t(drv, terms['5V']), kit.pin('VIN'), 'red', opts(10));
    kit.wire(t(chassis, chassis.userData.battery.plus), t(drv, terms.VIN), 'red', opts(6, { bare: true }));
    kit.wire(t(chassis, chassis.userData.battery.minus), t(drv, terms.GND), 'black', opts(8, { bare: true }));
    kit.wire(t(drv, terms.A1), t(left, left.userData.terms.a), 'red', opts(4, { bare: true }));
    kit.wire(t(drv, terms.A2), t(left, left.userData.terms.b), 'black', opts(6, { bare: true }));
    kit.wire(t(drv, terms.B1), t(right, right.userData.terms.a), 'red', opts(4, { bare: true }));
    kit.wire(t(drv, terms.B2), t(right, right.userData.terms.b), 'black', opts(6, { bare: true }));
    // header sensor: VCC, Trig, Echo, GND
    [['5V', 'red'], ['D2', 'purple'], ['D3', 'blue'], ['GND.2', 'black']].forEach(([pin, color], i) => {
      const end = t(sonar, new THREE.Vector3((i - 1.5) * 2.54, 3.5, -1.6));
      kit.wire(kit.pin(pin), end, color, opts(6 + i * 2, { bare: true, radius: 1 }));
    });
  },

  params: [
    { key: 'limit', part: 'sonar', label: 'Jarak aman', type: 'range', min: 10, max: 40, step: 1, value: 20, unit: 'cm' },
    { key: 'speed', part: 'hbridge', label: 'Kecepatan', type: 'range', min: 100, max: 255, step: 5, value: 200 },
    { key: 'turn', part: 'hbridge', label: 'Lama belok', type: 'range', min: 200, max: 1200, step: 50, value: 550, unit: 'ms' },
  ],
  apply(p, parts, running) {
    // saat tidak berjalan, robot kembali ke posisi awal
    if (!running) Object.assign(pose, START);
    placeRobot(parts.robot);
  },

  code: `const int ENA = 5, IN1 = 7, IN2 = 8;
const int ENB = 6, IN3 = 9, IN4 = 10;
const int TRIG = 2, ECHO = 3;

void drive(int left, int right) {
  digitalWrite(IN1, left > 0);  digitalWrite(IN2, left < 0);
  digitalWrite(IN3, right > 0); digitalWrite(IN4, right < 0);
  analogWrite(ENA, abs(left));
  analogWrite(ENB, abs(right));
}

long distanceCm() {
  digitalWrite(TRIG, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG, LOW);
  return pulseIn(ECHO, HIGH) / 58;
}

void setup() {
  Serial.begin(9600);
  for (int p = 5; p <= 10; p++) pinMode(p, OUTPUT);
  pinMode(TRIG, OUTPUT);
  pinMode(ECHO, INPUT);
}

void loop() {
  long cm = distanceCm();
  if (cm > {{limit}}) {
    drive({{speed}}, {{speed}});        // maju
  } else {
    drive(0, 0);                        // berhenti
    delay(200);
    drive(-150, -150);                  // mundur sedikit
    delay(400);
    drive({{speed}}, -{{speed}});       // putar ke kanan
    delay({{turn}});
  }
  delay(50);
}`,
  explain: [
    'Fungsi <code>drive(kiri, kanan)</code> menyatukan semua urusan H-bridge: tanda menentukan arah, besar menentukan kecepatan.',
    '<code>distanceCm()</code> memakai ulang cara mengukur jarak dari pelajaran Dasar 7.',
    'Jika jalan lapang, kedua roda maju. Jika terlalu dekat: berhenti, mundur, lalu roda kiri maju dan kanan mundur — robot berputar.',
    'Robot sungguhan tidak pernah persis sama: coba ubah jarak aman dan lama belok, lalu amati perilakunya.',
  ],
  tip: 'Robot terjebak di sudut? Pilih arah belok secara acak dengan <code>random(2)</code>, atau tambahkan servo agar sensor bisa “menoleh” kiri dan kanan.',
  pinout: [
    { pin: '~5 · 7 · 8', to: 'ENA · IN1 · IN2 (roda kiri)', color: 'white' },
    { pin: '~6 · 9 · 10', to: 'ENB · IN3 · IN4 (roda kanan)', color: 'purple' },
    { pin: 'D2 · D3', to: 'Trig · Echo sensor', color: 'blue' },
    { pin: 'VIN', to: '5V dari L298N (daya Arduino)', color: 'red' },
    { pin: 'Baterai 4×AA', to: 'VIN · GND L298N', color: 'black' },
  ],
  specs: {
    name: 'Robot penghindar',
    rows: [
      ['Penggerak', '2 motor TT + roda bebas'],
      ['Driver', 'L298N'],
      ['Sensor', 'HC-SR04 (2–400 cm)'],
      ['Daya', '4 × AA (6 V)'],
      ['Kecepatan', '± 17 cm/detik'],
      ['Jarak roda', `${TRACK} mm`],
    ],
  },

  logPwm: false,
  quietPins: [2, 7, 8, 9, 10],
  read(pin) {
    if (pin === 3) return sonarCm() * 58;
    return 0;
  },
  sketch: {
    *setup(io) {
      io.mark('pinMode(p');
      for (let pin = 5; pin <= 10; pin++) io.pinMode(pin, io.OUTPUT);
      yield 200;
    },
    *loop(io, p) {
      const drive = (l, r) => {
        io.digitalWrite(7, l > 0);
        io.digitalWrite(8, l < 0);
        io.digitalWrite(9, r > 0);
        io.digitalWrite(10, r < 0);
        io.analogWrite(5, Math.abs(l));
        io.analogWrite(6, Math.abs(r));
      };
      io.mark('long cm = distanceCm');
      const cm = Math.floor(io.pulseIn(3) / 58);
      if (cm > p.limit) {
        io.mark('drive({{speed}}'.replace('{{speed}}', p.speed));
        if (io.state.mode !== 'maju') io.log(`${cm} cm · jalan lapang, maju`);
        io.state.mode = 'maju';
        drive(p.speed, p.speed);
        yield 50;
        return;
      }
      io.state.mode = 'hindar';
      io.log(`${cm} cm · terlalu dekat! berhenti, mundur, belok`);
      io.mark('drive(0, 0)');
      drive(0, 0);
      yield 200;
      io.mark('drive(-150');
      drive(-150, -150);
      yield 400;
      io.mark(`drive(${p.speed}, -`);
      drive(p.speed, -p.speed);
      yield p.turn;
      yield 50;
    },
  },
  update(v, parts, dt) {
    const l = motorSpeed(v.pins, 5, 7, 8);
    const r = motorSpeed(v.pins, 6, 9, 10);
    parts.left.userData.setSpeed(l);
    parts.right.userData.setSpeed(r);
    parts.left.userData.tick(dt);
    parts.right.userData.tick(dt);
    parts.hbridge.userData.setPower(v.running);
    if (v.running) {
      // kinematika diferensial: rata-rata roda = maju, selisih = berputar
      const vl = (l / 255) * VMAX;
      const vr = (r / 255) * VMAX;
      pose.heading += ((vr - vl) / TRACK) * dt;
      const speed = (vl + vr) / 2;
      const nx = pose.x + Math.cos(pose.heading) * speed * dt;
      const nz = pose.z - Math.sin(pose.heading) * speed * dt;
      if (!hits(nx, nz)) {
        pose.x = nx;
        pose.z = nz;
      }
      placeRobot(parts.robot);
    }
    parts.sonar.userData.setPing(v.running ? (v.time % 400) / 400 : -1, Math.min(300, sonarCm() * 10));
  },
};

function placeRobot(robot) {
  robot.position.x = pose.x;
  robot.position.z = pose.z;
  robot.rotation.y = pose.heading;
}
