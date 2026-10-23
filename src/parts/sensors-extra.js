import * as THREE from 'three';
import { M, mat, ownMat, box, cyl, anchor, setEmissive } from './lib.js';
import { createModule, chip } from './module.js';

/** Modul sensor suhu analog (NTC 10 kΩ, β 3950). Pin: GND, VCC, OUT. */
export function createNTC() {
  const { g, top } = createModule({
    w: 28,
    d: 14,
    color: '#1f4fa8',
    label: 'NTC',
    sub: 'B3950 10K',
    labelAt: [3, 0],
    headers: [{ names: ['GND', 'VCC', 'OUT'], x: -11, z: 0, axis: 'z' }],
    key: 'ntc',
    name: 'Sensor suhu NTC',
    desc: 'Hambatannya turun saat makin panas.',
  });
  // termistor manik hitam di ujung kaki
  g.add(cyl(0.25, 6, M.leg, 9, top, -1.5, 8));
  g.add(cyl(0.25, 6, M.leg, 9, top, 1.5, 8));
  const bead = new THREE.Mesh(new THREE.SphereGeometry(2, 18, 12), mat('#202024', { roughness: 0.3 }));
  bead.position.set(9, top + 7, 0);
  bead.scale.set(1, 1.2, 1);
  g.add(bead);
  chip(g, -2, 0, top, 3, 2, 0.6, '#c79a5a');
  return g;
}

/** Sensor gerak PIR (HC-SR501). Pin: VCC, OUT, GND. Klik untuk memicu gerakan. */
export function createPIR() {
  const { g, top } = createModule({
    w: 32,
    d: 24,
    color: '#2f8a46',
    headers: [{ names: ['VCC', 'OUT', 'GND'], x: 0, z: 10 }],
    key: 'pir',
    name: 'Sensor gerak PIR',
    desc: 'Klik untuk mensimulasikan gerakan di depannya.',
  });
  g.add(box(23, 1.5, 23, mat('#ece9e1'), 0, top, -1, 0.5));
  // kubah lensa Fresnel bersegi
  const domeMat = ownMat('#f4f1ea', { roughness: 0.4, flatShading: true });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(11, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), domeMat);
  dome.position.set(0, top + 1.5, -1);
  g.add(dome);
  g.userData.setActive = (on) => setEmissive(domeMat, '#ff9a5a', on ? 0.35 : 0);
  g.userData.anchor = anchor(g, 0, top + 13, -1);
  return g;
}

/** Sensor gas MQ2. Pin: VCC, GND, DOUT, AOUT. */
export function createMQ2() {
  const { g, top } = createModule({
    w: 32,
    d: 22,
    color: '#1f4fa8',
    headers: [{ names: ['VCC', 'GND', 'DOUT', 'AOUT'], x: -14, z: 0, axis: 'z' }],
    key: 'mq2',
    name: 'Sensor gas MQ2',
    desc: 'Mendeteksi asap/gas mudah terbakar.',
  });
  const can = mat('#c9ccd2', { metalness: 0.7, roughness: 0.35 });
  g.add(cyl(10, 2, mat('#e7dcc6'), 4, top, 0, 36));
  g.add(cyl(9.5, 10, can, 4, top + 2, 0, 36));
  g.add(cyl(8, 0.3, mat('#8d929a', { metalness: 0.5, roughness: 0.8 }), 4, top + 12, 0, 36));
  const led = ownMat('#f2d6cf', { roughness: 0.3 });
  g.add(box(1.8, 0.9, 1.2, led, -7, top, -8));
  g.add(cyl(1.8, 2, mat('#2f62c9'), -7, top, 6, 16)); // trimpot ambang
  g.userData.setAlarm = (on) => {
    setEmissive(led, '#ff3b2f', on ? 2.4 : 0);
    led.color.set(on ? '#ff5a4f' : '#f2d6cf');
  };
  g.userData.anchor = anchor(g, 4, top + 13, 0);
  return g;
}
