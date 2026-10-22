import * as THREE from 'three';
import { mat, box, canvasTexture, anchor, markPart, PITCH } from './lib.js';

// Breadboard 400 titik: 30 kolom × (a–e, f–j) + 2 pasang jalur daya.
const COLS = 30;
const W = 82.5;
const D = 54.5;
export const BB_TOP = 8.5;
const SLAB = 2.5; // tebal lapisan atas
const GROOVE = 2.2; // lebar parit tengah

const ROW_Z = {};
'edcba'.split('').forEach((r, i) => (ROW_Z[r] = 3.81 + i * PITCH));
'fghij'.split('').forEach((r, i) => (ROW_Z[r] = -3.81 - i * PITCH));
// jalur daya: t = belakang (atas layar), b = depan; p = +, n = −
Object.assign(ROW_Z, { tp: -20.32, tn: -22.86, bp: 20.32, bn: 22.86 });

const colX = (c) => (c - (COLS + 1) / 2) * PITCH;

// Lubang jalur daya: kelompok 5 dengan jeda
const RAIL_COLS = Array.from({ length: 25 }, (_, i) => 2 + i + Math.floor(i / 5));

/** Semua lubang breadboard sebagai { id, row, col }, mis. { id: 'c12', row: 'c', col: 12 }. */
export function breadboardHoles() {
  const holes = [];
  for (const row of 'abcdefghij') {
    for (let col = 1; col <= COLS; col++) holes.push({ id: `${row}${col}`, row, col });
  }
  for (const row of ['tp', 'tn', 'bp', 'bn']) {
    for (const col of RAIL_COLS) holes.push({ id: `${row}${col}`, row, col });
  }
  return holes;
}

/**
 * Jalur tembaga di dalam breadboard: lubang dengan jalur yang sama saling tersambung.
 * a–e satu kolom = satu jalur; f–j satu kolom = satu jalur; tiap rel daya = satu jalur panjang.
 */
export function breadboardStrip(row, col) {
  if (row.length === 2) return `rail-${row}`;
  return 'abcde'.includes(row) ? `col${col}-front` : `col${col}-back`;
}

function drawSlab(ctx, w, h, S, zMin) {
  const px = (x) => (x + W / 2) * S;
  const pz = (z) => (z - zMin) * S;

  ctx.fillStyle = '#f3efe5';
  ctx.fillRect(0, 0, w, h);

  // Garis merah/biru jalur daya
  const line = (z, color) => {
    ctx.fillStyle = color;
    ctx.fillRect(px(colX(1)), pz(z) - 0.2 * S, (colX(COLS) - colX(1)) * S, 0.4 * S);
  };
  line(-17.9, '#d8473f');
  line(-25.3, '#3b6fd1');
  line(17.9, '#d8473f');
  line(25.3, '#3b6fd1');

  const hole = (x, z) => {
    const s = 1.15 * S;
    ctx.fillStyle = '#d9d2c3';
    ctx.fillRect(px(x) - s / 2 - 0.25 * S, pz(z) - s / 2 - 0.25 * S, s + 0.5 * S, s + 0.5 * S);
    ctx.fillStyle = '#3a342e';
    ctx.fillRect(px(x) - s / 2, pz(z) - s / 2, s, s);
  };
  for (const [row, z] of Object.entries(ROW_Z)) {
    const cols = row.length === 2 ? RAIL_COLS : Array.from({ length: COLS }, (_, i) => i + 1);
    for (const c of cols) hole(colX(c), z);
  }

  ctx.fillStyle = '#9b9283';
  ctx.font = `600 ${1.5 * S}px "Barlow Semi Condensed", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const r of 'abcdefghij') {
    ctx.fillText(r, px(colX(0)), pz(ROW_Z[r]));
    ctx.fillText(r, px(colX(COLS + 1)), pz(ROW_Z[r]));
  }
  for (const c of [1, 5, 10, 15, 20, 25, 30]) {
    ctx.fillText(String(c), px(colX(c)), pz(ROW_Z.j - 2.3));
    ctx.fillText(String(c), px(colX(c)), pz(ROW_Z.a + 2.3));
  }
  ctx.font = `700 ${1.9 * S}px "Barlow Semi Condensed", sans-serif`;
  ctx.fillStyle = '#d8473f';
  ctx.fillText('+', px(colX(0)), pz(-17.9));
  ctx.fillText('+', px(colX(0)), pz(17.9));
  ctx.fillStyle = '#3b6fd1';
  ctx.fillText('−', px(colX(0)), pz(-25.3));
  ctx.fillText('−', px(colX(0)), pz(25.3));
}

/**
 * Breadboard. Titik asal = tengah bawah.
 * userData.hole(row, col) -> posisi lokal permukaan lubang.
 *   row: 'a'..'j', atau 'tp','tn' (jalur belakang + / −), 'bp','bn' (jalur depan + / −)
 */
export function createBreadboard() {
  const g = new THREE.Group();
  g.name = 'Breadboard';
  const body = mat('#efe9dc', { roughness: 0.85 });

  g.add(box(W, BB_TOP - SLAB, D, body));
  const slabD = D / 2 - GROOVE / 2;
  const S = 16;
  for (const side of [-1, 1]) {
    const zMid = side * (GROOVE / 2 + slabD / 2);
    g.add(box(W, SLAB, slabD, body, 0, BB_TOP - SLAB, zMid));

    const zMin = zMid - slabD / 2;
    const tex = canvasTexture(Math.round(W * S), Math.round(slabD * S), (ctx, w, h) => drawSlab(ctx, w, h, S, zMin));
    const top = new THREE.Mesh(new THREE.PlaneGeometry(W, slabD), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 }));
    top.rotation.x = -Math.PI / 2;
    top.position.set(0, BB_TOP + 0.01, zMid);
    g.add(top);
  }
  // dasar parit sedikit lebih gelap
  g.add(box(W - 0.4, 0.05, GROOVE, mat('#d8cfbd'), 0, BB_TOP - SLAB, 0));

  g.userData.hole = (row, col) => new THREE.Vector3(colX(col), BB_TOP, ROW_Z[row]);
  g.userData.anchors = { center: anchor(g, 0, BB_TOP, 0) };
  g.userData.size = { w: W, d: D };
  return markPart(g, {
    key: 'breadboard',
    name: 'Breadboard',
    desc: 'Papan rangkaian tanpa solder. Lima lubang satu kolom (a–e) saling tersambung.',
    lift: false,
  });
}
