import '@fontsource/barlow-semi-condensed/500.css';
import '@fontsource/barlow-semi-condensed/600.css';
import '@fontsource/barlow-semi-condensed/700.css';
import '@fontsource/barlow-semi-condensed/800.css';
import '@fontsource/barlow/400.css';
import '@fontsource/barlow/500.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/600.css';
import '../styles/app.css';
import './sandbox.css';

import { createStage } from '../core/stage.js';
import { COMPONENTS, COMPONENT_BY_TYPE, CATEGORIES, instantiate } from '../components/index.js';
import { WIRE_COLORS } from '../parts/wire.js';
import { icon, LOGO } from '../ui/icons.js';
import { escapeHtml } from '../ui/highlight.js';
import { renderThumbs } from '../ui/thumbs.js';
import { createWorkbench } from './workbench.js';
import { createCodeEditor } from './code-editor.js';
import { createSim } from './sim.js';
import { EXAMPLES, BLANK } from './examples.js';
import { loadLocal, saveLocal, shareUrl, fromHash, download, pickFile } from './project.js';

const $ = (s) => document.querySelector(s);
document.querySelectorAll('[data-logo]').forEach((el) => (el.innerHTML = LOGO));

const LIBRARIES = [
  ['Servo', 'Mengendalikan motor servo (pulsa 1–2 ms).'],
  ['LiquidCrystal I2C', 'LCD karakter lewat modul I²C PCF8574.'],
  ['Wire', 'Komunikasi I²C (bawaan Arduino).'],
  ['DHT sensor library', 'Sensor suhu & kelembapan DHT11/DHT22.'],
  ['Adafruit NeoPixel', 'LED RGB berantai WS2812.'],
  ['Keypad', 'Keypad matriks 3×4 / 4×4.'],
  ['RTClib', 'Jam real-time DS1307/DS3231.'],
  ['Stepper', 'Motor stepper (bawaan Arduino).'],
  ['EEPROM', 'Memori 1 KB yang tidak hilang (bawaan).'],
];

await Promise.all(
  ['600 20px "Barlow Semi Condensed"', '700 20px "Barlow Semi Condensed"', '800 20px "Barlow Semi Condensed"', '600 20px "IBM Plex Mono"'].map((f) =>
    document.fonts.load(f)
  )
).catch(() => {});

// ------------------------------------------------------------------ proyek
let project = { name: 'Proyek baru', sketch: BLANK.sketch, diagram: BLANK.diagram, eeprom: null };
const fromLink = await fromHash();
const stored = loadLocal();
if (fromLink?.diagram) project = { ...project, ...fromLink };
else if (stored?.diagram) project = { ...project, ...stored };

// ------------------------------------------------------------------ panggung 3D
const tip = $('#tip');
let wb = null;
const stage = createStage($('#canvas'), {
  onHover: (part, x, y) => wb?.hover(part, x, y),
  onPartClick: (part, x, y) => wb?.click(part, x, y),
  onEmptyClick: () => {
    if (wb.wiring) wb.cancelWiring();
    else wb.select(null);
  },
  onGestureStart: () => (tip.hidden = true),
});

wb = createWorkbench(stage, {
  onChange: () => {
    project.diagram = wb.toDiagram();
    persist();
    refreshDiagramTab();
    $('#empty').hidden = wb.parts.size > 0;
  },
  onSelect: (sel) => showPanel(sel),
  onPartClick: (part) => showPanel({ kind: 'part', id: part.id }),
  onHover: (info, x, y) => {
    if (!info) {
      tip.hidden = true;
      return;
    }
    const box = $('#stage').getBoundingClientRect();
    tip.querySelector('b').textContent = info.name;
    tip.querySelector('span').textContent = info.desc ?? '';
    tip.hidden = false;
    tip.style.transform = `translate(${x - box.left + 16}px, ${y - box.top + 18}px)`;
  },
  onWiring: (on) => {
    setHint(on ? 'Klik pin tujuan untuk memasang kabel · Esc batal' : null);
    if (on) {
      wb.select(null); // panel tidak boleh menutupi pin tujuan
      showPanel(null);
    }
  },
});
$('#canvas').addEventListener('pointermove', (e) => wb.pointerMove(e.clientX, e.clientY));

// ------------------------------------------------------------------ editor
const editor = createCodeEditor($('#editor'), {
  onChange: (text) => {
    project.sketch = text;
    persist();
  },
});
const diagramEditor = createCodeEditor($('#diagram-editor'));

function refreshDiagramTab() {
  if (document.activeElement?.closest('#diagram-editor')) return;
  diagramEditor.value = JSON.stringify(project.diagram, null, 2);
}

$('#apply-diagram').addEventListener('click', () => {
  try {
    const d = JSON.parse(diagramEditor.value);
    loadDiagram(d);
    serial.sys('Diagram diterapkan.');
  } catch (err) {
    serial.err(`diagram.json tidak valid: ${err.message}`);
  }
});

document.querySelectorAll('.sb-tabs [data-tab]').forEach((b) =>
  b.addEventListener('click', () => {
    document.querySelectorAll('.sb-tabs [data-tab]').forEach((t) => t.setAttribute('aria-selected', String(t === b)));
    document.querySelectorAll('.sb-pane').forEach((p) => (p.hidden = p.dataset.pane !== b.dataset.tab));
    if (b.dataset.tab === 'diagram') refreshDiagramTab();
  })
);
$('.sb-libs').innerHTML = `<p>Library yang terpasang di server kompilasi — cukup <code>#include</code>:</p><ul>${LIBRARIES.map(
  ([n, d]) => `<li><b>${n}</b><span>${d}</span></li>`
).join('')}</ul>`;

// ------------------------------------------------------------------ serial monitor
const serialLines = $('#serial-lines');
let partial = null;
function serialLine(text, cls) {
  const el = document.createElement('div');
  if (cls) el.className = cls;
  el.textContent = text;
  serialLines.appendChild(el);
  while (serialLines.childElementCount > 500) serialLines.firstElementChild.remove();
  serialLines.scrollTop = serialLines.scrollHeight;
  return el;
}
const serial = {
  sys: (t) => serialLine(t, 'cl-sys'),
  warn: (t) => serialLine(t, 'cl-warn'),
  err: (t) => serialLine(t, 'cl-err'),
  out(text, done) {
    if (!partial) partial = serialLine('', '');
    partial.textContent = text;
    if (done) partial = null;
    serialLines.scrollTop = serialLines.scrollHeight;
  },
  clear() {
    serialLines.replaceChildren();
    partial = null;
  },
};
$('#serial-clear').addEventListener('click', () => serial.clear());
$('#serial-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const input = $('#serial-input');
  if (!input.value) return;
  if (sim.send(input.value + '\n')) {
    serialLine(`> ${input.value}`, 'cl-in');
    input.value = '';
  } else serial.warn('Jalankan simulasi dulu untuk mengirim teks.');
});
$('#serial-input').addEventListener('keydown', (e) => e.stopPropagation());

// ------------------------------------------------------------------ simulasi
const sim = createSim({
  wb,
  editor,
  serial,
  getEeprom: () => project.eeprom,
  setEeprom: (bytes) => {
    project.eeprom = bytes;
    persist();
  },
  onState(state) {
    const run = $('#btn-run');
    run.innerHTML = icon(state === 'idle' ? 'run' : 'stop');
    run.classList.toggle('is-busy', state === 'compiling');
    run.classList.toggle('is-running', state === 'running');
    run.title = state === 'idle' ? 'Jalankan (Ctrl+Enter)' : 'Hentikan (Ctrl+Enter)';
    $('#serial-status').textContent = { idle: 'Berhenti', compiling: 'Mengompilasi', running: 'Berjalan' }[state];
    $('#serial-dot').dataset.state = state;
    document.body.classList.toggle('is-running', state === 'running');
    setHint(state === 'running' ? 'Simulasi berjalan — klik komponen untuk berinteraksi' : null);
    if (state === 'idle') $('#speed').textContent = '';
    showPanel(null);
  },
});
$('#btn-run').addEventListener('click', () => (sim.state === 'idle' ? sim.start() : sim.stop()));
$('#btn-run').innerHTML = icon('run');

let speedTimer = 0;
stage.onUpdate((dt) => {
  sim.frame(dt);
  speedTimer += dt;
  if (sim.state === 'running' && speedTimer > 0.5) {
    speedTimer = 0;
    $('#speed').textContent = `Kecepatan simulasi ${Math.min(100, Math.round(sim.speed * 100))}%`;
  }
});

// ------------------------------------------------------------------ toolbar & hint
$('#btn-add').innerHTML = icon('plus');
$('#btn-fit').innerHTML = icon('focus');
$('#btn-fit').addEventListener('click', () => fit(false));
let hintDefault = 'Seret komponen untuk memindah · klik pin untuk menarik kabel · R putar · Delete hapus';
function setHint(text) {
  $('#hint').textContent = text ?? hintDefault;
}
setHint(null);

function fit(instant) {
  const box = wb.bounds();
  if (box.isEmpty()) return;
  const { width: w, height: h } = stage.size;
  stage.rig.frame(box, { left: w * 0.06, right: w * 0.06, top: h * 0.1, bottom: h * 0.08 }, { instant });
}

// ------------------------------------------------------------------ panel komponen / kabel
const panel = $('#panel');
function control(def, value) {
  if (def.type === 'swatch') {
    return `<div class="swatches">${def.options
      .map((o) => `<button class="swatch${o.value === value ? ' is-on' : ''}" data-key="${def.key}" data-value="${o.value}" title="${o.label}" style="--c:${o.color}"></button>`)
      .join('')}</div>`;
  }
  if (def.type === 'choice') {
    return `<div class="segmented">${def.options
      .map((o) => `<button class="${o.value === value ? 'is-on' : ''}" data-key="${def.key}" data-value="${o.value}">${o.label}</button>`)
      .join('')}</div>`;
  }
  if (def.type === 'text') {
    return `<input class="insp-text" type="text" data-key="${def.key}" value="${escapeHtml(String(value ?? ''))}" maxlength="60">`;
  }
  return `<div class="range"><input type="range" data-key="${def.key}" min="${def.min}" max="${def.max}" step="${def.step}" value="${value}"><output>${value}${def.unit ? ' ' + def.unit : ''}</output></div>`;
}

function showPanel(sel) {
  if (!sel) {
    panel.hidden = true;
    return;
  }
  if (sel.kind === 'wire') {
    const w = wb.wires.get(sel.id);
    if (!w) return (panel.hidden = true);
    panel.dataset.kind = 'wire';
    panel.dataset.id = sel.id;
    panel.innerHTML = `
      <header><div><small>Kabel</small><h3>${escapeHtml(w.from)} → ${escapeHtml(w.to)}</h3></div>
        <button class="icon-btn" data-act="close" aria-label="Tutup">${icon('close')}</button></header>
      <div class="insp-row"><label>Warna</label><div class="swatches">${Object.entries(WIRE_COLORS)
        .map(([name, hex]) => `<button class="swatch${name === w.color ? ' is-on' : ''}" data-color="${name}" title="${name}" style="--c:${hex}"></button>`)
        .join('')}</div></div>
      <div class="sb-panel-actions"><button class="sb-btn sb-danger" data-act="delete">Hapus kabel</button></div>`;
    panel.hidden = false;
    return;
  }
  const part = wb.parts.get(sel.id);
  if (!part) return (panel.hidden = true);
  const editing = wb.mode === 'edit';
  panel.dataset.kind = 'part';
  panel.dataset.id = part.id;
  panel.innerHTML = `
    <header><div><small>${CATEGORIES[part.spec.category]} · ${part.id}</small><h3>${part.spec.name}</h3></div>
      <button class="icon-btn" data-act="close" aria-label="Tutup">${icon('close')}</button></header>
    <p class="insp-desc">${part.spec.desc}</p>
    ${(part.spec.props ?? [])
      .filter((p) => editing || !p.rebuild)
      .map((p) => `<div class="insp-row"><label>${p.label}</label>${control(p, part.props[p.key])}</div>`)
      .join('')}
    ${editing ? `<div class="sb-panel-actions"><button class="sb-btn" data-act="rotate">${icon('rotRight')} Putar</button><button class="sb-btn sb-danger" data-act="delete">Hapus</button></div>` : ''}`;
  panel.hidden = false;
}

panel.addEventListener('pointerdown', (e) => e.stopPropagation());
panel.addEventListener('keydown', (e) => e.stopPropagation());
panel.addEventListener('click', (e) => {
  const id = panel.dataset.id;
  const act = e.target.closest('[data-act]')?.dataset.act;
  if (act === 'close') return wb.select(null), showPanel(null);
  if (panel.dataset.kind === 'wire') {
    const sw = e.target.closest('[data-color]');
    if (sw) {
      wb.setWireColor(id, sw.dataset.color);
      showPanel({ kind: 'wire', id });
    }
    if (act === 'delete') wb.removeWire(id);
    return;
  }
  if (act === 'rotate') return wb.rotatePart(id);
  if (act === 'delete') return wb.removePart(id);
  const btn = e.target.closest('button[data-key]');
  if (btn) {
    const def = wb.parts.get(id).spec.props.find((p) => p.key === btn.dataset.key);
    const opt = def.options.find((o) => String(o.value) === btn.dataset.value);
    wb.setProp(id, def.key, opt.value);
    sim.refresh();
    showPanel({ kind: 'part', id });
  }
});
panel.addEventListener('input', (e) => {
  const input = e.target.closest('input[data-key]');
  if (!input) return;
  const id = panel.dataset.id;
  const def = wb.parts.get(id).spec.props.find((p) => p.key === input.dataset.key);
  if (def.type === 'text') {
    wb.setProp(id, def.key, input.value);
    return;
  }
  wb.setProp(id, def.key, Number(input.value));
  input.nextElementSibling.textContent = `${input.value}${def.unit ? ' ' + def.unit : ''}`;
  sim.refresh();
});

// ------------------------------------------------------------------ dialog tambah komponen
const modal = $('#add-modal');
let activeCat = 'all';
$('#add-close').innerHTML = icon('close');
$('#part-cats').innerHTML = [['all', 'Semua'], ...Object.entries(CATEGORIES)]
  .filter(([k]) => k === 'all' || COMPONENTS.some((c) => c.category === k))
  .map(([k, v]) => `<button data-cat="${k}" class="${k === 'all' ? 'is-on' : ''}">${v}</button>`)
  .join('');
$('#part-list').innerHTML = COMPONENTS.map(
  (c) => `<button class="sb-card" data-type="${c.type}" data-cat="${c.category}">
    <span class="sb-thumb"><img alt="" /><span class="sb-thumb-icon">${icon(c.icon)}</span></span>
    <b>${c.name}</b><small>${c.desc}</small></button>`
).join('');

function filterCatalog() {
  const q = $('#part-search').value.trim().toLowerCase();
  for (const card of $('#part-list').children) {
    const spec = COMPONENT_BY_TYPE[card.dataset.type];
    const text = `${spec.name} ${spec.desc} ${spec.type}`.toLowerCase();
    card.hidden = (activeCat !== 'all' && spec.category !== activeCat) || (q && !text.includes(q));
  }
}
$('#part-search').addEventListener('input', filterCatalog);
$('#part-search').addEventListener('keydown', (e) => {
  e.stopPropagation();
  if (e.key === 'Escape') closeAdd();
  if (e.key === 'Enter') [...$('#part-list').children].find((c) => !c.hidden)?.click();
});
$('#part-cats').addEventListener('click', (e) => {
  const b = e.target.closest('[data-cat]');
  if (!b) return;
  activeCat = b.dataset.cat;
  $('#part-cats').querySelectorAll('button').forEach((x) => x.classList.toggle('is-on', x === b));
  filterCatalog();
});
$('#part-list').addEventListener('click', (e) => {
  const card = e.target.closest('[data-type]');
  if (!card) return;
  if (sim.state !== 'idle') sim.stop();
  const part = wb.addPart(card.dataset.type);
  wb.select({ kind: 'part', id: part.id });
  closeAdd();
});
modal.addEventListener('pointerdown', (e) => {
  if (e.target === modal) closeAdd();
});
$('#btn-add').addEventListener('click', openAdd);
$('#add-close').addEventListener('click', closeAdd);

let thumbsDone = false;
function openAdd() {
  modal.hidden = false;
  $('#part-search').value = '';
  filterCatalog();
  $('#part-search').focus();
  if (!thumbsDone) {
    thumbsDone = true;
    renderThumbs(COMPONENTS.map((c) => ({ thumb: () => instantiate(c) })), { width: 200, height: 130 })
      .then((urls) =>
        $('#part-list')
          .querySelectorAll('img')
          .forEach((img, i) => {
            img.src = urls[i];
            img.parentElement.classList.add('has-img');
          })
      )
      .catch(() => {});
  }
}
function closeAdd() {
  modal.hidden = true;
}

// ------------------------------------------------------------------ menu atas
const menu = $('#examples-menu');
menu.innerHTML = EXAMPLES.map((ex) => `<button data-example="${ex.id}"><b>${ex.title}</b><small>${ex.desc}</small></button>`).join('');
$('#btn-examples').addEventListener('click', (e) => {
  e.stopPropagation();
  menu.hidden = !menu.hidden;
});
document.addEventListener('pointerdown', (e) => {
  if (!e.target.closest('.sb-menu')) menu.hidden = true;
});
menu.addEventListener('click', (e) => {
  const ex = EXAMPLES.find((x) => x.id === e.target.closest('[data-example]')?.dataset.example);
  if (!ex) return;
  menu.hidden = true;
  openProject({ name: ex.title, sketch: ex.sketch, diagram: ex.diagram });
});
$('#btn-new').addEventListener('click', () => {
  if (confirm('Mulai proyek baru? Proyek sekarang akan diganti (unduh dulu jika ingin menyimpannya).')) openProject({ ...BLANK, name: 'Proyek baru' });
});
$('#btn-save').addEventListener('click', () => download(project));
$('#btn-open').addEventListener('click', async () => {
  const data = await pickFile();
  if (!data) return;
  if (data.error) return serial.err(data.error);
  openProject({ name: data.name ?? 'Proyek', sketch: data.sketch ?? project.sketch, diagram: data.diagram });
});
$('#btn-share').addEventListener('click', async () => {
  const url = await shareUrl(project);
  try {
    await navigator.clipboard.writeText(url);
    flashSaved('Tautan disalin ✓');
  } catch {
    prompt('Salin tautan ini:', url);
  }
});
const nameInput = $('#project-name');
nameInput.addEventListener('input', () => {
  project.name = nameInput.value;
  document.title = `${project.name || 'Sandbox'} · Learn Arduino`;
  persist();
});
nameInput.addEventListener('keydown', (e) => e.stopPropagation());

// ------------------------------------------------------------------ keyboard
window.addEventListener('keydown', (e) => {
  if (e.target.closest?.('input, textarea')) return;
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault();
    return sim.state === 'idle' ? sim.start() : sim.stop();
  }
  const sel = wb.selection;
  if (e.key === 'Escape') {
    if (!modal.hidden) return closeAdd();
    wb.cancelWiring();
    wb.select(null);
  } else if ((e.key === 'Delete' || e.key === 'Backspace') && sel && wb.mode === 'edit') {
    e.preventDefault();
    if (sel.kind === 'part') wb.removePart(sel.id);
    else wb.removeWire(sel.id);
  } else if (e.key.toLowerCase() === 'r' && sel?.kind === 'part' && wb.mode === 'edit') {
    wb.rotatePart(sel.id);
  } else if (e.key.toLowerCase() === 'a' && wb.mode === 'edit') {
    e.preventDefault();
    openAdd();
  }
});

// ------------------------------------------------------------------ simpan & buka
let saveTimer = 0;
function persist() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    if (saveLocal(project)) flashSaved('Tersimpan');
  }, 400);
}
function flashSaved(text) {
  const note = $('#saved-note');
  note.textContent = text;
  note.classList.add('is-on');
  clearTimeout(flashSaved.t);
  flashSaved.t = setTimeout(() => note.classList.remove('is-on'), 1600);
}

function loadDiagram(d) {
  sim.stop();
  const problems = wb.loadDiagram(d);
  for (const p of problems) serial.warn(p);
  project.diagram = wb.toDiagram();
  $('#empty').hidden = wb.parts.size > 0;
  fit(true);
}

function openProject(p) {
  sim.stop();
  project = { name: p.name ?? 'Proyek', sketch: p.sketch ?? '', diagram: p.diagram ?? { parts: [], wires: [] }, eeprom: p.eeprom ?? null };
  nameInput.value = project.name;
  document.title = `${project.name} · Learn Arduino`;
  editor.value = project.sketch;
  serial.clear();
  loadDiagram(project.diagram);
  refreshDiagramTab();
  persist();
  if (location.hash) history.replaceState(null, '', location.pathname);
}

openProject(project);
if (fromLink) serial.sys('Proyek dibuka dari tautan.');
showPanel(null);

// akses untuk pengujian otomatis (hanya saat pengembangan)
if (import.meta.env.DEV) window.__sb = { wb, sim, stage, editor, openProject, EXAMPLES };
