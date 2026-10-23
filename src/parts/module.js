import * as THREE from 'three';
import { mat, box, markPart, anchor, pinHeader, canvasTexture } from './lib.js';

/**
 * Papan modul kecil (sensor/breakout) yang berbaring di lantai, dengan label sablon
 * dan satu atau lebih deretan pin header.
 *
 * opts:
 *   w, d          ukuran PCB (mm)
 *   color         warna PCB
 *   label, sub    tulisan di permukaan
 *   headers       [{ names: ['VCC', …], x, z, axis: 'x'|'z' }]
 *   key, name, desc  info komponen (markPart)
 * Kembalikan { g, top } — `top` = tinggi permukaan PCB untuk menaruh detail tambahan.
 */
export function createModule({ w, d, color = '#1d2b4a', label = '', sub = '', headers = [], key, name, desc, labelAt = [0, 0] }) {
  const g = new THREE.Group();
  g.name = name;
  const PCB_Y = 1.5;
  const top = PCB_Y + 1.6;
  const tex = canvasTexture(Math.round(w * 20), Math.round(d * 20), (ctx, cw, ch) => {
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, cw, ch);
    ctx.fillStyle = 'rgba(240,244,252,0.92)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const cx = cw / 2 + labelAt[0] * 20;
    const cy = ch / 2 + labelAt[1] * 20;
    if (label) {
      ctx.font = `700 ${Math.min(ch * 0.2, (cw / Math.max(label.length, 4)) * 1.5)}px "Barlow Semi Condensed", sans-serif`;
      ctx.fillText(label, cx, cy - (sub ? ch * 0.08 : 0));
    }
    if (sub) {
      ctx.font = `600 ${ch * 0.1}px "Barlow Semi Condensed", sans-serif`;
      ctx.fillText(sub, cx, cy + ch * 0.12);
    }
  });
  const pcbMat = mat(color, { roughness: 0.6 });
  const pcb = new THREE.Mesh(new THREE.BoxGeometry(w, 1.6, d), [
    pcbMat, pcbMat, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 }), pcbMat, pcbMat, pcbMat,
  ]);
  pcb.position.y = PCB_Y + 0.8;
  g.add(pcb);
  for (const h of headers) pinHeader(g, h.names, { x: h.x ?? 0, y: top, z: h.z ?? 0, axis: h.axis ?? 'x' });
  g.userData.anchor = anchor(g, 0, top + 6, 0);
  markPart(g, { key, name, desc });
  return { g, top };
}

/** Kotak kecil (komponen SMD/IC) di atas modul. */
export function chip(g, x, z, top, w = 5, d = 5, h = 1.4, color = '#202024') {
  g.add(box(w, h, d, mat(color, { roughness: 0.6 }), x, top, z, 0.25));
}
