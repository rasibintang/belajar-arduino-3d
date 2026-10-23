import * as THREE from 'three';
import { M, mat, ownMat, box, cyl, bentRod, anchor, markPart, canvasTexture, roundedBox, setEmissive, PITCH } from './lib.js';
import { createModule, chip } from './module.js';

/** Modul akselerometer + giroskop MPU6050 (GY-521). */
export const MPU_PINS = ['VCC', 'GND', 'SCL', 'SDA', 'XDA', 'XCL', 'AD0', 'INT'];
export function createMPU6050() {
  const { g, top } = createModule({
    w: 21,
    d: 16,
    color: '#1f4fa8',
    label: 'GY-521',
    labelAt: [0, 3.5],
    headers: [{ names: MPU_PINS, x: 0, z: -6 }],
    key: 'mpu6050',
    name: 'MPU6050',
    desc: 'Mengukur percepatan (3 sumbu) dan putaran (3 sumbu).',
  });
  chip(g, 0, 1, top, 4, 4, 0.9);
  // panah sumbu X / Y di sablon
  const arrow = mat('#e8eef9');
  g.add(box(5, 0.1, 0.4, arrow, 6.5, top, 4, 0));
  g.add(box(0.4, 0.1, 5, arrow, 6.5, top, 4, 0));
  return g;
}

/** Modul sensor tekanan udara BMP180. */
export function createBMP180() {
  const { g, top } = createModule({
    w: 14,
    d: 12,
    color: '#6b3fa0',
    headers: [{ names: ['VIN', 'GND', 'SCL', 'SDA'], x: 0, z: -4.5 }],
    key: 'bmp180',
    name: 'BMP180',
    desc: 'Mengukur tekanan udara dan suhu; bisa memperkirakan ketinggian.',
  });
  chip(g, 0, 2, top, 3.6, 3.6, 1, '#c9ccd2');
  g.add(cyl(0.5, 0.1, M.dark, 0.6, top + 1, 2.6, 10));
  return g;
}

/** Sensor suhu DS18B20 kemasan TO-92 (kaki GND, DQ, VDD di x = −2,54 / 0 / +2,54). */
export function createDS18B20() {
  const g = new THREE.Group();
  g.name = 'DS18B20';
  const Y0 = 6;
  const body = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 5, 24, 1, false, Math.PI / 2, Math.PI), mat('#1d1e22', { roughness: 0.55 }));
  body.position.set(0, Y0 + 2.5, 0);
  g.add(body);
  const tex = canvasTexture(160, 100, (ctx, w, h) => {
    ctx.fillStyle = '#1d1e22';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#b8bcc6';
    ctx.font = '600 30px "IBM Plex Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('18B20', w / 2, h / 2 + 10);
  });
  const face = new THREE.Mesh(new THREE.PlaneGeometry(4.8, 5), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55 }));
  face.position.set(0, Y0 + 2.5, 0.01);
  g.add(face);
  for (const x of [-PITCH, 0, PITCH]) g.add(bentRod([[x * 0.5, Y0, 0], [x, Y0 - 2.5, 0], [x, -1.5, 0]], 0.25));
  g.userData.anchor = anchor(g, 0, Y0 + 6, 0);
  return markPart(g, { key: 'ds18b20', name: 'DS18B20', desc: 'Sensor suhu digital satu kabel (OneWire).' });
}

/** Modul HX711 + sel beban (load cell) dengan beban di atasnya. userData.setLoad(0..1) */
export function createHX711() {
  const { g, top } = createModule({
    w: 22,
    d: 34,
    color: '#2f8a46',
    label: 'HX711',
    labelAt: [2, 0],
    headers: [{ names: ['VCC', 'GND', 'DT', 'SCK'], x: -9, z: 0, axis: 'z' }],
    key: 'hx711',
    name: 'HX711 + load cell',
    desc: 'Penguat 24 bit untuk timbangan digital.',
  });
  chip(g, 3, 6, top, 5, 6, 1);
  // sel beban aluminium
  const alu = mat('#c9ccd2', { metalness: 0.65, roughness: 0.35 });
  const cell = new THREE.Group();
  cell.position.set(46, 0, 0);
  cell.add(box(60, 12.7, 12.7, alu, 0, 0, 0, 1));
  cell.add(cyl(3.5, 12.9, mat('#8d929a', { metalness: 0.5 }), -4, -0.1, 0, 20));
  cell.add(cyl(3.5, 12.9, mat('#8d929a', { metalness: 0.5 }), 4, -0.1, 0, 20));
  const plate = new THREE.Group();
  plate.add(box(40, 2, 30, mat('#e7e2d6', { roughness: 0.5 }), 0, 0, 0, 0.8));
  plate.position.set(14, 12.7, 0);
  cell.add(plate);
  const weight = box(14, 10, 14, mat('#4b5468', { metalness: 0.4, roughness: 0.4 }), 0, 2, 0, 1);
  plate.add(weight);
  g.add(cell);
  for (const [i, color] of ['#d9473c', '#2b2d33', '#ecebe6', '#3caa5a'].entries()) {
    g.add(box(18, 0.8, 0.8, mat(color), 20, 1, -1.5 + i, 0));
  }
  g.userData.setLoad = (k) => {
    weight.visible = k > 0.001;
    weight.scale.y = 0.4 + Math.min(1, k) * 1.2;
    plate.position.y = 12.7 - Math.min(1, k) * 0.8;
  };
  g.userData.setLoad(0.2);
  g.userData.anchor = anchor(g, 30, 30, 0);
  return g;
}

/** Modul penerima IR (VS1838). Pin: GND, VCC, DAT. userData.setActive(bool) */
export function createIRReceiver() {
  const { g, top } = createModule({
    w: 16,
    d: 14,
    color: '#1b1d22',
    headers: [{ names: ['GND', 'VCC', 'DAT'], x: 0, z: 5 }],
    key: 'ir-receiver',
    name: 'Penerima IR',
    desc: 'Menangkap sinyal remote inframerah (38 kHz).',
  });
  g.add(box(6, 6, 5, mat('#202226', { roughness: 0.4 }), 0, top, -2, 0.6));
  const dome = new THREE.Mesh(new THREE.SphereGeometry(2.2, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat('#2a2c31', { roughness: 0.2 }));
  dome.position.set(0, top + 6, -2);
  g.add(dome);
  const led = ownMat('#f2d6cf', { roughness: 0.3 });
  g.add(box(1.6, 0.8, 1, led, 5.5, top, -4));
  g.userData.setActive = (on) => {
    setEmissive(led, '#ff3b2f', on ? 2.4 : 0);
    led.color.set(on ? '#ff5a4f' : '#f2d6cf');
  };
  g.userData.anchor = anchor(g, 0, top + 9, -2);
  return g;
}

/** Tombol remote IR: [label, kode perintah NEC]. Alamat 0x00. */
export const IR_BUTTONS = [
  ['POWER', 0xa2], ['MENU', 0xe2], ['TEST', 0x22],
  ['+', 0x02], ['BACK', 0xc2], ['◀◀', 0xe0],
  ['▶', 0xa8], ['▶▶', 0x90], ['0', 0x68],
  ['−', 0x98], ['C', 0xb0], ['1', 0x30],
  ['2', 0x18], ['3', 0x7a], ['4', 0x10],
  ['5', 0x38], ['6', 0x5a], ['7', 0x42],
  ['8', 0x4a], ['9', 0x52],
];

/** Remote IR 20 tombol. Klik tombol saat simulasi; userData.onButton(kode, label) */
export function createIRRemote() {
  const g = new THREE.Group();
  g.name = 'Remote IR';
  const body = roundedBox(40, 6, 86, 6, mat('#26282e', { roughness: 0.55 }));
  g.add(body);
  g.add(box(6, 2, 3, mat('#3b1f22', { roughness: 0.2 }), 0, 4.5, -44, 0.5)); // LED IR di ujung
  const caps = [];
  const cols = 3;
  IR_BUTTONS.forEach(([label, code], i) => {
    const c = i % cols;
    const r = Math.floor(i / cols);
    const x = (c - 1) * 11;
    const z = -30 + r * 9.5;
    const tex = canvasTexture(96, 96, (ctx, w, h) => {
      ctx.fillStyle = label === 'POWER' ? '#d9473c' : '#e8e3d6';
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, w / 2 - 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = label === 'POWER' ? '#fff' : '#1d2740';
      ctx.font = `700 ${label.length > 2 ? 22 : 40}px "Barlow Semi Condensed", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, w / 2, h / 2 + 2);
    });
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 3.8, 1.6, 24), [
      mat('#d8d3c6'),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5 }),
      mat('#d8d3c6'),
    ]);
    cap.position.set(x, 6.8, z);
    g.add(cap);
    caps.push({ cap, x, z, code, label });
  });
  const v = new THREE.Vector3();
  let held = null;
  g.userData.press = (down, point) => {
    if (!down) {
      if (held) held.cap.position.y = 6.8;
      held = null;
      return;
    }
    if (!point) return;
    g.worldToLocal(v.copy(point));
    let best = null;
    let bestD = 6;
    for (const b of caps) {
      const d = Math.hypot(b.x - v.x, b.z - v.z);
      if (d < bestD) (best = b), (bestD = d);
    }
    if (!best) return;
    held = best;
    best.cap.position.y = 6.2;
    g.userData.onButton?.(best.code, best.label);
  };
  g.userData.anchor = anchor(g, 0, 10, 0);
  return markPart(g, { key: 'ir-remote', name: 'Remote IR', desc: 'Klik tombolnya untuk mengirim kode NEC.' });
}

/** Modul RFID MFRC522 + kartu. Pin: SDA SCK MOSI MISO IRQ GND RST 3.3V. userData.setCard(bool) */
export const RFID_PINS = ['SDA', 'SCK', 'MOSI', 'MISO', 'IRQ', 'GND', 'RST', '3.3V'];
export function createRFID() {
  const { g, top } = createModule({
    w: 40,
    d: 60,
    color: '#1f4fa8',
    headers: [{ names: RFID_PINS, x: 0, z: 28 }],
    key: 'rfid',
    name: 'RFID MFRC522',
    desc: 'Membaca UID kartu/gantungan kunci RFID 13,56 MHz. Klik modul untuk mendekatkan kartu.',
  });
  // antena (jalur tembaga melingkar)
  const coil = mat('#d4b25a', { metalness: 0.7, roughness: 0.35 });
  for (let i = 0; i < 4; i++) {
    const s = 32 - i * 3;
    const t = 0.6;
    const zc = -8;
    g.add(box(s, 0.1, t, coil, 0, top, zc - s / 2, 0));
    g.add(box(s, 0.1, t, coil, 0, top, zc + s / 2, 0));
    g.add(box(t, 0.1, s, coil, -s / 2, top, zc, 0));
    g.add(box(t, 0.1, s, coil, s / 2, top, zc, 0));
  }
  chip(g, 0, 15, top, 5, 5, 1);
  const card = new THREE.Group();
  card.add(roundedBox(54, 0.8, 34, 3, mat('#f4f1ea', { roughness: 0.5 })));
  card.add(box(40, 0.1, 6, mat('#1f9e94'), 0, 0.8, -10, 0));
  card.rotation.y = 0.15;
  g.add(card);
  let present = false;
  let t = 0;
  g.userData.setCard = (v) => {
    present = v;
  };
  g.userData.tick = (dt) => {
    t += ((present ? 1 : 0) - t) * Math.min(1, dt * 10);
    card.position.set(20 - t * 20, top + 2 + t * 6, -8 - (1 - t) * 4);
    card.visible = t > 0.02 || present;
  };
  g.userData.tick(1);
  g.userData.anchor = anchor(g, 0, top + 10, -8);
  return g;
}
