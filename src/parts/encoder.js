import * as THREE from 'three';
import { M, mat, box, cyl, anchor, markPart, pinHeader } from './lib.js';

/**
 * Modul rotary encoder (KY-040), berbaring di lantai. Kenop berputar tanpa batas.
 * Pin: CLK, DT, SW, +, GND.
 * userData.setAngle(rad)
 */
export function createEncoder() {
  const g = new THREE.Group();
  g.name = 'Rotary encoder';
  const PCB_Y = 1.5;
  const top = PCB_Y + 1.6;

  g.add(box(28, 1.6, 20, mat('#1d2b4a', { roughness: 0.6 }), 0, PCB_Y, 0, 0.3));
  g.add(box(12.5, 6.5, 13.5, mat('#c9ccd2', { metalness: 0.6, roughness: 0.35 }), 3, top, 0, 0.5));
  g.add(cyl(3.6, 5, mat('#c9ccd2', { metalness: 0.7, roughness: 0.3 }), 3, top + 6.5, 0, 24));

  const knob = new THREE.Group();
  knob.position.set(3, top + 11.5, 0);
  knob.add(new THREE.Mesh(new THREE.CylinderGeometry(7, 7.3, 9, 24), mat('#3a3d45', { roughness: 0.45, flatShading: true })));
  knob.children[0].position.y = 4.5;
  knob.add(box(0.9, 0.3, 4, M.white, 0, 9, -3.6));
  g.add(knob);

  pinHeader(g, ['CLK', 'DT', 'SW', '+', 'GND'], { x: -11, y: top, z: 0, axis: 'z' });

  g.userData.setAngle = (rad) => {
    knob.rotation.y = -rad;
  };
  g.userData.anchor = anchor(g, 3, top + 22, 0);
  return markPart(g, { key: 'encoder', name: 'Rotary encoder', desc: 'Seret ke kiri/kanan untuk memutar; tiap "klik" mengirim pulsa.' });
}
