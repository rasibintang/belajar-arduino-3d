// Klien penyedia AI, satu antarmuka: generate({ system, messages, signal }) → { result | null, stopReason, usage }.
// Aman untuk browser maupun server (tanpa impor SDK di sini; klien SDK disuntikkan).
// result null bila ditolak, terpotong, atau bukan JSON.
import { CIRCUIT_SCHEMA } from './schema.js';

export const MAX_TOKENS = 16000;
const FALLBACK_BETA = 'server-side-fallback-2026-07-01';

/** Teks JSON dari model → objek, atau null. Pagar ```json``` dari sebagian model dibuang. */
export function parseJson(text) {
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

const systemText = (system) => system.map((b) => b.text).join('\n\n');
const withSchema = (text) => `${text}\n\nReturn only one JSON object that matches this JSON Schema:\n${JSON.stringify(CIRCUIT_SCHEMA)}`;

/**
 * Claude lewat klien SDK (Anthropic API, Bedrock, atau Anthropic di browser).
 * fallbacks: kirim fallback server "default" (hanya Anthropic API; diulang tanpa bila ditolak 400).
 */
export function claudeMessages({ model, effort }, client, { fallbacks = false } = {}) {
  return {
    async generate({ system, messages, signal }) {
      const params = {
        model,
        max_tokens: MAX_TOKENS,
        system,
        messages,
        output_config: { effort, format: { type: 'json_schema', schema: CIRCUIT_SCHEMA } },
      };
      let res;
      if (fallbacks) {
        try {
          res = await client.beta.messages.create({ ...params, betas: [FALLBACK_BETA], fallbacks: 'default' }, { signal });
        } catch (err) {
          // akun/model yang belum mendukung fallback server: ulang tanpa fallback
          if (err?.status !== 400 || !/fallback/i.test(err.message)) throw err;
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

/** Endpoint /chat/completions berformat OpenAI (Groq, OpenRouter, …). */
export function openAiCompatible({ baseUrl, apiKey, model }, fetchImpl = fetch) {
  return {
    async generate({ system, messages, signal }) {
      const call = (format) =>
        fetchImpl(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
          signal,
          body: JSON.stringify({
            model,
            max_tokens: MAX_TOKENS,
            messages: [{ role: 'system', content: format === 'json_schema' ? systemText(system) : withSchema(systemText(system)) }, ...messages],
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
