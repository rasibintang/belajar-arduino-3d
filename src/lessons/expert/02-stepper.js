import * as THREE from 'three';
import { createStepper, createULN2003 } from '../../parts/stepper.js';

const STEPS = 2048;
const PHASES = [0b0011, 0b0110, 0b1100, 0b1001]; // dua kumparan aktif (full step)
const s = { step: 0 };

export default {
  id: 'stepper',
  title: 'Motor stepper',
  heading: 'Motor stepper',
  thumb: () => createStepper(),
  summary:
    'Motor stepper berputar sedikit demi sedikit: setiap pola arus pada kumparannya menggeser poros satu langkah. 28BYJ-48 punya 2048 langkah per putaran — cukup presisi untuk jarum jam, kamera geser, atau pengumpan makanan.',
  features: [
    { icon: 'stepper', html: '<code>motor.step(n)</code> bergerak tepat n langkah' },
    { icon: 'chip', html: 'LED A–D di driver menunjukkan kumparan aktif' },
    { icon: 'clock', html: 'Klik motor untuk sudut dan kecepatan' },
  ],

  callouts: [
    { slot: 'tr', icon: 'stepper', title: 'Stepper 28BYJ-48', text: 'Klik untuk mengatur sudut dan RPM.', anchor: (p) => p.stepper.userData.anchor },
    { slot: 'tc', icon: 'chip', title: 'Driver ULN2003', text: 'LED A–D = urutan kumparan.', anchor: (p) => p.driver.userData.anchor },
    { slot: 'bl', icon: 'pins', title: 'Pin 8–11', text: 'Empat pin, empat kumparan.', anchor: (p) => p.board.userData.pinAnchor('D10') },
  ],

  build(kit) {
    kit.board(-82, 0);
    const driver = kit.put('driver', createULN2003(), 12, 40);
    const stepper = kit.put('stepper', createStepper(), 82, 34, -Math.PI / 2);
    [['D8', 'IN1', 'blue'], ['D9', 'IN2', 'green'], ['D10', 'IN3', 'yellow'], ['D11', 'IN4', 'orange']].forEach(([pin, name, color], i) =>
      kit.wire(kit.pin(pin), kit.pinOf(driver, name), color, { lift: 4 + i * 2 })
    );
    kit.wire(kit.pin('5V'), kit.pinOf(driver, '+'), 'red', { lift: 6 });
    kit.wire(kit.pin('GND'), kit.pinOf(driver, '-'), 'black', { lift: 10 });
    // kabel 5 warna motor ke soket driver
    driver.updateMatrixWorld(true);
    stepper.updateMatrixWorld(true);
    const from = stepper.localToWorld(stepper.userData.cable.clone());
    const to = driver.localToWorld(driver.userData.socket.clone());
    ['blue', '#e78fb3', 'yellow', 'orange', 'red'].forEach((color, i) => {
      const d = new THREE.Vector3(0, 0, (i - 2) * 1.4);
      kit.wire(from.clone().add(d), to.clone().add(new THREE.Vector3((i - 2) * 2.2, 0, 0)), color, { bare: true, radius: 0.6, lift: 2 + i });
    });
  },

  params: [
    { key: 'deg', part: 'stepper', label: 'Sudut tiap gerak', type: 'range', min: 45, max: 360, step: 45, value: 180, unit: '°' },
    { key: 'rpm', part: 'stepper', label: 'Kecepatan', type: 'range', min: 4, max: 15, step: 1, value: 10, unit: 'RPM' },
  ],

  code: `#include <Stepper.h>

const int STEPS = 2048;  // satu putaran
Stepper motor(STEPS, 8, 10, 9, 11);

void setup() {
  Serial.begin(9600);
  motor.setSpeed({{rpm}});
}

void loop() {
  Serial.println("Maju");
  motor.step(STEPS * {{deg}} / 360);
  delay(500);
  Serial.println("Mundur");
  motor.step(-STEPS * {{deg}} / 360);
  delay(500);
}`,
  explain: [
    'Library <code>Stepper</code> menyalakan kumparan bergiliran — pola yang terlihat di LED A–D.',
    '<code>setSpeed(rpm)</code> mengatur jeda antar langkah: 10 RPM ≈ 2,9 ms per langkah.',
    '<code>motor.step(n)</code> menunggu sampai n langkah selesai; angka negatif = berlawanan arah.',
    'Urutan pin 8, 10, 9, 11 (bukan 8, 9, 10, 11) sesuai urutan kumparan 28BYJ-48.',
  ],
  tip: '28BYJ-48 maksimal ± 15 RPM. Lebih cepat dari itu, motor hanya bergetar tanpa berputar.',
  pinout: [
    { pin: 'D8–D11', to: 'IN1–IN4 driver', color: 'blue' },
    { pin: '5V · GND', to: '+ · − driver', color: 'red' },
    { pin: 'Soket 5 pin', to: 'Kabel motor', color: 'yellow' },
  ],
  specs: {
    name: '28BYJ-48 + ULN2003',
    rows: [
      ['Langkah/putaran', '2048 (full step)'],
      ['Sudut per langkah', '± 0,18°'],
      ['Tegangan', '5 V'],
      ['Torsi', '± 300 g·cm'],
      ['Kecepatan maks', '± 15 RPM'],
      ['Gearbox', '1 : 64'],
    ],
  },

  quietPins: [8, 9, 10, 11],
  sketch: {
    *setup(io) {
      io.mark('motor.setSpeed');
      io.state.angle = (s.step * 360) / STEPS;
      yield 200;
    },
    *loop(io, p) {
      for (const dir of [1, -1]) {
        io.mark('Serial.println', dir > 0 ? 0 : 1);
        io.println(dir > 0 ? 'Maju' : 'Mundur');
        io.mark('motor.step', dir > 0 ? 0 : 1);
        const n = Math.round((STEPS * p.deg) / 360);
        const msPerStep = 60000 / (p.rpm * STEPS);
        // diproses per 8 langkah agar simulasi tetap ringan
        for (let i = 0; i < n; i += 8) {
          const k = Math.min(8, n - i);
          s.step += dir * k;
          io.state.angle = (s.step * 360) / STEPS;
          io.state.phase = PHASES[((s.step % 4) + 4) % 4];
          yield k * msPerStep;
        }
        io.state.phase = 0;
        io.mark('delay(500)', dir > 0 ? 0 : 1);
        yield 500;
      }
    },
  },
  update(v, parts) {
    parts.stepper.userData.setAngle((s.step * 360) / STEPS);
    parts.driver.userData.setPhase(v.running ? v.state.phase ?? 0 : 0);
  },
};
