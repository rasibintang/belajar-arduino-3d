import * as THREE from 'three';
import { M, mat, ownMat, box, cyl, anchor, markPart, pinHeader, setEmissive } from './lib.js';

/**
 * Driver motor H-bridge L298N, berbaring di lantai.
 * Pin: ENA, IN1, IN2, IN3, IN4, ENB. Terminal: A1 A2 (motor A), B1 B2 (motor B), VIN, GND.
 */
export function createL298N() {
  const g = new THREE.Group();
  g.name = 'L298N';
  const PCB_Y = 1.5;
  const top = PCB_Y + 1.6;

  g.add(box(43, 1.6, 43, mat('#c9302c', { roughness: 0.6 }), 0, PCB_Y, 0, 0.4));
  // pendingin bersirip
  const sink = mat('#26272c', { metalness: 0.4, roughness: 0.5 });
  g.add(box(24, 3, 16, sink, 0, top, -12, 0.3));
  for (let i = 0; i < 7; i++) g.add(box(1.6, 21, 16, sink, -9.6 + i * 3.2, top + 3, -12, 0.2));
  g.add(box(14, 3.5, 4, M.black, 0, top + 3, -2.5, 0.3)); // chip L298N

  const blue = mat('#2f7fd6', { roughness: 0.5 });
  const terms = {};
  const block = (x, z, names, axis) => {
    const n = names.length;
    g.add(axis === 'z' ? box(8, 10, n * 5, blue, x, top, z, 0.5) : box(n * 5, 10, 8, blue, x, top, z, 0.5));
    names.forEach((name, i) => {
      const o = (i - (n - 1) / 2) * 5;
      const [sx, sz] = axis === 'z' ? [x, z + o] : [x + o, z];
      g.add(cyl(1.7, 0.6, M.silver, sx, top + 10, sz, 16));
      terms[name] = new THREE.Vector3(sx, top + 10.6, sz);
    });
  };
  block(-17.5, -10, ['A1', 'A2'], 'z');
  block(17.5, -10, ['B1', 'B2'], 'z');
  block(-8, 17.5, ['VIN', 'GND', '5V'], 'x');
  g.userData.terms = terms;

  const led = ownMat('#f2d6cf', { roughness: 0.3 });
  g.add(box(2, 1, 1.4, led, -18, top, 6));
  pinHeader(g, ['ENA', 'IN1', 'IN2', 'IN3', 'IN4', 'ENB'], { x: 10, y: top, z: 17 });

  g.userData.setPower = (on) => setEmissive(led, '#ff3b2f', on ? 2.4 : 0);
  g.userData.anchor = anchor(g, 0, top + 24, -12);
  return markPart(g, { key: 'hbridge', name: 'Driver L298N', desc: 'Dua H-bridge: atur arah (IN) dan kecepatan (EN) dua motor.' });
}

/**
 * Motor gearbox kuning (TT) dengan roda. Roda di sisi +z, berputar di sumbu z.
 * userData.setSpeed(-255..255), userData.tick(dt), userData.terms.{a, b}
 */
export function createWheelMotor({ flip = false } = {}) {
  const g = new THREE.Group();
  g.name = 'Motor roda';
  const AX = 33; // jari-jari roda = tinggi poros
  const s = flip ? -1 : 1;

  const gear = mat('#f2c23a', { roughness: 0.55 });
  g.add(box(37, 18, 22, gear, 0, AX - 9, 0, 1.2));
  const can = new THREE.Mesh(new THREE.CylinderGeometry(9.5, 9.5, 20, 32), mat('#cfd3d9', { metalness: 0.6, roughness: 0.35 }));
  can.rotation.z = Math.PI / 2;
  can.position.set(-27, AX - 3, 0);
  g.add(can);
  g.add(box(1, 4, 2, M.gold, -37.5, AX - 3, -4, 0));
  g.add(box(1, 4, 2, M.gold, -37.5, AX - 3, 4, 0));

  const wheel = new THREE.Group();
  wheel.position.set(8, AX, s * 24);
  const tire = new THREE.Mesh(new THREE.CylinderGeometry(AX, AX, 25, 36), mat('#26272b', { roughness: 0.9, flatShading: true }));
  tire.rotation.x = Math.PI / 2;
  wheel.add(tire);
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(22, 22, 26, 32), gear);
  rim.rotation.x = Math.PI / 2;
  wheel.add(rim);
  for (let i = 0; i < 6; i++) {
    const spoke = box(4, 40, 1, mat('#e0a92a'), 0, -20, 0, 0);
    const holder = new THREE.Group();
    holder.rotation.z = (i * Math.PI) / 3;
    holder.position.z = s * 13.2;
    holder.add(spoke);
    wheel.add(holder);
  }
  g.add(wheel);

  let speed = 0;
  let omega = 0;
  g.userData.terms = { a: new THREE.Vector3(-37.5, AX + 1, -4), b: new THREE.Vector3(-37.5, AX + 1, 4) };
  g.userData.setSpeed = (v) => (speed = v);
  g.userData.tick = (dt) => {
    const target = (speed / 255) * 9;
    omega += (target - omega) * Math.min(1, dt * 4);
    // putaran positif = roda menggelinding ke +x lokal (sama untuk roda kiri dan kanan)
    wheel.rotation.z -= omega * dt;
  };
  g.userData.anchor = anchor(g, 0, AX + 10, 0);
  return markPart(g, { key: 'wheel', name: 'Motor roda (TT)', desc: 'Motor DC dengan gearbox: lebih pelan tapi lebih kuat.' });
}
