import * as THREE from 'three';
import { PITCH } from '../parts/lib.js';

/**
 * STANDAR KOMPONEN
 * ================
 * Satu file per komponen, berisi objek spesifikasi:
 *
 * {
 *   type: 'led',                    // id unik (huruf kecil, tanda hubung)
 *   name: 'LED 5 mm',               // nama tampilan
 *   category: 'output',             // salah satu kunci CATEGORIES
 *   icon: 'led',                    // nama ikon di ui/icons.js
 *   desc: 'Keterangan singkat.',
 *   surface: 'breadboard',          // 'breadboard' = kaki ditancapkan ke lubang; 'floor' = diletakkan di meja
 *   create: (props) => Group,       // membuat model 3D (memakai src/parts/*)
 *   apply: (group, props) => {},    // opsional: perbarui tampilan saat props berubah
 *   props: [ { key, label, type: 'swatch' | 'choice' | 'range', value, options?, min?, max?, step?, unit? } ],
 *   pins: [ { id, name, at: [x, y, z] } ]   // atau fungsi (props, group) => daftar yang sama
 *   behavior: { kind: 'led', anode: 'A', cathode: 'K', ... }  // lihat BEHAVIORS
 * }
 *
 * Posisi pin (lokal):
 * - surface 'breadboard': titik kaki masuk lubang, di permukaan breadboard (y = 0),
 *   jarak antar kaki kelipatan 2,54 mm.
 * - surface 'floor': titik tempat konektor kabel jumper duduk (ujung bawah pin header).
 *
 * Perilaku hanya DATA: mesin simulasi (Tahap 3) yang menjalankannya. Dengan begitu
 * komponen yang sama dipakai di pelajaran maupun di sandbox.
 */

export const CATEGORIES = {
  board: 'Papan',
  basic: 'Dasar',
  input: 'Input',
  output: 'Output',
  sensor: 'Sensor',
  display: 'Tampilan',
  motor: 'Motor',
};

/**
 * Jenis perilaku dan pin yang wajib disebut (peran → id pin).
 * Tambahkan jenis baru di sini saat membuat komponen dengan perilaku baru.
 */
export const BEHAVIORS = {
  mcu: { roles: [], desc: 'Mikrokontroler; pin-pinnya dijalankan emulator.' },
  breadboard: { roles: [], desc: 'Jalur tembaga internal menyambungkan lubang-lubang.' },
  led: { roles: ['anode', 'cathode'], desc: 'Menyala jika arus mengalir dari anoda ke katoda.' },
  resistor: { roles: ['a', 'b'], desc: 'Menghubungkan dua titik dengan hambatan (ohms).' },
  switch: { roles: [], desc: 'Tombol: pasangan "always" selalu tersambung; "pressed" tersambung saat ditekan.' },
  pot: { roles: ['end1', 'wiper', 'end2'], desc: 'Pembagi tegangan; posisi wiper diatur pengguna.' },
  buzzer: { roles: ['plus', 'minus'], desc: 'Berbunyi sesuai frekuensi sinyal di pin plus.' },
  servo: { roles: ['signal', 'vcc', 'gnd'], desc: 'Berputar ke sudut sesuai lebar pulsa (1–2 ms).' },
  'i2c-lcd': { roles: ['sda', 'scl', 'vcc', 'gnd'], desc: 'Layar karakter lewat bus I²C (alamat di props).' },
  hcsr04: { roles: ['vcc', 'trig', 'echo', 'gnd'], desc: 'Pulsa trig 10 µs → pulsa echo sepanjang waktu tempuh suara.' },
};

/** Nilai awal props. */
export function defaultProps(spec) {
  return Object.fromEntries((spec.props ?? []).map((p) => [p.key, p.value]));
}

/** Daftar pin dengan posisi sebagai Vector3 lokal. */
export function resolvePins(spec, props, group) {
  const list = typeof spec.pins === 'function' ? spec.pins(props, group) : spec.pins ?? [];
  return list.map((p) => ({ ...p, at: p.at.isVector3 ? p.at.clone() : new THREE.Vector3(...p.at) }));
}

/** Pin dari header modul (group.userData.pins), dengan nama tampilan. */
export function headerPins(names) {
  return (props, group) =>
    Object.entries(names).map(([id, name]) => {
      const at = group?.userData.pins?.[id];
      if (!at) throw new Error(`pin header "${id}" tidak ditemukan di model`);
      return { id, name, at };
    });
}

/** Kaki berjajar di sumbu x berjarak 2,54 mm dan berpusat di 0 (komponen breadboard). */
export function legsAlongX(list, z = 0) {
  const n = list.length;
  return list.map(([id, name], i) => ({ id, name, at: [(i - (n - 1) / 2) * PITCH, 0, z] }));
}

/**
 * Buat komponen: model 3D + data yang dibutuhkan editor/simulator.
 * group.userData.component = { spec, props, pins }
 */
export function instantiate(spec, props = {}) {
  const full = { ...defaultProps(spec), ...props };
  const group = spec.create(full);
  spec.apply?.(group, full);
  group.userData.component = { spec, props: full, pins: resolvePins(spec, full, group) };
  return group;
}

const near = (a, b) => Math.abs(a - b) < 0.05;
const onGrid = (v) => near(v / PITCH, Math.round(v / PITCH));

/**
 * Periksa sebuah spesifikasi (dan model 3D-nya). Mengembalikan daftar masalah;
 * kosong berarti valid.
 */
export function validateSpec(spec) {
  const errors = [];
  const need = (cond, msg) => {
    if (!cond) errors.push(msg);
  };
  need(/^[a-z0-9-]+$/.test(spec.type ?? ''), 'type harus huruf kecil/angka/tanda hubung');
  need(spec.name, 'name kosong');
  need(spec.category in CATEGORIES, `category "${spec.category}" tidak dikenal`);
  need(typeof spec.create === 'function', 'create() wajib ada');
  need(['breadboard', 'floor'].includes(spec.surface), 'surface harus "breadboard" atau "floor"');
  if (errors.length) return errors;

  let group;
  let pins = [];
  try {
    group = instantiate(spec);
    pins = group.userData.component.pins;
  } catch (err) {
    return [`gagal membuat model: ${err.message}`];
  }

  const ids = new Set();
  for (const p of pins) {
    need(!ids.has(p.id), `pin "${p.id}" ganda`);
    ids.add(p.id);
    need(p.name, `pin "${p.id}" tanpa nama`);
    need([p.at.x, p.at.y, p.at.z].every(Number.isFinite), `posisi pin "${p.id}" tidak valid`);
  }
  if (spec.surface === 'breadboard' && pins.length) {
    const p0 = pins[0].at;
    for (const p of pins) {
      need(near(p.at.y, 0), `pin "${p.id}" harus di permukaan (y = 0), sekarang ${p.at.y.toFixed(2)}`);
      need(onGrid(p.at.x - p0.x) && onGrid(p.at.z - p0.z), `pin "${p.id}" tidak sejajar kisi 2,54 mm`);
    }
  }

  const b = spec.behavior;
  need(b && b.kind in BEHAVIORS, `behavior.kind "${b?.kind}" tidak dikenal`);
  if (b && BEHAVIORS[b.kind]) {
    for (const role of BEHAVIORS[b.kind].roles) need(ids.has(b[role]), `behavior.${role} menunjuk pin "${b[role]}" yang tidak ada`);
    if (b.kind === 'switch') {
      for (const pair of [...(b.always ?? []), ...(b.pressed ?? [])]) {
        need(pair.length === 2 && pair.every((id) => ids.has(id)), `pasangan switch [${pair}] tidak valid`);
      }
    }
  }
  for (const p of spec.props ?? []) {
    need(p.key && p.label && ['swatch', 'choice', 'range'].includes(p.type), `prop "${p.key}" tidak lengkap`);
    if (p.options) need(p.options.some((o) => o.value === p.value), `nilai awal prop "${p.key}" tidak ada di options`);
  }
  return errors;
}
