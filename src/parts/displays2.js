import * as THREE from 'three';
import { mat, ownMat, box, cyl, anchor, setEmissive } from './lib.js';
import { createModule, chip } from './module.js';
import { createScreen } from './screen.js';
import { SEGMENTS } from './seg7.js';

/** Modul OLED I²C: SSD1306 128×64 (0,96") atau SH1107 128×128 (1,3"). userData.draw(buffer, opts) */
export function createOLED({ cols = 128, rows = 64 } = {}) {
  const square = rows === cols;
  const W = square ? 36 : 27;
  const D = square ? 42 : 28;
  const { g, top } = createModule({
    w: W,
    d: D,
    color: square ? '#1b1d22' : '#1f3f8a',
    headers: [{ names: ['GND', 'VCC', 'SCL', 'SDA'], x: 0, z: -D / 2 + 2.2 }],
    key: 'oled',
    name: square ? 'OLED 1,3" SH1107' : 'OLED 0,96" SSD1306',
    desc: `Layar ${cols}×${rows} piksel, lewat I²C.`,
  });
  const gw = W - 1;
  const gd = square ? 33 : 19;
  const gz = square ? 3 : 2.5;
  g.add(box(gw, 1.4, gd, mat('#0b0d12', { roughness: 0.15, metalness: 0.2 }), 0, top, gz, 0.2));
  const sw = square ? 26 : 22;
  const sh = (sw * rows) / cols;
  const screen = createScreen({ w: sw, h: sh, cols, rows, on: square ? '#e8f3ff' : '#9fe3ff' });
  screen.mesh.position.set(0, top + 1.42, gz - (square ? 0 : 1));
  g.add(screen.mesh);
  g.userData.draw = screen.draw;
  g.userData.anchor = anchor(g, 0, top + 4, gz);
  return g;
}

/** Layar Nokia 5110 (PCD8544, 84×48). Pin: RST CE DC DIN CLK VCC BL GND. */
export const NOKIA_PINS = ['RST', 'CE', 'DC', 'DIN', 'CLK', 'VCC', 'BL', 'GND'];
export function createNokia5110() {
  const { g, top } = createModule({
    w: 44,
    d: 46,
    color: '#b8322b',
    headers: [{ names: NOKIA_PINS, x: 0, z: -20.5 }],
    key: 'nokia',
    name: 'Nokia 5110',
    desc: 'Layar grafis 84×48 piksel (PCD8544) lewat SPI.',
  });
  g.add(box(42, 4.5, 34, mat('#c9ccd2', { metalness: 0.6, roughness: 0.35 }), 0, top, 3, 0.5));
  const bezel = mat('#2a2d33', { roughness: 0.5 });
  g.add(box(39, 0.6, 30, bezel, 0, top + 4.5, 3, 0.4));
  const glow = ownMat('#a9c79a', { roughness: 0.3 });
  g.add(box(35, 0.3, 21, glow, 0, top + 5.1, 4, 0));
  const screen = createScreen({ w: 33, h: (33 * 48) / 84, cols: 84, rows: 48, on: '#1d2a1f', off: '#a9c79a' });
  screen.mesh.material.emissiveIntensity = 0;
  screen.mesh.position.set(0, top + 5.45, 4);
  g.add(screen.mesh);
  g.userData.draw = screen.draw;
  g.userData.setBacklight = (on) => setEmissive(glow, '#b8ff9a', on ? 0.6 : 0);
  g.userData.anchor = anchor(g, 0, top + 9, 4);
  return g;
}

/** Modul TM1637: 4 digit 7-segment + titik dua jam. Pin: CLK DIO VCC GND. userData.setDigits([byte×4], brightness) */
export function createTM1637() {
  const { g, top } = createModule({
    w: 42,
    d: 24,
    color: '#1f4fa8',
    headers: [{ names: ['CLK', 'DIO', 'VCC', 'GND'], x: 22.5, z: 0, axis: 'z' }],
    key: 'tm1637',
    name: 'TM1637 4 digit',
    desc: 'Display 4 digit dengan 2 kabel data (CLK, DIO).',
  });
  g.add(box(38, 7, 19, mat('#1c1d22', { roughness: 0.5 }), -1, top, 0, 0.5));
  const y = top + 7;
  const off = '#3a2f2d';
  const color = '#ff3b2f';
  const segs = [];
  const order = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
  for (let d = 0; d < 4; d++) {
    const cx = -1 + (d - 1.5) * 9 + (d >= 2 ? 1.6 : -1.6);
    const list = order.map((name) => {
      const [x, z, len, horiz] = SEGMENTS[name];
      const m = ownMat(off, { roughness: 0.4 });
      const s = box(horiz ? len * 0.8 : 1.1, 0.25, horiz ? 1.1 : len * 0.8, m, cx + x * 0.8, y, z * 0.8, 0);
      s.rotation.y = -0.08;
      g.add(s);
      return m;
    });
    segs.push(list);
  }
  const colon = ownMat(off, { roughness: 0.4 });
  for (const z of [-2, 2]) g.add(box(1.1, 0.25, 1.1, colon, -1, y, z, 0));
  g.userData.setDigits = (bytes, level = 1) => {
    segs.forEach((list, d) => {
      const v = bytes?.[d] ?? 0;
      list.forEach((m, i) => {
        const lit = (v >> i) & 1;
        m.color.set(lit ? color : off);
        setEmissive(m, color, lit ? 2.5 * level : 0);
      });
    });
    const c = ((bytes?.[1] ?? 0) >> 7) & 1;
    colon.color.set(c ? color : off);
    setEmissive(colon, color, c ? 2.5 * level : 0);
  };
  g.userData.anchor = anchor(g, -1, y + 2, 0);
  return g;
}

/** Matriks LED 8×8 MAX7219 (gaya FC-16), `count` modul berantai; masukan di kanan. Pin: VCC GND DIN CS CLK. userData.setRows(modul, [byte×8], intensitas) */
export function createMax7219({ count = 1 } = {}) {
  const M = 32;
  const W = M * count;
  const { g, top } = createModule({
    w: W + 8,
    d: 32,
    color: '#1f4fa8',
    headers: [{ names: ['VCC', 'GND', 'DIN', 'CS', 'CLK'], x: W / 2 + 2, z: 0, axis: 'z' }],
    key: 'max7219',
    name: count > 1 ? `MAX7219 ${count}× 8×8` : 'MAX7219 8×8',
    desc: 'Matriks LED 8×8 dengan driver MAX7219 (SPI).',
  });
  const off = '#3a2522';
  const color = '#ff3b2f';
  const dots = [];
  for (let m = 0; m < count; m++) {
    const cx = ((count - 1) / 2 - m) * M - 2; // modul 0 (paling dekat DIN) di kanan
    g.add(box(M - 0.4, 6, M - 0.4, mat('#121316', { roughness: 0.6 }), cx, top, 0, 0.3));
    const mod = [];
    for (let r = 0; r < 8; r++) {
      const row = [];
      for (let c = 0; c < 8; c++) {
        const mm = ownMat(off, { roughness: 0.35 });
        g.add(cyl(1.4, 0.3, mm, cx + (c - 3.5) * 3.8, top + 6, (r - 3.5) * 3.8, 14));
        row.push(mm);
      }
      mod.push(row);
    }
    dots.push(mod);
  }
  g.userData.setRows = (m, rowsBytes, level = 1) => {
    const mod = dots[m];
    if (!mod) return;
    for (let r = 0; r < 8; r++) {
      const v = rowsBytes?.[r] ?? 0;
      for (let c = 0; c < 8; c++) {
        const lit = (v >> (7 - c)) & 1;
        const mm = mod[r][c];
        mm.color.set(lit ? color : off);
        setEmissive(mm, color, lit ? 1 + 2 * level : 0);
      }
    }
  };
  g.userData.anchor = anchor(g, -2, top + 8, 0);
  return g;
}

/** Penganalisis logika 8 kanal dengan layar gelombang. userData.drawTraces(fn(ctx, w, h)) */
export function createLogicAnalyzer() {
  const names = ['D0', 'D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'GND'];
  const { g, top } = createModule({
    w: 70,
    d: 44,
    color: '#26282e',
    headers: [{ names, x: -37, z: 0, axis: 'z' }],
    key: 'logic-analyzer',
    name: 'Logic analyzer',
    desc: 'Merekam 8 sinyal digital dan menampilkannya sebagai gelombang.',
  });
  g.add(box(64, 3, 40, mat('#33363d', { roughness: 0.5 }), 2, top, 0, 1));
  const canvas = document.createElement('canvas');
  canvas.width = 600;
  canvas.height = 360;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(60, 36),
    new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: '#ffffff', emissiveIntensity: 0.8, roughness: 0.3 })
  );
  screen.rotation.x = -Math.PI / 2;
  screen.position.set(2, top + 3.05, 0);
  g.add(screen);
  const ctx = canvas.getContext('2d');
  g.userData.drawTraces = (fn) => {
    fn(ctx, canvas.width, canvas.height);
    tex.needsUpdate = true;
  };
  g.userData.drawTraces((c, w, h) => {
    c.fillStyle = '#0d1117';
    c.fillRect(0, 0, w, h);
  });
  chip(g, -26, 16, top, 4, 4, 1);
  g.userData.anchor = anchor(g, 2, top + 6, 0);
  return g;
}

