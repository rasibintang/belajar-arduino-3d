import * as THREE from 'three';
import { mat, box, canvasTexture, anchor, markPart, PITCH } from './lib.js';

// Breadboard: N kolom × (a–e, f–j), opsional 2 pasang jalur daya (atas & bawah).
// Ukuran umum: mini 17 kolom tanpa rel, half 30 kolom (400 titik), full 63 kolom (830 titik).
export const BB_TOP = 8.5;
const SLAB = 2.5; // tebal lapisan atas
const GROOVE = 2.2; // lebar parit tengah

const ROW_Z = {};
'edcba'.split('').forEach((r, i) => (ROW_Z[r] = 3.81 + i * PITCH));
'fghij'.split('').forEach((r, i) => (ROW_Z[r] = -3.81 - i * PITCH));
// jalur daya: t = belakang (atas layar), b = depan; p = +, n = −
Object.assign(ROW_Z, { tp: -20.32, tn: -22.86, bp: 20.32, bn: 22.86 });

/** Kolom lubang jalur daya: kelompok 5 dengan jeda, dari kolom 2 sampai cols − 1. */
function railCols(cols) {
  const out = [];
  for (let i = 0; ; i++) {
    const c = 2 + i + Math.floor(i / 5);
    if (c > cols - 1) return out;
    out.push(c);
  }
}

/** Semua lubang sebagai { id, row, col }, mis. { id: 'c12', row: 'c', col: 12 }. */
export function breadboardHoles({ cols = 30, rails = true } = {}) {
  const holes = [];
  for (const row of 'abcdefghij') {
    for (let col = 1; col <= cols; col++) holes.push({ id: `${row}${col}`, row, col });
  }
  if (rails) {
    for (const row of ['tp', 'tn', 'bp', 'bn']) {
      for (const col of railCols(cols)) holes.push({ id: `${row}${col}`, row, col });
    }
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

/**
 * Breadboard. Titik asal = tengah bawah.
 * userData.hole(row, col) -> posisi lokal permukaan lubang.
 *   row: 'a'..'j', atau 'tp','tn' (jalur belakang + / −), 'bp','bn' (jalur depan + / −)
 */
export function createBreadboard({ cols = 30, rails = true } = {}) {
  const W = cols * PITCH + 6.3;
  const D = rails ? 54.5 : 34;
  const colX = (c) => (c - (cols + 1) / 2) * PITCH;
  const rc = rails ? railCols(cols) : [];

  function drawSlab(ctx, w, h, S, zMin) {
    const px = (x) => (x + W / 2) * S;
    const pz = (z) => (z - zMin) * S;
    ctx.fillStyle = '#f3efe5';
    ctx.fillRect(0, 0, w, h);

    if (rails) {
      const line = (z, color) => {
        ctx.fillStyle = color;
        ctx.fillRect(px(colX(1)), pz(z) - 0.2 * S, (colX(cols) - colX(1)) * S, 0.4 * S);
      };
      line(-17.9, '#d8473f');
      line(-25.3, '#3b6fd1');
      line(17.9, '#d8473f');
      line(25.3, '#3b6fd1');
    }

    const hole = (x, z) => {
      const s = 1.15 * S;
      ctx.fillStyle = '#d9d2c3';
      ctx.fillRect(px(x) - s / 2 - 0.25 * S, pz(z) - s / 2 - 0.25 * S, s + 0.5 * S, s + 0.5 * S);
      ctx.fillStyle = '#3a342e';
      ctx.fillRect(px(x) - s / 2, pz(z) - s / 2, s, s);
    };
    for (const [row, z] of Object.entries(ROW_Z)) {
      const list = row.length === 2 ? rc : Array.from({ length: cols }, (_, i) => i + 1);
      for (const c of list) hole(colX(c), z);
    }

    ctx.fillStyle = '#9b9283';
    ctx.font = `600 ${1.5 * S}px "Barlow Semi Condensed", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const r of 'abcdefghij') {
      ctx.fillText(r, px(colX(0)), pz(ROW_Z[r]));
      ctx.fillText(r, px(colX(cols + 1)), pz(ROW_Z[r]));
    }
    for (let c = 1; c <= cols; c++) {
      if (c !== 1 && c % 5) continue;
      ctx.fillText(String(c), px(colX(c)), pz(ROW_Z.j - 2.3));
      ctx.fillText(String(c), px(colX(c)), pz(ROW_Z.a + 2.3));
    }
    if (rails) {
      ctx.font = `700 ${1.9 * S}px "Barlow Semi Condensed", sans-serif`;
      ctx.fillStyle = '#d8473f';
      ctx.fillText('+', px(colX(0)), pz(-17.9));
      ctx.fillText('+', px(colX(0)), pz(17.9));
      ctx.fillStyle = '#3b6fd1';
      ctx.fillText('−', px(colX(0)), pz(-25.3));
      ctx.fillText('−', px(colX(0)), pz(25.3));
    }
  }

  const g = new THREE.Group();
  g.name = 'Breadboard';
  const body = mat('#efe9dc', { roughness: 0.85 });
  g.add(box(W, BB_TOP - SLAB, D, body));
  const slabD = D / 2 - GROOVE / 2;
  const S = cols > 40 ? 12 : 16; // piksel/mm (dikurangi untuk papan panjang)
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
  g.add(box(W - 0.4, 0.05, GROOVE, mat('#d8cfbd'), 0, BB_TOP - SLAB, 0)); // dasar parit

  g.userData.hole = (row, col) => new THREE.Vector3(colX(col), BB_TOP, ROW_Z[row]);
  g.userData.holes = breadboardHoles({ cols, rails });
  g.userData.anchors = { center: anchor(g, 0, BB_TOP, 0) };
  g.userData.size = { w: W, d: D };
  return markPart(g, {
    key: 'breadboard',
    name: 'Breadboard',
    desc: 'Papan rangkaian tanpa solder. Lima lubang satu kolom (a–e) saling tersambung.',
    lift: false,
  });
}
