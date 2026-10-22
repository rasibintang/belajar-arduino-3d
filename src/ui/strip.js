import { icon } from './icons.js';

/**
 * Deretan kartu pelajaran di bagian bawah, dengan tab level (Dasar/Menengah/Mahir).
 * Indeks yang dipakai = indeks global di LESSONS.
 */
export function createLessonStrip(root, { lessons, levels, onSelect, onLevel, isDone }) {
  const list = root.querySelector('.lesson-list');
  const tabs = root.querySelector('.level-tabs');
  const prev = root.querySelector('.strip-prev');
  const next = root.querySelector('.strip-next');
  prev.innerHTML = icon('chevronLeft');
  next.innerHTML = icon('chevron');
  let shownLevel = null;

  tabs.innerHTML = levels
    .map((l) => `<button role="tab" data-level="${l.id}">${l.title}<span class="level-count"></span></button>`)
    .join('');
  tabs.addEventListener('click', (e) => {
    const b = e.target.closest('[data-level]');
    if (b) {
      showLevel(b.dataset.level);
      onLevel?.(b.dataset.level);
    }
  });

  list.innerHTML = lessons
    .map(
      (l, i) => `<li data-level="${l.level}">
        <button class="lesson-card" data-index="${i}">
          <span class="thumb"><img alt="" /></span>
          <span class="lesson-name">${l.num}. ${l.title}</span>
          <span class="lesson-go">${icon('chevron')}</span>
          <span class="lesson-check" title="Selesai">${icon('check')}</span>
        </button>
      </li>`
    )
    .join('');

  list.addEventListener('click', (e) => {
    const card = e.target.closest('.lesson-card');
    if (card) onSelect(Number(card.dataset.index));
  });

  const scrollBy = (dir) => list.scrollBy({ left: dir * list.clientWidth * 0.7, behavior: 'smooth' });
  prev.addEventListener('click', () => scrollBy(-1));
  next.addEventListener('click', () => scrollBy(1));

  function updateArrows() {
    prev.hidden = list.scrollLeft < 8;
    next.hidden = list.scrollLeft + list.clientWidth > list.scrollWidth - 8;
  }
  list.addEventListener('scroll', updateArrows, { passive: true });
  new ResizeObserver(updateArrows).observe(list);

  /** Tampilkan hanya kartu milik satu level (dengan animasi muncul). */
  function showLevel(id) {
    if (id === shownLevel) return;
    shownLevel = id;
    tabs.querySelectorAll('[data-level]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.level === id)));
    let n = 0;
    for (const li of list.children) {
      const on = li.dataset.level === id;
      li.hidden = !on;
      if (on) {
        li.style.animationDelay = `${n++ * 40}ms`;
        li.classList.remove('is-in');
        void li.offsetWidth;
        li.classList.add('is-in');
      }
    }
    list.scrollLeft = 0;
    updateArrows();
  }

  function refreshCounts() {
    for (const level of levels) {
      const done = level.lessons.filter((l) => isDone(l.id)).length;
      tabs.querySelector(`[data-level="${level.id}"] .level-count`).textContent = `${done}/${level.lessons.length}`;
    }
  }

  return {
    showLevel,
    get level() {
      return shownLevel;
    },
    setThumbs(urls) {
      list.querySelectorAll('img').forEach((img, i) => (img.src = urls[i]));
    },
    setActive(index) {
      showLevel(lessons[index].level);
      list.querySelectorAll('.lesson-card').forEach((c, i) => {
        c.classList.toggle('is-active', i === index);
        c.setAttribute('aria-current', i === index ? 'step' : 'false');
      });
      const card = list.children[index];
      if (card) {
        const left = card.offsetLeft - (list.clientWidth - card.offsetWidth) / 2;
        list.scrollTo({ left, behavior: 'smooth' });
      }
      updateArrows();
    },
    /** justId: pelajaran yang baru saja selesai — kartunya diberi animasi "pop". */
    refreshDone(justId = null) {
      list.querySelectorAll('.lesson-card').forEach((c, i) => {
        c.classList.toggle('is-done', isDone(lessons[i].id));
        if (lessons[i].id === justId) {
          c.classList.remove('just-done');
          void c.offsetWidth; // mulai ulang animasi CSS
          c.classList.add('just-done');
        }
      });
      refreshCounts();
    },
  };
}
