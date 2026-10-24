// Kompilasi sketch Arduino menjadi file .hex untuk emulator (avr8js).
// Dipakai sebagai middleware Vite saat pengembangan (vite.config.js) dan oleh
// server mandiri untuk produksi (server/compile-server.mjs).

import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, writeFile, readFile, rm, readdir } from 'node:fs/promises';
import { existsSync, accessSync, constants, cpSync, chmodSync, readdirSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createMonitor, record, serverEvent } from './monitor.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TMP = join(tmpdir(), 'learn-arduino');
const EXE = process.platform === 'win32' ? '.exe' : '';
// Folder toolchain (hasil scripts/setup-arduino.mjs). Di Vercel: .vercel-toolchain (lihat vercel.json).
let TOOLS = resolve(ROOT, process.env.TOOLS_DIR ?? (process.env.VERCEL ? '.vercel-toolchain' : 'tools'));
let CLI = process.env.ARDUINO_CLI ?? join(TOOLS, 'arduino-cli', `arduino-cli${EXE}`);

/**
 * Di serverless, berkas yang ikut fungsi bisa kehilangan izin eksekusi dan foldernya hanya-baca.
 * Bila arduino-cli tidak bisa dijalankan, salin toolchain ke /tmp lalu beri izin eksekusi.
 */
function ensureExecutable() {
  if (process.platform === 'win32' || process.env.ARDUINO_CLI) return;
  try {
    accessSync(CLI, constants.X_OK);
    return;
  } catch {
    /* lanjut menyalin */
  }
  const copy = join(TMP, 'toolchain');
  if (!existsSync(join(copy, 'arduino-cli', 'arduino-cli'))) cpSync(TOOLS, copy, { recursive: true });
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else chmodSync(full, 0o755);
    }
  };
  for (const dir of ['arduino-cli', join('arduino-data', 'packages')]) walk(join(copy, dir));
  TOOLS = copy;
  CLI = join(TOOLS, 'arduino-cli', 'arduino-cli');
}
const FQBN = 'arduino:avr:uno';
const MAX_SOURCE = 100_000;
const TIMEOUT_MS = 90_000;

/**
 * Konfigurasi arduino-cli dibuat saat berjalan: path toolchain bisa berbeda antara saat
 * dipasang dan saat dipakai (mis. Vercel), dan semua yang ditulis arduino-cli diarahkan
 * ke folder sementara karena folder toolchain bisa hanya-baca.
 */
let configPath = null;
async function config() {
  if (process.env.ARDUINO_CLI_CONFIG) return process.env.ARDUINO_CLI_CONFIG;
  if (configPath) return configPath;
  const p = (s) => s.replace(/\\/g, '/');
  await mkdir(TMP, { recursive: true });
  configPath = join(TMP, 'arduino-cli.yaml');
  await writeFile(
    configPath,
    [
      'directories:',
      `  data: ${p(join(TOOLS, 'arduino-data'))}`,
      `  user: ${p(join(TOOLS, 'arduino-user'))}`,
      `  downloads: ${p(join(TMP, 'downloads'))}`,
      'build_cache:',
      `  path: ${p(join(TMP, 'build-cache'))}`,
      'updater:',
      '  enable_notification: false',
      'network:',
      '  connection_timeout: 5s',
      '',
    ].join('\n')
  );
  return configPath;
}

const cache = new Map(); // sha256(sketch) -> hasil
let queue = Promise.resolve(); // satu kompilasi pada satu waktu

function run(cmd, args, opts = {}) {
  return new Promise((resolveRun) => {
    const child = spawn(cmd, args, { windowsHide: true, ...opts });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => child.kill('SIGKILL'), TIMEOUT_MS);
    child.stdout.on('data', (d) => (stdout += d));
    child.stderr.on('data', (d) => (stderr += d));
    child.on('error', (err) => {
      clearTimeout(timer);
      resolveRun({ code: -1, stdout, stderr: stderr + err.message });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolveRun({ code, stdout, stderr });
    });
  });
}

/** Tolak include berbahaya: path absolut atau keluar folder (bisa membocorkan isi file server). */
/** Pesan server dalam bahasa Indonesia / Inggris (dipilih lewat field "lang" di permintaan). */
const MSG = {
  id: {
    empty: 'Sketch kosong.',
    tooBig: 'Sketch terlalu besar (maks 100 KB).',
    include: (path) => `#include "${path}" tidak diizinkan.`,
    noCli: 'arduino-cli belum terpasang di server (lihat docs/PANDUAN-PENGEMBANG.md: Server kompilasi).',
    badRequest: (m) => `Permintaan tidak valid: ${m}`,
  },
  en: {
    empty: 'The sketch is empty.',
    tooBig: 'The sketch is too large (max 100 KB).',
    include: (path) => `#include "${path}" is not allowed.`,
    noCli: 'arduino-cli is not installed on the server (see docs/PANDUAN-PENGEMBANG.md: compile server).',
    badRequest: (m) => `Invalid request: ${m}`,
  },
};
const msg = (lang) => MSG[lang] ?? MSG.id;

function checkSource(source, lang) {
  const text = msg(lang);
  if (typeof source !== 'string' || !source.trim()) return text.empty;
  if (source.length > MAX_SOURCE) return text.tooBig;
  for (const m of source.matchAll(/#\s*include\s*[<"]([^>"]+)[>"]/g)) {
    const path = m[1];
    if (/^[\\/]|^[a-zA-Z]:|\.\./.test(path)) return text.include(path);
  }
  return null;
}

/** Cari avr-objdump di dalam toolchain arduino-cli. */
async function findObjdump() {
  const base = join(TOOLS, 'arduino-data', 'packages', 'arduino', 'tools', 'avr-gcc');
  if (!existsSync(base)) return null;
  for (const ver of await readdir(base)) {
    const exe = join(base, ver, 'bin', `avr-objdump${EXE}`);
    if (existsSync(exe)) return exe;
  }
  return null;
}

/**
 * Peta alamat program -> baris sketch, dari info debug DWARF.
 * Mengembalikan [[alamatByte, baris], …] terurut, hanya untuk sketch.ino.
 */
async function lineMap(elf) {
  const objdump = await findObjdump();
  if (!objdump) return [];
  const { stdout } = await run(objdump, ['--dwarf=decodedline', elf]);
  const rows = [];
  let inSketch = false;
  for (const line of stdout.split(/\r?\n/)) {
    if (/^\S.*:$/.test(line) || line.startsWith('CU:')) inSketch = /sketch\.ino/.test(line);
    if (!inSketch) continue;
    // format: "sketch.ino   12   0x1a4  ..." (nama file, baris, alamat)
    const m = line.match(/^(\S*sketch\.ino)\s+(\d+)\s+(0x[0-9a-f]+)/i);
    if (m) rows.push([parseInt(m[3], 16), Number(m[2])]);
  }
  rows.sort((a, b) => a[0] - b[0]);
  return rows;
}

/** Ringkas pesan error: buang path folder sementara agar mudah dibaca. */
function tidy(text, dir) {
  return text
    .split(dir)
    .join('')
    .replace(/[\\/]sketch[\\/]sketch\.ino/g, 'sketch.ino')
    .trim();
}

async function compileNow(source) {
  await mkdir(TMP, { recursive: true });
  const dir = await mkdtemp(join(TMP, 'sketch-'));
  try {
    const sketchDir = join(dir, 'sketch');
    const outDir = join(dir, 'out');
    await mkdir(sketchDir, { recursive: true });
    await writeFile(join(sketchDir, 'sketch.ino'), source);
    const res = await run(CLI, ['--config-file', await config(), 'compile', '--fqbn', FQBN, '--build-path', join(dir, 'build'), '--output-dir', outDir, sketchDir], {
      // arduino-cli menulis berkas kecil di HOME; di serverless hanya /tmp yang bisa ditulis
      env: { ...process.env, HOME: process.env.VERCEL ? TMP : process.env.HOME ?? TMP },
    });
    // dihentikan (timeout) atau gagal dijalankan = masalah server, bukan kesalahan sketch pengguna
    if (res.code === null || res.code === -1) return { ok: false, stderr: tidy(res.stderr || res.stdout || 'arduino-cli timeout', dir), internal: true };
    if (res.code !== 0) return { ok: false, stderr: tidy(res.stderr || res.stdout, dir) };
    const hex = await readFile(join(outDir, 'sketch.ino.hex'), 'utf8');
    const lines = await lineMap(join(outDir, 'sketch.ino.elf'));
    const size = res.stdout.match(/Sketch uses (\d+) bytes/)?.[1];
    return { ok: true, hex, lines, size: size ? Number(size) : null, stdout: tidy(res.stdout, dir) };
  } finally {
    rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

/** Kompilasi (dengan cache & antrean). */
export async function compileSketch(source, lang = 'id') {
  const problem = checkSource(source, lang);
  if (problem) return { ok: false, stderr: problem };
  if (!existsSync(CLI)) return { ok: false, stderr: msg(lang).noCli, internal: true };
  ensureExecutable();
  const key = createHash('sha256').update(source).digest('hex');
  if (cache.has(key)) return cache.get(key);
  const job = queue.then(() => compileNow(source));
  queue = job.catch(() => {});
  const result = await job;
  if (result.ok) {
    cache.set(key, result);
    if (cache.size > 200) cache.delete(cache.keys().next().value);
  }
  return result;
}

/** Isi JSON permintaan. Vercel sudah mem-parse-nya (req.body); server Node/Vite belum (req.body kosong). */
async function readBody(req) {
  if (req.body !== undefined) return typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  let body = '';
  for await (const chunk of req) {
    body += chunk;
    if (body.length > MAX_SOURCE * 2) break;
  }
  return JSON.parse(body);
}

/**
 * Handler HTTP: POST /api/compile { sketch } -> { ok, hex, lines, stderr }
 * Lama kompilasi dicatat sebagai metrik "compile"; ok = server berfungsi (kesalahan sketch pengguna
 * tetap ok). Toolchain hilang / timeout / pengecualian dicatat sebagai error server.
 */
export async function handleCompile(req, res, deps = { compile: compileSketch, monitor: createMonitor(), now: Date.now }) {
  const { compile, monitor, now } = deps;
  res.setHeader('Access-Control-Allow-Origin', process.env.CORS_ORIGIN ?? '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }
  if (req.method !== 'POST') {
    res.statusCode = 405;
    return res.end();
  }
  let body;
  try {
    body = await readBody(req);
  } catch (err) {
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ ok: false, stderr: msg('id').badRequest(err.message) }));
  }
  const started = now();
  const result = await compile(body.sketch, body.lang).catch((err) => ({ ok: false, stderr: String(err?.message ?? err), internal: true }));
  const { internal, ...reply } = result;
  await record(monitor, {
    metrics: [{ name: 'compile', page: null, device: null, value_ms: Math.round(now() - started), ok: !internal }],
    events: internal ? [serverEvent({ level: 'error', kind: 'compile', message: result.stderr })] : [],
  });
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(reply));
}
