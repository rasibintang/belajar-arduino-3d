import * as THREE from 'three';
import { mat, ownMat, cyl, anchor, markPart, pinHeader, canvasTexture, setEmissive, PITCH } from './lib.js';

/** Gambar simbol gerbang logika (gaya ANSI) ke canvas. */
function drawGate(ctx, w, h, type) {
  ctx.fillStyle = '#f4efe2';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = '#1d2740';
  ctx.lineWidth = 7;
  ctx.lineJoin = 'round';
  const x0 = w * 0.3;
  const x1 = w * 0.62;
  const y0 = h * 0.22;
  const y1 = h * 0.78;
  const ym = h / 2;
  const base = type === 'XNOR' ? 'XOR' : type === 'NOT' ? 'NOT' : type.replace(/^N/, '');
  const invert = type === 'NOT' || type === 'XNOR' || type === 'NAND' || type === 'NOR';
  ctx.beginPath();
  if (base === 'NOT') {
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, ym);
    ctx.lineTo(x0, y1);
    ctx.closePath();
  } else if (base === 'AND') {
    const r = (y1 - y0) / 2;
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1 - r, y0);
    ctx.arc(x1 - r, ym, r, -Math.PI / 2, Math.PI / 2);
    ctx.lineTo(x0, y1);
    ctx.closePath();
  } else {
    ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo(x0 + (x1 - x0) * 0.6, y0, x1 + w * 0.06, ym);
    ctx.quadraticCurveTo(x0 + (x1 - x0) * 0.6, y1, x0, y1);
    ctx.quadraticCurveTo(x0 + w * 0.09, ym, x0, y0);
    if (base === 'XOR') {
      ctx.moveTo(x0 - w * 0.05, y0);
      ctx.quadraticCurveTo(x0 + w * 0.04, ym, x0 - w * 0.05, y1);
    }
  }
  ctx.stroke();
  const tip = base === 'NOT' || base === 'AND' ? x1 : x1 + w * 0.06;
  if (invert) {
    ctx.beginPath();
    ctx.arc(tip + 9, ym, 8, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.beginPath(); // kaki masuk & keluar
  if (base === 'NOT') {
    ctx.moveTo(0, ym);
    ctx.lineTo(x0, ym);
  } else {
    ctx.moveTo(0, h * 0.35);
    ctx.lineTo(x0 + 8, h * 0.35);
    ctx.moveTo(0, h * 0.65);
    ctx.lineTo(x0 + 8, h * 0.65);
  }
  ctx.moveTo(tip + (invert ? 17 : 0), ym);
  ctx.lineTo(w, ym);
  ctx.stroke();
  ctx.fillStyle = '#1d2740';
  ctx.font = '700 30px "Barlow Semi Condensed", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(type, w / 2, h - 10);
}

/** Papan kecil dengan gambar + pin header di kiri (masukan) dan kanan (keluaran). */
function logicBoard({ type, inputs, outputs, draw, key, name, desc, w = 22, d = 16 }) {
  const g = new THREE.Group();
  g.name = name;
  const tex = canvasTexture(w * 12, d * 12, (ctx, cw, ch) => draw(ctx, cw, ch, type));
  const base = mat('#e7dfcd', { roughness: 0.6 });
  const pcb = new THREE.Mesh(new THREE.BoxGeometry(w, 1.6, d), [base, base, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 }), base, base, base]);
  pcb.position.y = 2.3;
  g.add(pcb);
  const top = 3.1;
  if (inputs.length) pinHeader(g, inputs, { x: -w / 2 - 1.5, y: top - 1.6, z: 0, axis: 'z' });
  if (outputs.length) pinHeader(g, outputs, { x: w / 2 + 1.5, y: top - 1.6, z: 0, axis: 'z' });
  // lampu kecil yang menunjukkan keluaran
  const led = ownMat('#e9e2d2', { roughness: 0.3 });
  g.add(cyl(1, 0.6, led, w / 2 - 3, top, -d / 2 + 3, 12));
  g.userData.setOut = (on) => {
    led.color.set(on ? '#3fe07a' : '#e9e2d2');
    setEmissive(led, '#3fe07a', on ? 2 : 0);
  };
  g.userData.anchor = anchor(g, 0, top + 2, 0);
  return markPart(g, { key, name, desc });
}

export const GATE_DESC = {
  NOT: 'Y = kebalikan A',
  AND: 'Y = 1 jika A dan B sama-sama 1',
  OR: 'Y = 1 jika A atau B bernilai 1',
  XOR: 'Y = 1 jika A dan B berbeda',
  NAND: 'Kebalikan AND',
  NOR: 'Kebalikan OR',
  XNOR: 'Y = 1 jika A dan B sama',
};

export function createGate(type) {
  return logicBoard({
    type,
    inputs: type === 'NOT' ? ['A'] : ['A', 'B'],
    outputs: ['Y'],
    draw: drawGate,
    key: `gate-${type}`,
    name: `Gerbang ${type}`,
    desc: GATE_DESC[type],
  });
}

function drawBlock(ctx, w, h, title, left, right) {
  ctx.fillStyle = '#f4efe2';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = '#1d2740';
  ctx.lineWidth = 6;
  ctx.strokeRect(w * 0.22, h * 0.1, w * 0.56, h * 0.8);
  ctx.fillStyle = '#1d2740';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.font = '700 28px "Barlow Semi Condensed", sans-serif';
  ctx.fillText(title, w / 2, h / 2);
  ctx.font = '600 18px "IBM Plex Mono", monospace';
  const pitch = h / (Math.max(left.length, right.length, 1) + 1);
  left.forEach((t, i) => {
    ctx.textAlign = 'left';
    ctx.fillText(t, w * 0.24, pitch * (i + 1));
  });
  right.forEach((t, i) => {
    ctx.textAlign = 'right';
    ctx.fillText(t, w * 0.76, pitch * (i + 1));
  });
}

/** Blok logika berlabel (flip-flop, MUX, generator clock). */
export function createBlock({ title, inputs, outputs, key, name, desc }) {
  const rows = Math.max(inputs.length, outputs.length, 1);
  const labels = (list) => list.map((p) => (p === 'NOTQ' ? 'Q̅' : p));
  return logicBoard({
    type: title,
    inputs,
    outputs,
    draw: (ctx, w, h) => drawBlock(ctx, w, h, title, labels(inputs), labels(outputs)),
    key,
    name,
    desc,
    w: 26,
    d: Math.max(16, rows * PITCH + 6),
  });
}
