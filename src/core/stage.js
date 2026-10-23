import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { ToonPipeline } from './toon.js';
import { CameraRig } from './rig.js';
import { Tweens, Ease } from './tween.js';
import { noOutline } from '../parts/lib.js';

const CLICK_SLOP = 5; // px: gerakan lebih kecil dari ini dianggap klik
const HOVER_LIFT = 1.8; // mm: komponen terangkat sedikit saat disorot
// Pegas teredam untuk efek angkat: sedikit melewati target lalu memantul
const SPRING_K = 320;
const SPRING_DAMP = 19;
const SELECT_HOP = 95; // mm/detik: "lompatan" kecil saat komponen dipilih
const PERSISTENT = new Set(['board', 'breadboard']); // dipakai ulang antar pelajaran (bergeser, tidak jatuh)

/** Cari group komponen (userData.part) dari mesh yang terkena. */
export function findPart(obj) {
  while (obj && !obj.userData.part) obj = obj.parent;
  return obj ?? null;
}

/** Kotak pembatas dari mesh yang terlihat (tanpa cahaya/efek di layer 1). */
function meshBox(obj) {
  const box = new THREE.Box3();
  obj.updateMatrixWorld(true);
  obj.traverse((o) => {
    if (o.isMesh && o.layers.mask === 1 && o.visible) box.expandByObject(o);
  });
  return box;
}

/**
 * Panggung 3D: renderer, kamera isometrik, cahaya, bayangan, animasi, dan interaksi.
 *
 * Interaksi komponen (diisi di userData group komponen):
 *   press(bool)                          -> tahan untuk menekan (tombol)
 *   drag = { axis, get, set, min, max }  -> seret sepanjang sumbu di lantai
 *   knob = { get, set, min, max, speed } -> seret kiri/kanan untuk memutar
 * Klik biasa diteruskan ke handlers.onPartClick (membuka inspektor).
 */
export function createStage(canvas, handlers = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true, powerPreference: 'high-performance' });
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.autoClear = false;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.45;
  pmrem.dispose();

  scene.add(new THREE.HemisphereLight('#fffaf3', '#c2ae90', 1.15));
  const sun = new THREE.DirectionalLight('#fff6ea', 1.75);
  const SUN_OFFSET = new THREE.Vector3(-110, 200, 125);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.radius = 4;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.3;
  Object.assign(sun.shadow.camera, { left: -200, right: 200, top: 200, bottom: -200, near: 10, far: 800 });
  scene.add(sun, sun.target);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), new THREE.ShadowMaterial({ color: '#6b4f28', opacity: 0.17 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  noOutline(ground);
  scene.add(ground);

  const world = new THREE.Group();
  scene.add(world);

  const rig = new CameraRig();
  const toon = new ToonPipeline(renderer, { lineColor: '#141a2c' });
  const tweens = new Tweens();
  const camera = rig.camera;

  // ---------- Cincin seleksi ----------
  const ringMat = new THREE.MeshBasicMaterial({ color: '#1f9e94', transparent: true, opacity: 0.55, depthWrite: false });
  const ring = new THREE.Group();
  const outer = new THREE.Mesh(new THREE.RingGeometry(0.93, 1, 64), ringMat);
  const inner = new THREE.Mesh(new THREE.CircleGeometry(0.93, 64), new THREE.MeshBasicMaterial({ color: '#1f9e94', transparent: true, opacity: 0.1, depthWrite: false }));
  for (const m of [outer, inner]) {
    m.rotation.x = -Math.PI / 2;
    ring.add(m);
  }
  ring.visible = false;
  ring.renderOrder = -1;
  noOutline(ring);
  scene.add(ring);
  let selected = null;

  let width = 1;
  let height = 1;
  let pixelRatio = 1.5;
  function resize() {
    const rect = canvas.getBoundingClientRect();
    width = Math.max(1, rect.width);
    height = Math.max(1, rect.height);
    // selalu render minimal 1,5× agar tepi halus di layar biasa (supersampling)
    pixelRatio = Math.min(2, Math.max(1.5, window.devicePixelRatio || 1));
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(width, height, false);
    toon.setSize(width, height, pixelRatio);
    rig.setSize(width, height);
    handlers.onResize?.(width, height);
  }
  new ResizeObserver(resize).observe(canvas);
  resize();

  // ---------- Isi scene & transisi ----------
  let root = null;

  /** Komponen tingkat atas dari isi scene (yang punya userData.part). */
  function partsOf(group) {
    return group ? group.children.filter((c) => c.userData.part) : [];
  }

  function applyY(obj) {
    const u = obj.userData;
    obj.position.y = (u.baseY ?? 0) + (u.dropY ?? 0) + (u.hoverY ?? 0);
  }

  function prepare(group) {
    group.traverse((o) => {
      if (o.isMesh && o.layers.mask === 1) o.castShadow = o.receiveShadow = true;
    });
    for (const c of partsOf(group)) {
      c.userData.baseY = c.position.y;
      c.userData.dropY = 0;
      c.userData.hoverY = 0;
    }
  }

  function enterPart(obj, delay) {
    const u = obj.userData;
    if (u.wire) {
      const { tube, ends, count, step } = u.wire;
      tube.geometry.setDrawRange(0, 0);
      ends.forEach((e) => e.scale.setScalar(0.001));
      tweens.add({ tag: 'content', delay, duration: 260, easing: Ease.outBack, onUpdate: (k) => ends[0].scale.setScalar(Math.max(0.001, k)) });
      tweens.add({
        tag: 'content',
        delay: delay + 120,
        duration: 620,
        onUpdate: (k) => tube.geometry.setDrawRange(0, Math.ceil((k * count) / step) * step),
      });
      tweens.add({ tag: 'content', delay: delay + 700, duration: 260, easing: Ease.outBack, onUpdate: (k) => ends[1].scale.setScalar(Math.max(0.001, k)) });
      return;
    }
    const drop = u.part?.key === 'breadboard' ? 24 : 46;
    u.dropY = drop;
    obj.scale.setScalar(0.001);
    if (u.part) applyY(obj);
    tweens.add({
      tag: 'content',
      delay,
      duration: 720,
      easing: Ease.linear,
      onUpdate: (_, t) => {
        u.dropY = drop * (1 - Ease.outCubic(t));
        obj.scale.setScalar(Math.max(0.001, Ease.outBack(Math.min(1, t * 1.15))));
        if (u.part) applyY(obj);
      },
    });
  }

  function exitPart(obj, done) {
    const u = obj.userData;
    if (u.wire) {
      const { tube, ends, count, step } = u.wire;
      tweens.add({
        tag: 'content',
        duration: 380,
        easing: Ease.inCubic,
        onUpdate: (k) => {
          tube.geometry.setDrawRange(0, Math.floor(((1 - k) * count) / step) * step);
          ends.forEach((e) => e.scale.setScalar(Math.max(0.001, 1 - k)));
        },
        onComplete: done,
      });
      return;
    }
    const s0 = obj.scale.x;
    tweens.add({
      tag: 'content',
      delay: 60,
      duration: 420,
      easing: Ease.linear,
      onUpdate: (_, t) => {
        obj.scale.setScalar(Math.max(0.001, s0 * (1 - Ease.inBack(t))));
        u.dropY = 30 * t * t;
        if (u.part) applyY(obj);
      },
      onComplete: done,
    });
  }

  /**
   * Ganti isi scene. Dengan animate: komponen lama menghilang, papan & breadboard
   * bergeser ke posisi baru, komponen baru jatuh satu per satu, kabel tergambar.
   * Mengembalikan lama animasi (ms).
   */
  function setContent(group, { animate = false } = {}) {
    tweens.finish('content'); // tuntaskan transisi sebelumnya
    select(null);
    hovered = null;
    springy.clear();
    prepare(group);
    const old = root;
    root = group;
    world.add(group);

    if (!animate || !old) {
      if (old) world.remove(old);
      return 0;
    }

    // papan & breadboard yang ada di kedua pelajaran: mulai dari posisi lama
    const oldByKey = new Map(partsOf(old).filter((c) => PERSISTENT.has(c.userData.part.key)).map((c) => [c.userData.part.key, c]));
    let parts = 0;
    let wires = 0;
    let longest = 0;
    for (const obj of [...group.children]) {
      const key = obj.userData.part?.key;
      const prev = oldByKey.get(key);
      if (prev) {
        const from = prev.position.clone();
        const to = obj.position.clone();
        prev.removeFromParent();
        oldByKey.delete(key);
        if (from.distanceTo(to) > 0.01) {
          obj.position.copy(from);
          tweens.add({ tag: 'content', duration: 900, onUpdate: (k) => obj.position.lerpVectors(from, to, k) });
        }
        continue;
      }
      if (!obj.userData.part && !obj.userData.wire) continue; // cahaya/efek ikut muncul begitu saja
      const delay = obj.userData.wire ? 650 + wires++ * 140 : 220 + parts++ * 130;
      longest = Math.max(longest, delay + (obj.userData.wire ? 960 : 720));
      enterPart(obj, delay);
    }

    let pending = old.children.length;
    const finish = () => {
      if (--pending <= 0) world.remove(old);
    };
    if (!pending) world.remove(old);
    for (const obj of [...old.children]) {
      if (obj.userData.part || obj.userData.wire) exitPart(obj, finish);
      else {
        obj.visible = false;
        finish();
      }
    }
    return longest;
  }

  // ---------- Seleksi & fokus ----------
  /** Komponen yang sedang/baru saja memantul (termasuk bagian papan). */
  const springy = new Set();
  const canLift = (part) => part && part.userData.part?.lift !== false;

  function select(part) {
    selected = part;
    ring.visible = !!part;
    if (part) placeRing(0);
    if (canLift(part)) {
      part.userData.hoverV = (part.userData.hoverV ?? 0) + SELECT_HOP;
      springy.add(part);
    }
  }

  function placeRing(time) {
    if (!selected) return;
    const box = meshBox(selected);
    if (box.isEmpty()) return;
    const c = box.getCenter(new THREE.Vector3());
    const s = box.getSize(new THREE.Vector3());
    const r = Math.max(8, Math.hypot(s.x, s.z) / 2 + 3) * (1 + 0.03 * Math.sin(time * 0.004));
    // komponen lepas: lantai/breadboard di bawahnya; bagian papan: permukaan PCB
    const baseY = selected.userData.baseY ?? box.min.y;
    ring.position.set(c.x, baseY + 0.35, c.z);
    ring.scale.setScalar(r);
  }

  function focus(part) {
    const box = meshBox(part);
    if (box.isEmpty()) return;
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3()).length();
    const factor = Math.min(1.9, Math.max(1.3, 120 / size));
    rig.focusPoint(center, Math.max(rig.zoom, rig.home.zoom) * factor, 1000);
  }

  // ---------- Picking ----------
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  function setRay(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
  }
  function hitAt(clientX, clientY) {
    if (!root) return null;
    setRay(clientX, clientY);
    // kabel dan benda non-komponen tidak menghalangi komponen di belakangnya;
    // objek bertanda pickFirst (mis. pegangan ujung kabel, selalu tergambar di atas) didahulukan
    let first = null;
    for (const hit of raycaster.intersectObject(root, true)) {
      const part = findPart(hit.object);
      if (!part) continue;
      if (part.userData.pickFirst) return { part, point: hit.point };
      first ??= { part, point: hit.point };
    }
    return first;
  }
  function groundPoint(clientX, clientY, y) {
    setRay(clientX, clientY);
    return raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -y), new THREE.Vector3());
  }

  // ---------- Pointer ----------
  let gesture = null;
  let hovered = null;
  let lastInput = performance.now();
  const touch = () => (lastInput = performance.now());

  canvas.addEventListener('pointerdown', (e) => {
    touch();
    if (e.button !== 0 && e.button !== 2) return;
    canvas.setPointerCapture(e.pointerId);
    const hit = e.button === 0 ? hitAt(e.clientX, e.clientY) : null;
    const part = hit?.part;
    const ud = part?.userData ?? {};
    const base = { x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, moved: false, part, point: hit?.point };

    if (ud.move) {
      // sandbox: seret komponen di lantai
      ud.move.start(hit.point);
      gesture = { ...base, type: 'move' };
    } else if (ud.stick) {
      ud.stick.press?.(true);
      gesture = { ...base, type: 'stick' };
    } else if (ud.press) {
      ud.press(true, hit.point);
      gesture = { ...base, type: 'press' };
    } else if (ud.drag) {
      const y = ud.baseY ?? 0;
      gesture = { ...base, type: 'drag', y, p0: groundPoint(e.clientX, e.clientY, y), v0: ud.drag.get() };
    } else if (ud.knob) {
      gesture = { ...base, type: 'knob', v0: ud.knob.get() };
    } else {
      gesture = { ...base, type: 'pan' };
    }
    handlers.onGestureStart?.();
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!gesture) {
      const hit = hitAt(e.clientX, e.clientY);
      const part = hit?.part ?? null;
      hovered = part;
      if (canLift(part)) springy.add(part);
      const ud = part?.userData ?? {};
      canvas.style.cursor = !part ? 'grab' : ud.cursor ?? (ud.drag || ud.stick || ud.move ? 'move' : ud.knob ? 'ew-resize' : 'pointer');
      handlers.onHover?.(part, e.clientX, e.clientY, hit?.point);
      return;
    }
    touch();
    const dx = e.clientX - gesture.x;
    const dy = e.clientY - gesture.y;
    gesture.x = e.clientX;
    gesture.y = e.clientY;
    if (Math.hypot(e.clientX - gesture.x0, e.clientY - gesture.y0) > CLICK_SLOP) gesture.moved = true;

    const ud = gesture.part?.userData;
    if (gesture.type === 'pan' && gesture.moved) {
      rig.pan(dx, dy, true);
      canvas.style.cursor = 'grabbing';
    } else if (gesture.type === 'drag' && gesture.moved) {
      const p = groundPoint(e.clientX, e.clientY, gesture.y);
      if (p && gesture.p0) {
        const d = p.sub(gesture.p0).dot(ud.drag.axis);
        ud.drag.set(THREE.MathUtils.clamp(gesture.v0 + d, ud.drag.min, ud.drag.max));
      }
    } else if (gesture.type === 'knob' && gesture.moved) {
      const total = e.clientX - gesture.x0 - (e.clientY - gesture.y0);
      ud.knob.set(THREE.MathUtils.clamp(gesture.v0 + total * (ud.knob.speed ?? 1), ud.knob.min, ud.knob.max));
    } else if (gesture.type === 'move' && gesture.moved) {
      const p = groundPoint(e.clientX, e.clientY, ud.move.planeY ?? 0); // planeY: tinggi bidang seret (mm)
      if (p) ud.move.drag(p);
    } else if (gesture.type === 'stick' && gesture.moved) {
      // joystick: geser = miring; tombol tekan dilepas begitu mulai menggeser
      if (!gesture.dragging) {
        gesture.dragging = true;
        ud.stick.press?.(false);
      }
      ud.stick.move(e.clientX - gesture.x0, e.clientY - gesture.y0);
    }
    handlers.onHover?.(null);
  });

  function endGesture(e) {
    if (!gesture) return;
    const g = gesture;
    gesture = null;
    if (g.type === 'press') g.part.userData.press(false);
    if (g.type === 'move') g.part.userData.move?.end(g.moved);
    if (g.type === 'stick') {
      g.part.userData.stick.press?.(false);
      g.part.userData.stick.release();
    }
    if (!g.moved && g.part && g.type !== 'press' && g.type !== 'stick' && e.type === 'pointerup') {
      handlers.onPartClick?.(g.part, e.clientX, e.clientY, g.point);
    }
    if (!g.moved && !g.part && e.type === 'pointerup') handlers.onEmptyClick?.();
    canvas.style.cursor = 'grab';
  }
  canvas.addEventListener('pointerup', endGesture);
  canvas.addEventListener('pointercancel', endGesture);
  canvas.addEventListener('pointerleave', () => {
    if (!gesture) {
      hovered = null;
      handlers.onHover?.(null);
    }
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      touch();
      rig.zoomBy(Math.exp(-e.deltaY * 0.0015));
    },
    { passive: false }
  );
  // klik ganda: fokus ke komponen, atau kembali ke pandangan awal
  canvas.addEventListener('dblclick', (e) => {
    touch();
    const hit = hitAt(e.clientX, e.clientY);
    if (hit && hit.part.userData.part.lift !== false) focus(hit.part);
    else rig.reset();
  });

  // ---------- Loop ----------
  const updaters = new Set();
  const timer = new THREE.Timer();
  const tmp = new THREE.Vector3();
  const stage = { autoRotate: false };

  function frame(time) {
    timer.update(time);
    const dt = Math.min(timer.getDelta(), 0.1);
    tweens.update();
    const moving = rig.update(dt);
    if (stage.autoRotate && !gesture && !moving && performance.now() - lastInput > 4500) rig.spin(dt * 0.12);

    // komponen yang disorot terangkat dan memantul (pegas teredam, dihitung bertahap agar stabil)
    for (const c of partsOf(root)) applyY(c);
    const steps = Math.ceil(dt / 0.012);
    for (const c of springy) {
      const u = c.userData;
      u.baseY ??= c.position.y;
      u.hoverY ??= 0;
      u.hoverV ??= 0;
      const target = c === hovered && !gesture ? HOVER_LIFT : 0;
      for (let i = 0; i < steps; i++) {
        const h = dt / steps;
        u.hoverV += ((target - u.hoverY) * SPRING_K - u.hoverV * SPRING_DAMP) * h;
        u.hoverY += u.hoverV * h;
      }
      applyY(c);
      // sudah diam di bawah dan tidak disorot: berhenti dihitung
      if (target === 0 && Math.abs(u.hoverY) < 0.01 && Math.abs(u.hoverV) < 0.05) {
        u.hoverY = 0;
        u.hoverV = 0;
        applyY(c);
        springy.delete(c);
      }
    }
    placeRing(time);

    // bayangan mengikuti pusat pandangan
    sun.target.position.copy(rig.state.target);
    sun.position.copy(rig.state.target).add(SUN_OFFSET);
    updaters.forEach((fn) => fn(dt));
    toon.render(scene, camera, 1 / rig.zoom / pixelRatio);
  }
  renderer.setAnimationLoop(frame);

  return Object.assign(stage, {
    renderer,
    scene,
    world,
    rig,
    camera,
    toon,
    tweens,
    get size() {
      return { width, height };
    },
    get pixelRatio() {
      return pixelRatio;
    },
    onUpdate(fn) {
      updaters.add(fn);
      return () => updaters.delete(fn);
    },
    setContent,
    select,
    focus,
    touch,
    /** Layer yang ikut dipilih pointer (mis. titik pin tak terlihat di layer 2). */
    setPickLayers(...layers) {
      raycaster.layers.disableAll();
      for (const l of layers) raycaster.layers.enable(l);
    },
    /** Titik di bidang datar y untuk koordinat layar. */
    groundPoint,
    /** Atur kecepatan semua animasi (1 normal, kecil = "kurangi animasi"). */
    setMotion(speed) {
      tweens.speed = speed;
      rig.speed = speed;
    },
    /** Posisi layar (px, relatif kanvas) dari sebuah Object3D atau Vector3. */
    project(target) {
      if (target.isObject3D) target.getWorldPosition(tmp);
      else tmp.copy(target);
      tmp.project(camera);
      return { x: (tmp.x * 0.5 + 0.5) * width, y: (-tmp.y * 0.5 + 0.5) * height };
    },
    resize,
  });
}
