// Kompilasi sketch Arduino menjadi file .hex untuk emulator (avr8js).
// Dipakai sebagai middleware Vite saat pengembangan (vite.config.js) dan oleh
// server mandiri untuk produksi (server/compile-server.mjs).

import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, writeFile, readFile, rm, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CLI = process.env.ARDUINO_CLI ?? join(ROOT, 'tools', 'arduino-cli', process.platform === 'win32' ? 'arduino-cli.exe' : 'arduino-cli');
const CONFIG = process.env.ARDUINO_CLI_CONFIG ?? join(ROOT, 'tools', 'arduino-cli', 'arduino-cli.yaml');
const FQBN = 'arduino:avr:uno';
const MAX_SOURCE = 100_000;
const TIMEOUT_MS = 90_000;

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
function checkSource(source) {
  if (typeof source !== 'string' || !source.trim()) return 'Sketch kosong.';
  if (source.length > MAX_SOURCE) return 'Sketch terlalu besar (maks 100 KB).';
  for (const m of source.matchAll(/#\s*include\s*[<"]([^>"]+)[>"]/g)) {
    const path = m[1];
    if (/^[\\/]|^[a-zA-Z]:|\.\./.test(path)) return `#include "${path}" tidak diizinkan.`;
  }
  return null;
}

/** Cari avr-objdump di dalam toolchain arduino-cli. */
async function findObjdump() {
  const base = join(ROOT, 'tools', 'arduino-data', 'packages', 'arduino', 'tools', 'avr-gcc');
  if (!existsSync(base)) return null;
  for (const ver of await readdir(base)) {
    const exe = join(base, ver, 'bin', process.platform === 'win32' ? 'avr-objdump.exe' : 'avr-objdump');
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
  const dir = await mkdtemp(join(tmpdir(), 'learn-arduino-'));
  try {
    const sketchDir = join(dir, 'sketch');
    const outDir = join(dir, 'out');
    await run(process.platform === 'win32' ? 'cmd' : 'mkdir', process.platform === 'win32' ? ['/c', 'mkdir', sketchDir] : ['-p', sketchDir]);
    await writeFile(join(sketchDir, 'sketch.ino'), source);
    const res = await run(CLI, ['--config-file', CONFIG, 'compile', '--fqbn', FQBN, '--output-dir', outDir, sketchDir]);
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
export async function compileSketch(source) {
  const problem = checkSource(source);
  if (problem) return { ok: false, stderr: problem };
  if (!existsSync(CLI)) return { ok: false, stderr: 'arduino-cli belum terpasang di server (lihat README: Server kompilasi).' };
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

/** Handler HTTP: POST /api/compile { sketch } -> { ok, hex, lines, stderr } */
export async function handleCompile(req, res) {
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
  let body = '';
  for await (const chunk of req) {
    body += chunk;
    if (body.length > MAX_SOURCE * 2) break;
  }
  let result;
  try {
    result = await compileSketch(JSON.parse(body).sketch);
  } catch (err) {
    result = { ok: false, stderr: `Permintaan tidak valid: ${err.message}` };
  }
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(result));
}
