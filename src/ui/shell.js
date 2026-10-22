import { icon } from './icons.js';

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MEI', 'JUN', 'JUL', 'AGU', 'SEP', 'OKT', 'NOV', 'DES'];
const pad = (n) => String(n).padStart(2, '0');

/** Jam digital di pojok kanan atas. */
export function startClock(dateEl, timeEl) {
  const tick = () => {
    const d = new Date();
    dateEl.textContent = `${pad(d.getDate())} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
    timeEl.textContent = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  };
  tick();
  setInterval(tick, 1000);
}

/** Kartu progres per level, mis. "Dasar 3/11". */
export function createProgress(root) {
  const fill = root.querySelector('.progress-fill');
  const count = root.querySelector('.progress-count');
  const label = root.querySelector('.progress-label');
  const bar = root.querySelector('[role=progressbar]');
  return {
    set(n, total, title) {
      fill.style.width = `${(n / total) * 100}%`;
      count.textContent = `${n}/${total}`;
      if (title) label.textContent = title;
      bar.setAttribute('aria-valuemax', String(total));
      bar.setAttribute('aria-valuenow', String(n));
    },
  };
}

/** Layar pemuatan dengan bilah progres. */
export function createLoader(root) {
  const fill = root.querySelector('.loader-fill');
  const step = root.querySelector('.loader-step');
  return {
    set(fraction, text) {
      fill.style.width = `${Math.round(fraction * 100)}%`;
      if (text) step.textContent = text;
    },
    done() {
      root.classList.add('is-done');
      document.getElementById('app').inert = false;
      setTimeout(() => root.remove(), 700);
    },
    fail(message) {
      step.textContent = message;
      root.classList.add('is-error');
    },
  };
}

/**
 * Sidebar kiri + panel flyout.
 * views: { lessons: () => html, parts: () => html, settings: () => html }
 */
export function createSidebar({ nav, flyout, views, onNav, onFlyoutClick }) {
  nav.querySelectorAll('[data-nav]').forEach((a) => {
    a.querySelector('.nav-icon').innerHTML = icon(a.dataset.icon);
  });
  nav.querySelector('.side-toggle').innerHTML = icon('chevron');
  nav.querySelector('.side-toggle').addEventListener('click', (e) => {
    const wide = nav.classList.toggle('is-wide');
    e.currentTarget.setAttribute('aria-expanded', String(wide));
  });

  let open = null;
  function close() {
    flyout.hidden = true;
    open = null;
    setActive(null);
  }
  function setActive(name) {
    nav.querySelectorAll('[data-nav]').forEach((a) => a.parentElement.classList.toggle('is-active', a.dataset.nav === name));
  }
  function show(name) {
    if (open === name) return close();
    open = name;
    flyout.innerHTML = views[name]();
    flyout.hidden = false;
    setActive(name);
  }

  nav.addEventListener('click', (e) => {
    const a = e.target.closest('[data-nav]');
    if (!a) return;
    e.preventDefault();
    const name = a.dataset.nav;
    if (views[name]) show(name);
    else {
      close();
      onNav(name);
    }
  });
  flyout.addEventListener('click', (e) => {
    if (e.target.closest('.flyout-close')) return close();
    onFlyoutClick(e, { close, refresh: () => open && (flyout.innerHTML = views[open]()) });
  });
  document.addEventListener('pointerdown', (e) => {
    if (open && !flyout.contains(e.target) && !nav.contains(e.target)) close();
  });

  return { close, get open() { return open; } };
}

/** Garis-garis jalur PCB samar sebagai hiasan latar. */
export function drawDecor(svg) {
  const draw = () => {
    const w = svg.clientWidth;
    const h = svg.clientHeight;
    if (!w || !h) return;
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    const traces = [
      [[w * 0.07, 96], [w * 0.07, 78], [w * 0.09, 64], [w * 0.4, 64], [w * 0.43, 40]],
      [[w * 0.55, 0], [w * 0.55, 22], [w * 0.58, 40], [w * 0.66, 40]],
      [[w - 20, h * 0.12], [w - 34, h * 0.12], [w - 34, h * 0.42]],
      [[60, h * 0.32], [74, h * 0.34], [74, h * 0.62], [90, h * 0.66]],
      [[60, h * 0.78], [84, h * 0.8], [84, h - 150], [104, h - 136], [w * 0.62, h - 136], [w * 0.64, h - 128], [w - 24, h - 128]],
      [[w * 0.36, h - 150], [w * 0.38, h - 168], [w * 0.5, h - 168]],
      [[w - 24, h * 0.55], [w - 24, h * 0.7], [w - 40, h * 0.73]],
    ];
    let html = '';
    for (const t of traces) {
      html += `<polyline points="${t.map(([x, y]) => `${x.toFixed(0)},${y.toFixed(0)}`).join(' ')}" />`;
      const [ex, ey] = t[t.length - 1];
      html += `<circle cx="${ex.toFixed(0)}" cy="${ey.toFixed(0)}" r="3.5" />`;
    }
    const pads = [[w * 0.62, 34], [w * 0.64, 46], [w - 56, h * 0.08], [w - 44, h * 0.92], [70, h * 0.68]];
    for (const [x, y] of pads) html += `<rect x="${(x - 5).toFixed(0)}" y="${(y - 5).toFixed(0)}" width="10" height="10" />`;
    svg.innerHTML = html;
  };
  new ResizeObserver(draw).observe(svg);
  draw();
}
