import { t } from '../i18n/index.js';
import { PinState, UNO_PINS } from './avr.js';
import { createDevice } from './devices.js';
import { buildNetlist } from './netlist.js';

const PULLUP_OHMS = 37000; // pull-up internal ATmega328P
const LOGIC_HIGH = 2.5;

/**
 * Rangkaian yang bisa disimulasikan.
 * parts: [{ id, spec, props, group }] (group sudah ditempatkan di dunia)
 * wires: [{ from: 'id:pin', to: 'id:pin' }]
 */
export class Circuit {
  constructor(parts, wires, { runner = null, log = () => {} } = {}) {
    this.parts = parts;
    this.runner = runner;
    this.log = log;
    this.warned = new Set();
    this.build(wires);
  }

  warn(key, text) {
    if (this.warned.has(key)) return;
    this.warned.add(key);
    this.log(`⚠ ${text}`, 'warn');
  }

  // ---------------------------------------------------------------- netlist
  build(wires) {
    const net = buildNetlist(this.parts, wires);
    this.pinWorld = net.pinWorld;
    this.inserted = net.inserted; // node kaki -> node lubang
    this.nodeGroup = net.nodeGroup;
    this.groupNodes = net.groupNodes;
    this.groupCount = net.groupNodes.length;

    // sumber tegangan papan Uno
    this.mcu = this.parts.find((p) => p.spec.behavior.kind === 'mcu') ?? null;
    this.sources = []; // { node, volts }
    if (this.mcu) {
      const n = (pin) => `${this.mcu.id}:${pin}`;
      this.sources.push({ node: n('GND'), volts: 0 }, { node: n('5V'), volts: 5 }, { node: n('3V3'), volts: 3.3 }, { node: n('VIN'), volts: 5 });
    }

    // pin MCU (tanpa duplikat SDA/SCL)
    this.mcuPins = [];
    if (this.mcu) {
      for (const name of Object.keys(UNO_PINS)) {
        if (name === 'SDA' || name === 'SCL') continue;
        this.mcuPins.push({ name, group: this.nodeGroup.get(`${this.mcu.id}:${name}`), state: PinState.Input, value: false });
      }
    }
    this.mcuByPort = { B: [], C: [], D: [] };
    for (const p of this.mcuPins) this.mcuByPort[UNO_PINS[p.name][0]].push(p);

    // perangkat dari perilaku komponen
    this.resistors = [];
    this.switches = [];
    this.drives = [];
    this.watchers = []; // { group, fn, last }
    this.devices = [];
    const ctx = this.deviceContext();
    for (const part of this.parts) {
      const dev = createDevice(part, ctx);
      if (dev) this.devices.push(dev);
    }

    // grup "sederhana": hanya pin MCU + pengamat → perubahan cukup diteruskan langsung
    const complexity = new Array(this.groupCount).fill(0);
    for (const r of this.resistors) complexity[r.a]++, complexity[r.b]++;
    for (const s of this.switches) complexity[s.a]++, complexity[s.b]++;
    for (const d of this.drives) complexity[d.group]++;
    for (const g of this.consumerGroups ?? []) complexity[g]++;
    const mcuCount = new Array(this.groupCount).fill(0);
    for (const p of this.mcuPins) mcuCount[p.group]++;
    this.needsSolve = complexity.map((c, g) => c > 0 || mcuCount[g] > 1);

    this.volts = new Array(this.groupCount).fill(null);
    this.dirty = true;
  }

  /** Alat yang diberikan ke setiap perangkat (lihat devices.js). */
  deviceContext() {
    const self = this;
    this.consumerGroups = [];
    return {
      get runner() {
        return self.runner;
      },
      group: (node) => self.nodeGroup.get(node),
      volts: (node) => self.volts[self.nodeGroup.get(node)],
      resistor(a, b, ohms) {
        const r = { a: self.nodeGroup.get(a), b: self.nodeGroup.get(b), ohms };
        self.resistors.push(r);
        return r;
      },
      switch(a, b, closed) {
        self.switches.push({ a: self.nodeGroup.get(a), b: self.nodeGroup.get(b), closed });
      },
      drive(node, volts) {
        self.drives.push({ group: self.nodeGroup.get(node), volts });
      },
      watch(node, fn) {
        self.watchers.push({ group: self.nodeGroup.get(node), fn, last: null });
      },
      consumer(node) {
        self.consumerGroups.push(self.nodeGroup.get(node));
      },
      sameNet: (a, b) => self.nodeGroup.get(a) === self.nodeGroup.get(b),
      mcuPinOf(node) {
        const g = self.nodeGroup.get(node);
        return self.mcuPins.find((p) => p.group === g)?.name ?? null;
      },
      changed: () => self.solve(),
      /** Tandai perlu dihitung ulang tanpa langsung menghitung (untuk perubahan sangat sering). */
      markDirty: () => (self.dirty = true),
      /** Nilai logika sebuah titik saat ini (menghitung ulang bila perlu). */
      digital(node) {
        if (self.dirty) self.solve();
        const v = self.volts[self.nodeGroup.get(node)];
        return v !== null && v > LOGIC_HIGH;
      },
      now: () => self.runner?.cycles ?? 0,
      schedule(cycles, fn) {
        self.runner?.cpu.addClockEvent(fn, Math.max(1, Math.round(cycles)));
      },
      warn: (key, text) => self.warn(key, text),
      log: (text, kind) => self.log(text, kind),
      seriesOhms: (a, b) => self.seriesOhms(a, b),
    };
  }

  // ---------------------------------------------------------------- simulasi
  /** Hubungkan ke emulator: kait perubahan port, pembacaan PIN, dan ADC. */
  attach(runner) {
    this.runner = runner;
    runner.hooks.onPortChange = (port) => this.onPortChange(port);
    runner.hooks.onPinRead = () => {
      if (this.dirty) this.solve();
    };
    runner.hooks.onAnalogRead = (ch) => {
      this.solve();
      const pin = this.mcuPins.find((p) => p.name === `A${ch}`);
      const v = pin ? this.volts[pin.group] : 0;
      runner.adc.channelValues[ch] = v ?? Math.random() * 0.3; // pin mengambang: nilai acak kecil
    };
    for (const d of this.devices) d.attach?.(runner);
    this.solve();
  }

  onPortChange(port) {
    const runner = this.runner;
    let complex = false;
    const cycles = runner.cycles;
    for (const p of this.mcuByPort[port]) {
      const st = runner.pinState(p.name);
      if (st === p.state) continue;
      p.state = st;
      if (this.needsSolve[p.group]) complex = true;
      // jalur cepat: teruskan langsung ke pengamat di grup yang sama
      if (st === PinState.High || st === PinState.Low) {
        const v = st === PinState.High;
        for (const w of this.watchers) {
          if (w.group === p.group && w.last !== v) {
            w.last = v;
            w.fn(v, cycles);
          }
        }
      }
    }
    if (complex) this.solve();
    else this.dirty = true;
  }

  /**
   * Hitung tegangan setiap grup, lalu perbarui input MCU dan perangkat.
   * Saklar yang bergantung pada tegangan (transistor) dihitung ulang sampai stabil.
   */
  solve() {
    // perangkat bisa memicu perubahan saat sedang dihitung: jadwalkan ulang, jangan rekursif
    if (this.solving) {
      this.again = true;
      return;
    }
    this.solving = true;
    try {
      for (let round = 0; round < 6; round++) {
        this.again = false;
        for (let pass = 0; pass < 4; pass++) {
          const states = this.switches.map((s) => !!s.closed());
          this.solveOnce(states);
          if (this.switches.every((s, i) => !!s.closed() === states[i])) break;
        }
        this.afterSolve();
        if (!this.again) break;
      }
    } finally {
      this.solving = false;
    }
  }

  solveOnce(closed) {
    this.dirty = false;
    const n = this.groupCount;
    // 1. gabungkan grup yang tersambung lewat saklar tertutup
    const parent = Array.from({ length: n }, (_, i) => i);
    const find = (x) => {
      while (parent[x] !== x) x = parent[x] = parent[parent[x]];
      return x;
    };
    this.switches.forEach((s, i) => {
      if (closed[i]) parent[find(s.a)] = find(s.b);
    });

    // 2. sumber kuat: catu daya, output MCU, perangkat yang menggerakkan pin
    const strong = new Array(n).fill(null);
    const conflict = new Array(n).fill(false);
    const push = (g, v) => {
      const r = find(g);
      if (strong[r] === null) strong[r] = v;
      else if (Math.abs(strong[r] - v) > 0.5) conflict[r] = true;
    };
    for (const s of this.sources) push(this.nodeGroup.get(s.node), s.volts);
    for (const p of this.mcuPins) {
      if (this.runner) p.state = this.runner.pinState(p.name);
      if (p.state === PinState.High) push(p.group, 5);
      else if (p.state === PinState.Low) push(p.group, 0);
    }
    for (const d of this.drives) {
      const v = d.volts();
      if (v !== null && v !== undefined) push(d.group, v);
    }
    for (let r = 0; r < n; r++) {
      if (conflict[r]) {
        this.warn(`short-${r}`, t('w.short'));
        strong[r] = 0;
      }
    }

    // 3. jaringan resistor (termasuk pull-up internal) untuk grup yang tidak digerakkan langsung
    const edges = new Map(); // root -> [{ to, g }]  (to = root atau tegangan tetap)
    const link = (a, b, ohms) => {
      if (a === b) return;
      const g = 1 / Math.max(ohms, 0.01);
      if (!edges.has(a)) edges.set(a, []);
      if (!edges.has(b)) edges.set(b, []);
      edges.get(a).push({ to: b, g });
      edges.get(b).push({ to: a, g });
    };
    for (const r of this.resistors) link(find(r.a), find(r.b), r.ohms());
    const fixed = new Map(); // root -> [{ v, g }]
    for (const p of this.mcuPins) {
      if (p.state === PinState.InputPullUp) {
        const r = find(p.group);
        if (!fixed.has(r)) fixed.set(r, []);
        fixed.get(r).push({ v: 5, g: 1 / PULLUP_OHMS });
      }
    }
    const V = new Array(n).fill(null);
    for (let r = 0; r < n; r++) if (find(r) === r && strong[r] !== null) V[r] = strong[r];
    // grup yang terhubung (lewat resistor) ke sumber
    const reach = new Set();
    const queue = [];
    for (let r = 0; r < n; r++) if (V[r] !== null || fixed.has(r)) queue.push(r), reach.add(r);
    while (queue.length) {
      const a = queue.pop();
      for (const e of edges.get(a) ?? []) if (!reach.has(e.to)) reach.add(e.to), queue.push(e.to);
    }
    const unknown = [];
    for (const r of reach) if (V[r] === null) unknown.push(r), (V[r] = 0);
    for (let iter = 0; iter < 60 && unknown.length; iter++) {
      let delta = 0;
      for (const r of unknown) {
        let num = 0;
        let den = 0;
        for (const e of edges.get(r) ?? []) {
          if (!reach.has(e.to)) continue;
          num += V[e.to] * e.g;
          den += e.g;
        }
        for (const f of fixed.get(r) ?? []) {
          num += f.v * f.g;
          den += f.g;
        }
        const v = den > 0 ? num / den : 0;
        delta = Math.max(delta, Math.abs(v - V[r]));
        V[r] = v;
      }
      if (delta < 1e-4) break;
    }
    for (let g = 0; g < n; g++) this.volts[g] = V[find(g)];
    this.root = find;
    this.driven = strong; // per root: tegangan sumber kuat, atau null
  }

  afterSolve() {
    // 4. input MCU membaca tegangan grupnya
    if (this.runner) {
      for (const p of this.mcuPins) {
        if (p.state === PinState.High || p.state === PinState.Low) continue;
        const v = this.volts[p.group];
        const high = v === null ? false : v > LOGIC_HIGH;
        if (high !== p.value) {
          p.value = high;
          this.runner.setPin(p.name, high);
        }
      }
    }

    // 5. pengamat & konsumen
    const cycles = this.runner?.cycles ?? 0;
    for (const w of this.watchers) {
      const v = this.volts[w.group];
      const high = v !== null && v > LOGIC_HIGH;
      if (high !== w.last) {
        w.last = high;
        w.fn(high, cycles);
      }
    }
    for (const d of this.devices) d.afterSolve?.(cycles);
  }

  /** Perkiraan hambatan seri di antara dua titik (untuk menghitung arus LED). */
  seriesOhms(a, b) {
    if (!this.root) return 0;
    let total = 0;
    for (const node of [a, b]) {
      const root = this.root(this.nodeGroup.get(node));
      // sisi yang digerakkan langsung (pin, 5V, GND) tidak menambah hambatan
      if (this.driven[root] !== null) continue;
      const attached = this.resistors.filter((r) => this.root(r.a) === root || this.root(r.b) === root);
      if (attached.length) total += Math.min(...attached.map((r) => r.ohms()));
    }
    return total;
  }

  /** Panggil tiap frame untuk memperbarui tampilan perangkat. */
  frame(dt) {
    if (this.dirty) this.solve();
    const cycles = this.runner?.cycles ?? 0;
    for (const d of this.devices) d.frame?.(dt, cycles);
  }

  /** Matikan semua (simulasi berhenti): perangkat kembali ke keadaan diam. */
  stop() {
    for (const d of this.devices) d.stop?.();
  }
}
