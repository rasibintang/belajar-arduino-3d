import * as THREE from 'three';
import { M, mat, box, boxGeometry, bentRod, anchor, markPart, canvasTexture, PITCH } from './lib.js';

const grilleTex = {};
function grille(base, hole) {
  if (grilleTex[base]) return grilleTex[base];
  grilleTex[base] = canvasTexture(160, 200, (ctx, w, h) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = hole;
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 4; c++) {
        const x = 22 + c * 31 + (r % 2) * 8;
        ctx.fillRect(x, 18 + r * 25, 20, 13);
      }
    }
  });
  return grilleTex[base];
}

/**
 * Sensor suhu & kelembapan DHT11 (versi modul), berdiri menghadap +z.
 * Kaki: VCC, DATA, GND di x = -2,54 / 0 / +2,54.
 */
export function createDHT({ variant = 'dht11' } = {}) {
  const g = new THREE.Group();
  const dht22 = variant === 'dht22';
  g.name = dht22 ? 'DHT22' : 'DHT11';
  const [base, hole] = dht22 ? ['#f1efe8', '#b9b6ad'] : ['#5aa8de', '#2d6d9e'];
  const Y0 = 3.5;

  g.add(box(15, 21, 1.6, mat('#1f3f7a'), 0, Y0, -1.8, 0.3));
  const blue = mat(base, { roughness: 0.55 });
  const body = new THREE.Mesh(boxGeometry(12, 15.5, 5.5, 0.6), [
    blue, blue, blue, blue, new THREE.MeshStandardMaterial({ map: grille(base, hole), roughness: 0.6 }), blue,
  ]);
  body.position.set(0, Y0 + 3 + 7.75, 1.7);
  g.add(body);
  g.add(box(3 * PITCH, 2.5, 2.5, M.black, 0, Y0 - 0.5, -1.8));
  for (const x of [-PITCH, 0, PITCH]) {
    g.add(bentRod([[x, Y0 + 2, -1.8], [x, -1.5, -1.8]], 0.32, M.gold));
  }
  g.userData.anchor = anchor(g, 0, Y0 + 21, 0);
  return markPart(g, {
    key: 'dht',
    name: `Sensor ${g.name}`,
    desc: dht22 ? 'Mengukur suhu (−40–80 °C) dan kelembapan (0–100 %) dengan resolusi 0,1.' : 'Mengukur suhu (0–50 °C) dan kelembapan udara (20–90 %).',
  });
}
