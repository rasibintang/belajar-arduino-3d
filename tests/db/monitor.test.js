import { test } from 'node:test';
import assert from 'node:assert/strict';
import { freshDb, addUser } from './pg.js';

const A = { id: '00000000-0000-4000-8000-00000000000a', email: 'a@contoh.test', name: 'Ani' };
const ADMIN = { id: '00000000-0000-4000-8000-0000000000ad', email: 'admin@contoh.test', name: 'Pengelola' };

async function setup() {
  const { db, as } = await freshDb();
  for (const u of [A, ADMIN]) await addUser(db, u);
  await db.query(`insert into public.admins (email) values ($1)`, [ADMIN.email]);
  // server (service role) yang menulis
  await db.query(`insert into site_events (level, source, kind, message, page, fingerprint) values ('error', 'browser', 'js', 'x is not defined', 'home', 'f1')`);
  await db.query(`insert into site_metrics (name, page, device, value_ms, ok) values ('load', 'home', 'desktop', 1200, true)`);
  return { db, as };
}

test('pemantauan: hanya pengelola yang membaca kejadian & metrik', async () => {
  const { as } = await setup();
  assert.equal((await as(ADMIN, 'select * from site_events')).rows.length, 1);
  assert.equal((await as(ADMIN, 'select * from site_metrics')).rows.length, 1);
  assert.equal((await as(A, 'select * from site_events')).rows.length, 0);
  assert.equal((await as(A, 'select * from site_metrics')).rows.length, 0);
  const anon = await as(null, 'select * from site_events').then((r) => r.rows, () => []);
  assert.equal(anon.length, 0);
});

test('pemantauan: pengguna (termasuk pengelola) tidak bisa menulis kejadian lewat API', async () => {
  const { as } = await setup();
  for (const u of [A, ADMIN, null]) {
    await assert.rejects(as(u, `insert into site_events (level, source, kind, message, fingerprint) values ('error', 'browser', 'js', 'palsu', 'f9')`));
    await assert.rejects(as(u, `insert into site_metrics (name, value_ms, ok) values ('load', 1, true)`));
  }
  await assert.rejects(as(ADMIN, `delete from site_events`));
});

test('pemantauan: pengelola menandai kelompok selesai; pengguna biasa tidak', async () => {
  const { as } = await setup();
  await as(ADMIN, `insert into site_event_resolved (fingerprint) values ('f1') on conflict (fingerprint) do update set resolved_at = now()`);
  assert.equal((await as(ADMIN, 'select fingerprint from site_event_resolved')).rows.length, 1);
  await assert.rejects(as(A, `insert into site_event_resolved (fingerprint) values ('f2')`));
  assert.equal((await as(A, 'select * from site_event_resolved')).rows.length, 0);
});

test('pemantauan: level, sumber, dan nama metrik dibatasi', async () => {
  const { db } = await setup();
  await assert.rejects(db.query(`insert into site_events (level, source, kind, message, fingerprint) values ('fatal', 'browser', 'js', 'x', 'f')`));
  await assert.rejects(db.query(`insert into site_events (level, source, kind, message, fingerprint) values ('error', 'luar', 'js', 'x', 'f')`));
  await assert.rejects(db.query(`insert into site_metrics (name, value_ms, ok) values ('lain', 1, true)`));
});
