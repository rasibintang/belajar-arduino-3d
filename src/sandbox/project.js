import { t } from '../i18n/index.js';
// Menyimpan, membuka, dan membagikan proyek sandbox.
// Proyek = { name, sketch, diagram, eeprom? }

const KEY = 'learn-arduino:sandbox:v1';

export function loadLocal() {
  try {
    return JSON.parse(localStorage.getItem(KEY));
  } catch {
    return null;
  }
}

export function saveLocal(project) {
  try {
    localStorage.setItem(KEY, JSON.stringify(project));
    return true;
  } catch {
    return false;
  }
}

// --- tautan berbagi: #p=<deflate + base64url> ---
function toB64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
const fromB64 = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

async function pipe(bytes, stream) {
  const out = new Blob([bytes]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

/** Proyek -> potongan hash "p=…" (dikompres bila browser mendukung). */
export async function encodeProject(project) {
  const { name, sketch, diagram } = project;
  const json = new TextEncoder().encode(JSON.stringify({ name, sketch, diagram }));
  const packed = typeof CompressionStream === 'function' ? await pipe(json, new CompressionStream('deflate-raw')) : json;
  return `p=${typeof CompressionStream === 'function' ? '' : 'raw.'}${toB64(packed)}`;
}

export async function shareUrl(project) {
  const url = new URL(location.href);
  url.hash = await encodeProject(project);
  return url.toString();
}

export async function fromHash(hash = location.hash) {
  const m = hash.match(/[#&]p=(raw\.)?([\w-]+)/);
  if (!m) return null;
  try {
    let bytes = fromB64(m[2]);
    if (!m[1]) bytes = await pipe(bytes, new DecompressionStream('deflate-raw'));
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
}

/** Unduh proyek sebagai file .json. */
export function download(project) {
  const blob = new Blob([JSON.stringify({ name: project.name, sketch: project.sketch, diagram: project.diagram }, null, 2)], {
    type: 'application/json',
  });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${(project.name || 'proyek').replace(/[^\w-]+/g, '-').toLowerCase()}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/** Buka file .json proyek (atau diagram.json saja). */
export function pickFile() {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      try {
        const data = JSON.parse(await file.text());
        resolve(data.diagram ? data : { name: file.name.replace(/\.json$/, ''), diagram: data });
      } catch {
        resolve({ error: t('sb.badFile') });
      }
    };
    input.click();
  });
}
