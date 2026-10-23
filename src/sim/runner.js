import { playTone, stopTone } from './audio.js';
import { t } from '../i18n/index.js';
import { phrase, markText, inputText } from '../i18n/lessons.js';

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/** 262 Hz -> "C4" */
function noteName(hz) {
  const midi = Math.round(12 * Math.log2(hz / 440) + 69);
  return `${NOTE_NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`;
}

/**
 * Menjalankan "sketch" pelajaran secara simulasi.
 *
 * Sketch ditulis sebagai generator JavaScript yang meniru Arduino:
 *   *setup(io, p) { io.pinMode(13, io.OUTPUT); }
 *   *loop(io, p)  { io.digitalWrite(13, io.HIGH); yield 1000; ... }
 * `yield ms` sama dengan delay(ms). Jika loop() selesai tanpa yield,
 * loop berikutnya dijalankan pada frame berikutnya.
 *
 * Fase: idle -> compiling -> uploading -> running
 */
export class Runner {
  constructor({ onSerial, onPhase, onTrace }) {
    this.onSerial = onSerial;
    this.onPhase = onPhase;
    this.onTrace = onTrace;
    this.reset();
  }

  reset() {
    this.phase = 'idle';
    this.time = 0; // ms waktu simulasi
    this.phaseTime = 0;
    this.pins = {}; // pin -> 0..255
    this.servos = {};
    this.state = {}; // keadaan perangkat yang ditulis sketch (teks LCD, piksel LED, posisi robot, …)
    this.rx = []; // baris yang diketik pengguna di Serial Monitor
    this.tone = { hz: 0, until: 0 };
    this.txUntil = 0;
    this.gen = null;
    this.wakeAt = 0;
    this.lesson = null;
    this.params = null;
    this.ctx = null;
  }

  /** Kirim satu baris dari Serial Monitor ke sketch. */
  send(text) {
    if (!this.running) return false;
    this.rx.push(inputText(text)); // perintah bahasa Inggris → perintah yang dikenal simulasi
    this.onSerial?.(`> ${text}`, 'in');
    return true;
  }

  /** Tombol RESET papan: sketch mulai lagi dari setup(); memori EEPROM tetap. */
  restart() {
    if (!this.running) return false;
    stopTone();
    this.onSerial?.('— reset —', 'sys');
    this.onTrace?.(null);
    this.pins = {};
    this.servos = {};
    this.state = {};
    this.rx = [];
    this.tone = { hz: 0, until: 0 };
    this.io = this.makeIO();
    this.gen = this.lesson.sketch.setup?.(this.io, this.params) ?? null;
    this.inSetup = true;
    this.wakeAt = this.time;
    return true;
  }

  get running() {
    return this.phase === 'running';
  }

  get active() {
    return this.phase !== 'idle';
  }

  start(lesson, params, ctx) {
    this.stop(true);
    this.lesson = lesson;
    this.params = params;
    this.ctx = ctx;
    this.setPhase('compiling');
    this.onSerial?.(t('sim.compiling'), 'sys');
  }

  stop(silent = false) {
    const wasActive = this.active;
    stopTone();
    this.reset();
    this.onTrace?.(null);
    if (wasActive && !silent) this.onPhase?.('idle');
  }

  setPhase(p) {
    this.phase = p;
    this.phaseTime = 0;
    this.onPhase?.(p);
  }

  makeIO() {
    const self = this;
    const lesson = self.lesson;
    const read = (pin) => lesson.read?.(pin, self.view()) ?? 0;
    // Pin yang tidak dicatat otomatis (mis. TRIG yang berkedip tiap ping, atau
    // pin yang pesannya ditulis sendiri oleh pelajaran lewat io.log)
    const quiet = new Set(lesson.quietPins ?? []);
    const label = (pin) => (typeof pin === 'number' ? `D${pin}` : pin);
    const log = (text) => self.onSerial?.(phrase(text), 'pin');
    const lastRead = {};
    const lastPwm = {};
    let lastServo = null;

    return {
      HIGH: 1,
      LOW: 0,
      INPUT: 'INPUT',
      OUTPUT: 'OUTPUT',
      INPUT_PULLUP: 'INPUT_PULLUP',
      pinMode(pin, mode) {
        if (!quiet.has(pin)) log(`pinMode(${typeof pin === 'number' ? pin : label(pin)}, ${mode})`);
      },
      digitalWrite(pin, v) {
        const value = v ? 255 : 0;
        if (self.pins[pin] !== value && !quiet.has(pin)) log(`${label(pin)} → ${v ? 'HIGH' : 'LOW'}`);
        self.pins[pin] = value;
      },
      analogWrite(pin, v) {
        const value = Math.max(0, Math.min(255, Math.round(v)));
        const prev = self.pins[pin];
        self.pins[pin] = value;
        if (value === prev || quiet.has(pin) || lesson.logPwm === false) return;
        // catat di ujung rentang atau tiap kelipatan 50, agar tanjakan tidak membanjiri log
        const step = Math.floor(value / 50) !== Math.floor((lastPwm[pin] ?? -1) / 50);
        if (value === 0 || value === 255 || step || lesson.logPwm === 'all') {
          lastPwm[pin] = value;
          log(`analogWrite(${pin}, ${value})`);
        }
      },
      /** Keadaan perangkat bersama (dibaca lesson.update lewat view.state). */
      state: self.state,
      /** Nilai mentah dari pelajaran (mis. tombol keypad, posisi encoder). */
      read,
      available: () => self.rx.length,
      readLine: () => self.rx.shift() ?? '',
      map: (x, a, b, c, d) => Math.round(c + ((x - a) * (d - c)) / (b - a)),
      random: (a, b) => (b === undefined ? Math.floor(Math.random() * a) : a + Math.floor(Math.random() * (b - a))),
      digitalRead(pin) {
        const v = read(pin) ? 1 : 0;
        if (lastRead[pin] !== v && !quiet.has(pin)) log(`${label(pin)} → ${v ? t('sim.highPressed') : 'LOW'}`);
        lastRead[pin] = v;
        return v;
      },
      analogRead: (pin) => Math.max(0, Math.min(1023, Math.round(read(pin)))),
      pulseIn: (pin) => read(pin),
      millis: () => self.time,
      println(v) {
        self.txUntil = self.time + 60;
        self.onSerial?.(phrase(String(v)));
      },
      /** Catatan bebas dari pelajaran (mis. "gelap, lampu malam NYALA"). */
      log,
      tone(pin, hz, ms) {
        self.tone = { hz, until: self.time + ms, pin };
        playTone(hz, ms);
        log(`tone(${pin}, ${hz}, ${ms})  ${noteName(hz)}`);
      },
      noTone() {
        self.tone = { hz: 0, until: 0 };
        stopTone();
      },
      servoWrite(pin, angle) {
        const a = Math.max(0, Math.min(180, Math.round(angle)));
        self.servos[pin] = a;
        const bucket = Math.floor(a / 15);
        if (bucket !== lastServo) log(`arm.write(${a})`);
        lastServo = bucket;
      },
      /** Sorot baris kode yang memuat `text` (kemunculan ke-nth) di kartu kode. */
      mark(text, nth = 0) {
        self.onTrace?.(markText(text), nth);
      },
    };
  }

  /** Data yang dibaca pelajaran untuk menggambar keadaan. */
  view() {
    return {
      phase: this.phase,
      running: this.running,
      time: this.time,
      pins: this.pins,
      servos: this.servos,
      tone: this.time < this.tone.until ? this.tone.hz : 0,
      tx: this.time < this.txUntil,
      state: this.state,
      io: this.io,
      params: this.params,
      ...this.ctx,
    };
  }

  tick(dtSec) {
    if (this.phase === 'idle') return;
    const dt = dtSec * 1000;
    this.phaseTime += dt;

    if (this.phase === 'compiling') {
      if (this.phaseTime > 700) {
        this.setPhase('uploading');
        this.onSerial?.(t('sim.uploading'), 'sys');
      }
      return;
    }
    if (this.phase === 'uploading') {
      if (this.phaseTime > 1300) {
        this.onSerial?.(t('sim.uploaded'), 'sys');
        this.setPhase('running');
        this.io = this.makeIO();
        this.gen = this.lesson.sketch.setup?.(this.io, this.params) ?? null;
        this.inSetup = true;
        this.wakeAt = 0;
        this.time = 0;
      }
      return;
    }

    // running
    this.time += dt;
    if (this.time - this.wakeAt > 1000) this.wakeAt = this.time; // tab sempat tidak aktif
    let steps = 0;
    let yieldedThisLoop = false;
    while (this.time >= this.wakeAt && steps < 5000) {
      steps++;
      if (!this.gen) {
        this.gen = this.lesson.sketch.loop(this.io, this.params);
        this.inSetup = false;
        yieldedThisLoop = false;
      }
      const r = this.gen.next();
      if (r.done) {
        this.gen = null;
        // loop() tanpa delay: lanjut di frame berikutnya
        if (!this.inSetup && !yieldedThisLoop) break;
        this.inSetup = false;
        continue;
      }
      yieldedThisLoop = true;
      this.wakeAt += Math.max(0, Number(r.value) || 0);
    }
  }
}
