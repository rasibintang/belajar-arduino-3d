import * as THREE from 'three';
import { M, mat, ownMat, box, bentRod, anchor, markPart, setEmissive, PITCH } from './lib.js';

// Segmen: [x, z, panjang, horizontal?] di permukaan atas (mm), angka miring sedikit seperti aslinya
const SEGMENTS = {
  A: [0, -6.2, 5, true],
  B: [3, -3.1, 5, false],
  C: [3, 3.1, 5, false],
  D: [0, 6.2, 5, true],
  E: [-3, 3.1, 5, false],
  F: [-3, -3.1, 5, false],
  G: [0, 0, 5, true],
};

/**
 * Display 7-segment satu digit (katoda bersama), mengangkangi parit breadboard.
 * Kaki depan (baris e): E D COM C DP · kaki belakang (baris f): G F COM A B.
 * userData.setSegments({ A: 0..1, …, DP: 0..1 })
 */
export function createSeg7({ color = '#ff3b2f' } = {}) {
  const g = new THREE.Group();
  g.name = '7-segment';
  const Y0 = 2.5;
  const H = 8;

  g.add(box(12.6, H, 19, mat('#1c1d22', { roughness: 0.5 }), 0, Y0, 0, 0.5));
  const top = Y0 + H;
  const off = '#3a2f2d';
  const lights = {};
  for (const [name, [x, z, len, horiz]] of Object.entries(SEGMENTS)) {
    const m = ownMat(off, { roughness: 0.4 });
    const seg = box(horiz ? len : 1.3, 0.25, horiz ? 1.3 : len, m, x, top, z, 0);
    seg.rotation.y = -0.08; // miring khas display
    g.add(seg);
    lights[name] = m;
  }
  const dpMat = ownMat(off, { roughness: 0.4 });
  g.add(box(1.3, 0.25, 1.3, dpMat, 4.8, top, 7.3, 0));
  lights.DP = dpMat;

  for (let i = 0; i < 5; i++) {
    const x = (i - 2) * PITCH;
    for (const s of [-1, 1]) g.add(bentRod([[x, Y0 + 0.5, s * 3.81], [x, -1.5, s * 3.81]], 0.28, M.silver));
  }

  g.userData.setSegments = (levels) => {
    for (const [name, m] of Object.entries(lights)) {
      const v = levels?.[name] ?? 0;
      m.color.set(v > 0.02 ? color : off);
      setEmissive(m, color, v * 2.5);
    }
  };
  g.userData.anchor = anchor(g, 0, top + 0.3, 0);
  return markPart(g, { key: 'seg7', name: 'Display 7-segment', desc: 'Tujuh LED berbentuk angka 8, katoda bersama.' });
}
