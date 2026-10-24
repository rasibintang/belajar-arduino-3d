import { COMPONENT_BY_TYPE, resolvePins, defaultProps } from '../components/index.js';
import { PITCH } from '../parts/lib.js';
import { normalizeProps } from './validate.js';

// Tata letak otomatis untuk rangkaian logis dari AI → diagram.json sandbox.
// Komponen breadboard ditancapkan lewat nama lubang (sandbox sendiri yang menempatkannya);
// posisi kaki dihitung dalam satuan jarak lubang (2,54 mm), jadi tidak butuh model 3D.

const UNO = { x: -82.55, z: 21.59 };
const BOARD = { x: 44.45, z: 0 };
const FLOOR = { x: -110, z: -70, step: 55, perRow: 5 };
const SIZES = [
  { type: 'breadboard', cols: 30 },
  { type: 'breadboard-full', cols: 63 },
];
// tinggi baris dalam satuan jarak lubang (a–e di depan, f–j di belakang parit)
const ROW_Y = { a: 5.5, b: 4.5, c: 3.5, d: 2.5, e: 1.5, f: -1.5, g: -2.5, h: -3.5, i: -4.5, j: -5.5 };
// baris jangkar yang dicoba: komponen satu baris di tengah (sisa lubang untuk kabel), lalu sisanya
const ANCHOR_ROWS = ['c', 'b', 'd', 'a', 'e', 'h', 'i', 'g', 'j', 'f'];
// lubang untuk ujung kabel, dari yang terjauh dari parit
const WIRE_ROWS = { front: ['a', 'b', 'c', 'd', 'e'], back: ['j', 'i', 'h', 'g', 'f'] };

const half = (row) => ('abcde'.includes(row) ? 'front' : 'back');
const strip = (row, col) => `${col}-${half(row)}`;

/** Kaki komponen relatif kaki pertama, dalam satuan jarak lubang. */
function legOffsets(spec, props) {
  const pins = resolvePins(spec, props);
  const p0 = pins[0].at;
  return pins.map((p) => ({ id: p.id, dx: Math.round((p.at.x - p0.x) / PITCH), dz: (p.at.z - p0.z) / PITCH }));
}

/** Lubang tiap kaki bila kaki pertama di (row, col), atau null bila ada yang tidak jatuh di lubang. */
function legHoles(legs, row, col, cols) {
  const out = [];
  for (const leg of legs) {
    const c = col + leg.dx;
    const y = ROW_Y[row] + leg.dz;
    const r = Object.keys(ROW_Y).find((k) => Math.abs(ROW_Y[k] - y) < 0.35);
    if (!r || c < 1 || c > cols) return null;
    out.push({ id: leg.id, row: r, col: c });
  }
  return out;
}

/** Tempat pertama (dari kolom `from`) yang tidak memakai jalur komponen lain. */
function findSpot(legs, from, cols, usedStrips) {
  const minDx = Math.min(...legs.map((l) => l.dx));
  for (let col = from - minDx; col + Math.max(...legs.map((l) => l.dx)) <= cols; col++) {
    for (const row of ANCHOR_ROWS) {
      const holes = legHoles(legs, row, col, cols);
      if (!holes || holes.some((h) => usedStrips.has(strip(h.row, h.col)))) continue;
      // dua kaki satu komponen tidak boleh di jalur yang sama (mis. chip DIP harus melintasi parit)
      if (new Set(holes.map((h) => strip(h.row, h.col))).size === holes.length) return holes;
    }
  }
  return null;
}

function tryLayout(c, previous, size) {
  const prev = new Map((previous?.diagram?.parts ?? []).map((p) => [p.id, p]));
  const prevBoard = previous?.diagram?.parts?.find((p) => p.type.startsWith('breadboard'));
  const boardId = prevBoard?.id ?? 'bb';
  const parts = [];
  const inserted = new Map();
  const usedStrips = new Set();
  const usedHoles = new Set();
  const HOLE = /^(.+):([a-j])(\d+)$/;
  const occupy = (leg, hole) => {
    const m = HOLE.exec(hole);
    inserted.set(leg, hole);
    if (!m || m[1] !== boardId) return;
    usedStrips.add(strip(m[2], Number(m[3])));
    usedHoles.add(`${m[2]}${m[3]}`);
  };
  const onBoard = [];
  const floor = [];

  for (const p of c.parts) {
    const spec = COMPONENT_BY_TYPE[p.type];
    const props = normalizeProps(p.type, p.props);
    const entry = { id: p.id, type: p.type, props };
    const old = prev.get(p.id);
    if (old && old.type === p.type) {
      // mode ubah: komponen lama tetap persis di tempatnya; kakinya menurut sandbox
      const { props: oldProps, ...place } = old;
      parts.push({ ...place, props: { ...oldProps, ...props } });
      for (const [leg, hole] of previous.inserted ?? []) if (leg.startsWith(`${p.id}:`)) occupy(leg, hole);
    } else if (p.type === 'arduino-uno') parts.push({ ...entry, x: UNO.x, z: UNO.z, rot: 0 });
    else if (spec.surface === 'breadboard') onBoard.push({ entry, spec, props });
    else floor.push(entry);
  }

  for (const item of onBoard) {
    const holes = findSpot(legOffsets(item.spec, { ...defaultProps(item.spec), ...item.props }), 2, size.cols, usedStrips);
    if (!holes) return null; // tidak muat: coba breadboard yang lebih besar
    for (const h of holes) occupy(`${item.entry.id}:${h.id}`, `${boardId}:${h.row}${h.col}`);
    parts.push({ ...item.entry, board: boardId, hole: `${holes[0].row}${holes[0].col}`, rot: 0 });
  }

  const taken = parts.filter((p) => p.x !== undefined && p.type !== 'arduino-uno' && !p.type.startsWith('breadboard')).length;
  floor.forEach((entry, n) => {
    const i = taken + n;
    parts.push({ ...entry, x: FLOOR.x + (i % FLOOR.perRow) * FLOOR.step, z: FLOOR.z - Math.floor(i / FLOOR.perRow) * FLOOR.step, rot: 0 });
  });
  // breadboard: yang lama dipertahankan; yang baru hanya bila ada komponen breadboard
  for (const board of previous?.diagram?.parts?.filter((p) => p.type.startsWith('breadboard')) ?? []) parts.splice(1, 0, board);
  if (!prevBoard && onBoard.length) parts.splice(1, 0, { id: 'bb', type: size.type, x: BOARD.x, z: BOARD.z, rot: 0, props: {} });

  // ujung kabel di kaki komponen breadboard → lubang kosong di jalur kaki itu
  const endpoint = (node) => {
    const m = HOLE.exec(inserted.get(node) ?? '');
    if (!m || m[1] !== boardId) return node;
    const [, board, row, col] = m;
    const free = WIRE_ROWS[half(row)].find((r) => !usedHoles.has(`${r}${col}`));
    if (!free) return node; // jalur penuh: langsung ke kakinya (tetap tersambung)
    usedHoles.add(`${free}${col}`);
    return `${board}:${free}${col}`;
  };
  const wires = c.connections.map(({ from, to }) => ({ from: endpoint(from), to: endpoint(to) }));
  return { diagram: { version: 1, parts, wires }, inserted };
}

/**
 * Rangkaian logis (CIRCUIT_SCHEMA) → { diagram, inserted: Map<kaki, lubang> }.
 * previous (mode ubah): { diagram: diagram sandbox saat ini, inserted: Map<kaki, lubang> dari sandbox } —
 * komponen ber-id sama tetap persis di tempatnya dan lubangnya dianggap terpakai.
 */
export function layoutCircuit(c, { previous = null } = {}) {
  const prevBoard = previous?.diagram?.parts?.find((p) => p.type.startsWith('breadboard'));
  const sizes = prevBoard ? SIZES.filter((s) => s.type === prevBoard.type) : SIZES;
  for (const size of sizes.length ? sizes : SIZES) {
    const out = tryLayout(c, previous, size);
    if (out) return out;
  }
  throw new Error(prevBoard ? 'komponen baru tidak muat di breadboard yang ada' : 'rangkaian terlalu besar untuk breadboard 830 lubang');
}
