import * as THREE from 'three';
import { box, mat, anchor, PITCH } from './lib.js';

export const WIRE_COLORS = {
  red: '#e0473c',
  black: '#2b2d3a',
  orange: '#f0a33a',
  yellow: '#f2cf3a',
  green: '#3caa5a',
  blue: '#3f7be0',
  purple: '#8a55d6',
  white: '#ecebe6',
  brown: '#8a5a3a',
};

const HOUSING = 12;

function darker(hex, k = 0.72) {
  return '#' + new THREE.Color(hex).multiplyScalar(k).getHexString();
}

/**
 * Kabel jumper dari titik a ke titik b (koordinat dunia, permukaan lubang/pin).
 * opts.lift  : tambahan tinggi lengkungan (supaya kabel tidak saling tembus)
 * opts.sag   : geser titik kontrol ke samping (x,z) supaya lengkungan bervariasi
 */
export function createWire(a, b, color = 'red', opts = {}) {
  const hex = WIRE_COLORS[color] ?? color;
  const g = new THREE.Group();
  g.name = 'Kabel';

  const housingMat = mat(darker(hex));
  const tipMat = mat('#c9ccd2', { metalness: 0.8, roughness: 0.35 });
  // opts.bare: kabel biasa tanpa konektor (mis. kabel listrik/motor) — ujungnya hanya timah kecil
  const housing = opts.bare ? 0 : HOUSING;
  // tiap ujung = satu grup berpusat di lubang, supaya bisa "muncul" (diskalakan) saat animasi
  const ends = [a, b].map((p) => {
    const end = new THREE.Group();
    end.position.copy(p);
    if (opts.bare) end.add(box(1.6, 1.4, 1.6, tipMat, 0, -0.2, 0));
    else {
      end.add(box(PITCH, HOUSING, PITCH, housingMat, 0, 0.6, 0));
      end.add(box(0.7, 1.2, 0.7, tipMat, 0, -0.6, 0));
    }
    g.add(end);
    return end;
  });

  const up = new THREE.Vector3(0, 1, 0);
  const p0 = a.clone().addScaledVector(up, housing + 0.6);
  const p3 = b.clone().addScaledVector(up, housing + 0.6);
  const dist = p0.distanceTo(p3);
  const h = Math.min(45, 8 + dist * 0.24) + (opts.lift ?? 0);
  const side = new THREE.Vector3(...(opts.sag ?? [0, 0, 0]));
  const p1 = p0.clone().addScaledVector(up, h).add(side);
  const p2 = p3.clone().addScaledVector(up, h).add(side);
  const curve = new THREE.CubicBezierCurve3(p0, p1, p2, p3);

  const RADIAL = 16;
  const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 80, opts.radius ?? 1.25, RADIAL), mat(hex, { roughness: 0.55 }));
  g.add(tube);
  // data untuk animasi "kabel tergambar" (setDrawRange per ruas tabung)
  g.userData.wire = { tube, ends, count: tube.geometry.index.count, step: RADIAL * 6 };

  const mid = curve.getPoint(0.5);
  g.userData.anchors = {
    start: anchor(g, a.x, a.y + HOUSING, a.z),
    end: anchor(g, b.x, b.y + HOUSING, b.z),
    mid: anchor(g, mid.x, mid.y, mid.z),
  };
  return g;
}
