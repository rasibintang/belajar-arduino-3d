import { highlight, escapeHtml } from '../ui/highlight.js';

/**
 * Editor kode ringan: <textarea> transparan di atas <pre> berwarna.
 * Fitur: nomor baris, Tab = 2 spasi, indentasi otomatis, penanda baris error,
 * dan sorotan baris yang sedang dijalankan emulator.
 */
export function createCodeEditor(root, { onChange, readOnly = false } = {}) {
  root.classList.add('ce');
  root.innerHTML = `
    <div class="ce-gutter" aria-hidden="true"></div>
    <div class="ce-body">
      <pre class="ce-view" aria-hidden="true"><code></code></pre>
      <textarea class="ce-input" spellcheck="false" autocapitalize="off" autocomplete="off" wrap="off"></textarea>
    </div>`;
  const gutter = root.querySelector('.ce-gutter');
  const view = root.querySelector('.ce-view code');
  const pre = root.querySelector('.ce-view');
  const input = root.querySelector('.ce-input');
  input.readOnly = readOnly;
  let errors = new Map(); // baris -> pesan
  let traceLine = 0;

  function render() {
    const text = input.value;
    const lines = text.split('\n');
    // highlight() menerima seluruh teks agar komentar/string multi-token tetap benar per baris
    view.innerHTML = highlight(text) + '\n';
    gutter.innerHTML = lines
      .map((_, i) => {
        const n = i + 1;
        const cls = errors.has(n) ? 'is-error' : n === traceLine ? 'is-trace' : '';
        return `<div class="${cls}" ${errors.has(n) ? `title="${escapeHtml(errors.get(n))}"` : ''}>${n}</div>`;
      })
      .join('');
    renderBands(lines.length);
  }

  // pita latar untuk baris error / baris yang sedang jalan
  const bands = document.createElement('div');
  bands.className = 'ce-bands';
  root.querySelector('.ce-body').prepend(bands);
  function renderBands() {
    const lh = parseFloat(getComputedStyle(input).lineHeight) || 20;
    const pad = parseFloat(getComputedStyle(input).paddingTop) || 0;
    let html = '';
    for (const n of errors.keys()) html += `<div class="ce-band is-error" style="top:${pad + (n - 1) * lh}px;height:${lh}px"></div>`;
    if (traceLine) html += `<div class="ce-band is-trace" style="top:${pad + (traceLine - 1) * lh}px;height:${lh}px"></div>`;
    bands.innerHTML = html;
    bands.style.transform = `translate(${-input.scrollLeft}px, ${-input.scrollTop}px)`;
  }

  function syncScroll() {
    pre.scrollTop = input.scrollTop;
    pre.scrollLeft = input.scrollLeft;
    gutter.scrollTop = input.scrollTop;
    bands.style.transform = `translate(${-input.scrollLeft}px, ${-input.scrollTop}px)`;
  }

  input.addEventListener('input', () => {
    if (errors.size) errors = new Map();
    render();
    syncScroll();
    onChange?.(input.value);
  });
  input.addEventListener('scroll', syncScroll);
  input.addEventListener('keydown', (e) => {
    e.stopPropagation(); // jangan memicu pintasan meja kerja
    if (readOnly) return;
    if (e.key === 'Tab') {
      e.preventDefault();
      insert('  ');
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const before = input.value.slice(0, input.selectionStart);
      const line = before.slice(before.lastIndexOf('\n') + 1);
      let indent = line.match(/^\s*/)[0];
      if (/\{\s*$/.test(line)) indent += '  ';
      insert('\n' + indent);
    } else if (e.key === '}') {
      // kurangi indentasi bila "}" diketik di awal baris kosong
      const before = input.value.slice(0, input.selectionStart);
      const line = before.slice(before.lastIndexOf('\n') + 1);
      if (/^\s{2,}$/.test(line)) {
        e.preventDefault();
        input.setRangeText('', input.selectionStart - 2, input.selectionStart, 'end');
        insert('}');
      }
    }
  });

  function insert(text) {
    input.setRangeText(text, input.selectionStart, input.selectionEnd, 'end');
    input.dispatchEvent(new Event('input'));
  }

  return {
    get value() {
      return input.value;
    },
    set value(v) {
      input.value = v;
      errors = new Map();
      traceLine = 0;
      render();
      syncScroll();
    },
    /** Tandai baris error dari keluaran compiler ("sketch.ino:12:5: error: …"). */
    setErrors(text) {
      errors = new Map();
      for (const m of (text ?? '').matchAll(/sketch\.ino:(\d+):(?:\d+:)?\s*(error|fatal error):\s*([^\n]+)/g)) {
        if (!errors.has(Number(m[1]))) errors.set(Number(m[1]), m[3]);
      }
      render();
      const first = Math.min(...errors.keys());
      if (Number.isFinite(first)) reveal(first);
    },
    /** Sorot baris yang sedang dijalankan (0 = hapus). */
    setTrace(line) {
      if (line === traceLine) return;
      traceLine = line;
      gutter.querySelectorAll('.is-trace').forEach((el) => el.classList.remove('is-trace'));
      if (line) gutter.children[line - 1]?.classList.add('is-trace');
      renderBands();
    },
    focus: () => input.focus(),
    setReadOnly(v) {
      input.readOnly = v;
    },
  };

  function reveal(line) {
    const lh = parseFloat(getComputedStyle(input).lineHeight) || 20;
    input.scrollTop = Math.max(0, (line - 4) * lh);
    syncScroll();
  }
}
