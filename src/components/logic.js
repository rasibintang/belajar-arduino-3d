import { createGate, createBlock, GATE_DESC } from '../parts/logic.js';
import { createDIP } from '../parts/dip.js';
import { createMux16, MUX_CTRL, MUX_CH } from '../parts/misc-extra.js';
import { PITCH } from '../parts/lib.js';
import { headerPins } from './spec.js';

const PIN_NAME = {
  A: 'Masukan A',
  B: 'Masukan B',
  Y: 'Keluaran Y',
  D: 'Data',
  CLK: 'Detak (tepi naik)',
  Q: 'Keluaran Q',
  NOTQ: 'Keluaran Q̅ (kebalikan Q)',
  R: 'Reset (aktif HIGH)',
  S: 'Set (aktif HIGH)',
  SEL: 'Pilih (LOW = A, HIGH = B)',
  OUT: 'Keluaran',
};
const names = (ids) => headerPins(Object.fromEntries(ids.map((id) => [id, PIN_NAME[id] ?? id])));

function gate(type) {
  const inputs = type === 'NOT' ? ['A'] : ['A', 'B'];
  return {
    type: `gate-${type.toLowerCase()}`,
    name: `Gerbang ${type}`,
    category: 'logic',
    icon: 'logic',
    desc: `${GATE_DESC[type]}. Gerbang ideal: tidak perlu catu daya.`,
    surface: 'floor',
    create: () => createGate(type),
    pins: names([...inputs, 'Y']),
    behavior: { kind: 'gate', fn: type, inputs, y: 'Y' },
  };
}

export const gates = ['NOT', 'AND', 'OR', 'XOR', 'NAND', 'NOR', 'XNOR'].map(gate);

export const mux2 = {
  type: 'mux-2',
  name: 'Multiplexer 2:1',
  category: 'logic',
  icon: 'logic',
  desc: 'Meneruskan A atau B ke OUT sesuai SEL.',
  surface: 'floor',
  create: () => createBlock({ title: 'MUX', inputs: ['A', 'B', 'SEL'], outputs: ['OUT'], key: 'mux2', name: 'Multiplexer 2:1', desc: 'OUT = SEL ? B : A' }),
  pins: names(['A', 'B', 'SEL', 'OUT']),
  behavior: { kind: 'mux2', a: 'A', b: 'B', sel: 'SEL', out: 'OUT' },
};

function flipFlop({ type, title, extra, desc }) {
  const inputs = ['D', 'CLK', ...extra];
  return {
    type,
    name: title,
    category: 'logic',
    icon: 'memory',
    desc,
    surface: 'floor',
    create: () => createBlock({ title: 'D FF', inputs, outputs: ['Q', 'NOTQ'], key: type, name: title, desc }),
    pins: names([...inputs, 'Q', 'NOTQ']),
    behavior: { kind: 'dff', d: 'D', clk: 'CLK', q: 'Q', notq: 'NOTQ', set: extra.includes('S') ? 'S' : undefined, reset: extra.includes('R') ? 'R' : undefined },
  };
}

export const flipFlops = [
  flipFlop({ type: 'flip-flop-d', title: 'Flip-flop D', extra: [], desc: 'Menyimpan 1 bit: Q = D pada setiap tepi naik CLK.' }),
  flipFlop({ type: 'flip-flop-dr', title: 'Flip-flop D + reset', extra: ['R'], desc: 'Seperti flip-flop D; R HIGH memaksa Q = 0.' }),
  flipFlop({ type: 'flip-flop-dsr', title: 'Flip-flop D + set/reset', extra: ['S', 'R'], desc: 'S HIGH memaksa Q = 1, R HIGH memaksa Q = 0.' }),
];

export const clockGen = {
  type: 'clock-generator',
  name: 'Generator clock',
  category: 'logic',
  icon: 'clock',
  desc: 'Gelombang kotak 50 % dengan frekuensi pilihan (berjalan bersama simulasi).',
  surface: 'floor',
  create: () => createBlock({ title: 'CLK', inputs: [], outputs: ['CLK'], key: 'clock', name: 'Generator clock', desc: 'Detak teratur.' }),
  props: [
    {
      key: 'hz',
      label: 'Frekuensi',
      type: 'choice',
      value: 1,
      options: [0.5, 1, 2, 5, 10, 100, 1000].map((value) => ({ value, label: value >= 1000 ? '1 kHz' : `${value} Hz` })),
    },
  ],
  pins: headerPins({ CLK: 'Keluaran detak' }),
  behavior: { kind: 'clock', clk: 'CLK', hzProp: 'hz' },
};

// 74HC165: kaki 1–8 di depan (kiri→kanan), 9–16 di belakang (kanan→kiri)
const HC165 = ['PL', 'CP', 'D4', 'D5', 'D6', 'D7', 'NOTQ7', 'GND', 'Q7', 'DS', 'D0', 'D1', 'D2', 'D3', 'CE', 'VCC'];
const HC165_LABEL = {
  PL: 'Muat paralel (aktif LOW)',
  CP: 'Detak geser',
  NOTQ7: 'Keluaran Q7 terbalik',
  GND: 'Ground',
  Q7: 'Keluaran seri',
  DS: 'Masukan seri (berantai)',
  CE: 'Clock enable (aktif LOW)',
  VCC: '5 V',
};
export const hc165 = {
  type: 'hc165',
  name: 'Shift register 74HC165',
  category: 'logic',
  icon: 'chip',
  desc: 'Membaca 8 masukan lewat 3 pin: PL LOW memuat, lalu tiap detak CP menggeser satu bit ke Q7.',
  surface: 'breadboard',
  create: () => createDIP({ pins: 16, label: '74HC165', key: 'hc165', name: 'Shift register 74HC165', desc: '8 masukan paralel → 1 keluaran seri.' }),
  pins: HC165.map((id, i) => {
    const front = i < 8;
    const x = front ? (i - 3.5) * PITCH : (15 - i - 3.5) * PITCH;
    return { id, name: `${i + 1} · ${HC165_LABEL[id] ?? `Masukan ${id}`}`, at: [x, 0, front ? 3.81 : -3.81] };
  }),
  behavior: {
    kind: 'hc165',
    vcc: 'VCC',
    gnd: 'GND',
    pl: 'PL',
    cp: 'CP',
    ce: 'CE',
    q7: 'Q7',
    notq7: 'NOTQ7',
    ds: 'DS',
    inputs: ['D0', 'D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7'],
  },
};

const MUX_LABEL = { SIG: 'Sinyal bersama', EN: 'Enable (aktif LOW)', VCC: '5 V', GND: 'Ground' };
export const mux16 = {
  type: 'cd74hc4067',
  name: 'Multiplexer analog 16 kanal',
  category: 'logic',
  icon: 'chip',
  desc: 'CD74HC4067: SIG tersambung ke satu dari 16 kanal sesuai S0–S3 — bisa untuk analog maupun digital.',
  surface: 'floor',
  create: () => createMux16(),
  pins: headerPins(Object.fromEntries([...MUX_CTRL, ...MUX_CH].map((id) => [id, MUX_LABEL[id] ?? (id[0] === 'S' ? `Pilih ${id}` : `Kanal ${id.slice(1)}`)]))),
  behavior: { kind: 'mux16', sig: 'SIG', en: 'EN', vcc: 'VCC', gnd: 'GND', select: ['S0', 'S1', 'S2', 'S3'], outputs: MUX_CH },
};
