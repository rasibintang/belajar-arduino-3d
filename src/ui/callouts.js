import { icon } from './icons.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Kartu keterangan di sekitar papan, masing-masing dengan garis putus-putus
 * ke titik 3D (anchor) yang diproyeksikan ke layar setiap frame.
 */
export function createCallouts({ layer, svg, stage }) {
  let items = [];
  let visible = true;

  function measure() {
    for (const it of items) {
      // kartu yang disembunyikan CSS (layar kecil) tidak diberi garis
      const shown = it.el.offsetWidth > 0;
      it.rect = shown
        ? { left: it.el.offsetLeft, top: it.el.offsetTop, width: it.el.offsetWidth, height: it.el.offsetHeight }
        : null;
      for (const node of [it.path, it.dot, it.ring]) node.style.display = shown ? '' : 'none';
    }
  }

  /** delay (ms): tunda kemunculan, mis. sampai komponen selesai "mendarat". */
  function render(callouts, parts, { delay = 0 } = {}) {
    layer.replaceChildren();
    svg.replaceChildren();
    items = callouts.map((c, i) => {
      const el = document.createElement('div');
      el.className = `callout slot-${c.slot}`;
      const d = `${delay + i * 70}ms`;
      el.style.animationDelay = d;
      el.innerHTML = `${icon(c.icon)}<div><h3>${c.title}</h3><p>${c.text}</p></div>`;
      layer.appendChild(el);

      const path = document.createElementNS(SVG_NS, 'path');
      path.setAttribute('class', 'leader');
      const dot = document.createElementNS(SVG_NS, 'circle');
      dot.setAttribute('class', 'leader-start');
      dot.setAttribute('r', '3');
      const ring = document.createElementNS(SVG_NS, 'circle');
      ring.setAttribute('class', 'leader-end');
      ring.setAttribute('r', '5');
      for (const node of [path, dot, ring]) {
        node.classList.add('leader-in');
        node.style.animationDelay = d;
      }
      svg.append(path, dot, ring);

      const item = { el, path, dot, ring, anchor: c.anchor(parts), top: c.slot[0] === 't' };
      el.addEventListener('mouseenter', () => path.classList.add('is-hot'));
      el.addEventListener('mouseleave', () => path.classList.remove('is-hot'));
      return item;
    });
    requestAnimationFrame(measure);
  }

  function update() {
    if (!visible) return;
    for (const it of items) {
      if (!it.rect || !it.anchor) continue;
      const a = stage.project(it.anchor);
      const r = it.rect;
      const sx = Math.max(r.left + 18, Math.min(r.left + r.width - 18, a.x));
      const sy = it.top ? r.top + r.height : r.top;
      const stub = it.top ? 14 : -14;
      it.path.setAttribute('d', `M${sx.toFixed(1)} ${sy.toFixed(1)}v${stub}L${a.x.toFixed(1)} ${a.y.toFixed(1)}`);
      it.dot.setAttribute('cx', sx.toFixed(1));
      it.dot.setAttribute('cy', sy.toFixed(1));
      it.ring.setAttribute('cx', a.x.toFixed(1));
      it.ring.setAttribute('cy', a.y.toFixed(1));
    }
  }

  function setVisible(v) {
    visible = v;
    layer.hidden = !v;
    svg.style.display = v ? '' : 'none';
  }

  return { render, update, measure, setVisible };
}
