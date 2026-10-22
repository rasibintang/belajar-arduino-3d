import '@fontsource/barlow-semi-condensed/500.css';
import '@fontsource/barlow-semi-condensed/600.css';
import '@fontsource/barlow-semi-condensed/700.css';
import '@fontsource/barlow-semi-condensed/800.css';
import '@fontsource/barlow/400.css';
import '@fontsource/barlow/500.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/600.css';
import './styles/app.css';

import * as THREE from 'three';
import { createStage } from './core/stage.js';
import { Runner } from './sim/runner.js';
import { unlockAudio, setMuted } from './sim/audio.js';
import { LESSONS, LEVELS, levelOf, defaultParams, codeSegments } from './lessons/index.js';
import { createKit } from './lessons/kit.js';
import { CATALOG } from './data/catalog.js';
import { icon, LOGO } from './ui/icons.js';
import { store } from './ui/store.js';
import { createCallouts } from './ui/callouts.js';
import { createInspector } from './ui/inspector.js';
import { createInfoCard } from './ui/info.js';
import { createCodeCard } from './ui/code.js';
import { createLessonStrip } from './ui/strip.js';
import { renderThumbs } from './ui/thumbs.js';
import { startClock, createProgress, createLoader, createSidebar, drawDecor } from './ui/shell.js';

const $ = (sel) => document.querySelector(sel);

const app = {
  index: 0,
  lesson: null,
  params: {},
  parts: {},
  root: null,
};

const IDLE_VIEW = { phase: 'idle', running: false, time: 0, pins: {}, servos: {}, tone: 0, tx: false, state: {} };

/** Nama & keterangan komponen; papan Arduino bisa memberi keterangan per bagian. */
function partInfo(part, point) {
  return (point && part.userData.partAt?.(point)) || part.userData.part;
}

const loader = createLoader($('#loader'));
document.querySelectorAll('[data-logo]').forEach((el) => (el.innerHTML = LOGO));

boot().catch((err) => {
  console.error(err);
  loader.fail('Gagal memuat. Pastikan browser mendukung WebGL.');
});

async function boot() {
  loader.set(0.08, 'Memuat huruf');
  // Huruf harus siap sebelum tulisan di papan digambar ke tekstur
  await Promise.all(
    ['600 20px "Barlow Semi Condensed"', '700 20px "Barlow Semi Condensed"', '800 20px "Barlow Semi Condensed"', '600 20px "IBM Plex Mono"'].map(
      (f) => document.fonts.load(f)
    )
  ).catch(() => {});

  loader.set(0.2, 'Menyiapkan papan');
  const stageEl = $('#stage');
  const tip = $('#tip');

  // ---------- Panggung 3D ----------
  // dideklarasikan lebih dulu karena handler stage bisa terpanggil saat createStage()
  let callouts = null;
  let inspector = null;
  const stage = createStage($('#canvas'), {
    onHover(part, x, y, point) {
      if (!part || inspector?.isOpen) {
        tip.hidden = true;
        return;
      }
      const box = stageEl.getBoundingClientRect();
      const info = partInfo(part, point);
      tip.querySelector('b').textContent = info.name;
      tip.querySelector('span').textContent = info.desc ?? '';
      tip.hidden = false;
      tip.style.transform = `translate(${x - box.left + 16}px, ${y - box.top + 18}px)`;
    },
    onGestureStart: () => (tip.hidden = true),
    onPartClick: (part, x, y, point) => inspector.open(part, x, y, partInfo(part, point)),
    onEmptyClick: () => inspector.close(),
    onResize: () => {
      callouts?.measure();
      if (app.root) frameLesson(true);
    },
  });

  callouts = createCallouts({ layer: $('#callouts'), svg: $('#leaders'), stage });
  inspector = createInspector({
    el: $('#inspector'),
    container: stageEl,
    getLesson: () => app.lesson,
    getParams: () => app.params,
    setParam,
    onOpen: (part) => stage.select(part),
    onClose: () => stage.select(null),
  });
  const info = createInfoCard($('.info-card'));
  const code = createCodeCard($('.code-card'), {
    onRun: (force) => toggleRun(force),
    onSend: (text) => runner.send(text),
    onParamClick(key, x, y) {
      const def = app.lesson.params.find((p) => p.key === key);
      const part = def && app.parts[def.part];
      if (part) inspector.open(part, x, y);
    },
  });
  const strip = createLessonStrip($('.lessons'), {
    lessons: LESSONS,
    levels: LEVELS,
    onSelect: (i) => openLesson(i),
    onLevel: (id) => showProgress(id),
    isDone: store.isDone,
  });
  const progress = createProgress($('.progress-card'));
  /** Kartu progres menampilkan level yang sedang dilihat. */
  function showProgress(levelId = strip.level ?? app.lesson?.level ?? 'basic') {
    const level = LEVELS.find((l) => l.id === levelId);
    progress.set(level.lessons.filter((l) => store.isDone(l.id)).length, level.lessons.length, level.title);
  }
  startClock($('#clock-date'), $('#clock-time'));
  drawDecor($('#decor'));

  const runner = new Runner({
    onSerial: (text, kind) => code.log(text, kind),
    onTrace: (text, nth) => code.trace(text, nth),
    onPhase(phase) {
      code.setPhase(phase);
      $('[data-nav="run"]').parentElement.classList.toggle('is-running', phase !== 'idle');
      if (phase === 'running' && store.markDone(app.lesson.id)) {
        strip.refreshDone(app.lesson.id);
        showProgress(app.lesson.level);
      }
    },
  });

  // ---------- Pengaturan ----------
  const settings = {
    sound: store.setting('sound', true),
    labels: store.setting('labels', true),
    outline: store.setting('outline', true),
    autoRotate: store.setting('autoRotate', false),
    reducedMotion: store.setting('reducedMotion', window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false),
  };
  function applySettings() {
    setMuted(!settings.sound);
    callouts.setVisible(settings.labels);
    stage.toon.enabled = settings.outline;
    stage.autoRotate = settings.autoRotate;
    stage.setMotion(settings.reducedMotion ? 0.05 : 1);
    document.documentElement.classList.toggle('reduce-motion', settings.reducedMotion);
  }

  /** Komponen yang ada di scene saat ini + bagian-bagian papan (untuk menu Komponen). */
  function partsInView() {
    const seen = new Set();
    const list = Object.values(app.parts).filter((g) => g.userData.part && !seen.has(g) && seen.add(g));
    list.push(...(app.parts.board?.userData.subparts ?? []));
    return list.slice(0, 12);
  }

  /** Terbang ke komponen, beri cincin seleksi, lalu buka inspektornya. */
  function focusPart(part) {
    stage.focus(part);
    stage.select(part);
    clearTimeout(focusPart.timer);
    focusPart.timer = setTimeout(() => {
      const anchor = part.userData.anchor ?? part;
      const box = $('#canvas').getBoundingClientRect();
      const p = stage.project(anchor);
      inspector.open(part, box.left + p.x, box.top + p.y);
    }, settings.reducedMotion ? 60 : 1050);
  }
  applySettings();

  const sidebar = createSidebar({
    nav: $('.sidebar'),
    flyout: $('#flyout'),
    views: {
      lessons: () => `
        <header><h2>Pelajaran</h2><button class="icon-btn flyout-close" aria-label="Tutup">${icon('close')}</button></header>
        ${LEVELS.map(
          (level) => `<h3 class="fly-sub">${level.title}
            <span>${level.lessons.filter((l) => store.isDone(l.id)).length}/${level.lessons.length}</span></h3>
          <ol class="fly-lessons">${level.lessons
            .map((l) => {
              const i = LESSONS.indexOf(l);
              return `<li><button data-lesson="${i}" class="${i === app.index ? 'is-current' : ''}">
                <span class="num">${l.num}</span><span>${l.title}</span>
                ${store.isDone(l.id) ? `<span class="done">${icon('check')}</span>` : ''}</button></li>`;
            })
            .join('')}</ol>`
        ).join('')}`,
      parts: () => `
        <header><h2>Komponen</h2><span class="fly-count">${partsInView().length} di layar</span>
          <button class="icon-btn flyout-close" aria-label="Tutup">${icon('close')}</button></header>
        <ul class="fly-parts fly-inview">${partsInView()
          .map(
            (g, i) => `<li><button data-focus="${i}">
              <span class="feat-icon">${icon('focus')}</span>
              <span><b>${g.userData.part.name}</b><small>${g.userData.part.desc ?? ''}</small></span></button></li>`
          )
          .join('')}</ul>
        <h3 class="fly-sub">Semua komponen</h3>
        <ul class="fly-parts">${CATALOG.map((c) => {
          const i = LESSONS.findIndex((l) => l.id === c.lesson);
          const l = LESSONS[i];
          return `<li><button data-lesson="${i}">
              <span class="feat-icon">${icon(c.icon)}</span>
              <span><b>${c.name}</b><small>${c.desc}</small><em>${levelOf(l).title} ${l.num} · ${l.title}</em></span></button></li>`;
        }).join('')}</ul>`,
      settings: () => `
        <header><h2>Pengaturan</h2><button class="icon-btn flyout-close" aria-label="Tutup">${icon('close')}</button></header>
        <div class="fly-settings">
          ${[
            ['sound', 'Suara buzzer', 'volume'],
            ['labels', 'Kartu keterangan', 'tag'],
            ['outline', 'Garis tepi ilustrasi', 'gear'],
            ['autoRotate', 'Putar otomatis saat diam', 'rotRight'],
            ['reducedMotion', 'Kurangi animasi', 'clock'],
          ]
            .map(
              ([key, label, ic]) => `<button class="toggle" data-setting="${key}" role="switch" aria-checked="${settings[key]}">
                <span class="feat-icon">${icon(ic)}</span><span>${label}</span><span class="switch"></span></button>`
            )
            .join('')}
          <button class="btn-text" data-action="reset">${icon('reset')} Ulang progres</button>
          <p class="fly-note">Pintasan: WASD geser · Q/E putar · +/− zoom · R reset · Spasi jalankan · [ ] pindah pelajaran</p>
          <p class="fly-note">Desain terinspirasi dari <a href="https://learn-arduino-red.vercel.app/" target="_blank" rel="noopener noreferrer">Learn Arduino</a> karya Dilum Sanjaya.</p>
        </div>`,
    },
    onNav(name) {
      if (name === 'home') {
        if (app.index === 0) stage.rig.reset();
        else openLesson(0);
      } else if (name === 'run') {
        toggleRun();
      }
    },
    onFlyoutClick(e, { close, refresh }) {
      const focusBtn = e.target.closest('[data-focus]');
      if (focusBtn) {
        const part = partsInView()[Number(focusBtn.dataset.focus)];
        close();
        if (part) focusPart(part);
        return;
      }
      const lessonBtn = e.target.closest('[data-lesson]');
      if (lessonBtn) {
        openLesson(Number(lessonBtn.dataset.lesson));
        close();
        return;
      }
      const toggle = e.target.closest('[data-setting]');
      if (toggle) {
        const key = toggle.dataset.setting;
        settings[key] = !settings[key];
        store.setSetting(key, settings[key]);
        applySettings();
        refresh();
        return;
      }
      if (e.target.closest('[data-action="reset"]') && confirm('Hapus semua progres dan pengaturan pelajaran?')) {
        store.resetProgress();
        strip.refreshDone();
        showProgress();
        openLesson(app.index, { instant: true });
        refresh();
      }
    },
  });

  // ---------- Toolbar kamera ----------
  const viewbar = $('#viewbar');
  viewbar.querySelectorAll('[data-view]').forEach((b) => (b.innerHTML = icon(b.dataset.icon)));
  viewbar.addEventListener('click', (e) => {
    const b = e.target.closest('[data-view]');
    if (!b) return;
    const v = b.dataset.view;
    if (v === 'left') stage.rig.rotate(-1);
    if (v === 'right') stage.rig.rotate(1);
    if (v === 'in') stage.rig.zoomBy(1.25);
    if (v === 'out') stage.rig.zoomBy(0.8);
    if (v === 'reset') stage.rig.reset();
  });
  const needle = viewbar.querySelector('.needle');

  // ---------- Keyboard ----------
  const held = new Set();
  window.addEventListener('keydown', (e) => {
    if (e.target.closest?.('input, textarea, select') || e.ctrlKey || e.metaKey || e.altKey) return;
    stage.touch();
    const k = e.key.toLowerCase();
    if ('wasd'.includes(k) && k.length === 1) held.add(k);
    else if (k === 'q') stage.rig.rotate(-1);
    else if (k === 'e') stage.rig.rotate(1);
    else if (k === '+' || k === '=') stage.rig.zoomBy(1.25);
    else if (k === '-' || k === '_') stage.rig.zoomBy(0.8);
    else if (k === 'r') stage.rig.reset();
    else if (k === '[') openLesson(Math.max(0, app.index - 1));
    else if (k === ']') openLesson(Math.min(LESSONS.length - 1, app.index + 1));
    else if (k === ' ' && !e.target.closest?.('button')) {
      e.preventDefault();
      toggleRun();
    } else if (k === 'escape') {
      inspector.close();
      sidebar.close();
      closeOverlays();
    }
  });
  window.addEventListener('keyup', (e) => held.delete(e.key.toLowerCase()));
  window.addEventListener('blur', () => held.clear());

  // ---------- Panel diperbesar ----------
  function closeOverlays() {
    document.querySelectorAll('.is-expanded').forEach((el) => el.classList.remove('is-expanded'));
    document.body.classList.remove('has-overlay');
  }
  $('#backdrop').addEventListener('click', closeOverlays);

  // ---------- Pelajaran ----------
  function frameLesson(instant) {
    const box = new THREE.Box3();
    app.root.updateMatrixWorld(true);
    app.root.traverse((o) => {
      if (o.isMesh && o.layers.mask === 1 && o.visible) box.expandByObject(o);
    });
    const { width: w, height: h } = stage.size;
    const narrow = w < 640;
    const insets = narrow
      ? { left: 16, right: 16, top: h * 0.12, bottom: h * 0.1 }
      : { left: w * 0.13, right: w * 0.05, top: h * 0.2, bottom: h * 0.13 };
    stage.rig.frame(box, insets, { instant });
  }

  function openLesson(i, { instant = false } = {}) {
    if (i === app.index && app.root && !instant) return;
    runner.stop(true);
    code.setPhase('idle');
    code.clearLog();
    code.hideConsole();
    inspector.close();
    tip.hidden = true;

    const lesson = LESSONS[i];
    app.index = i;
    app.lesson = lesson;
    store.lesson = i;
    const defaults = defaultParams(lesson);
    const saved = store.params(lesson.id);
    app.params = { ...defaults };
    for (const k of Object.keys(defaults)) if (k in saved) app.params[k] = saved[k];

    const kit = createKit();
    const api = { get params() { return app.params; }, setParam };
    lesson.build(kit, api);
    app.parts = kit.parts;
    app.root = kit.root;
    // tombol RESET di papan memulai ulang sketch yang sedang berjalan
    if (kit.parts.board) kit.parts.board.userData.onReset = () => runner.restart();
    code.setSerialInput(lesson.serialInput ?? null);
    // komponen jatuh satu per satu; kabel tergambar setelahnya
    const animMs = stage.setContent(kit.root, { animate: !instant });
    lesson.apply?.(app.params, app.parts, false);

    callouts.render(lesson.callouts, app.parts, { delay: instant ? 0 : Math.min(900, animMs * 0.55) * stage.tweens.speed });
    info.setLesson(lesson, { instant });
    renderCode();
    strip.setActive(i);
    showProgress(lesson.level);
    frameLesson(instant);
    document.title = `${lesson.heading} · Learn Arduino`;
  }

  function renderCode(changedKey = null) {
    code.setCode(codeSegments(app.lesson, app.params), changedKey);
  }

  function setParam(key, value) {
    const def = app.lesson.params.find((p) => p.key === key);
    if (!def) return;
    if (def.type === 'range') {
      value = Math.max(def.min, Math.min(def.max, Math.round(value / def.step) * def.step));
      value = Number(value.toFixed(3));
    }
    if (app.params[key] === value) return;
    app.params[key] = value;
    app.lesson.constrain?.(app.params, key);
    store.saveParams(app.lesson.id, app.params);
    app.lesson.apply?.(app.params, app.parts, runner.running);
    renderCode(key);
    inspector.sync();
  }

  function toggleRun(force) {
    if (runner.active) {
      if (force === true) return;
      runner.stop();
      code.log('Sketch dihentikan.', 'sys');
      app.lesson.apply?.(app.params, app.parts, false);
      return;
    }
    if (force === false) return;
    unlockAudio();
    code.clearLog();
    runner.start(app.lesson, app.params, { parts: app.parts });
  }

  // ---------- Loop per frame ----------
  stage.onUpdate((dt) => {
    runner.tick(dt);
    const v = runner.active ? runner.view() : { ...IDLE_VIEW };
    v.params = app.params;
    v.parts = app.parts;
    app.lesson.update?.(v, app.parts, dt);
    updateBoardLeds(v);
    callouts.update();

    if (held.size) {
      const speed = 420 * dt;
      const dx = (held.has('a') ? 1 : 0) - (held.has('d') ? 1 : 0);
      const dy = (held.has('w') ? 1 : 0) - (held.has('s') ? 1 : 0);
      stage.rig.pan(dx * speed, dy * speed);
    }
    needle.style.transform = `rotate(${-stage.rig.heading}deg)`;
  });

  let flicker = 0;
  function updateBoardLeds(v) {
    const b = app.parts.board;
    if (!b) return;
    const powered = v.phase === 'uploading' || v.phase === 'running';
    b.userData.setLed('ON', powered ? 1 : 0);
    if (v.phase === 'uploading') {
      flicker += 1;
      b.userData.setLed('TX', flicker % 4 < 2 ? 1 : 0);
      b.userData.setLed('RX', flicker % 6 < 3 ? 1 : 0);
      b.userData.setLed('L', flicker % 20 < 10 ? 0.6 : 0);
    } else {
      b.userData.setLed('TX', v.tx ? 1 : 0);
      b.userData.setLed('RX', 0);
      b.userData.setLed('L', v.running ? (v.pins[13] ?? 0) / 255 : 0);
    }
  }

  // ---------- Mulai ----------
  strip.refreshDone();
  openLesson(Math.min(store.lesson ?? 0, LESSONS.length - 1), { instant: true });

  loader.set(0.45, 'Menggambar pelajaran');
  try {
    const urls = await renderThumbs(LESSONS, { onProgress: (f) => loader.set(0.45 + f * 0.5) });
    strip.setThumbs(urls);
  } catch (err) {
    console.warn('Thumbnail gagal dibuat', err);
  }
  loader.set(1, 'Siap');
  loader.done();
  callouts.measure();

  // Akses dari console browser saat pengembangan (tidak ikut di build produksi)
  if (import.meta.env.DEV) window.__la = { app, stage, runner, inspector, openLesson, setParam, toggleRun };
}
