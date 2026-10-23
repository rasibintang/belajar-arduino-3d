import { mcuPinInfo } from './pin-functions.js';
import { view, pinOf, partOf } from './snapshot.js';
import { recommend } from './recommend.js';

/**
 * Pemeriksaan kabel yang sudah terpasang. Hanya net yang memuat pin Arduino atau simbol catu yang
 * dinilai, sehingga rangkaian yang masih setengah jadi tidak dihakimi. Pengecualian sempit: kabel yang
 * berakhir di jalur kosong tepat di sebelah lubang yang disarankan ("meleset", mis. seberang parit).
 */

export const ISSUE_CODES = ['short', 'power-reversed', 'power-on-signal', 'vcc33-on-5v', 'i2c-pin', 'spi-pin', 'analog-pin', 'pwm-pin', 'serial-pin', 'led-resistor', 'wire-misplaced'];

const POWER = ['mcu-5v', 'mcu-3v3', 'mcu-vin', 'supply-5v'];
const GROUND = ['mcu-gnd', 'supply-gnd'];
const SIGNAL = ['mcu-digital', 'mcu-analog'];
const PWM_ORDER = ['D3', 'D5', 'D6', 'D9', 'D10', 'D11'];
const DIGITAL_ORDER = ['D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8', 'D9', 'D10', 'D11', 'D12', 'D13'];
const ANALOG_ORDER = ['A0', 'A1', 'A2', 'A3', 'A4', 'A5'];
const SPI_PIN = { mosi: 'D11', miso: 'D12', sck: 'D13' };

/** Masalah untuk satu pin komponen di net yang tersambung ke Arduino: { code, severity, target } | null */
function judgePin(fn, netFns, mcuPins) {
  const has = (list) => list.some((f) => netFns.includes(f));
  const ground = has(GROUND);
  const power = has(POWER);
  const powerTarget = { vcc5: '5V', vcc33: '3V3', gnd: 'GND' }[fn];
  if ((fn === 'vcc5' || fn === 'vcc33') && ground) return { code: 'power-reversed', severity: 'danger', target: powerTarget };
  if (fn === 'gnd' && power) return { code: 'power-reversed', severity: 'danger', target: powerTarget };
  if (powerTarget && has(SIGNAL)) return { code: 'power-on-signal', severity: 'warn', target: powerTarget };
  if (fn === 'vcc33' && (netFns.includes('mcu-5v') || netFns.includes('supply-5v'))) return { code: 'vcc33-on-5v', severity: 'warn', target: '3V3' };
  const infos = mcuPins.map(mcuPinInfo);
  if (!infos.length || !has(SIGNAL)) return null;
  if (fn === 'i2c-sda' || fn === 'i2c-scl') {
    const want = fn.slice(4);
    if (!infos.some((i) => i.i2c === want)) return { code: 'i2c-pin', severity: 'warn', target: want === 'sda' ? 'A4' : 'A5' };
    return null;
  }
  if (['spi-mosi', 'spi-miso', 'spi-sck'].includes(fn)) {
    const want = fn.slice(4);
    if (!infos.some((i) => i.spi === want)) return { code: 'spi-pin', severity: 'warn', target: SPI_PIN[want] };
    return null;
  }
  if (fn === 'analog-out' && !netFns.includes('mcu-analog')) return { code: 'analog-pin', severity: 'warn', free: ANALOG_ORDER };
  if (fn === 'pwm-in' && netFns.includes('mcu-digital') && !infos.some((i) => i.pwm)) return { code: 'pwm-pin', severity: 'warn', free: PWM_ORDER };
  if (fn !== 'neutral' && infos.some((i) => i.serial)) return { code: 'serial-pin', severity: 'warn', free: DIGITAL_ORDER };
  return null;
}

/** Pin Uno pertama dari daftar yang netnya tidak memuat pin komponen lain. */
function firstFree(s, uno, order) {
  const v = view(s);
  return order.find((pin) => {
    const i = v.netOf(`${uno}:${pin}`);
    return i !== undefined && !s.nets[i].some((n) => v.isComponent(n) && v.kind(n) !== 'none');
  });
}

/** Satu kabel yang langsung menghubungkan pin komponen dengan salah satu pin Uno di net yang sama. */
function directWire(s, compNode, mcuNodes) {
  for (const w of s.wires) {
    if (w.from === compNode && mcuNodes.includes(w.to)) return { wireId: w.id, end: 'to' };
    if (w.to === compNode && mcuNodes.includes(w.from)) return { wireId: w.id, end: 'from' };
  }
  return null;
}

/** Periksa rangkaian → daftar masalah { severity, code, net, nodes: [komponen, Uno], suggest?, fix? }. */
export function checkCircuit(s) {
  const v = view(s);
  const issues = [];
  const wired = new Set(s.wires.flatMap((w) => [w.from, w.to]));
  // pin yang dikabel lebih dulu, supaya pesan menyebut "5V", bukan aliasnya "IOREF"
  const pick = (list) => list.find((n) => wired.has(n)) ?? list[0];
  s.nets.forEach((nodes, net) => {
    const fns = nodes.map(v.fn);
    const mcuNodes = nodes.filter((n) => v.kind(n) === 'mcu');
    const supplies = nodes.filter((n) => v.kind(n) === 'source');
    if (!mcuNodes.length && !supplies.length) return;
    const anchor = pick(mcuNodes) ?? pick(supplies);

    if (POWER.some((f) => fns.includes(f)) && GROUND.some((f) => fns.includes(f))) {
      const p = pick(nodes.filter((n) => POWER.includes(v.fn(n))));
      const g = pick(nodes.filter((n) => GROUND.includes(v.fn(n))));
      issues.push({ severity: 'danger', code: 'short', net, nodes: [p, g] });
      return;
    }

    const mcuPins = mcuNodes.map(pinOf);
    for (const node of nodes) {
      if (!v.isComponent(node)) continue;
      const fn = v.fn(node);
      const r = judgePin(fn, fns, mcuPins);
      if (!r) {
        if (fn === 'led-anode' && ledWithoutResistor(s, node, fns)) {
          issues.push({ severity: 'warn', code: 'led-resistor', net, nodes: [node, anchor] });
        }
        continue;
      }
      const issue = { severity: r.severity, code: r.code, net, nodes: [node, anchor] };
      const wire = directWire(s, node, mcuNodes);
      const uno = mcuNodes.length ? partOf(mcuNodes[0]) : null;
      const target = r.target ?? (uno && firstFree(s, uno, r.free));
      if (uno && target) issue.suggest = `${uno}:${target}`;
      if (wire && issue.suggest) issue.fix = { ...wire, to: issue.suggest };
      issues.push(issue);
    }
  });
  issues.push(...misplacedWires(s));
  issues.push(...openLeds(s));
  return issues;
}

const DRIVE = ['mcu-digital', 'mcu-5v', 'supply-5v'];

/** Sisi anoda tersambung ke pin Arduino, langsung atau lewat satu resistor. */
function anodeDriven(s, anode) {
  const v = view(s);
  const nodes = s.nets[v.netOf(anode)];
  if (nodes.some((n) => DRIVE.includes(v.fn(n)))) return true;
  return nodes.some((n) => {
    if (v.kind(n) !== 'resistor') return false;
    const b = v.spec(n).behavior;
    const other = `${partOf(n)}:${pinOf(n) === b.a ? b.b : b.a}`;
    return s.nets[v.netOf(other)]?.some((m) => DRIVE.includes(v.fn(m)));
  });
}

/**
 * LED yang tinggal kurang satu kabel: anoda sudah ke Arduino, katoda belum ke GND, padahal rel −
 * di breadboard yang sama sudah tersambung ke GND. Sarannya: kabel dari jalur katoda ke rel itu.
 */
function openLeds(s) {
  const v = view(s);
  const out = [];
  for (const { id } of s.parts) {
    const spec = v.spec(`${id}:`);
    const b = spec?.behavior;
    if (!['led', 'rgb-led'].includes(b?.kind)) continue;
    const anodes = b.kind === 'led' ? [b.anode] : [b.red, b.green, b.blue];
    if (!anodes.some((a) => anodeDriven(s, `${id}:${a}`))) continue;
    const cathode = `${id}:${b.cathode}`;
    const net = v.netOf(cathode);
    const nodes = s.nets[net];
    // katoda harus "menggantung": tidak ke GND dan tidak ke komponen lain (mis. transistor)
    if (nodes.some((n) => n !== cathode && (v.kind(n) === 'mcu' || v.kind(n) === 'source' || (v.isComponent(n) && v.kind(n) !== 'none')))) continue;
    const holes = nodes.filter((n) => v.kind(n) === 'breadboard' && !s.occupied.has(n) && hole(pinOf(n)));
    if (!holes.length) continue;
    const board = partOf(holes[0]);
    const col = hole(pinOf(holes[0])).col;
    const rails = s.nets
      .filter((ns) => ns.some((n) => GROUND.includes(v.fn(n))))
      .flatMap((ns) => ns.filter((n) => partOf(n) === board && v.fn(n) === 'rail-' && !s.occupied.has(n)))
      .map((n) => ({ n, col: Number(pinOf(n).slice(2)), front: pinOf(n).startsWith('b') }))
      .sort((a, c) => Math.abs(a.col - col) - Math.abs(c.col - col) || a.col - c.col);
    if (!rails.length) continue;
    const rail = rails[0];
    const gnd = s.nets[v.netOf(rail.n)].find((n) => GROUND.includes(v.fn(n)));
    // baris a menempel ke rel depan (bp/bn), baris j ke rel belakang (tp/tn)
    const near = rail.front ? 0 : 9;
    const from = holes.sort((a, c) => Math.abs(hole(pinOf(a)).row - near) - Math.abs(hole(pinOf(c)).row - near))[0];
    out.push({ severity: 'warn', code: 'led-open', net, nodes: [cathode, gnd], suggest: rail.n, fix: { add: [from, rail.n] } });
  }
  return out;
}

const ROWS = 'abcdefghij';
const hole = (id) => {
  const m = /^([a-j])(\d+)$/.exec(id);
  return m && { row: ROWS.indexOf(m[1]), col: Number(m[2]) };
};

/**
 * Kabel dari pin Arduino/catu yang berakhir di jalur breadboard tanpa komponen, padahal lubang yang
 * disarankan untuk pin itu ada di kolom yang sama (seberang parit) atau satu kolom di sebelahnya.
 */
function misplacedWires(s) {
  const v = view(s);
  const out = [];
  for (const w of s.wires) {
    for (const [end, other] of [['to', 'from'], ['from', 'to']]) {
      const at = w[end];
      const src = w[other];
      if (v.kind(at) !== 'breadboard' || !['mcu', 'source'].includes(v.kind(src))) continue;
      const h = hole(pinOf(at));
      const net = s.nets[v.netOf(at)];
      if (!h || net.some((n) => v.isComponent(n) && v.kind(n) !== 'none')) continue;
      const near = recommend(s, src)
        .targets.filter((n) => partOf(n) === partOf(at))
        .map((n) => ({ n, t: hole(pinOf(n)) }))
        .filter(({ t }) => t && Math.abs(t.col - h.col) <= 1)
        .sort((a, b) => Math.abs(a.t.col - h.col) - Math.abs(b.t.col - h.col) || Math.abs(a.t.row - h.row) - Math.abs(b.t.row - h.row))[0];
      if (!near) continue;
      out.push({ severity: 'warn', code: 'wire-misplaced', net: v.netOf(at), nodes: [src, at], suggest: near.n, fix: { wireId: w.id, end, to: near.n } });
    }
  }
  return out;
}

/** Anoda di net pin digital/5V dan katoda (kaki LED yang sama) langsung di net ground. */
function ledWithoutResistor(s, anode, anodeFns) {
  if (!['mcu-digital', 'mcu-5v', 'supply-5v'].some((f) => anodeFns.includes(f))) return false;
  const v = view(s);
  const b = v.spec(anode).behavior;
  const cathode = `${partOf(anode)}:${b.cathode ?? b.common}`;
  const i = v.netOf(cathode);
  return i !== undefined && s.nets[i].some((n) => GROUND.includes(v.fn(n)));
}

/**
 * Kabel yang ikut menyala untuk sebuah masalah: kabel di pin komponennya, lalu kabel di pin Uno-nya,
 * dan baru semua kabel di net bila keduanya tidak berkabel langsung.
 */
export function issueWires(issue, s) {
  if (issue.fix?.add) return []; // kabel kurang, bukan kabel salah
  if (issue.fix) return [issue.fix.wireId];
  for (const node of issue.nodes) {
    const ids = s.wires.filter((w) => w.from === node || w.to === node).map((w) => w.id);
    if (ids.length) return ids;
  }
  const net = new Set(s.nets[issue.net]);
  return s.wires.filter((w) => net.has(w.from) || net.has(w.to)).map((w) => w.id);
}
