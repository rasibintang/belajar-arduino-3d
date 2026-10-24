import { COMPONENT_BY_TYPE } from '../components/index.js';
import { normalizeProps } from './validate.js';

const ENDPOINT = '/api/ai';
const HIDDEN = new Set(['breadboard', 'breadboard-full', 'breadboard-mini', 'junction', 'text']);

/** GET /api/ai → { enabled, provider, label } (gagal → tidak aktif). */
export async function fetchAiInfo(fetchImpl = fetch) {
  try {
    const res = await fetchImpl(ENDPOINT);
    return await res.json();
  } catch {
    return { enabled: false, provider: null, label: null };
  }
}

/** POST /api/ai. Gagal jaringan → { ok: false, code: 'network' }. */
export async function requestCircuit({ prompt, mode, lang, current = null, token, fetchImpl = fetch }) {
  try {
    const res = await fetchImpl(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ prompt, mode, lang, current }),
    });
    return await res.json();
  } catch {
    return { ok: false, code: 'network' };
  }
}

/**
 * Rangkaian logis dari snapshot sandbox (wb.snapshot()): komponen (tanpa breadboard) dan sambungan
 * pin-ke-pin per net. Alias pin Uno di net yang sama (GND/GND.1, A4/SDA) diwakili satu pin —
 * yang berkabel bila ada.
 */
export function logicalCircuit(s, propsById) {
  const kept = new Map(s.parts.filter((p) => !HIDDEN.has(p.type)).map((p) => [p.id, p.type]));
  const wired = new Set(s.wires.flatMap((w) => [w.from, w.to]));
  const connections = [];
  for (const net of s.nets) {
    const byPart = new Map();
    for (const node of net) {
      const id = node.slice(0, node.indexOf(':'));
      if (!kept.has(id)) continue;
      const mcu = COMPONENT_BY_TYPE[kept.get(id)].behavior.kind === 'mcu';
      const key = mcu ? id : node;
      if (!byPart.has(key) || (wired.has(node) && !wired.has(byPart.get(key)))) byPart.set(key, node);
    }
    const nodes = [...byPart.values()];
    for (let i = 1; i < nodes.length; i++) connections.push({ from: nodes[i - 1], to: nodes[i] });
  }
  const parts = [...kept].map(([id, type]) => ({ id, type, props: propsById[id] ?? {} }));
  return { parts, connections };
}

/** Apa yang berubah dari rangkaian saat ini (props objek) ke hasil AI (props [{ key, value }]). */
export function diffCircuits(before, after) {
  const propsOf = (p) => (Array.isArray(p.props) ? normalizeProps(p.type, p.props) : p.props ?? {});
  const old = new Map(before.parts.map((p) => [p.id, p]));
  const now = new Map(after.parts.map((p) => [p.id, p]));
  const pair = (c) => [c.from, c.to].sort().join('|');
  const oldWires = new Set(before.connections.map(pair));
  const newWires = new Set(after.connections.map(pair));
  return {
    added: [...now.keys()].filter((id) => !old.has(id)),
    removed: [...old.keys()].filter((id) => !now.has(id)),
    changedProps: [...now.keys()].filter((id) => old.has(id) && JSON.stringify(propsOf(old.get(id))) !== JSON.stringify(propsOf(now.get(id)))),
    wiresAdded: [...newWires].filter((w) => !oldWires.has(w)).length,
    wiresRemoved: [...oldWires].filter((w) => !newWires.has(w)).length,
    sketchChanged: (before.sketch ?? '') !== (after.sketch ?? ''),
  };
}
