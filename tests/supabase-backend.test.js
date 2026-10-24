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

/** Klien tiruan dengan pembangun kueri: mencatat panggilan, mengembalikan baris per tabel. */
function queryClient(tables, { admin = true } = {}) {
  const calls = [];
  const client = stubClient().client;
  client.auth.getSession = async () => ({ data: { session: { user: { id: 'u-admin', email: 'admin@contoh.test', user_metadata: {} } } } });
  client.rpc = async (name) => ({ data: name === 'is_admin' ? admin : null, error: null });
  client.from = (table) => {
    const q = { table, ops: [] };
    calls.push(q);
    const chain = new Proxy(
      {},
      {
        get(_, op) {
          if (op === 'then') return (ok, bad) => Promise.resolve({ data: tables[table] ?? [], error: null }).then(ok, bad);
          return (...args) => {
            q.ops.push([op, ...args]);
            return chain;
          };
        },
      }
    );
    return chain;
  };
  return { client, calls };
}

test('supabase: admin.health memetakan kolom dan membatasi sejak tanggal', async () => {
  const { client, calls } = queryClient({
    site_events: [{ level: 'error', source: 'browser', kind: 'js', message: 'boom', page: 'home', device: 'mobile', browser: 'Chrome', fingerprint: 'f1', created_at: '2026-10-25T01:00:00Z' }],
    site_metrics: [{ name: 'load', page: 'home', device: 'mobile', value_ms: 1200, ok: true, created_at: '2026-10-25T01:00:00Z' }],
    profiles: [{ created_at: '2026-10-25T02:00:00Z' }],
    projects: [{ updated_at: '2026-10-25T03:00:00Z' }],
    site_event_resolved: [{ fingerprint: 'f1', resolved_at: '2026-10-25T04:00:00Z' }],
  });
  const backend = await createSupabaseBackend({ url: 'https://x.supabase.co', anonKey: 'k' }, { createClient: () => client });
  await new Promise((r) => setTimeout(r, 0));
  const h = await backend.admin.health('2026-10-24T00:00:00Z');
  assert.deepEqual(h, {
    events: [{ level: 'error', source: 'browser', kind: 'js', message: 'boom', page: 'home', device: 'mobile', browser: 'Chrome', fingerprint: 'f1', createdAt: '2026-10-25T01:00:00Z' }],
    metrics: [{ name: 'load', page: 'home', device: 'mobile', valueMs: 1200, ok: true, createdAt: '2026-10-25T01:00:00Z' }],
    users: [{ createdAt: '2026-10-25T02:00:00Z' }],
    projects: [{ updatedAt: '2026-10-25T03:00:00Z' }],
    resolved: [{ fingerprint: 'f1', resolvedAt: '2026-10-25T04:00:00Z' }],
  });
  for (const t of ['site_events', 'site_metrics', 'profiles', 'projects']) {
    const q = calls.find((c) => c.table === t);
    assert.ok(q.ops.some(([op, , v]) => op === 'gte' && v === '2026-10-24T00:00:00Z'), `${t} dibatasi sejak`);
    assert.ok(q.ops.some(([op]) => op === 'limit'), `${t} dibatasi jumlahnya`);
  }
});

test('supabase: admin.resolve meng-upsert sidik jari; bukan pengelola → forbidden', async () => {
  const { client, calls } = queryClient({});
  const backend = await createSupabaseBackend({ url: 'https://x.supabase.co', anonKey: 'k' }, { createClient: () => client });
  await new Promise((r) => setTimeout(r, 0));
  await backend.admin.resolve('f1');
  const q = calls.find((c) => c.table === 'site_event_resolved');
  assert.equal(q.ops[0][0], 'upsert');
  assert.equal(q.ops[0][1].fingerprint, 'f1');

  const other = queryClient({}, { admin: false });
  const b2 = await createSupabaseBackend({ url: 'https://x.supabase.co', anonKey: 'k' }, { createClient: () => other.client });
  await new Promise((r) => setTimeout(r, 0));
  await assert.rejects(b2.admin.health('2026-10-24T00:00:00Z'), (err) => err.code === 'forbidden');
});
