import { COMPONENT_BY_TYPE } from '../src/components/index.js';
import { PIN_NAMES } from '../src/parts/arduino.js';
import { breadboardHoles } from '../src/parts/breadboard.js';
import { snapshotFromTopology } from '../src/sim/wiring/snapshot.js';

/** Id pin sebuah komponen tanpa membuat model 3D: Uno & breadboard lengkap, lainnya dari peran perilaku. */
function pinIdsOf(type) {
  if (type === 'arduino-uno') return PIN_NAMES.filter((id) => id !== 'NC');
  if (type === 'breadboard') return breadboardHoles({ cols: 30 }).map((h) => h.id);
  const b = COMPONENT_BY_TYPE[type].behavior;
  return Object.values(b).flatMap((v) => (typeof v === 'string' ? [v] : Array.isArray(v) && v.every((x) => typeof x === 'string') ? v : []));
}

/**
 * Snapshot untuk tes. parts: { id: type } · wires: [[from, to]] · inserted: [[kaki, lubang]]
 * Pin yang disebut di kabel/kaki selalu ikut, walau tidak punya peran.
 */
export function snap(parts, wires, inserted = []) {
  const mentioned = [...wires.flat(), ...inserted.flat()];
  const list = Object.entries(parts).map(([id, type]) => {
    const pinIds = new Set(pinIdsOf(type));
    for (const node of mentioned) if (node.startsWith(`${id}:`)) pinIds.add(node.slice(id.length + 1));
    return { id, type, pinIds: [...pinIds] };
  });
  return snapshotFromTopology({
    parts: list,
    wires: wires.map(([from, to], i) => ({ id: `w${i + 1}`, from, to })),
    inserted: new Map(inserted),
  });
}
