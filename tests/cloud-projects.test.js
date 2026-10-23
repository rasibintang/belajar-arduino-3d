import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryBackend } from '../src/account/memory-backend.js';
import { saveToAccount, openFromAccount, createAutosave } from '../src/account/cloud-projects.js';

const USERS = [{ email: 'ani@contoh.test' }, { email: 'admin@contoh.test' }];
const make = (opts) => createMemoryBackend({ users: USERS, admins: ['admin@contoh.test'], ...opts });
const project = (sketch = 'v1') => ({ name: 'Lampu', sketch, diagram: { version: 1, parts: [], wires: [] }, eeprom: null });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

test('simpan ke akun membuat proyek baru lalu memperbaruinya', async () => {
  const b = make();
  await b.signInAs('ani@contoh.test');
  const saved = await saveToAccount(b, project('v1'));
  assert.ok(saved.cloudId);
  const again = await saveToAccount(b, { ...saved, sketch: 'v2' });
  assert.equal(again.cloudId, saved.cloudId);
  const list = await b.projects.list();
  assert.equal(list.length, 1);
  assert.equal((await b.projects.get(saved.cloudId)).sketch, 'v2');
});

test('membuka salinan tidak membawa id pemilik', async () => {
  const b = make();
  await b.signInAs('ani@contoh.test');
  const { cloudId } = await saveToAccount(b, project('asli'));
  await b.signInAs('admin@contoh.test');
  const copy = await openFromAccount(b, cloudId, { copy: true, copyName: (n) => `Salinan — ${n}` });
  assert.equal(copy.cloudId, undefined);
  assert.equal(copy.name, 'Salinan — Lampu');
  assert.equal(copy.sketch, 'asli');
  const mine = await saveToAccount(b, { ...copy, sketch: 'diubah' });
  assert.notEqual(mine.cloudId, cloudId);
  await b.signInAs('ani@contoh.test');
  assert.equal((await b.projects.get(cloudId)).sketch, 'asli');
});

test('membuka milik sendiri membawa cloudId', async () => {
  const b = make();
  await b.signInAs('ani@contoh.test');
  const { cloudId } = await saveToAccount(b, project());
  assert.equal((await openFromAccount(b, cloudId)).cloudId, cloudId);
});

test('simpan otomatis melewati proyek tanpa cloudId', async () => {
  const b = make();
  await b.signInAs('ani@contoh.test');
  const auto = createAutosave(b, { delayMs: 5 });
  auto.schedule(project());
  await auto.flush();
  assert.deepEqual(await b.projects.list(), []);
});

test('simpan otomatis menulis versi terakhir setelah jeda', async () => {
  const b = make();
  await b.signInAs('ani@contoh.test');
  const saved = await saveToAccount(b, project('v1'));
  const auto = createAutosave(b, { delayMs: 5 });
  auto.schedule({ ...saved, sketch: 'v2' });
  auto.schedule({ ...saved, sketch: 'v3' });
  await wait(30);
  await auto.flush();
  assert.equal((await b.projects.get(saved.cloudId)).sketch, 'v3');
});

test('simpan otomatis gagal melapor sekali dan tidak melempar', async () => {
  const b = make({ fail: true });
  const errors = [];
  const auto = createAutosave(b, { delayMs: 5, onError: (e) => errors.push(e.code) });
  const p = { ...project(), cloudId: 'p1' };
  for (let i = 0; i < 3; i++) {
    auto.schedule(p);
    await auto.flush();
  }
  assert.deepEqual(errors, ['network']);
});
