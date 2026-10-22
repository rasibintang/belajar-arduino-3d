import * as THREE from 'three';
import { M, mat, ownMat, box, anchor, markPart, pinHeader, glowSprite } from './lib.js';

const COUNT = 12;
const R = 15;

/**
 * Ring NeoPixel 12 LED (WS2812B), berbaring di lantai.
 * Pin: DIN, 5V, GND. userData.setPixels([[r, g, b] × 12]) — 0..255
 */
export function createNeoRing() {
  const g = new THREE.Group();
  g.name = 'NeoPixel ring';
  const Y = 2;

  const shape = new THREE.Shape();
  shape.absarc(0, 0, 18.5, 0, Math.PI * 2, false);
  const hole = new THREE.Path();
  hole.absarc(0, 0, 11.5, 0, Math.PI * 2, true);
  shape.holes.push(hole);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 1.6, bevelEnabled: false, curveSegments: 48 });
  geo.rotateX(-Math.PI / 2);
  const ring = new THREE.Mesh(geo, mat('#1b1d22', { roughness: 0.6 }));
  ring.position.y = Y;
  g.add(ring);
  // tab kecil tempat header pin
  g.add(box(10, 1.6, 9, mat('#1b1d22', { roughness: 0.6 }), 0, Y, 22, 0.3));
  pinHeader(g, ['DIN', '5V', 'GND'], { x: 0, y: Y + 1.6, z: 23 });

  const pixels = [];
  for (let i = 0; i < COUNT; i++) {
    const a = (i / COUNT) * Math.PI * 2;
    const x = Math.sin(a) * R;
    const z = -Math.cos(a) * R;
    const pkg = box(5, 1.5, 5, M.white, x, Y + 1.6, z, 0.3);
    pkg.rotation.y = -a;
    g.add(pkg);
    const die = ownMat('#e9e6dd', { roughness: 0.3 });
    const dot = new THREE.Mesh(new THREE.CircleGeometry(1.7, 20), die);
    dot.rotation.x = -Math.PI / 2;
    dot.position.set(x, Y + 3.15, z);
    g.add(dot);
    const glow = glowSprite('#ffffff', 20);
    glow.position.set(x, Y + 5, z);
    g.add(glow);
    pixels.push({ die, glow });
  }

  const c = new THREE.Color();
  g.userData.setPixels = (list) => {
    pixels.forEach((p, i) => {
      const [r, gr, b] = list?.[i] ?? [0, 0, 0];
      const max = Math.max(r, gr, b);
      if (max <= 0) {
        p.die.color.set('#e9e6dd');
        p.die.emissive.set('#000');
        p.glow.material.opacity = 0;
        return;
      }
      c.setRGB(r / max, gr / max, b / max, THREE.SRGBColorSpace);
      p.die.color.copy(c);
      p.die.emissive.copy(c);
      p.die.emissiveIntensity = 0.5 + (max / 255) * 2;
      p.glow.material.color.copy(c);
      p.glow.material.opacity = (max / 255) * 0.95;
    });
  };
  g.userData.anchor = anchor(g, 0, Y + 4, -R);
  return markPart(g, { key: 'ring', name: 'NeoPixel ring', desc: '12 LED RGB berantai; satu pin data mengatur warna semuanya.' });
}
