// Mesin animasi kecil berbasis waktu (tanpa library).

export const Ease = {
  linear: (t) => t,
  inCubic: (t) => t * t * t,
  outCubic: (t) => 1 - (1 - t) ** 3,
  inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
  // melewati target sedikit lalu kembali (efek "memantul")
  outBack: (t) => {
    const s = 1.70158;
    return 1 + (s + 1) * (t - 1) ** 3 + s * (t - 1) ** 2;
  },
  inBack: (t) => {
    const s = 1.70158;
    return (s + 1) * t * t * t - s * t * t;
  },
};

export class Tweens {
  constructor() {
    this.list = new Set();
    /** 1 = normal; kecil = hampir instan (pengaturan "kurangi animasi") */
    this.speed = 1;
  }

  /**
   * onUpdate(eased, raw) dipanggil tiap frame selama animasi.
   * Mengembalikan objek dengan .cancel().
   */
  add({ delay = 0, duration = 600, easing = Ease.inOutCubic, onUpdate, onComplete, tag }) {
    const tw = {
      start: performance.now() + delay * this.speed,
      duration: Math.max(1, duration * this.speed),
      easing,
      onUpdate,
      onComplete,
      tag,
      cancel: () => this.list.delete(tw),
    };
    this.list.add(tw);
    return tw;
  }

  wait(ms) {
    return new Promise((resolve) => this.add({ delay: ms, duration: 1, onComplete: resolve }));
  }

  /** Selesaikan seketika semua animasi dengan tag tertentu. */
  finish(tag) {
    for (const tw of [...this.list]) {
      if (tw.tag !== tag) continue;
      this.list.delete(tw);
      tw.onUpdate?.(tw.easing(1), 1);
      tw.onComplete?.();
    }
  }

  get active() {
    return this.list.size > 0;
  }

  update(now = performance.now()) {
    for (const tw of [...this.list]) {
      if (now < tw.start) continue;
      const raw = Math.min(1, (now - tw.start) / tw.duration);
      tw.onUpdate?.(tw.easing(raw), raw);
      if (raw >= 1) {
        this.list.delete(tw);
        tw.onComplete?.();
      }
    }
  }
}
