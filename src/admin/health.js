// Tab "Kondisi situs": ringkasan periode, log error & warning (dikelompokkan), dan kinerja.
// Data dari backend.admin.health(); pengolahan di src/monitor/summary.js.
import { groupEvents, periodStats, loadTable, opsTable } from '../monitor/summary.js';
import { escapeHtml } from '../ui/highlight.js';

const HOUR = 3600000;
const PERIODS = { '24h': 24 * HOUR, '7d': 7 * 24 * HOUR };
// pilihan pengelola bertahan selama halaman terbuka (ganti tab lalu kembali)
const view = { period: '24h', level: '', source: '', showResolved: false };

/** deps: { backend, t, isEN, table(rows, cols), fmt(iso), toast, reload() } → elemen tab */
export async function renderHealth({ backend, t, isEN, table, fmt, toast, reload }) {
  const span = PERIODS[view.period];
  const now = Date.now();
  // dua periode sekaligus: periode ini + pembanding sebelumnya
  const data = await backend.admin.health(new Date(now - 2 * span).toISOString());
  const current = periodStats(data, now - span, now + 1);
  const previous = periodStats(data, now - 2 * span, now - span);
  const inPeriod = (iso) => Date.parse(iso) >= now - span;
  const events = data.events.filter((e) => inPeriod(e.createdAt));
  const metrics = data.metrics.filter((m) => inPeriod(m.createdAt));

  const num = new Intl.NumberFormat(isEN ? 'en' : 'id', { maximumFractionDigits: 1 });
  const ms = (v) => (v == null ? '—' : v < 1000 ? `${num.format(v)} ms` : `${num.format(v / 1000)} ${isEN ? 's' : 'dtk'}`);
  const pct = (r) => (r == null ? '—' : `${Math.round(r * 100)}%`);
  const label = (prefix, key) => {
    const text = t(`${prefix}.${key}`);
    return text === `${prefix}.${key}` ? key ?? '—' : text;
  };
  const el = (tag, className, html = '') => Object.assign(document.createElement(tag), { className, innerHTML: html });

  const root = el('div', 'adm-health');

  // ---------------------------------------------------------------- periode
  const bar = el('div', 'adm-hbar');
  for (const key of Object.keys(PERIODS)) {
    const b = el('button', 'adm-chip', escapeHtml(t(`adm.h.${key}`)));
    b.type = 'button';
    b.setAttribute('aria-pressed', String(view.period === key));
    b.addEventListener('click', () => {
      view.period = key;
      reload();
    });
    bar.append(b);
  }
  const refresh = el('button', 'sb-btn adm-refresh', escapeHtml(t('adm.h.refresh')));
  refresh.type = 'button';
  refresh.addEventListener('click', reload);
  bar.append(refresh);
  root.append(bar);

  // ---------------------------------------------------------------- ringkasan
  const card = (title, value, sub, tone = '') => `<div class="adm-card ${tone}"><span>${escapeHtml(title)}</span><b>${escapeHtml(String(value))}</b><small>${escapeHtml(sub)}</small></div>`;
  const prev = (n) => t('adm.h.prev', { n });
  root.append(
    el(
      'div',
      'adm-cards',
      [
        card(t('adm.h.errors'), current.errors, prev(previous.errors), current.errors ? 'is-bad' : 'is-good'),
        card(t('adm.h.warnings'), current.warnings, prev(previous.warnings), current.warnings ? 'is-warn' : ''),
        card(
          t('adm.h.compile'),
          pct(current.compile.okRate),
          t('adm.h.compileSub', { count: current.compile.count, p50: ms(current.compile.p50) }),
          current.compile.okRate != null && current.compile.okRate < 0.95 ? 'is-bad' : ''
        ),
        card(t('adm.h.ai'), `${current.ai.ok} / ${current.ai.failed}`, prev(`${previous.ai.ok} / ${previous.ai.failed}`), current.ai.failed > current.ai.ok ? 'is-warn' : ''),
        card(t('adm.h.newUsers'), current.newUsers, prev(previous.newUsers)),
        card(t('adm.h.projects'), current.projectsSaved, prev(previous.projectsSaved)),
      ].join('')
    )
  );

  // ---------------------------------------------------------------- log
  root.append(el('h3', 'adm-h3', escapeHtml(t('adm.h.log'))));
  const filters = el(
    'div',
    'adm-filters',
    `<select name="level"><option value="">${escapeHtml(t('adm.h.allLevels'))}</option><option value="error">${escapeHtml(t('adm.h.level.error'))}</option><option value="warn">${escapeHtml(t('adm.h.level.warn'))}</option></select>
     <select name="source"><option value="">${escapeHtml(t('adm.h.allSources'))}</option><option value="browser">${escapeHtml(t('adm.h.source.browser'))}</option><option value="server">${escapeHtml(t('adm.h.source.server'))}</option></select>
     <label><input type="checkbox" name="resolved"> ${escapeHtml(t('adm.h.showResolved'))}</label>`
  );
  filters.querySelector('[name=level]').value = view.level;
  filters.querySelector('[name=source]').value = view.source;
  filters.querySelector('[name=resolved]').checked = view.showResolved;
  const logBox = el('div', 'adm-log');
  root.append(filters, logBox);

  const groups = groupEvents(events, data.resolved);
  function drawLog() {
    const rows = groups.filter((g) => (!view.level || g.level === view.level) && (!view.source || g.source === view.source) && (view.showResolved || !g.resolved));
    if (!rows.length) return logBox.replaceChildren(el('p', 'adm-empty', escapeHtml(t('adm.h.noEvents'))));
    logBox.replaceChildren(
      table(rows, [
        [t('adm.h.col.level'), (g) => el('span', `adm-badge is-${g.level}`, escapeHtml(t(`adm.h.level.${g.level}`)))],
        [t('adm.h.col.message'), (g) => el('div', 'adm-msg', `<code>${escapeHtml(g.message)}</code><small>${escapeHtml(label('adm.h.source', g.source))} · ${escapeHtml(g.kind)}</small>`)],
        [t('adm.h.col.page'), (g) => label('adm.h.page', g.page)],
        [t('adm.h.col.count'), (g) => String(g.count)],
        [t('adm.h.col.last'), (g) => el('div', 'adm-when', `${escapeHtml(fmt(g.lastAt))}<small>${escapeHtml(t('adm.h.first', { time: fmt(g.firstAt) }))}</small>`)],
        [
          t('adm.h.col.devices'),
          (g) =>
            el(
              'div',
              'adm-when',
              `${escapeHtml(Object.entries(g.devices).map(([d, n]) => `${label('adm.h.device', d)} ${n}`).join(' · ') || '—')}<small>${escapeHtml(g.browsers.join(', '))}</small>`
            ),
        ],
        [
          '',
          (g) => {
            if (g.resolved) return el('span', 'adm-badge is-ok', escapeHtml(t('adm.h.resolved')));
            const b = el('button', 'sb-btn', escapeHtml(t('adm.h.resolve')));
            b.type = 'button';
            b.addEventListener('click', async () => {
              b.disabled = true;
              try {
                await backend.admin.resolve(g.fingerprint);
                reload();
              } catch {
                b.disabled = false;
                toast(t('adm.loadFailed'), 'error');
              }
            });
            return b;
          },
        ],
      ])
    );
  }
  filters.addEventListener('change', () => {
    view.level = filters.querySelector('[name=level]').value;
    view.source = filters.querySelector('[name=source]').value;
    view.showResolved = filters.querySelector('[name=resolved]').checked;
    drawLog();
  });
  drawLog();

  // ---------------------------------------------------------------- kinerja
  root.append(el('h3', 'adm-h3', escapeHtml(t('adm.h.perf'))));
  const perf = el('div', 'adm-perf');
  const loads = loadTable(metrics);
  const loadBox = el('div', 'adm-perf-box', `<h4>${escapeHtml(t('adm.h.load'))}</h4>`);
  loadBox.append(
    loads.length
      ? table(loads, [
          [t('adm.h.col.page'), (r) => label('adm.h.page', r.page)],
          [t('adm.h.col.devices'), (r) => label('adm.h.device', r.device)],
          [t('adm.h.col.visits'), (r) => String(r.count)],
          [t('adm.h.col.p50'), (r) => ms(r.p50)],
          [t('adm.h.col.p95'), (r) => ms(r.p95)],
        ])
      : el('p', 'adm-empty', escapeHtml(t('adm.h.noData')))
  );
  const opsBox = el('div', 'adm-perf-box', `<h4>${escapeHtml(t('adm.h.ops'))}</h4>`);
  opsBox.append(
    table(opsTable(metrics), [
      ['', (r) => t(`adm.h.op.${r.name}`)],
      [t('adm.h.col.count'), (r) => String(r.count)],
      [t('adm.h.col.ok'), (r) => pct(r.okRate)],
      [t('adm.h.col.p50'), (r) => ms(r.p50)],
      [t('adm.h.col.p95'), (r) => ms(r.p95)],
    ])
  );
  perf.append(loadBox, opsBox);
  root.append(perf, el('p', 'adm-note', escapeHtml(t('adm.h.note'))));
  return root;
}
