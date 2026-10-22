import * as THREE from 'three';
import { M, mat, box, cyl, rod, anchor, markPart, PITCH } from './lib.js';

/**
 * Potensiometer putar 10 kΩ. Tiga kaki di x = -2,54 / 0 / +2,54.
 * userData.setValue(0..1023)  — memutar kenop (-135° .. +135°)
 */
export function createPotentiometer() {
  const g = new THREE.Group();
  g.name = 'Potensiometer';

  g.add(box(10, 7, 10, mat('#2f5fb8', { roughness: 0.6 }), 0, 0.5, -1.5));
  g.add(cyl(3.6, 1.6, mat('#c9ccd2', { metalness: 0.7, roughness: 0.35 }), 0, 7.5, -1.5));

  const knob = new THREE.Group();
  knob.position.set(0, 9.1, -1.5);
  // kenop beralur: silinder dengan banyak sisi + tutup
  const ridged = new THREE.Mesh(new THREE.CylinderGeometry(4.6, 4.8, 8, 20), mat('#26272b', { roughness: 0.55, flatShading: true }));
  ridged.position.y = 4;
  knob.add(ridged);
  knob.add(box(0.8, 0.3, 3.6, M.white, 0, 8, -2));
  g.add(knob);

  for (const x of [-PITCH, 0, PITCH]) g.add(rod(new THREE.Vector3(x, -1.5, 0), new THREE.Vector3(x, 1, 0), 0.3));

  let value = 512;
  g.userData.setValue = (v) => {
    value = Math.max(0, Math.min(1023, Math.round(v)));
    knob.rotation.y = -((value / 1023) * 270 - 135) * (Math.PI / 180);
  };
  g.userData.getValue = () => value;
  g.userData.anchor = anchor(g, 0, 17.4, -1.5);
  g.userData.setValue(value);
  return markPart(g, { key: 'pot', name: 'Potensiometer', desc: 'Seret ke kiri/kanan untuk memutar kenop.' });
}
