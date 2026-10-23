import { t } from '../i18n/index.js';
import { FREQ } from './avr.js';
import { powered } from './device-utils.js';
import { spiSlave, i2cAttach } from './devices-wave2.js';

// Perangkat simulasi gelombang 3: TFT ILI9341 (+ sentuh FT6206), e-Paper SSD1680, kartu microSD.

/** Tingkat logika; mengambang dianggap `float`. */
const level = (ctx, node, float) => {
  const v = ctx.volts(node);
  return v === null ? float : v > 2.5;
};

// ---------------------------------------------------------------- TFT ILI9341
export function ili9341Device(part, ctx, n) {
  const b = part.spec.behavior;
  const ud = part.group.userData;
  const W = 240;
  const H = 320;
  const fb = new Uint8ClampedArray(W * H * 4);
  const st = {};
  let dirty = true;
  let cmd = 0;
  let args = [];
  let hi = null; // byte atas piksel RGB565 yang menunggu pasangannya
  const reset = () => {
    for (let i = 0; i < fb.length; i += 4) (fb[i] = 0), (fb[i + 1] = 0), (fb[i + 2] = 0), (fb[i + 3] = 255);
    Object.assign(st, { on: false, sleep: true, invert: false, madctl: 0, c0: 0, c1: W - 1, p0: 0, p1: H - 1, c: 0, p: 0 });
    dirty = true;
  };
  reset();

  function pixel(v) {
    const { c, p, madctl } = st;
    // MV menukar baris/kolom, MX/MY mencerminkan; panel ini terpasang terbalik di sumbu x
    let col = madctl & 0x20 ? p : c;
    let row = madctl & 0x20 ? c : p;
    if (madctl & 0x40) col = W - 1 - col;
    if (madctl & 0x80) row = H - 1 - row;
    const x = W - 1 - col;
    if (x >= 0 && x < W && row >= 0 && row < H) {
      let r = (v >> 11) & 0x1f;
      let bl = v & 0x1f;
      if (!(madctl & 0x08)) [r, bl] = [bl, r]; // tanpa bit BGR, merah & biru tertukar
      const i = (row * W + x) * 4;
      fb[i] = (r * 255) / 31;
      fb[i + 1] = (((v >> 5) & 0x3f) * 255) / 63;
      fb[i + 2] = (bl * 255) / 31;
      dirty = true;
    }
    if (++st.c > st.c1) {
      st.c = st.c0;
      if (++st.p > st.p1) st.p = st.p0;
    }
  }

  const onByte = (v) => {
    if (!powered(ctx, n(b.vcc), n(b.gnd)) || !level(ctx, n(b.rst), true)) return 0;
    if (!ctx.digital(n(b.dc))) {
      cmd = v;
      args = [];
      hi = null;
      if (v === 0x01) reset();
      else if (v === 0x11) st.sleep = false;
      else if (v === 0x10) st.sleep = true;
      else if (v === 0x29) st.on = true;
      else if (v === 0x28) st.on = false;
      else if (v === 0x20) st.invert = false;
      else if (v === 0x21) st.invert = true;
      else if (v === 0x2c) (st.c = st.c0), (st.p = st.p0);
      dirty = true;
      return 0;
    }
    if (cmd === 0x2c) {
      if (hi === null) hi = v;
      else {
        pixel((hi << 8) | v);
        hi = null;
      }
      return 0;
    }
    args.push(v);
    if (cmd === 0x2a && args.length === 4) {
      st.c0 = (args[0] << 8) | args[1];
      st.c1 = (args[2] << 8) | args[3];
      st.c = st.c0;
    } else if (cmd === 0x2b && args.length === 4) {
      st.p0 = (args[0] << 8) | args[1];
      st.p1 = (args[2] << 8) | args[3];
      st.p = st.p0;
    } else if (cmd === 0x36 && args.length === 1) st.madctl = v;
    return 0;
  };
  const spi = spiSlave(ctx, n, { sck: b.sck, mosi: b.mosi, cs: b.cs, onByte, onSelect: () => (hi = null) });
  ctx.watch(n(b.rst), (high) => {
    if (!high) reset();
  });

  // ---- layar sentuh FT6206 (I²C 0x38)
  let touch = null; // { x, y } dalam koordinat panel sentuh
  const touchRegs = new Uint8Array(256);
  touchRegs[0xa8] = 0x11; // vendor ID
  touchRegs[0xa3] = 0x06; // chip ID FT6206
  touchRegs[0x80] = 128; // ambang
  let ptr = 0;
  let first = false;
  const fillTouch = () => {
    touchRegs[0x02] = touch ? 1 : 0;
    const x = touch?.x ?? 0;
    const y = touch?.y ?? 0;
    touchRegs[0x03] = (touch ? 0x80 : 0x40) | ((x >> 8) & 0x0f);
    touchRegs[0x04] = x & 0xff;
    touchRegs[0x05] = (y >> 8) & 0x0f;
    touchRegs[0x06] = y & 0xff;
  };
  const touchDevice = {
    address: 0x38,
    start(write) {
      first = write;
      if (!write) fillTouch();
    },
    write(v) {
      if (!powered(ctx, n(b.vcc), n(b.gnd))) return false;
      if (first) {
        ptr = v;
        first = false;
        fillTouch();
      } else touchRegs[ptr++ & 0xff] = v;
      return true;
    },
    read() {
      return touchRegs[ptr++ & 0xff];
    },
  };
  const attachTouch = b.touch ? i2cAttach(ctx, n, b, part, touchDevice) : null;

  return {
    attach(runner) {
      spi.attach(runner); // pin SPI yang salah ditandai panduan kabel
      if (attachTouch) {
        attachTouch(runner);
        ud.press = (down, point) => {
          if (!down || !point) {
            touch = null;
            ud.setTouch?.(false);
            return;
          }
          const local = ud.screen.worldToLocal(point.clone());
          const u = Math.round((local.x / 43.2 + 0.5) * W);
          const v = Math.round((0.5 - local.y / 57.6) * H);
          if (u < 0 || u >= W || v < 0 || v >= H) return;
          // panel sentuh terpasang terbalik terhadap layar (lihat contoh Adafruit: map(p.x, 0, 240, 240, 0))
          touch = { x: W - 1 - u, y: H - 1 - v };
          ud.setTouch?.(true);
        };
      }
    },
    frame() {
      const on = powered(ctx, n(b.vcc), n(b.gnd)) && st.on && !st.sleep;
      const led = ctx.volts(n(b.led));
      const lit = led === null || led > 2.5; // lampu latar tidak disambung: anggap menyala
      if (!on || !lit) {
        if (dirty !== 'off') ud.draw(null, false);
        dirty = 'off';
        return;
      }
      if (!dirty) return;
      if (st.invert) {
        const inv = new Uint8ClampedArray(fb);
        for (let i = 0; i < inv.length; i += 4) (inv[i] = 255 - inv[i]), (inv[i + 1] = 255 - inv[i + 1]), (inv[i + 2] = 255 - inv[i + 2]);
        ud.draw(inv);
      } else ud.draw(fb);
      dirty = false;
    },
    stop() {
      ud.draw(null, false);
      delete ud.press;
      ud.setTouch?.(false);
    },
  };
}

// ---------------------------------------------------------------- e-Paper SSD1680
export function epaperDevice(part, ctx, n) {
  const b = part.spec.behavior;
  const ud = part.group.userData;
  const BYTES = b.cols / 8; // 16 byte per baris
  const ROWS = b.rows; // 296
  const ram = new Uint8Array(BYTES * ROWS).fill(0xff);
  const shown = new Uint8Array(ROWS * b.cols); // tekstur lanskap 296×128, 1 = tinta hitam
  const st = { xs: 0, xe: BYTES - 1, ys: 0, ye: ROWS - 1, xc: 0, yc: 0, mode: 3 };
  let busy = false;
  let cmd = 0;
  let args = [];
  let flash = 0;

  const on = () => powered(ctx, n(b.vcc), n(b.gnd));
  ctx.drive(n(b.busy), () => (on() ? (busy ? 5 : 0) : null));
  const setBusy = (ms) => {
    busy = true;
    ctx.changed();
    ctx.schedule(FREQ * ms * 1e-3, () => {
      busy = false;
      ctx.changed();
    });
  };
  const write = (v) => {
    if (cmd === 0x24) ram[st.yc * BYTES + st.xc] = v;
    const xInc = st.mode & 1 ? 1 : -1;
    const yInc = st.mode & 2 ? 1 : -1;
    const stepX = () => {
      st.xc += xInc;
      if (st.xc > Math.max(st.xs, st.xe) || st.xc < Math.min(st.xs, st.xe)) return (st.xc = st.xs), true;
      return false;
    };
    const stepY = () => {
      st.yc += yInc;
      if (st.yc > Math.max(st.ys, st.ye) || st.yc < Math.min(st.ys, st.ye)) return (st.yc = st.ys), true;
      return false;
    };
    if (st.mode & 4) {
      if (stepY()) stepX();
    } else if (stepX()) stepY();
  };
  const refresh = () => {
    // salin RAM ke layar: piksel (x, y) potret → tekstur lanskap (u = y, v = 127 − x)
    for (let y = 0; y < ROWS; y++) {
      for (let xb = 0; xb < BYTES; xb++) {
        const byte = ram[y * BYTES + xb];
        for (let k = 0; k < 8; k++) {
          const x = xb * 8 + k;
          shown[(b.cols - 1 - x) * ROWS + y] = (byte >> (7 - k)) & 1 ? 0 : 1;
        }
      }
    }
    flash = 0.35; // e-paper berkedip saat memperbarui
    setBusy(300);
  };
  const onByte = (v) => {
    if (!on() || !level(ctx, n(b.rst), true)) return 0;
    if (!ctx.digital(n(b.dc))) {
      cmd = v;
      args = [];
      if (v === 0x12) {
        Object.assign(st, { xs: 0, xe: BYTES - 1, ys: 0, ye: ROWS - 1, xc: 0, yc: 0, mode: 3 });
        setBusy(2);
      } else if (v === 0x20) refresh();
      return 0;
    }
    if (cmd === 0x24 || cmd === 0x26) {
      write(v);
      return 0;
    }
    args.push(v);
    if (cmd === 0x11) st.mode = v & 7;
    else if (cmd === 0x44 && args.length === 2) (st.xs = args[0] & 0x1f), (st.xe = args[1] & 0x1f);
    else if (cmd === 0x45 && args.length === 4) (st.ys = args[0] | ((args[1] & 1) << 8)), (st.ye = args[2] | ((args[3] & 1) << 8));
    else if (cmd === 0x4e) st.xc = v & 0x1f;
    else if (cmd === 0x4f && args.length === 2) st.yc = args[0] | ((args[1] & 1) << 8);
    return 0;
  };
  const spi = spiSlave(ctx, n, { sck: b.sck, mosi: b.mosi, cs: b.cs, onByte });
  ctx.watch(n(b.rst), (high) => {
    if (!high) busy = false;
    else if (on()) setBusy(2);
  });
  let drawn = false;
  return {
    attach(runner) {
      spi.attach(runner);
    },
    frame(dt) {
      if (flash > 0) {
        flash = Math.max(0, flash - dt);
        ud.draw(shown, { invert: flash > 0.18 });
        drawn = false;
      } else if (!drawn) {
        ud.draw(shown);
        drawn = true;
      }
    },
    // e-paper menyimpan gambarnya walau simulasi berhenti
  };
}

// ---------------------------------------------------------------- kartu microSD (SPI + FAT16)
const SECTORS = 65536; // 32 MB
const PART_START = 2048;
const PART_SIZE = SECTORS - PART_START;
const RESERVED = 4;
const FAT_SIZE = 62;
const ROOT_SECTORS = 32; // 512 entri
const SPC = 4; // sektor per klaster
const FAT0 = PART_START + RESERVED;
const ROOT = FAT0 + 2 * FAT_SIZE;
const DATA = ROOT + ROOT_SECTORS;
const cards = new Map(); // isi kartu bertahan selama halaman terbuka (per id komponen)

function u16(buf, off, v) {
  buf[off] = v & 0xff;
  buf[off + 1] = (v >> 8) & 0xff;
}
function u32(buf, off, v) {
  for (let i = 0; i < 4; i++) buf[off + i] = (v >>> (i * 8)) & 0xff;
}

/** Citra kartu baru: MBR + partisi FAT16 berisi HALO.TXT. Blok disimpan jarang (Map). */
function formatCard() {
  const blocks = new Map();
  const blk = (lba) => {
    if (!blocks.has(lba)) blocks.set(lba, new Uint8Array(512));
    return blocks.get(lba);
  };
  const mbr = blk(0);
  mbr[0x1be] = 0x00;
  mbr[0x1c2] = 0x04; // FAT16 < 32 MB
  u32(mbr, 0x1c6, PART_START);
  u32(mbr, 0x1ca, PART_SIZE);
  mbr[510] = 0x55;
  mbr[511] = 0xaa;
  const vbr = blk(PART_START);
  vbr.set([0xeb, 0x3c, 0x90], 0);
  vbr.set([...'MSWIN4.1'].map((c) => c.charCodeAt(0)), 3);
  u16(vbr, 0x0b, 512);
  vbr[0x0d] = SPC;
  u16(vbr, 0x0e, RESERVED);
  vbr[0x10] = 2;
  u16(vbr, 0x11, ROOT_SECTORS * 16);
  u16(vbr, 0x13, 0);
  vbr[0x15] = 0xf8;
  u16(vbr, 0x16, FAT_SIZE);
  u16(vbr, 0x18, 63);
  u16(vbr, 0x1a, 255);
  u32(vbr, 0x1c, PART_START);
  u32(vbr, 0x20, PART_SIZE);
  vbr[0x24] = 0x80;
  vbr[0x26] = 0x29;
  u32(vbr, 0x27, 0x1a2b3c4d);
  vbr.set([...'ARDUINO SD '].map((c) => c.charCodeAt(0)), 0x2b);
  vbr.set([...'FAT16   '].map((c) => c.charCodeAt(0)), 0x36);
  vbr[510] = 0x55;
  vbr[511] = 0xaa;
  const text = 'Halo dari kartu SD!\r\n';
  for (const fat of [FAT0, FAT0 + FAT_SIZE]) {
    const f = blk(fat);
    u16(f, 0, 0xfff8);
    u16(f, 2, 0xffff);
    u16(f, 4, 0xffff); // klaster 2 = HALO.TXT
  }
  const root = blk(ROOT);
  root.set([...'ARDUINO SD '].map((c) => c.charCodeAt(0)), 0);
  root[11] = 0x08; // label volume
  root.set([...'HALO    TXT'].map((c) => c.charCodeAt(0)), 32);
  root[32 + 11] = 0x20;
  u16(root, 32 + 26, 2);
  u32(root, 32 + 28, text.length);
  blk(DATA).set([...text].map((c) => c.charCodeAt(0)), 0);
  return blocks;
}

/** Register CSD v1 untuk kartu 32 MB (C_SIZE = 127, C_SIZE_MULT = 7, blok 512 byte). */
function csd() {
  const c = 127;
  const mult = 7;
  return [
    0x00, 0x26, 0x00, 0x32, 0x5f, 0x59,
    0x80 | ((c >> 10) & 3), (c >> 2) & 0xff, ((c & 3) << 6) | 0x2d,
    (0b101 << 5) | (0b101 << 2) | ((mult >> 1) & 3),
    ((mult & 1) << 7) | 0x40 | 0x3f, 0x80, 0x0a, 0x40, 0x00, 0x01,
  ];
}
const CID = [0x03, 0x53, 0x44, 0x57, 0x4f, 0x4b, 0x57, 0x49, 0x10, 0x12, 0x34, 0x56, 0x78, 0x01, 0x6a, 0x01];

export function microsdDevice(part, ctx, n) {
  const b = part.spec.behavior;
  const ud = part.group.userData;
  if (!cards.has(part.id)) cards.set(part.id, formatCard());
  const blocks = cards.get(part.id);
  const read = (lba) => blocks.get(lba) ?? new Uint8Array(512);
  let out = []; // byte balasan berikutnya
  let cmd = []; // perintah 6 byte yang sedang diterima
  let app = false; // CMD55 baru diterima (ACMD berikutnya)
  let idle = true;
  let writing = null; // { lba, data: [] } menunggu token + 512 byte
  let activity = 0;

  function command([c, a0, a1, a2, a3]) {
    const index = c & 0x3f;
    const arg = ((a0 << 24) | (a1 << 16) | (a2 << 8) | a3) >>> 0;
    const r1 = idle ? 0x01 : 0x00;
    const acmd = app;
    app = false;
    if (index === 0) {
      idle = true;
      return [0x01];
    }
    if (index === 8) return [r1, 0x00, 0x00, 0x01, arg & 0xff];
    if (index === 55) {
      app = true;
      return [r1];
    }
    if (acmd && index === 41) {
      idle = false;
      return [0x00];
    }
    if (index === 58) return [r1, 0x80, 0xff, 0x80, 0x00]; // OCR: siap, kartu SDSC (alamat byte)
    if (index === 59 || index === 16) return [r1];
    if (index === 9 || index === 10) return [0x00, 0xff, 0xfe, ...(index === 9 ? csd() : CID), 0xff, 0xff];
    if (index === 13) return [0x00, 0x00];
    if (index === 17) {
      activity = 0.15;
      return [0x00, 0xff, 0xfe, ...read(Math.floor(arg / 512)), 0xff, 0xff];
    }
    if (index === 24) {
      activity = 0.15;
      writing = { lba: Math.floor(arg / 512), data: null };
      return [0x00];
    }
    if (index === 12) return [0xff, 0x00];
    return [r1 | 0x04]; // perintah tidak dikenal
  }

  const onByte = (v) => {
    if (!powered(ctx, n(b.vcc), n(b.gnd))) return 0xff;
    const reply = out.length ? out.shift() : 0xff;
    if (writing && !out.length) {
      if (writing.data === null) {
        if (v === 0xfe) writing.data = [];
      } else if (writing.data.length < 514) {
        writing.data.push(v);
        if (writing.data.length === 514) {
          blocks.set(writing.lba, new Uint8Array(writing.data.slice(0, 512)));
          writing = null;
          out = [0x05, 0x00, 0x00, 0xff]; // data diterima, sibuk sebentar
        }
      }
      return reply;
    }
    if (cmd.length || (v & 0xc0) === 0x40) {
      cmd.push(v);
      if (cmd.length === 6) {
        out = [0xff, ...command(cmd)];
        cmd = [];
      }
    }
    return reply;
  };
  const spi = spiSlave(ctx, n, {
    sck: b.sck,
    mosi: b.mosi,
    cs: b.cs,
    onByte,
    onSelect: (sel) => {
      if (!sel) {
        out = [];
        cmd = [];
      }
    },
  });

  /** Daftar berkas di direktori akar (nama 8.3 + ukuran). */
  function listFiles() {
    const files = [];
    for (let s = 0; s < ROOT_SECTORS; s++) {
      const blk = blocks.get(ROOT + s);
      if (!blk) continue;
      for (let e = 0; e < 512; e += 32) {
        const first = blk[e];
        const attr = blk[e + 11];
        if (first === 0 || first === 0xe5 || attr === 0x0f || attr & 0x08) continue;
        const name = String.fromCharCode(...blk.slice(e, e + 8)).trim();
        const ext = String.fromCharCode(...blk.slice(e + 8, e + 11)).trim();
        const size = blk[e + 28] | (blk[e + 29] << 8) | (blk[e + 30] << 16) | (blk[e + 31] << 24);
        files.push(attr & 0x10 ? `${name}/` : `${ext ? `${name}.${ext}` : name} (${size} B)`);
      }
    }
    return files;
  }

  return {
    attach(runner) {
      spi.attach(runner); // pin SPI yang salah ditandai panduan kabel
    },
    frame(dt) {
      activity = Math.max(0, activity - dt);
      ud.setActive(activity > 0);
    },
    stop() {
      ud.setActive(false);
      const files = listFiles();
      ctx.log(t('w.sdFiles', { id: part.id, files: files.length ? files.join(', ') : t('w.sdEmpty') }));
    },
  };
}
