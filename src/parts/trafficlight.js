import * as THREE from 'three';
import { M, mat, ownMat, box, cyl, bentRod, anchor, markPart, glowSprite, setEmissive, PITCH } from './lib.js';

const LIGHTS = { red: '#e8392e', yellow: '#f2c23a', green: '#3fbf6a' };

/**
 * Modul lampu lalu lintas (3 LED di PCB hitam), berdiri menghadap +z.
 * Pin: GND, R, Y, G di x = -3,81 .. +3,81.
 * userData.set({ red, yellow, green })  — boolean
 */
export function createTrafficLight() {
  const g = new THREE.Group();
  g.name = 'Lampu lalu lintas';
  const Y0 = 4;
  const H = 42;

  g.add(box(13, H, 1.6, mat('#1d1e22', { roughness: 0.6 }), 0, Y0, 0));
  g.add(box(4 * PITCH, 2.5, 2.5, M.black, 0, Y0 - 1, -1.6));
  for (let i = 0; i < 4; i++) {
    const x = (i - 1.5) * PITCH;
    g.add(bentRod([[x, Y0 + 2, -0.8], [x, Y0, -1.6], [x, -1.5, -1.6]], 0.32, M.gold));
  }

  const leds = {};
  Object.entries(LIGHTS).forEach(([name, color], i) => {
    const y = Y0 + H - 8 - i * 12;
    const lens = ownMat(color, { transparent: true, opacity: 0.92, roughness: 0.3 });
    const base = cyl(3.4, 1, M.black, 0, 0, 0, 24);
    base.rotation.x = Math.PI / 2;
    base.position.set(0, y, 1.3);
    g.add(base);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(3, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2), lens);
    dome.rotation.x = Math.PI / 2;
    dome.position.set(0, y, 1.8);
    g.add(dome);
    const glow = glowSprite(color, 28);
    glow.position.set(0, y, 4);
    g.add(glow);
    leds[name] = { lens, glow, color };
  });

  g.userData.set = (state) => {
    for (const [name, { lens, glow, color }] of Object.entries(leds)) {
      const on = !!state[name];
      setEmissive(lens, color, on ? 1.8 : 0);
      lens.color.set(on ? color : new THREE.Color(color).multiplyScalar(0.55));
      glow.material.opacity = on ? 0.85 : 0;
    }
  };
  g.userData.set({});
  g.userData.anchor = anchor(g, 0, Y0 + H, 0);
  return markPart(g, { key: 'traffic', name: 'Lampu lalu lintas', desc: 'Tiga LED: merah, kuning, hijau.' });
}
