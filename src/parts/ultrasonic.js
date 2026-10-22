import * as THREE from 'three';
import { M, mat, box, boxGeometry, cyl, bentRod, anchor, markPart, canvasTexture, noOutline, PITCH } from './lib.js';

let pcbTex = null;
function pcbTexture() {
  if (pcbTex) return pcbTex;
  pcbTex = canvasTexture(450, 200, (ctx, w, h) => {
    ctx.fillStyle = '#2d5fae';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#eef2fb';
    ctx.textAlign = 'center';
    ctx.font = '700 22px "Barlow Semi Condensed", sans-serif';
    ctx.fillText('HC-SR04', w / 2, 34);
    ctx.font = '600 15px "Barlow Semi Condensed", sans-serif';
    ['VCC', 'Trig', 'Echo', 'Gnd'].forEach((t, i) => ctx.fillText(t, w / 2 + (i - 1.5) * 25.4, h - 16));
    ctx.fillText('T', 95, 34);
    ctx.fillText('R', w - 95, 34);
  });
  return pcbTex;
}

/**
 * Sensor jarak ultrasonik HC-SR04, berdiri tegak.
 * Transduser menghadap +z. Empat pin (VCC, Trig, Echo, GND) di x = -3,81 .. +3,81.
 * userData.setPing(t)  — t 0..1 animasi gelombang, atau -1 untuk mati
 */
export function createUltrasonic() {
  const g = new THREE.Group();
  g.name = 'HC-SR04';
  const W = 45;
  const H = 20;
  const Y0 = 3.5;

  const pcb = new THREE.Mesh(boxGeometry(W, H, 1.6, 0.3), [
    mat('#24508f'), mat('#24508f'), mat('#24508f'), mat('#24508f'),
    new THREE.MeshStandardMaterial({ map: pcbTexture(), roughness: 0.7 }), mat('#24508f'),
  ]);
  pcb.position.set(0, Y0 + H / 2, 0);
  g.add(pcb);

  const can = mat('#cfd3d9', { metalness: 0.6, roughness: 0.35 });
  const mesh = mat('#3a3c42', { roughness: 0.9 });
  for (const x of [-13, 13]) {
    const t = cyl(8, 12, can, 0, 0, 0, 36);
    t.rotation.x = Math.PI / 2;
    t.position.set(x, Y0 + H / 2 + 0.5, 0.8 + 6);
    g.add(t);
    const face = cyl(6.6, 0.2, mesh, 0, 0, 0, 36);
    face.rotation.x = Math.PI / 2;
    face.position.set(x, Y0 + H / 2 + 0.5, 12.85);
    g.add(face);
  }
  g.add(box(10, 3.4, 2.6, M.silver, 0, Y0 + H - 6.5, 1.6));

  // Pin header ditekuk 90° masuk ke breadboard
  g.add(box(4 * PITCH, 2.5, 2.5, M.black, 0, Y0 - 0.2, -1.6));
  for (let i = 0; i < 4; i++) {
    const x = (i - 1.5) * PITCH;
    g.add(bentRod([[x, Y0 + 2, -0.8], [x, Y0 + 1, -1.6], [x, -1.5, -1.6]], 0.32, M.gold));
  }

  // Gelombang suara (busur mengembang)
  const waves = [];
  for (let i = 0; i < 3; i++) {
    const geo = new THREE.RingGeometry(10, 11, 40, 1, Math.PI * 0.25, Math.PI * 0.5);
    geo.rotateX(Math.PI / 2); // busur di bidang datar, mengarah ke +z
    const m = new THREE.Mesh(
      geo,
      new THREE.MeshBasicMaterial({ color: '#25a99e', transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false })
    );
    m.position.set(0, Y0 + H / 2 + 0.5, 0);
    noOutline(m);
    g.add(m);
    waves.push(m);
  }

  /** t: 0..1 progres ping (atau -1 = mati); reach: jarak penghalang dari sensor (mm) */
  g.userData.setPing = (t, reach = 40) => {
    waves.forEach((w, i) => {
      const k = t - i * 0.12;
      if (t < 0 || k < 0 || k > 1) {
        w.material.opacity = 0;
        return;
      }
      const s = (10 + k * reach) / 10;
      w.scale.set(s, 1, s);
      w.material.opacity = (1 - k) * 0.8;
    });
  };
  g.userData.setPing(-1);
  g.userData.anchor = anchor(g, 0, Y0 + H + 0.5, 0);
  g.userData.front = anchor(g, 0, Y0 + H / 2, 12.9);
  // geser semua bagian agar ujung kaki tepat di z = 0 (garis lubang breadboard)
  for (const child of g.children) child.position.z += 1.6;
  return markPart(g, { key: 'sonar', name: 'Sensor jarak HC-SR04', desc: 'Mengukur jarak dengan pantulan suara ultrasonik.' });
}
