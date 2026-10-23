import { tr } from '../i18n/parts.js';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// Satuan seluruh scene: 1 unit = 1 mm. Lantai berada di y = 0.
export const PITCH = 2.54; // jarak antar lubang breadboard / pin header

const matCache = new Map();

/** Material standar yang di-cache (dipakai bersama). Jangan diubah warnanya! */
export function mat(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (!matCache.has(key)) {
    matCache.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0, ...opts }));
  }
  return matCache.get(key);
}

/** Material baru (tidak di-cache) — untuk bagian yang warnanya berubah, mis. lampu. */
export function ownMat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0, ...opts });
}

export const M = {
  get leg() { return mat('#b9bcc2', { metalness: 0.85, roughness: 0.35 }); },
  get gold() { return mat('#d4b25a', { metalness: 0.8, roughness: 0.35 }); },
  get silver() { return mat('#d5d8dc', { metalness: 0.75, roughness: 0.3 }); },
  get black() { return mat('#2a2a2e', { roughness: 0.65 }); },
  get dark() { return mat('#141416', { roughness: 0.8 }); },
  get white() { return mat('#f1eee6', { roughness: 0.7 }); },
};

const boxCache = new Map();

/**
 * Geometri kotak dengan sudut sedikit tumpul (bevel) — tepi menangkap kilau cahaya
 * sehingga terlihat lebih halus. Kotak yang sangat tipis tetap tajam.
 * Geometri di-cache per ukuran agar hemat memori.
 */
export function boxGeometry(w, h, d, radius) {
  const r = radius ?? Math.min(0.45, Math.min(w, h, d) * 0.16);
  const key = `${w}|${h}|${d}|${r}`;
  if (!boxCache.has(key)) {
    boxCache.set(key, r >= 0.12 ? new RoundedBoxGeometry(w, h, d, 2, r) : new THREE.BoxGeometry(w, h, d));
  }
  return boxCache.get(key);
}

/** Kotak; (x, y, z) = titik tengah bawah. radius 0 = sudut tajam. */
export function box(w, h, d, material, x = 0, y = 0, z = 0, radius) {
  const m = new THREE.Mesh(boxGeometry(w, h, d, radius), material);
  m.position.set(x, y + h / 2, z);
  return m;
}

/** Silinder tegak; (x, y, z) = titik tengah bawah. */
export function cyl(r, h, material, x = 0, y = 0, z = 0, segments = 40, rTop = r) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, r, h, segments), material);
  m.position.set(x, y + h / 2, z);
  return m;
}

/**
 * Header pin jantan tegak pada sebuah modul. Posisi tiap pin (tempat konektor
 * kabel jumper duduk) disimpan di group.userData.pins[nama].
 * axis: arah deretan pin ('x' atau 'z'); (x, y, z) = tengah dasar header.
 */
export function pinHeader(group, names, { x = 0, y = 0, z = 0, axis = 'x' } = {}) {
  const pins = group.userData.pins ?? (group.userData.pins = {});
  const n = names.length;
  const len = n * PITCH;
  group.add(axis === 'x' ? box(len, 2.5, PITCH, M.black, x, y, z) : box(PITCH, 2.5, len, M.black, x, y, z));
  names.forEach((name, i) => {
    const off = (i - (n - 1) / 2) * PITCH;
    const px = axis === 'x' ? x + off : x;
    const pz = axis === 'x' ? z : z + off;
    group.add(box(0.64, 8.5, 0.64, M.gold, px, y, pz, 0));
    pins[name] = new THREE.Vector3(px, y + 2.5, pz);
  });
  return pins;
}

/** Label kecil di atas permukaan (tekstur teks pada bidang datar). */
export function labelPlane(text, w, h, { color = '#eef2fb', bg = null, font = 600, size = 0.62 } = {}) {
  const tex = canvasTexture(Math.round(w * 40), Math.round(h * 40), (ctx, cw, ch) => {
    if (bg) {
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, cw, ch);
    }
    ctx.fillStyle = color;
    ctx.font = `${font} ${ch * size}px "Barlow Semi Condensed", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, cw / 2, ch / 2);
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, transparent: !bg, roughness: 0.7 }));
  m.rotation.x = -Math.PI / 2;
  return m;
}

/** Batang lurus (kaki komponen) dari titik a ke titik b. */
export function rod(a, b, radius = 0.25, material = M.leg) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, dir.length(), 8), material);
  m.position.copy(a).addScaledVector(dir, 0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  return m;
}

/** Kaki/kawat yang ditekuk melewati beberapa titik (sudut sedikit dibulatkan). */
export function bentRod(points, radius = 0.25, material = M.leg) {
  const path = new THREE.CurvePath();
  const pts = points.map((p) => (p.isVector3 ? p : new THREE.Vector3(...p)));
  for (let i = 0; i < pts.length - 1; i++) path.add(new THREE.LineCurve3(pts[i], pts[i + 1]));
  return new THREE.Mesh(new THREE.TubeGeometry(path, pts.length * 12, radius, 8), material);
}

/** Tekstur dari canvas 2D. draw(ctx, w, h) menggambar isinya. */
export function canvasTexture(width, height, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  draw(canvas.getContext('2d'), width, height);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 16;
  return tex;
}

/** Penanda titik (untuk ujung garis callout / tooltip). */
export function anchor(parent, x, y, z) {
  const a = new THREE.Object3D();
  a.position.set(x, y, z);
  parent.add(a);
  return a;
}

/**
 * Menandai group sebagai "komponen" yang bisa di-hover/diklik.
 * info: { key, name, desc }
 */
export function markPart(group, info) {
  // nama & keterangan ditulis dalam bahasa Indonesia; tr() menerjemahkan bila perlu
  group.userData.part = { ...info, name: tr(info.name), desc: tr(info.desc) };
  return group;
}

/**
 * Menaruh komponen berkaki di antara dua titik lubang (world).
 * Kaki komponen harus berjajar di sumbu X lokal, berpusat di x = 0.
 */
export function mountBetween(obj, a, b) {
  obj.position.set((a.x + b.x) / 2, a.y, (a.z + b.z) / 2);
  obj.rotation.y = -Math.atan2(b.z - a.z, b.x - a.x);
  return obj;
}

/** Objek yang tidak ikut digaris-tepi & tidak bisa diklik (cahaya, bayangan palsu, dll.) */
export function noOutline(obj) {
  obj.traverse((o) => o.layers.set(1));
  return obj;
}

/** Bentuk kotak dengan sudut membulat untuk ExtrudeGeometry. */
export function roundedRectShape(w, h, r) {
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

/** Kotak membulat (tinggi ke atas dari y = 0). */
export function roundedBox(w, h, d, r, material) {
  const geo = new THREE.ExtrudeGeometry(roundedRectShape(w, d, r), {
    depth: h,
    bevelEnabled: false,
    curveSegments: 6,
  });
  geo.rotateX(-Math.PI / 2);
  return new THREE.Mesh(geo, material);
}

let glowTex = null;
function glowTexture() {
  if (!glowTex) {
    glowTex = canvasTexture(128, 128, (ctx, w, h) => {
      const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.25, 'rgba(255,255,255,0.55)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    });
  }
  return glowTex;
}

/** Cahaya berpendar (sprite) — set .material.opacity untuk terang/redup. */
export function glowSprite(color, size) {
  const s = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTexture(),
      color,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  );
  s.scale.set(size, size, 1);
  return noOutline(s);
}

/** Lingkaran cahaya datar di permukaan (mis. sorot lampu di breadboard). */
export function glowPool(color, size) {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(size, size),
    new THREE.MeshBasicMaterial({
      map: glowTexture(),
      color,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  );
  m.rotation.x = -Math.PI / 2;
  return noOutline(m);
}

export function setEmissive(material, color, intensity) {
  material.emissive.set(intensity > 0 ? color : '#000000');
  material.emissiveIntensity = intensity;
}
