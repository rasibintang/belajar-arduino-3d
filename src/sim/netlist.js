import * as THREE from 'three';

const SNAP = 0.9; // mm: jarak maksimum kaki ke lubang breadboard agar dianggap tertancap

/** Union-find sederhana. */
class DSU {
  constructor() {
    this.parent = new Map();
  }
  find(x) {
    if (!this.parent.has(x)) this.parent.set(x, x);
    let r = x;
    while (this.parent.get(r) !== r) r = this.parent.get(r);
    while (this.parent.get(x) !== r) {
      const next = this.parent.get(x);
      this.parent.set(x, r);
      x = next;
    }
    return r;
  }
  union(a, b) {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent.set(ra, rb);
  }
}

/**
 * Satukan titik-titik yang terhubung listrik (murni, tanpa posisi 3D).
 * parts: [{ id, spec, pinIds }] · wires: [{ from, to }] · inserted: Map<kaki, lubang>
 */
export function connectNets({ parts, wires, inserted }) {
  const dsu = new DSU();
  const nodes = new Set();
  for (const part of parts) {
    for (const pin of part.pinIds) {
      const node = `${part.id}:${pin}`;
      nodes.add(node);
      dsu.find(node);
    }
  }
  const join = (a, b) => {
    if (nodes.has(a) && nodes.has(b)) dsu.union(a, b);
  };

  // kabel
  for (const w of wires) join(w.from, w.to);

  for (const part of parts) {
    const b = part.spec.behavior;
    const n = (pin) => `${part.id}:${pin}`;
    // breadboard: jalur tembaga internal
    if (b.kind === 'breadboard') {
      const strips = new Map();
      for (const pin of part.pinIds) {
        const strip = b.strip(pin);
        if (strips.has(strip)) dsu.union(n(pin), strips.get(strip));
        else strips.set(strip, n(pin));
      }
    }
    // sambungan tetap di dalam komponen (papan Uno, sisi tombol, dll.)
    if (b.kind === 'mcu') {
      for (const g of ['GND.1', 'GND.2']) join(n('GND'), n(g));
      join(n('SDA'), n('A4'));
      join(n('SCL'), n('A5'));
      join(n('5V'), n('IOREF'));
    }
    for (const [a, c] of b.always ?? []) join(n(a), n(c));
  }

  // kaki komponen yang tertancap
  for (const [leg, hole] of inserted) join(leg, hole);

  const nodeGroup = new Map();
  const roots = new Map();
  for (const node of nodes) {
    const r = dsu.find(node);
    if (!roots.has(r)) roots.set(r, roots.size);
    nodeGroup.set(node, roots.get(r));
  }
  const groupNodes = Array.from({ length: roots.size }, () => []);
  for (const [node, g] of nodeGroup) groupNodes[g].push(node);
  return { nodeGroup, groupNodes };
}

/** Posisi dunia semua pin. parts: [{ id, group }] */
function pinPositions(parts) {
  const pinWorld = new Map();
  const tmp = new THREE.Vector3();
  for (const part of parts) {
    part.group.updateMatrixWorld(true);
    for (const pin of part.group.userData.component.pins) {
      pinWorld.set(`${part.id}:${pin.id}`, part.group.localToWorld(tmp.copy(pin.at)).clone());
    }
  }
  return pinWorld;
}

/** Kaki komponen yang tertancap di lubang breadboard → Map<kaki, lubang>. */
export function insertedLegs(parts, pinWorld = pinPositions(parts)) {
  const holeGrid = new Map(); // kunci kisi -> [node]
  const key = (v) => `${Math.round(v.x / 1.27)}|${Math.round(v.z / 1.27)}`;
  for (const bb of parts) {
    if (bb.spec.behavior.kind !== 'breadboard') continue;
    for (const pin of bb.group.userData.component.pins) {
      const node = `${bb.id}:${pin.id}`;
      const k = key(pinWorld.get(node));
      if (!holeGrid.has(k)) holeGrid.set(k, []);
      holeGrid.get(k).push(node);
    }
  }
  const inserted = new Map();
  for (const part of parts) {
    if (part.spec.surface !== 'breadboard') continue;
    for (const pin of part.group.userData.component.pins) {
      const node = `${part.id}:${pin.id}`;
      const pos = pinWorld.get(node);
      let best = null;
      let bestD = SNAP;
      const [gx, gz] = key(pos).split('|').map(Number);
      for (let dx = -1; dx <= 1; dx++) {
        for (let dz = -1; dz <= 1; dz++) {
          for (const hole of holeGrid.get(`${gx + dx}|${gz + dz}`) ?? []) {
            const hp = pinWorld.get(hole);
            const d = Math.hypot(hp.x - pos.x, hp.z - pos.z);
            if (d < bestD && Math.abs(hp.y - pos.y) < 3) {
              best = hole;
              bestD = d;
            }
          }
        }
      }
      if (best) inserted.set(node, best);
    }
  }
  return inserted;
}

/** Netlist lengkap dari komponen yang sudah ditempatkan. parts: [{ id, spec, group }] */
export function buildNetlist(parts, wires) {
  const pinWorld = pinPositions(parts);
  const inserted = insertedLegs(parts, pinWorld);
  const { nodeGroup, groupNodes } = connectNets({
    parts: parts.map((p) => ({ id: p.id, spec: p.spec, pinIds: p.group.userData.component.pins.map((pin) => pin.id) })),
    wires,
    inserted,
  });
  return { nodeGroup, groupNodes, inserted, pinWorld };
}
