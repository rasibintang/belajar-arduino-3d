import { t, isEN, translateDom, languageSwitch } from '../i18n/index.js';
import { mountAccount, toast } from '../account/ui.js';
import { saveToAccount, openFromAccount, createAutosave } from '../account/cloud-projects.js';
import { createAiPanel } from '../ai/panel.js';
import { logicalCircuit } from '../ai/client.js';
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
import { createGuide, issueText } from './guide.js';
import { checkCircuit } from '../sim/wiring/check.js';
import { createCodeEditor } from './code-editor.js';
import { createSim, compile } from './sim.js';
import { EXAMPLES, BLANK } from './examples.js';
import { LIBRARIES } from './libraries.js';
import { loadLocal, saveLocal, shareUrl, fromHash, download, pickFile } from './project.js';

const $ = (s) => document.querySelector(s);
document.querySelectorAll('[data-logo]').forEach((el) => (el.innerHTML = LOGO));
translateDom();
$('.sb-lang').append(languageSwitch());
const account = mountAccount($('.account-slot'), { buttonClass: 'sb-btn', menuItems: () => accountMenu() });

await Promise.all(
  ['600 20px "Barlow Semi Condensed"', '700 20px "Barlow Semi Condensed"', '800 20px "Barlow Semi Condensed"', '600 20px "IBM Plex Mono"'].map((f) =>
    document.fonts.load(f)
  )
).catch(() => {});

// ------------------------------------------------------------------ proyek
let project = { name: t('sb.newProject'), sketch: BLANK.sketch, diagram: BLANK.diagram, eeprom: null };
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
    scheduleCheck();
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
  onWiring: (on, node, opts = {}) => {
    setHint(on ? t('sb.hint.wiring') : null);
    if (on) guide.startWiring(node);
    else guide.stopWiring();
    guideLabel.textContent = guide.labelText;
    guideLabel.hidden = !guide.labelText;
    if (!guideLabel.hidden) placeGuideLabel();
    if (on && !opts.rewire) {
      wb.select(null); // panel tidak boleh menutupi pin tujuan
      showPanel(null);
    }
  },
});
$('#canvas').addEventListener('pointermove', (e) => wb.pointerMove(e.clientX, e.clientY));

// ------------------------------------------------------------------ panduan kabel
const guide = createGuide({ wb, stage, root: wb.root, layer: $('#stage'), t });
let issues = [];
let checkQueued = false;

/** Periksa ulang kabel (paling sering sekali per frame, karena memuat diagram memicu banyak perubahan). */
function scheduleCheck() {
  if (checkQueued) return;
  checkQueued = true;
  requestAnimationFrame(() => {
    checkQueued = false;
    const s = wb.snapshot();
    issues = checkCircuit(s);
    guide.showIssues(issues, s);
    renderIssues();
  });
}

const issuePanel = $('#guide-issues');
function renderIssues() {
  issuePanel.hidden = !guide.enabled || !issues.length;
  if (issuePanel.hidden) return;
  issuePanel.querySelector('h3').textContent = t('guide.panel', { n: issues.length });
  const list = issuePanel.querySelector('ul');
  list.replaceChildren(
    ...issues.map((issue) => {
      const li = document.createElement('li');
      const btn = document.createElement('button');
      btn.dataset.severity = issue.severity;
      btn.textContent = issueText(issue, t);
      btn.addEventListener('click', () => {
        const id = guide.wireOf(issue);
        const wire = id && wb.wires.get(id);
        if (wire) {
          if (wb.mode === 'edit') wb.select({ kind: 'wire', id });
          stage.focus(wire.group);
          return;
        }
        // kabel yang kurang: sorot komponennya
        const part = wb.parts.get(issue.nodes[0].split(':')[0]);
        if (!part) return;
        if (wb.mode === 'edit') wb.select({ kind: 'part', id: part.id });
        stage.focus(part.group);
      });
      li.append(btn);
      return li;
    })
  );
}
const guideLabel = $('#guide-label');
const pointer = { x: 0, y: 0 };
function placeGuideLabel() {
  const box = $('#stage').getBoundingClientRect();
  // di atas kursor (tooltip pin ada di bawahnya), tetap di dalam meja
  const x = Math.min(pointer.x - box.left + 16, box.width - guideLabel.offsetWidth - 8);
  guideLabel.style.transform = `translate(${Math.max(8, x)}px, ${Math.max(8, pointer.y - box.top - 34)}px)`;
}
$('#stage').addEventListener('pointermove', (e) => {
  pointer.x = e.clientX;
  pointer.y = e.clientY;
  if (!guideLabel.hidden) placeGuideLabel();
});
const guideBtn = $('#btn-guide');
guideBtn.innerHTML = icon('compass');
guideBtn.setAttribute('aria-pressed', String(guide.enabled));
guideBtn.addEventListener('click', () => {
  guide.setEnabled(!guide.enabled);
  guideBtn.setAttribute('aria-pressed', String(guide.enabled));
  if (!guide.enabled) guideLabel.hidden = true;
  renderIssues();
});

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
    serial.sys(t('sb.diagramApplied'));
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
$('.sb-libs').innerHTML = `<p>${t('sb.libsIntro')}</p><ul>${LIBRARIES.map(
  ([n, id, en]) => `<li><b>${n}</b><span>${isEN ? en : id}</span></li>`
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
  sys: (text) => serialLine(text, 'cl-sys'),
  warn: (text) => serialLine(text, 'cl-warn'),
  err: (text) => serialLine(text, 'cl-err'),
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
  } else serial.warn(t('sb.runFirst'));
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
    run.title = state === 'idle' ? t('sb.run.title') : t('sb.stop.title');
    $('#serial-status').textContent = { idle: t('phase.idle'), compiling: t('phase.compiling'), running: t('phase.running') }[state];
    $('#serial-dot').dataset.state = state;
    document.body.classList.toggle('is-running', state === 'running');
    setHint(state === 'running' ? t('sb.hint.running') : null);
    if (state === 'idle') $('#speed').textContent = '';
    if (state === 'running' && guide.enabled) for (const issue of issues) serial.warn(`⚠ ${issueText(issue, t)}`);
    scheduleCheck(); // tombol "Pindahkan ke …" hanya di mode edit
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
    $('#speed').textContent = t('sb.speed', { n: Math.min(100, Math.round(sim.speed * 100)) });
  }
});

// ------------------------------------------------------------------ toolbar & hint
$('#btn-add').innerHTML = icon('plus');
$('#btn-fit').innerHTML = icon('focus');
$('#btn-fit').addEventListener('click', () => fit(false));
let hintDefault = t('sb.hint.edit');
function setHint(text) {
  $('#hint').textContent = text ?? hintDefault;
}
setHint(null);

// ------------------------------------------------------------------ bilah kamera (sama seperti halaman pelajaran)
const viewbar = $('#viewbar');
viewbar.querySelectorAll('[data-view]').forEach((b) => (b.innerHTML = icon(b.dataset.icon)));
viewbar.addEventListener('click', (e) => {
  const v = e.target.closest('[data-view]')?.dataset.view;
  if (v === 'left') stage.rig.rotate(-1);
  if (v === 'right') stage.rig.rotate(1);
  if (v === 'in') stage.rig.zoomBy(1.25);
  if (v === 'out') stage.rig.zoomBy(0.8);
  if (v === 'reset') fit(false);
});
const needle = viewbar.querySelector('.needle');
const panKeys = new Set(); // tombol panah yang sedang ditekan (WASD dipakai pintasan lain di sandbox)
const PAN = { arrowleft: [1, 0], arrowright: [-1, 0], arrowup: [0, 1], arrowdown: [0, -1] };
window.addEventListener('keyup', (e) => panKeys.delete(e.key.toLowerCase()));
window.addEventListener('blur', () => panKeys.clear());
stage.onUpdate((dt) => {
  if (panKeys.size) {
    let dx = 0;
    let dy = 0;
    for (const k of panKeys) (dx += PAN[k][0]), (dy += PAN[k][1]);
    stage.rig.pan(dx * 420 * dt, dy * 420 * dt);
  }
  needle.style.transform = `rotate(${-stage.rig.heading}deg)`;
});

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
  delete panel.dataset.side;
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
      <header><div><small>${t('sb.wire')}</small><h3>${escapeHtml(w.from)} → ${escapeHtml(w.to)}</h3></div>
        <button class="icon-btn" data-act="close" aria-label="Tutup">${icon('close')}</button></header>
      <div class="insp-row"><label>${t('sb.color')}</label><div class="swatches">${Object.entries(WIRE_COLORS)
        .map(([name, hex]) => `<button class="swatch${name === w.color ? ' is-on' : ''}" data-color="${name}" title="${name}" style="--c:${hex}"></button>`)
        .join('')}</div></div>
      <p class="insp-desc">${t('sb.wireMoveHint')}</p>
      <div class="sb-panel-actions"><button class="sb-btn sb-danger" data-act="delete">${t('sb.deleteWire')}</button></div>`;
    panel.hidden = false;
    // panel tidak boleh menutupi pegangan ujung kabel: pindah ke kiri bila perlu
    const box = panel.getBoundingClientRect();
    const canvasBox = $('#canvas').getBoundingClientRect();
    const covered = [w.from, w.to].some((node) => {
      const q = stage.project(wb.pinWorld(node));
      const x = canvasBox.left + q.x;
      const y = canvasBox.top + q.y;
      return x > box.left - 12 && x < box.right + 12 && y > box.top - 12 && y < box.bottom + 12;
    });
    if (covered) panel.dataset.side = 'left';
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
    ${editing ? `<div class="sb-panel-actions"><button class="sb-btn" data-act="rotate">${icon('rotRight')} ${t('sb.rotate')}</button><button class="sb-btn sb-danger" data-act="delete">${t('sb.delete')}</button></div>` : ''}`;
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
$('#part-cats').innerHTML = [['all', t('sb.all')], ...Object.entries(CATEGORIES)]
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
  if (confirm(t('sb.newConfirm'))) openProject({ ...BLANK, name: t('sb.newProject') });
});
$('#btn-save').addEventListener('click', () => download(project));
$('#btn-open').addEventListener('click', async () => {
  const data = await pickFile();
  if (!data) return;
  if (data.error) return serial.err(data.error);
  openProject({ name: data.name ?? t('sb.project'), sketch: data.sketch ?? project.sketch, diagram: data.diagram });
});
$('#btn-share').addEventListener('click', async () => {
  const url = await shareUrl(project);
  try {
    await navigator.clipboard.writeText(url);
    flashSaved(t('sb.linkCopied'));
  } catch {
    prompt(t('sb.copyLink'), url);
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
  const key = e.key.toLowerCase();
  if (!e.ctrlKey && !e.metaKey && !e.altKey) {
    if (key in PAN) {
      e.preventDefault();
      panKeys.add(key);
      stage.touch?.();
      return;
    }
    if (key === 'q') return stage.rig.rotate(-1);
    if (key === 'e') return stage.rig.rotate(1);
    if (key === '+' || key === '=') return stage.rig.zoomBy(1.25);
    if (key === '-' || key === '_') return stage.rig.zoomBy(0.8);
  }
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
    if (saveLocal(project)) flashSaved(t('sb.saved'));
  }, 400);
  if (ownsCloud()) cloud.autosave?.schedule(project);
}

// ------------------------------------------------------------------ proyek di akun (bila masuk)
const cloud = { backend: null, user: null, autosave: null };
/** Proyek terbuka tersimpan di akun pengguna yang sedang masuk (bukan akun lain / salinan). */
const ownsCloud = () => !!(cloud.user && project.cloudId && project.cloudOwner === cloud.user.id);

function updateCloudBadge() {
  const badge = $('#cloud-badge');
  badge.hidden = !cloud.user;
  badge.textContent = ownsCloud() ? t('proj.badge.cloud') : t('proj.badge.local');
  badge.classList.toggle('is-cloud', ownsCloud());
}

function accountMenu() {
  if (!cloud.user) return [];
  return [
    { label: ownsCloud() ? t('proj.saveNow') : t('proj.save'), onClick: saveCloud },
    { label: t('proj.mine'), onClick: openProjects },
  ];
}

async function saveCloud() {
  try {
    const saved = await saveToAccount(cloud.backend, ownsCloud() ? project : { ...project, cloudId: undefined });
    project.cloudId = saved.cloudId;
    project.cloudOwner = cloud.user.id;
    saveLocal(project);
    updateCloudBadge();
    flashSaved(t('proj.savedCloud'));
  } catch (err) {
    toast(err.code === 'network' ? t('acct.offline') : err.message, 'error');
  }
}

async function openCloud(id, { copy = false } = {}) {
  try {
    const p = await openFromAccount(cloud.backend, id, { copy, copyName: (name) => t('proj.copyName', { name }) });
    openProject(copy ? p : { ...p, cloudOwner: cloud.user.id });
    if (copy) toast(t('proj.copyOpened'));
  } catch (err) {
    toast(err.code === 'network' ? t('acct.offline') : t('proj.notFound'), 'error');
  }
}

const projectsModal = $('#projects-modal');
$('#projects-close').innerHTML = icon('close');
$('#projects-close').addEventListener('click', () => (projectsModal.hidden = true));
projectsModal.addEventListener('click', (e) => {
  if (e.target === projectsModal) projectsModal.hidden = true;
});
projectsModal.addEventListener('keydown', (e) => {
  e.stopPropagation();
  if (e.key === 'Escape') projectsModal.hidden = true;
});

async function openProjects() {
  const list = $('#projects-list');
  projectsModal.hidden = false;
  let rows;
  try {
    rows = await cloud.backend.projects.list();
  } catch (err) {
    projectsModal.hidden = true;
    return toast(err.code === 'network' ? t('acct.offline') : err.message, 'error');
  }
  if (!rows.length) {
    list.innerHTML = `<li class="sb-projects-empty">${escapeHtml(t('proj.empty'))}</li>`;
    return;
  }
  const when = new Intl.DateTimeFormat(isEN ? 'en' : 'id', { dateStyle: 'medium', timeStyle: 'short' });
  list.replaceChildren(
    ...rows.map((r) => {
      const li = document.createElement('li');
      li.innerHTML = `<div><b></b><small></small></div>
        <button class="sb-btn" data-act="open">${t('proj.open')}</button>
        <button class="sb-btn" data-act="rename">${t('proj.rename')}</button>
        <button class="sb-btn sb-danger" data-act="delete">${t('proj.delete')}</button>`;
      li.querySelector('b').textContent = r.name;
      li.querySelector('small').textContent = t('proj.updated', { time: when.format(new Date(r.updatedAt)) });
      li.addEventListener('click', async (e) => {
        const act = e.target.closest('[data-act]')?.dataset.act;
        try {
          if (act === 'open') {
            projectsModal.hidden = true;
            await openCloud(r.id);
          } else if (act === 'rename') {
            const name = prompt(t('proj.renamePrompt'), r.name);
            if (!name || name === r.name) return;
            await cloud.backend.projects.rename(r.id, name);
            if (project.cloudId === r.id) {
              project.name = nameInput.value = name.trim();
              saveLocal(project);
            }
            openProjects();
          } else if (act === 'delete') {
            if (!confirm(t('proj.deleteConfirm', { name: r.name }))) return;
            await cloud.backend.projects.remove(r.id);
            if (project.cloudId === r.id) {
              delete project.cloudId;
              delete project.cloudOwner;
              saveLocal(project);
              updateCloudBadge();
            }
            openProjects();
          }
        } catch (err) {
          toast(err.code === 'network' ? t('acct.offline') : err.message, 'error');
        }
      });
      return li;
    })
  );
}

account.then(async (acc) => {
  if (!acc.backend) return;
  cloud.backend = acc.backend;
  cloud.user = acc.user();
  cloud.autosave = createAutosave(acc.backend, {
    onError: () => toast(t('proj.autosaveFail'), 'error'),
    onSaved: () => flashSaved(t('proj.savedCloud')),
  });
  acc.onChange((user) => {
    cloud.user = user;
    updateCloudBadge();
  });
  updateCloudBadge();
  // ?project=<id>[&copy=1]: buka proyek dari akun (halaman pengelola membuka salinan)
  const params = new URLSearchParams(location.search);
  const id = params.get('project');
  if (id) {
    params.delete('project');
    const copy = params.get('copy') === '1';
    params.delete('copy');
    history.replaceState(null, '', `${location.pathname}${params.size ? `?${params}` : ''}`);
    if (!cloud.user) toast(t('proj.needSignIn'), 'error');
    else await openCloud(id, { copy });
  }
});
window.addEventListener('pagehide', () => cloud.autosave?.flush());
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
  scheduleCheck();
  fit(true);
}

// ------------------------------------------------------------------ AI penyusun rangkaian
let aiUndo = null; // { sketch, diagram } sebelum perubahan AI diterapkan (hanya di sesi ini)
function clearAiUndo() {
  aiUndo = null;
  $('#ai-undo').hidden = true;
}
const isBlank = () => wb.parts.size <= 1 && project.sketch.trim() === BLANK.sketch.trim();
const aiPanel = createAiPanel({
  t,
  lang: isEN ? 'en' : 'id',
  toast,
  account,
  compile,
  /** Rangkaian logis + diagram + peta kaki→lubang dari sandbox (untuk mode "ubah"). */
  getCurrent() {
    const s = wb.snapshot();
    const props = Object.fromEntries([...wb.parts.values()].map((p) => [p.id, { ...p.props }]));
    return { ...logicalCircuit(s, props), sketch: project.sketch, diagram: wb.toDiagram(), inserted: [...s.topology.inserted] };
  },
  async onAcceptNew(res) {
    // proyek yang sedang dikerjakan tidak boleh hilang: simpan dulu ke akun bila hanya ada di browser
    if (cloud.user && !ownsCloud() && !isBlank()) {
      await saveCloud();
      toast(t('ai.savedCurrent'));
    }
    openProject({ name: res.result.title, sketch: res.sketch, diagram: res.diagram });
    if (cloud.user) {
      await saveCloud();
      toast(t('ai.created'));
    }
  },
  onAcceptModify(res) {
    const before = { sketch: project.sketch, diagram: wb.toDiagram() };
    project.sketch = res.sketch;
    editor.value = res.sketch;
    loadDiagram(res.diagram);
    refreshDiagramTab();
    persist();
    aiUndo = before;
    $('#ai-undo').hidden = false;
    toast(t('ai.applied'));
  },
});
$('#btn-ai').innerHTML = icon('sparkle');
$('#btn-ai').addEventListener('click', () => aiPanel.open());
$('#ai-undo').textContent = t('ai.undo');
$('#ai-undo').addEventListener('click', () => {
  if (!aiUndo) return;
  project.sketch = aiUndo.sketch;
  editor.value = aiUndo.sketch;
  loadDiagram(aiUndo.diagram);
  refreshDiagramTab();
  persist();
  clearAiUndo();
  toast(t('ai.undone'));
});

function openProject(p) {
  clearAiUndo();
  sim.stop();
  project = { name: p.name ?? t('sb.project'), sketch: p.sketch ?? '', diagram: p.diagram ?? { parts: [], wires: [] }, eeprom: p.eeprom ?? null };
  // proyek dari akun membawa id & pemiliknya; contoh, file, dan tautan selalu proyek baru di browser
  if (p.cloudId) Object.assign(project, { cloudId: p.cloudId, cloudOwner: p.cloudOwner });
  nameInput.value = project.name;
  document.title = `${project.name} · Learn Arduino`;
  editor.value = project.sketch;
  serial.clear();
  loadDiagram(project.diagram);
  refreshDiagramTab();
  persist();
  if (cloud.backend) updateCloudBadge();
  if (location.hash) history.replaceState(null, '', location.pathname + location.search);
}

openProject(project);
if (fromLink) serial.sys(t('sb.fromLink'));
showPanel(null);

// akses untuk pengujian otomatis (hanya saat pengembangan)
if (import.meta.env.DEV) window.__sb = { wb, sim, stage, editor, openProject, EXAMPLES, guide, cloud, aiPanel, get project() { return project; } };
