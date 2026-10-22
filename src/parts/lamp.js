import * as THREE from 'three';
import { mat, ownMat, cyl, rod, anchor, markPart, glowSprite, setEmissive } from './lib.js';

/**
 * Lampu meja. Kap lampu menghadap ke -x (ke arah benda yang disinari).
 * userData.setOn(bool)
 */
export function createLamp() {
  const g = new THREE.Group();
  g.name = 'Lampu meja';
  const navy = mat('#2b3a5c', { roughness: 0.5 });
  const coral = mat('#e8604a', { roughness: 0.5 });

  g.add(cyl(13, 3.5, navy, 0, 0, 0, 36));
  g.add(cyl(4, 2, navy, 0, 3.5, 0, 20));

  const elbow = new THREE.Vector3(8, 44, 0);
  const head = new THREE.Vector3(-30, 60, 0);
  g.add(rod(new THREE.Vector3(0, 5, 0), elbow, 1.4, navy));
  g.add(rod(elbow, head, 1.4, navy));
  const joint = new THREE.Mesh(new THREE.SphereGeometry(2.6, 16, 12), coral);
  joint.position.copy(elbow);
  g.add(joint);

  // Kap: kerucut terbuka mengarah serong ke bawah-kiri
  const shadeGroup = new THREE.Group();
  shadeGroup.position.copy(head);
  shadeGroup.rotation.z = -Math.PI * 0.2; // bukaan kap serong ke bawah-kiri
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(3.5, 12, 16, 32, 1, true), coral);
  shade.material = shade.material.clone();
  shade.material.side = THREE.DoubleSide;
  shade.position.y = -6;
  shadeGroup.add(shade);
  shadeGroup.add(cyl(3.5, 3, coral, 0, 2, 0, 20));
  const bulbMat = ownMat('#f4eedd', { roughness: 0.3 });
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(4.2, 20, 14), bulbMat);
  bulb.position.y = -12;
  shadeGroup.add(bulb);
  const glow = glowSprite('#ffd27a', 60);
  glow.position.y = -16;
  shadeGroup.add(glow);
  g.add(shadeGroup);

  g.userData.setOn = (on, level = 1) => {
    setEmissive(bulbMat, '#ffd98a', on ? 2 : 0);
    glow.material.opacity = on ? 0.75 * level : 0;
  };
  g.userData.anchor = anchor(g, head.x, head.y + 4, 0);
  g.userData.setOn(true);
  return markPart(g, { key: 'lamp', name: 'Lampu meja', desc: 'Seret menjauh untuk meredupkan cahaya di sensor.' });
}
