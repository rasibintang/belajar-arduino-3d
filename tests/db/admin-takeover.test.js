// Upaya mengambil alih / menambah pengelola. Semua harus gagal kecuali akun Google terverifikasi
// yang emailnya ada di tabel admins.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { freshDb, addUser } from './pg.js';

const ADMIN_EMAIL = 'admin@contoh.test';
const ADMIN = { id: '00000000-0000-4000-8000-0000000000ad', email: ADMIN_EMAIL, name: 'Pengelola' };
const EVE = { id: '00000000-0000-4000-8000-0000000000e1', email: 'eve@contoh.test', name: 'Eve' };

async function setup() {
  const { db, as } = await freshDb();
  await db.query(`insert into public.admins (email) values ($1)`, [ADMIN_EMAIL]);
  const isAdmin = async (user) => (await as(user, 'select public.is_admin() as ok')).rows[0].ok;
  return { db, as, isAdmin };
}

test('akun Google terverifikasi dengan email pengelola → pengelola', async () => {
  const { db, isAdmin } = await setup();
  await addUser(db, ADMIN);
  assert.equal(await isAdmin(ADMIN), true);
});

test('daftar lewat email/sandi memakai email pengelola → bukan pengelola', async () => {
  const { db, isAdmin } = await setup();
  const fake = { ...ADMIN, id: '00000000-0000-4000-8000-0000000000e2' };
  await addUser(db, { ...fake, providers: ['email'] });
  assert.equal(await isAdmin(fake), false);
});

test('email pengelola belum terverifikasi → bukan pengelola', async () => {
  const { db, isAdmin } = await setup();
  await addUser(db, { ...ADMIN, confirmed: false });
  assert.equal(await isAdmin(ADMIN), false);
});

test('token berisi klaim email pengelola tetapi akunnya milik orang lain → bukan pengelola', async () => {
  const { db, isAdmin } = await setup();
  await addUser(db, EVE);
  assert.equal(await isAdmin({ id: EVE.id, email: ADMIN_EMAIL }), false);
});

test('pengguna (termasuk pengelola) tidak bisa menambah, mengubah, atau membaca tabel admins', async () => {
  const { db, as } = await setup();
  await addUser(db, EVE);
  await addUser(db, ADMIN);
  for (const u of [EVE, ADMIN, null]) {
    await assert.rejects(as(u, `insert into public.admins (email) values ('eve@contoh.test')`));
    await assert.rejects(as(u, `update public.admins set email = 'eve@contoh.test'`));
    await assert.rejects(as(u, `delete from public.admins`));
    await assert.rejects(as(u, `select * from public.admins`));
  }
  assert.deepEqual((await db.query('select email from public.admins')).rows, [{ email: ADMIN_EMAIL }]);
});

test('pengguna tidak bisa mengganti email di profil menjadi email pengelola', async () => {
  const { db, as, isAdmin } = await setup();
  await addUser(db, EVE);
  await assert.rejects(as(EVE, `update public.profiles set email = $1 where id = $2`, [ADMIN_EMAIL, EVE.id]));
  assert.equal(await isAdmin(EVE), false);
});

test('anon tidak bisa memanggil fungsi trigger pembuat profil', async () => {
  const { as } = await setup();
  await assert.rejects(as(null, 'select public.handle_new_user()'));
});
