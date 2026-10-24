// Kunci AI milik pengguna (BYOK): disimpan hanya di browser pengguna dan dipakai untuk memanggil
// penyedia AI langsung dari browser — tidak pernah dikirim ke server situs.
import { claudeMessages, gemini, openAiCompatible } from './providers.js';

const KEY = 'la-ai-key';
const GEMINI = 'https://generativelanguage.googleapis.com/v1beta';

/** Penyedia yang bisa dipanggil langsung dari browser (CORS diperiksa 2026-10-24). */
export const PRESETS = {
  gemini: { label: 'Google Gemini', kind: 'gemini', free: true, keyUrl: 'https://aistudio.google.com/app/apikey' },
  openrouter: { label: 'OpenRouter', kind: 'openai', baseUrl: 'https://openrouter.ai/api/v1', free: true, keyUrl: 'https://openrouter.ai/keys' },
  groq: { label: 'Groq', kind: 'openai', baseUrl: 'https://api.groq.com/openai/v1', free: true, keyUrl: 'https://console.groq.com/keys' },
  anthropic: { label: 'Anthropic (Claude)', kind: 'anthropic', keyUrl: 'https://console.anthropic.com/settings/keys' },
  custom: { label: 'Lainnya (berformat OpenAI)', kind: 'openai' },
};

const ANTHROPIC_MODELS = [
  { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5' },
  { id: 'claude-opus-5-5', label: 'Claude Opus 5.5' },
  { id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5' },
];

let session = null; // kunci yang tidak "diingat": hanya selama tab terbuka

function defaultStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null; // penyimpanan browser diblokir
  }
}

/** Konfigurasi lengkap? { provider, apiKey, model, baseUrl? } */
export function keyReady(cfg) {
  const preset = PRESETS[cfg?.provider];
  if (!preset || !cfg.apiKey?.trim() || !cfg.model?.trim()) return false;
  return cfg.provider !== 'custom' || /^https?:\/\//.test(cfg.baseUrl ?? '');
}

export function loadKey({ storage = defaultStorage() } = {}) {
  if (session) return session;
  try {
    const raw = storage?.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** remember: simpan di localStorage browser ini; selain itu hanya di memori tab. */
export function saveKey(cfg, { remember = false, storage = defaultStorage() } = {}) {
  session = { ...cfg };
  try {
    if (remember) storage?.setItem(KEY, JSON.stringify(session));
    else storage?.removeItem(KEY);
  } catch {
    /* penyimpanan diblokir: tetap berlaku untuk tab ini */
  }
}

export function clearKey({ storage = defaultStorage() } = {}) {
  session = null;
  try {
    storage?.removeItem(KEY);
  } catch {
    /* abaikan */
  }
}

/** Daftar model dari penyedia (memakai kunci pengguna) → [{ id, label }]. */
export async function listModels(cfg, fetchImpl = fetch) {
  const preset = PRESETS[cfg.provider];
  if (preset.kind === 'anthropic') return ANTHROPIC_MODELS;
  if (preset.kind === 'gemini') {
    const res = await fetchImpl(`${GEMINI}/models?pageSize=1000`, { headers: { 'x-goog-api-key': cfg.apiKey } });
    if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}`), { status: res.status });
    const { models = [] } = await res.json();
    return models.filter((m) => m.supportedGenerationMethods?.includes('generateContent')).map((m) => ({ id: m.name, label: m.displayName ?? m.name }));
  }
  const base = (cfg.baseUrl ?? preset.baseUrl).replace(/\/+$/, '');
  const res = await fetchImpl(`${base}/models`, { headers: { Authorization: `Bearer ${cfg.apiKey}` } });
  if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}`), { status: res.status });
  const { data = [] } = await res.json();
  return data.map((m) => ({ id: m.id, label: m.name ?? m.id }));
}

/** Klien AI di browser untuk kunci pengguna (SDK Anthropic dimuat malas). */
export async function createBrowserClient(cfg) {
  const preset = PRESETS[cfg.provider];
  if (preset.kind === 'gemini') return gemini(cfg);
  if (preset.kind === 'openai') return openAiCompatible({ baseUrl: (cfg.baseUrl ?? preset.baseUrl).replace(/\/+$/, ''), apiKey: cfg.apiKey, model: cfg.model });
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey: cfg.apiKey, dangerouslyAllowBrowser: true, maxRetries: 1, timeout: 45000 });
  return claudeMessages({ model: cfg.model, effort: 'medium' }, client, { fallbacks: true });
}
