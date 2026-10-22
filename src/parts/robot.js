import * as THREE from 'three';
import { M, mat, box, cyl, roundedBox } from './lib.js';

export const PLATE_Y = 46; // permukaan atas pelat sasis (di atas gearbox motor)
export const TRACK = 128; // jarak antar roda (mm)

/**
 * Sasis robot: pelat akrilik, roda bebas di depan, dan dudukan baterai 4×AA.
 * Depan robot = arah +x. Motor roda dipasang terpisah oleh pelajaran.
 */
export function createChassis() {
  const g = new THREE.Group();
  g.name = 'Sasis robot';

  const plate = roundedBox(160, 3, 104, 10, mat('#bfd8e6', { roughness: 0.35 }));
  plate.position.y = PLATE_Y - 3;
  g.add(plate);
  for (const [x, z] of [[-70, -44], [-70, 44], [70, -44], [70, 44]]) g.add(cyl(1.6, 0.2, M.dark, x, PLATE_Y, z, 12));

  // roda bebas (bola) di depan bawah
  g.add(cyl(6, PLATE_Y - 10, M.silver, 58, 7, 0, 20));
  const ball = new THREE.Mesh(new THREE.SphereGeometry(7, 24, 16), mat('#d5d8dc', { metalness: 0.8, roughness: 0.25 }));
  ball.position.set(58, 7, 0);
  g.add(ball);

  // baterai 4×AA
  g.add(box(58, 15, 31, mat('#26272b', { roughness: 0.6 }), 34, PLATE_Y, 26, 1));
  for (let i = 0; i < 4; i++) {
    const cell = new THREE.Mesh(new THREE.CylinderGeometry(6.6, 6.6, 50, 24), mat(i % 2 ? '#d9473c' : '#2f6fd6', { roughness: 0.45 }));
    cell.rotation.z = Math.PI / 2;
    cell.position.set(34, PLATE_Y + 12, 26 - 10.5 + i * 7);
    cell.scale.set(1, 1, 0.55);
    g.add(cell);
  }
  g.userData.battery = { plus: new THREE.Vector3(6, PLATE_Y + 15, 18), minus: new THREE.Vector3(6, PLATE_Y + 15, 34) };
  return g;
}

/** Dinding arena (kotak panjang). */
export function wall(w, d, h = 60) {
  return box(w, h, d, mat('#e5d6b8', { roughness: 0.9 }), 0, 0, 0, 2);
}
