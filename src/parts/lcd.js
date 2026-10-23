import * as THREE from 'three';
import { mat, box, cyl, anchor, markPart, pinHeader, glowSprite } from './lib.js';

const CELL_W = 34;
const CELL_H = 54;
const GAP = 5;

export const LCD_PARALLEL_PINS = ['VSS', 'VDD', 'V0', 'RS', 'RW', 'E', 'D0', 'D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'A', 'K'];

/**
 * Layar LCD karakter (16×2 atau 20×4), berdiri miring di atas dudukan.
 * i2c = true : modul I²C dengan pin GND, VCC, SDA, SCL.
 * i2c = false: 16 pin paralel (VSS … K) di dudukan.
 * userData.setText([...baris]), userData.setBacklight(bool)
 */
export function createLCD({ cols = 16, rows = 2, i2c = true } = {}) {
  const g = new THREE.Group();
  g.name = `LCD ${cols}×${rows}`;
  // ukuran fisik: 1602 = 80×36 mm, 2004 = 98×60 mm
  const big = cols > 16 || rows > 2;
  const PW = big ? 98 : 80;
  const PD = big ? 60 : 36;
  const BW = PW + 8;
  const BD = big ? 46 : 40;

  // Dudukan + header pin
  g.add(box(BW, 3, BD, mat('#2c3140', { roughness: 0.6 }), 0, 0, -2, 1));
  if (i2c) pinHeader(g, ['GND', 'VCC', 'SDA', 'SCL'], { x: -BW / 2 + 14, y: 3, z: BD / 2 - 5 });
  else pinHeader(g, LCD_PARALLEL_PINS, { x: -BW / 2 + 4 + 8 * 2.54, y: 3, z: BD / 2 - 5 });

  // Panel miring (bersandar ke belakang menghadap penonton)
  const tilt = new THREE.Group();
  tilt.position.set(0, 3, -3 - (big ? 4 : 0));
  tilt.rotation.x = 1.1;
  g.add(tilt);
  const panel = new THREE.Group();
  panel.position.z = -PD / 2;
  tilt.add(panel);

  panel.add(box(PW, 1.6, PD, mat('#2f7a3a', { roughness: 0.7 }), 0, 0, 0, 0.4));
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    panel.add(cyl(1.6, 1.7, mat('#d9c27a', { metalness: 0.6 }), x * (PW / 2 - 2.5), 0, z * (PD / 2 - 2.5), 16));
  }
  const bezelW = PW - 8;
  const bezelD = PD - 11;
  panel.add(box(bezelW, 7, bezelD, mat('#22252b', { roughness: 0.45 }), 0, 1.6, 0, 0.8));

  // Layar: tekstur canvas yang digambar ulang setiap teks berubah
  const canvas = document.createElement('canvas');
  canvas.width = cols * (CELL_W + GAP) + GAP * 3;
  canvas.height = rows * (CELL_H + GAP) + GAP * 3;
  const ctx = canvas.getContext('2d');
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 16;
  const screenMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.35, emissiveMap: tex, emissive: '#ffffff', emissiveIntensity: 0 });
  const sw = bezelW - 8;
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(sw, (sw * canvas.height) / canvas.width), screenMat);
  screen.rotation.x = -Math.PI / 2;
  screen.position.set(0, 8.62, 0);
  panel.add(screen);

  const glow = glowSprite('#7fb0ff', PW * 1.2);
  glow.position.set(0, 12, 0);
  panel.add(glow);

  let lines = Array(rows).fill('');
  let light = false;
  function draw() {
    ctx.fillStyle = light ? '#3d6fd6' : '#24365e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.font = `600 ${CELL_H * 0.78}px "IBM Plex Mono", monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let r = 0; r < rows; r++) {
      const text = (lines[r] ?? '').padEnd(cols).slice(0, cols);
      for (let c = 0; c < cols; c++) {
        const x = GAP * 1.5 + c * (CELL_W + GAP);
        const y = GAP * 1.5 + r * (CELL_H + GAP);
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
    const fresh = Array.from({ length: rows }, (_, i) => (next?.[i] ?? '').slice(0, cols));
    if (fresh.every((t, i) => t === lines[i])) return;
    lines = fresh;
    draw();
  };
  g.userData.setBacklight = (on) => {
    if (on === light) return;
    light = on;
    draw();
  };
  draw();
  g.userData.anchor = anchor(g, 0, 36, -8);
  return markPart(g, {
    key: 'lcd',
    name: `LCD ${cols}×${rows}${i2c ? ' I²C' : ''}`,
    desc: i2c ? `Layar ${rows} baris × ${cols} karakter lewat I²C (4 kabel).` : `Layar ${rows} baris × ${cols} karakter, 16 pin paralel.`,
  });
}
