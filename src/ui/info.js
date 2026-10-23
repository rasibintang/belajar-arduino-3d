import { t } from '../i18n/index.js';
import { icon } from './icons.js';
import { WIRE_COLORS } from '../parts/wire.js';

const TABS = [
  ['overview', t('info.overview')],
  ['pinout', t('info.pinout')],
  ['example', t('info.example')],
  ['specs', t('info.specs')],
];

/** Panel kanan: ikhtisar, pinout, penjelasan kode, dan spesifikasi. */
export function createInfoCard(root) {
  const tabs = root.querySelector('.tabs');
  const body = root.querySelector('.info-content');
  let lesson = null;
  let active = 'overview';

  tabs.innerHTML = TABS.map(
    ([id, label]) => `<button role="tab" data-tab="${id}" aria-selected="${id === active}">${label}</button>`
  ).join('');
  tabs.addEventListener('click', (e) => {
    const b = e.target.closest('[data-tab]');
    if (b && b.dataset.tab !== active) show(b.dataset.tab);
  });
  root.querySelector('.expand').addEventListener('click', () => {
    const on = root.classList.toggle('is-expanded');
    document.body.classList.toggle('has-overlay', on);
  });

  const views = {
    overview: (l) => `
      <h2>${l.heading}</h2>
      <p class="lede">${l.summary}</p>
      <ul class="features">${l.features
        .map((f) => `<li><span class="feat-icon">${icon(f.icon)}</span><span>${f.html}</span></li>`)
        .join('')}</ul>`,
    pinout: (l) => `
      <h2>${t('info.wiring')}</h2>
      <table class="pinout">${l.pinout
        .map(
          (p) => `<tr>
            <td><span class="wire-dot" style="--c:${WIRE_COLORS[p.color] ?? 'transparent'}"></span><code>${p.pin}</code></td>
            <td>${p.to}</td></tr>`
        )
        .join('')}</table>`,
    example: (l) => `
      <h2>${t('info.howItWorks')}</h2>
      <ol class="explain">${l.explain.map((x) => `<li>${x}</li>`).join('')}</ol>
      ${l.tip ? `<div class="tipbox">${icon('bulb')}<p>${l.tip}</p></div>` : ''}`,
    specs: (l) => `
      <h2>${l.specs.name}</h2>
      <table class="specs">${l.specs.rows.map(([k, v]) => `<tr><th>${k}</th><td>${v}</td></tr>`).join('')}</table>`,
  };

  let timer = 0;
  /** Ganti isi dengan memudar: keluar dulu, lalu isi baru masuk. */
  function show(tab, wait = 120) {
    active = tab;
    tabs.querySelectorAll('[data-tab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
    clearTimeout(timer);
    body.classList.add('is-out');
    timer = setTimeout(() => {
      body.innerHTML = views[tab](lesson);
      body.scrollTop = 0;
      body.classList.remove('is-out');
    }, wait);
  }

  return {
    setLesson(l, { instant = false } = {}) {
      lesson = l;
      show(active, instant ? 0 : 220);
    },
    collapse() {
      root.classList.remove('is-expanded');
    },
  };
}
