import * as THREE from 'three';
import { M, mat, box, boxGeometry, cyl, bentRod, anchor, markPart, canvasTexture, PITCH } from './lib.js';

/**
 * Transistor daya TIP120 (kemasan TO-220), berdiri menghadap +z.
 * Kaki: Basis, Kolektor, Emitor di x = -2,54 / 0 / +2,54.
 */
export function createTransistor() {
  const g = new THREE.Group();
  g.name = 'Transistor';
  const Y0 = 3.5;

  const label = canvasTexture(200, 180, (ctx, w, h) => {
    ctx.fillStyle = '#26272b';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#a3a4ab';
    ctx.font = '600 34px "IBM Plex Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('TIP120', w / 2, h / 2 + 10);
  });
  const black = M.black;
  const body = new THREE.Mesh(boxGeometry(10, 9, 4.5, 0.6), [
    black, black, black, black, new THREE.MeshStandardMaterial({ map: label, roughness: 0.6 }), black,
  ]);
  body.position.set(0, Y0 + 4.5, 0);
  g.add(body);

  // Sirip logam dengan lubang baut
  const tab = mat('#c9ccd2', { metalness: 0.75, roughness: 0.3 });
  g.add(box(10, 6.5, 1.3, tab, 0, Y0 + 9, -1.6));
  const hole = cyl(1.8, 1.4, M.dark, 0, 0, 0, 20);
  hole.rotation.x = Math.PI / 2;
  hole.position.set(0, Y0 + 12.4, -1.6);
  g.add(hole);

  for (const x of [-PITCH, 0, PITCH]) {
    g.add(bentRod([[x, Y0 + 0.5, 0], [x, Y0 - 1.2, 0], [x, -1.5, 0]], 0.35, M.silver));
  }
  g.userData.anchor = anchor(g, 0, Y0 + 15.5, -1.6);
  return markPart(g, { key: 'transistor', name: 'Transistor TIP120', desc: 'Saklar elektronik: arus kecil di basis menyalakan arus besar motor.' });
}
