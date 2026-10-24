import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gemini } from '../src/ai/providers.js';
import { PRESETS, loadKey, saveKey, clearKey, listModels, keyReady } from '../src/ai/byok.js';
import { runPipeline } from '../src/ai/pipeline.js';

const RESULT = {
  title: 'LED',
  summary: 's',
  feasible: true,
  parts: [
    { id: 'uno', type: 'arduino-uno', props: [] },
    { id: 'r1', type: 'resistor', props: [] },
    { id: 'led1', type: 'led', props: [] },
  ],
  connections: [
    { from: 'uno:D13', to: 'r1:1' },
    { from: 'r1:2', to: 'led1:A' },
    { from: 'led1:K', to: 'uno:GND.1' },
  ],
  sketch: 'void setup(){}\nvoid loop(){}',
  substitutions: [],
  missing: [],
  changes: [],
};
const SYSTEM = [{ type: 'text', text: 'aturan' }, { type: 'text', text: 'katalog' }];

test('Gemini asli: header kunci, skema JSON, peran model; 400 → ulang tanpa skema', async () => {
  const sent = [];
  const fetchImpl = async (url, init) => {
    const body = JSON.parse(init.body);
    sent.push({ url, key: init.headers['x-goog-api-key'], schema: !!body.generationConfig.responseJsonSchema, body });
    if (body.generationConfig.responseJsonSchema) return new Response('{"error":{"message":"schema"}}', { status: 400 });
    return Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(RESULT) }] } }] });
  };
  const ai = gemini({ apiKey: 'k', model: 'models/gemini-x' }, fetchImpl);
  const out = await ai.generate({ system: SYSTEM, messages: [{ role: 'user', content: 'hi' }, { role: 'assistant', content: '{}' }, { role: 'user', content: 'fix' }] });
  assert.deepEqual(out.result, RESULT);
  assert.equal(sent[0].url, 'https://generativelanguage.googleapis.com/v1beta/models/gemini-x:generateContent');
  assert.equal(sent[0].key, 'k');
  assert.deepEqual(sent.map((s) => s.schema), [true, false]);
  assert.deepEqual(sent[0].body.contents.map((c) => c.role), ['user', 'model', 'user']);
  assert.equal(sent[0].body.systemInstruction.parts[0].text, 'aturan\n\nkatalog');
  assert.match(sent[1].body.systemInstruction.parts[0].text, /JSON Schema/);
  assert.equal(sent[0].body.generationConfig.responseMimeType, 'application/json');
});

test('Gemini: MAX_TOKENS/SAFETY → null; galat HTTP → melempar dengan status', async () => {
  const cut = async () => Response.json({ candidates: [{ finishReason: 'MAX_TOKENS', content: { parts: [{ text: '{' }] } }] });
  assert.equal((await gemini({ apiKey: 'k', model: 'models/m' }, cut).generate({ system: SYSTEM, messages: [] })).result, null);
  const denied = async () => new Response('{}', { status: 403 });
  await assert.rejects(gemini({ apiKey: 'k', model: 'models/m' }, denied).generate({ system: SYSTEM, messages: [] }), (e) => e.status === 403);
});

test('preset penyedia lengkap dan kunci siap hanya bila lengkap', () => {
  assert.deepEqual(Object.keys(PRESETS), ['gemini', 'openrouter', 'groq', 'anthropic', 'custom']);
  assert.equal(keyReady({ provider: 'gemini', apiKey: 'k', model: 'models/x' }), true);
  assert.equal(keyReady({ provider: 'gemini', apiKey: '', model: 'models/x' }), false);
  assert.equal(keyReady({ provider: 'custom', apiKey: 'k', model: 'm' }), false); // butuh baseUrl
  assert.equal(keyReady({ provider: 'custom', apiKey: 'k', model: 'm', baseUrl: 'https://x/v1' }), true);
});

function memStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), m };
}

test('kunci: "ingat" → localStorage; tidak → hanya memori tab; hapus membersihkan keduanya', () => {
  const local = memStorage();
  const cfg = { provider: 'gemini', apiKey: 'rahasia', model: 'models/x' };
  saveKey(cfg, { remember: false, storage: local });
  assert.equal(local.m.size, 0);
  assert.deepEqual(loadKey({ storage: local }), cfg); // dari memori tab
  saveKey(cfg, { remember: true, storage: local });
  assert.ok(local.getItem('la-ai-key').includes('rahasia'));
  clearKey({ storage: local });
  assert.equal(loadKey({ storage: local }), null);
  assert.equal(local.m.size, 0);
});

test('daftar model: Gemini (generateContent saja) dan berformat OpenAI', async () => {
  const fetchGemini = async (url, init) => {
    assert.equal(init.headers['x-goog-api-key'], 'k');
    return Response.json({ models: [{ name: 'models/gemini-a', displayName: 'Gemini A', supportedGenerationMethods: ['generateContent'] }, { name: 'models/embed', supportedGenerationMethods: ['embedContent'] }] });
  };
  assert.deepEqual(await listModels({ provider: 'gemini', apiKey: 'k' }, fetchGemini), [{ id: 'models/gemini-a', label: 'Gemini A' }]);
  const fetchOr = async (url) => {
    assert.equal(url, 'https://openrouter.ai/api/v1/models');
    return Response.json({ data: [{ id: 'a/b:free', name: 'B (free)' }, { id: 'c/d', name: 'D' }] });
  };
  const or = await listModels({ provider: 'openrouter', apiKey: 'k' }, fetchOr);
  assert.deepEqual(or.map((m) => m.id), ['a/b:free', 'c/d']);
});

test('runPipeline dipakai langsung (jalur browser) dengan generate & compile sendiri', async () => {
  const { outcome, result } = await runPipeline({
    generate: async () => ({ result: RESULT, stopReason: 'end_turn' }),
    request: { prompt: 'led', mode: 'new', lang: 'id' },
    compile: async () => ({ ok: true, size: 900 }),
  });
  assert.equal(outcome.ok, true);
  assert.equal(result.title, 'LED');
  assert.ok(outcome.diagram.parts.some((p) => p.id === 'bb'));
});
