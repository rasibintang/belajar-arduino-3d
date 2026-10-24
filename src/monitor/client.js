// Pelapor pemantauan di browser → POST /api/log (server/log.mjs). Aktif di produksi, atau saat
// pengembangan dengan ?monitor=1. Tidak pernah mengirim isi sketch, perintah AI, atau kunci.
//
//   initMonitor('sandbox')            sekali per halaman: error JS & promise, WebGL hilang
//   monitor.event(level, kind, msg)   level 'error' | 'warn'
//   monitor.metric(name, ms, ok)      name 'load' | 'ai'
//   monitor.ready()                   halaman siap dipakai → metrik load (+ warning bila > 15 dtk)

const MAX_EVENTS = 20;
const DELAY_MS = 2000;
const SLOW_LOAD_MS = 15000;

/** Antrean dengan pengelompokan, tanpa duplikat, dan batas per halaman. */
export function createReporter({ page, send, setTimer = setTimeout, maxEvents = MAX_EVENTS, delayMs = DELAY_MS }) {
  let events = [];
  let metrics = [];
  let timer = false;
  let count = 0;
  const seen = new Set();
  function flush() {
    timer = false;
    if (!events.length && !metrics.length) return;
    const payload = { events, metrics };
    events = [];
    metrics = [];
    send(payload);
  }
  function schedule() {
    if (timer) return;
    timer = true;
    setTimer(flush, delayMs);
  }
  return {
    event(level, kind, message) {
      const text = String(message ?? '').slice(0, 1000);
      const key = `${level}|${kind}|${text}`;
      if (!text || seen.has(key) || count >= maxEvents) return;
      seen.add(key);
      count++;
      events.push({ level, kind, message: text, page });
      schedule();
    },
    metric(name, valueMs, ok = true) {
      metrics.push({ name, valueMs, ok, page });
      schedule();
    },
    flush,
  };
}

let reporter = null;

/** Dipakai modul mana pun; tanpa initMonitor (mis. saat pengembangan) semuanya diam. */
export const monitor = {
  event: (level, kind, message) => reporter?.event(level, kind, message),
  metric: (name, valueMs, ok) => reporter?.metric(name, valueMs, ok),
  ready() {
    if (!reporter) return;
    const ms = Math.round(performance.now());
    reporter.metric('load', ms);
    if (ms > SLOW_LOAD_MS) reporter.event('warn', 'slow-load', `halaman siap setelah ${Math.round(ms / 1000)} dtk`);
  },
};

export function initMonitor(page) {
  const enabled = import.meta.env?.PROD || new URLSearchParams(location.search).has('monitor');
  if (!enabled || reporter) return;
  const send = (payload) => {
    const body = JSON.stringify(payload);
    if (!navigator.sendBeacon?.('/api/log', body)) fetch('/api/log', { method: 'POST', body, keepalive: true }).catch(() => {});
  };
  reporter = createReporter({ page, send });
  window.addEventListener('error', (e) => {
    // hanya skrip situs ini (skrip ekstensi/lintas domain hanya memberi "Script error.")
    if (!e.filename || !e.filename.startsWith(location.origin)) return;
    if (/ResizeObserver loop/.test(e.message)) return;
    const file = e.filename.slice(location.origin.length).split('?')[0];
    reporter.event('error', 'js', `${e.message} @ ${file}:${e.lineno}`);
  });
  window.addEventListener('unhandledrejection', (e) => {
    const r = e.reason;
    reporter.event('error', 'promise', r instanceof Error ? `${r.name}: ${r.message}` : String(r));
  });
  // WebGL bisa "hilang" (GPU di-reset, memori HP penuh): meja 3D berhenti tampil
  window.addEventListener('webglcontextlost', () => reporter.event('error', 'webgl', 'WebGL context lost'), true);
  window.addEventListener('pagehide', () => reporter.flush());
}
