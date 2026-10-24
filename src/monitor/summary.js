// Pengolahan data pemantauan untuk tab "Kondisi situs" di halaman pengelola (murni, tanpa DOM).
// Data dari backend.admin.health(): events, metrics, users, projects, resolved (lihat supabase-backend.js).

/** Persentil nearest-rank; kosong → null. */
export function percentile(values, p) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil((p / 100) * sorted.length) - 1)];
}

/**
 * Kejadian dikelompokkan per sidik jari. Kelompok "selesai" bila ditandai dan tidak ada kejadian
 * sesudahnya. Urutan: belum selesai dulu, error sebelum warning, lalu yang terbaru.
 */
export function groupEvents(events, resolved) {
  const resolvedAt = new Map(resolved.map((r) => [r.fingerprint, r.resolvedAt]));
  const groups = new Map();
  for (const e of events) {
    let g = groups.get(e.fingerprint);
    if (!g) {
      g = { fingerprint: e.fingerprint, level: e.level, source: e.source, kind: e.kind, message: e.message, page: e.page, count: 0, firstAt: e.createdAt, lastAt: e.createdAt, devices: {}, browsers: new Set() };
      groups.set(e.fingerprint, g);
    }
    g.count++;
    if (e.createdAt < g.firstAt) g.firstAt = e.createdAt;
    if (e.createdAt >= g.lastAt) {
      g.lastAt = e.createdAt;
      g.message = e.message;
    }
    if (e.device) g.devices[e.device] = (g.devices[e.device] ?? 0) + 1;
    if (e.browser) g.browsers.add(e.browser);
  }
  const rank = (g) => (g.resolved ? 2 : 0) + (g.level === 'error' ? 0 : 1);
  return [...groups.values()]
    .map((g) => ({ ...g, browsers: [...g.browsers].sort(), resolved: resolvedAt.has(g.fingerprint) && g.lastAt <= resolvedAt.get(g.fingerprint) }))
    .sort((a, b) => rank(a) - rank(b) || b.lastAt.localeCompare(a.lastAt));
}

/**
 * Batas periode ini dan pembandingnya. Periode ini tanpa batas atas: jam browser pengelola bisa
 * sedikit di belakang jam server, dan data terbaru tidak boleh hilang dari ringkasan.
 */
export function periods(now, span) {
  return { current: [now - span, Infinity], previous: [now - 2 * span, now - span] };
}

const within = (iso, from, to) => {
  const t = Date.parse(iso);
  return t >= from && t < to;
};
const rate = (rows) => (rows.length ? rows.filter((r) => r.ok).length / rows.length : null);

/** Angka kartu ringkasan untuk periode [from, to) (milidetik). */
export function periodStats({ events, metrics, users, projects }, from, to) {
  const ev = events.filter((e) => within(e.createdAt, from, to));
  const m = metrics.filter((x) => within(x.createdAt, from, to));
  const compile = m.filter((x) => x.name === 'compile');
  const ai = m.filter((x) => x.name === 'ai');
  return {
    errors: ev.filter((e) => e.level === 'error').length,
    warnings: ev.filter((e) => e.level === 'warn').length,
    compile: { count: compile.length, okRate: rate(compile), p50: percentile(compile.map((x) => x.valueMs), 50) },
    ai: { ok: ai.filter((x) => x.ok).length, failed: ai.filter((x) => !x.ok).length },
    newUsers: users.filter((u) => within(u.createdAt, from, to)).length,
    projectsSaved: projects.filter((p) => within(p.updatedAt, from, to)).length,
  };
}

/** Waktu muat per halaman × perangkat. */
export function loadTable(metrics) {
  const rows = new Map();
  for (const m of metrics.filter((x) => x.name === 'load')) {
    const key = `${m.page ?? '—'}|${m.device ?? '—'}`;
    if (!rows.has(key)) rows.set(key, { page: m.page ?? '—', device: m.device ?? '—', values: [] });
    rows.get(key).values.push(m.valueMs);
  }
  return [...rows.values()]
    .sort((a, b) => a.page.localeCompare(b.page) || a.device.localeCompare(b.device))
    .map(({ page, device, values }) => ({ page, device, count: values.length, p50: percentile(values, 50), p95: percentile(values, 95) }));
}

/** Kompilasi dan AI: jumlah, persentase berhasil, p50/p95. */
export function opsTable(metrics) {
  return ['compile', 'ai'].map((name) => {
    const rows = metrics.filter((x) => x.name === name);
    const values = rows.map((x) => x.valueMs);
    return { name, count: rows.length, okRate: rate(rows), p50: percentile(values, 50), p95: percentile(values, 95) };
  });
}
