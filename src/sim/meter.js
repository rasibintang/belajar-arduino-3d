/** Mengukur rata-rata sebuah nilai terhadap waktu (siklus CPU) — untuk PWM. */
export class Meter {
  constructor() {
    this.value = 0;
    this.since = 0;
    this.sum = 0;
    this.span = 0;
  }
  set(value, cycles) {
    if (value === this.value) return;
    this.sum += this.value * (cycles - this.since);
    this.span += cycles - this.since;
    this.value = value;
    this.since = cycles;
  }
  /** Rata-rata sejak terakhir dibaca. */
  take(cycles) {
    const span = this.span + (cycles - this.since);
    const avg = span > 0 ? (this.sum + this.value * (cycles - this.since)) / span : this.value;
    this.sum = 0;
    this.span = 0;
    this.since = cycles;
    return avg;
  }
}
