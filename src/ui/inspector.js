import { t } from '../i18n/index.js';
import { icon } from './icons.js';

/**
 * Jendela kecil yang muncul saat sebuah komponen diklik:
 * berisi nama, keterangan, dan kontrol parameter milik komponen itu.
 */
export function createInspector({ el, container, getLesson, getParams, setParam, onOpen, onClose }) {
  let partKey = null;

  function close() {
    if (el.hidden) return;
    el.hidden = true;
    partKey = null;
    onClose?.();
  }

  function controlHtml(p, value) {
    if (p.type === 'swatch') {
      return `<div class="swatches" role="radiogroup" aria-label="${p.label}">${p.options
        .map(
          (o) =>
            `<button class="swatch${o.value === value ? ' is-on' : ''}" data-key="${p.key}" data-value="${o.value}" title="${o.label}" style="--c:${o.color}" role="radio" aria-checked="${o.value === value}"></button>`
        )
        .join('')}</div>`;
    }
    if (p.type === 'choice') {
      return `<div class="segmented">${p.options
        .map((o) => `<button class="${o.value === value ? 'is-on' : ''}" data-key="${p.key}" data-value="${o.value}">${o.label}</button>`)
        .join('')}</div>`;
    }
    return `<div class="range"><input type="range" data-key="${p.key}" min="${p.min}" max="${p.max}" step="${p.step}" value="${value}" aria-label="${p.label}"><output>${value}${p.unit ? ' ' + p.unit : ''}</output></div>`;
  }

  function fill() {
    const lesson = getLesson();
    const params = getParams();
    const defs = (lesson.params ?? []).filter((p) => p.part === partKey);
    const info = el._info;
    el.innerHTML = `
      <header>
        <div><small>${t('nav.parts')}</small><h3>${info.name}</h3></div>
        <button class="icon-btn insp-close" aria-label="${t('ui.close')}">${icon('close')}</button>
      </header>
      <p class="insp-desc">${info.desc ?? ''}</p>
      ${defs
        .map((p) => `<div class="insp-row"><label>${p.label}</label>${controlHtml(p, params[p.key])}</div>`)
        .join('')}
      ${defs.length ? '' : `<p class="insp-empty">${t('insp.empty')}</p>`}`;
  }

  /** Cocokkan nilai dari data-value (string) dengan tipe aslinya. */
  function parseValue(key, raw) {
    const def = getLesson().params.find((p) => p.key === key);
    const opt = def?.options?.find((o) => String(o.value) === raw);
    return opt ? opt.value : Number(raw);
  }

  el.addEventListener('click', (e) => {
    if (e.target.closest('.insp-close')) return close();
    const btn = e.target.closest('button[data-key]');
    if (btn) setParam(btn.dataset.key, parseValue(btn.dataset.key, btn.dataset.value));
  });
  el.addEventListener('input', (e) => {
    const input = e.target.closest('input[data-key]');
    if (input) setParam(input.dataset.key, Number(input.value));
  });
  el.addEventListener('pointerdown', (e) => e.stopPropagation());

  function open(part, clientX, clientY, info = part.userData.part) {
    partKey = info.key;
    el._info = info;
    fill();
    el.hidden = false;
    const box = container.getBoundingClientRect();
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    let x = clientX - box.left + 18;
    let y = clientY - box.top - h / 2;
    if (x + w > box.width - 12) x = clientX - box.left - w - 18;
    x = Math.max(12, Math.min(box.width - w - 12, x));
    y = Math.max(12, Math.min(box.height - h - 12, y));
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    // mulai ulang animasi muncul
    el.classList.remove('is-in');
    void el.offsetWidth;
    el.classList.add('is-in');
    onOpen?.(part);
  }

  /** Perbarui tampilan kontrol tanpa membangun ulang (agar slider tidak lepas saat diseret). */
  function sync() {
    if (el.hidden) return;
    const params = getParams();
    el.querySelectorAll('[data-key]').forEach((c) => {
      const v = params[c.dataset.key];
      if (c.tagName === 'INPUT') {
        if (document.activeElement !== c) c.value = v;
        const def = getLesson().params.find((p) => p.key === c.dataset.key);
        c.nextElementSibling.textContent = `${v}${def?.unit ? ' ' + def.unit : ''}`;
      } else {
        const on = String(v) === c.dataset.value;
        c.classList.toggle('is-on', on);
        if (c.hasAttribute('aria-checked')) c.setAttribute('aria-checked', String(on));
      }
    });
  }

  return { open, close, sync, get isOpen() { return !el.hidden; }, get partKey() { return partKey; } };
}
