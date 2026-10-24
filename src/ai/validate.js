import { COMPONENT_BY_TYPE, pinIdsOf, defaultProps } from '../components/index.js';

// Validasi jawaban AI terhadap registri komponen. Pesan dalam bahasa Inggris karena dikirim
// kembali ke AI untuk diperbaiki.

const NOT_ALLOWED = new Set(['breadboard', 'breadboard-full', 'breadboard-mini', 'junction', 'text']);
const ID = /^[a-z][a-z0-9]{0,11}$/;

/** Nilai teks dari AI → tipe nilai bawaan prop (angka bila pilihannya angka). */
function coerce(def, raw) {
  const sample = def.options?.[0]?.value ?? def.value;
  if (typeof sample === 'number') {
    const n = Number(raw);
    return Number.isFinite(n) ? n : raw;
  }
  if (typeof sample === 'boolean') return raw === 'true' ? true : raw === 'false' ? false : raw;
  return raw;
}

function checkProp(def, value) {
  if (def.options) return def.options.some((o) => o.value === value);
  if (def.type === 'range') return typeof value === 'number' && value >= def.min && value <= def.max;
  return typeof value === typeof def.value || def.value === undefined;
}

/** props [{ key, value }] → objek props bertipe (hanya kunci yang dikenal). */
export function normalizeProps(type, props = []) {
  const spec = COMPONENT_BY_TYPE[type];
  const out = {};
  for (const { key, value } of props) {
    const def = spec?.props?.find((p) => p.key === key);
    if (def) out[key] = coerce(def, value);
  }
  return out;
}

/** → daftar kesalahan (kosong = sah). */
export function validateCircuit(c) {
  const errors = [];
  const parts = new Map();
  const unos = c.parts.filter((p) => p.type === 'arduino-uno');
  if (unos.length !== 1 || unos[0].id !== 'uno') errors.push('there must be exactly one arduino-uno with id "uno"');

  for (const p of c.parts) {
    if (parts.has(p.id)) errors.push(`duplicate id "${p.id}"`);
    if (!ID.test(p.id)) errors.push(`id "${p.id}" must be lowercase letters/digits, starting with a letter, max 12 chars`);
    const spec = COMPONENT_BY_TYPE[p.type];
    if (NOT_ALLOWED.has(p.type)) errors.push(`do not declare "${p.type}" — breadboards are added automatically and wires go pin to pin`);
    else if (!spec) errors.push(`unknown component type "${p.type}" — use only catalog types`);
    else {
      for (const { key, value } of p.props ?? []) {
        const def = spec.props?.find((d) => d.key === key);
        if (!def) errors.push(`unknown prop "${key}" on ${p.id}`);
        else if (!checkProp(def, coerce(def, value))) errors.push(`invalid value "${value}" for ${p.id}.${key}`);
      }
    }
    parts.set(p.id, spec);
  }

  const pinsOf = new Map();
  const pinOk = (node) => {
    const m = /^([a-z][a-z0-9]*):(.+)$/.exec(node);
    if (!m) return `"${node}" must look like "part:pin"`;
    const [, id, pin] = m;
    if (!parts.has(id)) return `undeclared part "${id}" in "${node}"`;
    const spec = parts.get(id);
    if (!spec) return null; // tipe tak dikenal sudah dilaporkan
    if (!pinsOf.has(id)) pinsOf.set(id, new Set(pinIdsOf(spec, { ...defaultProps(spec), ...normalizeProps(spec.type, c.parts.find((p) => p.id === id).props) })));
    if (!pinsOf.get(id).has(pin)) return `unknown pin "${pin}" on ${id} (${spec.type}); valid pins: ${[...pinsOf.get(id)].slice(0, 40).join(', ')}`;
    return null;
  };
  for (const { from, to } of c.connections) {
    for (const node of [from, to]) {
      const err = pinOk(node);
      if (err) errors.push(err);
    }
    if (from === to) errors.push(`"${from}" connects a pin to itself`);
  }
  if (c.feasible && !c.sketch?.trim()) errors.push('sketch is empty');
  return [...new Set(errors)];
}
