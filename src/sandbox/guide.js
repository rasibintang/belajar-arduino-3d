import * as THREE from 'three';
import { noOutline } from '../parts/lib.js';
import { recommend } from '../sim/wiring/recommend.js';
import { pinOf } from '../sim/wiring/snapshot.js';
import { issueWires } from '../sim/wiring/check.js';

const STORE = 'la-wire-guide';
const targetGeo = new THREE.SphereGeometry(1.5, 14, 10);
const dimGeo = new THREE.SphereGeometry(0.9, 10, 8);
const targetMat = new THREE.MeshBasicMaterial({ color: '#2fd27a', depthTest: false, transparent: true, opacity: 0.95 });
const dimMat = new THREE.MeshBasicMaterial({ color: '#8a8478', depthTest: false, transparent: true, opacity: 0.35 });

function readEnabled() {
  try {
    return localStorage.getItem(STORE) !== '0';
  } catch {
    return true;
  }
}

/** Kalimat sebuah masalah, mis. "o:SDA sebaiknya ke A4, bukan A2 — …". */
export function issueText(issue, t) {
  return t(`guide.issue.${issue.code}`, {
    pin: issue.nodes[0],
    target: pinOf(issue.nodes[1]),
    suggest: issue.suggest ? pinOf(issue.suggest) : '?',
    from: issue.fix?.add ? pinOf(issue.fix.add[0]) : '',
  });
}

/**
 * Panduan kabel: saat menarik kabel, tujuan yang cocok disorot hijau dan pin Uno lain diredupkan
 * (rekomendasi dihitung sekali saat kabel mulai ditarik). Setelah kabel terpasang, kabel yang belum
 * tepat menyala jingga/merah dengan tanda ! (elemen DOM di `layer`) yang membuka saran.
 */
export function createGuide({ wb, stage, root, layer, t }) {
  let enabled = readEnabled();
  let meshes = [];
  let labelText = '';

  function dots(nodes, geo, mat, order) {
    if (!nodes.length) return;
    const mesh = new THREE.InstancedMesh(geo, mat, nodes.length);
    const m = new THREE.Matrix4();
    nodes.forEach((n, i) => mesh.setMatrixAt(i, m.makeTranslation(wb.pinWorld(n))));
    mesh.renderOrder = order;
    mesh.raycast = () => {}; // bukan target klik: pin di bawahnya tetap bisa dipilih
    noOutline(mesh);
    root.add(mesh);
    meshes.push(mesh);
  }

  function stopWiring() {
    for (const mesh of meshes) {
      root.remove(mesh);
      mesh.dispose();
    }
    meshes = [];
    labelText = '';
  }

  function startWiring(fromNode) {
    stopWiring();
    if (!enabled) return;
    const s = wb.snapshot();
    const { fn, targets } = recommend(s, fromNode);
    const key = `guide.hint.${fn}`;
    labelText = t(key) === key ? '' : t(key);
    if (!targets.length) return;
    const chosen = new Set(targets);
    const unoPins = [...wb.parts.values()]
      .filter((p) => p.spec.behavior.kind === 'mcu')
      .flatMap((p) => p.pins.map((q) => `${p.id}:${q.id}`))
      .filter((n) => !chosen.has(n) && n !== fromNode);
    dots(unoPins, dimGeo, dimMat, 17);
    dots(targets, targetGeo, targetMat, 18);
  }

  // ---------------------------------------------------------- masalah kabel: tanda ! + saran
  let shown = []; // { issue, wireId, el, at: Vector3 }
  let lastIssues = [];
  let lastSnapshot = null;
  let frameId = 0;
  const popup = document.createElement('div');
  popup.className = 'sb-issue-pop';
  popup.hidden = true;
  layer.append(popup);

  function clearIssues() {
    cancelAnimationFrame(frameId);
    for (const x of shown) x.el.remove();
    shown = [];
    popup.hidden = true;
    for (const id of wb.wires.keys()) wb.setWireState(id, 'ok');
  }

  function place() {
    for (const x of shown) {
      const p = stage.project(x.at);
      x.el.style.transform = `translate(${p.x - 11}px, ${p.y - 11}px)`;
      if (popup.dataset.wire === x.wireId && !popup.hidden) {
        // di kanan tanda, atau di kirinya bila tidak muat; tetap di dalam meja
        const w = popup.offsetWidth;
        const left = p.x + 16 + w > layer.clientWidth ? p.x - 16 - w : p.x + 16;
        const top = Math.min(Math.max(p.y - 12, 8), layer.clientHeight - popup.offsetHeight - 8);
        popup.style.transform = `translate(${Math.max(8, left)}px, ${top}px)`;
      }
    }
    frameId = requestAnimationFrame(place);
  }

  function openPopup(x) {
    if (!popup.hidden && popup.dataset.wire === x.wireId) {
      popup.hidden = true;
      return;
    }
    const { issue } = x;
    popup.dataset.wire = x.wireId;
    popup.dataset.severity = issue.severity;
    popup.innerHTML = '';
    const text = document.createElement('p');
    text.textContent = issueText(issue, t);
    popup.append(text);
    if (issue.fix && wb.mode === 'edit') { // saat simulasi berjalan rangkaian tidak bisa diubah
      const { add } = issue.fix;
      const btn = document.createElement('button');
      btn.className = 'sb-btn';
      btn.textContent = add ? t('guide.add', { from: pinOf(add[0]), suggest: pinOf(add[1]) }) : t('guide.fix', { suggest: pinOf(issue.fix.to) });
      btn.addEventListener('click', () => {
        popup.hidden = true;
        if (add) wb.addWire(add[0], add[1], 'black');
        else wb.moveWireEnd(issue.fix.wireId, issue.fix.end, issue.fix.to);
      });
      popup.append(btn);
    }
    popup.hidden = false;
  }

  /** Tampilkan masalah dari checkCircuit(s): kabel jingga/merah dan tanda ! yang bisa diklik. */
  function showIssues(issues, s) {
    lastIssues = issues;
    lastSnapshot = s;
    const openWire = popup.hidden ? null : popup.dataset.wire;
    clearIssues();
    if (!enabled) return;
    const state = new Map();
    for (const issue of issues) {
      const ids = issueWires(issue, s);
      for (const id of ids) if (state.get(id) !== 'danger') state.set(id, issue.severity);
      // tanda ! di tengah kabel bermasalah; bila masalahnya kabel yang kurang, di pin komponennya
      const wire = wb.wires.get(issue.fix?.wireId ?? ids[0]);
      const wireId = wire ? wire.id : `@${issue.nodes[0]}`;
      if (shown.some((x) => x.wireId === wireId)) continue;
      let at;
      if (wire?.group) {
        const box = new THREE.Box3().setFromObject(wire.group);
        at = box.getCenter(new THREE.Vector3()).setY(box.max.y);
      } else {
        at = wb.pinWorld(issue.nodes[0]);
        if (!at) continue;
        at.y += 6;
      }
      const el = document.createElement('button');
      el.className = 'sb-issue-mark';
      el.dataset.severity = issue.severity;
      el.textContent = '!';
      el.setAttribute('aria-label', issueText(issue, t));
      const x = { issue, wireId, el, at };
      el.addEventListener('click', () => openPopup(x));
      layer.append(el);
      shown.push(x);
    }
    for (const [id, st] of state) wb.setWireState(id, st);
    const reopen = shown.find((x) => x.wireId === openWire);
    if (reopen) openPopup(reopen);
    if (shown.length) place();
  }

  return {
    startWiring,
    stopWiring,
    showIssues,
    /** Kabel utama sebuah masalah (untuk disorot dari daftar); null bila masalahnya kabel yang kurang. */
    wireOf: (issue) => (lastSnapshot ? issueWires(issue, lastSnapshot)[0] ?? null : null),
    setEnabled(on) {
      enabled = on;
      try {
        localStorage.setItem(STORE, on ? '1' : '0');
      } catch {
        /* penyimpanan browser tidak tersedia: pilihan berlaku untuk sesi ini saja */
      }
      if (!on) stopWiring();
      if (lastSnapshot) showIssues(lastIssues, lastSnapshot);
    },
    get enabled() {
      return enabled;
    },
    get labelText() {
      return labelText;
    },
  };
}
