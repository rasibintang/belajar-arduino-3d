// Kontrak antarmuka Backend akun (lihat src/account/memory-backend.js). Setiap backend yang dipakai
// UI harus lolos tes ini. make() → { backend, signInAs(email) } dengan pengguna:
// ani@contoh.test, budi@contoh.test, dan pengelola admin@contoh.test.
import { test } from 'node:test';
import assert from 'node:assert/strict';

export const USERS = {
  ani: { email: 'ani@contoh.test', name: 'Ani' },
  budi: { email: 'budi@contoh.test', name: 'Budi' },
  admin: { email: 'admin@contoh.test', name: 'Pengelola' },
};
const DIAGRAM = { version: 1, parts: [], wires: [] };
const proj = (name, sketch = '') => ({ name, sketch, diagram: DIAGRAM, eeprom: null });
const code = async (p) => {
  try {
    await p;
  } catch (err) {
    return err.code;
  }
  return 'ok';
};

export function runContract(name, make) {
  test(`${name}: masuk dan keluar memicu onAuthChange`, async () => {
    const { backend } = make();
    const seen = [];
    backend.onAuthChange((u) => seen.push(u?.email ?? null));
    assert.equal(backend.user(), null);
    await backend.signIn();
    const email = backend.user()?.email;
    assert.ok(email);
    await backend.signOut();
    assert.equal(backend.user(), null);
    assert.deepEqual(seen, [email, null]);
  });

  test(`${name}: tanpa login → not-signed-in`, async () => {
    const { backend } = make();
    assert.equal(await code(backend.projects.list()), 'not-signed-in');
    assert.equal(await code(backend.progress.pull()), 'not-signed-in');
  });

  test(`${name}: simpan baru, perbarui, daftar terbaru dulu, ubah nama, hapus`, async () => {
    const { backend, signInAs } = make();
    await signInAs(USERS.ani.email);
    const a = await backend.projects.save(proj('A', 'v1'));
    const b = await backend.projects.save(proj('B'));
    assert.ok(a.id && b.id && a.id !== b.id);
    await backend.projects.save({ ...proj('A', 'v2'), id: a.id });
    assert.deepEqual((await backend.projects.list()).map((p) => p.name), ['A', 'B']);
    assert.equal((await backend.projects.get(a.id)).sketch, 'v2');
    await backend.projects.rename(b.id, 'B baru');
    await backend.projects.remove(a.id);
    assert.deepEqual((await backend.projects.list()).map((p) => p.name), ['B baru']);
  });

  test(`${name}: daftar hanya milik sendiri; proyek orang lain → forbidden kecuali pengelola`, async () => {
    const { backend, signInAs } = make();
    await signInAs(USERS.ani.email);
    const { id } = await backend.projects.save(proj('Milik Ani'));
    await signInAs(USERS.budi.email);
    assert.deepEqual(await backend.projects.list(), []);
    assert.equal(await code(backend.projects.get(id)), 'forbidden');
    await signInAs(USERS.admin.email);
    assert.equal((await backend.projects.get(id)).name, 'Milik Ani');
    assert.equal(await code(backend.projects.save({ ...proj('diubah'), id })), 'forbidden');
    assert.equal(await code(backend.projects.remove(id)), 'forbidden');
    await signInAs(USERS.ani.email);
    assert.equal((await backend.projects.get(id)).name, 'Milik Ani');
  });

  test(`${name}: nama kosong → invalid`, async () => {
    const { backend, signInAs } = make();
    await signInAs(USERS.ani.email);
    assert.equal(await code(backend.projects.save(proj('  '))), 'invalid');
  });

  test(`${name}: progres = gabungan tanpa duplikat`, async () => {
    const { backend, signInAs } = make();
    await signInAs(USERS.ani.email);
    await backend.progress.push(['blink', 'button']);
    await backend.progress.push(['button', 'servo']);
    assert.deepEqual((await backend.progress.pull()).sort(), ['blink', 'button', 'servo']);
  });

  test(`${name}: pengaturan & data pengelola hanya untuk pengelola`, async () => {
    const { backend, signInAs } = make();
    await signInAs(USERS.ani.email);
    assert.equal(await backend.admin.isAdmin(), false);
    assert.equal(await code(backend.admin.setLimit(5)), 'forbidden');
    assert.equal(await code(backend.admin.users()), 'forbidden');
    await signInAs(USERS.admin.email);
    assert.equal(await backend.admin.isAdmin(), true);
    assert.equal(await backend.admin.getLimit(), 1);
    await backend.admin.setLimit(3);
    assert.equal(await backend.admin.getLimit(), 3);
    assert.equal(await code(backend.admin.setLimit(-1)), 'invalid');
    assert.equal((await backend.admin.users()).length, 3);
  });

  test(`${name}: kondisi situs hanya untuk pengelola; tanda selesai tersimpan`, async () => {
    const { backend, signInAs } = make();
    await signInAs(USERS.ani.email);
    assert.equal(await code(backend.admin.health(new Date(0).toISOString())), 'forbidden');
    assert.equal(await code(backend.admin.resolve('f1')), 'forbidden');
    await signInAs(USERS.admin.email);
    const h = await backend.admin.health(new Date(0).toISOString());
    for (const key of ['events', 'metrics', 'users', 'projects', 'resolved']) assert.ok(Array.isArray(h[key]), key);
    assert.equal(h.users.length, 3);
    await backend.admin.resolve('f1');
    const again = await backend.admin.health(new Date(0).toISOString());
    assert.deepEqual(again.resolved.map((r) => r.fingerprint), ['f1']);
    assert.ok(Date.parse(again.resolved[0].resolvedAt) > 0);
  });
}
