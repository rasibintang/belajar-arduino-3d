// Klien AI untuk penyusun rangkaian. Tiga penyedia, satu antarmuka:
//   anthropic          — Anthropic API (@anthropic-ai/sdk), dengan fallback server "default"
//   bedrock            — Claude di Amazon Bedrock (AnthropicBedrockMantle), tanpa fallback server
//   openai-compatible  — endpoint /chat/completions berformat OpenAI (Gemini, Groq, OpenRouter, …)
// generate() → { result | null, stopReason, usage }; result null bila ditolak, terpotong, atau bukan JSON.
import Anthropic from '@anthropic-ai/sdk';
import { AnthropicBedrockMantle } from '@anthropic-ai/bedrock-sdk';
import { claudeMessages, openAiCompatible } from '../src/ai/providers.js';

const DEFAULT_MODEL = { anthropic: 'claude-sonnet-5-5', bedrock: 'anthropic.claude-sonnet-5-5' };
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

/** Klien untuk config dari providerConfig(). deps.client / deps.fetchImpl hanya untuk tes. */
export function createAiClient(config, deps = {}) {
  if (config.provider === 'openai-compatible') return openAiCompatible(config, deps.fetchImpl ?? fetch);
  const client =
    deps.client ??
    (config.provider === 'bedrock'
      ? new AnthropicBedrockMantle({ awsRegion: config.region, timeout: TIMEOUT_MS, maxRetries: 1 })
      : new Anthropic({ timeout: TIMEOUT_MS, maxRetries: 1 }));
  return claudeMessages(config, client, { fallbacks: config.provider === 'anthropic' });
}
