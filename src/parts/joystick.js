import * as THREE from 'three';
import { mat, box, cyl, anchor, markPart, pinHeader } from './lib.js';

/**
 * Modul joystick analog (dua potensiometer + tombol), berbaring di lantai.
 * Pin: GND, +5V, VRx, VRy, SW. Seret tuasnya; klik untuk menekan tombol.
 * userData.xy -> [-1..1, -1..1], userData.pressed, userData.tick(dt)
 */
export function createJoystick() {
  const g = new THREE.Group();
  g.name = 'Joystick';
  const PCB_Y = 1.5;

  g.add(box(36, 1.6, 27, mat('#1d2b4a', { roughness: 0.6 }), 0, PCB_Y, 0, 0.3));
  g.add(box(17, 9, 17, mat('#dcd8cf', { roughness: 0.5 }), -3, PCB_Y + 1.6, 0, 0.8));
  const dome = new THREE.Mesh(new THREE.SphereGeometry(7.5, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), mat('#cfcac0'));
  dome.position.set(-3, PCB_Y + 10.6, 0);
  g.add(dome);

  const stick = new THREE.Group();
  stick.position.set(-3, PCB_Y + 11, 0);
  stick.add(cyl(1.6, 7, mat('#8d929a', { metalness: 0.6 }), 0, 0, 0, 16));
  const cap = cyl(7.2, 6, mat('#2a2b30', { roughness: 0.6 }), 0, 6, 0, 36);
  stick.add(cap);
  stick.add(cyl(5.4, 0.4, mat('#3a3b42'), 0, 12, 0, 36));
  g.add(stick);

  pinHeader(g, ['GND', '+5V', 'VRx', 'VRy', 'SW'], { x: 13.5, y: PCB_Y + 1.6, z: 0, axis: 'z' });

  const target = [0, 0];
  const xy = [0, 0];
  g.userData.xy = xy;
  g.userData.pressed = false;
  g.userData.stick = {
    move(dx, dy) {
      const k = 1 / 55;
      const x = THREE.MathUtils.clamp(dx * k, -1, 1);
      const y = THREE.MathUtils.clamp(-dy * k, -1, 1);
      target[0] = x;
      target[1] = y;
    },
    release() {
      target[0] = 0;
      target[1] = 0;
    },
    press(down) {
      g.userData.pressed = down;
      stick.position.y = PCB_Y + 11 - (down ? 1.2 : 0);
    },
  };
  g.userData.tick = (dt) => {
    for (let i = 0; i < 2; i++) xy[i] += (target[i] - xy[i]) * Math.min(1, dt * 18);
    stick.rotation.z = -xy[0] * 0.45;
    stick.rotation.x = -xy[1] * 0.45;
  };
  g.userData.anchor = anchor(g, -3, PCB_Y + 24, 0);
  return markPart(g, { key: 'joystick', name: 'Joystick', desc: 'Seret tuasnya ke segala arah; klik untuk menekan tombolnya.' });
}
