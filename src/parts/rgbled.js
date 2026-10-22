import * as THREE from 'three';
import { ownMat, cyl, rod, anchor, markPart, glowSprite, PITCH } from './lib.js';

const R = 2.5;
const LIFT = 4.5;

/**
 * LED RGB katoda bersama. 4 kaki: R, GND (paling panjang), G, B
 * di x = -3,81 / -1,27 / 1,27 / 3,81.
 * userData.setRGB(r, g, b)  — masing-masing 0..255
 */
export function createRGBLed() {
  const g = new THREE.Group();
  g.name = 'LED RGB';
  const lens = ownMat('#f3eef8', { transparent: true, opacity: 0.92, roughness: 0.4 });

  g.add(cyl(R + 0.4, 1, lens, 0, LIFT));
  g.add(cyl(R, 4.4, lens, 0, LIFT + 1));
  const dome = new THREE.Mesh(new THREE.SphereGeometry(R, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), lens);
  dome.position.y = LIFT + 5.4;
  g.add(dome);

  for (const x of [-1.5, -0.5, 0.5, 1.5]) {
    const xb = x * PITCH;
    g.add(rod(new THREE.Vector3(xb, -1.5, 0), new THREE.Vector3(xb, 1.5, 0)));
    g.add(rod(new THREE.Vector3(xb, 1.5, 0), new THREE.Vector3(x * 1.2, LIFT, 0)));
  }

  const glow = glowSprite('#ffffff', 30);
  glow.position.y = LIFT + 4.5;
  g.add(glow);

  const c = new THREE.Color();
  g.userData.setRGB = (r, gr, b) => {
    const max = Math.max(r, gr, b);
    if (max <= 0) {
      lens.color.set('#f3eef8');
      lens.emissive.set('#000');
      glow.material.opacity = 0;
      return;
    }
    c.setRGB(r / max, gr / max, b / max, THREE.SRGBColorSpace);
    lens.color.copy(c).lerp(new THREE.Color('#ffffff'), 0.25);
    lens.emissive.copy(c);
    lens.emissiveIntensity = 0.4 + (max / 255) * 1.4;
    glow.material.color.copy(c);
    glow.material.opacity = (max / 255) * 0.9;
  };
  g.userData.anchor = anchor(g, 0, LIFT + 7.9, 0);
  g.userData.setRGB(0, 0, 0);
  return markPart(g, { key: 'rgb', name: 'LED RGB', desc: 'Tiga LED (merah, hijau, biru) dalam satu lensa.' });
}
