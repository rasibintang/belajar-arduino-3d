// Terjemahan pelajaran: menimpa teks sumber (bahasa Indonesia) dengan overlay bahasa aktif.
// Juga menyediakan penerjemah teks yang dicetak simulasi (Serial, LCD, log) agar cocok
// dengan kode yang sudah diterjemahkan.
import { lang } from './index.js';
import basic from './en/lessons-basic.js';
import intermediate from './en/lessons-intermediate.js';
import expert from './en/lessons-expert.js';

const OVERLAYS = { en: { ...basic, ...intermediate, ...expert } };

// tabel gabungan semua pelajaran (frasa dipakai juga oleh gambar mini / thumbnail)
const phrases = [];
const marks = {};
const inputs = {};

/** Terapkan overlay ke satu pelajaran (mengubah objeknya langsung). */
export function localizeLesson(lesson) {
  const o = OVERLAYS[lang]?.[lesson.id];
  if (!o) return lesson;
  for (const key of ['title', 'heading', 'summary', 'tip', 'code', 'serialInput']) if (o[key] !== undefined) lesson[key] = o[key];
  o.features?.forEach((html, i) => lesson.features?.[i] && (lesson.features[i] = { ...lesson.features[i], html }));
  o.callouts?.forEach(([title, text], i) => lesson.callouts?.[i] && (lesson.callouts[i] = { ...lesson.callouts[i], title, text }));
  if (o.explain) lesson.explain = o.explain;
  o.pinout?.forEach((to, i) => lesson.pinout?.[i] && (lesson.pinout[i] = { ...lesson.pinout[i], to }));
  if (o.specs) lesson.specs = o.specs;
  for (const p of lesson.params ?? []) {
    const po = o.params?.[p.key];
    if (po?.label) p.label = po.label;
    if (p.options && (po?.options || po?.values)) {
      p.options = p.options.map((opt, i) => {
        const next = { ...opt };
        if (po.options?.[i] !== undefined) next.label = po.options[i];
        if (po.values?.[i] !== undefined) {
          if (p.value === opt.value) p.value = po.values[i];
          next.value = po.values[i];
        }
        return next;
      });
    }
    // potongan kode per opsi: optionCode['key.value'] = { field: '…' }
    for (const opt of p.options ?? []) {
      const oc = o.optionCode?.[`${p.key}.${opt.value}`];
      if (oc) opt.code = { ...opt.code, ...oc };
    }
  }
  return lesson;
}

/** Daftarkan frasa/mark/input semua pelajaran (sekali, saat registri pelajaran dimuat). */
export function registerLessonRuntime() {
  for (const o of Object.values(OVERLAYS[lang] ?? {})) {
    for (const pair of o.phrases ?? []) phrases.push(pair);
    Object.assign(marks, o.marks);
    Object.assign(inputs, o.input);
  }
  // frasa terpanjang dulu agar "Kipas: NYALA" diganti sebelum "Kipas"
  phrases.sort((a, b) => b[0].length - a[0].length);
}

/** Teks keluaran simulasi (Serial / LCD / log) dalam bahasa aktif. */
export function phrase(text) {
  if (!phrases.length || typeof text !== 'string') return text;
  let out = text;
  for (const [from, to] of phrases) if (out.includes(from)) out = out.split(from).join(to);
  return out;
}

/** Penanda baris kode (io.mark) yang teksnya berubah di kode terjemahan. */
export const markText = (text) => marks[text] ?? text;

/** Perintah Serial yang diketik pengguna → perintah yang dikenali simulasi. */
export const inputText = (text) => inputs[text.trim().toLowerCase()] ?? text;
