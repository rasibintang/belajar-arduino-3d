import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSupabaseBackend } from '../src/account/supabase-backend.js';

/** Klien supabase-js tiruan: hanya bagian auth yang dipakai saat membuat backend. */
function stubClient() {
  const stub = { callback: null };
  stub.client = {
    auth: {
      getSession: async () => ({ data: { session: null } }),
      onAuthStateChange: (cb) => {
        stub.callback = cb;
        return { data: { subscription: { unsubscribe() {} } } };
      },
    },
  };
  return stub;
}

test('pendengar login tidak dipanggil di dalam callback onAuthStateChange (hindari deadlock supabase-js)', async () => {
  const stub = stubClient();
  const backend = await createSupabaseBackend({ url: 'https://x.supabase.co', anonKey: 'k' }, { createClient: () => stub.client });
  const seen = [];
  backend.onAuthChange((u) => seen.push(u?.email));
  stub.callback('SIGNED_IN', { user: { id: 'u1', email: 'ani@contoh.test', user_metadata: {} } });
  assert.deepEqual(seen, [], 'tidak boleh sinkron');
  await new Promise((r) => setTimeout(r, 0));
  assert.deepEqual(seen, ['ani@contoh.test']);
  assert.equal(backend.user().email, 'ani@contoh.test');
});
