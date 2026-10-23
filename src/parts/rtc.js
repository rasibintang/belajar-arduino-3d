import * as THREE from 'three';
import { M, mat, box, boxGeometry, cyl, anchor, markPart, pinHeader, canvasTexture } from './lib.js';

/**
 * Modul jam real-time DS3231 dengan baterai koin, berbaring di lantai.
 * Pin: GND, VCC, SDA, SCL.
 */
export function createRTC({ chip: chipName = 'DS3231' } = {}) {
  const g = new THREE.Group();
  g.name = `RTC ${chipName}`;
  const PCB_Y = 1.5;
  const top = PCB_Y + 1.6;

  g.add(box(38, 1.6, 22, mat(chipName === 'DS1307' ? '#2f8a46' : '#1f4fa8', { roughness: 0.6 }), 0, PCB_Y, 0, 0.3));
  g.add(cyl(11, 1.5, M.black, 6, top, 0, 40));
  g.add(cyl(10, 3.2, mat('#d5d8dc', { metalness: 0.75, roughness: 0.3 }), 6, top + 1.5, 0, 48));
  g.add(cyl(8.5, 0.1, mat('#bfc3c9', { metalness: 0.75 }), 6, top + 4.7, 0, 48));

  const tex = canvasTexture(300, 220, (ctx, w, h) => {
    ctx.fillStyle = '#202024';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#a2a2aa';
    ctx.font = `600 ${h * 0.24}px "IBM Plex Mono", monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(chipName, w / 2, h / 2);
  });
  const chip = new THREE.Mesh(boxGeometry(10, 2, 7.5, 0.3), [
    M.black, M.black, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 }), M.black, M.black, M.black,
  ]);
  chip.position.set(-9, top + 1, -4);
  g.add(chip);
  pinHeader(g, ['GND', 'VCC', 'SDA', 'SCL'], { x: -16, y: top, z: 0, axis: 'z' });

  g.userData.anchor = anchor(g, 6, top + 5, 0);
  return markPart(g, { key: 'rtc', name: g.name, desc: 'Jam real-time; baterai koin menjaganya tetap berjalan saat Arduino mati.' });
}
