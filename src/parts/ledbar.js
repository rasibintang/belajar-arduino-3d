import * as THREE from 'three';
import { M, mat, ownMat, box, cyl, rod, anchor, markPart, glowSprite, setEmissive, PITCH } from './lib.js';
import { LED_COLORS } from './led.js';

/**
 * Modul 8 LED berjajar (resistor sudah terpasang). Sembilan kaki di breadboard:
 * GND lalu LED1..LED8, berjarak 2,54 mm di sumbu x (pusat di tengah).
 * userData.setLevels([0..1 × 8]), userData.setColor(name)
 */
export function createLEDBar({ color = 'red' } = {}) {
  const g = new THREE.Group();
  g.name = 'Modul 8 LED';
  const Y0 = 3;

  g.add(box(9 * PITCH, 2.5, PITCH, M.black, 0, 0.3, 0));
  for (let i = 0; i < 9; i++) g.add(rod(new THREE.Vector3((i - 4) * PITCH, -1.5, 0), new THREE.Vector3((i - 4) * PITCH, 1, 0), 0.3));
  g.add(box(25, 1.6, 10, mat('#1f2a44', { roughness: 0.6 }), 0, Y0, -1.5, 0.3));

  const leds = [];
  for (let i = 0; i < 8; i++) {
    const x = (i - 3) * PITCH;
    const lens = ownMat(LED_COLORS[color].color, { transparent: true, opacity: 0.92, roughness: 0.25 });
    g.add(cyl(1.25, 1.6, lens, x, Y0 + 1.6, -1.5, 20));
    const dome = new THREE.Mesh(new THREE.SphereGeometry(1.25, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), lens);
    dome.position.set(x, Y0 + 3.2, -1.5);
    g.add(dome);
    const glow = glowSprite(LED_COLORS[color].color, 16);
    glow.position.set(x, Y0 + 4.5, -1.5);
    g.add(glow);
    leds.push({ lens, glow, level: 0 });
  }

  let current = color;
  const apply = () => {
    const c = LED_COLORS[current].color;
    for (const led of leds) {
      led.lens.color.set(c);
      setEmissive(led.lens, c, led.level * 2.2);
      led.glow.material.color.set(c);
      led.glow.material.opacity = led.level * 0.9;
    }
  };
  g.userData.setLevels = (levels) => {
    leds.forEach((led, i) => (led.level = Math.max(0, Math.min(1, levels[i] ?? 0))));
    apply();
  };
  g.userData.setColor = (name) => {
    current = name;
    apply();
  };
  g.userData.anchor = anchor(g, 0, Y0 + 5, -1.5);
  apply();
  return markPart(g, { key: 'ledbar', name: 'Modul 8 LED', desc: 'Delapan LED dengan resistor bawaan; tiap LED punya satu pin.' });
}
