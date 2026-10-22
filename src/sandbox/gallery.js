import '@fontsource/barlow-semi-condensed/600.css';
import '@fontsource/barlow-semi-condensed/700.css';
import '@fontsource/barlow-semi-condensed/800.css';
import '@fontsource/barlow/400.css';
import '@fontsource/ibm-plex-mono/600.css';
import '../styles/app.css';

import * as THREE from 'three';
import { createStage } from '../core/stage.js';
import { markPart } from '../parts/lib.js';
import { COMPONENTS, CATEGORIES, BEHAVIORS, instantiate, validateSpec } from '../components/index.js';

// Galeri pengembang: menampilkan setiap komponen standar + penanda pinnya,
// dan menjalankan validateSpec() untuk semuanya.

const $ = (s) => document.querySelector(s);
const ROW_WIDTH = 460;
const GAP = 40;

await Promise.all(['700 20px "Barlow Semi Condensed"', '800 20px "Barlow Semi Condensed"', '600 20px "IBM Plex Mono"'].map((f) => document.fonts.load(f)));

const tip = $('#tip');
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
});

const root = new THREE.Group();
const markerGeo = new THREE.SphereGeometry(1, 14, 10);
// penanda pin selalu tampil di atas model (tidak tertutup badan komponen)
const markerMat = new THREE.MeshBasicMaterial({ color: '#1f9e94', depthTest: false, transparent: true, opacity: 0.9 });
const dotMat = new THREE.MeshBasicMaterial({ color: '#1f9e94', depthTest: false, transparent: true, opacity: 0.7 });

/** Penanda pin: bola kecil yang bisa di-hover (untuk komponen dengan sedikit pin). */
function pinMarker(spec, pin) {
  const m = new THREE.Mesh(markerGeo, markerMat);
  m.position.copy(pin.at);
  m.renderOrder = 10;
  return markPart(m, { key: `${spec.type}.${pin.id}`, name: `${spec.name} · ${pin.id}`, desc: pin.name, lift: false });
}

let x = 0;
let z = 0;
let rowDepth = 0;
const placed = [];
for (const spec of COMPONENTS) {
  const errors = validateSpec(spec);
  let group = null;
  try {
    group = instantiate(spec);
  } catch {
    /* sudah dilaporkan validateSpec */
  }
  if (group) {
    // kaki komponen breadboard menembus 1,5 mm di bawah titik asal: angkat agar menapak lantai
    if (spec.surface === 'breadboard') group.position.y = 1.5;
    const pins = group.userData.component.pins;
    if (pins.length > 40) {
      // banyak pin (breadboard, papan): titik instanced, tanpa hover per pin
      const dots = new THREE.InstancedMesh(new THREE.SphereGeometry(0.45, 8, 6), dotMat, pins.length);
      const mtx = new THREE.Matrix4();
      pins.forEach((p, i) => dots.setMatrixAt(i, mtx.makeTranslation(p.at.x, p.at.y + 0.3, p.at.z)));
      dots.renderOrder = 10;
      group.add(dots);
    } else {
      for (const p of pins) group.add(pinMarker(spec, p));
    }

    const box = new THREE.Box3().setFromObject(group);
    const size = box.getSize(new THREE.Vector3());
    if (x > 0 && x + size.x > ROW_WIDTH) {
      x = 0;
      z += rowDepth + GAP;
      rowDepth = 0;
    }
    group.position.x = x - box.min.x;
    group.position.z = z - box.min.z;
    x += size.x + GAP;
    rowDepth = Math.max(rowDepth, size.z);
    root.add(group);
  }
  placed.push({ spec, group, errors });
}
stage.setContent(root);

const all = new THREE.Box3().setFromObject(root);
stage.rig.frame(all, { left: 30, right: 30, top: 30, bottom: 30 }, { instant: true });

// --- panel ---
const bad = placed.filter((p) => p.errors.length);
const summary = $('#summary');
summary.className = `gallery-summary ${bad.length ? 'bad' : 'ok'}`;
summary.textContent = bad.length
  ? `${bad.length} dari ${placed.length} komponen bermasalah`
  : `Semua ${placed.length} komponen valid ✓`;

$('#list').innerHTML = placed
  .map(({ spec, group, errors }, i) => {
    const pins = group?.userData.component.pins.length ?? 0;
    return `<button class="comp" data-i="${i}">
      <span class="status ${errors.length ? 'bad' : 'ok'}">${errors.length ? '✗' : '✓'}</span>
      <b>${spec.name}</b><code>${spec.type}</code>
      <small>${CATEGORIES[spec.category] ?? spec.category} · ${spec.surface} · ${pins} pin · perilaku <i>${spec.behavior?.kind}</i>
        — ${BEHAVIORS[spec.behavior?.kind]?.desc ?? ''}</small>
      ${errors.length ? `<ul>${errors.map((e) => `<li>${e}</li>`).join('')}</ul>` : ''}
    </button>`;
  })
  .join('');
$('#list').addEventListener('click', (e) => {
  const b = e.target.closest('[data-i]');
  const g = b && placed[Number(b.dataset.i)].group;
  if (g) {
    stage.focus(g);
    stage.select(g);
  }
});

// untuk pengujian otomatis
window.__gallery = { placed: placed.map((p) => ({ type: p.spec.type, errors: p.errors, pins: p.group?.userData.component.pins.length ?? 0 })) };
