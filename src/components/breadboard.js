import { createBreadboard, breadboardHoles, breadboardStrip } from '../parts/breadboard.js';

const RAIL_NAME = { tp: 'Rel + belakang', tn: 'Rel − belakang', bp: 'Rel + depan', bn: 'Rel − depan' };

export default {
  type: 'breadboard',
  name: 'Breadboard 400 lubang',
  category: 'basic',
  icon: 'breadboard',
  desc: 'Merangkai tanpa solder. Lubang a–e (dan f–j) satu kolom saling tersambung.',
  surface: 'floor',
  create: () => createBreadboard(),
  pins: (props, group) =>
    breadboardHoles().map(({ id, row, col }) => ({
      id,
      name: row.length === 2 ? `${RAIL_NAME[row]} · ${col}` : `Lubang ${row}${col}`,
      at: group.userData.hole(row, col),
    })),
  behavior: {
    kind: 'breadboard',
    /** id lubang -> id jalur tembaga internal */
    strip: (id) => {
      const [, row, col] = id.match(/^([a-j]|tp|tn|bp|bn)(\d+)$/);
      return breadboardStrip(row, Number(col));
    },
  },
};
