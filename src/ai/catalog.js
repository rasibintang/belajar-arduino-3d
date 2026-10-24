import { COMPONENTS, pinIdsOf } from '../components/index.js';
import { pinFunction } from '../sim/wiring/pin-functions.js';
import { LIBRARIES } from '../sandbox/libraries.js';

// Komponen yang tidak dipilih AI: breadboard ditambahkan tata letak; sisanya bukan komponen listrik
// yang perlu disusun (titik sambung, teks, simbol catu).
const HIDDEN = new Set(['breadboard', 'breadboard-full', 'breadboard-mini', 'junction', 'text', 'vcc', 'gnd']);

function propLine(p) {
  if (p.options) return `${p.key} ∈ {${p.options.map((o) => JSON.stringify(o.value)).join(', ')}} (default ${JSON.stringify(p.value)})`;
  if (p.type === 'range') return `${p.key}: ${p.min}…${p.max}${p.step ? ` step ${p.step}` : ''} (default ${JSON.stringify(p.value)})`;
  return `${p.key}: ${p.type} (default ${JSON.stringify(p.value)})`;
}

/**
 * Katalog komponen untuk prompt AI, dibangkitkan dari registri (komponen baru otomatis ikut).
 * Deterministik — dipakai sebagai awalan prompt yang di-cache. Teks mengikuti bahasa registri
 * (Inggris di server).
 */
export function buildCatalog() {
  const blocks = [];
  for (const spec of COMPONENTS) {
    if (HIDDEN.has(spec.type)) continue;
    const pins = pinIdsOf(spec).map((id) => `${id}(${pinFunction(spec, id)})`);
    const lines = [
      `## ${spec.type} — ${spec.name} [${spec.category}; ${spec.surface === 'breadboard' ? 'plugs into breadboard' : 'stands on the table'}]`,
      spec.desc,
      `pins: ${pins.join(' ') || '(none)'}`,
    ];
    if (spec.props?.length) lines.push(`props: ${spec.props.map(propLine).join('; ')}`);
    blocks.push(lines.join('\n'));
  }
  const libs = LIBRARIES.map(([name, , en]) => `- ${name}: ${en}`).join('\n');
  return `# Components\n\n${blocks.join('\n\n')}\n\n# Installed Arduino libraries\n\n${libs}\n`;
}
