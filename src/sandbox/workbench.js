import { t } from '../i18n/index.js';
import * as THREE from 'three';
import { COMPONENT_BY_TYPE, instantiate, resolvePins } from '../components/index.js';
import { createWire } from '../parts/wire.js';
import { markPart, noOutline } from '../parts/lib.js';
import { insertedLegs } from '../sim/netlist.js';
import { snapshotFromTopology } from '../sim/wiring/snapshot.js';
import { sanitizeDiagram } from './sanitize.js';

const PIN_LAYER = 2; // titik pin: tidak dirender, hanya untuk dipilih pointer
const SNAP_RANGE = 5; // mm: jarak maksimum untuk menancap ke breadboard
const GRID = 1.27;
const PALETTE = ['orange', 'yellow', 'green', 'blue', 'purple', 'white', 'brown'];
const WIRE_GLOW = { warn: '#f0a020', danger: '#d9473c' };

const pinHitGeo = new THREE.SphereGeometry(1.35, 10, 8);
const holeHitGeo = new THREE.BoxGeometry(2.2, 1.6, 2.2);
const hitMat = new THREE.MeshBasicMaterial();

/**
 * Meja kerja sandbox: komponen, kabel, seleksi, dan mode edit/jalan.
 *
 * hooks:
 *   onChange()                — diagram berubah (simpan otomatis)
 *   onSelect(sel)             — { kind: 'part' | 'wire', id } atau null
 *   onPartClick(part, x, y)   — klik komponen saat simulasi berjalan
 *   onHover(info, x, y)       — { name, desc } atau null (tooltip)
 *   onWiring(on, fromNode, opts) — mulai/selesai menarik kabel dari sebuah pin
 *                               (opts.rewire: sedang menyeret ujung kabel yang sudah ada)
 */
export function createWorkbench(stage, hooks = {}) {
  const root = new THREE.Group();
  stage.setContent(root);
  stage.setPickLayers(0, PIN_LAYER);

  const parts = new Map();
  const wires = new Map();
  let mode = 'edit';
  let selection = null;
  let wiring = null;
  let wireSeq = 0;
  let colorSeq = 0;

  // --- penanda pin yang disorot + garis karet saat menarik kabel ---
  const marker = new THREE.Mesh(
    new THREE.SphereGeometry(1.2, 16, 12),
    new THREE.MeshBasicMaterial({ color: '#1f9e94', depthTest: false, transparent: true, opacity: 0.95 })
  );
  marker.renderOrder = 20;
  marker.visible = false;
  noOutline(marker);
  root.add(marker);
  const startMarker = marker.clone();
  startMarker.material = marker.material.clone();
  startMarker.material.color.set('#e8603c');
  noOutline(startMarker);
  root.add(startMarker);
  const rubber = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]),
    new THREE.LineDashedMaterial({ color: '#e8603c', dashSize: 2, gapSize: 1.5, depthTest: false })
  );
  rubber.renderOrder = 19;
  rubber.visible = false;
  noOutline(rubber);
  root.add(rubber);

  const changed = () => hooks.onChange?.();

  // --- pegangan di kedua ujung kabel terpilih: seret ke pin lain untuk memindahkan ujungnya
  const handleGeo = new THREE.SphereGeometry(1.7, 16, 12);
  const handleMat = new THREE.MeshBasicMaterial({ color: '#e8603c', depthTest: false, transparent: true, opacity: 0.95 });
  let rewire = null; // { wire, end, fixed, pins: [{ node, pos }], target }
  const handles = ['from', 'to'].map((end) => {
    const h = new THREE.Mesh(handleGeo, handleMat);
    h.renderOrder = 21;
    h.userData.pickFirst = true;
    h.layers.set(1); // dirender tanpa garis tepi …
    h.layers.enable(PIN_LAYER); // … dan bisa dipilih pointer
    h.userData.part = { name: t('sb.wireEnd'), desc: t('sb.wireEndDesc'), lift: false };
    h.userData.move = {
      start: () => startRewire(end),
      drag: (p) => dragRewire(p),
      planeY: 0,
      end: (moved) => endRewire(moved),
    };
    // dibungkus grup biasa: stage mengatur ulang tinggi objek komponen tingkat atas setiap frame
    const holder = new THREE.Group();
    holder.add(h);
    return holder;
  });

  function updateHandles() {
    const w = selection?.kind === 'wire' && mode === 'edit' ? wires.get(selection.id) : null;
    handles.forEach((h, i) => {
      const p = w && pinWorld(i === 0 ? w.from : w.to);
      if (p) {
        h.position.copy(p);
        if (!h.parent) root.add(h);
      } else if (h.parent && !rewire) h.removeFromParent();
    });
  }

  function startRewire(end) {
    const wire = wires.get(selection?.id);
    if (!wire) return;
    const fixed = end === 'from' ? wire.to : wire.from;
    const pins = [];
    for (const part of parts.values()) {
      part.group.updateMatrixWorld(true);
      for (const pin of part.pins) pins.push({ node: `${part.id}:${pin.id}`, pos: part.group.localToWorld(pin.at.clone()) });
    }
    rewire = { wire, end, fixed, pins, target: null };
    // seret di bidang setinggi pin ujung ini (permukaan breadboard ± 8,5 mm), bukan di lantai
    handles[end === 'from' ? 0 : 1].children[0].userData.move.planeY = pinWorld(wire[end]).y;
    if (wire.group) wire.group.visible = false;
    const a = pinWorld(fixed);
    startMarker.position.copy(a);
    startMarker.visible = true;
    rubber.visible = true;
    hooks.onWiring?.(true, fixed, { rewire: true });
  }

  function dragRewire(p) {
    if (!rewire) return;
    let best = null;
    let bestD = 3; // mm: jarak tangkap ke pin/lubang terdekat
    for (const { node, pos } of rewire.pins) {
      if (node === rewire.fixed) continue;
      const d = Math.hypot(pos.x - p.x, pos.z - p.z);
      if (d < bestD) (best = { node, pos }), (bestD = d);
    }
    rewire.target = best?.node ?? null;
    const to = best ? best.pos : p;
    handles[rewire.end === 'from' ? 0 : 1].position.copy(to);
    marker.visible = !!best;
    if (best) marker.position.copy(best.pos);
    rubber.geometry.setFromPoints([pinWorld(rewire.fixed), to]);
    rubber.computeLineDistances();
  }

  function endRewire(moved) {
    if (!rewire) return;
    const { wire, end, target } = rewire;
    rewire = null;
    startMarker.visible = false;
    rubber.visible = false;
    marker.visible = false;
    if (wire.group) wire.group.visible = true;
    hooks.onWiring?.(false, null, { rewire: true });
    if (moved && target && target !== wire[end]) moveWireEnd(wire.id, end, target);
    updateHandles();
  }

  // ------------------------------------------------------------ util
  function nextId(type) {
    const base = type === 'arduino-uno' ? 'uno' : type.startsWith('breadboard') ? 'bb' : type.split('-')[0];
    for (let i = base === 'uno' || base === 'bb' ? 0 : 1; ; i++) {
      const id = i === 0 ? base : `${base}${i}`;
      if (!parts.has(id)) return id;
    }
  }

  function pinWorld(node) {
    const [id, pin] = splitNode(node);
    const part = parts.get(id);
    const p = part?.pins.find((q) => q.id === pin);
    if (!p) return null;
    part.group.updateMatrixWorld(true);
    return part.group.localToWorld(p.at.clone());
  }

  function pinInfo(node) {
    const [id, pin] = splitNode(node);
    const part = parts.get(id);
    const p = part?.pins.find((q) => q.id === pin);
    return p ? { name: `${id}:${pin}`, desc: `${part.spec.name} · ${p.name}` } : null;
  }

  // ------------------------------------------------------------ komponen
  function addPinHits(part) {
    for (const old of part.hits ?? []) old.removeFromParent();
    part.hits = part.pins.map((pin) => {
      const hit = new THREE.Mesh(part.spec.behavior.kind === 'breadboard' ? holeHitGeo : pinHitGeo, hitMat);
      hit.position.copy(pin.at);
      hit.layers.set(PIN_LAYER);
      hit.userData.node = `${part.id}:${pin.id}`;
      markPart(hit, { key: 'pin', name: `${part.id}:${pin.id}`, desc: `${part.spec.name} · ${pin.name}`, lift: false });
      part.group.add(hit);
      return hit;
    });
  }

  function makeGroup(part) {
    const group = instantiate(part.spec, part.props);
    group.userData.partId = part.id;
    group.traverse((o) => {
      if (o.isMesh && o.layers.mask === 1) o.castShadow = o.receiveShadow = true;
    });
    return group;
  }

  /**
   * Tambah komponen. opts: { id, x, z, rot, props, hole: 'c12' (tancapkan pin pertama ke lubang bb) }
   */
  function addPart(type, opts = {}) {
    const spec = COMPONENT_BY_TYPE[type];
    if (!spec) throw new Error(`Komponen "${type}" tidak dikenal`);
    const id = opts.id ?? nextId(type);
    const part = { id, spec, props: { ...defaultsOf(spec), ...(opts.props ?? {}) }, rot: opts.rot ?? 0 };
    part.group = makeGroup(part);
    part.pins = part.group.userData.component.pins;
    parts.set(id, part);
    root.add(part.group);
    addPinHits(part);
    applyTransform(part, opts.x ?? 0, opts.z ?? 0);
    if (opts.hole) anchorToHole(part, opts.hole, opts.board ?? 'bb');
    else if (opts.x === undefined) placeFree(part);
    else settle(part);
    setMode(mode); // pasang/lepas penangan seret sesuai mode
    return part;
  }

  function defaultsOf(spec) {
    return Object.fromEntries((spec.props ?? []).map((p) => [p.key, p.value]));
  }

  function applyTransform(part, x, z, y = part.group.position.y) {
    part.group.position.set(x, y, z);
    part.group.rotation.y = (part.rot * Math.PI) / 180;
    part.group.userData.baseY = y;
    part.group.updateMatrixWorld(true);
  }

  /** Tancapkan pin pertama ke lubang breadboard tertentu. */
  function anchorToHole(part, hole, boardId) {
    const target = pinWorld(`${boardId}:${hole}`);
    if (!target) return settle(part);
    const local = part.pins[0].at.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), (part.rot * Math.PI) / 180);
    applyTransform(part, target.x - local.x, target.z - local.z, target.y);
  }

  /** Lubang breadboard (posisi dunia) untuk snapping. */
  function holes() {
    const list = [];
    for (const p of parts.values()) {
      if (p.spec.behavior.kind !== 'breadboard') continue;
      p.group.updateMatrixWorld(true);
      for (const pin of p.pins) list.push(p.group.localToWorld(pin.at.clone()));
    }
    return list;
  }

  /**
   * Komponen breadboard: menancap bila semua kaki jatuh tepat di lubang; selain itu
   * berdiri di lantai. Komponen lantai: dibulatkan ke kisi 1,27 mm.
   */
  function settle(part, cache) {
    const g = part.group;
    if (part.spec.surface !== 'breadboard') {
      applyTransform(part, Math.round(g.position.x / GRID) * GRID, Math.round(g.position.z / GRID) * GRID, 0);
      return false;
    }
    const list = cache ?? holes();
    const axis = new THREE.Vector3(0, 1, 0);
    const local = part.pins.map((p) => p.at.clone().applyAxisAngle(axis, (part.rot * Math.PI) / 180));
    const p0 = new THREE.Vector3(g.position.x + local[0].x, 0, g.position.z + local[0].z);
    let best = null;
    let bestD = SNAP_RANGE;
    for (const h of list) {
      const d = Math.hypot(h.x - p0.x, h.z - p0.z);
      if (d < bestD) {
        best = h;
        bestD = d;
      }
    }
    if (best) {
      const ox = best.x - p0.x;
      const oz = best.z - p0.z;
      const fits = local.every((l) => list.some((h) => Math.hypot(h.x - (g.position.x + ox + l.x), h.z - (g.position.z + oz + l.z)) < 0.3));
      if (fits) {
        applyTransform(part, g.position.x + ox, g.position.z + oz, best.y);
        return true;
      }
    }
    applyTransform(part, g.position.x, g.position.z, 1.5); // kaki menapak lantai
    return false;
  }

  /** Komponen yang semua kakinya tertancap di lubang breadboard `board` (ikut saat papan dipindah/diputar). */
  function riders(board) {
    if (board.spec.behavior.kind !== 'breadboard') return [];
    board.group.updateMatrixWorld(true);
    const list = board.pins.map((pin) => board.group.localToWorld(pin.at.clone()));
    const out = [];
    for (const p of parts.values()) {
      if (p === board || p.spec.surface !== 'breadboard' || !p.pins.length) continue;
      p.group.updateMatrixWorld(true);
      const inserted = p.pins.every((pin) => {
        const w = p.group.localToWorld(pin.at.clone());
        return list.some((h) => Math.hypot(h.x - w.x, h.z - w.z) < 0.3 && Math.abs(h.y - w.y) < 0.5);
      });
      if (inserted) out.push(p);
    }
    return out;
  }

  /** Taruh komponen baru di tengah pandangan, bergeser sampai tidak menimpa yang lain. */
  function placeFree(part) {
    const center = stage.rig.state.target.clone();
    const own = new THREE.Box3().setFromObject(part.group);
    const size = own.getSize(new THREE.Vector3());
    const others = [...parts.values()].filter((p) => p !== part).map((p) => new THREE.Box3().setFromObject(p.group));
    for (let ring = 0; ring < 12; ring++) {
      const steps = Math.max(1, ring * 6);
      for (let s = 0; s < steps; s++) {
        const a = (s / steps) * Math.PI * 2;
        const x = center.x + Math.cos(a) * ring * 18;
        const z = center.z + Math.sin(a) * ring * 18;
        const box = new THREE.Box3(
          new THREE.Vector3(x - size.x / 2 - 3, -1, z - size.z / 2 - 3),
          new THREE.Vector3(x + size.x / 2 + 3, 50, z + size.z / 2 + 3)
        );
        if (!others.some((o) => o.intersectsBox(box))) {
          const offX = (own.min.x + own.max.x) / 2 - part.group.position.x;
          const offZ = (own.min.z + own.max.z) / 2 - part.group.position.z;
          applyTransform(part, x - offX, z - offZ);
          settle(part);
          return;
        }
      }
    }
    settle(part);
  }

  function removePart(id) {
    const part = parts.get(id);
    if (!part) return;
    for (const w of [...wires.values()]) if (splitNode(w.from)[0] === id || splitNode(w.to)[0] === id) removeWire(w.id, false);
    part.group.removeFromParent();
    parts.delete(id);
    if (selection?.id === id) select(null);
    changed();
  }

  function rotatePart(id) {
    const part = parts.get(id);
    if (!part) return;
    const carried = riders(part);
    const c = part.group.position.clone();
    part.rot = (part.rot + 90) % 360;
    applyTransform(part, part.group.position.x, part.group.position.z);
    settle(part);
    refreshWires(id);
    // putar 90° (searah rotasi papan) di sekitar posisi papan
    for (const r of carried) {
      const dx = r.group.position.x - c.x;
      const dz = r.group.position.z - c.z;
      r.rot = (r.rot + 90) % 360;
      applyTransform(r, part.group.position.x + dz, part.group.position.z - dx);
      refreshWires(r.id);
    }
    changed();
  }

  /** Ubah satu props; bila props itu mengubah bentuk (rebuild), model dibuat ulang. */
  function setProp(id, key, value) {
    const part = parts.get(id);
    if (!part) return;
    part.props[key] = value;
    const def = part.spec.props?.find((p) => p.key === key);
    if (def?.rebuild) {
      const { position, rotation } = part.group;
      const pos = position.clone();
      const rot = rotation.y;
      part.group.removeFromParent();
      part.group = makeGroup(part);
      part.pins = part.group.userData.component.pins;
      part.group.position.copy(pos);
      part.group.rotation.y = rot;
      part.group.userData.baseY = pos.y;
      root.add(part.group);
      addPinHits(part);
      settle(part);
      setMode(mode);
      refreshWires(id);
      if (selection?.id === id) stage.select(part.group);
    } else {
      part.spec.apply?.(part.group, part.props);
      part.group.userData.component.pins = resolvePins(part.spec, part.props, part.group);
    }
    part.onPropsChange?.();
    changed();
  }

  // ------------------------------------------------------------ seret (mode edit)
  function enableMove(part) {
    const g = part.group;
    let offset = null;
    let cache = null;
    let carried = []; // [{ part, dx, dz }] komponen yang tertancap di breadboard ini
    const handler = {
      start(point) {
        offset = new THREE.Vector3(g.position.x - point.x, 0, g.position.z - point.z);
        cache = holes();
        carried = riders(part).map((r) => ({ part: r, dx: r.group.position.x - g.position.x, dz: r.group.position.z - g.position.z }));
        select({ kind: 'part', id: part.id });
      },
      drag(p) {
        applyTransform(part, p.x + offset.x, p.z + offset.z);
        if (carried.length) {
          // breadboard berdiri di lantai: tidak perlu settle, cukup bawa penumpangnya
          for (const r of carried) {
            applyTransform(r.part, g.position.x + r.dx, g.position.z + r.dz);
            scheduleRefresh(r.part.id);
          }
        } else settle(part, cache);
        scheduleRefresh(part.id);
      },
      end(moved) {
        if (moved) {
          if (carried.length) {
            settle(part);
            for (const r of carried) {
              applyTransform(r.part, g.position.x + r.dx, g.position.z + r.dz);
              refreshWires(r.part.id);
            }
          }
          refreshWires(part.id);
          changed();
        }
        carried = [];
      },
    };
    // sub-bagian yang bisa diklik (chip, port, … di papan Uno) ikut memindahkan komponen
    g.traverse((o) => {
      if (o === g || (o.userData.part && !o.userData.node)) o.userData.move = handler;
    });
  }

  function disableMove(part) {
    part.group.traverse((o) => delete o.userData.move);
  }

  let pendingRefresh = new Set();
  let refreshQueued = false;
  function scheduleRefresh(id) {
    pendingRefresh.add(id);
    if (refreshQueued) return;
    refreshQueued = true;
    requestAnimationFrame(() => {
      refreshQueued = false;
      for (const pid of pendingRefresh) refreshWires(pid);
      pendingRefresh = new Set();
    });
  }

  // ------------------------------------------------------------ kabel
  function autoColor(from, to) {
    const pins = [from, to].map((n) => splitNode(n)[1]);
    if (pins.some((p) => /^(GND|-|K|tn|bn)/.test(p) || /^(tn|bn)\d/.test(p))) return 'black';
    if (pins.some((p) => /^(5V|3V3|VIN|VCC|V\+|\+|tp\d|bp\d)/.test(p))) return 'red';
    return PALETTE[colorSeq++ % PALETTE.length];
  }

  function addWire(from, to, color, id) {
    if (from === to) return null;
    for (const w of wires.values()) if ((w.from === from && w.to === to) || (w.from === to && w.to === from)) return w;
    const wire = { id: id ?? `w${++wireSeq}`, from, to, color: color ?? autoColor(from, to), group: null };
    if (id) wireSeq = Math.max(wireSeq, Number(String(id).replace(/\D/g, '')) || 0);
    wires.set(wire.id, wire);
    buildWire(wire);
    changed();
    return wire;
  }

  function buildWire(wire) {
    wire.group?.removeFromParent();
    const a = pinWorld(wire.from);
    const b = pinWorld(wire.to);
    if (!a || !b) return;
    // kabel di antara lubang breadboard dibuat pendek dan rendah
    const span = a.distanceTo(b);
    const g = createWire(a, b, wire.color, { lift: span < 30 ? -4 : 0 });
    g.userData.wireId = wire.id;
    markPart(g, { key: 'wire', name: t('sb.wireName', { from: wire.from, to: wire.to }), desc: t('sb.wireDesc'), lift: false });
    g.traverse((o) => {
      if (o.isMesh) o.castShadow = true;
    });
    root.add(g);
    wire.group = g;
    paint(wire);
    if (selection?.id === wire.id) updateHandles();
  }

  function refreshWires(partId) {
    for (const w of wires.values()) {
      if (splitNode(w.from)[0] === partId || splitNode(w.to)[0] === partId) buildWire(w);
    }
  }

  function removeWire(id, notify = true) {
    const w = wires.get(id);
    if (!w) return;
    w.group?.removeFromParent();
    wires.delete(id);
    if (selection?.kind === 'wire' && selection.id === id) select(null);
    if (notify) changed();
  }

  function setWireColor(id, color) {
    const w = wires.get(id);
    if (!w) return;
    w.color = color;
    buildWire(w);
    changed();
  }

  /** Cahaya kabel: teal bila terpilih, jingga/merah bila panduan kabel menemukan masalah. */
  function paint(wire) {
    const selected = selection?.kind === 'wire' && selection.id === wire.id;
    const glow = selected ? '#1f9e94' : WIRE_GLOW[wire.state];
    wire.group?.traverse((o) => {
      if (!o.isMesh) return;
      o.userData.baseMat ??= o.material;
      if (!glow) {
        o.material = o.userData.baseMat;
        return;
      }
      o.material = o.userData.baseMat.clone();
      o.material.emissive = new THREE.Color(glow);
      o.material.emissiveIntensity = selected ? 0.55 : 0.8;
    });
  }

  /** Tandai kabel: 'ok' | 'warn' | 'danger'. */
  function setWireState(id, state) {
    const w = wires.get(id);
    if (!w || (w.state ?? 'ok') === state) return;
    w.state = state;
    paint(w);
  }

  /** Pindahkan salah satu ujung kabel ('from' | 'to') ke titik lain. */
  function moveWireEnd(id, end, toNode) {
    const w = wires.get(id);
    if (!w || !pinWorld(toNode)) return null;
    w[end] = toNode;
    buildWire(w);
    changed();
    return w;
  }

  // ------------------------------------------------------------ menarik kabel
  function startWiring(node) {
    wiring = { from: node };
    const p = pinWorld(node);
    startMarker.position.copy(p);
    startMarker.visible = true;
    rubber.visible = true;
    updateRubber(p);
    hooks.onWiring?.(true, node);
  }

  function cancelWiring() {
    wiring = null;
    startMarker.visible = false;
    rubber.visible = false;
    hooks.onWiring?.(false);
  }

  function updateRubber(to) {
    if (!wiring) return;
    const a = pinWorld(wiring.from);
    rubber.geometry.setFromPoints([a, to]);
    rubber.computeLineDistances();
  }

  /** Snapshot topologi untuk panduan kabel (lihat sim/wiring/snapshot.js). */
  function snapshot() {
    const list = [...parts.values()];
    return snapshotFromTopology({
      parts: list.map((p) => ({ id: p.id, type: p.spec.type, pinIds: p.pins.map((q) => q.id) })),
      wires: [...wires.values()].map((w) => ({ id: w.id, from: w.from, to: w.to })),
      inserted: insertedLegs(list),
    });
  }

  // ------------------------------------------------------------ seleksi
  function select(sel) {
    const prev = selection?.kind === 'wire' ? wires.get(selection.id) : null;
    selection = sel;
    if (prev) paint(prev);
    if (sel?.kind === 'part') stage.select(parts.get(sel.id)?.group ?? null);
    else stage.select(null);
    if (sel?.kind === 'wire') {
      const w = wires.get(sel.id);
      if (w) paint(w);
    }
    updateHandles();
    hooks.onSelect?.(sel);
  }

  // ------------------------------------------------------------ peristiwa dari stage
  function hover(obj, x, y) {
    const node = obj?.userData.node;
    if (node && mode === 'edit') {
      marker.position.copy(pinWorld(node));
      marker.visible = true;
      hooks.onHover?.(pinInfo(node), x, y);
      return;
    }
    marker.visible = false;
    hooks.onHover?.(obj?.userData.part ?? null, x, y);
  }

  function click(obj, x, y) {
    const node = obj.userData.node;
    if (mode === 'edit' && node) {
      if (!wiring) startWiring(node);
      else if (wiring.from === node) cancelWiring();
      else {
        const w = addWire(wiring.from, node);
        cancelWiring();
        if (w) select({ kind: 'wire', id: w.id });
      }
      return;
    }
    if (wiring) {
      cancelWiring();
      return;
    }
    if (obj.userData.wireId) {
      if (mode === 'edit') select({ kind: 'wire', id: obj.userData.wireId });
      return;
    }
    const id = findPartId(obj);
    if (!id) return;
    if (mode === 'edit') select({ kind: 'part', id });
    else hooks.onPartClick?.(parts.get(id), x, y);
  }

  function findPartId(obj) {
    while (obj && obj.userData.partId === undefined) obj = obj.parent;
    return obj?.userData.partId ?? null;
  }

  function pointerMove(clientX, clientY) {
    if (!wiring) return;
    const target = marker.visible ? marker.position.clone() : stage.groundPoint(clientX, clientY, 0);
    if (target) updateRubber(target);
  }

  // ------------------------------------------------------------ mode
  function setMode(next) {
    mode = next;
    for (const part of parts.values()) {
      if (mode === 'edit') enableMove(part);
      else disableMove(part);
    }
    stage.setPickLayers(...(mode === 'edit' ? [0, PIN_LAYER] : [0]));
    if (mode === 'run') {
      cancelWiring();
      select(null);
      marker.visible = false;
    }
  }

  // ------------------------------------------------------------ diagram
  function toDiagram() {
    const round = (v) => Math.round(v * 100) / 100;
    return {
      version: 1,
      parts: [...parts.values()].map((p) => ({
        id: p.id,
        type: p.spec.type,
        x: round(p.group.position.x),
        z: round(p.group.position.z),
        rot: p.rot,
        props: { ...p.props },
      })),
      wires: [...wires.values()].map((w) => ({ from: w.from, to: w.to, color: w.color })),
    };
  }

  function clear() {
    cancelWiring();
    select(null);
    for (const w of wires.values()) w.group?.removeFromParent();
    for (const p of parts.values()) p.group.removeFromParent();
    wires.clear();
    parts.clear();
    wireSeq = 0;
    colorSeq = 0;
  }

  function loadDiagram(input) {
    // semua sumber (tautan bagikan, file, akun, AI, editor diagram) bisa berisi data orang lain
    const d = sanitizeDiagram(input);
    clear();
    const problems = [];
    for (const p of d.parts ?? []) {
      try {
        addPart(p.type, p);
      } catch (err) {
        problems.push(err.message);
      }
    }
    for (const w of d.wires ?? []) {
      if (pinWorld(w.from) && pinWorld(w.to)) addWire(w.from, w.to, w.color);
      else problems.push(t('sb.wireMissing', { from: w.from, to: w.to }));
    }
    changed();
    return problems;
  }

  /** Kotak pembatas semua komponen (untuk membingkai kamera). */
  function bounds() {
    const box = new THREE.Box3();
    for (const p of parts.values()) {
      p.group.traverse((o) => {
        if (o.isMesh && o.layers.mask === 1 && o.visible) box.expandByObject(o);
      });
    }
    return box;
  }

  return {
    root,
    parts,
    wires,
    get mode() {
      return mode;
    },
    get selection() {
      return selection;
    },
    get wiring() {
      return !!wiring;
    },
    addPart,
    removePart,
    rotatePart,
    setProp,
    addWire,
    removeWire,
    setWireColor,
    setWireState,
    moveWireEnd,
    select,
    cancelWiring,
    hover,
    click,
    pointerMove,
    setMode,
    toDiagram,
    loadDiagram,
    clear,
    bounds,
    pinWorld,
    snapshot,
    /** Bagian sederhana untuk Circuit: [{ id, spec, props, group }] */
    circuitParts: () => [...parts.values()],
    circuitWires: () => [...wires.values()].map((w) => ({ from: w.from, to: w.to })),
  };
}

export function splitNode(node) {
  const i = node.indexOf(':');
  return [node.slice(0, i), node.slice(i + 1)];
}
