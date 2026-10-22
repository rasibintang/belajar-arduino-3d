import * as THREE from 'three';
import { M, ownMat, cyl, rod, anchor, markPart, glowSprite, setEmissive, PITCH } from './lib.js';

export const LED_COLORS = {
  red: { label: 'Merah', color: '#e8392e' },
  yellow: { label: 'Kuning', color: '#f2c23a' },
  green: { label: 'Hijau', color: '#3fbf6a' },
  blue: { label: 'Biru', color: '#3d7be0' },
  white: { label: 'Putih', color: '#f2efe6' },
};

const R = 2.5; // LED 5 mm
const LIFT = 4; // tinggi kaki yang terlihat di atas breadboard

/**
 * LED 5 mm berdiri di breadboard. Kaki di x = ±1,27 (dua lubang bersebelahan).
 * Kaki kanan (+x) = anoda (+), lebih panjang.
 *
 * userData.setColor(name), userData.setLevel(0..1)
 */
export function createLED({ color = 'red' } = {}) {
  const g = new THREE.Group();
  g.name = 'LED';
  const lens = ownMat(LED_COLORS[color].color, { transparent: true, opacity: 0.9, roughness: 0.25 });

  g.add(cyl(R + 0.4, 1, lens, 0, LIFT));
  g.add(cyl(R, 4.4, lens, 0, LIFT + 1));
  const dome = new THREE.Mesh(new THREE.SphereGeometry(R, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), lens);
  dome.position.y = LIFT + 5.4;
  g.add(dome);

  g.add(rod(new THREE.Vector3(-PITCH / 2, -1.5, 0), new THREE.Vector3(-PITCH / 2, LIFT, 0)));
  g.add(rod(new THREE.Vector3(PITCH / 2, -1.5, 0), new THREE.Vector3(PITCH / 2, LIFT, 0)));

  const glow = glowSprite(LED_COLORS[color].color, 42);
  glow.position.y = LIFT + 4.5;
  g.add(glow);

  let current = color;
  let level = 0;
  const apply = () => {
    const c = LED_COLORS[current].color;
    lens.color.set(c);
    setEmissive(lens, c, level * 2.4);
    glow.material.color.set(c);
    glow.material.opacity = level;
  };
  g.userData.setColor = (name) => {
    current = name;
    apply();
  };
  g.userData.setLevel = (v) => {
    level = Math.max(0, Math.min(1, v));
    apply();
  };
  g.userData.anchor = anchor(g, 0, LIFT + 7.9, 0);
  apply();
  return markPart(g, { key: 'led', name: 'LED', desc: 'Menyala saat arus mengalir dari kaki panjang (+) ke kaki pendek (−).' });
}
