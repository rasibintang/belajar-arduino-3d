import { EEPROMMemoryBackend } from 'avr8js';
import { AVRRunner, FREQ } from '../sim/avr.js';
import { Circuit } from '../sim/circuit.js';
import { unlockAudio } from '../sim/audio.js';

const COMPILE_URL = import.meta.env.VITE_COMPILE_URL ?? '/api/compile';
const SAMPLE_EVERY = 6000; // siklus: seberapa sering PC dicek untuk sorotan baris

export async function compile(sketch) {
  try {
    const res = await fetch(COMPILE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sketch }),
    });
    if (!res.ok) return { ok: false, stderr: `Server kompilasi menjawab ${res.status}.` };
    return await res.json();
  } catch {
    return { ok: false, stderr: 'Server kompilasi tidak dapat dihubungi. Jalankan `npm run dev` (atau server/compile-server.mjs).' };
  }
}

/**
 * Pengatur simulasi sandbox.
 * deps: { wb, editor, serial: { sys, err, out, warn, clear }, onState(state), getEeprom(), setEeprom() }
 */
export function createSim(deps) {
  const { wb, editor, serial } = deps;
  let state = 'idle';
  let runner = null;
  let circuit = null;
  let lines = [];
  let lastLine = 0;
  let speed = 1;
  let token = 0;
  const eeprom = new EEPROMMemoryBackend(1024);
  eeprom.memory.fill(0xff);

  function setState(s) {
    state = s;
    deps.onState?.(s);
  }

  /** Baris sketch untuk alamat program (atau 0 bila di luar sketch, mis. di dalam delay()). */
  function lineAt(pc) {
    if (!lines.length || pc < lines[0][0] || pc > lines[lines.length - 1][0] + 16) return 0;
    let lo = 0;
    let hi = lines.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (lines[mid][0] <= pc) lo = mid;
      else hi = mid - 1;
    }
    return lines[lo][1];
  }

  /**
   * Baris sketch yang sedang aktif. Jika CPU sedang di dalam fungsi library (mis. delay()),
   * cari alamat kembali di stack yang menunjuk ke sketch — itulah baris pemanggilnya.
   */
  function currentLine() {
    const line = lineAt(runner.pcBytes);
    if (line) return line;
    const data = runner.cpu.data;
    const sp = data[0x5d] | (data[0x5e] << 8);
    for (let a = sp + 1; a < Math.min(sp + 48, 0x8ff); a++) {
      const ret = ((data[a] << 8) | data[a + 1]) * 2; // alamat kembali (word, big-endian)
      const l = lineAt(ret - 2);
      if (l) return l;
    }
    return 0;
  }

  function sample() {
    if (!runner) return;
    const line = currentLine();
    if (line) lastLine = line;
    runner.cpu.addClockEvent(sample, SAMPLE_EVERY);
  }

  async function start() {
    if (state !== 'idle') return;
    unlockAudio();
    const my = ++token;
    setState('compiling');
    serial.clear();
    serial.sys('Mengompilasi sketch…');
    const t0 = performance.now();
    const res = await compile(editor.value);
    if (my !== token) return; // dibatalkan
    if (!res.ok) {
      editor.setErrors(res.stderr);
      serial.err(res.stderr || 'Kompilasi gagal.');
      setState('idle');
      return;
    }
    editor.setErrors('');
    serial.sys(`Berhasil (${res.size ?? '?'} byte, ${Math.round(performance.now() - t0)} ms). Simulasi berjalan.`);
    lines = res.lines ?? [];
    lastLine = 0;

    const saved = deps.getEeprom?.();
    if (saved) eeprom.memory.set(saved);
    runner = new AVRRunner(res.hex, { eeprom });
    let pending = '';
    runner.hooks.onSerial = (b) => {
      if (b === 13) return;
      if (b === 10) {
        serial.out(pending, true);
        pending = '';
      } else {
        pending += String.fromCharCode(b);
        serial.out(pending, false);
      }
    };
    wb.setMode('run');
    circuit = new Circuit(wb.circuitParts(), wb.circuitWires(), { log: (text, kind) => (kind === 'warn' ? serial.warn(text) : serial.sys(text)) });
    circuit.attach(runner);
    if (!circuit.mcu) serial.warn('Tidak ada Arduino Uno di rangkaian — tambahkan dari menu “+”.');

    // interaksi saat berjalan
    for (const part of wb.parts.values()) {
      const ud = part.group.userData;
      if (part.spec.type === 'arduino-uno') {
        ud.onReset = () => {
          runner.reset();
          pending = '';
          serial.sys('— reset —');
          circuit.solve();
          sample();
        };
      }
      const b = part.spec.behavior;
      if (b.kind === 'pot') {
        const key = b.positionProp;
        ud.knob = { get: () => part.props[key], set: (v) => wb.setProp(part.id, key, Math.round(v)), min: 0, max: 1023, speed: 4 };
      }
    }
    sample();
    setState('running');
  }

  function stop() {
    token++;
    if (state === 'idle') return;
    if (circuit) circuit.stop();
    for (const part of wb.parts.values()) {
      delete part.group.userData.knob;
      delete part.group.userData.onReset;
    }
    if (runner) deps.setEeprom?.(Array.from(eeprom.memory));
    runner = null;
    circuit = null;
    editor.setTrace(0);
    wb.setMode('edit');
    setState('idle');
  }

  /** Dipanggil tiap frame. */
  function frame(dt) {
    if (state !== 'running' || !runner) return;
    const want = Math.min(dt, 0.05) * FREQ;
    const done = runner.run(runner.cycles + want);
    speed = speed * 0.9 + (done / want) * 0.1;
    circuit.frame(dt);
    editor.setTrace(lastLine);
  }

  return {
    start,
    stop,
    frame,
    get state() {
      return state;
    },
    get speed() {
      return speed;
    },
    get circuit() {
      return circuit;
    },
    send(text) {
      if (!runner) return false;
      runner.sendSerial(text);
      return true;
    },
    /** Rangkaian berubah saat berjalan (mis. props): hitung ulang. */
    refresh() {
      circuit?.solve();
    },
  };
}
