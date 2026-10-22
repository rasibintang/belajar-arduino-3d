import * as THREE from 'three';
import { M, mat, boxGeometry, box, anchor, markPart, canvasTexture, pinHeader, roundedBox } from './lib.js';

const LAYOUT = ['123A', '456B', '789C', '*0#D'];

function keyTexture(ch, letter) {
  return canvasTexture(96, 96, (ctx, w, h) => {
    ctx.fillStyle = letter ? '#d9473c' : '#efece4';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = letter ? '#ffffff' : '#1d2740';
    ctx.font = `700 ${h * 0.56}px "Barlow Semi Condensed", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(ch, w / 2, h / 2 + 3);
  });
}

/**
 * Keypad membran 4×4 berbaring di lantai, dengan pita kabel ke konektor 8 pin.
 * Klik tombolnya di tampilan 3D.
 * userData.queue — tombol yang ditekan (diambil oleh sketch), userData.current
 */
export function createKeypad() {
  const g = new THREE.Group();
  g.name = 'Keypad 4×4';

  g.add(roundedBox(64, 1.2, 72, 3, mat('#22252c', { roughness: 0.7 })));
  const keys = [];
  LAYOUT.forEach((row, r) => {
    [...row].forEach((ch, c) => {
      const letter = /[A-D]/.test(ch);
      const side = mat(letter ? '#c23d33' : '#d9d5cb');
      const key = new THREE.Mesh(boxGeometry(12.5, 1.6, 12.5, 1.4), [
        side, side, new THREE.MeshStandardMaterial({ map: keyTexture(ch, letter), roughness: 0.6 }), side, side, side,
      ]);
      key.position.set((c - 1.5) * 15, 2, (r - 1.5) * 15.5 + 3);
      g.add(key);
      keys.push({ ch, mesh: key, x: key.position.x, z: key.position.z });
    });
  });

  // pita kabel + konektor
  g.add(box(18, 0.5, 34, mat('#c9c4b8', { roughness: 0.8 }), 0, 0, -52));
  g.add(box(22, 5, 6, M.black, 0, 0, -71, 0.4));
  pinHeader(g, ['R1', 'R2', 'R3', 'R4', 'C1', 'C2', 'C3', 'C4'], { x: 0, y: 5, z: -71 });

  g.userData.queue = [];
  g.userData.current = null;
  let pressed = null;
  const v = new THREE.Vector3();
  g.userData.press = (down, point) => {
    if (down && point) {
      g.worldToLocal(v.copy(point));
      const k = keys.find((key) => Math.abs(v.x - key.x) < 7.5 && Math.abs(v.z - key.z) < 7.8);
      if (!k) return;
      pressed = k;
      k.mesh.position.y = 1.3;
      g.userData.current = k.ch;
      g.userData.queue.push(k.ch);
    } else if (!down && pressed) {
      pressed.mesh.position.y = 2;
      pressed = null;
      g.userData.current = null;
    }
  };
  g.userData.anchor = anchor(g, 0, 4, -20);
  return markPart(g, { key: 'keypad', name: 'Keypad 4×4', desc: 'Klik tombolnya untuk mengetik.' });
}
