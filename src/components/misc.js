import { createPowerSymbol, createTextLabel, createJunction, createRelayDPDT, createA4988, createNema17, A4988_FRONT, A4988_BACK } from '../parts/misc-extra.js';
import { PITCH } from '../parts/lib.js';
import { headerPins } from './spec.js';

export const vcc = {
  type: 'vcc',
  name: 'Simbol VCC (5 V)',
  category: 'misc',
  icon: 'bolt',
  desc: 'Titik 5 V siap pakai — tidak perlu menarik kabel dari Arduino.',
  surface: 'floor',
  create: () => createPowerSymbol('VCC'),
  pins: headerPins({ VCC: '5 V' }),
  behavior: { kind: 'source', pin: 'VCC', volts: 5 },
};

export const gnd = {
  type: 'gnd',
  name: 'Simbol GND (0 V)',
  category: 'misc',
  icon: 'gnd',
  desc: 'Titik ground siap pakai.',
  surface: 'floor',
  create: () => createPowerSymbol('GND'),
  pins: headerPins({ GND: 'Ground' }),
  behavior: { kind: 'source', pin: 'GND', volts: 0 },
};

export const text = {
  type: 'text',
  name: 'Teks',
  category: 'misc',
  icon: 'tag',
  desc: 'Catatan bebas di meja kerja.',
  surface: 'floor',
  create: () => createTextLabel(),
  apply: (group, props) => group.userData.setText(props.text),
  props: [{ key: 'text', label: 'Isi', type: 'text', value: 'Catatan' }],
  pins: [],
  behavior: { kind: 'none' },
};

export const junction = {
  type: 'junction',
  name: 'Junction',
  category: 'misc',
  icon: 'pin',
  desc: 'Titik sambung untuk mencabangkan beberapa kabel.',
  surface: 'floor',
  create: () => createJunction(),
  pins: headerPins({ J: 'Titik sambung' }),
  behavior: { kind: 'none' },
};

// depan (kiri→kanan) dan belakang (kiri→kanan)
const DPDT_FRONT = ['COIL1', 'NC1', 'P1', 'NO1'];
const DPDT_BACK = ['COIL2', 'NC2', 'P2', 'NO2'];
const DPDT_LABEL = { COIL1: 'Kumparan 1', COIL2: 'Kumparan 2', P1: 'Common 1', P2: 'Common 2', NC1: 'NC 1', NC2: 'NC 2', NO1: 'NO 1', NO2: 'NO 2' };
export const relayDPDT = {
  type: 'relay-dpdt',
  name: 'Relay DPDT',
  category: 'output',
  icon: 'relay',
  desc: 'Relay telanjang 5 V dengan dua set kontak. Kumparan perlu transistor dan dioda pada rangkaian nyata.',
  surface: 'breadboard',
  create: () => createRelayDPDT(),
  pins: [
    ...DPDT_FRONT.map((id, i) => ({ id, name: DPDT_LABEL[id], at: [(i - 1.5) * PITCH, 0, 3.81] })),
    ...DPDT_BACK.map((id, i) => ({ id, name: DPDT_LABEL[id], at: [(i - 1.5) * PITCH, 0, -3.81] })),
  ],
  behavior: { kind: 'dpdt', coil1: 'COIL1', coil2: 'COIL2', p1: 'P1', nc1: 'NC1', no1: 'NO1', p2: 'P2', nc2: 'NC2', no2: 'NO2' },
};

const A4988_LABEL = {
  ENABLE: 'Enable (aktif LOW)',
  MS1: 'Mikrolangkah 1',
  MS2: 'Mikrolangkah 2',
  MS3: 'Mikrolangkah 3',
  RESET: 'Reset (aktif LOW)',
  SLEEP: 'Sleep (aktif LOW)',
  STEP: 'Langkah',
  DIR: 'Arah',
  VMOT: 'Daya motor',
  GND: 'Ground motor',
  '2B': 'Kumparan 2 (B)',
  '2A': 'Kumparan 2 (A)',
  '1A': 'Kumparan 1 (A)',
  '1B': 'Kumparan 1 (B)',
  VDD: 'Logika 5 V',
  GND2: 'Ground logika',
};
export const a4988 = {
  type: 'a4988',
  name: 'Driver stepper A4988',
  category: 'motor',
  icon: 'chip',
  desc: 'Tiap pulsa STEP = satu langkah; DIR = arah. Sambungkan RESET ke SLEEP. MS1–MS3 memilih mikrolangkah.',
  surface: 'breadboard',
  create: () => createA4988(),
  pins: [
    ...A4988_FRONT.map((id, i) => ({ id, name: A4988_LABEL[id], at: [(i - 3.5) * PITCH, 0, 3.81] })),
    ...A4988_BACK.map((id, i) => ({ id, name: A4988_LABEL[id], at: [(i - 3.5) * PITCH, 0, -3.81] })),
  ],
  behavior: {
    kind: 'a4988',
    step: 'STEP',
    dir: 'DIR',
    enable: 'ENABLE',
    sleep: 'SLEEP',
    reset: 'RESET',
    vdd: 'VDD',
    gnd: 'GND2',
    ms: ['MS1', 'MS2', 'MS3'],
    outputs: ['1A', '1B', '2A', '2B'],
  },
};

export const nema17 = {
  type: 'stepper-bipolar',
  name: 'Motor stepper bipolar (NEMA 17)',
  category: 'motor',
  icon: 'stepper',
  desc: '200 langkah per putaran. Kumparan A (A+, A−) dan B (B+, B−): pakai driver A4988 atau H-bridge.',
  surface: 'floor',
  create: () => createNema17(),
  pins: headerPins({ 'A-': 'Kumparan A −', 'A+': 'Kumparan A +', 'B+': 'Kumparan B +', 'B-': 'Kumparan B −' }),
  behavior: { kind: 'bipolar', inputs: ['A+', 'A-', 'B+', 'B-'], stepsPerRev: 200 },
};

export const biaxial = {
  type: 'stepper-biaxial',
  name: 'Motor stepper biaxial',
  category: 'motor',
  icon: 'stepper',
  desc: 'Dua stepper bipolar dalam satu badan (jarum luar = motor 1, jarum dalam = motor 2), mis. untuk jam.',
  surface: 'floor',
  create: () => createNema17({ biaxial: true }),
  pins: headerPins(Object.fromEntries(['A1-', 'A1+', 'B1+', 'B1-', 'A2-', 'A2+', 'B2+', 'B2-'].map((id) => [id, `Motor ${id[1]} · kumparan ${id[0]} ${id[2] === '+' ? '+' : '−'}`]))),
  behavior: { kind: 'bipolar', inputs: ['A1+', 'A1-', 'B1+', 'B1-', 'A2+', 'A2-', 'B2+', 'B2-'], stepsPerRev: 200 },
};
