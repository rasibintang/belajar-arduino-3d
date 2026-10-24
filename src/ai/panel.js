import { createStage } from '../core/stage.js';
import { createWorkbench } from '../sandbox/workbench.js';
import { COMPONENT_BY_TYPE } from '../components/index.js';
import { escapeHtml } from '../ui/highlight.js';
import { icon } from '../ui/icons.js';
import { fetchAiInfo, requestCircuit, diffCircuits } from './client.js';
import './ai.css';

/**
 * Kotak "Susun dengan AI": perintah → (server) → pratinjau → Terima / Tolak.
 * deps: { t, lang, toast, account: Promise<{ backend, user() }>, getCurrent(), onAcceptNew(res), onAcceptModify(res) }
 */
export function createAiPanel({ t, lang, toast, account, getCurrent, onAcceptNew, onAcceptModify }) {
  const fake = import.meta.env?.DEV ? new URLSearchParams(location.search).get('fakeai') : null;
  const modal = document.createElement('div');
  modal.className = 'sb-modal ai-modal';
  modal.hidden = true;
  modal.innerHTML = `
    <div class="sb-dialog ai-dialog" role="dialog" aria-modal="true">
      <header>
        <h2>${icon('sparkle')}<span>${escapeHtml(t('ai.title'))}</span></h2>
        <button class="icon-btn" data-act="close" aria-label="${escapeHtml(t('ai.close'))}">${icon('close')}</button>
      </header>
      <form class="ai-form" data-view="form">
        <div class="ai-modes" role="radiogroup">
          <label><input type="radio" name="ai-mode" value="new" checked> ${escapeHtml(t('ai.modeNew'))}</label>
          <label><input type="radio" name="ai-mode" value="modify"> ${escapeHtml(t('ai.modeModify'))}</label>
        </div>
        <textarea name="prompt" rows="4" maxlength="1000" placeholder="${escapeHtml(t('ai.placeholder'))}"></textarea>
        <p class="ai-privacy"></p>
        <p class="ai-message" role="alert" hidden></p>
        <div class="ai-actions"><button class="sb-btn sb-primary" type="submit">${escapeHtml(t('ai.submit'))}</button></div>
      </form>
      <div class="ai-working" data-view="working" hidden>
        <div class="ai-spinner" aria-hidden="true"></div>
        <b>${escapeHtml(t('ai.working'))}</b>
        <p>${escapeHtml(t('ai.workingHint'))}</p>
      </div>
      <div class="ai-preview" data-view="preview" hidden>
        <div class="ai-stage"><canvas></canvas></div>
        <div class="ai-info"></div>
        <div class="ai-actions">
          <button class="sb-btn" data-act="reject">${escapeHtml(t('ai.reject'))}</button>
          <button class="sb-btn sb-primary" data-act="accept">${escapeHtml(t('ai.accept'))}</button>
        </div>
      </div>
    </div>`;
  document.body.append(modal);
  const $ = (s) => modal.querySelector(s);
  const form = $('.ai-form');
  const message = $('.ai-message');
  let preview = null; // { stage, wb }
  let last = null; // { res, mode, before }
  let info = null;

  const show = (view) => modal.querySelectorAll('[data-view]').forEach((el) => (el.hidden = el.dataset.view !== view));
  const say = (text, action) => {
    message.hidden = !text;
    message.textContent = text ?? '';
    if (action) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'sb-btn';
      btn.textContent = action.label;
      btn.addEventListener('click', action.onClick);
      message.append(' ', btn);
    }
  };
  const close = () => {
    modal.hidden = true;
    show('form');
  };

  async function refresh() {
    info ??= fake ? { enabled: true, label: 'contoh (DEV)' } : await fetchAiInfo();
    $('.ai-privacy').textContent = info.enabled ? t('ai.privacy', { label: info.label }) : '';
    const submit = form.querySelector('[type=submit]');
    const acc = await account;
    if (!info.enabled) {
      submit.disabled = true;
      return say(t('ai.notEnabled'));
    }
    if (!acc.backend || !acc.user()) {
      submit.disabled = true;
      return say(t('ai.signIn'), acc.backend && { label: t('acct.signIn'), onClick: () => acc.backend.signIn().catch(() => toast(t('acct.offline'), 'error')) });
    }
    submit.disabled = false;
    say(null);
  }

  function failureText(res) {
    if (res.code === 'not-enabled') return t('ai.notEnabled');
    if (res.code === 'not-signed-in') return t('ai.signIn');
    if (res.code === 'quota') return t('ai.quota', { limit: res.limit });
    if (res.code === 'network') return t('ai.network');
    const reason = res.reason ? ` ${t(`ai.reason.${res.reason}`)}` : '';
    const missing = res.missing?.length ? ` ${t('ai.missing')}: ${res.missing.map((m) => m.component).join(', ')}.` : '';
    return `${t('ai.failed')}${reason}${missing}`;
  }

  const list = (title, items) => (items.length ? `<h4>${escapeHtml(title)}</h4><ul>${items.map((i) => `<li>${i}</li>`).join('')}</ul>` : '');
  const partName = (p) => `<b>${escapeHtml(p.id)}</b> — ${escapeHtml(COMPONENT_BY_TYPE[p.type]?.name ?? p.type)}`;

  function renderPreview(res, mode, before) {
    const r = res.result;
    const changes = [];
    if (mode === 'modify' && before) {
      const d = diffCircuits(before, r);
      if (d.added.length) changes.push(escapeHtml(t('ai.diff.added', { list: d.added.join(', ') })));
      if (d.removed.length) changes.push(escapeHtml(t('ai.diff.removed', { list: d.removed.join(', ') })));
      if (d.changedProps.length) changes.push(escapeHtml(t('ai.diff.props', { list: d.changedProps.join(', ') })));
      if (d.wiresAdded || d.wiresRemoved) changes.push(escapeHtml(t('ai.diff.wires', { added: d.wiresAdded, removed: d.wiresRemoved })));
      if (d.sketchChanged) changes.push(escapeHtml(t('ai.diff.sketch')));
      changes.push(...(r.changes ?? []).map(escapeHtml));
    }
    $('.ai-info').innerHTML = `
      <h3>${escapeHtml(r.title)}</h3>
      <p>${escapeHtml(r.summary)}</p>
      ${list(t('ai.changes'), changes)}
      ${list(t('ai.parts'), r.parts.filter((p) => p.type !== 'arduino-uno').map(partName))}
      ${list(t('ai.substitutions'), (r.substitutions ?? []).map((s) => `${escapeHtml(s.requested)} → <b>${escapeHtml(s.used)}</b>: ${escapeHtml(s.reason)}`))}
      ${list(t('ai.missing'), (r.missing ?? []).map((m) => `${escapeHtml(m.component)} — ${escapeHtml(m.reason)}`))}
      ${list(t('ai.issues'), (res.issues ?? []).map((i) => `${escapeHtml(i.code)}: ${escapeHtml(i.nodes.join(' / '))}${i.suggest ? ` → ${escapeHtml(i.suggest)}` : ''}`))}
      <h4>${escapeHtml(t('ai.code'))}</h4>
      <pre class="ai-code">${escapeHtml(res.sketch)}</pre>
      ${res.usage?.limit ? `<p class="ai-usage">${escapeHtml(t('ai.usage', res.usage))}</p>` : ''}`;
    show('preview');
    // meja 3D kecil (hanya tampilan), dibuat sekali lalu dipakai ulang
    if (!preview) {
      const stage = createStage($('.ai-stage canvas'), {});
      preview = { stage, wb: createWorkbench(stage, {}) };
    }
    preview.wb.loadDiagram(res.diagram);
    preview.wb.setMode('run');
    requestAnimationFrame(() => {
      preview.stage.resize();
      const box = preview.wb.bounds();
      if (!box.isEmpty()) preview.stage.rig.frame(box, { left: 16, right: 16, top: 16, bottom: 16 }, { instant: true });
    });
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const prompt = form.prompt.value.trim();
    if (!prompt) return say(t('ai.empty'));
    const mode = form['ai-mode'].value;
    const acc = await account;
    const current = mode === 'modify' ? getCurrent() : null;
    show('working');
    const res = fake
      ? await (await import('./fake.js')).fakeRequest({ mode, current, variant: fake })
      : await requestCircuit({ prompt, mode, lang, current, token: await acc.backend.accessToken() });
    if (!res.ok) {
      show('form');
      return say(failureText(res));
    }
    last = { res, mode, before: current };
    renderPreview(res, mode, current);
  });

  modal.addEventListener('click', (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (e.target === modal || act === 'close') close();
    if (act === 'reject') show('form');
    if (act === 'accept' && last) {
      close();
      if (last.mode === 'modify') onAcceptModify(last.res);
      else onAcceptNew(last.res);
      last = null;
    }
  });
  // masuk/keluar saat kotak terbuka (mis. lewat tombol "Masuk" di pesan): perbarui status
  account.then((acc) =>
    acc.onChange(() => {
      if (!modal.hidden) refresh();
    })
  );
  modal.addEventListener('keydown', (e) => {
    e.stopPropagation(); // pintasan sandbox (A, R, Delete, …) tidak berlaku saat mengetik di sini
    if (e.key === 'Escape') close();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.hidden) close(); // juga bila fokus sedang di luar kotak
  });

  return {
    async open() {
      modal.hidden = false;
      show('form');
      await refresh();
      form.prompt.focus();
    },
    /** Untuk pengujian otomatis (DEV). */
    get element() {
      return modal;
    },
  };
}
