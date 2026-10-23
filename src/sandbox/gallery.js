import '@fontsource/barlow-semi-condensed/600.css';
import '@fontsource/barlow-semi-condensed/700.css';
import '@fontsource/barlow-semi-condensed/800.css';
import '@fontsource/barlow/400.css';
import '@fontsource/barlow/500.css';
import '@fontsource/ibm-plex-mono/600.css';
import '../styles/app.css';
import './gallery.css';

import * as THREE from 'three';
import { t, translateDom, languageSwitch } from '../i18n/index.js';
import { mountAccount } from '../account/ui.js';
import { createStage } from '../core/stage.js';
import { markPart } from '../parts/lib.js';
import { COMPONENTS, CATEGORIES, BEHAVIORS, instantiate, validateSpec } from '../components/index.js';
import { icon, LOGO } from '../ui/icons.js';
import { escapeHtml } from '../ui/highlight.js';
import { encodeProject } from './project.js';
import { BLANK } from './examples.js';

// Katalog komponen: semua komponen standar di satu meja 3D, dengan pencarian, kategori,
// detail pin & pengaturan, dan tombol untuk mencobanya di sandbox.
// ?dev menampilkan info pengembang (validateSpec, tipe, perilaku).

const $ = (s) => document.querySelector(s);
const DEV = new URLSearchParams(location.search).has('dev');
const ROW_WIDTH = 460;
const GAP = 40;

document.querySelectorAll('[data-logo]').forEach((el) => (el.innerHTML = LOGO));
translateDom();
document.title = `${t('top.catalog')} · Learn Arduino`;
document.querySelectorAll('.cat-actions [data-icon]').forEach((a) => a.insertAdjacentHTML('afterbegin', icon(a.dataset.icon)));
$('.cat-lang').append(languageSwitch());
mountAccount($('.account-slot'));

await Promise.all(['700 20px "Barlow Semi Condensed"', '800 20px "Barlow Semi Condensed"', '600 20px "IBM Plex Mono"'].map((f) => document.fonts.load(f)));

// ------------------------------------------------------------------ panggung 3D
const tip = $('#tip');
let selected = -1;
const stage = createStage($('#canvas'), {
  onHover(part, x, y) {
    if (!part) {
      tip.hidden = true;
      return;
    }
    const box = $('#stage').getBoundingClientRect();
    tip.querySelector('b').textContent = part.userData.part.name;
    tip.querySelector('span').textContent = part.userData.part.desc ?? '';
    tip.hidden = false;
    tip.style.transform = `translate(${x - box.left + 16}px, ${y - box.top + 18}px)`;
  },
  onPartClick(part) {
    let o = part;
    while (o && o.userData.catIndex === undefined) o = o.parent;
    if (o) select(o.userData.catIndex, { fromStage: true });
  },
  onEmptyClick: () => select(-1),
});

const root = new THREE.Group();
const markerGeo = new THREE.SphereGeometry(1, 14, 10);
// penanda pin selalu tampil di atas model (tidak tertutup badan komponen)
const markerMat = new THREE.MeshBasicMaterial({ color: '#1f9e94', depthTest: false, transparent: true, opacity: 0.9 });
const dotMat = new THREE.MeshBasicMaterial({ color: '#1f9e94', depthTest: false, transparent: true, opacity: 0.7 });

/** Penanda pin: bola kecil yang bisa di-hover. */
function pinMarker(spec, pin) {
  const m = new THREE.Mesh(markerGeo, markerMat);
  m.position.copy(pin.at);
  m.renderOrder = 10;
  return markPart(m, { key: `${spec.type}.${pin.id}`, name: `${spec.name} · ${pin.id}`, desc: pin.name, lift: false });
}

const placed = [];
for (const spec of COMPONENTS) {
  const errors = DEV ? validateSpec(spec) : [];
  let group = null;
  try {
    group = instantiate(spec);
  } catch (err) {
    errors.push(err.message);
  }
  let markers = null;
  if (group) {
    // kaki komponen breadboard menembus 1,5 mm di bawah titik asal: angkat agar menapak lantai
    if (spec.surface === 'breadboard') group.position.y = 1.5;
    const pins = group.userData.component.pins;
    if (pins.length > 40) {
      // banyak pin (breadboard, papan): titik instanced, tanpa hover per pin
      markers = new THREE.InstancedMesh(new THREE.SphereGeometry(0.45, 8, 6), dotMat, pins.length);
      const mtx = new THREE.Matrix4();
      pins.forEach((p, i) => markers.setMatrixAt(i, mtx.makeTranslation(p.at.x, p.at.y + 0.3, p.at.z)));
      markers.renderOrder = 10;
    } else {
      markers = new THREE.Group();
      for (const p of pins) markers.add(pinMarker(spec, p));
    }
    markers.visible = DEV; // pin hanya tampil untuk komponen yang dipilih (atau semua di mode dev)
    group.add(markers);
    group.userData.catIndex = placed.length;
    // ukuran & titik sudut kotak (tanpa penanda pin) untuk menyusun meja
    markers.visible = false;
    group.userData.box = new THREE.Box3().setFromObject(group);
    markers.visible = DEV;
  }
  placed.push({ spec, group, markers, errors });
}
stage.setContent(root);

/** Susun komponen yang lolos filter berbaris rapat di meja (yang lain diangkat dari scene). */
function layout() {
  let x = 0;
  let z = 0;
  let rowDepth = 0;
  for (const p of placed) {
    const g = p.group;
    if (!g) continue;
    if (!p.shown) {
      g.removeFromParent();
      continue;
    }
    const box = g.userData.box;
    const size = box.getSize(new THREE.Vector3());
    if (x > 0 && x + size.x > ROW_WIDTH) {
      x = 0;
      z += rowDepth + GAP;
      rowDepth = 0;
    }
    g.position.x = x - box.min.x;
    g.position.z = z - box.min.z;
    x += size.x + GAP;
    rowDepth = Math.max(rowDepth, size.z);
    if (!g.parent) root.add(g);
  }
  root.updateMatrixWorld(true);
}

/** Bingkai kamera ke komponen yang terlihat. */
function frameVisible(instant = false) {
  const box = new THREE.Box3();
  for (const p of placed) if (p.shown && p.group) box.expandByObject(p.group);
  if (!box.isEmpty()) stage.rig.frame(box, { left: 30, right: 30, top: 30, bottom: 30 }, { instant });
}

// ------------------------------------------------------------------ daftar & filter
let activeCat = 'all';
const cats = [['all', t('sb.all')], ...Object.entries(CATEGORIES).filter(([k]) => COMPONENTS.some((c) => c.category === k))];
$('#tabs').innerHTML = cats
  .map(([k, v]) => `<button role="tab" data-cat="${k}" aria-selected="${k === activeCat}">${escapeHtml(v)}<span>${k === 'all' ? COMPONENTS.length : COMPONENTS.filter((c) => c.category === k).length}</span></button>`)
  .join('');

$('#list').innerHTML = placed
  .map(({ spec, group, errors }, i) => {
    const pins = group?.userData.component.pins.length ?? 0;
    const dev = DEV
      ? `<small class="cat-dev">${errors.length ? '✗' : '✓'} <code>${spec.type}</code> · ${spec.surface} · ${spec.behavior?.kind} — ${BEHAVIORS[spec.behavior?.kind]?.desc ?? ''}</small>
         ${errors.length ? `<ul class="cat-errors">${errors.map((e) => `<li>${escapeHtml(e)}</li>`).join('')}</ul>` : ''}`
      : '';
    return `<button class="cat-card" data-i="${i}">
      <span class="feat-icon">${icon(spec.icon)}</span>
      <span><b>${escapeHtml(spec.name)}</b><small>${escapeHtml(spec.desc)}</small>
      <em>${escapeHtml(CATEGORIES[spec.category] ?? spec.category)} · ${t('cat.pins', { n: pins })}</em>${dev}</span>
    </button>`;
  })
  .join('');

function filter() {
  const q = $('#search').value.trim().toLowerCase();
  let shown = 0;
  placed.forEach((p, i) => {
    const text = `${p.spec.name} ${p.spec.desc} ${p.spec.type}`.toLowerCase();
    const ok = (activeCat === 'all' || p.spec.category === activeCat) && (!q || text.includes(q));
    $('#list').children[i].hidden = !ok;
    p.shown = ok;
    if (ok) shown++;
  });
  $('#count').textContent = t('cat.count', { n: shown });
  if (selected >= 0 && !placed[selected].shown) select(-1);
  layout();
  frameVisible();
}
$('#tabs').addEventListener('click', (e) => {
  const b = e.target.closest('[data-cat]');
  if (!b) return;
  activeCat = b.dataset.cat;
  $('#tabs').querySelectorAll('[data-cat]').forEach((x) => x.setAttribute('aria-selected', String(x === b)));
  filter();
});
$('#search').addEventListener('input', filter);
$('#search').addEventListener('keydown', (e) => e.stopPropagation());
$('#list').addEventListener('click', (e) => {
  const b = e.target.closest('[data-i]');
  if (b) select(Number(b.dataset.i));
});

// ------------------------------------------------------------------ detail
const detail = $('#detail');
function select(i, { fromStage = false } = {}) {
  if (selected >= 0 && placed[selected].markers && !DEV) placed[selected].markers.visible = false;
  $('#list').querySelector('.is-on')?.classList.remove('is-on');
  selected = i;
  if (i < 0) {
    detail.hidden = true;
    stage.select(null);
    return;
  }
  const { spec, group, markers } = placed[i];
  if (markers) markers.visible = true;
  const card = $('#list').children[i];
  card.classList.add('is-on');
  if (fromStage) card.scrollIntoView({ block: 'nearest' });
  if (group) {
    stage.focus(group);
    stage.select(group);
  }
  const pins = group?.userData.component.pins ?? [];
  const props = spec.props ?? [];
  detail.innerHTML = `
    <header>
      <span class="feat-icon">${icon(spec.icon)}</span>
      <div><small>${escapeHtml(CATEGORIES[spec.category] ?? spec.category)}</small><h2>${escapeHtml(spec.name)}</h2></div>
      <button class="icon-btn" data-act="close" aria-label="${t('ui.close')}">${icon('close')}</button>
    </header>
    <p>${escapeHtml(spec.desc)}</p>
    <button class="top-btn top-primary cat-try" data-act="try">${icon('breadboard')}<span>${t('cat.try')}</span></button>
    ${
      pins.length > 40
        ? `<p class="cat-note">${t('cat.manyPins', { n: pins.length })}</p>`
        : pins.length
          ? `<h3>${t('cat.pinsTitle')}</h3><table class="cat-pins">${pins.map((p) => `<tr><td><code>${escapeHtml(p.id)}</code></td><td>${escapeHtml(p.name)}</td></tr>`).join('')}</table>`
          : ''
    }
    ${
      props.length
        ? `<h3>${t('cat.propsTitle')}</h3><ul class="cat-props">${props
            .map((p) => `<li><b>${escapeHtml(p.label)}</b><span>${escapeHtml(describeProp(p))}</span></li>`)
            .join('')}</ul>`
        : ''
    }`;
  detail.hidden = false;
  detail.scrollTop = 0;
}

/** Ringkasan pilihan sebuah prop: rentang, atau daftar opsi. */
function describeProp(p) {
  if (p.type === 'range') return `${p.min} – ${p.max}${p.unit ? ' ' + p.unit : ''}`;
  if (p.options) return p.options.map((o) => o.label).join(' · ');
  return '';
}

detail.addEventListener('click', async (e) => {
  const act = e.target.closest('[data-act]')?.dataset.act;
  if (act === 'close') select(-1);
  if (act === 'try') location.href = `sandbox.html#${await encodeProject(projectFor(placed[selected].spec))}`;
});

/** Proyek sandbox berisi Arduino Uno + komponen ini (komponen breadboard ditancapkan). */
function projectFor(spec) {
  const uno = { id: 'uno', type: 'arduino-uno', x: -82, z: 22 };
  const parts = spec.type === 'arduino-uno' ? [{ ...uno, x: -34, z: 27 }] : [uno];
  if (spec.category === 'breadboard') parts.push({ id: 'bb', type: spec.type, x: 60, z: 0 });
  else if (spec.surface === 'breadboard') {
    parts.push({ id: 'bb', type: 'breadboard', x: 44, z: 0 });
    parts.push({ id: 'p1', type: spec.type, board: 'bb', hole: holeFor(spec) });
  } else if (spec.type !== 'arduino-uno') parts.push({ id: 'p1', type: spec.type, x: 60, z: 10 });
  return { name: spec.name, sketch: BLANK.sketch, diagram: { parts, wires: [] } };
}

/** Lubang untuk pin pertama: baris mengikuti posisi z kaki pertama (mengangkangi parit atau tidak). */
function holeFor(spec) {
  const g = placed.find((p) => p.spec === spec)?.group;
  const z0 = g?.userData.component.pins[0]?.at.z ?? 0;
  if (Math.abs(z0) < 0.5) return 'c10';
  const k = Math.max(0, Math.min(4, Math.round((Math.abs(z0) - 3.81) / 2.54)));
  return (z0 > 0 ? 'edcba' : 'fghij')[k] + '10';
}

filter();
frameVisible(true);

// untuk pengujian otomatis
window.__gallery = { placed: placed.map((p) => ({ type: p.spec.type, errors: DEV ? p.errors : validateSpec(p.spec), pins: p.group?.userData.component.pins.length ?? 0 })) };
