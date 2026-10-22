import * as THREE from 'three';
import { createServo } from '../parts/servo.js';

let shown = 90; // sudut yang sedang tampil (servo butuh waktu untuk berputar)

export default {
  id: 'servo',
  title: 'Gerakkan servo',
  heading: 'Gerakkan servo',
  thumb: () => createServo(),
  summary:
    'Servo adalah motor yang tahu posisinya sendiri. Beri sudut 0° sampai 180°, ia berputar ke sana dan bertahan — cocok untuk lengan robot, pintu kecil, atau jarum penunjuk.',
  features: [
    { icon: 'servo', html: 'Atur posisi dengan <code>arm.write(sudut)</code>' },
    { icon: 'pwm', html: 'Library Servo membuat pulsanya untukmu' },
    { icon: 'clock', html: 'Klik servo untuk mengubah rentang dan kecepatan' },
  ],

  callouts: [
    { slot: 'tc', icon: 'servo', title: 'Servo SG90', text: 'Berputar ke sudut yang diperintahkan.', anchor: (p) => p.servo.userData.anchor },
    { slot: 'tr', icon: 'pwm', title: 'Pin ~9', text: 'Mengirim pulsa posisi setiap 20 ms.', anchor: (p) => p.board.userData.pinAnchor('D9') },
    { slot: 'bl', icon: 'bolt', title: '5V & GND', text: 'Kabel merah dan cokelat memberi daya.', anchor: (p) => p.board.userData.pinAnchor('5V') },
  ],

  build(kit) {
    kit.board(-70, 22);
    const servo = kit.put('servo', createServo(), 42, 2, Math.PI);
    servo.updateMatrixWorld(true);
    const exit = servo.userData.cableExit.getWorldPosition(new THREE.Vector3());
    const wires = [
      ['GND', 'brown', -2.6],
      ['5V', 'red', 0],
      ['D9', 'orange', 2.6],
    ];
    for (const [pin, color, dz] of wires) {
      kit.wire(exit.clone().add(new THREE.Vector3(0, 0, dz)), kit.pin(pin), color, { lift: 6 + dz });
    }
  },

  params: [
    { key: 'from', part: 'servo', label: 'Dari', type: 'range', min: 0, max: 175, step: 5, value: 0, unit: '°' },
    { key: 'to', part: 'servo', label: 'Sampai', type: 'range', min: 5, max: 180, step: 5, value: 180, unit: '°' },
    {
      key: 'speed',
      part: 'servo',
      label: 'Jeda per derajat',
      type: 'choice',
      value: 15,
      options: [5, 15, 30].map((v) => ({ value: v, label: `${v} ms` })),
    },
  ],
  constrain(p, changed) {
    if (p.to < p.from + 5) {
      if (changed === 'from') p.to = Math.min(180, p.from + 5);
      else p.from = Math.max(0, p.to - 5);
    }
  },

  code: `#include <Servo.h>

Servo arm;

void setup() {
  arm.attach(9);
}

void loop() {
  for (int a = {{from}}; a <= {{to}}; a++) {
    arm.write(a);
    delay({{speed}});
  }
  for (int a = {{to}}; a >= {{from}}; a--) {
    arm.write(a);
    delay({{speed}});
  }
}`,
  explain: [
    '<code>#include &lt;Servo.h&gt;</code> memuat library; <code>Servo arm;</code> membuat satu servo.',
    '<code>arm.attach(9)</code> mulai mengirim pulsa posisi di pin 9.',
    'Loop <code>for</code> pertama menaikkan sudut satu derajat demi satu, loop kedua menurunkannya kembali.',
    '<code>delay</code> mengatur laju sapuan: makin kecil makin cepat.',
  ],
  tip: 'Servo bisa menarik arus besar saat mulai bergerak. Untuk lebih dari satu servo, pakai catu daya terpisah.',
  pinout: [
    { pin: '~9', to: 'Kabel sinyal (oranye)', color: 'orange' },
    { pin: '5V', to: 'Kabel daya (merah)', color: 'red' },
    { pin: 'GND', to: 'Kabel ground (cokelat)', color: 'brown' },
  ],
  specs: {
    name: 'Servo mikro SG90',
    rows: [
      ['Sudut', '0–180°'],
      ['Torsi', '1,8 kg·cm @ 4,8 V'],
      ['Kecepatan', '0,1 detik / 60°'],
      ['Tegangan', '4,8–6 V'],
      ['Sinyal', 'Pulsa 1–2 ms setiap 20 ms'],
      ['Berat', '9 g'],
    ],
  },

  sketch: {
    *setup() {
      shown = 90;
    },
    *loop(io, p) {
      io.mark('arm.write(a)', 0);
      for (let a = p.from; a <= p.to; a++) {
        io.servoWrite(9, a);
        yield p.speed;
      }
      io.mark('arm.write(a)', 1);
      for (let a = p.to; a >= p.from; a--) {
        io.servoWrite(9, a);
        yield p.speed;
      }
    },
  },
  update(v, parts, dt) {
    const target = v.servos[9] ?? 90;
    const maxStep = 600 * dt; // ± 0,1 s per 60°
    shown += Math.max(-maxStep, Math.min(maxStep, target - shown));
    parts.servo.userData.setAngle(shown);
  },
};
