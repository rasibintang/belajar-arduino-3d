import * as THREE from 'three';
import { M, mat, box, boxGeometry, cyl, anchor, markPart, canvasTexture, roundedBox } from './lib.js';

/**
 * Servo mikro SG90. Poros output di atas, lengan putih berputar di sumbu y.
 * userData.setAngle(0..180), userData.cableExit -> Object3D tempat kabel keluar
 */
export function createServo() {
  const g = new THREE.Group();
  g.name = 'Servo';
  const blue = mat('#2f5fb8', { roughness: 0.45 });

  const sticker = canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#2f5fb8';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#eef2fb';
    ctx.textAlign = 'center';
    ctx.font = '800 54px "Barlow Semi Condensed", sans-serif';
    ctx.fillText('SG90', w / 2, h / 2 - 6);
    ctx.font = '600 22px "Barlow Semi Condensed", sans-serif';
    ctx.fillText('MICRO SERVO', w / 2, h / 2 + 30);
  });
  const body = new THREE.Mesh(boxGeometry(23, 22.5, 12.5, 1), [
    blue, blue, blue, blue, new THREE.MeshStandardMaterial({ map: sticker, roughness: 0.5 }), blue,
  ]);
  body.position.y = 11.25;
  g.add(body);
  g.add(box(32.5, 2.5, 12.5, blue, 0, 15.5, 0)); // sayap dudukan
  for (const x of [-14, 14]) {
    const h = cyl(1, 2.6, M.dark, x, 15.45, 0, 12);
    g.add(h);
  }
  g.add(cyl(6, 4.5, blue, -5.6, 22.5, 0, 28));
  g.add(cyl(3, 4.5, blue, 1.5, 22.5, 0, 20));
  g.add(cyl(2.4, 2.5, M.white, -5.6, 27, 0, 20));

  const horn = new THREE.Group();
  horn.position.set(-5.6, 29.5, 0);
  const arm = roundedBox(22, 1.6, 5, 2.4, mat('#f3f1ea', { roughness: 0.6 }));
  arm.position.x = 7;
  horn.add(arm);
  horn.add(cyl(3.4, 1.6, mat('#f3f1ea'), 0, 0, 0, 20));
  for (let i = 0; i < 4; i++) horn.add(cyl(0.45, 0.1, M.dark, 4 + i * 4, 1.6, 0, 8));
  g.add(horn);

  g.userData.setAngle = (deg) => {
    horn.rotation.y = ((deg - 90) * Math.PI) / 180;
  };
  g.userData.cableExit = (() => {
    const a = new THREE.Object3D();
    a.position.set(11.5, 4, 0);
    g.add(a);
    return a;
  })();
  g.userData.anchor = anchor(g, -5.6, 31, 0);
  g.userData.setAngle(90);
  return markPart(g, { key: 'servo', name: 'Servo SG90', desc: 'Motor yang bisa diperintah menuju sudut 0–180°.' });
}
