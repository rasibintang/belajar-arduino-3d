import '@fontsource/barlow-semi-condensed/600.css';
import '@fontsource/barlow-semi-condensed/700.css';
import '@fontsource/barlow/400.css';
import '@fontsource/barlow/500.css';
import '@fontsource/ibm-plex-mono/400.css';
import '../styles/app.css';
import '../sandbox/gallery.css';
import './admin.css';

import { t, isEN, translateDom, languageSwitch } from '../i18n/index.js';
import { mountAccount, toast } from '../account/ui.js';
import { initMonitor } from '../monitor/client.js';
import { githubLink } from '../ui/github.js';

initMonitor('admin');
import { LOGO } from '../ui/icons.js';
import { renderHealth } from './health.js';

// Halaman pengelola: kondisi situs + membaca data (proyek pengguna dibuka sebagai salinan di sandbox).
// Akses dijaga RLS di database; pemeriksaan di sini hanya menentukan apa yang ditampilkan.

const $ = (s) => document.querySelector(s);
document.querySelectorAll('[data-logo]').forEach((el) => (el.innerHTML = LOGO));
translateDom();
document.title = `${t('adm.title')} · Learn Arduino`;
$('.cat-lang').append(languageSwitch());

const state = $('#state');
const panel = $('#panel');
const pane = $('#pane');
const when = new Intl.DateTimeFormat(isEN ? 'en' : 'id', { dateStyle: 'medium', timeStyle: 'short' });
const fmt = (iso) => (iso ? when.format(new Date(iso)) : '—');
let backend = null;
let tab = 'health';

function show(message) {
  state.textContent = message;
  state.hidden = !message;
}

/** Tabel sederhana: cols = [[judul, (baris) => teks | Node]] */
function table(rows, cols) {
  const el = document.createElement('table');
  el.className = 'adm-table';
  const head = el.createTHead().insertRow();
  for (const [title] of cols) head.append(Object.assign(document.createElement('th'), { textContent: title }));
  const body = el.createTBody();
  for (const row of rows) {
    const tr = body.insertRow();
    for (const [, cell] of cols) {
      const td = tr.insertCell();
      const v = cell(row);
      if (v instanceof Node) td.append(v);
      else td.textContent = v ?? '';
    }
  }
  return el;
}

const TABS = {
  health: () => renderHealth({ backend, t, isEN, table, fmt, toast, reload: () => render() }),
  async requests() {
    const rows = await backend.admin.requests();
    if (!rows.length) return Object.assign(document.createElement('p'), { className: 'adm-empty', textContent: t('adm.noRequests') });
    return table(rows, [
      [t('adm.col.component'), (r) => r.component],
      [t('adm.col.requests'), (r) => String(r.requests)],
      [t('adm.col.users'), (r) => String(r.users)],
      [t('adm.col.last'), (r) => fmt(r.lastAt)],
      [t('adm.col.examples'), (r) => (r.examples ?? []).filter(Boolean).join(' · ')],
    ]);
  },
  async projects() {
    const rows = await backend.admin.projects();
    if (!rows.length) return Object.assign(document.createElement('p'), { className: 'adm-empty', textContent: t('adm.noProjects') });
    return table(rows, [
      [t('adm.col.project'), (r) => r.name],
      [t('adm.col.owner'), (r) => r.ownerEmail],
      [t('adm.col.updated'), (r) => fmt(r.updatedAt)],
      [
        '',
        (r) => {
          const a = document.createElement('a');
          a.className = 'sb-btn adm-open';
          a.href = `/sandbox.html?project=${encodeURIComponent(r.id)}&copy=1${location.search.includes('fakeauth') ? '&fakeauth=admin' : ''}`;
          a.target = '_blank';
          a.rel = 'noopener';
          a.textContent = t('adm.openCopy');
          return a;
        },
      ],
    ]);
  },
  async users() {
    const rows = await backend.admin.users();
    return table(rows, [
      [t('adm.col.email'), (r) => r.email],
      [t('adm.col.name'), (r) => r.name],
      [t('adm.col.projects'), (r) => String(r.projects)],
      [t('adm.col.aiToday'), (r) => String(r.aiToday)],
      [t('adm.col.aiTotal'), (r) => String(r.aiTotal)],
      [t('adm.col.lastSeen'), (r) => fmt(r.lastSeenAt)],
    ]);
  },
  async settings() {
    const limit = await backend.admin.getLimit();
    const form = document.createElement('form');
    form.className = 'adm-settings';
    form.noValidate = true; // pesan sendiri (dua bahasa) alih-alih gelembung bawaan browser
    form.innerHTML = `<label><span></span><input type="number" min="0" max="100" step="1" required /></label><p class="adm-help"></p><button class="sb-btn sb-primary" type="submit"></button>`;
    form.querySelector('span').textContent = t('adm.limit');
    form.querySelector('.adm-help').textContent = t('adm.limitHelp');
    form.querySelector('button').textContent = t('adm.save');
    const input = form.querySelector('input');
    input.value = String(limit);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const n = Number(input.value);
      if (!Number.isInteger(n) || n < 0 || n > 100) return toast(t('adm.invalidLimit'), 'error');
      try {
        await backend.admin.setLimit(n);
        toast(t('adm.saved'));
      } catch (err) {
        toast(err.code === 'invalid' ? t('adm.invalidLimit') : t('adm.loadFailed'), 'error');
      }
    });
    return form;
  },
};

async function render() {
  document.querySelectorAll('.adm-tabs [data-tab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
  pane.replaceChildren(Object.assign(document.createElement('p'), { className: 'adm-empty', textContent: '…' }));
  try {
    pane.replaceChildren(await TABS[tab]());
  } catch (err) {
    pane.replaceChildren(Object.assign(document.createElement('p'), { className: 'adm-empty', textContent: err.code === 'forbidden' ? t('adm.forbidden') : t('adm.loadFailed') }));
  }
}

document.querySelectorAll('.adm-tabs [data-tab]').forEach((b) =>
  b.addEventListener('click', () => {
    tab = b.dataset.tab;
    render();
  })
);

async function refresh(acc) {
  panel.hidden = true;
  if (!acc.backend) return show(t('adm.notConfigured'));
  if (!acc.user()) return show(t('adm.signInFirst'));
  let admin = false;
  try {
    admin = await acc.backend.admin.isAdmin();
  } catch {
    return show(t('adm.loadFailed'));
  }
  if (!admin) return show(t('adm.forbidden'));
  show('');
  panel.hidden = false;
  render();
}

$('.account-slot').before(githubLink('top-btn'));
const acc = await mountAccount($('.account-slot'));
backend = acc.backend;
acc.onChange(() => refresh(acc));
refresh(acc);
