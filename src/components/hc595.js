import { createDIP } from '../parts/dip.js';
import { PITCH } from '../parts/lib.js';

// Tampak atas, takik di kiri: pin 1–8 di depan (kiri→kanan), pin 9–16 di belakang (kanan→kiri)
const NAMES = ['Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6', 'Q7', 'GND', "Q7'", 'MR', 'SH_CP', 'ST_CP', 'OE', 'DS', 'Q0', 'VCC'];
const LABEL = {
  GND: 'Ground',
  VCC: '5 V',
  DS: 'Data serial (DS)',
  SH_CP: 'Detak geser (SH_CP)',
  ST_CP: 'Kunci / latch (ST_CP)',
  OE: 'Output enable (aktif LOW)',
  MR: 'Reset (aktif LOW)',
  "Q7'": 'Keluaran berantai',
};

export default {
  type: 'hc595',
  name: 'Shift register 74HC595',
  category: 'basic',
  icon: 'chip',
  desc: '8 output dari 3 pin: data masuk satu per satu, keluar serentak. Pasang mengangkangi parit.',
  surface: 'breadboard',
  create: () => createDIP({ pins: 16, label: '74HC595', key: 'hc595', name: 'Shift register 74HC595', desc: '8 bit masuk lewat satu kabel, keluar serentak.' }),
  pins: NAMES.map((id, i) => {
    const front = i < 8;
    const x = front ? (i - 3.5) * PITCH : (15 - i - 3.5) * PITCH;
    return { id, name: `${i + 1} · ${LABEL[id] ?? `Keluaran ${id}`}`, at: [x, 0, front ? 3.81 : -3.81] };
  }),
  behavior: {
    kind: 'hc595',
    vcc: 'VCC',
    gnd: 'GND',
    data: 'DS',
    shift: 'SH_CP',
    latch: 'ST_CP',
    oe: 'OE',
    mr: 'MR',
    outputs: ['Q0', 'Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6', 'Q7'],
    chain: "Q7'",
  },
};
