import * as THREE from 'three';
import { M, mat, ownMat, box, cyl, bentRod, anchor, markPart, pinHeader, canvasTexture, roundedBox, setEmissive, PITCH } from './lib.js';
import { createModule, chip } from './module.js';

/** Simbol daya: satu pin yang selalu 5 V (VCC) atau 0 V (GND). */
export function createPowerSymbol(kind) {
  const g = new THREE.Group();
  const vcc = kind === 'VCC';
  g.name = vcc ? 'VCC' : 'GND';
  const color = vcc ? '#d9473c' : '#2b2d33';
  g.add(cyl(3.5, 1.6, mat(color, { roughness: 0.5 }), 0, 1.5, 0, 24));
  const tex = canvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#fff';
    ctx.font = '700 40px "Barlow Semi Condensed", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(vcc ? '5V' : 'GND', w / 2, h / 2);
  });
  const label = new THREE.Mesh(new THREE.CircleGeometry(3.4, 24), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 }));
  label.rotation.x = -Math.PI / 2;
  label.position.y = 3.12;
  g.add(label);
  pinHeader(g, [vcc ? 'VCC' : 'GND'], { x: 0, y: 3.1, z: 5.5 });
  g.userData.anchor = anchor(g, 0, 5, 0);
  return markPart(g, { key: 'power', name: vcc ? 'Simbol VCC (5 V)' : 'Simbol GND (0 V)', desc: 'Sumber tegangan ideal untuk menyederhanakan kabel.' });
}

/** Tulisan bebas di meja (tanpa pin). userData.setText(teks) */
export function createTextLabel() {
  const g = new THREE.Group();
  g.name = 'Teks';
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(80, 10), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
  plane.rotation.x = -Math.PI / 2;
  plane.position.y = 0.3;
  g.add(plane);
  // alas tipis transparen agar bisa diklik/diseret
  const hit = box(80, 0.2, 10, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 }), 0, 0, 0, 0);
  g.add(hit);
  g.userData.setText = (text) => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#1d2740';
    ctx.font = '700 84px "Barlow Semi Condensed", sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillText(text || ' ', 8, canvas.height / 2);
    tex.needsUpdate = true;
  };
  g.userData.anchor = anchor(g, 0, 2, 0);
  return markPart(g, { key: 'text', name: 'Teks', desc: 'Catatan di meja kerja.' });
}

/** Titik sambung: satu pin untuk mencabangkan kabel. */
export function createJunction() {
  const g = new THREE.Group();
  g.name = 'Junction';
  g.add(cyl(2.4, 1.2, M.black, 0, 0, 0, 20));
  pinHeader(g, ['J'], { x: 0, y: 1.2, z: 0 });
  g.userData.anchor = anchor(g, 0, 10, 0);
  return markPart(g, { key: 'junction', name: 'Junction', desc: 'Titik pertemuan beberapa kabel.' });
}

/** Relay DPDT (kumparan + 2 set kontak), mengangkangi parit breadboard. */
export function createRelayDPDT() {
  const g = new THREE.Group();
  g.name = 'Relay DPDT';
  const tex = canvasTexture(300, 160, (ctx, w, h) => {
    ctx.fillStyle = '#2f3a52';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#e6ebf5';
    ctx.textAlign = 'center';
    ctx.font = '700 32px "Barlow Semi Condensed", sans-serif';
    ctx.fillText('DPDT 5V', w / 2, 62);
    ctx.font = '600 22px "Barlow Semi Condensed", sans-serif';
    ctx.fillText('2A 30VDC', w / 2, 104);
  });
  const blue = mat('#2f3a52', { roughness: 0.45 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(20, 10, 10), [blue, blue, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.45 }), blue, blue, blue]);
  body.position.y = 1 + 5;
  g.add(body);
  for (let i = 0; i < 4; i++) {
    const x = (i - 1.5) * PITCH;
    for (const s of [-1, 1]) g.add(bentRod([[x, 1.5, s * 4.6], [x, 0.4, s * 3.81], [x, -1.5, s * 3.81]], 0.28, M.silver));
  }
  let on = false;
  let shake = 0;
  g.userData.setOn = (v) => {
    if (v !== on) shake = 1;
    on = v;
  };
  g.userData.tick = (dt) => {
    shake = Math.max(0, shake - dt * 8);
    body.position.y = 6 + Math.sin(shake * 20) * shake * 0.3;
  };
  g.userData.anchor = anchor(g, 0, 11.5, 0);
  return markPart(g, { key: 'dpdt', name: 'Relay DPDT', desc: 'Dua saklar yang berpindah bersamaan saat kumparan aktif.' });
}

/** Breakout multiplexer analog 16 kanal CD74HC4067. */
export const MUX_CTRL = ['SIG', 'S3', 'S2', 'S1', 'S0', 'EN', 'VCC', 'GND'];
export const MUX_CH = Array.from({ length: 16 }, (_, i) => `C${i}`);
export function createMux16() {
  const { g, top } = createModule({
    w: 26,
    d: 44,
    color: '#1d2b4a',
    label: '74HC4067',
    sub: '16-CH MUX',
    headers: [
      { names: MUX_CTRL, x: -11, z: 0, axis: 'z' },
      { names: MUX_CH, x: 11, z: 0, axis: 'z' },
    ],
    key: 'mux16',
    name: 'Multiplexer 16 kanal',
    desc: 'Satu pin SIG tersambung ke salah satu dari 16 kanal sesuai S0–S3.',
  });
  chip(g, 0, 0, top, 8, 14, 1.4);
  return g;
}

/** Modul driver stepper A4988 (2×8 pin), mengangkangi parit breadboard. */
export const A4988_FRONT = ['ENABLE', 'MS1', 'MS2', 'MS3', 'RESET', 'SLEEP', 'STEP', 'DIR'];
export const A4988_BACK = ['VMOT', 'GND', '2B', '2A', '1A', '1B', 'VDD', 'GND2'];
export function createA4988() {
  const g = new THREE.Group();
  g.name = 'A4988';
  const w = 8 * PITCH;
  g.add(box(w + 0.6, 1.6, 15, mat('#2f8a46', { roughness: 0.6 }), 0, 9, 0, 0.3));
  g.add(box(w, 2.5, PITCH, M.black, 0, 6.5, 3.81));
  g.add(box(w, 2.5, PITCH, M.black, 0, 6.5, -3.81));
  for (let i = 0; i < 8; i++) {
    const x = (i - 3.5) * PITCH;
    for (const z of [-3.81, 3.81]) g.add(box(0.64, 11.5, 0.64, M.gold, x, -1.5, z, 0));
  }
  // pendingin
  const sink = mat('#8d929a', { metalness: 0.6, roughness: 0.35 });
  g.add(box(9, 1.5, 9, sink, 0, 10.6, 0, 0.2));
  for (let i = 0; i < 4; i++) g.add(box(1, 5, 9, sink, -3.4 + i * 2.26, 12.1, 0, 0));
  g.add(cyl(1.4, 1, mat('#c9ccd2', { metalness: 0.6 }), 7, 10.6, 4, 16)); // trimpot arus
  g.userData.anchor = anchor(g, 0, 17.5, 0);
  return markPart(g, { key: 'a4988', name: 'Driver stepper A4988', desc: 'Satu pulsa STEP = satu langkah; DIR menentukan arah.' });
}

/** Motor stepper bipolar NEMA 17, dengan satu (atau dua, biaxial) jarum penunjuk. */
export function createNema17({ biaxial = false } = {}) {
  const g = new THREE.Group();
  g.name = biaxial ? 'Stepper biaxial' : 'Stepper NEMA 17';
  const black = mat('#26272b', { roughness: 0.5 });
  const metal = mat('#c9ccd2', { metalness: 0.65, roughness: 0.35 });
  g.add(roundedBox(42, 34, 42, 3, black));
  g.add(box(42.2, 4, 42.2, metal, 0, 0, 0, 2));
  g.add(box(42.2, 4, 42.2, metal, 0, 30, 0, 2));
  g.add(cyl(11, 2, metal, 0, 34, 0, 36));
  g.add(cyl(2.5, 10, mat('#d5d8dc', { metalness: 0.8, roughness: 0.25 }), 0, 36, 0, 16));
  const arm = (len, color, y) => {
    const a = new THREE.Group();
    a.position.y = y;
    const r = roundedBox(len, 2, 5, 2.4, mat(color, { roughness: 0.6 }));
    r.position.x = len / 2 - 3;
    a.add(r);
    a.add(cyl(3.5, 2, mat(color), 0, 0, 0, 20));
    g.add(a);
    return a;
  };
  const arms = [arm(28, '#f3f1ea', 44)];
  if (biaxial) arms.push(arm(18, '#e0533f', 46.5));
  // konektor kabel di sisi
  const names = biaxial ? ['A1-', 'A1+', 'B1+', 'B1-', 'A2-', 'A2+', 'B2+', 'B2-'] : ['A-', 'A+', 'B+', 'B-'];
  g.add(box(names.length * PITCH + 2, 6, 6, mat('#f1eee6'), 0, 3, 25, 0.5));
  pinHeader(g, names, { x: 0, y: 9, z: 25 });
  g.userData.setAngle = (deg, i = 0) => {
    if (arms[i]) arms[i].rotation.y = (-deg * Math.PI) / 180;
  };
  g.userData.anchor = anchor(g, 0, 48, 0);
  return markPart(g, {
    key: 'nema17',
    name: g.name,
    desc: biaxial ? 'Dua motor sesumbu (jarum luar & dalam), 200 langkah per putaran.' : '200 langkah per putaran (1,8° per langkah).',
  });
}

/** Lampu kecil pada modul (dipakai bersama). */
export function statusLed(g, x, y, z) {
  const m = ownMat('#f2d6cf', { roughness: 0.3 });
  g.add(box(1.8, 0.9, 1.2, m, x, y, z));
  return (on, color = '#ff3b2f') => {
    setEmissive(m, color, on ? 2.4 : 0);
    m.color.set(on ? color : '#f2d6cf');
  };
}
