import * as THREE from 'three';
import { mat, ownMat, bentRod, anchor, markPart, PITCH } from './lib.js';

const DIGITS = [
  ['hitam', '#1d1d1f'], ['cokelat', '#7a4a24'], ['merah', '#d0312d'], ['oranye', '#f08a24'],
  ['kuning', '#f2d22e'], ['hijau', '#2f9e4f'], ['biru', '#2f62c9'], ['ungu', '#7d4bb5'],
  ['abu-abu', '#8a8a8a'], ['putih', '#f5f5f5'],
].map(([name, color]) => ({ name, color }));
const GOLD = { name: 'emas', color: '#c8a03c' };

/** Nilai ohm -> 4 gelang warna (berlaku untuk nilai ≥ 10 Ω). */
export function resistorBands(ohms) {
  const exp = Math.floor(Math.log10(ohms)) - 1;
  const sig = Math.round(ohms / 10 ** exp);
  return [DIGITS[Math.floor(sig / 10)], DIGITS[sig % 10], DIGITS[exp], GOLD];
}

export function formatOhms(ohms) {
  if (ohms >= 1e6) return `${ohms / 1e6} MΩ`;
  if (ohms >= 1000) return `${ohms / 1000} kΩ`;
  return `${ohms} Ω`;
}

const Y = 2.6; // tinggi sumbu badan dari permukaan breadboard

/**
 * Resistor 1/4 W tidur di atas breadboard. Kaki masuk ke lubang di x = ±span/2.
 * userData.setOhms(ohms)
 */
export function createResistor({ ohms = 220, span = 4 * PITCH } = {}) {
  const g = new THREE.Group();
  g.name = 'Resistor';

  // Profil "tulang anjing" diputar 360° (LatheGeometry), lalu ditidurkan
  const profile = [
    [0, -3.3], [0.95, -3.3], [1.3, -2.9], [1.3, -1.9], [1.1, -1.5],
    [1.1, 1.5], [1.3, 1.9], [1.3, 2.9], [0.95, 3.3], [0, 3.3],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const body = new THREE.Mesh(new THREE.LatheGeometry(profile, 28), mat('#e3c99a', { roughness: 0.7 }));
  body.rotation.z = Math.PI / 2;
  body.position.y = Y;
  g.add(body);

  const slots = [[-2.4, 1.33], [-0.7, 1.13], [0.4, 1.13], [2.4, 1.33]];
  const bandMats = slots.map(([x, r]) => {
    const m = ownMat('#000', { roughness: 0.5 });
    const band = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.55, 28), m);
    band.rotation.z = Math.PI / 2;
    band.position.set(x, Y, 0);
    g.add(band);
    return m;
  });

  const half = span / 2;
  for (const s of [-1, 1]) {
    g.add(bentRod([[s * 3.2, Y, 0], [s * (half - 0.6), Y, 0], [s * half, Y - 0.6, 0], [s * half, -1.5, 0]], 0.25));
  }

  let value = ohms;
  g.userData.setOhms = (v) => {
    value = v;
    resistorBands(v).forEach((b, i) => bandMats[i].color.set(b.color));
  };
  g.userData.getOhms = () => value;
  g.userData.anchor = anchor(g, 0, Y + 1.3, 0);
  g.userData.setOhms(ohms);
  return markPart(g, { key: 'resistor', name: 'Resistor', desc: 'Membatasi arus. Gelang warna menunjukkan nilainya.' });
}
