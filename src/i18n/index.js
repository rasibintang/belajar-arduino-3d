// Bahasa situs (Indonesia / English).
// Urutan: ?lang=… di URL → pilihan tersimpan → bahasa browser. Mengganti bahasa memuat ulang
// halaman, jadi semua modul cukup membaca `lang` sekali saat dimuat.
import { UI } from './ui.js';

const KEY = 'la-lang';
export const LANGS = [
  { id: 'id', short: 'ID', label: 'Bahasa Indonesia' },
  { id: 'en', short: 'EN', label: 'English' },
];
const valid = (l) => LANGS.some((x) => x.id === l);

function detect() {
  try {
    const q = new URLSearchParams(globalThis.location?.search ?? '').get('lang');
    if (valid(q)) {
      localStorage.setItem(KEY, q);
      return q;
    }
    const saved = localStorage.getItem(KEY);
    if (valid(saved)) return saved;
  } catch {
    /* localStorage tidak tersedia (mis. mode privat) */
  }
  const nav = (globalThis.navigator?.language ?? 'id').toLowerCase();
  return nav.startsWith('id') || nav.startsWith('ms') ? 'id' : 'en';
}

export const lang = detect();
export const isEN = lang === 'en';
if (globalThis.document?.documentElement) document.documentElement.lang = lang;

/** Ganti bahasa lalu muat ulang halaman (tanpa ?lang di URL agar pilihan baru berlaku). */
export function setLang(next) {
  if (!valid(next) || next === lang) return;
  try {
    localStorage.setItem(KEY, next);
  } catch {
    /* abaikan */
  }
  const url = new URL(location.href);
  url.searchParams.delete('lang');
  location.href = url.toString();
}

/**
 * Teks antarmuka: t('sb.run') atau dengan isian t('sb.compiled', { size: 924 }).
 * Bila kunci tidak ada di bahasa aktif, dipakai teks Indonesia, lalu kuncinya sendiri.
 */
export function t(key, vars) {
  let s = UI[lang]?.[key] ?? UI.id[key] ?? key;
  if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
  return s;
}

/** Isi semua elemen [data-i18n] (teks), [data-i18n-title], [data-i18n-placeholder], [data-i18n-aria] di halaman. */
export function translateDom(root = document) {
  for (const el of root.querySelectorAll('[data-i18n]')) el.innerHTML = t(el.dataset.i18n);
  for (const el of root.querySelectorAll('[data-i18n-title]')) el.title = t(el.dataset.i18nTitle);
  for (const el of root.querySelectorAll('[data-i18n-placeholder]')) el.placeholder = t(el.dataset.i18nPlaceholder);
  for (const el of root.querySelectorAll('[data-i18n-aria]')) el.setAttribute('aria-label', t(el.dataset.i18nAria));
}

/** Tombol pilihan bahasa (ID | EN) untuk dipasang di bilah atas halaman mana pun. */
export function languageSwitch(className = 'lang-switch') {
  const wrap = document.createElement('div');
  wrap.className = className;
  wrap.setAttribute('role', 'group');
  wrap.setAttribute('aria-label', t('lang.choose'));
  for (const l of LANGS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = l.short;
    b.title = l.label;
    b.lang = l.id;
    b.setAttribute('aria-pressed', String(l.id === lang));
    if (l.id === lang) b.className = 'is-on';
    b.addEventListener('click', () => setLang(l.id));
    wrap.append(b);
  }
  return wrap;
}
