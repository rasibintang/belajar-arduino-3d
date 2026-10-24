import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryBackend } from '../src/account/memory-backend.js';
import { runContract, USERS } from './account-contract.js';

const make = (opts = {}) => {
  const backend = createMemoryBackend({ users: Object.values(USERS), admins: [USERS.admin.email], ...opts });
  return { backend, signInAs: (email) => backend.signInAs(email) };
};

runContract('memori', make);

test('memori: fail → setiap panggilan melempar network', async () => {
  const { backend } = make({ fail: true });
  for (const call of [() => backend.signIn(), () => backend.projects.list(), () => backend.progress.pull(), () => backend.admin.isAdmin()]) {
    await assert.rejects(call(), (err) => err.code === 'network');
  }
});

test('memori: laporan komponen dikelompokkan, terbanyak dulu', async () => {
  const ani = USERS.ani.email;
  const budi = USERS.budi.email;
  const { backend, signInAs } = make({
    seed: { requests: [{ email: ani, component: 'Soil sensor', prompt: 'a' }, { email: budi, component: 'soil sensor', prompt: 'b' }, { email: ani, component: 'Pompa', prompt: 'c' }] },
  });
  await signInAs(USERS.admin.email);
  const rows = await backend.admin.requests();
  assert.deepEqual(rows.map((r) => [r.component, r.requests, r.users]), [['soil sensor', 2, 2], ['pompa', 1, 1]]);
});

test('memori: accessToken null sebelum masuk, ada setelah masuk', async () => {
  const { backend, signInAs } = make();
  assert.equal(await backend.accessToken(), null);
  await signInAs(USERS.ani.email);
  assert.match(await backend.accessToken(), /^fake-token-/);
});

test('memori: kondisi situs hanya data sejak tanggal yang diminta', async () => {
  const { backend, signInAs } = make({
    seed: {
      events: [
        { level: 'error', source: 'browser', kind: 'js', message: 'baru', page: 'home', fingerprint: 'f1', createdAt: '2026-10-25T10:00:00Z' },
        { level: 'warn', source: 'server', kind: 'compile', message: 'lama', page: null, fingerprint: 'f2', createdAt: '2026-10-01T10:00:00Z' },
      ],
      metrics: [{ name: 'load', page: 'home', device: 'desktop', valueMs: 900, ok: true, createdAt: '2026-10-25T10:00:00Z' }],
    },
  });
  await signInAs(USERS.admin.email);
  const h = await backend.admin.health('2026-10-20T00:00:00Z');
  assert.deepEqual(h.events.map((e) => e.message), ['baru']);
  assert.deepEqual(h.metrics.map((m) => m.valueMs), [900]);
});
