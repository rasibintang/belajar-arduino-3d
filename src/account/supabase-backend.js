// Backend akun sungguhan (Supabase). Satu-satunya berkas yang mengimpor @supabase/supabase-js;
// dimuat malas oleh index.js hanya bila VITE_SUPABASE_URL/ANON_KEY terisi.
// Akses data dijaga RLS (supabase/migrations); pemeriksaan di sini hanya untuk pesan yang jelas.
import { createClient } from '@supabase/supabase-js';
import { AccountError } from './errors.js';
import { fromProjectRow, toProjectRow, toAccountError } from './supabase-map.js';

const toUser = (u) =>
  u && {
    id: u.id,
    email: u.email,
    name: u.user_metadata?.full_name ?? u.user_metadata?.name ?? u.email,
    avatarUrl: u.user_metadata?.avatar_url ?? null,
  };

/** Backend Supabase (lihat antarmuka di memory-backend.js). */
export async function createSupabaseBackend({ url, anonKey }) {
  const client = createClient(url, anonKey, { auth: { persistSession: true, detectSessionInUrl: true, flowType: 'pkce' } });
  const listeners = new Set();
  let current = null;
  let admin = null; // cache is_admin() per pengguna

  try {
    const { data } = await client.auth.getSession();
    current = toUser(data.session?.user) ?? null;
  } catch {
    current = null; // sesi rusak/tidak terbaca: anggap belum masuk
  }
  client.auth.onAuthStateChange((_event, session) => {
    const next = toUser(session?.user) ?? null;
    if (next?.id === current?.id) return;
    current = next;
    admin = null;
    for (const fn of listeners) fn(current && { ...current });
  });

  /** Jalankan kueri supabase-js; error apa pun → AccountError. */
  async function run(query) {
    let res;
    try {
      res = await query;
    } catch (err) {
      throw toAccountError(err);
    }
    if (res.error) throw toAccountError(res.error);
    return res.data;
  }
  function uid() {
    if (!current) throw new AccountError('not-signed-in');
    return current.id;
  }
  function cleanName(name) {
    const n = String(name ?? '').trim();
    if (!n || n.length > 80) throw new AccountError('invalid', 'nama proyek 1–80 karakter');
    return n;
  }
  const changed = (rows) => {
    if (!rows?.length) throw new AccountError('forbidden');
  };
  async function isAdmin() {
    uid();
    if (admin === null) admin = !!(await run(client.rpc('is_admin')));
    return admin;
  }
  async function adminOnly() {
    if (!(await isAdmin())) throw new AccountError('forbidden');
  }

  return {
    user: () => current && { ...current },
    onAuthChange(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    async signIn() {
      await run(client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.href } }));
    },
    async signOut() {
      await run(client.auth.signOut());
    },
    async touch() {
      await run(client.from('profiles').update({ last_seen_at: new Date().toISOString() }).eq('id', uid()));
    },

    projects: {
      async list() {
        const rows = await run(client.from('projects').select('id, name, updated_at').eq('owner', uid()).order('updated_at', { ascending: false }));
        return rows.map((r) => ({ id: r.id, name: r.name, updatedAt: r.updated_at }));
      },
      async get(id) {
        uid();
        const row = await run(client.from('projects').select('*').eq('id', id).maybeSingle());
        if (!row) throw new AccountError('forbidden');
        return fromProjectRow(row);
      },
      async save(project) {
        const owner = uid();
        const row = { ...toProjectRow(project), name: cleanName(project.name) };
        if (project.id) {
          const rows = await run(client.from('projects').update(row).eq('id', project.id).eq('owner', owner).select('id, updated_at'));
          changed(rows);
          return { id: rows[0].id, updatedAt: rows[0].updated_at };
        }
        const created = await run(client.from('projects').insert(row).select('id, updated_at').single());
        return { id: created.id, updatedAt: created.updated_at };
      },
      async rename(id, name) {
        changed(await run(client.from('projects').update({ name: cleanName(name) }).eq('id', id).eq('owner', uid()).select('id')));
      },
      async remove(id) {
        changed(await run(client.from('projects').delete().eq('id', id).eq('owner', uid()).select('id')));
      },
    },

    progress: {
      async pull() {
        const rows = await run(client.from('lesson_progress').select('lesson_id').eq('user_id', uid()));
        return rows.map((r) => r.lesson_id);
      },
      async push(ids) {
        const user = uid();
        if (!ids.length) return;
        await run(
          client.from('lesson_progress').upsert(
            ids.map((lesson_id) => ({ user_id: user, lesson_id })),
            { onConflict: 'user_id,lesson_id', ignoreDuplicates: true }
          )
        );
      },
    },

    admin: {
      isAdmin,
      async requests() {
        await adminOnly();
        const rows = await run(client.from('admin_component_requests').select('*').order('requests', { ascending: false }));
        return rows.map((r) => ({ component: r.component, requests: Number(r.requests), users: Number(r.users), lastAt: r.last_at, examples: r.examples ?? [] }));
      },
      async projects() {
        await adminOnly();
        const [rows, people] = await Promise.all([
          run(client.from('projects').select('id, name, owner, updated_at').order('updated_at', { ascending: false })),
          run(client.from('profiles').select('id, email')),
        ]);
        const email = new Map(people.map((p) => [p.id, p.email]));
        return rows.map((r) => ({ id: r.id, name: r.name, ownerEmail: email.get(r.owner) ?? '', updatedAt: r.updated_at }));
      },
      async users() {
        await adminOnly();
        const rows = await run(client.from('admin_users').select('*').order('last_seen_at', { ascending: false, nullsFirst: false }));
        return rows.map((r) => ({
          id: r.id,
          email: r.email,
          name: r.name,
          projects: Number(r.projects),
          aiToday: Number(r.ai_today),
          aiTotal: Number(r.ai_total),
          lastSeenAt: r.last_seen_at,
        }));
      },
      async getLimit() {
        uid();
        const row = await run(client.from('settings').select('value').eq('key', 'ai_daily_limit').maybeSingle());
        return Number(row?.value ?? 1);
      },
      async setLimit(n) {
        await adminOnly();
        if (!Number.isInteger(n) || n < 0 || n > 100) throw new AccountError('invalid', 'batas 0–100');
        changed(await run(client.from('settings').update({ value: n }).eq('key', 'ai_daily_limit').select('key')));
      },
    },
  };
}
