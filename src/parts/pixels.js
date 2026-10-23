import * as THREE from 'three';
import { M, mat, ownMat, box, anchor, markPart, pinHeader, glowSprite, PITCH } from './lib.js';

/**
 * Deretan LED WS2812 (NeoPixel) dalam beberapa bentuk:
 *   'single' – satu LED pada modul kecil (DIN, VDD, GND, DOUT)
 *   'strip'  – pita LED (count buah) berjajar
 *   'matrix' – panel cols×rows
 *   'meter'  – batang 10 LED (indikator level)
 * userData.setPixels([[r, g, b], …]) — 0..255
 */
export function createPixels({ layout = 'strip', count = 8, cols = 8 } = {}) {
  const g = new THREE.Group();
  g.name = 'NeoPixel';
  const positions = [];
  let w;
  let d;
  if (layout === 'matrix') {
    const rows = Math.ceil(count / cols);
    w = cols * 8 + 4;
    d = rows * 8 + 4;
    for (let i = 0; i < count; i++) {
      const r = Math.floor(i / cols);
      const c = i % cols;
      positions.push([(c - (cols - 1) / 2) * 8, (r - (rows - 1) / 2) * 8]);
    }
  } else if (layout === 'single') {
    w = 14;
    d = 14;
    positions.push([0, -1]);
  } else {
    const step = layout === 'meter' ? 6 : 16.6;
    w = count * step + 6;
    d = layout === 'meter' ? 12 : 12;
    for (let i = 0; i < count; i++) positions.push([(i - (count - 1) / 2) * step, -1]);
  }
  const pcbColor = layout === 'strip' ? '#e8e3d6' : '#1b1d22';
  g.add(box(w, layout === 'strip' ? 0.6 : 1.6, d, mat(pcbColor, { roughness: 0.6 }), 0, 1.5, 0, 0.3));
  const top = layout === 'strip' ? 2.1 : 3.1;

  const pixels = positions.map(([x, z]) => {
    g.add(box(5, 1.5, 5, M.white, x, top, z, 0.3));
    const die = ownMat('#e9e6dd', { roughness: 0.3 });
    const dot = new THREE.Mesh(new THREE.CircleGeometry(1.7, 20), die);
    dot.rotation.x = -Math.PI / 2;
    dot.position.set(x, top + 1.55, z);
    g.add(dot);
    const glow = glowSprite('#ffffff', layout === 'matrix' ? 14 : 20);
    glow.position.set(x, top + 3.5, z);
    g.add(glow);
    return { die, glow };
  });

  // header: DIN/VDD/GND di kiri; modul tunggal juga punya DOUT
  const names = layout === 'single' ? ['GND', 'VDD', 'DIN', 'DOUT'] : ['DIN', 'VDD', 'GND'];
  if (layout === 'single') pinHeader(g, names, { x: 0, y: top, z: d / 2 + 2 });
  else {
    g.add(box(4, 1.6, names.length * PITCH + 1, mat(pcbColor), -w / 2 - 2, 1.5, 0, 0.3));
    pinHeader(g, names, { x: -w / 2 - 2, y: top, z: 0, axis: 'z' });
  }

  const c = new THREE.Color();
  g.userData.setPixels = (list) => {
    pixels.forEach((p, i) => {
      const [r, gr, b] = list?.[i] ?? [0, 0, 0];
      const max = Math.max(r, gr, b);
      if (max <= 0) {
        p.die.color.set('#e9e6dd');
        p.die.emissive.set('#000');
        p.glow.material.opacity = 0;
        return;
      }
      c.setRGB(r / max, gr / max, b / max, THREE.SRGBColorSpace);
      p.die.color.copy(c);
      p.die.emissive.copy(c);
      p.die.emissiveIntensity = 0.5 + (max / 255) * 2;
      p.glow.material.color.copy(c);
      p.glow.material.opacity = (max / 255) * 0.95;
    });
  };
  g.userData.anchor = anchor(g, 0, top + 4, 0);
  return markPart(g, { key: 'pixels', name: 'NeoPixel', desc: 'LED RGB WS2812 berantai lewat satu kabel data.' });
}
