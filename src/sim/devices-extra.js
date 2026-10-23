import { Meter } from './meter.js';
import { FREQ } from './avr.js';
import { click } from './audio.js';
import { HD44780 } from './hd44780.js';
import { powered, ledLevel } from './device-utils.js';

// Perangkat simulasi gelombang 1 (lihat devices.js untuk format umumnya).

const HIGH = 2.5;
/** Tegangan sebuah titik sebagai logika; mengambang = `float`. */
const level = (ctx, node, float = false) => {
  const v = ctx.volts(node);
  return v === null ? float : v > HIGH;
};
/** Seperti level(), tetapi menghitung ulang dulu bila perlu (untuk dipakai di dalam watch). */
const fresh = (ctx, node, float = false) => {
  ctx.digital(node);
  return level(ctx, node, float);
};

// ---------------------------------------------------------------- sumber tegangan (VCC/GND)
export function sourceDevice(part, ctx, n) {
  const b = part.spec.behavior;
  ctx.drive(n(b.pin), () => b.volts);
  return null;
}

// ---------------------------------------------------------------- saklar geser
export function slideSwitchDevice(part, ctx, n) {
  const b = part.spec.behavior;
  const ud = part.group.userData;
  ctx.switch(n(b.p1), n(b.common), () => ud.position === 0);
  ctx.switch(n(b.common), n(b.p2), () => ud.position === 1);
  ud.onChange = () => ctx.changed();
  return {
    stop() {
      ud.onChange = null;
    },
  };
}

// ---------------------------------------------------------------- DIP switch
export function dipDevice(part, ctx, n) {
  const b = part.spec.behavior;
  const ud = part.group.userData;
  b.inputs.forEach((id, i) => ctx.switch(n(id), n(b.outputs[i]), () => !!ud.on[i]));
  ud.onChange = () => ctx.changed();
  return {
    stop() {
      ud.onChange = null;
    },
  };
}

// ---------------------------------------------------------------- NTC (pembagi tegangan)
export function ntcDevice(part, ctx, n) {
  const b = part.spec.behavior;
  const R0 = 10000;
  // VCC —[10 kΩ]— OUT —[NTC]— GND
  ctx.resistor(n(b.vcc), n(b.out), () => R0);
  ctx.resistor(n(b.out), n(b.gnd), () => {
    const T = part.props[b.tempProp] + 273.15;
    return R0 * Math.exp(b.beta * (1 / T - 1 / 298.15));
  });
  part.onPropsChange = () => ctx.changed();
  return {
    stop() {
      part.onPropsChange = null;
    },
  };
}

// ---------------------------------------------------------------- PIR
export function pirDevice(part, ctx, n) {
  const b = part.spec.behavior;
  const ud = part.group.userData;
  let until = -1;
  let active = false;
  const on = () => powered(ctx, n(b.vcc), n(b.gnd));
  ctx.drive(n(b.out), () => (on() ? (active ? 5 : 0) : null));
  return {
    attach() {
      ud.press = (down) => {
        if (!down) return;
        until = ctx.now() + part.props[b.holdProp] * FREQ;
        if (!active) {
          active = true;
          ctx.changed();
        }
      };
    },
    frame() {
      if (active && ctx.now() > until) {
        active = false;
        ctx.changed();
      }
      ud.setActive(active && on());
    },
    stop() {
      delete ud.press;
      ud.setActive(false);
    },
  };
}

// ---------------------------------------------------------------- MQ2
export function mq2Device(part, ctx, n) {
  const b = part.spec.behavior;
  const on = () => powered(ctx, n(b.vcc), n(b.gnd));
  const alarm = () => part.props[b.gasProp] > part.props[b.thresholdProp];
  ctx.drive(n(b.aout), () => (on() ? (part.props[b.gasProp] / 1023) * 5 : null));
  ctx.drive(n(b.dout), () => (on() ? (alarm() ? 0 : 5) : null));
  part.onPropsChange = () => ctx.changed();
  return {
    frame() {
      part.group.userData.setAlarm(on() && alarm());
    },
    stop() {
      part.onPropsChange = null;
      part.group.userData.setAlarm(false);
    },
  };
}

// ---------------------------------------------------------------- LCD paralel (HD44780)
export function lcdParallelDevice(part, ctx, n) {
  const b = part.spec.behavior;
  const ud = part.group.userData;
  const lcd = new HD44780({ cols: b.cols, rows: b.rows });
  const blank = Array(b.rows).fill('');
  ctx.watch(n(b.e), (high) => {
    if (high || !powered(ctx, n(b.vdd), n(b.vss))) return;
    let byte = 0;
    b.inputs.forEach((id, i) => {
      if (ctx.digital(n(id))) byte |= 1 << i;
    });
    lcd.clock(ctx.digital(n(b.rs)) ? 1 : 0, byte);
  });
  const backlight = () => {
    const [a, k] = b.backlight.map((id) => ctx.volts(n(id)));
    if (a === null) return true; // lampu latar tidak disambung: anggap menyala agar teks terbaca
    return k !== null && a - k > 2;
  };
  return {
    frame() {
      const on = powered(ctx, n(b.vdd), n(b.vss));
      if (!on) lcd.reset();
      ud.setBacklight(on && backlight());
      ud.setText(on && lcd.displayOn ? lcd.lines() : blank);
    },
    stop() {
      ud.setBacklight(false);
      ud.setText(blank);
    },
  };
}

// ---------------------------------------------------------------- gerbang logika
const GATE_FN = {
  NOT: ([a]) => !a,
  AND: ([a, b]) => a && b,
  OR: ([a, b]) => a || b,
  XOR: ([a, b]) => a !== b,
  NAND: ([a, b]) => !(a && b),
  NOR: ([a, b]) => !(a || b),
  XNOR: ([a, b]) => a === b,
};

/** Kerangka perangkat logika: keluaran dihitung ulang setiap kali masukan berubah. */
function logicDevice(part, ctx, n, { inputs, outputs, compute }) {
  const ins = Object.fromEntries(inputs.map((id) => [id, false]));
  let outs = Object.fromEntries(outputs.map((id) => [id, false]));
  for (const id of outputs) ctx.drive(n(id), () => (outs[id] ? 5 : 0));
  for (const id of inputs) {
    ctx.watch(n(id), (high, cycles) => {
      const rising = high && !ins[id];
      ins[id] = high;
      const next = compute(ins, outs, { pin: id, rising, cycles });
      if (outputs.some((o) => next[o] !== outs[o])) {
        outs = next;
        ctx.changed();
      }
    });
  }
  const first = outputs[0];
  return {
    attach() {
      outs = compute(ins, outs, {});
      ctx.changed();
    },
    frame() {
      part.group.userData.setOut(outs[first]);
    },
    stop() {
      part.group.userData.setOut(false);
    },
  };
}

export function gateDevice(part, ctx, n) {
  const b = part.spec.behavior;
  const fn = GATE_FN[b.fn];
  return logicDevice(part, ctx, n, {
    inputs: b.inputs,
    outputs: [b.y],
    compute: (ins) => ({ [b.y]: fn(b.inputs.map((id) => ins[id])) }),
  });
}

export function mux2Device(part, ctx, n) {
  const b = part.spec.behavior;
  return logicDevice(part, ctx, n, {
    inputs: [b.a, b.b, b.sel],
    outputs: [b.out],
    compute: (ins) => ({ [b.out]: ins[b.sel] ? ins[b.b] : ins[b.a] }),
  });
}

export function dffDevice(part, ctx, n) {
  const b = part.spec.behavior;
  const extra = [b.set, b.reset].filter(Boolean);
  return logicDevice(part, ctx, n, {
    inputs: [b.d, b.clk, ...extra],
    outputs: [b.q, b.notq],
    compute: (ins, outs, { pin, rising }) => {
      let q = outs[b.q];
      if (b.set && ins[b.set]) q = true;
      else if (b.reset && ins[b.reset]) q = false;
      else if (pin === b.clk && rising) q = ins[b.d];
      return { [b.q]: q, [b.notq]: !q };
    },
  });
}

// ---------------------------------------------------------------- generator clock
export function clockDevice(part, ctx, n) {
  const b = part.spec.behavior;
  let high = false;
  let running = false;
  ctx.drive(n(b.clk), () => (high ? 5 : 0));
  const tick = () => {
    if (!running) return;
    high = !high;
    ctx.changed();
    ctx.schedule(FREQ / (2 * part.props[b.hzProp]), tick);
  };
  return {
    attach() {
      running = true;
      tick();
    },
    frame() {
      part.group.userData.setOut(high);
    },
    stop() {
      running = false;
      part.group.userData.setOut(false);
    },
  };
}

// ---------------------------------------------------------------- relay DPDT
export function dpdtDevice(part, ctx, n) {
  const b = part.spec.behavior;
  let on = false;
  const coil = () => {
    const a = ctx.volts(n(b.coil1));
    const c = ctx.volts(n(b.coil2));
    return a !== null && c !== null && Math.abs(a - c) > 3;
  };
  for (const [p, nc, no] of [
    [b.p1, b.nc1, b.no1],
    [b.p2, b.nc2, b.no2],
  ]) {
    ctx.switch(n(p), n(nc), () => !coil());
    ctx.switch(n(p), n(no), () => coil());
  }
  ctx.consumer(n(b.coil1));
  ctx.consumer(n(b.coil2));
  return {
    afterSolve() {
      const next = coil();
      if (next !== on) {
        on = next;
        click();
      }
    },
    frame(dt) {
      part.group.userData.setOn(on);
      part.group.userData.tick(dt);
    },
    stop() {
      part.group.userData.setOn(false);
    },
  };
}

// ---------------------------------------------------------------- 74HC165
export function hc165Device(part, ctx, n) {
  const b = part.spec.behavior;
  let reg = 0;
  const on = () => powered(ctx, n(b.vcc), n(b.gnd));
  const load = () => {
    reg = 0;
    b.inputs.forEach((id, i) => {
      if (ctx.digital(n(id))) reg |= 1 << i;
    });
  };
  ctx.drive(n(b.q7), () => (on() ? (reg & 0x80 ? 5 : 0) : null));
  ctx.drive(n(b.notq7), () => (on() ? (reg & 0x80 ? 0 : 5) : null));
  ctx.watch(n(b.pl), (high) => {
    if (high) return;
    load();
    ctx.markDirty();
  });
  ctx.watch(n(b.cp), (high) => {
    if (!high) return;
    if (!fresh(ctx, n(b.pl), true)) load();
    else if (!fresh(ctx, n(b.ce), false)) reg = ((reg << 1) | (ctx.digital(n(b.ds)) ? 1 : 0)) & 0xff;
    ctx.markDirty();
  });
  return null;
}

// ---------------------------------------------------------------- CD74HC4067
export function mux16Device(part, ctx, n) {
  const b = part.spec.behavior;
  const channel = () => {
    if (level(ctx, n(b.en), false) || !powered(ctx, n(b.vcc), n(b.gnd))) return -1;
    return b.select.reduce((acc, id, i) => acc | (level(ctx, n(id)) ? 1 << i : 0), 0);
  };
  b.outputs.forEach((id, i) => ctx.switch(n(b.sig), n(id), () => channel() === i));
  for (const id of [...b.select, b.en]) ctx.consumer(n(id));
  return null;
}

// ---------------------------------------------------------------- A4988
const MICRO = { 0b000: 1, 0b001: 2, 0b010: 4, 0b011: 8, 0b111: 16 };
// polaritas kumparan [A, B] untuk tiap fase langkah penuh
const PHASES = [
  [1, 1],
  [-1, 1],
  [-1, -1],
  [1, -1],
];
export function a4988Device(part, ctx, n) {
  const b = part.spec.behavior;
  let pos = 0; // dalam satuan 1/16 langkah
  const logicOn = () => powered(ctx, n(b.vdd), n(b.gnd));
  const active = () => logicOn() && !level(ctx, n(b.enable), false) && level(ctx, n(b.sleep), true) && level(ctx, n(b.reset), true);
  const phase = () => PHASES[(((pos >> 4) % 4) + 4) % 4];
  const [a1, a2, b1, b2] = b.outputs;
  const coil = (idx, sign) => () => (active() ? (phase()[idx] === sign ? 5 : 0) : null);
  ctx.drive(n(a1), coil(0, 1));
  ctx.drive(n(a2), coil(0, -1));
  ctx.drive(n(b1), coil(1, 1));
  ctx.drive(n(b2), coil(1, -1));
  for (const id of [b.enable, b.sleep, b.reset]) ctx.consumer(n(id));
  ctx.watch(n(b.step), (high) => {
    if (!high || !active()) return;
    if (ctx.volts(n(b.reset)) === null) ctx.warn(`a4988-${part.id}`, `A4988 ${part.id}: RESET mengambang — sambungkan ke SLEEP agar driver bekerja di rangkaian nyata.`);
    const ms = b.ms.reduce((acc, id, i) => acc | (fresh(ctx, n(id)) ? 1 << i : 0), 0);
    const micro = MICRO[ms] ?? 1;
    pos += (fresh(ctx, n(b.dir)) ? 1 : -1) * (16 / micro);
    ctx.changed();
  });
  return null;
}

// ---------------------------------------------------------------- stepper bipolar
// posisi setengah langkah dari polaritas [A, B]
const HALF = { '1,0': 0, '1,1': 1, '0,1': 2, '-1,1': 3, '-1,0': 4, '-1,-1': 5, '0,-1': 6, '1,-1': 7 };
export function bipolarDevice(part, ctx, n) {
  const b = part.spec.behavior;
  const motors = [];
  for (let i = 0; i < b.inputs.length; i += 4) motors.push({ pins: b.inputs.slice(i, i + 4).map(n), last: -1, half: 0 });
  for (const id of b.inputs) ctx.consumer(n(id));
  const sign = (p, m) => {
    const a = ctx.volts(p);
    const c = ctx.volts(m);
    if (a === null || c === null) return 0;
    return a - c > 1 ? 1 : c - a > 1 ? -1 : 0;
  };
  return {
    afterSolve() {
      for (const m of motors) {
        const [ap, am, bp, bm] = m.pins;
        const idx = HALF[`${sign(ap, am)},${sign(bp, bm)}`];
        if (idx === undefined) continue;
        if (m.last >= 0) {
          const d = ((idx - m.last + 12) % 8) - 4;
          if (d !== -4) m.half += d;
        } else m.half = idx > 4 ? idx - 9 : idx - 1; // pertama diberi arus: rotor melompat ke fase itu ((+,+) = 0°)
        m.last = idx;
      }
    },
    frame() {
      motors.forEach((m, i) => part.group.userData.setAngle((m.half / (b.stepsPerRev * 2)) * 360, i));
    },
  };
}

// ---------------------------------------------------------------- 7-segment multipleks
export function seg7muxDevice(part, ctx, n) {
  const b = part.spec.behavior;
  const meters = b.digits.map(() => Object.fromEntries(b.segments.map((s) => [s, new Meter()])));
  for (const id of [...b.segments, ...b.digits]) ctx.consumer(n(id));
  return {
    afterSolve(cycles) {
      const anode = part.props[b.commonProp] === 'anode';
      b.digits.forEach((dig, d) => {
        for (const s of b.segments) {
          const [a, k] = anode ? [n(dig), n(s)] : [n(s), n(dig)];
          meters[d][s].set(ledLevel(ctx, a, k, 1.8, `7-segment ${part.id}`), cycles);
        }
      });
    },
    frame(dt, cycles) {
      part.group.userData.setDigits(meters.map((m) => Object.fromEntries(b.segments.map((s) => [s, m[s].take(cycles)]))));
    },
    stop() {
      part.group.userData.setDigits([]);
    },
  };
}
