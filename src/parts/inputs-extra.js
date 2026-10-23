import * as THREE from 'three';
import { M, mat, box, cyl, bentRod, rod, anchor, markPart, pinHeader, canvasTexture, PITCH } from './lib.js';
import { BUTTON_COLORS } from './button.js';

/** Tombol taktil 6 mm, mengangkangi parit (kaki x = ±1,27, z = ±3,81). */
export function createButton6({ color = 'red' } = {}) {
  const g = new THREE.Group();
  g.name = 'Tombol 6 mm';
  g.add(box(6, 3.4, 6, M.black, 0, 0.5));
  g.add(box(6.2, 0.3, 6.2, mat('#c7cace', { metalness: 0.7, roughness: 0.35 }), 0, 3.9));
  const capUp = 4.2;
  const cap = cyl(1.8, 1.6, mat(BUTTON_COLORS[color] ?? color, { roughness: 0.5 }), 0, capUp, 0, 24);
  g.add(cap);
  for (const x of [-PITCH / 2, PITCH / 2]) {
    for (const z of [-3.81, 3.81]) g.add(bentRod([[x, 1.5, Math.sign(z) * 2.8], [x, 0.4, z], [x, -1.5, z]], 0.25));
  }
  let pressed = false;
  g.userData.press = (v) => {
    if (v === pressed) return;
    pressed = v;
    g.userData.pressed = v;
    cap.position.y = capUp + 0.8 - (v ? 0.8 : 0);
    g.userData.onChange?.(v);
  };
  g.userData.pressed = false;
  g.userData.anchor = anchor(g, 0, capUp + 1.8, 0);
  return markPart(g, { key: 'button6', name: 'Tombol 6 mm', desc: 'Klik dan tahan untuk menekan.' });
}

/** Saklar geser SPDT: 3 kaki (x = −2,54 / 0 / +2,54). Kaki tengah = common. Klik untuk menggeser. */
export function createSlideSwitch() {
  const g = new THREE.Group();
  g.name = 'Saklar geser';
  g.add(box(8.6, 3.6, 4.4, mat('#2f62c9', { roughness: 0.5 }), 0, 1.4));
  g.add(box(8.8, 0.3, 4.6, mat('#c7cace', { metalness: 0.7, roughness: 0.35 }), 0, 5));
  const knob = box(2.2, 3.2, 2, mat('#2a2b30', { roughness: 0.6 }), 0, 5.3);
  g.add(knob);
  for (const x of [-PITCH, 0, PITCH]) g.add(rod(new THREE.Vector3(x, -1.5, 0), new THREE.Vector3(x, 1.5, 0), 0.3));
  g.userData.position = 0;
  g.userData.setPosition = (p) => {
    g.userData.position = p;
    knob.position.x = p ? 1.6 : -1.6;
  };
  g.userData.press = (down) => {
    if (!down) return;
    g.userData.setPosition(g.userData.position ? 0 : 1);
    g.userData.onChange?.();
  };
  g.userData.setPosition(0);
  g.userData.anchor = anchor(g, 0, 8.5, 0);
  return markPart(g, { key: 'slide', name: 'Saklar geser', desc: 'Klik untuk memindah tuas: kiri = kaki 1–2, kanan = kaki 2–3.' });
}

/** DIP switch 8: mengangkangi parit, saklar ke-i menyambung kaki depan i dan kaki belakang i. */
export function createDipSwitch8() {
  const g = new THREE.Group();
  g.name = 'DIP switch 8';
  const len = 8 * PITCH + 1;
  const tex = canvasTexture(420, 160, (ctx, w, h) => {
    ctx.fillStyle = '#c93a32';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#f5ece8';
    ctx.font = '700 22px "Barlow Semi Condensed", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ON', 22, 26);
    for (let i = 0; i < 8; i++) ctx.fillText(String(i + 1), ((i + 0.5) / 8) * w, h - 10);
  });
  const red = mat('#c93a32', { roughness: 0.5 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(len, 5, 9.6), [red, red, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5 }), red, red, red]);
  body.position.y = 1 + 2.5;
  g.add(body);
  const sliders = [];
  for (let i = 0; i < 8; i++) {
    const x = (i - 3.5) * PITCH;
    g.add(box(1.5, 0.3, 4.6, M.dark, x, 6, 0, 0));
    const s = box(1.3, 1.2, 1.8, M.white, x, 6, 0, 0.2);
    g.add(s);
    sliders.push(s);
    for (const side of [-1, 1]) g.add(bentRod([[x, 1.5, side * 4.6], [x, 0.4, side * 3.81], [x, -1.5, side * 3.81]], 0.25, M.silver));
  }
  const on = new Array(8).fill(false);
  const v = new THREE.Vector3();
  g.userData.on = on;
  g.userData.set = (i, value) => {
    on[i] = value;
    sliders[i].position.z = value ? -1.3 : 1.3; // ON = ke arah belakang (tulisan ON)
  };
  g.userData.press = (down, point) => {
    if (!down || !point) return;
    g.worldToLocal(v.copy(point));
    const i = Math.round(v.x / PITCH + 3.5);
    if (i < 0 || i > 7) return;
    g.userData.set(i, !on[i]);
    g.userData.onChange?.();
  };
  for (let i = 0; i < 8; i++) g.userData.set(i, false);
  g.userData.anchor = anchor(g, 0, 7.5, 0);
  return markPart(g, { key: 'dip', name: 'DIP switch 8', desc: 'Klik salah satu saklar untuk ON/OFF.' });
}

/** Potensiometer geser (modul): pin VCC, SIG, GND. userData.setValue(0..1023). */
export function createSlidePot() {
  const g = new THREE.Group();
  g.name = 'Potensiometer geser';
  g.add(box(64, 1.6, 12, mat('#1d2b4a', { roughness: 0.6 }), 0, 1.5, 0, 0.3));
  g.add(box(58, 6, 8, mat('#2b2d33', { roughness: 0.5 }), 0, 3.1, 0, 0.6));
  g.add(box(46, 0.3, 1.4, M.dark, 0, 9.1, 0, 0));
  const knob = new THREE.Group();
  knob.add(box(4, 7, 7, mat('#d9d5cb', { roughness: 0.5 }), 0, 9.1, 0, 0.8));
  knob.add(box(0.6, 0.2, 6, mat('#e0533f'), 0, 16.1, 0, 0));
  g.add(knob);
  pinHeader(g, ['VCC', 'SIG', 'GND'], { x: -33.5, y: 3.1, z: 0, axis: 'z' });
  g.userData.setValue = (val) => {
    knob.position.x = (Math.max(0, Math.min(1023, val)) / 1023 - 0.5) * 44;
  };
  g.userData.setValue(512);
  g.userData.anchor = anchor(g, 0, 17, 0);
  return markPart(g, { key: 'slidepot', name: 'Potensiometer geser', desc: 'Seret ke kiri/kanan saat simulasi berjalan.' });
}
