import { createBreadboard, breadboardStrip, breadboardHoles } from '../parts/breadboard.js';

const RAIL_NAME = { tp: 'Rel + belakang', tn: 'Rel − belakang', bp: 'Rel + depan', bn: 'Rel − depan' };

/** Spesifikasi breadboard untuk ukuran tertentu (dipakai untuk varian full/half/mini). */
export function breadboardSpec({ type, name, desc, cols, rails }) {
  return {
    type,
    name,
    category: 'breadboard',
    icon: 'breadboard',
    desc,
    surface: 'floor',
    create: () => createBreadboard({ cols, rails }),
    pins: (props, group) =>
      group.userData.holes.map(({ id, row, col }) => ({
        id,
        name: row.length === 2 ? `${RAIL_NAME[row]} · ${col}` : `Lubang ${row}${col}`,
        at: group.userData.hole(row, col),
      })),
    // pinIdsOf tanpa model 3D (urutan sama dengan userData.holes)
    pinNames: () => Object.fromEntries(breadboardHoles({ cols, rails }).map(({ id }) => [id, id])),
    behavior: {
      kind: 'breadboard',
      /** id lubang -> id jalur tembaga internal */
      strip: (id) => {
        const [, row, col] = id.match(/^([a-j]|tp|tn|bp|bn)(\d+)$/);
        return breadboardStrip(row, Number(col));
      },
    },
  };
}

export default breadboardSpec({
  type: 'breadboard',
  name: 'Half breadboard (400 lubang)',
  desc: 'Merangkai tanpa solder. Lubang a–e (dan f–j) satu kolom saling tersambung; rel +/− di tepi.',
  cols: 30,
  rails: true,
});

export const breadboardFull = breadboardSpec({
  type: 'breadboard-full',
  name: 'Breadboard (830 lubang)',
  desc: 'Breadboard ukuran penuh: 63 kolom dengan rel daya di kedua sisi.',
  cols: 63,
  rails: true,
});

export const breadboardMini = breadboardSpec({
  type: 'breadboard-mini',
  name: 'Mini breadboard (170 lubang)',
  desc: '17 kolom tanpa rel daya — pas untuk rangkaian kecil.',
  cols: 17,
  rails: false,
});
