// Klien AI untuk penyusun rangkaian. Tiga penyedia, satu antarmuka:
//   anthropic          — Anthropic API (@anthropic-ai/sdk), dengan fallback server "default"
//   bedrock            — Claude di Amazon Bedrock (AnthropicBedrockMantle), tanpa fallback server
//   openai-compatible  — endpoint /chat/completions berformat OpenAI (Gemini, Groq, OpenRouter, …)
// generate() → { result | null, stopReason, usage }; result null bila ditolak, terpotong, atau bukan JSON.
import Anthropic from '@anthropic-ai/sdk';
import { AnthropicBedrockMantle } from '@anthropic-ai/bedrock-sdk';
import { CIRCUIT_SCHEMA } from '../src/ai/schema.js';

const DEFAULT_MODEL = { anthropic: 'claude-sonnet-5-5', bedrock: 'anthropic.claude-sonnet-5-5' };
const FALLBACK_BETA = 'server-side-fallback-2026-07-01';
const MAX_TOKENS = 16000;
const TIMEOUT_MS = 45000; // fungsi Vercel berhenti di 60 dtk

/** Penyedia dari variabel lingkungan, atau null bila kredensialnya belum lengkap. */
export function providerConfig(env) {
  const provider = env.AI_PROVIDER || 'anthropic';
  const effort = env.AI_EFFORT || 'medium';
  if (provider === 'anthropic') {
    if (!env.ANTHROPIC_API_KEY) return null;
    return { provider, model: env.AI_MODEL || DEFAULT_MODEL.anthropic, effort, label: 'Anthropic' };
  }
  if (provider === 'bedrock') {
    if (!env.AWS_REGION || !env.AWS_ACCESS_KEY_ID || !env.AWS_SECRET_ACCESS_KEY) return null;
    return { provider, model: env.AI_MODEL || DEFAULT_MODEL.bedrock, effort, label: 'Amazon Bedrock', region: env.AWS_REGION };
  }
  if (provider === 'openai-compatible') {
    if (!env.AI_BASE_URL || !env.AI_API_KEY || !env.AI_MODEL) return null;
    const baseUrl = env.AI_BASE_URL.replace(/\/+$/, '');
    let label = baseUrl;
    try {
      label = new URL(baseUrl).host;
    } catch {
      /* biarkan apa adanya */
    }
    return { provider, model: env.AI_MODEL, effort, label, baseUrl, apiKey: env.AI_API_KEY };
  }
  return null;
}

/** Teks JSON dari model → objek, atau null. Pagar ```json``` dari sebagian model dibuang. */
function parseJson(text) {
  const clean = String(text ?? '')
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```$/, '')
    .trim();
  try {
    const value = JSON.parse(clean);
    return value && typeof value === 'object' ? value : null;
  } catch {
    return null;
  }
}

function claudeClient(config, client) {
  client ??=
    config.provider === 'bedrock'
      ? new AnthropicBedrockMantle({ awsRegion: config.region, timeout: TIMEOUT_MS, maxRetries: 1 })
      : new Anthropic({ timeout: TIMEOUT_MS, maxRetries: 1 });
  return {
    async generate({ system, messages, signal }) {
      const params = {
        model: config.model,
        max_tokens: MAX_TOKENS,
        system,
        messages,
        output_config: { effort: config.effort, format: { type: 'json_schema', schema: CIRCUIT_SCHEMA } },
      };
      let res;
      if (config.provider === 'anthropic') {
        try {
          res = await client.beta.messages.create({ ...params, betas: [FALLBACK_BETA], fallbacks: 'default' }, { signal });
        } catch (err) {
          // akun/model yang belum mendukung fallback server: ulang tanpa fallback
          if (!(err instanceof Anthropic.BadRequestError) || !/fallback/i.test(err.message)) throw err;
          res = await client.messages.create(params, { signal });
        }
      } else {
        res = await client.messages.create(params, { signal });
      }
      const stopReason = res.stop_reason;
      if (stopReason === 'refusal' || stopReason === 'max_tokens') return { result: null, stopReason, usage: res.usage };
      const text = res.content
        .filter((b) => b.type === 'text')
        .map((b) => b.text)
        .join('');
      return { result: parseJson(text), stopReason, usage: res.usage };
    },
  };
}

function openAiCompatibleClient(config, fetchImpl) {
  return {
    async generate({ system, messages, signal }) {
      const systemText = system.map((b) => b.text).join('\n\n');
      const call = (format) =>
        fetchImpl(`${config.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey}` },
          signal,
          body: JSON.stringify({
            model: config.model,
            max_tokens: MAX_TOKENS,
            messages: [
              {
                role: 'system',
                content: format === 'json_schema' ? systemText : `${systemText}\n\nReturn only one JSON object that matches this JSON Schema:\n${JSON.stringify(CIRCUIT_SCHEMA)}`,
              },
              ...messages,
            ],
            response_format:
              format === 'json_schema' ? { type: 'json_schema', json_schema: { name: 'circuit', schema: CIRCUIT_SCHEMA, strict: true } } : { type: 'json_object' },
          }),
        });
      // tidak semua penyedia mendukung json_schema ketat: ulang sekali dengan mode JSON biasa
      let res = await call('json_schema');
      if (res.status === 400) res = await call('json_object');
      if (!res.ok) throw Object.assign(new Error(`AI provider returned HTTP ${res.status}`), { status: res.status });
      const data = await res.json();
      const choice = data.choices?.[0];
      const stopReason = choice?.finish_reason ?? null;
      if (stopReason === 'length' || stopReason === 'content_filter') return { result: null, stopReason, usage: data.usage };
      return { result: parseJson(choice?.message?.content), stopReason, usage: data.usage };
    },
  };
}

/** Klien untuk config dari providerConfig(). deps.client / deps.fetchImpl hanya untuk tes. */
export function createAiClient(config, deps = {}) {
  if (config.provider === 'openai-compatible') return openAiCompatibleClient(config, deps.fetchImpl ?? fetch);
  return claudeClient(config, deps.client);
}
