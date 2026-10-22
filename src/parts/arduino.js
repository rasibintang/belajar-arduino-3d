import * as THREE from 'three';
import { M, mat, ownMat, box, boxGeometry, cyl, canvasTexture, anchor, markPart, setEmissive, PITCH } from './lib.js';

// Ukuran Arduino Uno R3 dalam inci (dari gambar teknis resmi), dikonversi ke mm.
const IN = 25.4;
const W = 2.7 * IN; // 68.58 mm
const H = 2.1 * IN; // 53.34 mm
const LIFT = 1.6; // papan sedikit terangkat dari lantai (kaki karet)
const PCB = 1.6;
export const BOARD_TOP = LIFT + PCB;
const HEADER_H = 8.5;

const PCB_COLOR = '#37457f';
const PCB_EDGE = '#e4d0a6'; // serat FR4 terlihat krem di sisi papan

// Posisi pin dalam inci: [x, y] dihitung dari pojok kiri bawah papan.
const PINS = {};
['SCL', 'SDA', 'AREF', 'GND.1', 'D13', 'D12', 'D11', 'D10', 'D9', 'D8'].forEach((n, i) => (PINS[n] = [0.84 + i * 0.1, 2.0]));
['D7', 'D6', 'D5', 'D4', 'D3', 'D2', 'D1', 'D0'].forEach((n, i) => (PINS[n] = [1.9 + i * 0.1, 2.0]));
['NC', 'IOREF', 'RESET', '3V3', '5V', 'GND', 'GND.2', 'VIN'].forEach((n, i) => (PINS[n] = [1.04 + i * 0.1, 0.1]));
['A0', 'A1', 'A2', 'A3', 'A4', 'A5'].forEach((n, i) => (PINS[n] = [1.94 + i * 0.1, 0.1]));

const HEADERS = [
  { first: 'SCL', count: 10 },
  { first: 'D7', count: 8 },
  { first: 'NC', count: 8 },
  { first: 'A0', count: 6 },
];

// Garis luar PCB (inci), termasuk pojok kanan yang menyerong
const OUTLINE = [
  [0, 0], [2.64, 0], [2.7, 0.06], [2.7, 1.52], [2.6, 1.62], [2.6, 2.04], [2.54, 2.1], [0, 2.1],
];
const HOLES = [[0.55, 0.1], [0.6, 2.0], [2.6, 0.3], [2.6, 1.4]];

/** Koordinat inci papan -> posisi lokal (mm). Sumbu y papan mengarah ke -z. */
function at(xIn, yIn, y = BOARD_TOP) {
  return new THREE.Vector3(xIn * IN, y, -yIn * IN);
}

function drawSilkscreen(ctx, w, h, S) {
  const px = (xIn) => xIn * IN * S;
  const py = (yIn) => (H - yIn * IN) * S;

  ctx.fillStyle = PCB_COLOR;
  ctx.fillRect(0, 0, w, h);

  // Jalur tembaga (sedikit lebih terang dari PCB) + via di ujungnya
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  const traces = [
    [[0.7, 1.45], [1.0, 1.45], [1.15, 1.3], [1.6, 1.3], [1.7, 1.2]],
    [[0.7, 1.55], [1.05, 1.55], [1.2, 1.4], [2.2, 1.4], [2.3, 1.5], [2.3, 1.85]],
    [[1.3, 1.85], [1.3, 1.55], [1.4, 1.45], [2.0, 1.45]],
    [[0.4, 0.75], [0.9, 0.75], [1.05, 0.9], [1.05, 1.0]],
    [[0.3, 0.95], [0.6, 0.95], [0.7, 1.05], [1.1, 1.05]],
    [[1.5, 0.25], [1.5, 0.45], [1.6, 0.55]],
    [[2.1, 0.25], [2.1, 0.4], [2.2, 0.5]],
    [[2.4, 1.85], [2.4, 1.65], [2.55, 1.5], [2.55, 1.2]],
    [[0.2, 1.1], [0.2, 0.6], [0.35, 0.5]],
    [[0.95, 1.9], [0.95, 1.7], [1.1, 1.62], [1.6, 1.62], [1.7, 1.52]],
    [[1.74, 1.88], [1.74, 1.6], [1.85, 1.5]],
    [[2.6, 1.88], [2.6, 1.62], [2.5, 1.52], [2.25, 1.52]],
    [[1.25, 0.38], [1.25, 0.5], [1.35, 0.58]],
    [[0.45, 1.25], [0.45, 1.6], [0.62, 1.7]],
    [[0.95, 0.55], [1.1, 0.55], [1.15, 0.6]],
    [[1.94, 0.22], [1.94, 0.42], [2.0, 0.5]],
    [[2.44, 0.22], [2.44, 0.4], [2.35, 0.5]],
  ];
  const lines = (color, width) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width * S;
    for (const t of traces) {
      ctx.beginPath();
      t.forEach(([x, y], i) => (i ? ctx.lineTo(px(x), py(y)) : ctx.moveTo(px(x), py(y))));
      ctx.stroke();
    }
  };
  lines('rgba(25,40,90,0.35)', 0.55); // bayangan tipis agar jalur terasa timbul
  lines('rgba(120,150,225,0.42)', 0.32);
  for (const t of traces) {
    for (const [x, y] of [t[0], t[t.length - 1]]) {
      ctx.fillStyle = '#c9b06a';
      ctx.beginPath();
      ctx.arc(px(x), py(y), 0.42 * S, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#20305e';
      ctx.beginPath();
      ctx.arc(px(x), py(y), 0.18 * S, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Lubang baut: cincin emas
  for (const [x, y] of HOLES) {
    ctx.fillStyle = '#d9c27a';
    ctx.beginPath();
    ctx.arc(px(x), py(y), 2.6 * S, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = '#f4f6fb';
  ctx.strokeStyle = '#f4f6fb';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  const font = (mm, weight = 700) => (ctx.font = `${weight} ${mm * S}px "Barlow Semi Condensed", Arial, sans-serif`);

  // Logo "tak hingga" dengan tanda - dan +
  const lx = px(1.7);
  const ly = py(1.12);
  const r = 4.2 * S;
  ctx.lineWidth = 1.5 * S;
  ctx.beginPath();
  ctx.arc(lx - r, ly, r, 0, Math.PI * 2);
  ctx.moveTo(lx + 2 * r, ly);
  ctx.arc(lx + r, ly, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 1 * S;
  ctx.beginPath();
  ctx.moveTo(lx - r - 1.8 * S, ly);
  ctx.lineTo(lx - r + 1.8 * S, ly);
  ctx.moveTo(lx + r - 1.8 * S, ly);
  ctx.lineTo(lx + r + 1.8 * S, ly);
  ctx.moveTo(lx + r, ly - 1.8 * S);
  ctx.lineTo(lx + r, ly + 1.8 * S);
  ctx.stroke();

  font(4.2, 800);
  ctx.fillText('ARDUINO', px(0.95), py(1.12));
  // "UNO" dalam kapsul
  ctx.lineWidth = 0.5 * S;
  const ux = px(2.3);
  const uy = py(1.12);
  ctx.beginPath();
  ctx.ellipse(ux, uy, 6.4 * S, 3.2 * S, 0, 0, Math.PI * 2);
  ctx.stroke();
  font(3.8, 800);
  ctx.fillText('UNO', ux, uy);

  font(1.9, 700);
  ctx.fillText('DIGITAL (PWM~)', px(1.9), py(1.72));
  font(1.5, 700);
  ctx.fillText('POWER', px(1.39), py(0.32));
  ctx.fillText('ANALOG IN', px(2.19), py(0.32));

  // Nomor pin di dekat header
  font(1.15, 600);
  const pwm = new Set(['D3', 'D5', 'D6', 'D9', 'D10', 'D11']);
  for (const [name, [x, y]] of Object.entries(PINS)) {
    let label = name.replace(/\.\d$/, '').replace(/^D/, '');
    if (pwm.has(name)) label = '~' + label;
    if (name === 'NC') continue;
    if (name === '3V3') label = '3.3V';
    ctx.save();
    ctx.translate(px(x), py(y) + (y > 1 ? 3.6 : -3.6) * S);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(label, 0, 0);
    ctx.restore();
  }

  font(1.2, 700);
  ctx.fillText('L', px(1.0), py(1.45));
  ctx.fillText('TX', px(1.0), py(1.35));
  ctx.fillText('RX', px(1.0), py(1.25));
  ctx.fillText('ON', px(2.32), py(1.42));
  ctx.fillText('RESET', px(0.35), py(1.78));
  ctx.fillText('ICSP', px(2.5), py(0.82));

  // Garis tepi tapak komponen (silkscreen putih tipis)
  ctx.lineWidth = 0.2 * S;
  ctx.strokeStyle = 'rgba(244,246,251,0.85)';
  const outline = (cx, cy, wMm, hMm) => ctx.strokeRect(px(cx) - (wMm / 2) * S, py(cy) - (hMm / 2) * S, wMm * S, hMm * S);
  outline(1.9, 0.73, 38.6, 9.4); // soket ATmega328P
  outline(0.95, 1.83, 8.6, 6); // ICSP 16U2
  outline(2.5, 1.03, 6, 8.6); // ICSP 328P
  outline(2.05, 1.47, 6.4, 5.4); // SOIC-8
  // takik soket
  ctx.beginPath();
  ctx.arc(px(1.9) - 19.3 * S, py(0.73), 1.2 * S, -Math.PI / 2, Math.PI / 2);
  ctx.stroke();

  font(0.95, 600);
  const labels = [
    ['R1', 0.4, 0.92], ['C2', 0.6, 1.0], ['RN1', 1.45, 1.68], ['C5', 1.33, 0.4], ['U3', 0.75, 1.52],
    ['Q1', 0.62, 0.86], ['C7', 2.3, 0.37], ['F1', 0.24, 0.72], ['Y1', 1.18, 1.75], ['U5', 2.05, 1.6],
  ];
  for (const [t, x, y] of labels) ctx.fillText(t, px(x), py(y));
}

function chipTexture(label, wPx, hPx) {
  return canvasTexture(wPx, hPx, (ctx, w, h) => {
    ctx.fillStyle = '#202024';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#9a9aa2';
    ctx.font = `600 ${h * 0.22}px "IBM Plex Mono", monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, w / 2, h / 2);
    // takik penanda pin 1
    ctx.fillStyle = '#121214';
    ctx.beginPath();
    ctx.arc(0, h / 2, h * 0.16, -Math.PI / 2, Math.PI / 2);
    ctx.fill();
  });
}

function femaleHeader(group, firstPin, count, holeMeshes) {
  const [x0, y0] = PINS[firstPin];
  const len = count * PITCH;
  const start = at(x0, y0);
  const body = box(len, HEADER_H, PITCH, M.black, start.x + len / 2 - PITCH / 2, BOARD_TOP, start.z);
  group.add(body);
  for (let i = 0; i < count; i++) holeMeshes.push([start.x + i * PITCH, BOARD_TOP + HEADER_H, start.z]);
}

function maleHeader(group, xIn, yIn, cols, rows) {
  const base = at(xIn, yIn);
  group.add(box(cols * PITCH, 2.5, rows * PITCH, M.black, base.x + ((cols - 1) * PITCH) / 2, BOARD_TOP, base.z - ((rows - 1) * PITCH) / 2));
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      group.add(box(0.64, 8.2, 0.64, M.gold, base.x + c * PITCH, BOARD_TOP, base.z - r * PITCH));
    }
  }
}

/**
 * Papan Arduino Uno R3.
 * Titik asal (0,0,0) = pojok kiri-depan papan di lantai. Papan memanjang ke +x dan -z.
 *
 * userData:
 *   pin(name)          -> posisi lokal ujung atas pin header
 *   pinAnchor(name)    -> Object3D di pin itu (untuk callout)
 *   anchors.{usb, chip, digital, power, analog, jack, led}
 *   setLed('L'|'TX'|'RX'|'ON', brightness 0..1)
 *   size: {w, d}
 */
export function createArduino() {
  const g = new THREE.Group();
  g.name = 'Arduino Uno';

  // --- PCB dengan lubang baut ---
  const shape = new THREE.Shape(OUTLINE.map(([x, y]) => new THREE.Vector2(x * IN, y * IN)));
  for (const [x, y] of HOLES) {
    const hole = new THREE.Path();
    hole.absarc(x * IN, y * IN, 1.6, 0, Math.PI * 2, true);
    shape.holes.push(hole);
  }
  const pcbGeo = new THREE.ExtrudeGeometry(shape, { depth: PCB, bevelEnabled: false, curveSegments: 16 });
  pcbGeo.rotateX(-Math.PI / 2);
  pcbGeo.translate(0, LIFT, 0);

  const S = 24; // piksel per mm untuk tekstur silkscreen
  const silk = canvasTexture(Math.round(W * S), Math.round(H * S), (ctx, w, h) => drawSilkscreen(ctx, w, h, S));
  silk.repeat.set(1 / W, 1 / H);
  const pcb = new THREE.Mesh(pcbGeo, [
    new THREE.MeshStandardMaterial({ map: silk, roughness: 0.62 }),
    mat(PCB_EDGE, { roughness: 0.85 }),
  ]);
  g.add(pcb);

  /**
   * Bagian papan yang bisa disorot/diklik sendiri (port USB, chip, header, …).
   * Muncul di menu Komponen dan bisa difokuskan kamera.
   */
  const sub = (key, name, desc) => {
    const s = markPart(new THREE.Group(), { key, name, desc });
    s.name = name;
    g.add(s);
    return s;
  };
  const tmp = new THREE.Matrix4();
  const holeGeo = new THREE.BoxGeometry(1.1, 0.12, 1.1);

  // --- Header perempuan (tempat kabel jumper) ---
  const headerGroups = {
    digital: sub('digital', 'Pin digital', 'D0–D13: HIGH (5 V) atau LOW (0 V). Pin bertanda ~ bisa PWM.'),
    power: sub('power', 'Pin daya', 'IOREF, RESET, 3.3V, 5V, GND, dan VIN untuk memberi daya rangkaian.'),
    analog: sub('analog', 'Pin analog', 'A0–A5 membaca tegangan 0–5 V sebagai angka 0–1023.'),
  };
  const headerOf = { SCL: 'digital', D7: 'digital', NC: 'power', A0: 'analog' };
  const holesBy = { digital: [], power: [], analog: [] };
  for (const h of HEADERS) femaleHeader(headerGroups[headerOf[h.first]], h.first, h.count, holesBy[headerOf[h.first]]);
  for (const [key, holes] of Object.entries(holesBy)) {
    const inst = new THREE.InstancedMesh(holeGeo, M.dark, holes.length);
    holes.forEach(([x, y, z], i) => inst.setMatrixAt(i, tmp.makeTranslation(x, y, z)));
    headerGroups[key].add(inst);
  }

  // --- Port USB-B ---
  const usb = at(-0.25, 1.5);
  const usbPart = sub('usb', 'Port USB', 'Menyambung ke komputer untuk mengunggah sketch dan memberi daya 5 V.');
  usbPart.add(box(16, 10.9, 12, mat('#dcd6c8', { metalness: 0.5, roughness: 0.45 }), usb.x + 8, BOARD_TOP, usb.z));
  usbPart.add(box(0.4, 7.4, 8.4, M.dark, usb.x - 0.05, BOARD_TOP + 1.8, usb.z));
  usbPart.add(box(0.6, 3, 5, M.white, usb.x + 0.2, BOARD_TOP + 4, usb.z));

  // --- Jack DC ---
  const jack = at(-0.07, 0.3);
  const jackPart = sub('jack', 'Jack daya', 'Masukan adaptor 7–12 V saat papan tidak tersambung USB.');
  jackPart.add(box(14, 11, 9, mat('#1e1e22'), jack.x + 7, BOARD_TOP, jack.z));
  const jackHole = cyl(3.2, 0.6, M.dark, 0, 0, 0, 24);
  jackHole.rotation.z = Math.PI / 2;
  jackHole.position.set(jack.x - 0.1, BOARD_TOP + 6, jack.z);
  jackPart.add(jackHole);

  // --- ATmega328P (DIP-28) ---
  const chipCenter = at(1.9, 0.73);
  const chipLen = 35.6;
  const chipW = 7.4;
  const dip = sub('dip', 'ATmega328P', 'Mikrokontroler: menyimpan dan menjalankan sketch-mu pada 16 MHz.');
  const chipTex = chipTexture('ATMEGA328P-PU', 1024, 212);
  const chip = new THREE.Mesh(boxGeometry(chipLen, 3.4, chipW, 0.5), [
    M.black, M.black, new THREE.MeshStandardMaterial({ map: chipTex, roughness: 0.6 }), M.black, M.black, M.black,
  ]);
  chip.position.set(chipCenter.x, BOARD_TOP + 1.2 + 1.7, chipCenter.z);
  dip.add(chip);
  dip.add(box(chipLen + 2, 1.2, chipW + 1, M.black, chipCenter.x, BOARD_TOP, chipCenter.z)); // soket
  const legGeo = new THREE.BoxGeometry(0.5, 2.6, 1.6);
  const legs = new THREE.InstancedMesh(legGeo, M.silver, 28);
  for (let i = 0; i < 14; i++) {
    const x = chipCenter.x - (13 * PITCH) / 2 + i * PITCH;
    legs.setMatrixAt(i, tmp.makeTranslation(x, BOARD_TOP + 2.4, chipCenter.z + chipW / 2 + 0.3));
    legs.setMatrixAt(14 + i, tmp.makeTranslation(x, BOARD_TOP + 2.4, chipCenter.z - chipW / 2 - 0.3));
  }
  dip.add(legs);

  // --- Chip USB kecil (ATmega16U2) ---
  const u2 = at(0.75, 1.34);
  const qfn = sub('qfn', 'ATmega16U2', 'Chip penerjemah USB ↔ serial: menerima sketch dari komputer.');
  const u2Mesh = box(5, 1, 5, M.black, u2.x, BOARD_TOP, u2.z);
  u2Mesh.rotation.y = Math.PI / 4;
  qfn.add(u2Mesh);

  // --- Kristal 16 MHz (oval perak) ---
  const xtal = at(1.18, 1.62);
  const crystalPart = sub('crystal', 'Kristal 16 MHz', 'Detak jam yang menjaga waktu mikrokontroler tetap tepat.');
  const crystal = new THREE.Mesh(new THREE.CapsuleGeometry(2.2, 6.8, 6, 16), M.silver);
  crystal.rotation.z = Math.PI / 2;
  crystal.scale.set(1, 1, 0.75);
  crystal.position.set(xtal.x, BOARD_TOP + 2.2, xtal.z);
  crystalPart.add(crystal);

  // --- Kapasitor elektrolit ---
  for (const [x, y] of [[0.68, 0.36], [0.92, 0.36]]) {
    const c = at(x, y);
    g.add(cyl(3.1, 6.5, mat('#c9cdd3', { metalness: 0.3, roughness: 0.5 }), c.x, BOARD_TOP, c.z));
    g.add(cyl(2.9, 0.15, mat('#8d929a', { metalness: 0.5 }), c.x, BOARD_TOP + 6.5, c.z));
    g.add(box(0.5, 0.2, 4.6, mat('#5c6068'), c.x, BOARD_TOP + 6.55, c.z));
    g.add(box(4.6, 0.2, 0.5, mat('#5c6068'), c.x, BOARD_TOP + 6.55, c.z));
  }

  // --- Regulator tegangan ---
  const reg = at(0.48, 0.78);
  g.add(box(6.5, 1.8, 3.5, M.black, reg.x, BOARD_TOP, reg.z));
  g.add(box(3.2, 0.3, 2, M.silver, reg.x, BOARD_TOP, reg.z - 2.6));

  // --- Tombol reset ---
  const rst = at(0.35, 1.92);
  const reset = sub('reset', 'Tombol reset', 'Klik untuk memulai ulang sketch dari awal setup().');
  reset.add(box(6, 3.4, 6, mat('#cfd2d6', { metalness: 0.6, roughness: 0.4 }), rst.x, BOARD_TOP, rst.z));
  const rstCap = cyl(1.8, 1.4, mat('#d9473c', { roughness: 0.5 }), rst.x, BOARD_TOP + 3.4, rst.z);
  reset.add(rstCap);
  const capY = rstCap.position.y;
  // bisa ditekan: tutup turun, lalu papan memanggil onReset (diisi oleh aplikasi)
  reset.userData.press = (down) => {
    rstCap.position.y = capY - (down ? 0.9 : 0);
    if (down) g.userData.onReset?.();
  };

  // --- Header ICSP ---
  maleHeader(g, 0.85, 1.78, 3, 2);
  maleHeader(g, 2.45, 1.13, 2, 3);

  // --- Komponen SMD kecil sebagai detail ---
  // r = resistor (hitam), c = kapasitor (cokelat muda); rot = diputar 90°
  const smd = [
    [0.4, 1.0, 'r'], [0.42, 1.1, 'c'], [1.45, 1.6, 'r', true], [1.52, 1.6, 'r', true], [1.38, 1.6, 'c', true],
    [1.4, 0.26, 'c'], [1.25, 0.47, 'c', true], [0.25, 0.62, 'r', true], [2.3, 0.28, 'c'], [2.22, 0.28, 'r'],
    [1.75, 1.7, 'r'], [0.6, 1.08, 'c', true], [0.9, 1.22, 'r'], [0.62, 1.22, 'c'], [1.6, 0.42, 'r'],
    [2.32, 1.62, 'c', true], [2.62, 0.6, 'r', true], [0.95, 0.47, 'c'],
  ];
  for (const [x, y, kind, rot] of smd) {
    const p = at(x, y);
    const part = new THREE.Group();
    part.add(box(1.5, 0.55, 1.1, kind === 'r' ? mat('#232327') : mat('#c8a26a'), 0, 0, 0, 0.14));
    for (const s of [-1, 1]) part.add(box(0.36, 0.62, 1.16, M.silver, s * 0.86, 0, 0, 0));
    part.position.set(p.x, BOARD_TOP, p.z);
    if (rot) part.rotation.y = Math.PI / 2;
    g.add(part);
  }

  // IC SOIC-8 dengan kaki "sayap camar" dan dua transistor SOT-23
  const soic = at(2.05, 1.47);
  g.add(box(4.9, 1.5, 3.9, M.black, soic.x, BOARD_TOP + 0.15, soic.z, 0.25));
  for (let i = 0; i < 4; i++) {
    for (const s of [-1, 1]) {
      g.add(box(0.42, 0.25, 1.1, M.silver, soic.x - 1.9 + i * 1.27, BOARD_TOP, soic.z + s * 2.35, 0));
      g.add(box(0.42, 0.9, 0.25, M.silver, soic.x - 1.9 + i * 1.27, BOARD_TOP, soic.z + s * 1.9, 0));
    }
  }
  for (const [x, y] of [[0.62, 0.95], [1.58, 1.52]]) {
    const q = at(x, y);
    g.add(box(2.9, 1, 1.4, M.black, q.x, BOARD_TOP + 0.1, q.z, 0.15));
    for (const dx of [-0.95, 0.95]) g.add(box(0.4, 0.3, 0.9, M.silver, q.x + dx, BOARD_TOP, q.z + 1.05, 0));
    g.add(box(0.4, 0.3, 0.9, M.silver, q.x, BOARD_TOP, q.z - 1.05, 0));
  }

  // --- LED status: L, TX, RX, ON ---
  const leds = {};
  const ledDefs = { L: [1.1, 1.45, '#ffb43a'], TX: [1.1, 1.35, '#ffd34a'], RX: [1.1, 1.25, '#ffd34a'], ON: [2.42, 1.42, '#4fe07a'] };
  for (const [name, [x, y, color]] of Object.entries(ledDefs)) {
    const p = at(x, y);
    const m = ownMat('#f4efe0', { roughness: 0.3 });
    const led = box(1.8, 0.8, 1.1, m, p.x, BOARD_TOP, p.z);
    g.add(led);
    leds[name] = { m, color };
  }

  // --- Titik acuan callout ---
  const anchors = {
    usb: anchor(g, usb.x + 2, BOARD_TOP + 10.9, usb.z),
    jack: anchor(g, jack.x + 3, BOARD_TOP + 11, jack.z),
    chip: anchor(g, chipCenter.x - 4, BOARD_TOP + 4.6, chipCenter.z),
    digital: anchor(g, at(1.6, 2).x, BOARD_TOP + HEADER_H, -2 * IN),
    power: anchor(g, at(1.4, 0.1).x, BOARD_TOP + HEADER_H, -0.1 * IN),
    analog: anchor(g, at(2.19, 0.1).x, BOARD_TOP + HEADER_H, -0.1 * IN),
    led: anchor(g, at(1.1, 1.45).x, BOARD_TOP + 0.8, -1.45 * IN),
    reset: anchor(g, rst.x, BOARD_TOP + 4.8, rst.z),
    center: anchor(g, W / 2, BOARD_TOP, -H / 2),
  };

  g.userData.anchors = anchors;
  g.userData.size = { w: W, d: H };

  // urutan bagian papan di menu Komponen
  g.userData.subparts = [dip, usbPart, jackPart, reset, headerGroups.digital, headerGroups.power, headerGroups.analog, qfn, crystalPart];
  g.userData.pin = (name) => {
    const [x, y] = PINS[name];
    return at(x, y, BOARD_TOP + HEADER_H);
  };
  g.userData.pinAnchor = (name) => {
    const p = g.userData.pin(name);
    return anchor(g, p.x, p.y, p.z);
  };
  g.userData.setLed = (name, level) => {
    const { m, color } = leds[name];
    m.color.set(level > 0 ? color : '#f4efe0');
    setEmissive(m, color, level * 2.2);
  };

  return markPart(g, { key: 'board', name: 'Arduino Uno', desc: 'Papan mikrokontroler ATmega328P.', lift: false });
}
