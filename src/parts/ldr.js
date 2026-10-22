import * as THREE from 'three';
import { mat, cyl, rod, anchor, markPart, canvasTexture, PITCH } from './lib.js';

let faceTex = null;
function ldrFace() {
  if (faceTex) return faceTex;
  faceTex = canvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#f2dfae';
    ctx.fillRect(0, 0, w, h);
    // jalur zig-zag cadmium sulfide
    ctx.strokeStyle = '#b8462c';
    ctx.lineWidth = 7;
    ctx.beginPath();
    const rows = 6;
    for (let i = 0; i <= rows; i++) {
      const y = 22 + (i * (h - 44)) / rows;
      const [x0, x1] = i % 2 ? [w - 26, 26] : [26, w - 26];
      if (i === 0) ctx.moveTo(x0, y);
      else ctx.lineTo(x0, y);
      ctx.lineTo(x1, y);
    }
    ctx.stroke();
  });
  return faceTex;
}

/**
 * LDR (photoresistor). Kepala bundar di atas dua kaki (x = ±1,27).
 */
export function createLDR() {
  const g = new THREE.Group();
  g.name = 'LDR';
  const H = 7;

  const head = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 1.8, 28), [
    mat('#e8d39c'),
    new THREE.MeshStandardMaterial({ map: ldrFace(), roughness: 0.5 }),
    mat('#e8d39c'),
  ]);
  head.position.y = H + 0.9;
  g.add(head);

  for (const x of [-PITCH / 2, PITCH / 2]) g.add(rod(new THREE.Vector3(x, -1.5, 0), new THREE.Vector3(x, H, 0)));
  g.userData.anchor = anchor(g, 0, H + 1.8, 0);
  return markPart(g, { key: 'ldr', name: 'Sensor cahaya (LDR)', desc: 'Hambatannya turun saat terkena lebih banyak cahaya.' });
}
