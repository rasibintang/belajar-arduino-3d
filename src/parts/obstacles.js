import * as THREE from 'three';
import { M, mat, box, cyl, anchor, markPart, roundedBox } from './lib.js';

function wheel(x, z) {
  const w = new THREE.Group();
  const tire = cyl(5.5, 4, mat('#26272b'), 0, -2, 0, 24);
  const hub = cyl(2.6, 4.3, mat('#d8d4cc'), 0, -2.15, 0, 16);
  w.add(tire, hub);
  w.rotation.z = Math.PI / 2;
  w.position.set(x, 5.5, z);
  return w;
}

/** Mobil mainan; bagian depan menghadap -z. */
export function createCar() {
  const g = new THREE.Group();
  const red = mat('#e8574a', { roughness: 0.5 });
  const body = roundedBox(22, 9, 42, 5, red);
  body.position.y = 4;
  g.add(body);
  const cabin = roundedBox(19, 9, 20, 4, red);
  cabin.position.set(0, 12.5, 3);
  g.add(cabin);
  const glass = mat('#f4f1ea', { roughness: 0.3 });
  g.add(box(19.4, 5.5, 13, glass, 0, 14, 3));
  g.add(box(16, 5.5, 20.4, glass, 0, 14, 3));
  g.userData.wheels = [];
  for (const x of [-10.5, 10.5]) {
    for (const z of [-13, 13]) {
      const w = wheel(x, z);
      g.userData.wheels.push(w);
      g.add(w);
    }
  }
  g.add(box(4, 2, 0.6, mat('#f6e7a6'), -6, 8, -21));
  g.add(box(4, 2, 0.6, mat('#f6e7a6'), 6, 8, -21));
  return g;
}

/** Kardus. */
export function createBox() {
  const g = new THREE.Group();
  g.add(box(30, 26, 30, mat('#d4a464', { roughness: 0.9 })));
  g.add(box(30.2, 0.3, 5, mat('#c9b48c'), 0, 26, 0));
  g.add(box(5, 20, 30.2, mat('#c9b48c'), 0, 6, 0));
  return g;
}

/** Bola lembut (pantulannya lemah). */
export function createBall() {
  const g = new THREE.Group();
  const ball = new THREE.Mesh(new THREE.SphereGeometry(13, 32, 20), mat('#9c6ad6', { roughness: 0.95 }));
  ball.position.y = 13;
  g.add(ball);
  return g;
}

export const OBSTACLES = {
  car: { label: 'Mobil', echo: 0.95, make: createCar, height: 20 },
  box: { label: 'Kardus', echo: 1, make: createBox, height: 26 },
  ball: { label: 'Bola', echo: 0.55, make: createBall, height: 26 },
};

/**
 * Wadah penghalang: berisi ketiga jenis, hanya satu yang tampil.
 * userData.setKind(kind)
 */
export function createObstacle(kind = 'car') {
  const g = new THREE.Group();
  g.name = 'Penghalang';
  const kinds = {};
  for (const [k, def] of Object.entries(OBSTACLES)) {
    kinds[k] = def.make();
    g.add(kinds[k]);
  }
  const top = anchor(g, 0, 20, 0);
  g.userData.wheels = kinds.car.userData.wheels;
  g.userData.setKind = (k) => {
    for (const [name, obj] of Object.entries(kinds)) obj.visible = name === k;
    top.position.y = OBSTACLES[k].height + 1;
  };
  g.userData.setKind(kind);
  g.userData.anchor = top;
  return markPart(g, { key: 'obstacle', name: 'Penghalang', desc: 'Seret mendekat atau menjauh dari sensor.' });
}
