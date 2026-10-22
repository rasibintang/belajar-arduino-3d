import * as THREE from 'three';
import { createL298N, createWheelMotor } from '../../parts/l298n.js';
import { box, mat } from '../../parts/lib.js';

const MOVES = {
  forward: { label: 'Maju', code: { left: '{{speed}}', right: '{{speed}}' }, dir: [1, 1] },
  back: { label: 'Mundur', code: { left: '-{{speed}}', right: '-{{speed}}' }, dir: [-1, -1] },
  spin: { label: 'Berputar', code: { left: '{{speed}}', right: '-{{speed}}' }, dir: [1, -1] },
};

/** Kecepatan bertanda dari pin H-bridge: arah dari IN, besar dari EN (PWM). */
export function motorSpeed(pins, en, a, b) {
  const dir = (pins[a] ?? 0) > 0 && !(pins[b] > 0) ? 1 : (pins[b] ?? 0) > 0 && !(pins[a] > 0) ? -1 : 0;
  return dir * (pins[en] ?? 0);
}

export default {
  id: 'hbridge',
  title: 'Motor dua arah',
  heading: 'H-bridge L298N',
  thumb: () => createL298N(),
  summary:
    'Transistor tunggal hanya bisa menyalakan motor ke satu arah. <b>H-bridge</b> memakai empat saklar yang tersusun seperti huruf H: dengan membalik pasangan yang aktif, arus — dan putaran motor — ikut berbalik. L298N berisi dua H-bridge, cukup untuk dua roda.',
  features: [
    { icon: 'logic', html: 'IN1/IN2 menentukan arah' },
    { icon: 'pwm', html: 'ENA/ENB (PWM) menentukan kecepatan' },
    { icon: 'motor', html: 'Klik driver untuk mengubah gerakan' },
  ],

  callouts: [
    { slot: 'tc', icon: 'chip', title: 'L298N', text: 'Klik untuk memilih maju, mundur, atau berputar.', anchor: (p) => p.hbridge.userData.anchor },
    { slot: 'tr', icon: 'motor', title: 'Motor B', text: 'Roda kanan.', anchor: (p) => p.right.userData.anchor },
    { slot: 'bl', icon: 'pins', title: 'Pin 5–10', text: 'EN (PWM) + dua IN untuk tiap motor.', anchor: (p) => p.board.userData.pinAnchor('D8') },
    { slot: 'br', icon: 'motor', title: 'Motor A', text: 'Roda kiri.', anchor: (p) => p.left.userData.anchor },
  ],

  build(kit) {
    kit.board(-90, 0);
    const drv = kit.put('hbridge', createL298N(), 20, 30);
    // diputar 180°: roda kiri di sisi -z, roda kanan (flip) di sisi +z
    const left = kit.put('left', createWheelMotor(), 24, -40, Math.PI);
    const right = kit.put('right', createWheelMotor({ flip: true }), 24, 108, Math.PI);
    const battery = kit.put('battery', new THREE.Group(), 80, 30);
    battery.add(box(30, 16, 58, mat('#26272b', { roughness: 0.6 }), 0, 0, 0, 1.5));
    battery.add(box(30.2, 4, 30, mat('#f2c23a'), 0, 12, 0, 0));

    [['D5', 'ENA', 'white'], ['D7', 'IN1', 'orange'], ['D8', 'IN2', 'yellow'], ['D9', 'IN3', 'green'], ['D10', 'IN4', 'blue'], ['D6', 'ENB', 'purple']].forEach(
      ([pin, name, color], i) => kit.wire(kit.pin(pin), kit.pinOf(drv, name), color, { lift: 2 + i * 2 })
    );
    for (const part of [drv, left, right, battery]) part.updateMatrixWorld(true);
    const t = (part, v) => part.localToWorld(v.clone());
    const terms = drv.userData.terms;
    kit.wire(kit.pin('GND'), t(drv, terms.GND).add(new THREE.Vector3(1.2, 0, 0)), 'black', { lift: 16 });
    kit.wire(t(battery, new THREE.Vector3(-8, 16, -20)), t(drv, terms.VIN), 'red', { bare: true, lift: 6 });
    kit.wire(t(battery, new THREE.Vector3(-8, 16, -10)), t(drv, terms.GND), 'black', { bare: true, lift: 4 });
    kit.wire(t(drv, terms.A1), t(left, left.userData.terms.a), 'red', { bare: true, lift: 4 });
    kit.wire(t(drv, terms.A2), t(left, left.userData.terms.b), 'black', { bare: true, lift: 6 });
    kit.wire(t(drv, terms.B1), t(right, right.userData.terms.a), 'red', { bare: true, lift: 4 });
    kit.wire(t(drv, terms.B2), t(right, right.userData.terms.b), 'black', { bare: true, lift: 6 });
  },

  params: [
    {
      key: 'move',
      part: 'hbridge',
      label: 'Gerakan',
      type: 'choice',
      value: 'forward',
      options: Object.entries(MOVES).map(([value, m]) => ({ value, label: m.label, code: m.code })),
    },
    { key: 'speed', part: 'hbridge', label: 'Kecepatan', type: 'range', min: 60, max: 255, step: 5, value: 200 },
  ],

  code: `const int ENA = 5, IN1 = 7, IN2 = 8;
const int ENB = 6, IN3 = 9, IN4 = 10;

void motor(int en, int a, int b, int speed) {
  digitalWrite(a, speed > 0);
  digitalWrite(b, speed < 0);
  analogWrite(en, abs(speed));
}

void setup() {
  for (int p = 5; p <= 10; p++) pinMode(p, OUTPUT);
}

void loop() {
  motor(ENA, IN1, IN2, {{move.left}});
  motor(ENB, IN3, IN4, {{move.right}});
  delay(2000);
  motor(ENA, IN1, IN2, 0);
  motor(ENB, IN3, IN4, 0);
  delay(1000);
}`,
  explain: [
    'Fungsi <code>motor()</code> menyatukan tiga langkah: arah lewat dua pin IN, kecepatan lewat PWM di pin EN.',
    'IN1 HIGH + IN2 LOW = maju; IN1 LOW + IN2 HIGH = mundur; keduanya LOW = berhenti.',
    'Memberi kecepatan berlawanan pada dua roda membuat robot berputar di tempat.',
  ],
  tip: 'Motor butuh daya sendiri (baterai 6–12 V di terminal VIN). Jangan lupa sambungkan GND baterai dan GND Arduino!',
  pinout: [
    { pin: '~5 · 7 · 8', to: 'ENA · IN1 · IN2 (motor A)', color: 'white' },
    { pin: '~6 · 9 · 10', to: 'ENB · IN3 · IN4 (motor B)', color: 'purple' },
    { pin: 'GND', to: 'GND L298N (ground bersama)', color: 'black' },
    { pin: 'Baterai', to: 'VIN · GND L298N', color: 'red' },
  ],
  specs: {
    name: 'L298N',
    rows: [
      ['Kanal', '2 H-bridge'],
      ['Tegangan motor', '5–35 V'],
      ['Arus per kanal', '2 A (puncak 3 A)'],
      ['Logika', '5 V'],
      ['Penurunan tegangan', '± 2 V (cukup boros)'],
    ],
  },

  logPwm: false,
  quietPins: [7, 8, 9, 10],
  sketch: {
    *setup(io) {
      io.mark('pinMode(p');
      for (let pin = 5; pin <= 10; pin++) io.pinMode(pin, io.OUTPUT);
      yield 150;
    },
    *loop(io, p) {
      const [l, r] = MOVES[p.move].dir.map((d) => d * p.speed);
      const drive = (en, a, b, sp) => {
        io.digitalWrite(a, sp > 0);
        io.digitalWrite(b, sp < 0);
        io.analogWrite(en, Math.abs(sp));
      };
      io.mark('motor(ENA, IN1, IN2', 0);
      drive(5, 7, 8, l);
      io.mark('motor(ENB, IN3, IN4', 0);
      drive(6, 9, 10, r);
      io.log(`Motor A ${l >= 0 ? 'maju' : 'mundur'} ${Math.abs(l)} · Motor B ${r >= 0 ? 'maju' : 'mundur'} ${Math.abs(r)}`);
      yield 100;
      io.mark('delay(2000)');
      yield 1900;
      io.mark('motor(ENA, IN1, IN2', 1);
      drive(5, 7, 8, 0);
      drive(6, 9, 10, 0);
      io.log('Berhenti');
      yield 100;
      io.mark('delay(1000)');
      yield 900;
    },
  },
  update(v, parts, dt) {
    parts.left.userData.setSpeed(motorSpeed(v.pins, 5, 7, 8));
    parts.right.userData.setSpeed(motorSpeed(v.pins, 6, 9, 10));
    parts.left.userData.tick(dt);
    parts.right.userData.tick(dt);
    parts.hbridge.userData.setPower(v.running);
  },
};
