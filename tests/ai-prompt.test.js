import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSystem, buildUserContent } from '../server/ai-prompt.mjs';
import { providerConfig, createAiClient } from '../server/ai-client.mjs';

const RESULT = { title: 'LED', summary: '', feasible: true, parts: [], connections: [], sketch: 'x', substitutions: [], missing: [], changes: [] };

test('prompt sistem stabil, katalog di blok terakhir dengan cache_control', () => {
  const a = buildSystem();
  assert.deepEqual(a, buildSystem());
  assert.deepEqual(a.at(-1).cache_control, { type: 'ephemeral' });
  const text = a.map((b) => b.text).join('\n');
  for (const s of ['arduino-uno', 'A4', 'never declare a breadboard']) assert.ok(text.includes(s), s);
});

test('pesan pengguna: bahasa, mode ubah memuat rangkaian & sketch saat ini', () => {
  const current = { parts: [{ id: 'uno', type: 'arduino-uno', props: {} }, { id: 'led1', type: 'led', props: { color: 'red' } }], connections: [{ from: 'uno:D13', to: 'led1:A' }], sketch: 'void loop(){}' };
  const msg = buildUserContent({ prompt: 'tambahkan buzzer', lang: 'id', mode: 'modify', current });
  for (const s of ['Indonesian', 'tambahkan buzzer', 'led1:A', 'void loop(){}', 'modify']) assert.ok(msg.includes(s), s);
  assert.ok(buildUserContent({ prompt: 'blink', lang: 'en', mode: 'new' }).includes('English'));
});

test('pemilihan penyedia dari variabel lingkungan', () => {
  assert.equal(providerConfig({}), null);
  assert.deepEqual(providerConfig({ ANTHROPIC_API_KEY: 'x' }), { provider: 'anthropic', model: 'claude-sonnet-5-5', effort: 'medium', label: 'Anthropic' });
  const bedrock = providerConfig({ AI_PROVIDER: 'bedrock', AWS_REGION: 'us-east-1', AWS_ACCESS_KEY_ID: 'a', AWS_SECRET_ACCESS_KEY: 'b' });
  assert.equal(bedrock.model, 'anthropic.claude-sonnet-5-5');
  assert.equal(bedrock.label, 'Amazon Bedrock');
  assert.equal(providerConfig({ AI_PROVIDER: 'bedrock', AWS_ACCESS_KEY_ID: 'a', AWS_SECRET_ACCESS_KEY: 'b' }), null);
  const groq = providerConfig({ AI_PROVIDER: 'openai-compatible', AI_BASE_URL: 'https://api.groq.com/openai/v1/', AI_API_KEY: 'k', AI_MODEL: 'm' });
  assert.deepEqual(groq, { provider: 'openai-compatible', model: 'm', effort: 'medium', label: 'api.groq.com', baseUrl: 'https://api.groq.com/openai/v1', apiKey: 'k' });
  assert.equal(providerConfig({ AI_PROVIDER: 'openai-compatible', AI_BASE_URL: 'https://x', AI_API_KEY: 'k' }), null);
  assert.equal(providerConfig({ ANTHROPIC_API_KEY: 'x', AI_MODEL: 'claude-opus-5-5', AI_EFFORT: 'high' }).model, 'claude-opus-5-5');
});

function fakeSdk(response) {
  const calls = [];
  const create = async (params) => {
    calls.push(params);
    return typeof response === 'function' ? response(params, calls.length) : response;
  };
  return { calls, client: { messages: { create }, beta: { messages: { create } } } };
}
const message = (text, stop_reason = 'end_turn') => ({ stop_reason, content: [{ type: 'text', text }], usage: { input_tokens: 1, output_tokens: 1 } });

test('Anthropic: structured output, effort, fallback default; refusal → null', async () => {
  const fake = fakeSdk(message(JSON.stringify(RESULT)));
  const ai = createAiClient(providerConfig({ ANTHROPIC_API_KEY: 'x' }), { client: fake.client });
  const out = await ai.generate({ system: buildSystem(), messages: [{ role: 'user', content: 'hi' }] });
  assert.deepEqual(out.result, RESULT);
  const p = fake.calls[0];
  assert.equal(p.model, 'claude-sonnet-5-5');
  assert.equal(p.output_config.format.type, 'json_schema');
  assert.equal(p.output_config.effort, 'medium');
  assert.equal(p.fallbacks, 'default');
  assert.deepEqual(p.betas, ['server-side-fallback-2026-07-01']);
  const refused = createAiClient(providerConfig({ ANTHROPIC_API_KEY: 'x' }), { client: fakeSdk(message('', 'refusal')).client });
  assert.equal((await refused.generate({ system: [], messages: [] })).result, null);
});

test('Bedrock: model berawalan anthropic., tanpa fallback', async () => {
  const fake = fakeSdk(message(JSON.stringify(RESULT)));
  const cfg = providerConfig({ AI_PROVIDER: 'bedrock', AWS_REGION: 'us-east-1', AWS_ACCESS_KEY_ID: 'a', AWS_SECRET_ACCESS_KEY: 'b' });
  const out = await createAiClient(cfg, { client: fake.client }).generate({ system: [], messages: [] });
  assert.deepEqual(out.result, RESULT);
  assert.equal(fake.calls[0].model, 'anthropic.claude-sonnet-5-5');
  assert.equal(fake.calls[0].fallbacks, undefined);
  assert.equal(fake.calls[0].betas, undefined);
});

test('Berformat OpenAI: json_schema, ulang dengan json_object bila 400, bukan JSON → null', async () => {
  const sent = [];
  const fetchImpl = async (url, init) => {
    const body = JSON.parse(init.body);
    sent.push({ url, auth: init.headers.Authorization, format: body.response_format.type });
    if (body.response_format.type === 'json_schema') return new Response('{"error":"unsupported"}', { status: 400 });
    return Response.json({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(RESULT) } }] });
  };
  const cfg = providerConfig({ AI_PROVIDER: 'openai-compatible', AI_BASE_URL: 'https://api.groq.com/openai/v1', AI_API_KEY: 'k', AI_MODEL: 'm' });
  const out = await createAiClient(cfg, { fetchImpl }).generate({ system: buildSystem(), messages: [{ role: 'user', content: 'hi' }] });
  assert.deepEqual(out.result, RESULT);
  assert.deepEqual(sent.map((s) => s.format), ['json_schema', 'json_object']);
  assert.equal(sent[0].url, 'https://api.groq.com/openai/v1/chat/completions');
  assert.equal(sent[0].auth, 'Bearer k');
  const junk = async () => Response.json({ choices: [{ finish_reason: 'stop', message: { content: 'bukan json' } }] });
  assert.equal((await createAiClient(cfg, { fetchImpl: junk }).generate({ system: [], messages: [] })).result, null);
});
