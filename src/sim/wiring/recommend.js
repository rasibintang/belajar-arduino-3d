import { mcuPinInfo } from './pin-functions.js';
import { view, partOf, pinOf } from './snapshot.js';

/**
 * Rekomendasi tujuan kabel: dari fungsi titik asal, titik mana yang cocok sebagai ujung lainnya.
 * Aturan dari dokumentasi Arduino Uno: PWM ~3/5/6/9/10/11, interupsi D2/D3, Serial D0/D1 (dihindari),
 * SPI D11/D12/D13, I²C A4/A5.
 */

const MCU_ORDER = ['mcu-gnd', 'mcu-5v', 'mcu-3v3', 'mcu-vin', 'mcu-analog', 'mcu-digital', 'mcu-other'];
const POWER_ORDER = ['gnd', 'vcc5', 'vcc33'];
const GND_LIKE = ['gnd', 'led-cathode', 'tie-gnd', 'rail-', 'supply-gnd'];
const VCC_LIKE = ['vcc5', 'rail+', 'supply-5v'];
const DIGITAL = ['digital-in', 'digital-out', 'digital-io', 'led-anode'];

const roles = new WeakMap();

/**
 * Peran sebuah net: pin Uno di dalamnya (mcu-*), simbol catu (supply-*), fungsi pin komponen,
 * 'led-anode' untuk jalur resistor yang menuju anoda LED, 'led-series' untuk sisi anoda yang sudah
 * lewat resistor, rel (rail+/rail-), atau 'neutral'.
 */
export function netRole(s, i) {
  if (!roles.has(s)) roles.set(s, []);
  const cache = roles.get(s);
  if (cache[i] === undefined) cache[i] = computeRole(s, i);
  return cache[i];
}

function computeRole(s, i) {
  const v = view(s);
  const nodes = s.nets[i];
  const fns = nodes.map(v.fn);
  const mcu = MCU_ORDER.find((f) => fns.includes(f));
  if (mcu) return mcu;
  if (fns.includes('supply-gnd')) return 'supply-gnd';
  if (fns.includes('supply-5v')) return 'supply-5v';
  const comp = nodes.filter((n) => v.isComponent(n) && v.fn(n) !== 'neutral').map(v.fn);
  if (comp.length) {
    if (comp.includes('led-anode') && nodes.some((n) => v.kind(n) === 'resistor')) return 'led-series';
    return POWER_ORDER.find((f) => comp.includes(f)) ?? comp[0];
  }
  if (leadsToAnode(s, i)) return 'led-anode';
  if (fns.includes('rail+')) return 'rail+';
  if (fns.includes('rail-')) return 'rail-';
  return 'neutral';
}

/** Net berisi kaki resistor yang kaki lainnya satu net dengan anoda LED (dan belum ke Arduino). */
function leadsToAnode(s, i) {
  const v = view(s);
  for (const n of s.nets[i]) {
    if (v.kind(n) !== 'resistor') continue;
    const b = v.spec(n).behavior;
    const other = `${partOf(n)}:${pinOf(n) === b.a ? b.b : b.a}`;
    const j = v.netOf(other);
    if (j === i || j === undefined) continue;
    const fns = s.nets[j].map(v.fn);
    if (fns.includes('led-anode') && !fns.some((f) => f.startsWith('mcu-'))) return true;
  }
  return false;
}

/** Net pin Uno tidak memuat pin komponen lain (pin "bebas"). */
function isFree(s, node) {
  const v = view(s);
  return !s.nets[v.netOf(node)].some((n) => v.isComponent(n) && v.kind(n) !== 'none');
}

/** Dari pin komponen: pin Uno, simbol catu, dan lubang rel kosong yang cocok. */
function boardTargets(s, fn) {
  const v = view(s);
  const out = [];
  const gnd = GND_LIKE.includes(fn) || fn === 'pot-end';
  const vcc = VCC_LIKE.includes(fn) || fn === 'pot-end';
  for (const nodes of s.nets) {
    for (const n of nodes) {
      const f = v.fn(n);
      if (f.startsWith('mcu-')) {
        if (wantsBoardPin(s, fn, n, gnd, vcc)) out.push(n);
      } else if (f === 'supply-gnd' || f === 'supply-5v') {
        if ((gnd && f === 'supply-gnd') || (vcc && f === 'supply-5v')) out.push(n);
      } else if ((gnd && f === 'rail-') || (vcc && f === 'rail+')) {
        if (!s.occupied.has(n)) out.push(n);
      }
    }
  }
  return out;
}

function wantsBoardPin(s, fn, node, gnd, vcc) {
  const pin = pinOf(node);
  const info = mcuPinInfo(pin);
  const d = info.digital ? Number(pin.slice(1)) : -1;
  if (gnd && /^GND/.test(pin)) return true;
  if (vcc && pin === '5V') return true;
  if (fn === 'vcc33') return pin === '3V3';
  if (fn === 'i2c-sda') return info.i2c === 'sda';
  if (fn === 'i2c-scl') return info.i2c === 'scl';
  if (fn.startsWith('spi-') && fn !== 'spi-cs') return info.spi === fn.slice(4);
  let ok = false;
  if (fn === 'spi-cs') ok = d >= 2 && d <= 10;
  else if (fn === 'analog-out') ok = /^A[0-5]$/.test(pin);
  else if (fn === 'pwm-in') ok = info.pwm;
  else if (fn === 'interrupt-out') ok = info.interrupt;
  else if (DIGITAL.includes(fn)) ok = d >= 2;
  return ok && isFree(s, node);
}

/** Dari pin Uno: pin komponen & lubang kosong di net yang belum tersambung ke Arduino dan perannya cocok. */
function componentTargets(s, fn, boardPin) {
  const v = view(s);
  const info = mcuPinInfo(boardPin);
  const d = info.digital ? Number(boardPin.slice(1)) : -1;
  const want = new Set();
  if (fn === 'mcu-gnd') ['gnd', 'led-cathode', 'tie-gnd', 'pot-end', 'rail-'].forEach((f) => want.add(f));
  if (fn === 'mcu-5v') ['vcc5', 'pot-end', 'rail+'].forEach((f) => want.add(f));
  if (fn === 'mcu-3v3') want.add('vcc33');
  if (fn === 'mcu-digital') {
    DIGITAL.forEach((f) => want.add(f));
    if (info.pwm) want.add('pwm-in');
    if (info.interrupt) want.add('interrupt-out');
    if (info.spi) want.add(`spi-${info.spi}`);
    if (d >= 2 && d <= 10) want.add('spi-cs');
  }
  if (fn === 'mcu-analog') {
    want.add('analog-out');
    if (info.i2c) want.add(`i2c-${info.i2c}`);
  }
  const out = [];
  s.nets.forEach((nodes, i) => {
    if (!want.has(netRole(s, i))) return;
    for (const n of nodes) {
      if (v.kind(n) === 'breadboard' ? !s.occupied.has(n) : v.isComponent(n) && want.has(v.fn(n))) out.push(n);
    }
  });
  return out;
}

/** Tujuan kabel yang disarankan dari sebuah titik → { fn, targets }. */
export function recommend(s, fromNode) {
  const v = view(s);
  const home = v.netOf(fromNode);
  if (home === undefined) return { fn: 'neutral', targets: [] };
  let fn = v.fn(fromNode);
  // lubang, rel, atau kaki netral: ikuti peran netnya
  if (['neutral', 'hole', 'rail+', 'rail-'].includes(fn)) {
    const role = netRole(s, home);
    if (role !== 'neutral' && role !== 'led-series') fn = role;
    if (fn === 'neutral' || fn === 'hole') return { fn, targets: [] };
  }
  let targets;
  if (fn.startsWith('mcu-')) {
    const board = v.kind(fromNode) === 'mcu' ? fromNode : s.nets[home].find((n) => v.fn(n) === fn);
    targets = componentTargets(s, fn, pinOf(board));
  } else {
    targets = boardTargets(s, fn);
  }
  return { fn, targets: targets.filter((n) => v.netOf(n) !== home) };
}
