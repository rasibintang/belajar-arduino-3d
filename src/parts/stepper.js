import * as THREE from 'three';
import { M, mat, ownMat, box, cyl, anchor, markPart, pinHeader, roundedBox, canvasTexture, setEmissive, boxGeometry } from './lib.js';

/**
 * Motor stepper 28BYJ-48, berdiri dengan poros menghadap atas dan lengan penunjuk.
 * userData.setAngle(derajat), userData.cable -> titik keluar kabel (lokal)
 */
export function createStepper() {
  const g = new THREE.Group();
  g.name = 'Stepper 28BYJ-48';

  g.add(cyl(14, 19, mat('#cfd3d9', { metalness: 0.6, roughness: 0.35 }), 0, 0, 0, 48));
  g.add(box(42, 1, 7, mat('#bfc3c9', { metalness: 0.6, roughness: 0.35 }), 0, 18.5, -2, 0));
  for (const x of [-17.5, 17.5]) g.add(cyl(2.1, 1.1, M.dark, x, 18.5, -2, 14));
  g.add(box(17, 16, 7, mat('#3d6fd0', { roughness: 0.5 }), 0, 1.5, 15.5, 1));
  g.add(cyl(4.6, 1.6, mat('#d4b25a', { metalness: 0.7 }), 0, 19.5, -8, 24));
  g.add(cyl(2.5, 9, M.silver, 0, 21, -8, 16));

  const arm = new THREE.Group();
  arm.position.set(0, 27, -8);
  const pointer = roundedBox(30, 2.2, 6, 2.5, mat('#f3f1ea', { roughness: 0.6 }));
  pointer.position.x = 10;
  arm.add(pointer);
  arm.add(box(3, 0.3, 3, mat('#e0533f'), 23, 2.2, 0, 0));
  g.add(arm);

  g.userData.cable = new THREE.Vector3(0, 4, 19);
  g.userData.setAngle = (deg) => {
    arm.rotation.y = (-deg * Math.PI) / 180;
  };
  g.userData.anchor = anchor(g, 0, 30, -8);
  return markPart(g, { key: 'stepper', name: 'Stepper 28BYJ-48', desc: '2048 langkah per putaran — bisa berhenti tepat di sudut mana pun.' });
}

/**
 * Papan driver ULN2003 dengan 4 LED fase (A–D).
 * Pin: IN1–IN4, serta - dan + untuk daya. userData.setPhase(mask 4 bit)
 */
export function createULN2003() {
  const g = new THREE.Group();
  g.name = 'Driver ULN2003';
  const PCB_Y = 1.5;
  const top = PCB_Y + 1.6;

  g.add(box(35, 1.6, 32, mat('#2f8a46', { roughness: 0.6 }), 0, PCB_Y, 0, 0.3));
  const chipTex = canvasTexture(400, 120, (ctx, w, h) => {
    ctx.fillStyle = '#202024';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#a2a2aa';
    ctx.font = `600 ${h * 0.36}px "IBM Plex Mono", monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('ULN2003A', w / 2, h / 2);
  });
  const chip = new THREE.Mesh(boxGeometry(20, 3, 6.4, 0.4), [
    M.black, M.black, new THREE.MeshStandardMaterial({ map: chipTex, roughness: 0.6 }), M.black, M.black, M.black,
  ]);
  chip.position.set(-2, top + 1.5, -4);
  g.add(chip);
  for (let i = 0; i < 8; i++) {
    for (const s of [-1, 1]) g.add(box(0.5, 1.4, 1.2, M.silver, -2 - 8.9 + i * 2.54, top, -4 + s * 3.7, 0));
  }
  // soket motor putih
  g.add(box(13, 6, 6.5, mat('#f1eee6', { roughness: 0.5 }), -2, top, 11, 0.4));
  g.userData.socket = new THREE.Vector3(-2, top + 6, 11);

  const leds = [];
  ['A', 'B', 'C', 'D'].forEach((n, i) => {
    const m = ownMat('#f2d6cf', { roughness: 0.3 });
    g.add(box(2, 1, 1.4, m, 12.5, top, -9 + i * 4));
    leds.push(m);
  });
  pinHeader(g, ['IN1', 'IN2', 'IN3', 'IN4'], { x: -14.5, y: top, z: -4, axis: 'z' });
  pinHeader(g, ['-', '+'], { x: 12, y: top, z: 11, axis: 'x' });

  g.userData.setPhase = (mask) => {
    leds.forEach((m, i) => {
      const on = (mask >> i) & 1;
      setEmissive(m, '#ff3b2f', on ? 2.4 : 0);
      m.color.set(on ? '#ff5a4f' : '#f2d6cf');
    });
  };
  g.userData.anchor = anchor(g, -2, top + 6, -4);
  return markPart(g, { key: 'driver', name: 'Driver ULN2003', desc: 'Menguatkan sinyal 4 pin Arduino untuk kumparan stepper. LED A–D = fase aktif.' });
}
