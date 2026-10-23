// Terjemahan teks pendek yang ditulis di sumber dalam bahasa Indonesia: nama & keterangan
// model 3D (markPart), spesifikasi komponen sandbox (nama, keterangan, pin, props),
// dan kategori. Kamus berbasis teks: teks yang sama cukup diterjemahkan sekali.
import { lang } from './index.js';
import { PARTS_EN, PATTERNS_EN } from './en/parts.js';

const missing = (globalThis.__i18nMissing ??= new Set());
const english = new Set(Object.values(PARTS_EN)); // teks yang sudah hasil terjemahan

/** Teks sumber (Indonesia) → bahasa aktif. Teks tanpa terjemahan dikembalikan apa adanya. */
export function tr(text) {
  if (lang !== 'en' || typeof text !== 'string' || !text) return text;
  const hit = PARTS_EN[text];
  if (hit !== undefined) return hit;
  if (english.has(text)) return text;
  for (const [re, to] of PATTERNS_EN) if (re.test(text)) return text.replace(re, to);
  // gabungan "Nama · pin" atau "nomor · fungsi": terjemahkan per bagian
  if (text.includes(' · ')) return text.split(' · ').map(tr).join(' · ');
  if (import.meta.env?.DEV && /[a-z]{3}/i.test(text)) missing.add(text);
  return text;
}
