import * as THREE from 'three';
import { M, mat, boxGeometry, bentRod, anchor, markPart, canvasTexture, PITCH } from './lib.js';

/**
 * Chip DIP yang mengangkangi parit breadboard (kaki di baris e dan f).
 * Titik asal = tengah chip di garis parit.
 */
export function createDIP({ pins = 16, label = '74HC595', key = 'chip', name = label, desc = '' } = {}) {
  const g = new THREE.Group();
  g.name = name;
  const n = pins / 2;
  const len = n * PITCH + 0.8;

  const tex = canvasTexture(512, 110, (ctx, w, h) => {
    ctx.fillStyle = '#202024';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#a2a2aa';
    ctx.font = `600 ${h * 0.34}px "IBM Plex Mono", monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, w / 2, h / 2);
    ctx.fillStyle = '#111113';
    ctx.beginPath();
    ctx.arc(0, h / 2, h * 0.2, -Math.PI / 2, Math.PI / 2);
    ctx.fill();
  });
  const black = M.black;
  const body = new THREE.Mesh(boxGeometry(len, 3.2, 6.4, 0.45), [
    black, black, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 }), black, black, black,
  ]);
  body.position.y = 1.2 + 1.6;
  g.add(body);

  for (let i = 0; i < n; i++) {
    const x = (i - (n - 1) / 2) * PITCH;
    for (const s of [-1, 1]) {
      g.add(bentRod([[x, 2.2, s * 3.1], [x, 2.2, s * 3.81], [x, -1.5, s * 3.81]], 0.26, M.silver));
    }
  }
  g.userData.anchor = anchor(g, 0, 4.4, 0);
  return markPart(g, { key, name, desc });
}
