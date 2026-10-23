import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryBackend } from '../src/account/memory-backend.js';
import { syncProgress } from '../src/account/progress-sync.js';

/** Store tiruan dengan antarmuka yang sama dengan src/ui/store.js (bagian progres). */
function fakeStore(done) {
  const data = [...done];
  return {
    allDone: () => [...data],
    mergeDone(ids) {
      const before = data.length;
      for (const id of ids) if (!data.includes(id)) data.push(id);
      return data.length > before;
    },
  };
}

test('login pertama menggabungkan progres lokal dan akun', async () => {
  const b = createMemoryBackend({ users: [{ email: 'ani@contoh.test' }] });
  await b.signIn();
  await b.progress.push(['button', 'servo']);
  const store = fakeStore(['blink', 'button']);
  const { added } = await syncProgress(b, store);
  assert.equal(added, 1);
  assert.deepEqual(store.allDone().sort(), ['blink', 'button', 'servo']);
  assert.deepEqual((await b.progress.pull()).sort(), ['blink', 'button', 'servo']);
});

test('gagal jaringan tidak mengubah progres lokal', async () => {
  const b = createMemoryBackend({ users: [{ email: 'ani@contoh.test' }], fail: true });
  const store = fakeStore(['blink']);
  await assert.rejects(syncProgress(b, store), (err) => err.code === 'network');
  assert.deepEqual(store.allDone(), ['blink']);
});
