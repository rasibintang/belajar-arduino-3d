import * as THREE from 'three';
import { M, mat, ownMat, box, boxGeometry, cyl, anchor, markPart, pinHeader, canvasTexture, setEmissive } from './lib.js';

/**
 * Modul relay 5 V satu kanal, berbaring di lantai.
 * Pin: S (sinyal), + (5 V), - (GND). Terminal sekrup: NO, COM, NC.
 * userData.setOn(bool), userData.terms.{NO, COM}
 */
export function createRelay() {
  const g = new THREE.Group();
  g.name = 'Modul relay';
  const PCB_Y = 1.5;
  const top = PCB_Y + 1.6;

  g.add(box(50, 1.6, 26, mat('#2c5fb3', { roughness: 0.6 }), 0, PCB_Y, 0, 0.3));

  const label = canvasTexture(256, 200, (ctx, w, h) => {
    ctx.fillStyle = '#2f6fd6';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#eef2fb';
    ctx.textAlign = 'center';
    ctx.font = '700 36px "Barlow Semi Condensed", sans-serif';
    ctx.fillText('SRD-05VDC', w / 2, 80);
    ctx.font = '600 24px "Barlow Semi Condensed", sans-serif';
    ctx.fillText('10A 250VAC', w / 2, 125);
  });
  const blue = mat('#2f6fd6', { roughness: 0.4 });
  const cube = new THREE.Mesh(boxGeometry(19, 15.5, 15.5, 0.7), [
    blue, blue, new THREE.MeshStandardMaterial({ map: label, roughness: 0.4 }), blue, blue, blue,
  ]);
  cube.position.set(1, top + 7.75, 0);
  g.add(cube);

  // terminal sekrup biru (NO, COM, NC)
  g.add(box(8, 10, 15, mat('#2a8fd8', { roughness: 0.5 }), 19.5, top, 0, 0.6));
  const terms = {};
  ['NO', 'COM', 'NC'].forEach((name, i) => {
    const z = (i - 1) * 5;
    g.add(cyl(1.8, 0.6, M.silver, 19.5, top + 10, z, 16));
    terms[name] = new THREE.Vector3(21.5, top + 3, z);
  });
  g.userData.terms = terms;

  const ledMat = ownMat('#f2d6cf', { roughness: 0.3 });
  g.add(box(1.8, 0.9, 1.2, ledMat, -10, top, 9));
  pinHeader(g, ['S', '+', '-'], { x: -21.5, y: top, z: 0, axis: 'z' });

  let on = false;
  let shake = 0;
  g.userData.setOn = (v) => {
    if (v !== on) shake = 1;
    on = v;
    setEmissive(ledMat, '#ff3b2f', on ? 2.5 : 0);
    ledMat.color.set(on ? '#ff5a4f' : '#f2d6cf');
  };
  g.userData.tick = (dt) => {
    // kontak relay "terhentak" sedikit saat berpindah
    shake = Math.max(0, shake - dt * 8);
    cube.position.y = top + 7.75 + Math.sin(shake * 20) * shake * 0.35;
  };
  g.userData.anchor = anchor(g, 1, top + 16, 0);
  return markPart(g, { key: 'relay', name: 'Modul relay', desc: 'Saklar mekanis: sinyal 5 V kecil menyalakan beban listrik besar.' });
}
