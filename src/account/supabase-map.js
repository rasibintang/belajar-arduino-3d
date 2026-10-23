import { AccountError } from './errors.js';

/** Baris tabel projects → objek proyek. */
export function fromProjectRow(row) {
  return {
    id: row.id,
    owner: row.owner,
    name: row.name,
    sketch: row.sketch,
    diagram: row.diagram,
    eeprom: row.eeprom ?? null,
    updatedAt: row.updated_at,
  };
}

/** Objek proyek → kolom yang boleh ditulis klien (id, pemilik, dan waktu diatur database). */
export function toProjectRow(project) {
  return { name: String(project.name ?? '').trim(), sketch: project.sketch ?? '', diagram: project.diagram, eeprom: project.eeprom ?? null };
}

/** Kesalahan supabase-js / PostgREST / fetch → AccountError. */
export function toAccountError(err) {
  if (err instanceof AccountError) return err;
  const code = String(err?.code ?? '');
  const message = err?.message ?? String(err);
  if (code === '42501') return new AccountError('forbidden', message);
  if (['23514', '23502', '22P02', '22001'].includes(code)) return new AccountError('invalid', message);
  if (code === 'PGRST301' || /jwt|not authenticated/i.test(message) || err?.status === 401) return new AccountError('not-signed-in', message);
  return new AccountError('network', message);
}
