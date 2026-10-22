import * as THREE from 'three';
import { createJoystick } from '../../parts/joystick.js';
import { createServo } from '../../parts/servo.js';

let shown = 90;

export default {
  id: 'joystick',
  title: 'Joystick',
  heading: 'Joystick',
  thumb: () => createJoystick(),
  summary:
    'Joystick berisi dua potensiometer — satu untuk sumbu X, satu untuk Y — dan sebuah tombol yang tertekan saat tuasnya ditekan. <code>map()</code> mengubah bacaan 0–1023 menjadi sudut servo 0–180°.',
  features: [
    { icon: 'joystick', html: 'Seret tuas joystick di tampilan 3D' },
    { icon: 'pulse', html: 'Dua <code>analogRead()</code>: A0 dan A1' },
    { icon: 'servo', html: '<code>map()</code> mengubah skala ke 0–180°' },
  ],

  callouts: [
    { slot: 'bl', icon: 'joystick', title: 'Joystick', text: 'Seret tuasnya; klik untuk menekan tombol.', anchor: (p) => p.joy.userData.anchor },
    { slot: 'tc', icon: 'pulse', title: 'A0 · A1', text: 'Posisi X dan Y, masing-masing 0–1023.', anchor: (p) => p.board.userData.pinAnchor('A0') },
    { slot: 'tr', icon: 'servo', title: 'Servo', text: 'Mengikuti satu sumbu joystick.', anchor: (p) => p.servo.userData.anchor },
  ],

  build(kit) {
    kit.board(-82, 0);
    const joy = kit.put('joy', createJoystick(), -30, 70);
    const servo = kit.put('servo', createServo(), 42, 0, Math.PI);
    kit.wire(kit.pin('GND.2'), kit.pinOf(joy, 'GND'), 'black', { lift: 2 });
    kit.wire(kit.pin('3V3'), kit.pinOf(joy, '+5V'), 'red', { lift: 4 });
    kit.wire(kit.pin('A0'), kit.pinOf(joy, 'VRx'), 'green', { lift: 6 });
    kit.wire(kit.pin('A1'), kit.pinOf(joy, 'VRy'), 'blue', { lift: 8 });
    kit.wire(kit.pin('D2'), kit.pinOf(joy, 'SW'), 'purple', { lift: 10 });
    servo.updateMatrixWorld(true);
    const exit = servo.userData.cableExit.getWorldPosition(new THREE.Vector3());
    [['GND', 'brown', -2.6], ['5V', 'red', 0], ['D9', 'orange', 2.6]].forEach(([pin, color, dz]) =>
      kit.wire(exit.clone().add(new THREE.Vector3(0, 0, dz)), kit.pin(pin), color, { lift: 4 + dz })
    );
  },

  params: [
    { key: 'axis', part: 'joy', label: 'Servo mengikuti', type: 'choice', value: 'x', options: [{ value: 'x', label: 'Sumbu X' }, { value: 'y', label: 'Sumbu Y' }] },
  ],

  code: `#include <Servo.h>

Servo arm;

void setup() {
  Serial.begin(9600);
  pinMode(2, INPUT_PULLUP);
  arm.attach(9);
}

void loop() {
  int x = analogRead(A0);
  int y = analogRead(A1);
  int angle = map({{axis}}, 0, 1023, 0, 180);
  arm.write(angle);

  if (digitalRead(2) == LOW) Serial.println("Klik!");
  Serial.print(x);
  Serial.print(", ");
  Serial.println(y);
  delay(100);
}`,
  explain: [
    'Di posisi tengah, kedua sumbu membaca sekitar 512.',
    '<code>map(nilai, 0, 1023, 0, 180)</code> mengubah rentang bacaan menjadi rentang sudut.',
    '<code>INPUT_PULLUP</code> menyalakan resistor internal: tombol tidak ditekan = HIGH, ditekan = LOW.',
  ],
  tip: 'Joystick jarang tepat 512 di tengah. Abaikan bacaan 490–530 (“zona mati”) agar servo tidak bergetar.',
  pinout: [
    { pin: '3.3V · GND', to: '+5V · GND joystick', color: 'red' },
    { pin: 'A0', to: 'VRx (sumbu X)', color: 'green' },
    { pin: 'A1', to: 'VRy (sumbu Y)', color: 'blue' },
    { pin: 'D2', to: 'SW (tombol)', color: 'purple' },
    { pin: '~9', to: 'Sinyal servo', color: 'orange' },
  ],
  specs: {
    name: 'Modul joystick KY-023',
    rows: [
      ['Sumbu', '2 potensiometer 10 kΩ'],
      ['Bacaan', '0–1023 per sumbu'],
      ['Posisi tengah', '± 512'],
      ['Tombol', 'Aktif LOW (pakai pull-up)'],
      ['Tegangan', '3,3–5 V'],
    ],
  },

  read(pin, v) {
    const [x, y] = v.parts.joy.userData.xy;
    if (pin === 'A0') return 512 + x * 511;
    if (pin === 'A1') return 512 + y * 511;
    if (pin === 2) return v.parts.joy.userData.pressed ? 0 : 1;
    return 0;
  },
  quietPins: [2],
  sketch: {
    *setup(io) {
      shown = 90;
      io.mark('arm.attach');
      io.pinMode(2, io.INPUT_PULLUP);
      yield 150;
    },
    *loop(io, p) {
      io.mark('analogRead(A0)');
      const x = io.analogRead('A0');
      const y = io.analogRead('A1');
      io.servoWrite(9, io.map(p.axis === 'x' ? x : y, 0, 1023, 0, 180));
      yield 30;
      io.mark('arm.write');
      if (!io.digitalRead(2)) io.println('Klik!');
      io.println(`${x}, ${y}`);
      yield 30;
      io.mark('delay(100)');
      yield 70;
    },
  },
  update(v, parts, dt) {
    parts.joy.userData.tick(dt);
    const target = v.servos[9] ?? 90;
    const step = 600 * dt;
    shown += Math.max(-step, Math.min(step, target - shown));
    parts.servo.userData.setAngle(shown);
  },
};
