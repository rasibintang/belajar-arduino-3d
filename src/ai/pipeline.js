// Alur AI penyusun rangkaian, sama di server (jatah situs) dan browser (kunci milik pengguna):
// AI → validasi → tata letak → pemeriksaan kabel → kompilasi → (bila gagal dan waktu cukup) perbaikan sekali.
import { COMPONENT_BY_TYPE, pinIdsOf, defaultProps } from '../components/index.js';
import { snapshotFromTopology } from '../sim/wiring/snapshot.js';
import { checkCircuit } from '../sim/wiring/check.js';
import { validateCircuit } from './validate.js';
import { layoutCircuit } from './layout.js';
import { buildSystem, buildUserContent } from './prompt.js';

const REPAIR_BEFORE_MS = 30000; // perbaikan hanya bila waktu terpakai masih di bawah ini
const AI_TIMEOUT_MS = 40000;

/** Masalah kabel hasil tata letak (memakai aturan panduan kabel). */
function wiringIssues(diagram, inserted) {
  const parts = diagram.parts.map((p) => {
    const spec = COMPONENT_BY_TYPE[p.type];
    return { id: p.id, type: p.type, pinIds: pinIdsOf(spec, { ...defaultProps(spec), ...(p.props ?? {}) }) };
  });
  const s = snapshotFromTopology({ parts, wires: diagram.wires.map((w, i) => ({ id: `w${i + 1}`, ...w })), inserted });
  return checkCircuit(s);
}

const describeIssue = (i) => `wiring ${i.severity}: ${i.code} at ${i.nodes.join(' / ')}${i.suggest ? ` (expected ${i.suggest})` : ''}`;

/**
 * Satu percobaan: hasil AI → { ok, reason, details, diagram, issues, compile }.
 * reason: 'no-result' | 'not-feasible' | 'invalid' | 'layout' | 'wiring' | 'compile'
 */
async function evaluate(result, stopReason, { previous, compile, lang }) {
  if (!result) return { ok: false, reason: 'no-result', details: [`no valid JSON result (stop reason: ${stopReason ?? 'unknown'})`] };
  if (!result.feasible) return { ok: false, reason: 'not-feasible', details: [], final: true };
  const errors = validateCircuit(result);
  if (errors.length) return { ok: false, reason: 'invalid', details: errors };
  let layout;
  try {
    layout = layoutCircuit(result, { previous });
  } catch (err) {
    return { ok: false, reason: 'layout', details: [`${err.message} — use fewer breadboard parts`] };
  }
  const issues = wiringIssues(layout.diagram, layout.inserted);
  const danger = issues.filter((i) => i.severity === 'danger');
  if (danger.length) return { ok: false, reason: 'wiring', details: danger.map(describeIssue) };
  const built = await compile(result.sketch, lang);
  if (!built?.ok) return { ok: false, reason: 'compile', details: [String(built?.stderr ?? 'compile failed').slice(0, 2000)] };
  return { ok: true, diagram: layout.diagram, issues: issues.map((i) => ({ severity: i.severity, code: i.code, nodes: i.nodes, suggest: i.suggest ?? null })), compile: { size: built.size ?? null } };
}

/**
 * request: { prompt, mode, lang, current? } (current = rangkaian logis + diagram + inserted dari sandbox)
 * generate({ system, messages, signal }) → { result, stopReason }; compile(sketch, lang) → { ok, size, stderr }
 * → { outcome, result } — outcome.ok, atau outcome.reason ('provider' bila penyedia AI galat).
 */
export async function runPipeline({ generate, request, compile, now = () => Date.now() }) {
  const start = now();
  const previous = request.current ? { diagram: request.current.diagram, inserted: new Map(request.current.inserted ?? []) } : null;
  const messages = [{ role: 'user', content: buildUserContent(request) }];
  let outcome;
  let result = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    let stopReason = null;
    try {
      ({ result, stopReason } = await generate({ system: buildSystem(), messages, signal: AbortSignal.timeout(AI_TIMEOUT_MS) }));
    } catch (err) {
      outcome = { ok: false, reason: 'provider', details: [String(err?.message ?? err).slice(0, 300)] };
      break;
    }
    outcome = await evaluate(result, stopReason, { previous, compile, lang: request.lang });
    if (outcome.ok || outcome.final || attempt === 2 || now() - start > REPAIR_BEFORE_MS) break;
    messages.push(
      { role: 'assistant', content: result ? JSON.stringify(result) : '(no valid result)' },
      { role: 'user', content: `The circuit has these problems. Return the corrected complete circuit (same JSON format):\n- ${outcome.details.join('\n- ')}` }
    );
  }
  return { outcome, result };
}
