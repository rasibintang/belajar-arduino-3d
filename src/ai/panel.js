import { createStage } from '../core/stage.js';
import { createWorkbench } from '../sandbox/workbench.js';
import { COMPONENT_BY_TYPE } from '../components/index.js';
import { escapeHtml } from '../ui/highlight.js';
import { icon } from '../ui/icons.js';
import { fetchAiInfo, requestCircuit, reportMissing, diffCircuits } from './client.js';
import { PRESETS, loadKey, saveKey, clearKey, keyReady, listModels, createBrowserClient } from './byok.js';
import { runPipeline } from './pipeline.js';
import { monitor } from '../monitor/client.js';
import './ai.css';

/**
 * Kotak "Susun dengan AI": perintah → AI → pratinjau → Terima / Tolak.
 * Dua sumber: "Kunci saya" (AI dipanggil dari browser dengan kunci pengguna; alur pemeriksaan juga
 * di browser) dan "Jatah gratis situs" (lewat /api/ai, wajib login, bila pemilik memasang kunci server).
 * deps: { t, lang, toast, account: Promise<{ backend, user() }>, compile(sketch), getCurrent(), onAcceptNew(res), onAcceptModify(res) }
 */
export function createAiPanel({ t, lang, toast, account, compile, getCurrent, onAcceptNew, onAcceptModify }) {
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
        <div class="ai-source" role="radiogroup" aria-label="${escapeHtml(t('ai.source'))}">
          <label><input type="radio" name="ai-source" value="own" checked> ${escapeHtml(t('ai.sourceOwn'))}</label>
          <label class="ai-source-site"><input type="radio" name="ai-source" value="site"> ${escapeHtml(t('ai.sourceSite'))}</label>
        </div>
        <fieldset class="ai-key">
          <div class="ai-key-using" hidden>
            <span></span>
            <button type="button" class="sb-btn" data-act="change-key">${escapeHtml(t('ai.changeKey'))}</button>
            <button type="button" class="sb-btn sb-danger" data-act="clear-key">${escapeHtml(t('ai.clearKey'))}</button>
          </div>
          <div class="ai-key-form">
            <label>${escapeHtml(t('ai.provider'))}
              <select name="provider">${Object.entries(PRESETS)
                .map(([id, p]) => `<option value="${id}">${escapeHtml(p.label)}${p.free ? ` (${escapeHtml(t('ai.free'))})` : ''}</option>`)
                .join('')}</select>
            </label>
            <label class="ai-base" hidden>${escapeHtml(t('ai.baseUrl'))}<input name="baseUrl" type="url" placeholder="https://…/v1" autocomplete="off"></label>
            <label>${escapeHtml(t('ai.key'))}<input name="apiKey" type="password" autocomplete="off" spellcheck="false"></label>
            <label>${escapeHtml(t('ai.model'))}
              <span class="ai-model-row"><input name="model" list="ai-models" autocomplete="off" spellcheck="false"><datalist id="ai-models"></datalist>
              <button type="button" class="sb-btn" data-act="load-models">${escapeHtml(t('ai.loadModels'))}</button></span>
            </label>
            <label class="ai-check"><input type="checkbox" name="remember"> ${escapeHtml(t('ai.remember'))}</label>
            <p class="ai-help">${escapeHtml(t('ai.keyNote'))}</p>
            <details class="ai-howto"><summary>${escapeHtml(t('ai.howTo'))}</summary>
              <ol>${t('ai.howToSteps').split('\n').map((s) => `<li>${escapeHtml(s)}</li>`).join('')}</ol>
              <a class="sb-btn" href="${PRESETS.gemini.keyUrl}" target="_blank" rel="noopener">${escapeHtml(t('ai.openStudio'))} ↗</a>
            </details>
            <div class="ai-actions"><button type="button" class="sb-btn" data-act="save-key">${escapeHtml(t('ai.saveKey'))}</button></div>
          </div>
        </fieldset>
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

  // ------------------------------------------------------------ kunci milik pengguna
  const source = () => form['ai-source'].value;
  let editingKey = false;
  function fillKeyForm(cfg) {
    form.provider.value = cfg?.provider ?? 'gemini';
    form.apiKey.value = cfg?.apiKey ?? '';
    form.model.value = cfg?.model ?? (form.provider.value === 'anthropic' ? 'claude-sonnet-5-5' : '');
    form.baseUrl.value = cfg?.baseUrl ?? '';
    form.remember.checked = !!cfg?.remember;
    $('.ai-base').hidden = form.provider.value !== 'custom';
    $('.ai-howto').hidden = form.provider.value !== 'gemini';
  }
  function renderKey() {
    const cfg = loadKey();
    const own = source() === 'own';
    $('.ai-key').hidden = !own;
    const ready = keyReady(cfg) && !editingKey;
    $('.ai-key-using').hidden = !ready;
    $('.ai-key-form').hidden = ready;
    if (ready) $('.ai-key-using span').textContent = t('ai.usingKey', { provider: PRESETS[cfg.provider].label, model: cfg.model.replace(/^models\//, '') });
    else if (!editingKey) fillKeyForm(cfg);
    return ready;
  }
  const formKey = () => ({
    provider: form.provider.value,
    apiKey: form.apiKey.value.trim(),
    model: form.model.value.trim(),
    baseUrl: form.baseUrl.value.trim() || undefined,
    remember: form.remember.checked,
  });
  form.provider.addEventListener('change', () => {
    $('.ai-base').hidden = form.provider.value !== 'custom';
    $('.ai-howto').hidden = form.provider.value !== 'gemini';
    form.model.value = form.provider.value === 'anthropic' ? 'claude-sonnet-5-5' : '';
    $('#ai-models').replaceChildren();
  });
  form['ai-source'].forEach((r) => r.addEventListener('change', () => refresh()));

  async function refresh() {
    info ??= fake ? { enabled: true, label: 'contoh (DEV)' } : await fetchAiInfo();
    $('.ai-source').hidden = !info.enabled; // satu sumber saja → tidak perlu tab
    if (!info.enabled && source() === 'site') form['ai-source'].value = 'own';
    const submit = form.querySelector('[type=submit]');
    const acc = await account;
    say(null);
    if (source() === 'own') {
      const ready = renderKey();
      const cfg = loadKey();
      $('.ai-privacy').textContent = ready ? t('ai.privacyOwn', { label: PRESETS[cfg.provider].label }) : '';
      submit.disabled = !ready;
      return;
    }
    $('.ai-key').hidden = true;
    $('.ai-privacy').textContent = t('ai.privacy', { label: info.label });
    if (!acc.backend || !acc.user()) {
      submit.disabled = true;
      return say(t('ai.signIn'), acc.backend && { label: t('acct.signIn'), onClick: () => acc.backend.signIn().catch(() => toast(t('acct.offline'), 'error')) });
    }
    submit.disabled = false;
  }

  /** Jalur "Kunci saya": AI dipanggil dari browser; alur pemeriksaan sama dengan server. */
  async function runOwn({ prompt, mode, current }) {
    const ai = await createBrowserClient(loadKey());
    const { outcome, result } = await runPipeline({ generate: (args) => ai.generate(args), request: { prompt, mode, lang, current }, compile: (sketch) => compile(sketch) });
    const missing = Array.isArray(result?.missing) ? result.missing.filter((m) => m?.component) : [];
    if (missing.length) {
      const acc = await account;
      const token = acc.user() ? await acc.backend.accessToken().catch(() => null) : null;
      reportMissing({ prompt, missing, token }); // tidak ditunggu; gagal pun tidak apa-apa
    }
    if (!outcome.ok) return { ok: false, code: 'failed', reason: outcome.reason, details: outcome.details, missing };
    return { ok: true, result, diagram: outcome.diagram, sketch: result.sketch, issues: outcome.issues, compile: outcome.compile };
  }

  function failureText(res) {
    if (res.reason === 'provider' && /HTTP 40[13]|authentication|api key/i.test(res.details?.join(' ') ?? '')) return t('ai.badKey');
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
    if (source() === 'own' && !keyReady(loadKey())) return say(t('ai.needKey'));
    const current = mode === 'modify' ? getCurrent() : null;
    show('working');
    let res;
    if (fake) res = await (await import('./fake.js')).fakeRequest({ mode, current, variant: fake });
    else if (source() === 'own') {
      const started = performance.now();
      res = await runOwn({ prompt, mode, current }).catch((err) => ({ ok: false, code: 'failed', reason: 'provider', details: [String(err?.message ?? err)] }));
      monitor.metric('ai', performance.now() - started, res.ok);
      if (!res.ok) {
        // hanya alasan & kode HTTP; isi perintah/jawaban tidak dikirim
        const status = /HTTP \d{3}/.exec(res.details?.join(' ') ?? '')?.[0];
        monitor.event('warn', 'ai', `kunci saya (${PRESETS[loadKey()?.provider]?.label ?? '?'}): ${res.reason}${status ? ` ${status}` : ''}`);
      }
    }
    else res = await requestCircuit({ prompt, mode, lang, current, token: await acc.backend.accessToken() });
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
    if (act === 'save-key') {
      const cfg = formKey();
      if (!keyReady(cfg)) return say(t('ai.needKey'));
      saveKey(cfg, { remember: cfg.remember });
      editingKey = false;
      refresh();
    }
    if (act === 'change-key') {
      editingKey = true;
      fillKeyForm(loadKey());
      renderKey();
    }
    if (act === 'clear-key') {
      clearKey();
      editingKey = false;
      toast(t('ai.keyCleared'));
      refresh();
    }
    if (act === 'load-models') {
      const cfg = formKey();
      const btn = e.target.closest('button');
      btn.disabled = true;
      listModels(cfg)
        .then((models) => {
          $('#ai-models').replaceChildren(...models.map((m) => Object.assign(document.createElement('option'), { value: m.id, label: m.label })));
          if (!form.model.value && models[0]) form.model.value = models[0].id;
          say(null);
        })
        .catch(() => say(t('ai.modelsFailed')))
        .finally(() => (btn.disabled = false));
    }
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
