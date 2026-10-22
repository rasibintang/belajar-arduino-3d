import * as THREE from 'three';
import { M, mat, box, cyl, anchor, markPart, roundedBox } from './lib.js';

/**
 * Motor DC kecil (tipe 130) di atas dudukan kayu, dengan baling-baling.
 * Poros mengarah ke -x. Terminal (+ / −) di belakang (+x).
 * userData.setSpeed(0..255), userData.tick(dt)
 */
export function createMotor() {
  const g = new THREE.Group();
  g.name = 'Motor DC';
  const AX = 14; // tinggi sumbu poros

  const wood = mat('#e2bd85', { roughness: 0.85 });
  const stand = roundedBox(30, 6, 22, 2, wood);
  g.add(stand);
  g.add(box(4, 6, 18, wood, -9, 6, 0));
  g.add(box(4, 6, 18, wood, 9, 6, 0));

  // Badan motor: silinder dengan sisi rata (diskala)
  const can = new THREE.Mesh(new THREE.CylinderGeometry(10, 10, 26, 36), mat('#cfd3d9', { metalness: 0.65, roughness: 0.35 }));
  can.rotation.z = Math.PI / 2;
  can.scale.set(1, 1, 0.82);
  can.position.set(0, AX, 0);
  g.add(can);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(9.2, 9.2, 4, 36), mat('#e9a866', { roughness: 0.6 }));
  cap.rotation.z = Math.PI / 2;
  cap.scale.set(1, 1, 0.82);
  cap.position.set(15, AX, 0);
  g.add(cap);
  const boss = cyl(3, 1.6, M.silver, 0, 0, 0, 20);
  boss.rotation.z = Math.PI / 2;
  boss.position.set(-13.8, AX, 0);
  g.add(boss);
  for (const z of [-4.5, 4.5]) g.add(box(1, 4, 2, M.gold, 17.3, AX + 4, z));

  const shaft = cyl(0.9, 8, M.silver, 0, 0, 0, 12);
  shaft.rotation.z = Math.PI / 2;
  shaft.position.set(-18, AX, 0);
  g.add(shaft);

  // Baling-baling 3 bilah
  const prop = new THREE.Group();
  prop.position.set(-21, AX, 0);
  const orange = mat('#f0a35a', { roughness: 0.55 });
  const hub = cyl(2.6, 4, orange, 0, 0, 0, 20);
  hub.rotation.z = Math.PI / 2;
  hub.position.x = 0;
  prop.add(hub);
  for (let i = 0; i < 3; i++) {
    const blade = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12), orange);
    blade.scale.set(1.1, 15, 4.2);
    blade.position.y = 15;
    blade.rotation.y = 0.5;
    const arm = new THREE.Group();
    arm.rotation.x = (i * Math.PI * 2) / 3;
    arm.add(blade);
    prop.add(arm);
  }
  g.add(prop);

  let speed = 0;
  let omega = 0;
  g.userData.setSpeed = (v) => (speed = v);
  g.userData.tick = (dt) => {
    // putaran mengejar target secara halus (ada inersia)
    const target = (speed / 255) * 40;
    omega += (target - omega) * Math.min(1, dt * 2.5);
    prop.rotation.x += omega * dt;
  };
  g.userData.terminals = { plus: anchor(g, 17.3, AX + 8, -4.5), minus: anchor(g, 17.3, AX + 8, 4.5) };
  g.userData.anchor = anchor(g, 0, AX + 9, 0);
  return markPart(g, { key: 'motor', name: 'Motor DC', desc: 'Berputar lebih cepat saat diberi daya lebih besar.' });
}
