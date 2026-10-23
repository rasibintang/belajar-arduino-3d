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
 *   props: [ { key, label, type: 'swatch' | 'choice' | 'range' | 'text', value, options?, min?, max?, step?, unit?, rebuild? } ],
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
  breadboard: 'Breadboard',
  basic: 'Dasar',
  input: 'Input',
  output: 'Output',
  sensor: 'Sensor',
  display: 'Tampilan',
  motor: 'Motor',
  logic: 'Logika',
  misc: 'Lain-lain',
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
  'rgb-led': { roles: ['red', 'green', 'blue', 'cathode'], desc: 'Tiga LED dengan katoda bersama.' },
  ldr: { roles: ['a', 'b'], desc: 'Resistor yang hambatannya bergantung pada cahaya (props lux).' },
  indicator: { roles: ['gnd'], desc: 'Modul LED dengan resistor bawaan: tiap output HIGH = menyala.' },
  seg7: { roles: ['common'], desc: 'Tujuh segmen + titik, katoda bersama.' },
  npn: { roles: ['base', 'collector', 'emitter'], desc: 'Kolektor tersambung ke emitor saat basis cukup tinggi.' },
  'dc-motor': { roles: ['plus', 'minus'], desc: 'Kecepatan sebanding beda tegangan terminal (rata-rata PWM).' },
  relay: { roles: ['signal', 'vcc', 'gnd'], desc: 'Kumparan aktif saat sinyal HIGH dan modul mendapat daya.' },
  joystick: { roles: ['vcc', 'gnd', 'x', 'y', 'sw'], desc: 'Dua pembagi tegangan + tombol ke GND.' },
  keypad: { roles: [], desc: 'Matriks: tombol ditekan menyambungkan baris dan kolomnya.' },
  hc595: { roles: ['vcc', 'gnd', 'data', 'shift', 'latch', 'oe', 'mr'], desc: 'Register geser 8 bit dengan latch.' },
  ws2812: { roles: ['din', 'vcc', 'gnd'], desc: 'Bit data berdurasi (0,4 / 0,8 µs), 24 bit GRB per LED.' },
  dht: { roles: ['vcc', 'data', 'gnd'], desc: 'Protokol satu kabel: 40 bit setelah pulsa mulai dari MCU.' },
  'i2c-rtc': { roles: ['sda', 'scl', 'vcc', 'gnd'], desc: 'Register waktu BCD lewat I²C.' },
  encoder: { roles: ['clk', 'dt', 'vcc', 'gnd'], desc: 'Dua sinyal kuadratur per "klik" putaran.' },
  stepper: { roles: ['vcc', 'gnd'], desc: 'Urutan pola IN1–IN4 menggeser poros per langkah.' },
  none: { roles: [], desc: 'Tanpa perilaku listrik (hiasan, catatan, titik sambung).' },
  source: { roles: ['pin'], desc: 'Sumber tegangan ideal (volts).' },
  'slide-switch': { roles: ['p1', 'common', 'p2'], desc: 'Common tersambung ke p1 (posisi 0) atau p2 (posisi 1).' },
  dip: { roles: [], desc: 'Saklar ke-i menyambungkan inputs[i] dengan outputs[i] saat ON.' },
  ntc: { roles: ['vcc', 'out', 'gnd'], desc: 'Pembagi tegangan termistor NTC 10 kΩ (β 3950) + resistor 10 kΩ.' },
  pir: { roles: ['vcc', 'out', 'gnd'], desc: 'Keluaran HIGH beberapa detik setelah gerakan.' },
  mq2: { roles: ['vcc', 'gnd', 'dout', 'aout'], desc: 'AOUT sebanding kadar gas; DOUT LOW di atas ambang.' },
  'lcd-parallel': { roles: ['rs', 'e', 'vdd', 'vss'], desc: 'HD44780: data D0–D7 (atau D4–D7) dibaca pada tepi turun E.' },
  gate: { roles: ['y'], desc: 'Gerbang logika: Y = fungsi(inputs).' },
  mux2: { roles: ['a', 'b', 'sel', 'out'], desc: 'OUT = A bila SEL LOW, B bila SEL HIGH.' },
  dff: { roles: ['d', 'clk', 'q', 'notq'], desc: 'Q mengambil nilai D pada tepi naik CLK (set/reset opsional).' },
  clock: { roles: ['clk'], desc: 'Gelombang kotak dengan frekuensi tertentu.' },
  dpdt: { roles: ['coil1', 'coil2', 'p1', 'nc1', 'no1', 'p2', 'nc2', 'no2'], desc: 'Kumparan aktif: P→NO; tidak aktif: P→NC.' },
  hc165: { roles: ['vcc', 'gnd', 'pl', 'cp', 'ce', 'q7'], desc: 'Register geser 8 bit paralel-masuk, seri-keluar.' },
  mux16: { roles: ['sig', 'en', 'vcc', 'gnd'], desc: 'SIG tersambung ke kanal C(S3..S0) saat EN LOW.' },
  a4988: { roles: ['step', 'dir', 'enable', 'sleep', 'reset', 'vdd', 'gnd'], desc: 'Tiap pulsa STEP memajukan arus kumparan satu (mikro)langkah.' },
  bipolar: { roles: [], desc: 'Motor stepper bipolar: urutan polaritas kumparan A dan B memutar poros.' },
  seg7mux: { roles: [], desc: 'Beberapa digit 7-segment yang berbagi jalur segmen (multipleks).' },
  oled: { roles: ['sda', 'scl', 'vcc', 'gnd'], desc: 'Layar grafis monokrom I²C (SSD1306 / SH1107).' },
  pcd8544: { roles: ['rst', 'ce', 'dc', 'din', 'clk', 'vcc', 'gnd'], desc: 'Layar Nokia 5110 lewat SPI.' },
  tm1637: { roles: ['clk', 'dio', 'vcc', 'gnd'], desc: 'Protokol 2 kabel mirip I²C (LSB dulu) untuk 4 digit.' },
  max7219: { roles: ['vcc', 'gnd', 'din', 'cs', 'clk'], desc: 'Bingkai 16 bit (register, data) dikunci saat CS naik; bisa berantai.' },
  'logic-analyzer': { roles: ['gnd'], desc: 'Merekam tepi sinyal inputs untuk ditampilkan.' },
  mpu6050: { roles: ['sda', 'scl', 'vcc', 'gnd'], desc: 'Register akselerometer/giroskop lewat I²C.' },
  bmp180: { roles: ['sda', 'scl', 'vcc', 'gnd'], desc: 'Register kalibrasi + hasil ukur tekanan/suhu lewat I²C.' },
  ds18b20: { roles: ['dq', 'vdd', 'gnd'], desc: 'Protokol OneWire: reset/presence, slot baca/tulis, scratchpad.' },
  hx711: { roles: ['vcc', 'gnd', 'dt', 'sck'], desc: '24 bit keluar di DT, satu bit per pulsa SCK.' },
  'ir-receiver': { roles: ['dat', 'vcc', 'gnd'], desc: 'Keluaran LOW aktif mengikuti pulsa NEC dari remote.' },
  'ir-remote': { roles: [], desc: 'Memancarkan kode NEC ke semua penerima IR.' },
  mfrc522: { roles: ['cs', 'sck', 'mosi', 'miso', 'vcc', 'gnd'], desc: 'Register MFRC522 lewat SPI + kartu ISO 14443A.' },
};

/** Field perilaku berisi daftar pin yang juga harus diperiksa. */
const PIN_LIST_FIELDS = ['outputs', 'segments', 'inputs', 'rows', 'cols', 'digits', 'select'];

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
    for (const field of PIN_LIST_FIELDS) {
      if (!Array.isArray(b[field])) continue; // mis. LCD memakai rows/cols sebagai ukuran layar
      for (const id of b[field]) need(ids.has(id), `behavior.${field} menyebut pin "${id}" yang tidak ada`);
    }
    for (const [a, c] of b.always ?? []) need(ids.has(a) && ids.has(c), `behavior.always [${a}, ${c}] tidak valid`);
    if (b.kind === 'switch') {
      for (const pair of [...(b.always ?? []), ...(b.pressed ?? [])]) {
        need(pair.length === 2 && pair.every((id) => ids.has(id)), `pasangan switch [${pair}] tidak valid`);
      }
    }
  }
  for (const p of spec.props ?? []) {
    need(p.key && p.label && ['swatch', 'choice', 'range', 'text'].includes(p.type), `prop "${p.key}" tidak lengkap`);
    if (p.options) need(p.options.some((o) => o.value === p.value), `nilai awal prop "${p.key}" tidak ada di options`);
  }
  return errors;
}
