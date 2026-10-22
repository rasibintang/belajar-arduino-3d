import { highlight, escapeHtml } from './highlight.js';
import { icon } from './icons.js';

const PHASE_LABEL = {
  idle: 'Berhenti',
  compiling: 'Mengompilasi',
  uploading: 'Mengunggah',
  running: 'Berjalan',
};

/** Kartu "Coba sendiri": kode berwarna, salin, jalankan, dan Serial Monitor. */
export function createCodeCard(root, { onRun, onParamClick, onSend }) {
  const codeEl = root.querySelector('code');
  const consoleLines = root.querySelector('.console-lines');
  const statusEl = root.querySelector('.console-status');
  const runBtn = root.querySelector('.btn-run');
  const copyBtn = root.querySelector('.btn-copy');
  const form = root.querySelector('.console-input');
  const input = form.querySelector('input');
  const hints = form.querySelector('.console-hints');
  let plain = '';

  // Serial Monitor dua arah: ketik perintah atau klik saran
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (text && onSend?.(text)) input.value = '';
  });
  hints.addEventListener('click', (e) => {
    const b = e.target.closest('[data-cmd]');
    if (b) onSend?.(b.dataset.cmd);
  });
  input.addEventListener('keydown', (e) => e.stopPropagation()); // jangan picu pintasan keyboard

  root.querySelector('.btn-expand').innerHTML = icon('expand');
  copyBtn.innerHTML = icon('copy');
  runBtn.innerHTML = icon('run');
  root.querySelector('.console-close').innerHTML = icon('close');

  runBtn.addEventListener('click', () => onRun());
  root.querySelector('.console-close').addEventListener('click', () => onRun(false));
  root.querySelector('.btn-expand').addEventListener('click', (e) => {
    const on = root.classList.toggle('is-expanded');
    e.currentTarget.setAttribute('aria-expanded', String(on));
    document.body.classList.toggle('has-overlay', on);
  });
  copyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(plain);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = plain;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    copyBtn.classList.add('is-done');
    copyBtn.innerHTML = icon('check');
    setTimeout(() => {
      copyBtn.classList.remove('is-done');
      copyBtn.innerHTML = icon('copy');
    }, 1400);
  });
  codeEl.addEventListener('click', (e) => {
    const chip = e.target.closest('.param');
    if (chip) onParamClick(chip.dataset.key, e.clientX, e.clientY);
  });

  let traced = null; // { text, nth } baris yang sedang dieksekusi

  /**
   * segments: hasil codeSegments() — string atau { key, value }
   * changedKey: parameter yang baru diubah (angkanya berkedip, baris baru disorot)
   */
  function setCode(segments, changedKey = null) {
    const before = changedKey ? new Set(plain.split('\n')) : null;
    plain = segments.map((s) => (typeof s === 'string' ? s : s.value)).join('');
    const html = segments
      .map((s) =>
        typeof s === 'string'
          ? highlight(s)
          : `<button class="param${s.key === changedKey ? ' is-flash' : ''}" data-key="${s.key}" title="Klik untuk mengubah">${escapeHtml(s.value)}</button>`
      )
      .join('');
    const lines = plain.split('\n');
    codeEl.innerHTML = html
      .split('\n')
      .map((line, i) => {
        const isNew = before && lines[i].trim() && !before.has(lines[i]);
        return `<span class="line${isNew ? ' is-new' : ''}"><span class="ln">${i + 1}</span><span class="lc">${line || ' '}</span></span>`;
      })
      .join('');
    if (changedKey) reveal(codeEl.querySelector('.is-flash, .is-new'));
    if (traced) trace(traced.text, traced.nth, true);
  }

  /** Gulir seperlunya agar elemen terlihat di dalam area kode. */
  function reveal(el) {
    if (!el) return;
    const pre = codeEl.parentElement;
    const line = el.closest('.line') ?? el;
    const top = line.offsetTop;
    const bottom = top + line.offsetHeight;
    const cover = root.classList.contains('has-console') ? pre.clientHeight * 0.54 : 0;
    const visibleBottom = pre.scrollTop + pre.clientHeight - cover;
    if (top < pre.scrollTop + 8 || bottom > visibleBottom - 8) {
      pre.scrollTo({ top: Math.max(0, top - (pre.clientHeight - cover) / 3), behavior: 'smooth' });
    }
  }

  /** Sorot baris ke-nth yang memuat `text`; null = hapus sorotan. */
  function trace(text, nth = 0, force = false) {
    if (!force && traced?.text === text && traced?.nth === nth) return;
    traced = text ? { text, nth } : null;
    codeEl.querySelectorAll('.line.is-trace').forEach((l) => l.classList.remove('is-trace'));
    if (!text) return;
    let count = 0;
    for (const line of codeEl.children) {
      if (!line.querySelector('.lc').textContent.includes(text)) continue;
      if (count++ === nth) {
        line.classList.add('is-trace');
        if (!force) reveal(line);
        break;
      }
    }
  }

  function log(text, kind = '') {
    const line = document.createElement('div');
    line.className = kind ? `cl-${kind}` : '';
    line.textContent = text;
    consoleLines.appendChild(line);
    while (consoleLines.childElementCount > 200) consoleLines.firstElementChild.remove();
    consoleLines.scrollTop = consoleLines.scrollHeight;
  }

  function clearLog() {
    consoleLines.replaceChildren();
  }

  function setPhase(phase) {
    root.dataset.state = phase;
    statusEl.textContent = PHASE_LABEL[phase];
    runBtn.innerHTML = icon(phase === 'idle' ? 'run' : 'stop');
    runBtn.title = phase === 'idle' ? 'Jalankan sketch (Spasi)' : 'Hentikan (Spasi)';
    runBtn.setAttribute('aria-label', runBtn.title);
    if (phase !== 'idle') root.classList.add('has-console');
  }

  function hideConsole() {
    root.classList.remove('has-console');
  }

  /** commands: daftar saran perintah, atau null jika pelajaran tidak menerima input serial. */
  function setSerialInput(commands) {
    form.hidden = !commands;
    root.classList.toggle('has-input', !!commands);
    hints.innerHTML = (commands ?? []).map((c) => `<button type="button" data-cmd="${escapeHtml(c)}">${escapeHtml(c)}</button>`).join('');
  }

  return { setCode, trace, log, clearLog, setPhase, hideConsole, setSerialInput };
}
