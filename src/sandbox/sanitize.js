// Pembersih diagram dari sumber yang tidak dipercaya (tautan bagikan, file, proyek akun, AI).
// Diagram orang lain bisa dibuka di sesi pengelola, jadi isinya tidak boleh bisa menyisipkan HTML:
// id komponen dibatasi karakternya, props divalidasi menurut definisinya di registri komponen,
// kabel & posisi yang tidak sah dibuang/dinolkan. Diagram yang sah keluar tanpa berubah.
import { COMPONENT_BY_TYPE } from '../components/index.js';

const ID = /^[A-Za-z0-9_-]{1,40}$/;
const NODE = /^([A-Za-z0-9_-]{1,40}):([A-Za-z0-9_.+/'-]{1,24})$/;
const NAME = /^[A-Za-z0-9_.-]{1,20}$/; // hole, board, warna kabel
const TEXT_MAX = 60;

const finite = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

function cleanProps(spec, props) {
  const out = {};
  if (!spec || !props || typeof props !== 'object') return out;
  for (const def of spec.props ?? []) {
    if (!(def.key in props)) continue;
    const v = props[def.key];
    if (def.type === 'text') out[def.key] = typeof v === 'string' ? v.slice(0, TEXT_MAX) : def.value;
    else if (def.type === 'range') out[def.key] = typeof v === 'number' && Number.isFinite(v) ? Math.min(def.max, Math.max(def.min, v)) : def.value;
    else if (def.type === 'choice' || def.type === 'swatch') out[def.key] = def.options.some((o) => o.value === v) ? v : def.value;
    else if (typeof v === 'number' || typeof v === 'boolean') out[def.key] = v;
  }
  return out;
}

export function sanitizeDiagram(d) {
  if (!d || typeof d !== 'object' || !Array.isArray(d.parts)) return { version: 1, parts: [], wires: [] };
  const used = new Set();
  const rename = new Map(); // id asli → id aman
  let n = 0;
  const fresh = (type) => {
    const base = String(type).replace(/[^A-Za-z0-9]/g, '').slice(0, 20) || 'part';
    let id;
    do id = `${base}${++n}`;
    while (used.has(id));
    return id;
  };
  const parts = [];
  for (const p of d.parts) {
    if (!p || typeof p !== 'object' || typeof p.type !== 'string') continue;
    let id = typeof p.id === 'string' && ID.test(p.id) && !used.has(p.id) ? p.id : null;
    if (!id) {
      id = fresh(p.type);
      if (typeof p.id === 'string' && !rename.has(p.id)) rename.set(p.id, id);
    }
    used.add(id);
    const part = { ...p, id };
    if ('props' in p) part.props = cleanProps(COMPONENT_BY_TYPE[p.type], p.props);
    for (const k of ['x', 'z', 'rot']) if (k in p) part[k] = finite(p[k]);
    for (const k of ['hole', 'board']) if (k in p && !(typeof p[k] === 'string' && NAME.test(p[k]))) delete part[k];
    for (const k of Object.keys(part)) if (!['id', 'type', 'x', 'y', 'z', 'rot', 'props', 'hole', 'board'].includes(k)) delete part[k];
    if ('y' in part) part.y = finite(part.y);
    parts.push(part);
  }
  const node = (s) => {
    const m = typeof s === 'string' && s.match(NODE);
    if (!m) {
      // id lama yang diganti: petakan bagian id, lalu periksa ulang
      const at = typeof s === 'string' ? s.lastIndexOf(':') : -1;
      const mapped = at > 0 && rename.get(s.slice(0, at));
      return mapped && NODE.test(`${mapped}${s.slice(at)}`) ? `${mapped}${s.slice(at)}` : null;
    }
    return used.has(m[1]) ? s : null;
  };
  const wires = [];
  for (const w of Array.isArray(d.wires) ? d.wires : []) {
    const from = node(w?.from);
    const to = node(w?.to);
    if (!from || !to) continue;
    const wire = { from, to };
    if ('color' in w) {
      if (!(typeof w.color === 'string' && NAME.test(w.color))) continue;
      wire.color = w.color;
    }
    wires.push(wire);
  }
  return { ...('version' in d ? { version: 1 } : {}), parts, wires };
}
