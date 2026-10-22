import * as THREE from 'three';
import { M, mat, ownMat, box, cyl, anchor, markPart, glowSprite, setEmissive } from './lib.js';

/**
 * Bohlam di atas fitting dan alas kayu.
 * userData.setLevel(0..1), userData.terms.{a, b} — tempat kabel masuk
 */
export function createBulb() {
  const g = new THREE.Group();
  g.name = 'Bohlam';

  g.add(cyl(15, 5, mat('#c99b62', { roughness: 0.85 }), 0, 0, 0, 40));
  g.add(cyl(7.5, 13, mat('#f1eee6', { roughness: 0.5 }), 0, 5, 0, 32));
  g.add(cyl(6.2, 5, mat('#c9ccd2', { metalness: 0.7, roughness: 0.3 }), 0, 18, 0, 28));

  const glass = ownMat('#f8f2dc', { transparent: true, opacity: 0.55, roughness: 0.15 });
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(8, 6.2, 8, 32, 1, true), glass);
  neck.position.y = 27;
  g.add(neck);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(13, 36, 24), glass);
  ball.position.y = 40;
  g.add(ball);
  const filamentMat = ownMat('#8a6a3a');
  const filament = new THREE.Mesh(new THREE.TorusGeometry(3.2, 0.35, 8, 24, Math.PI), filamentMat);
  filament.position.y = 38;
  g.add(filament);
  g.add(cyl(0.3, 12, M.silver, -3.2, 25, 0, 6));
  g.add(cyl(0.3, 12, M.silver, 3.2, 25, 0, 6));
  const glow = glowSprite('#ffd27a', 110);
  glow.position.y = 40;
  g.add(glow);

  g.userData.terms = { a: new THREE.Vector3(-9, 5, 0), b: new THREE.Vector3(9, 5, 0) };
  g.userData.setLevel = (v) => {
    setEmissive(glass, '#ffcf6a', v * 1.4);
    setEmissive(filamentMat, '#ffe9a8', v * 4);
    glass.opacity = 0.55 + v * 0.35;
    glow.material.opacity = v * 0.9;
  };
  g.userData.anchor = anchor(g, 0, 54, 0);
  g.userData.setLevel(0);
  return markPart(g, { key: 'bulb', name: 'Bohlam 220 V', desc: 'Beban listrik besar — tidak boleh langsung ke pin Arduino.' });
}

/** Steker listrik (sumber AC) dengan kabel. */
export function createPlug() {
  const g = new THREE.Group();
  g.add(box(20, 14, 12, mat('#f1eee6', { roughness: 0.5 }), 0, 0, 0, 2));
  for (const x of [-4.5, 4.5]) {
    const p = cyl(1.4, 8, M.silver, 0, 0, 0, 12);
    p.rotation.x = Math.PI / 2;
    p.position.set(x, 7, -9);
    g.add(p);
  }
  g.userData.term = new THREE.Vector3(0, 14, 2);
  g.userData.anchor = anchor(g, 0, 15, 0);
  return markPart(g, { key: 'plug', name: 'Listrik AC', desc: 'Tegangan tinggi! Pada rangkaian nyata, minta bantuan orang dewasa.' });
}
