// Rampingkan toolchain Arduino (hasil scripts/setup-arduino.mjs) agar muat di fungsi
// serverless (Vercel: maks 250 MB). Hanya yang dibutuhkan untuk mengompilasi Arduino Uno
// (ATmega328P = multilib avr5) yang disisakan.
//   node scripts/slim-toolchain.mjs [folder-tools]   (bawaan: ./tools)

import { readdirSync, rmSync, statSync, existsSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const TOOLS = resolve(process.argv[2] ?? process.env.TOOLS_DIR ?? 'tools');
const DATA = join(TOOLS, 'arduino-data');
const LIBS = join(TOOLS, 'arduino-user', 'libraries');
const MULTILIB = 'avr5'; // ATmega328P

let freed = 0;
function size(path) {
  const st = statSync(path);
  if (!st.isDirectory()) return st.size;
  return readdirSync(path).reduce((sum, name) => sum + size(join(path, name)), 0);
}
function remove(path) {
  if (!existsSync(path)) return;
  freed += size(path);
  rmSync(path, { recursive: true, force: true });
}
const list = (dir) => (existsSync(dir) ? readdirSync(dir) : []);
const mb = (bytes) => `${(bytes / 1048576).toFixed(1)} MB`;

const before = size(TOOLS);

// 1. unduhan sementara & alat upload (tidak dipakai untuk kompilasi)
remove(join(DATA, 'staging'));
remove(join(DATA, 'tmp'));
// indeks library (± 57 MB) hanya dipakai untuk mencari/memasang library, bukan untuk kompilasi
remove(join(DATA, 'library_index.json'));
remove(join(DATA, 'library_index.json.sig'));
// …tetapi tanpa berkas ini arduino-cli mengunduhnya lagi (4,4 MB) setiap kompilasi yang memakai
// library; indeks kosong cukup karena library sudah terpasang
writeFileSync(join(DATA, 'library_index.json'), '{"libraries":[]}\n');
for (const tool of ['avrdude', 'arduinoOTA']) remove(join(DATA, 'packages', 'arduino', 'tools', tool));

// 2. avr-gcc: buang dokumentasi dan pustaka untuk keluarga AVR lain
for (const ver of list(join(DATA, 'packages', 'arduino', 'tools', 'avr-gcc'))) {
  const gcc = join(DATA, 'packages', 'arduino', 'tools', 'avr-gcc', ver);
  remove(join(gcc, 'share'));
  for (const gccVer of list(join(gcc, 'lib', 'gcc', 'avr'))) {
    const dir = join(gcc, 'lib', 'gcc', 'avr', gccVer);
    for (const name of list(dir)) {
      const full = join(dir, name);
      const isMultilib = statSync(full).isDirectory() && /^avr(\d|tiny|xmega)/.test(name);
      if ((isMultilib && name !== MULTILIB) || name === 'plugin') remove(full);
    }
  }
  const libc = join(gcc, 'avr', 'lib');
  for (const name of list(libc)) {
    const full = join(libc, name);
    // sisakan avr5 dan ldscripts; berkas di akar folder milik avr2 (bawaan)
    if (name !== MULTILIB && name !== 'ldscripts') remove(full);
  }
  // header register chip lain (± 300 berkas io*.h): avr/io.h hanya memuat milik chip target
  const avrInc = join(gcc, 'avr', 'include', 'avr');
  for (const name of list(avrInc)) {
    if (/^io.+\.h$/.test(name) && !['io.h', 'iom328p.h'].includes(name)) remove(join(avrInc, name));
  }
  for (const name of list(join(gcc, 'bin'))) {
    if (/gdb|gcov|lto-dump|c\+\+filt|addr2line|readelf|strings|strip|elfedit|gprof|ranlib|cpp/.test(name) && !/gcc-ranlib/.test(name)) remove(join(gcc, 'bin', name));
  }
  for (const gccVer of list(join(gcc, 'libexec', 'gcc', 'avr'))) remove(join(gcc, 'libexec', 'gcc', 'avr', gccVer, 'install-tools'));
}

// 3. core AVR: bootloader & firmware hanya untuk upload/burn
for (const ver of list(join(DATA, 'packages', 'arduino', 'hardware', 'avr'))) {
  const core = join(DATA, 'packages', 'arduino', 'hardware', 'avr', ver);
  remove(join(core, 'bootloaders'));
  remove(join(core, 'firmwares'));
  remove(join(core, 'extras'));
  for (const lib of list(join(core, 'libraries'))) remove(join(core, 'libraries', lib, 'examples'));
}

// 4. library: hanya kode sumber (contoh, dokumentasi, gambar dibuang)
const JUNK = /^(examples?|extras|docs?|images?|tests?|\.github|\.git|\.vscode|tools)$/i;
const JUNK_FILE = /\.(png|jpe?g|gif|pdf|svg|md|txt|html?|bmp)$/i;
function sweep(dir, depth = 0) {
  for (const name of list(dir)) {
    const full = join(dir, name);
    const isDir = statSync(full).isDirectory();
    if (isDir && depth === 0 && JUNK.test(name)) remove(full);
    else if (!isDir && depth > 0 && JUNK_FILE.test(name) && name !== 'library.properties') remove(full);
    else if (isDir) sweep(full, depth + 1);
  }
}
for (const lib of list(LIBS)) sweep(join(LIBS, lib));
// gambar contoh GxEPD2 (± 43 MB) hanya di-include oleh sketsa contohnya
remove(join(LIBS, 'GxEPD2', 'src', 'bitmaps'));

const after = size(TOOLS);
console.log(`Toolchain: ${mb(before)} → ${mb(after)} (dibuang ${mb(freed)})`);
