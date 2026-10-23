import * as THREE from 'three';
import { M, mat, box, cyl, bentRod, anchor, markPart, PITCH } from './lib.js';

/**
 * Push button (tactile switch) yang mengangkangi parit tengah breadboard.
 * Kaki di x = ±2,54 dan z = ±3,81 (baris e dan f).
 *
 * userData.pressed, userData.press(true/false), userData.onChange = fn
 */
export const BUTTON_COLORS = { red: '#e0533f', green: '#3caa5a', blue: '#3f7be0', yellow: '#f2cf3a', white: '#ecebe6', black: '#2b2d33' };

export function createButton({ color = 'red' } = {}) {
  const g = new THREE.Group();
  g.name = 'Tombol';

  g.add(box(9, 3.6, 9, M.black, 0, 0.4));
  g.add(box(9.2, 0.35, 9.2, mat('#c7cace', { metalness: 0.7, roughness: 0.35 }), 0, 4));
  for (const [x, z] of [[-3.5, -3.5], [3.5, -3.5], [-3.5, 3.5], [3.5, 3.5]]) {
    g.add(cyl(0.6, 0.4, M.black, x, 4.35, z, 10));
  }
  const capUp = 4.35;
  const cap = cyl(3.3, 3.2, mat(BUTTON_COLORS[color] ?? color, { roughness: 0.5 }), 0, capUp, 0, 32);
  g.add(cap);

  for (const x of [-PITCH, PITCH]) {
    for (const z of [-3.81, 3.81]) {
      const zEdge = Math.sign(z) * 4.5;
      g.add(bentRod([[x, 1.6, 0], [x, 1.6, zEdge], [x, 0.4, z], [x, -1.5, z]], 0.3));
    }
  }

  let pressed = false;
  g.userData.press = (v) => {
    if (v === pressed) return;
    pressed = v;
    g.userData.pressed = v;
    cap.position.y = capUp + 1.6 - (v ? 1.2 : 0);
    g.userData.onChange?.(v);
  };
  g.userData.pressed = false;
  g.userData.anchor = anchor(g, 0, capUp + 3.2, 0);
  return markPart(g, { key: 'button', name: 'Push button', desc: 'Klik dan tahan untuk menekan.' });
}
