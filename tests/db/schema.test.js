import { test } from 'node:test';
import assert from 'node:assert/strict';
import { freshDb, addUser } from './pg.js';

const A = { id: '00000000-0000-4000-8000-00000000000a', email: 'a@contoh.test', name: 'Ani' };
const B = { id: '00000000-0000-4000-8000-00000000000b', email: 'b@contoh.test', name: 'Budi' };
const ADMIN = { id: '00000000-0000-4000-8000-0000000000ad', email: 'admin@contoh.test', name: 'Pengelola' };
const DIAGRAM = JSON.stringify({ version: 1, parts: [], wires: [] });

async function setup() {
  const { db, as } = await freshDb();
  for (const u of [A, B, ADMIN]) await addUser(db, u);
  await db.query(`insert into public.admins (email) values ($1)`, [ADMIN.email]);
  const save = (u, name = 'Proyek') => as(u, `insert into projects (name, sketch, diagram) values ($1, '', $2) returning id`, [name, DIAGRAM]);
  return { db, as, save };
}

test('pengguna baru otomatis punya profil', async () => {
  const { db } = await setup();
  const { rows } = await db.query(`select email, name from profiles where id = $1`, [A.id]);
  assert.deepEqual(rows, [{ email: A.email, name: A.name }]);
});

test('pemilik bisa simpan & baca proyeknya; pengguna lain tidak melihatnya', async () => {
  const { as, save } = await setup();
  await save(A);
  assert.equal((await as(A, 'select * from projects')).rows.length, 1);
  assert.equal((await as(B, 'select * from projects')).rows.length, 0);
});

test('anon tidak bisa membaca proyek', async () => {
  const { as, save } = await setup();
  await save(A);
  const rows = await as(null, 'select * from projects').then((r) => r.rows, () => []);
  assert.equal(rows.length, 0);
});

test('pengelola melihat semua proyek tetapi tidak bisa mengubah atau menghapus milik orang lain', async () => {
  const { as, save, db } = await setup();
  const id = (await save(A, 'Milik Ani')).rows[0].id;
  assert.equal((await as(ADMIN, 'select * from projects')).rows.length, 1);
  assert.equal((await as(ADMIN, `update projects set name = 'diubah' where id = $1`, [id])).affectedRows, 0);
  assert.equal((await as(ADMIN, `delete from projects where id = $1`, [id])).affectedRows, 0);
  assert.equal((await db.query(`select name from projects where id = $1`, [id])).rows[0].name, 'Milik Ani');
});

test('pengguna tidak bisa membuat proyek atas nama orang lain', async () => {
  const { as } = await setup();
  await assert.rejects(as(A, `insert into projects (owner, name, diagram) values ($1, 'x', $2)`, [B.id, DIAGRAM]));
});

test('batas AI awal 1; hanya pengelola yang bisa mengubahnya', async () => {
  const { as } = await setup();
  const limit = async (u) => (await as(u, `select value from settings where key = 'ai_daily_limit'`)).rows[0].value;
  assert.equal(await limit(A), 1);
  assert.equal((await as(A, `update settings set value = '5' where key = 'ai_daily_limit'`)).affectedRows, 0);
  await as(ADMIN, `update settings set value = '3' where key = 'ai_daily_limit'`);
  assert.equal(await limit(A), 3);
});

test('progres pelajaran hanya milik sendiri', async () => {
  const { as } = await setup();
  await as(A, `insert into lesson_progress (lesson_id) values ('blink'), ('button')`);
  assert.equal((await as(A, 'select * from lesson_progress')).rows.length, 2);
  assert.equal((await as(B, 'select * from lesson_progress')).rows.length, 0);
});

test('pengguna tidak bisa menulis laporan komponen atau pemakaian AI', async () => {
  const { as } = await setup();
  await assert.rejects(as(A, `insert into component_requests (user_id, prompt, component) values ($1, 'x', 'y')`, [A.id]));
  await assert.rejects(as(A, `insert into ai_usage (user_id, ok) values ($1, true)`, [A.id]));
});

test('laporan komponen dikelompokkan untuk pengelola', async () => {
  const { as, db } = await setup();
  for (const [u, c] of [[A, 'Soil sensor'], [B, 'soil sensor'], [A, 'Pompa']]) {
    await db.query(`insert into component_requests (user_id, prompt, component) values ($1, $2, $3)`, [u.id, `butuh ${c}`, c]);
  }
  const all = (await as(ADMIN, 'select * from admin_component_requests order by requests desc')).rows;
  assert.equal(all.length, 2);
  assert.equal(all[0].component, 'soil sensor');
  assert.equal(Number(all[0].requests), 2);
  assert.equal(Number(all[0].users), 2);
  const mine = (await as(B, 'select * from admin_component_requests')).rows;
  assert.equal(mine.length, 1);
});

test('admin_users menghitung proyek dan pemakaian AI hari ini', async () => {
  const { as, save, db } = await setup();
  await save(A);
  await save(A);
  await db.query(`insert into ai_usage (user_id, ok) values ($1, true), ($1, false), ($1, true)`, [A.id]);
  await db.query(`insert into ai_usage (user_id, ok, created_at) values ($1, true, now() - interval '2 days')`, [A.id]);
  const row = (await as(ADMIN, 'select * from admin_users where id = $1', [A.id])).rows[0];
  assert.equal(Number(row.projects), 2);
  assert.equal(Number(row.ai_today), 2);
  assert.equal(Number(row.ai_total), 3);
  assert.equal((await as(ADMIN, 'select * from admin_users')).rows.length, 3);
});

test('nama proyek kosong ditolak', async () => {
  const { save } = await setup();
  await assert.rejects(save(A, ''));
});
