import * as THREE from 'three';
import { createStepper, createULN2003 } from '../parts/stepper.js';
import { createWire } from '../parts/wire.js';
import { markPart } from '../parts/lib.js';
import { headerPins } from './spec.js';

/** Driver ULN2003 + motor 28BYJ-48 (satu komponen, kabel motor sudah terpasang). */
function create() {
  const g = new THREE.Group();
  const driver = createULN2003();
  const motor = createStepper();
  motor.position.set(58, 0, -6);
  motor.rotation.y = -Math.PI / 2;
  g.add(driver, motor);
  g.updateMatrixWorld(true);
  const from = motor.localToWorld(motor.userData.cable.clone());
  const to = driver.userData.socket.clone();
  ['blue', '#e78fb3', 'yellow', 'orange', 'red'].forEach((color, i) => {
    const d = new THREE.Vector3(0, 0, (i - 2) * 1.4);
    g.add(createWire(from.clone().add(d), to.clone().add(new THREE.Vector3((i - 2) * 2.2, 0, 0)), color, { bare: true, radius: 0.6, lift: 2 + i }));
  });
  // pin header milik driver
  g.userData.pins = driver.userData.pins;
  g.userData.setPhase = driver.userData.setPhase;
  g.userData.setAngle = motor.userData.setAngle;
  g.userData.anchor = motor.userData.anchor;
  return markPart(g, { key: 'stepper', name: 'Stepper 28BYJ-48 + ULN2003', desc: 'Motor bergerak per langkah; LED A–D = fase aktif.' });
}

export default {
  type: 'stepper-28byj48',
  name: 'Motor stepper + driver ULN2003',
  category: 'motor',
  icon: 'stepper',
  desc: '2048 langkah per putaran. Hubungkan IN1–IN4 ke 4 pin; pakai library Stepper (urutan pin 1,3,2,4).',
  surface: 'floor',
  create,
  pins: headerPins({ IN1: 'IN1', IN2: 'IN2', IN3: 'IN3', IN4: 'IN4', '-': 'Ground', '+': '5 V' }),
  behavior: { kind: 'stepper', inputs: ['IN1', 'IN2', 'IN3', 'IN4'], vcc: '+', gnd: '-', stepsPerRev: 2048 },
};
