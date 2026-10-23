import * as THREE from 'three';
import { noOutline } from '../parts/lib.js';
import { recommend } from '../sim/wiring/recommend.js';

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

/**
 * Panduan kabel: saat menarik kabel, tujuan yang cocok disorot hijau dan pin Uno lain diredupkan.
 * Rekomendasi dihitung sekali saat kabel mulai ditarik.
 */
export function createGuide({ wb, root, t }) {
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

  return {
    startWiring,
    stopWiring,
    setEnabled(on) {
      enabled = on;
      try {
        localStorage.setItem(STORE, on ? '1' : '0');
      } catch {
        /* penyimpanan browser tidak tersedia: pilihan berlaku untuk sesi ini saja */
      }
      if (!on) stopWiring();
    },
    get enabled() {
      return enabled;
    },
    get labelText() {
      return labelText;
    },
  };
}
