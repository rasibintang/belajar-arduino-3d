import { COMPONENT_BY_TYPE } from '../../components/index.js';
import { connectNets } from '../netlist.js';
import { pinFunction } from './pin-functions.js';

/**
 * Snapshot rangkaian untuk panduan kabel (murni, tanpa 3D):
 * { parts: [{ id, type }], wires: [{ id, from, to }], nets: string[][], occupied: Set<lubang terisi> }
 */
export function snapshotFromTopology({ parts, wires, inserted }) {
  const { groupNodes } = connectNets({
    parts: parts.map((p) => ({ id: p.id, spec: COMPONENT_BY_TYPE[p.type], pinIds: p.pinIds })),
    wires,
    inserted,
  });
  const boards = new Set(parts.filter((p) => COMPONENT_BY_TYPE[p.type].behavior.kind === 'breadboard').map((p) => p.id));
  const occupied = new Set(inserted.values());
  for (const w of wires) for (const n of [w.from, w.to]) if (boards.has(partOf(n))) occupied.add(n);
  return {
    parts: parts.map(({ id, type }) => ({ id, type })),
    wires: wires.map(({ id, from, to }) => ({ id, from, to })),
    nets: groupNodes,
    occupied,
  };
}

export const partOf = (node) => node.slice(0, node.indexOf(':'));
export const pinOf = (node) => node.slice(node.indexOf(':') + 1);

const views = new WeakMap();

/**
 * Alat baca atas sebuah snapshot (di-cache per snapshot):
 * netOf(node) → indeks net · spec(node) · kind(node) · fn(node) → fungsi pin (PIN_FNS)
 */
export function view(s) {
  if (views.has(s)) return views.get(s);
  const netIndex = new Map();
  s.nets.forEach((nodes, i) => nodes.forEach((n) => netIndex.set(n, i)));
  const types = new Map(s.parts.map((p) => [p.id, p.type]));
  const fns = new Map();
  const v = {
    netOf: (node) => netIndex.get(node),
    spec: (node) => COMPONENT_BY_TYPE[types.get(partOf(node))],
    kind: (node) => v.spec(node)?.behavior.kind,
    fn(node) {
      if (!fns.has(node)) fns.set(node, v.spec(node) ? pinFunction(v.spec(node), pinOf(node)) : 'neutral');
      return fns.get(node);
    },
    /** Pin komponen sungguhan (bukan papan Uno, bukan lubang breadboard). */
    isComponent: (node) => !['mcu', 'breadboard'].includes(v.kind(node)),
  };
  views.set(s, v);
  return v;
}
