import * as THREE from 'three';
import { M, mat, box, boxGeometry, bentRod, anchor, markPart, canvasTexture, PITCH } from './lib.js';

let grilleTex = null;
function grille() {
  if (grilleTex) return grilleTex;
  grilleTex = canvasTexture(160, 200, (ctx, w, h) => {
    ctx.fillStyle = '#5aa8de';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#2d6d9e';
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 4; c++) {
        const x = 22 + c * 31 + (r % 2) * 8;
        ctx.fillRect(x, 18 + r * 25, 20, 13);
      }
    }
  });
  return grilleTex;
}

/**
 * Sensor suhu & kelembapan DHT11 (versi modul), berdiri menghadap +z.
 * Kaki: VCC, DATA, GND di x = -2,54 / 0 / +2,54.
 */
export function createDHT() {
  const g = new THREE.Group();
  g.name = 'DHT11';
  const Y0 = 3.5;

  g.add(box(15, 21, 1.6, mat('#1f3f7a'), 0, Y0, -1.8, 0.3));
  const blue = mat('#5aa8de', { roughness: 0.55 });
  const body = new THREE.Mesh(boxGeometry(12, 15.5, 5.5, 0.6), [
    blue, blue, blue, blue, new THREE.MeshStandardMaterial({ map: grille(), roughness: 0.6 }), blue,
  ]);
  body.position.set(0, Y0 + 3 + 7.75, 1.7);
  g.add(body);
  g.add(box(3 * PITCH, 2.5, 2.5, M.black, 0, Y0 - 0.5, -1.8));
  for (const x of [-PITCH, 0, PITCH]) {
    g.add(bentRod([[x, Y0 + 2, -1.8], [x, -1.5, -1.8]], 0.32, M.gold));
  }
  g.userData.anchor = anchor(g, 0, Y0 + 21, 0);
  return markPart(g, { key: 'dht', name: 'Sensor DHT11', desc: 'Mengukur suhu (0–50 °C) dan kelembapan udara (20–90 %).' });
}
