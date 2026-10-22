import * as THREE from 'three';
import { M, mat, box, cyl, anchor, markPart, pinHeader, glowSprite } from './lib.js';

const COLS = 16;
const ROWS = 2;
const CELL_W = 34;
const CELL_H = 54;
const GAP = 5;

/**
 * Layar LCD 16×2 dengan modul I²C, berdiri miring di atas dudukan.
 * Pin (di dudukan): GND, VCC, SDA, SCL.
 * userData.setText(['baris 1', 'baris 2']), userData.setBacklight(bool)
 */
export function createLCD() {
  const g = new THREE.Group();
  g.name = 'LCD 16×2';

  // Dudukan + header pin
  g.add(box(88, 3, 40, mat('#2c3140', { roughness: 0.6 }), 0, 0, -2, 1));
  pinHeader(g, ['GND', 'VCC', 'SDA', 'SCL'], { x: -30, y: 3, z: 13 });

  // Panel miring (bersandar ke belakang menghadap penonton)
  const tilt = new THREE.Group();
  tilt.position.set(0, 3, -3);
  tilt.rotation.x = 1.1;
  g.add(tilt);
  const panel = new THREE.Group();
  panel.position.z = -18;
  tilt.add(panel);

  panel.add(box(80, 1.6, 36, mat('#2f7a3a', { roughness: 0.7 }), 0, 0, 0, 0.4));
  for (const [x, z] of [[-37.5, -15.5], [37.5, -15.5], [-37.5, 15.5], [37.5, 15.5]]) {
    panel.add(cyl(1.6, 1.7, mat('#d9c27a', { metalness: 0.6 }), x, 0, z, 16));
  }
  panel.add(box(72, 7, 25, mat('#22252b', { roughness: 0.45 }), 0, 1.6, 0, 0.8));

  // Layar: tekstur canvas yang digambar ulang setiap teks berubah
  const canvas = document.createElement('canvas');
  canvas.width = COLS * (CELL_W + GAP) + GAP * 3;
  canvas.height = ROWS * (CELL_H + GAP) + GAP * 3;
  const ctx = canvas.getContext('2d');
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 16;
  const screenMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.35, emissiveMap: tex, emissive: '#ffffff', emissiveIntensity: 0 });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(64, 15.5), screenMat);
  screen.rotation.x = -Math.PI / 2;
  screen.position.set(0, 8.62, 0);
  panel.add(screen);

  const glow = glowSprite('#7fb0ff', 95);
  glow.position.set(0, 12, 0);
  panel.add(glow);

  let lines = ['', ''];
  let light = false;
  function draw() {
    ctx.fillStyle = light ? '#3d6fd6' : '#24365e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.font = `600 ${CELL_H * 0.78}px "IBM Plex Mono", monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let r = 0; r < ROWS; r++) {
      const text = (lines[r] ?? '').padEnd(COLS).slice(0, COLS);
      for (let c = 0; c < COLS; c++) {
        const x = GAP * 1.5 + c * (CELL_W + GAP);
        const y = GAP * 1.5 + r * (CELL_H + GAP);
        // sel matriks titik yang kosong tampak samar
        ctx.fillStyle = light ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.03)';
        ctx.fillRect(x, y, CELL_W, CELL_H);
        if (text[c] !== ' ') {
          ctx.fillStyle = light ? '#f2f6ff' : '#5a6b92';
          ctx.fillText(text[c], x + CELL_W / 2, y + CELL_H / 2 + 2);
        }
      }
    }
    tex.needsUpdate = true;
    screenMat.emissiveIntensity = light ? 0.35 : 0;
    glow.material.opacity = light ? 0.35 : 0;
  }

  g.userData.setText = (next) => {
    const a = (next?.[0] ?? '').slice(0, COLS);
    const b = (next?.[1] ?? '').slice(0, COLS);
    if (a === lines[0] && b === lines[1]) return;
    lines = [a, b];
    draw();
  };
  g.userData.setBacklight = (on) => {
    if (on === light) return;
    light = on;
    draw();
  };
  draw();
  g.userData.anchor = anchor(g, 0, 36, -8);
  return markPart(g, { key: 'lcd', name: 'LCD 16×2 I²C', desc: 'Layar dua baris, 16 karakter per baris. Cukup 4 kabel lewat I²C.' });
}
