import * as THREE from 'three';
import { M, mat, cyl, rod, anchor, markPart, noOutline, PITCH } from './lib.js';

/**
 * Buzzer piezo. Kaki di x = ±3,81 (selisih 3 lubang).
 * userData.setTone(hz)  — 0 = diam
 * userData.tick(dt)     — animasi gelombang suara
 */
export function createBuzzer() {
  const g = new THREE.Group();
  g.name = 'Buzzer';
  const body = mat('#1f2024', { roughness: 0.5 });

  g.add(cyl(6, 9.5, body, 0, 1.5, 0, 36));
  g.add(cyl(6.05, 0.3, mat('#2c2d33'), 0, 11, 0, 36));
  g.add(cyl(1.2, 0.35, M.dark, 0, 11.05, 0, 16));
  // tanda +
  g.add(cyl(0.25, 0.1, M.white, 3.4, 11.2, -2.2, 6));

  for (const x of [-1.5 * PITCH, 1.5 * PITCH]) g.add(rod(new THREE.Vector3(x, -1.5, 0), new THREE.Vector3(x, 1.5, 0)));

  const rings = [];
  for (let i = 0; i < 3; i++) {
    const r = new THREE.Mesh(
      new THREE.TorusGeometry(7, 0.35, 6, 40),
      new THREE.MeshBasicMaterial({ color: '#25a99e', transparent: true, opacity: 0, depthWrite: false })
    );
    r.rotation.x = Math.PI / 2;
    r.position.y = 12;
    noOutline(r);
    g.add(r);
    rings.push(r);
  }

  let hz = 0;
  let phase = 0;
  g.userData.setTone = (v) => (hz = v);
  g.userData.tick = (dt) => {
    if (hz > 0) phase += dt * (0.8 + hz / 600);
    rings.forEach((r, i) => {
      const k = (phase + i / 3) % 1;
      r.scale.setScalar(1 + k * 2.2);
      r.position.y = 12 + k * 6;
      r.material.opacity = hz > 0 ? (1 - k) * 0.75 : Math.max(0, r.material.opacity - dt * 3);
    });
  };
  g.userData.anchor = anchor(g, 0, 11.4, 0);
  return markPart(g, { key: 'buzzer', name: 'Buzzer piezo', desc: 'Berbunyi saat pinnya dinyalakan-matikan dengan cepat.' });
}
