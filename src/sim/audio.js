// Bunyi buzzer lewat Web Audio (gelombang kotak, seperti tone() di Arduino).

let ctx = null;
let master = null;
let current = null;
let muted = false;

function ensure() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.05;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

/** Panggil dari event klik pengguna (browser mewajibkan gesture sebelum suara). */
export function unlockAudio() {
  ensure();
}

export function setMuted(v) {
  muted = v;
  if (v) stopTone();
}

export function playTone(hz, ms) {
  stopTone();
  if (muted || !ensure()) return;
  const osc = ctx.createOscillator();
  const env = ctx.createGain();
  osc.type = 'square';
  osc.frequency.value = hz;
  const t = ctx.currentTime;
  const dur = ms / 1000;
  env.gain.setValueAtTime(0, t);
  env.gain.linearRampToValueAtTime(1, t + 0.005);
  env.gain.setValueAtTime(1, t + Math.max(0.01, dur - 0.02));
  env.gain.linearRampToValueAtTime(0, t + dur);
  osc.connect(env).connect(master);
  osc.start(t);
  osc.stop(t + dur + 0.02);
  current = osc;
}

/** Bunyi "klik" pendek (kontak relay berpindah). Tidak mengganggu tone() yang sedang main. */
export function click() {
  if (muted || !ensure()) return;
  const t = ctx.currentTime;
  const len = Math.floor(ctx.sampleRate * 0.012);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3;
  const src = ctx.createBufferSource();
  const env = ctx.createGain();
  env.gain.value = 2.5;
  src.buffer = buf;
  src.connect(env).connect(master);
  src.start(t);
}

export function stopTone() {
  if (current) {
    try {
      current.stop();
    } catch {
      /* sudah berhenti */
    }
    current = null;
  }
}
