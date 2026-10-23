import { FREQ } from './avr.js';
import { powered } from './device-utils.js';

// Perangkat simulasi gelombang 2: layar grafis, bus SPI/I²C/OneWire, IR, RFID, dll.

const us = (t) => FREQ * t * 1e-6;

/** Pasang perangkat I²C ke bus emulator bila SDA/SCL tersambung ke A4/A5. */
export function i2cAttach(ctx, n, b, part, device, label) {
  return (runner) => {
    const sda = ctx.mcuPinOf(n(b.sda));
    const scl = ctx.mcuPinOf(n(b.scl));
    if (sda !== 'A4' || scl !== 'A5') {
      ctx.warn(`i2c-${part.id}`, `${label} ${part.id}: sambungkan SDA ke A4/SDA dan SCL ke A5/SCL.`);
      return;
    }
    if (runner.i2c.devices.has(device.address)) {
      ctx.warn(`i2c-dup-${device.address}`, `Dua perangkat I²C memakai alamat 0x${device.address.toString(16)} — salah satunya tidak akan menjawab.`);
    }
    runner.i2c.devices.set(device.address, device);
  };
}

/**
 * Penerima SPI: bit-bang (setiap tepi naik SCK selama CS LOW) dan SPI perangkat keras
 * (bila SCK = D13 dan MOSI = D11). onByte(byte) boleh mengembalikan byte balasan (MISO).
 */
export function spiSlave(ctx, n, { sck, mosi, cs, onByte, onSelect }) {
  let bits = 0;
  let count = 0;
  const selected = () => (cs ? !ctx.digital(n(cs)) : true);
  ctx.watch(n(sck), (high) => {
    if (!high || !selected()) return;
    bits = ((bits << 1) | (ctx.digital(n(mosi)) ? 1 : 0)) & 0xff;
    if (++count === 8) {
      count = 0;
      onByte(bits);
    }
  });
  if (cs) {
    ctx.watch(n(cs), (high) => {
      count = 0;
      bits = 0;
      onSelect?.(!high);
    });
  }
  return {
    hardware: false,
    attach(runner) {
      if (ctx.mcuPinOf(n(sck)) === 'D13' && ctx.mcuPinOf(n(mosi)) === 'D11') {
        this.hardware = true;
        runner.spi.devices.push({ selected, transfer: (v) => onByte(v) });
      }
    },
  };
}

// ---------------------------------------------------------------- OLED SSD1306 / SH1107 (I²C)
const OLED_ARGS = {
  ssd1306: { 0x81: 1, 0x20: 1, 0x21: 2, 0x22: 2, 0xa8: 1, 0xd3: 1, 0xd5: 1, 0xd9: 1, 0xda: 1, 0xdb: 1, 0x8d: 1, 0x26: 6, 0x27: 6, 0x29: 5, 0x2a: 5, 0xa3: 2 },
  sh1107: { 0x81: 1, 0xa8: 1, 0xd3: 1, 0xd5: 1, 0xd9: 1, 0xda: 1, 0xdb: 1, 0xdc: 1, 0xad: 1 },
};

export function oledDevice(part, ctx, n) {
  const b = part.spec.behavior;
  const ud = part.group.userData;
  const { cols, rows } = b;
  const pages = rows / 8;
  const sh = b.controller === 'sh1107';
  const ram = new Uint8Array(cols * pages);
  const pixels = new Uint8Array(cols * rows);
  const st = { on: false, invert: false, allOn: false, mode: sh ? 2 : 2, col: 0, page: 0, c0: 0, c1: cols - 1, p0: 0, p1: pages - 1, segRemap: false, comDec: false, contrast: 0x7f };
  let control = true; // byte berikutnya = byte kontrol
  let single = false;
  let isData = false;
  let cmd = [];
  let need = 0;
  let dirty = true;

  function command(bytes) {
    const [c, a, a2] = bytes;
    if (c === 0xae) st.on = false;
    else if (c === 0xaf) st.on = true;
    else if (c === 0xa6) st.invert = false;
    else if (c === 0xa7) st.invert = true;
    else if (c === 0xa4) st.allOn = false;
    else if (c === 0xa5) st.allOn = true;
    else if (c === 0xa0) st.segRemap = false;
    else if (c === 0xa1) st.segRemap = true;
    else if (c === 0xc0) st.comDec = false;
    else if (c === 0xc8) st.comDec = true;
    else if (c === 0x81) st.contrast = a;
    else if (!sh && c === 0x20) st.mode = a & 3;
    else if (!sh && c === 0x21) {
      st.c0 = a & 0x7f;
      st.c1 = a2 & 0x7f;
      st.col = st.c0;
    } else if (!sh && c === 0x22) {
      st.p0 = a & 7;
      st.p1 = a2 & 7;
      st.page = st.p0;
    } else if (c >= 0xb0 && c <= (sh ? 0xbf : 0xb7)) st.page = (c & 0x0f) % pages;
    else if (c <= 0x0f) st.col = (st.col & 0xf0) | c;
    else if (c >= 0x10 && c <= (sh ? 0x1f : 0x17)) st.col = ((c & 0x07) << 4) | (st.col & 0x0f); // alamat kolom 7 bit
    dirty = true;
  }

  function data(v) {
    if (st.col < cols) ram[st.page * cols + st.col] = v;
    dirty = true;
    if (st.mode === 0) {
      if (++st.col > st.c1) {
        st.col = st.c0;
        if (++st.page > st.p1) st.page = st.p0;
      }
    } else if (st.mode === 1) {
      if (++st.page > st.p1) {
        st.page = st.p0;
        if (++st.col > st.c1) st.col = st.c0;
      }
    } else st.col = sh ? (st.col + 1) % cols : st.col + 1 > st.c1 ? st.c0 : st.col + 1; // mode halaman: kolom berputar
  }

  const device = {
    address: part.props[b.addressProp],
    start() {
      control = true;
    },
    write(v) {
      if (!powered(ctx, n(b.vcc), n(b.gnd))) return false;
      if (control) {
        single = !!(v & 0x80);
        isData = !!(v & 0x40);
        control = false;
        return true;
      }
      if (isData) data(v);
      else {
        if (need === 0) {
          cmd = [v];
          need = OLED_ARGS[b.controller][v] ?? 0;
        } else {
          cmd.push(v);
          need--;
        }
        if (need === 0) command(cmd);
      }
      if (single) control = true;
      return true;
    },
    read() {
      return st.on ? 0x00 : 0x40;
    },
  };

  function render() {
    // SSD1306 standar (A1 + C8) tampil apa adanya; tanpa itu dicerminkan
    const flipX = !sh && !st.segRemap;
    const flipY = !sh && !st.comDec;
    // modul SH1107 128×128: kolom memori 96 = tepi kiri layar (sama seperti offset bawaan U8g2)
    const shift = sh && cols === 128 && rows === 128 ? 96 : 0;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const sx = flipX ? cols - 1 - x : (x + shift) % cols;
        const sy = flipY ? rows - 1 - y : y;
        pixels[y * cols + x] = st.allOn ? 1 : (ram[(sy >> 3) * cols + sx] >> (sy & 7)) & 1;
      }
    }
  }

  return {
    attach: i2cAttach(ctx, n, b, part, device, 'OLED'),
    frame() {
      const on = powered(ctx, n(b.vcc), n(b.gnd)) && st.on;
      if (!on) return ud.draw(null);
      if (dirty) render();
      dirty = false;
      ud.draw(pixels, { invert: st.invert, dim: 0.45 + (st.contrast / 255) * 0.55 });
    },
    stop() {
      ud.draw(null);
    },
  };
}

// ---------------------------------------------------------------- Nokia 5110 (PCD8544, SPI)
export function pcd8544Device(part, ctx, n) {
  const b = part.spec.behavior;
  const ud = part.group.userData;
  const W = 84;
  const ram = new Uint8Array(W * 6);
  const pixels = new Uint8Array(W * 48);
  const st = { x: 0, y: 0, h: false, vertical: false, pd: true, mode: 0 }; // mode: 0 kosong, 1 semua nyala, 2 normal, 3 terbalik
  let dirty = true;
  const reset = () => {
    ram.fill(0);
    Object.assign(st, { x: 0, y: 0, h: false, vertical: false, pd: true, mode: 0 });
    dirty = true;
  };
  const onByte = (v) => {
    if (!powered(ctx, n(b.vcc), n(b.gnd)) || !ctx.digital(n(b.rst))) return;
    if (ctx.digital(n(b.dc))) {
      ram[st.y * W + st.x] = v;
      if (st.vertical) {
        if (++st.y >= 6) (st.y = 0), (st.x = (st.x + 1) % W);
      } else if (++st.x >= W) (st.x = 0), (st.y = (st.y + 1) % 6);
    } else if ((v & 0xf8) === 0x20) {
      st.pd = !!(v & 4);
      st.vertical = !!(v & 2);
      st.h = !!(v & 1);
    } else if (!st.h) {
      if ((v & 0xf8) === 0x08) st.mode = ((v >> 1) & 2) | (v & 1);
      else if ((v & 0xf8) === 0x40) st.y = (v & 7) % 6;
      else if (v & 0x80) st.x = (v & 0x7f) % W;
    }
    dirty = true;
  };
  const spi = spiSlave(ctx, n, { sck: b.clk, mosi: b.din, cs: b.ce, onByte });
  ctx.watch(n(b.rst), (high) => {
    if (!high) reset();
  });
  return {
    attach(runner) {
      spi.attach(runner);
    },
    frame() {
      const on = powered(ctx, n(b.vcc), n(b.gnd)) && !st.pd;
      const bl = ctx.volts(n(b.bl));
      ud.setBacklight(powered(ctx, n(b.vcc), n(b.gnd)) && bl !== null && bl > 2.5);
      if (!on || st.mode === 0) return ud.draw(on ? new Uint8Array(W * 48) : null);
      if (dirty) {
        for (let y = 0; y < 48; y++) for (let x = 0; x < W; x++) pixels[y * W + x] = st.mode === 1 ? 1 : (ram[(y >> 3) * W + x] >> (y & 7)) & 1;
        dirty = false;
      }
      ud.draw(pixels, { invert: st.mode === 3 });
    },
    stop() {
      ud.draw(null);
      ud.setBacklight(false);
    },
  };
}

// ---------------------------------------------------------------- TM1637 (2 kabel)
export function tm1637Device(part, ctx, n) {
  const b = part.spec.behavior;
  const ud = part.group.userData;
  const CLK = n(b.clk);
  const DIO = n(b.dio);
  const digits = [0, 0, 0, 0, 0, 0];
  const st = { on: false, level: 0, addr: 0, auto: true };
  let active = false;
  let bit = 0;
  let byte = 0;
  let bytes = [];
  let ack = false;
  const on = () => powered(ctx, n(b.vcc), n(b.gnd));
  // pull-up 10 kΩ di modul (library hanya menarik LOW / melepas)
  ctx.resistor(CLK, n(b.vcc), () => 10000);
  ctx.resistor(DIO, n(b.vcc), () => 10000);
  ctx.drive(DIO, () => (ack ? 0 : null));

  function finish() {
    if (!bytes.length) return;
    const [first, ...rest] = bytes;
    const kind = first & 0xc0;
    if (kind === 0x40) st.auto = !(first & 0x04);
    else if (kind === 0x80) {
      st.on = !!(first & 0x08);
      st.level = first & 0x07;
    } else if (kind === 0xc0) {
      st.addr = first & 0x07;
      for (const v of rest) {
        if (st.addr < digits.length) digits[st.addr] = v;
        if (st.auto) st.addr++;
      }
    }
    bytes = [];
  }

  ctx.watch(DIO, (high) => {
    if (ack || !on() || !ctx.digital(CLK)) return;
    if (!high) {
      active = true; // START: DIO turun saat CLK HIGH
      bit = 0;
      byte = 0;
      bytes = [];
    } else if (active) {
      active = false; // STOP: DIO naik saat CLK HIGH
      finish();
    }
  });
  ctx.watch(CLK, (high) => {
    if (!active) return;
    if (high) {
      if (bit < 8) {
        if (ctx.digital(DIO)) byte |= 1 << bit;
        bit++;
      }
      return;
    }
    // CLK turun
    if (bit === 8 && !ack) {
      ack = true; // ACK selama detak ke-9
      ctx.changed();
    } else if (ack) {
      ack = false;
      bytes.push(byte);
      bit = 0;
      byte = 0;
      ctx.changed();
    }
  });
  return {
    frame() {
      ud.setDigits(on() && st.on ? digits.slice(0, 4) : null, (st.level + 1) / 8);
    },
    stop() {
      ud.setDigits(null);
    },
  };
}

// ---------------------------------------------------------------- MAX7219 (berantai)
export function max7219Device(part, ctx, n) {
  const b = part.spec.behavior;
  const ud = part.group.userData;
  const count = b.countProp ? part.props[b.countProp] : 1;
  const mods = Array.from({ length: count }, () => ({ rows: new Array(8).fill(0), on: false, test: false, level: 7, limit: 7 }));
  let stream = [];
  const onByte = (v) => {
    stream.push(v);
    if (stream.length > count * 2) stream.shift();
  };
  const spi = spiSlave(ctx, n, { sck: b.clk, mosi: b.din, cs: b.cs, onByte });
  ctx.watch(n(b.cs), (high) => {
    if (!high || !powered(ctx, n(b.vcc), n(b.gnd))) {
      if (!high) stream = [];
      return;
    }
    // byte terakhir yang dikirim ada di modul 0 (paling dekat DIN)
    const frames = Math.floor(stream.length / 2);
    for (let k = 0; k < frames; k++) {
      const m = mods[frames - 1 - k];
      if (!m) continue;
      const reg = stream[k * 2] & 0x0f;
      const val = stream[k * 2 + 1];
      if (reg >= 1 && reg <= 8) m.rows[reg - 1] = val;
      else if (reg === 0x0a) m.level = val & 0x0f;
      else if (reg === 0x0b) m.limit = val & 7;
      else if (reg === 0x0c) m.on = !!(val & 1);
      else if (reg === 0x0f) m.test = !!(val & 1);
    }
    stream = [];
  });
  return {
    attach(runner) {
      spi.attach(runner);
    },
    frame() {
      const p = powered(ctx, n(b.vcc), n(b.gnd));
      mods.forEach((m, i) => {
        const rows = !p ? null : m.test ? new Array(8).fill(0xff) : m.on ? m.rows.map((r, k) => (k <= m.limit ? r : 0)) : null;
        ud.setRows(i, rows, (m.level + 1) / 16);
      });
    },
    stop() {
      mods.forEach((m, i) => ud.setRows(i, null));
    },
  };
}

// ---------------------------------------------------------------- logic analyzer
export function logicAnalyzerDevice(part, ctx, n) {
  const b = part.spec.behavior;
  const ud = part.group.userData;
  const traces = b.inputs.map(() => ({ edges: [], level: false }));
  b.inputs.forEach((id, i) =>
    ctx.watch(n(id), (high, cycles) => {
      const t = traces[i];
      t.level = high;
      t.edges.push([cycles, high]);
      if (t.edges.length > 4000) t.edges.splice(0, 1000);
    })
  );
  let last = 0;
  return {
    frame() {
      const now = ctx.now();
      if (performance.now() - last < 60) return;
      last = performance.now();
      const span = (part.props[b.windowProp] / 1000) * FREQ;
      const t0 = now - span;
      ud.drawTraces((c, w, h) => {
        c.fillStyle = '#0d1117';
        c.fillRect(0, 0, w, h);
        const L = 46;
        const lane = (h - 30) / 8;
        c.strokeStyle = '#1f2733';
        c.lineWidth = 1;
        for (let k = 0; k <= 10; k++) {
          const x = L + ((w - L - 8) * k) / 10;
          c.beginPath();
          c.moveTo(x, 4);
          c.lineTo(x, h - 26);
          c.stroke();
        }
        c.font = '600 18px "IBM Plex Mono", monospace';
        traces.forEach((t, i) => {
          const y0 = 8 + i * lane;
          const hi = y0 + lane * 0.2;
          const lo = y0 + lane * 0.8;
          c.fillStyle = '#7d8aa3';
          c.fillText(b.inputs[i], 6, lo);
          c.strokeStyle = ['#3fe07a', '#ffd23a', '#4d8dff', '#ff7a59', '#c78bff', '#4fd6e0', '#ff5fa2', '#e8e3d6'][i];
          c.lineWidth = 2.5;
          c.beginPath();
          // tingkat di awal jendela
          let level = false;
          let k = t.edges.length - 1;
          while (k >= 0 && t.edges[k][0] > t0) k--;
          level = k >= 0 ? t.edges[k][1] : t.edges.length ? !t.edges[0][1] : false;
          const X = (cyc) => L + ((cyc - t0) / span) * (w - L - 8);
          c.moveTo(L, level ? hi : lo);
          for (let j = k + 1; j < t.edges.length; j++) {
            const [cyc, v] = t.edges[j];
            const x = X(cyc);
            c.lineTo(x, level ? hi : lo);
            c.lineTo(x, v ? hi : lo);
            level = v;
          }
          c.lineTo(w - 8, level ? hi : lo);
          c.stroke();
        });
        c.fillStyle = '#7d8aa3';
        const ms = part.props[b.windowProp];
        c.fillText(`${ms / 10 >= 1 ? ms / 10 + ' ms' : ms * 100 + ' µs'}/div`, L, h - 6);
      });
    },
  };
}

// ---------------------------------------------------------------- MPU6050 (I²C)
export function mpu6050Device(part, ctx, n) {
  const b = part.spec.behavior;
  const regs = new Uint8Array(128);
  const reset = () => {
    regs.fill(0);
    regs[0x6b] = 0x40; // tidur setelah reset
    regs[0x75] = 0x68; // WHO_AM_I
  };
  reset();
  let ptr = 0;
  let first = false;
  const put16 = (addr, v) => {
    const x = Math.max(-32768, Math.min(32767, Math.round(v))) & 0xffff;
    regs[addr] = x >> 8;
    regs[addr + 1] = x & 0xff;
  };
  const sample = () => {
    const p = part.props;
    const aScale = 16384 >> ((regs[0x1c] >> 3) & 3);
    const gScale = [131, 65.5, 32.8, 16.4][(regs[0x1b] >> 3) & 3];
    put16(0x3b, p.ax * aScale);
    put16(0x3d, p.ay * aScale);
    put16(0x3f, p.az * aScale);
    put16(0x41, (p.temp - 36.53) * 340);
    put16(0x43, p.gx * gScale);
    put16(0x45, p.gy * gScale);
    put16(0x47, p.gz * gScale);
  };
  const device = {
    address: 0x68,
    start(write) {
      first = write;
      if (!write) sample();
    },
    write(v) {
      if (!powered(ctx, n(b.vcc), n(b.gnd))) return false;
      if (first) {
        ptr = v & 0x7f;
        first = false;
        return true;
      }
      if (ptr === 0x6b && v & 0x80) {
        reset();
        regs[0x6b] = v & 0x7f & ~0x80;
      } else if (ptr !== 0x75) regs[ptr] = v;
      ptr = (ptr + 1) & 0x7f;
      return true;
    },
    read() {
      const v = regs[ptr];
      ptr = (ptr + 1) & 0x7f;
      return v;
    },
  };
  const attach = i2cAttach(ctx, n, b, part, device, 'MPU6050');
  return {
    attach(runner) {
      device.address = ctx.digital(n(b.ad0)) ? 0x69 : 0x68;
      attach(runner);
    },
  };
}

// ---------------------------------------------------------------- BMP180 (I²C)
const BMP_CAL = { AC1: 408, AC2: -72, AC3: -14383, AC4: 32741, AC5: 32757, AC6: 23153, B1: 6190, B2: 4, MB: -32768, MC: -8711, MD: 2868 };
const div = (a, d) => Math.trunc(a / d);
function bmpB5(ut) {
  const c = BMP_CAL;
  const x1 = div((ut - c.AC6) * c.AC5, 1 << 15);
  const x2 = div(c.MC * (1 << 11), x1 + c.MD);
  return x1 + x2;
}
function bmpPressure(up, b5, oss) {
  const c = BMP_CAL;
  const b6 = b5 - 4000;
  let x1 = div(c.B2 * div(b6 * b6, 1 << 12), 1 << 11);
  let x2 = div(c.AC2 * b6, 1 << 11);
  let x3 = x1 + x2;
  const b3 = div(((c.AC1 * 4 + x3) << oss) + 2, 4);
  x1 = div(c.AC3 * b6, 1 << 13);
  x2 = div(c.B1 * div(b6 * b6, 1 << 12), 1 << 16);
  x3 = div(x1 + x2 + 2, 4);
  const b4 = Math.floor((c.AC4 * ((x3 + 32768) >>> 0)) / (1 << 15));
  const b7 = ((up - b3) >>> 0) * (50000 >> oss);
  let p = b7 < 0x80000000 ? div(b7 * 2, b4) : div(b7, b4) * 2;
  x1 = div(p, 256) * div(p, 256);
  x1 = div(x1 * 3038, 1 << 16);
  x2 = div(-7357 * p, 1 << 16);
  p += div(x1 + x2 + 3791, 16);
  return p;
}
/** Cari nilai mentah terkecil yang menghasilkan target (fungsi naik monoton). */
function search(lo, hi, f, target) {
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (f(mid) < target) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}
export function bmp180Device(part, ctx, n) {
  const b = part.spec.behavior;
  const regs = new Uint8Array(256);
  regs[0xd0] = 0x55;
  Object.values(BMP_CAL).forEach((v, i) => {
    regs[0xaa + i * 2] = (v >> 8) & 0xff;
    regs[0xab + i * 2] = v & 0xff;
  });
  let ptr = 0;
  let first = false;
  const measure = (ctrl) => {
    const ut = search(0, 65535, (u) => (bmpB5(u) + 8) >> 4, Math.round(part.props.temp * 10));
    if (ctrl === 0x2e) {
      regs[0xf6] = ut >> 8;
      regs[0xf7] = ut & 0xff;
    } else if ((ctrl & 0x3f) === 0x34) {
      const oss = ctrl >> 6;
      const b5 = bmpB5(ut);
      const up = search(0, (1 << (16 + oss)) - 1, (u) => bmpPressure(u, b5, oss), Math.round(part.props.pressure * 100));
      const raw = up << (8 - oss);
      regs[0xf6] = (raw >> 16) & 0xff;
      regs[0xf7] = (raw >> 8) & 0xff;
      regs[0xf8] = raw & 0xff;
    }
  };
  const device = {
    address: b.address,
    start(write) {
      first = write;
    },
    write(v) {
      if (!powered(ctx, n(b.vcc), n(b.gnd))) return false;
      if (first) {
        ptr = v;
        first = false;
        return true;
      }
      if (ptr === 0xf4) measure(v);
      else if (ptr === 0xe0 && v === 0xb6) regs[0xf4] = 0;
      regs[ptr] = v;
      ptr = (ptr + 1) & 0xff;
      return true;
    },
    read() {
      const v = ptr === 0xf4 ? regs[0xf4] & ~0x20 : regs[ptr]; // bit "sedang mengukur" selalu 0
      ptr = (ptr + 1) & 0xff;
      return v;
    },
  };
  return { attach: i2cAttach(ctx, n, b, part, device, 'BMP180') };
}

// ---------------------------------------------------------------- DS18B20 (OneWire)
function crc8(bytes) {
  let crc = 0;
  for (let v of bytes) {
    for (let i = 0; i < 8; i++) {
      const mix = (crc ^ v) & 1;
      crc >>= 1;
      if (mix) crc ^= 0x8c;
      v >>= 1;
    }
  }
  return crc;
}

export function ds18b20Device(part, ctx, n) {
  const b = part.spec.behavior;
  const DQ = n(b.dq);
  const serial = [...part.id].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  const rom = [0x28, serial & 0xff, (serial >> 8) & 0xff, (serial >> 16) & 0xff, (serial >> 24) & 0xff, 0x01, 0x00];
  rom.push(crc8(rom));
  const scratch = { th: 0x4b, tl: 0x46, config: 0x7f }; // 12 bit
  let driving = false;
  let expect = null; // tepi yang disebabkan sendiri: 'fall' / 'rise'
  let fallAt = 0;
  let state = 'idle'; // idle | rom | func | search | write | send | convert | dead
  let rx = { bits: 0, n: 0, want: 8, done: null };
  let tx = [];
  let search64 = null;
  let convertUntil = 0;
  let readSlot = false; // slot baca sedang berlangsung (diakhiri tepi naik)
  const on = () => powered(ctx, n(b.vdd), n(b.gnd));

  ctx.resistor(DQ, n(b.vdd), () => 4700); // pull-up 4,7 kΩ (disimulasikan)
  ctx.drive(DQ, () => (driving ? 0 : null));

  const setDrive = (v, edge) => {
    driving = v;
    expect = edge;
    ctx.changed();
  };
  const receive = (want, done) => {
    state = 'recv';
    rx = { bits: 0, n: 0, want, done };
  };
  const sendBits = (bits, after) => {
    state = 'send';
    tx = bits;
    tx.after = after;
  };
  const bytesToBits = (bytes) => bytes.flatMap((v) => Array.from({ length: 8 }, (_, i) => (v >> i) & 1));

  const tempRaw = () => {
    const res = 9 + ((scratch.config >> 5) & 3);
    let raw = Math.round(part.props[b.tempProp] * 16);
    raw &= ~((1 << (12 - res)) - 1);
    return raw & 0xffff;
  };
  const scratchpad = () => {
    const t = tempRaw();
    const bytes = [t & 0xff, t >> 8, scratch.th, scratch.tl, scratch.config, 0xff, 0x0c, 0x10];
    bytes.push(crc8(bytes));
    return bytes;
  };

  function func(cmd) {
    if (cmd === 0x44) {
      const res = 9 + ((scratch.config >> 5) & 3);
      convertUntil = ctx.now() + FREQ * 0.09375 * (1 << (res - 9));
      state = 'convert';
    } else if (cmd === 0xbe) sendBits(bytesToBits(scratchpad()), 'idle');
    else if (cmd === 0x4e)
      receive(24, (v) => {
        scratch.th = v & 0xff;
        scratch.tl = (v >> 8) & 0xff;
        scratch.config = ((v >> 16) & 0x60) | 0x1f;
        state = 'idle';
      });
    else if (cmd === 0xb4) state = 'power';
    else state = 'idle';
  }
  function romCommand(cmd) {
    if (cmd === 0xcc) receive(8, func);
    else if (cmd === 0x33) sendBits(bytesToBits(rom), 'func');
    else if (cmd === 0x55)
      receive(64, (v, bits) => {
        const match = bytesToBits(rom).every((bit, i) => bit === bits[i]);
        if (match) receive(8, func);
        else state = 'dead';
      });
    else if (cmd === 0xf0) {
      search64 = { i: 0, phase: 0 };
      state = 'search';
    } else state = 'dead'; // 0xEC (alarm) dll.: diam
  }

  /** Slot baca dari master: kirim satu bit (0 = tahan LOW ± 30 µs). */
  function sendBit(bit) {
    readSlot = true;
    if (bit) return;
    setDrive(true, null);
    ctx.schedule(us(30), () => setDrive(false, null));
  }

  ctx.watch(DQ, (high, cycles) => {
    if (!on()) return;
    if (expect === (high ? 'rise' : 'fall')) {
      expect = null;
      return;
    }
    if (!high) {
      fallAt = cycles;
      // slot baca: perangkat harus bereaksi saat master menarik LOW
      if (state === 'send') sendBit(tx.shift());
      else if (state === 'search' && search64.phase < 2) {
        const bit = bytesToBits(rom)[search64.i];
        sendBit(search64.phase === 0 ? bit : 1 - bit);
      } else if (state === 'convert') sendBit(ctx.now() >= convertUntil ? 1 : 0);
      else if (state === 'power') sendBit(1);
      return;
    }
    const lowUs = ((cycles - fallAt) / FREQ) * 1e6;
    if (lowUs >= 400) {
      // reset → pulsa presence
      state = 'idle';
      readSlot = false;
      ctx.schedule(us(30), () => {
        setDrive(true, 'fall');
        ctx.schedule(us(120), () => {
          setDrive(false, 'rise');
          receive(8, romCommand);
        });
      });
      return;
    }
    if (readSlot) {
      readSlot = false;
      if (state === 'send' && !tx.length) {
        if (tx.after === 'func') receive(8, func);
        else state = tx.after;
      } else if (state === 'search') search64.phase++;
      return;
    }
    const bit = lowUs < 30 ? 1 : 0;
    if (state === 'recv') {
      rx.bits += bit * 2 ** rx.n;
      (rx.list ??= []).push(bit);
      if (++rx.n === rx.want) {
        const { done, bits, list } = rx;
        done(bits, list);
      }
    } else if (state === 'search' && search64.phase === 2) {
      const bits = bytesToBits(rom);
      if (bit !== bits[search64.i]) state = 'dead';
      else if (++search64.i === 64) receive(8, func);
      else search64.phase = 0;
    }
  });
  return null;
}

// ---------------------------------------------------------------- HX711
export function hx711Device(part, ctx, n) {
  const b = part.spec.behavior;
  let ready = true;
  let index = 0;
  let out = 1;
  const on = () => powered(ctx, n(b.vcc), n(b.gnd));
  const raw = () => {
    const v = Math.round(part.props[b.gramsProp] * b.scale);
    return Math.max(-0x800000, Math.min(0x7fffff, v)) & 0xffffff;
  };
  let value = raw();
  ctx.drive(n(b.dt), () => (!on() ? null : index === 0 ? (ready ? 0 : 5) : out ? 5 : 0));
  ctx.watch(n(b.sck), (high) => {
    if (!on()) return;
    if (high) {
      if (!ready) return;
      if (index === 0) value = raw();
      out = index < 24 ? (value >> (23 - index)) & 1 : 1;
      index++;
      ctx.markDirty();
    } else if (index >= 25) {
      // data habis: DT HIGH sampai konversi berikutnya (80 sampel/detik)
      index = 0;
      ready = false;
      ctx.markDirty();
      ctx.schedule(FREQ / 80, () => {
        ready = true;
        ctx.changed();
      });
    }
  });
  part.onPropsChange = () => ctx.changed();
  return {
    frame() {
      part.group.userData.setLoad(part.props[b.gramsProp] / 5000);
    },
    stop() {
      part.onPropsChange = null;
    },
  };
}

// ---------------------------------------------------------------- IR (remote → penerima)
const irReceivers = new Set();

export function irRemoteDevice(part) {
  const ud = part.group.userData;
  ud.onButton = (code) => {
    for (const r of irReceivers) r(code);
  };
  return {
    stop() {
      ud.onButton = null;
    },
  };
}

export function irReceiverDevice(part, ctx, n) {
  const b = part.spec.behavior;
  const ud = part.group.userData;
  let low = false;
  let busy = false;
  let blink = 0;
  ctx.drive(n(b.dat), () => (powered(ctx, n(b.vcc), n(b.gnd)) ? (low ? 0 : 5) : null));
  function send(code) {
    if (busy || !powered(ctx, n(b.vcc), n(b.gnd))) return;
    busy = true;
    blink = 0.25;
    const bytes = [0x00, 0xff, code & 0xff, ~code & 0xff];
    // NEC: 9 ms LOW, 4,5 ms HIGH, 32 bit (562 µs LOW + 562/1687 µs HIGH), 562 µs LOW penutup
    const steps = [
      [9000, true],
      [4500, false],
    ];
    for (const byte of bytes) for (let i = 0; i < 8; i++) steps.push([562, true], [(byte >> i) & 1 ? 1687 : 562, false]);
    steps.push([562, true]);
    let k = 0;
    const next = () => {
      if (k >= steps.length) {
        low = false;
        busy = false;
        ctx.changed();
        return;
      }
      const [t, l] = steps[k++];
      low = l;
      ctx.changed();
      ctx.schedule(us(t), next);
    };
    next();
  }
  return {
    attach() {
      irReceivers.add(send);
    },
    frame(dt) {
      blink = Math.max(0, blink - dt);
      ud.setActive(blink > 0);
    },
    stop() {
      irReceivers.delete(send);
      ud.setActive(false);
    },
  };
}

// ---------------------------------------------------------------- RFID MFRC522 (SPI)
function crcA(bytes) {
  let crc = 0x6363;
  for (let v of bytes) {
    v ^= crc & 0xff;
    v = (v ^ (v << 4)) & 0xff;
    crc = ((crc >> 8) ^ (v << 8) ^ (v << 3) ^ (v >> 4)) & 0xffff;
  }
  return [crc & 0xff, crc >> 8];
}

export function mfrc522Device(part, ctx, n) {
  const b = part.spec.behavior;
  const ud = part.group.userData;
  const regs = new Uint8Array(64);
  let fifo = [];
  let card = false;
  let picc = 'idle'; // idle | ready | active | halt
  const uid = () => part.props[b.uidProp].split(' ').map((h) => parseInt(h, 16));
  const reset = () => {
    regs.fill(0);
    regs[0x37] = 0x92; // VersionReg: MFRC522 v2.0
    regs[0x14] = 0x80;
    fifo = [];
  };
  reset();

  function picc_(data, bits) {
    if (!card) return null;
    const [c0, c1] = data;
    if (bits === 7 && (c0 === 0x26 || c0 === 0x52)) {
      if (picc === 'halt' && c0 === 0x26) return null;
      picc = 'ready';
      return [0x04, 0x00];
    }
    if (picc === 'idle' || picc === 'halt') return null;
    const id = uid();
    const bcc = id.reduce((a, v) => a ^ v, 0);
    if (c0 === 0x93 && c1 === 0x20) return [...id, bcc];
    if (c0 === 0x93 && c1 === 0x70) {
      picc = 'active';
      return [0x08, ...crcA([0x08])];
    }
    if (c0 === 0x50) {
      picc = 'halt';
      return null;
    }
    return null;
  }

  function transceive() {
    const bits = regs[0x0d] & 7;
    const data = fifo;
    fifo = [];
    const reply = picc_(data, bits);
    if (reply) {
      fifo = reply;
      regs[0x04] |= 0x30 | 0x40; // RxIRq, IdleIRq, TxIRq
      regs[0x06] = 0;
      regs[0x0c] &= ~7;
    } else regs[0x04] |= 0x01 | 0x40; // TimerIRq: tidak ada jawaban
  }

  function writeReg(r, v) {
    if (r === 0x01) {
      const cmd = v & 0x0f;
      if (cmd === 0x0f) return reset();
      regs[0x01] = v & ~0x10 & 0x3f;
      if (cmd === 0x03) {
        const [lo, hi] = crcA(fifo);
        regs[0x22] = lo;
        regs[0x21] = hi;
        regs[0x05] |= 0x04;
      }
    } else if (r === 0x04 || r === 0x05) {
      regs[r] = v & 0x80 ? regs[r] | (v & 0x7f) : regs[r] & ~(v & 0x7f);
    } else if (r === 0x09) fifo.push(v);
    else if (r === 0x0a) {
      if (v & 0x80) fifo = [];
    } else {
      regs[r] = v;
      if (r === 0x0d && v & 0x80 && (regs[0x01] & 0x0f) === 0x0c) {
        regs[0x0d] &= 0x7f;
        transceive();
      }
    }
  }
  function readReg(r) {
    if (r === 0x09) return fifo.shift() ?? 0;
    if (r === 0x0a) return fifo.length;
    return regs[r];
  }

  let addr = null;
  const onByte = (v) => {
    if (!powered(ctx, n(b.vcc), n(b.gnd))) return 0;
    let reply = 0;
    if (addr && addr.read) reply = readReg(addr.reg);
    if (addr === null || addr.read) addr = { reg: (v >> 1) & 0x3f, read: !!(v & 0x80) };
    else writeReg(addr.reg, v);
    return reply;
  };
  const spi = spiSlave(ctx, n, { sck: b.sck, mosi: b.mosi, cs: b.cs, onByte, onSelect: () => (addr = null) });
  return {
    attach(runner) {
      spi.attach(runner);
      if (!spi.hardware) ctx.warn(`rfid-${part.id}`, `RFID ${part.id}: sambungkan SCK ke D13, MOSI ke D11, MISO ke D12.`);
      else if (ctx.mcuPinOf(n(b.miso)) !== 'D12') ctx.warn(`rfid-miso-${part.id}`, `RFID ${part.id}: MISO harus ke D12.`);
      ud.press = (down) => {
        if (!down) return;
        card = !card;
        if (!card) picc = 'idle';
        ud.setCard(card);
      };
    },
    frame(dt) {
      ud.tick(dt);
    },
    stop() {
      delete ud.press;
      card = false;
      ud.setCard(false);
    },
  };
}
