import { Meter } from './meter.js';
import { FREQ } from './avr.js';
import { click } from './audio.js';
import { powered, ledLevel } from './device-utils.js';

// Perangkat simulasi tambahan (lihat devices.js untuk format umumnya).

// ---------------------------------------------------------------- LED RGB
export function rgbLedDevice(part, ctx, n) {
  const b = part.spec.behavior;
  const channels = [
    [n(b.red), 2.0],
    [n(b.green), 3.0],
    [n(b.blue), 3.0],
  ];
  const meters = channels.map(() => new Meter());
  for (const [node] of channels) ctx.consumer(node);
  ctx.consumer(n(b.cathode));
  return {
    afterSolve(cycles) {
      channels.forEach(([node, vf], i) => meters[i].set(ledLevel(ctx, node, n(b.cathode), vf, `LED RGB ${part.id}`), cycles));
    },
    frame(dt, cycles) {
      const [r, g, bl] = meters.map((m) => m.take(cycles) * 255);
      part.group.userData.setRGB(r, g, bl);
    },
    stop() {
      part.group.userData.setRGB(0, 0, 0);
    },
  };
}

// ---------------------------------------------------------------- LDR
export function ldrDevice(part, ctx, n) {
  const b = part.spec.behavior;
  // GL5528: ± 10 kΩ pada 10 lux; makin terang makin kecil
  ctx.resistor(n(b.a), n(b.b), () => 10000 * Math.pow(10 / Math.max(0.5, part.props[b.luxProp]), 0.8));
  part.onPropsChange = () => ctx.changed();
  return {
    stop() {
      part.onPropsChange = null;
    },
  };
}

// ---------------------------------------------------------------- modul LED (resistor bawaan)
export function indicatorDevice(part, ctx, n) {
  const b = part.spec.behavior;
  const meters = b.outputs.map(() => new Meter());
  for (const id of b.outputs) ctx.consumer(n(id));
  return {
    afterSolve(cycles) {
      const g = ctx.volts(n(b.gnd));
      b.outputs.forEach((id, i) => {
        const v = ctx.volts(n(id));
        meters[i].set(v !== null && g !== null && v - g > 2 ? 1 : 0, cycles);
      });
    },
    frame(dt, cycles) {
      b.set(
        part.group,
        meters.map((m) => m.take(cycles))
      );
    },
    stop() {
      b.set(
        part.group,
        b.outputs.map(() => 0)
      );
    },
  };
}

// ---------------------------------------------------------------- 7-segment
export function seg7Device(part, ctx, n) {
  const b = part.spec.behavior;
  const meters = Object.fromEntries(b.segments.map((s) => [s, new Meter()]));
  for (const s of b.segments) ctx.consumer(n(s));
  return {
    afterSolve(cycles) {
      for (const s of b.segments) meters[s].set(ledLevel(ctx, n(s), n(b.common), 1.8, `7-segment ${part.id}`), cycles);
    },
    frame(dt, cycles) {
      part.group.userData.setSegments(Object.fromEntries(b.segments.map((s) => [s, meters[s].take(cycles)])));
    },
    stop() {
      part.group.userData.setSegments({});
    },
  };
}

// ---------------------------------------------------------------- transistor NPN
export function npnDevice(part, ctx, n) {
  const b = part.spec.behavior;
  ctx.switch(n(b.collector), n(b.emitter), () => {
    const vb = ctx.volts(n(b.base));
    const ve = ctx.volts(n(b.emitter)) ?? 0;
    return vb !== null && vb - ve > b.vbe;
  });
  ctx.consumer(n(b.base));
  return null;
}

// ---------------------------------------------------------------- motor DC
export function motorDevice(part, ctx, n) {
  const b = part.spec.behavior;
  const meter = new Meter();
  ctx.consumer(n(b.plus));
  ctx.consumer(n(b.minus));
  return {
    afterSolve(cycles) {
      const p = ctx.volts(n(b.plus));
      const m = ctx.volts(n(b.minus));
      meter.set(p === null || m === null ? 0 : Math.max(-1, Math.min(1, (p - m) / 5)), cycles);
    },
    frame(dt, cycles) {
      part.group.userData.setSpeed(meter.take(cycles) * 255);
      part.group.userData.tick(dt);
    },
    stop() {
      part.group.userData.setSpeed(0);
    },
  };
}

// ---------------------------------------------------------------- relay
export function relayDevice(part, ctx, n) {
  const b = part.spec.behavior;
  let on = false;
  ctx.consumer(n(b.signal));
  return {
    afterSolve() {
      const v = ctx.volts(n(b.signal));
      const next = powered(ctx, n(b.vcc), n(b.gnd)) && v !== null && v > 2.5;
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

// ---------------------------------------------------------------- joystick
export function joystickDevice(part, ctx, n) {
  const b = part.spec.behavior;
  const ud = part.group.userData;
  const pos = (i) => (Math.max(-1, Math.min(1, ud.xy[i])) + 1) / 2;
  for (const [axis, i] of [
    [b.x, 0],
    [b.y, 1],
  ]) {
    ctx.resistor(n(b.vcc), n(axis), () => Math.max(1, b.ohms * (1 - pos(i))));
    ctx.resistor(n(axis), n(b.gnd), () => Math.max(1, b.ohms * pos(i)));
  }
  ctx.switch(n(b.sw), n(b.gnd), () => !!ud.pressed);
  let last = '';
  return {
    frame(dt) {
      ud.tick(dt);
      const key = `${ud.xy[0].toFixed(3)},${ud.xy[1].toFixed(3)},${ud.pressed}`;
      if (key !== last) {
        last = key;
        ctx.changed();
      }
    },
  };
}

// ---------------------------------------------------------------- keypad
export function keypadDevice(part, ctx, n) {
  const b = part.spec.behavior;
  const ud = part.group.userData;
  b.rows.forEach((row, r) =>
    b.cols.forEach((col, c) => {
      const key = b.layout[r][c];
      ctx.switch(n(row), n(col), () => ud.current === key);
    })
  );
  const press = ud.press;
  ud.press = (down, point) => {
    press(down, point);
    ctx.changed();
  };
  return {
    stop() {
      ud.press = press;
    },
  };
}

// ---------------------------------------------------------------- 74HC595
export function hc595Device(part, ctx, n) {
  const b = part.spec.behavior;
  let shift = 0;
  let latch = 0;
  const on = () => powered(ctx, n(b.vcc), n(b.gnd));
  const enabled = () => {
    const v = ctx.volts(n(b.oe));
    return v === null || v < 2.5; // OE aktif LOW (mengambang dianggap aktif)
  };
  b.outputs.forEach((id, i) => ctx.drive(n(id), () => (on() && enabled() ? ((latch >> i) & 1 ? 5 : 0) : null)));
  ctx.drive(n(b.chain), () => (on() ? ((shift >> 7) & 1 ? 5 : 0) : null));
  ctx.watch(n(b.shift), (high) => {
    if (!high) return;
    const mr = ctx.volts(n(b.mr));
    if (mr !== null && mr < 2.5) shift = 0;
    else shift = ((shift << 1) | (ctx.digital(n(b.data)) ? 1 : 0)) & 0xff;
    ctx.markDirty(); // Q7' berubah
  });
  ctx.watch(n(b.latch), (high) => {
    if (!high) return;
    latch = shift;
    ctx.changed();
  });
  return null;
}

// ---------------------------------------------------------------- NeoPixel (WS2812)
export function ws2812Device(part, ctx, n) {
  const b = part.spec.behavior;
  const count = b.countProp ? part.props[b.countProp] : b.count;
  const RESET = FREQ * 50e-6; // jeda ≥ 50 µs = akhir data
  let rise = 0;
  let fall = 0;
  let bits = [];
  let pixels = [];
  const latch = () => {
    const out = [];
    for (let i = 0; i + 24 <= bits.length && out.length < count; i += 24) {
      const byte = (k) => bits.slice(i + k * 8, i + k * 8 + 8).reduce((a, v) => (a << 1) | v, 0);
      out.push([byte(1), byte(0), byte(2)]); // urutan kabel: G, R, B
    }
    if (out.length) pixels = out;
    bits = [];
  };
  ctx.watch(n(b.din), (high, cycles) => {
    if (high) {
      if (bits.length && cycles - fall > RESET) latch();
      rise = cycles;
    } else {
      bits.push(cycles - rise > 9 ? 1 : 0); // T1H ± 0,8 µs (13 siklus), T0H ± 0,4 µs (6 siklus)
      fall = cycles;
    }
  });
  return {
    frame(dt, cycles) {
      if (bits.length && cycles - fall > RESET) latch();
      part.group.userData.setPixels(powered(ctx, n(b.vcc), n(b.gnd)) ? pixels : null);
    },
    stop() {
      part.group.userData.setPixels(null);
    },
  };
}

// ---------------------------------------------------------------- DHT11
export function dhtDevice(part, ctx, n) {
  const b = part.spec.behavior;
  const us = (t) => FREQ * t * 1e-6;
  let pulling = false;
  let responding = false;
  let lowSince = null;
  ctx.resistor(n(b.data), n(b.vcc), () => 10000); // pull-up di modul
  ctx.drive(n(b.data), () => (pulling ? 0 : null));
  const set = (v) => {
    pulling = v;
    ctx.changed();
  };
  function respond() {
    responding = true;
    let bytes;
    if (b.format === 'dht22') {
      // DHT22: nilai ×10 dalam 16 bit; bit tertinggi suhu = tanda minus
      const hum = Math.round(part.props[b.humProp] * 10);
      const t = Math.round(part.props[b.tempProp] * 10);
      const temp = t < 0 ? 0x8000 | -t : t;
      bytes = [hum >> 8, hum & 0xff, temp >> 8, temp & 0xff];
    } else {
      bytes = [Math.round(part.props[b.humProp]), 0, Math.round(part.props[b.tempProp]), 0];
    }
    bytes.push(bytes.reduce((a, v) => a + v, 0) & 0xff);
    // [lama, tarik LOW?]: tanggapan 80 µs LOW + 80 µs HIGH, lalu 40 bit (50 µs LOW + 26/70 µs HIGH)
    const steps = [
      [us(80), true],
      [us(80), false],
    ];
    for (const byte of bytes) {
      for (let i = 7; i >= 0; i--) steps.push([us(50), true], [us((byte >> i) & 1 ? 70 : 26), false]);
    }
    steps.push([us(50), true]);
    let k = 0;
    const next = () => {
      if (k >= steps.length) {
        set(false);
        responding = false;
        return;
      }
      const [dur, low] = steps[k++];
      set(low);
      ctx.schedule(dur, next);
    };
    ctx.schedule(us(30), next);
  }
  ctx.watch(n(b.data), (high, cycles) => {
    if (responding || !powered(ctx, n(b.vcc), n(b.gnd))) return;
    if (!high) lowSince = cycles;
    else if (lowSince !== null && cycles - lowSince > us(800)) {
      lowSince = null;
      respond();
    }
  });
  return null;
}

// ---------------------------------------------------------------- RTC DS3231 (I²C)
export function rtcDevice(part, ctx, n) {
  const b = part.spec.behavior;
  const bcd = (v) => ((Math.floor(v / 10) << 4) | v % 10) & 0xff;
  const unbcd = (v) => (v >> 4) * 10 + (v & 0x0f);
  let offset = 0; // ms: selisih jam RTC terhadap jam komputer
  const ds1307 = b.chip === 'ds1307';
  const regs = new Uint8Array(ds1307 ? 0x40 : 0x13); // DS1307: 8 register + 56 byte RAM
  let ptr = 0;
  let first = false;
  let written = false;
  const snapshot = () => {
    const d = new Date(Date.now() + offset);
    regs[0] = bcd(d.getSeconds());
    regs[1] = bcd(d.getMinutes());
    regs[2] = bcd(d.getHours());
    regs[3] = d.getDay() + 1;
    regs[4] = bcd(d.getDate());
    regs[5] = bcd(d.getMonth() + 1);
    regs[6] = bcd(d.getFullYear() % 100);
    if (ds1307) return;
    regs[0x11] = 27; // suhu 27,25 °C
    regs[0x12] = 0x40;
  };
  const device = {
    address: b.address,
    start(write) {
      first = write;
      if (!write) snapshot();
    },
    write(v) {
      if (first) {
        ptr = v;
        first = false;
        snapshot();
      } else {
        if (ptr < 7) written = true;
        regs[ptr++ % regs.length] = v;
      }
      return true;
    },
    read() {
      return regs[ptr++ % regs.length];
    },
    stop() {
      if (!written) return;
      written = false;
      // jam diatur lewat rtc.adjust(): simpan selisihnya
      const t = new Date(2000 + unbcd(regs[6]), unbcd(regs[5] & 0x1f) - 1, unbcd(regs[4]), unbcd(regs[2] & 0x3f), unbcd(regs[1]), unbcd(regs[0] & 0x7f));
      offset = t.getTime() - Date.now();
    },
  };
  return {
    attach(runner) {
      const sda = ctx.mcuPinOf(n(b.sda));
      const scl = ctx.mcuPinOf(n(b.scl));
      if (sda === 'A4' && scl === 'A5') runner.i2c.devices.set(b.address, device); // pin I²C yang salah ditandai panduan kabel (sim/wiring/check.js)
    },
  };
}

// ---------------------------------------------------------------- rotary encoder
export function encoderDevice(part, ctx, n) {
  const b = part.spec.behavior;
  const ud = part.group.userData;
  const STEP = (Math.PI * 2) / b.detents;
  let clk = true;
  let dt = true;
  let angle = 0;
  let emitted = 0; // jumlah klik yang sudah dikirim
  let busy = false;
  const on = () => powered(ctx, n(b.vcc), n(b.gnd));
  ctx.drive(n(b.clk), () => (on() ? (clk ? 5 : 0) : null));
  ctx.drive(n(b.dt), () => (on() ? (dt ? 5 : 0) : null));
  const gap = FREQ * 1.5e-3;
  function pump() {
    const target = Math.round(angle / STEP);
    if (busy || target === emitted) return;
    busy = true;
    const cw = target > emitted;
    // searah jarum jam: CLK turun lebih dulu selagi DT masih HIGH
    const seq = cw
      ? [() => (clk = false), () => (dt = false), () => (clk = true), () => (dt = true)]
      : [() => (dt = false), () => (clk = false), () => (dt = true), () => (clk = true)];
    let i = 0;
    const next = () => {
      seq[i++]();
      ctx.changed();
      if (i < seq.length) ctx.schedule(gap, next);
      else {
        emitted += cw ? 1 : -1;
        busy = false;
        pump();
      }
    };
    next();
  }
  return {
    attach() {
      ud.knob = {
        get: () => (angle / STEP) * 12,
        set: (v) => {
          angle = (v / 12) * STEP;
          ud.setAngle(Math.round(angle / STEP) * STEP);
          pump();
        },
        min: -1e6,
        max: 1e6,
        speed: 1,
      };
    },
    stop() {
      delete ud.knob;
    },
  };
}

// ---------------------------------------------------------------- stepper + ULN2003
export function stepperDevice(part, ctx, n) {
  const b = part.spec.behavior;
  const ud = part.group.userData;
  const HALF = [0b0001, 0b0011, 0b0010, 0b0110, 0b0100, 0b1100, 0b1000, 0b1001];
  const bits = [0, 0, 0, 0];
  let last = -1;
  let half = 0;
  b.inputs.forEach((id, i) =>
    ctx.watch(n(id), (high) => {
      bits[i] = high ? 1 : 0;
      const mask = bits.reduce((a, v, k) => a | (v << k), 0);
      const idx = HALF.indexOf(mask);
      if (idx < 0) return;
      if (last >= 0) {
        const d = ((idx - last + 12) % 8) - 4;
        if (d !== -4) half += d;
      }
      last = idx;
    })
  );
  return {
    frame() {
      const on = powered(ctx, n(b.vcc), n(b.gnd));
      ud.setPhase(on ? bits.reduce((a, v, k) => a | (v << k), 0) : 0);
      ud.setAngle((half / (b.stepsPerRev * 2)) * 360);
    },
    stop() {
      ud.setPhase(0);
    },
  };
}
