import { AccountError } from './errors.js';

/**
 * Backend akun di memori: aturan aksesnya sama dengan RLS di supabase/migrations (pemilik saja;
 * pengelola membaca semua tetapi tidak mengubah milik orang lain). Dipakai tes dan `?fakeauth=1`
 * saat pengembangan.
 *
 * Antarmuka Backend (dipenuhi juga oleh supabase-backend.js):
 *   user() · onAuthChange(fn) · signIn() · signOut() · touch() · accessToken()
 *   projects.list/get/save/rename/remove · progress.pull/push
 *   admin.isAdmin/requests/projects/users/getLimit/setLimit
 * Semua metode async melempar AccountError.
 *
 * opts: { users: [{ email, name }], admins: [email], fail, seed: { requests, usage, projects } }
 */
export function createMemoryBackend({ users = [], admins = [], fail = false, seed = {} } = {}) {
  const accounts = users.map((u, i) => ({ id: `user-${i + 1}`, email: u.email, name: u.name ?? u.email, avatarUrl: null, lastSeenAt: null }));
  const byEmail = (email) => accounts.find((a) => a.email === email);
  const projects = new Map(); // id -> { id, owner, name, sketch, diagram, eeprom, updatedAt }
  const progress = new Map(); // userId -> Set
  const settings = { ai_daily_limit: 1 };
  const requests = (seed.requests ?? []).map((r) => ({ userId: byEmail(r.email)?.id ?? null, prompt: r.prompt ?? '', component: r.component, createdAt: r.createdAt ?? new Date().toISOString() }));
  const usage = (seed.usage ?? []).map((u) => ({ userId: byEmail(u.email)?.id, ok: u.ok ?? true, createdAt: u.createdAt ?? new Date().toISOString() }));
  const listeners = new Set();
  let current = null;
  let seq = 0;
  let clock = Date.parse('2026-10-24T00:00:00Z');
  const now = () => new Date((clock += 1000)).toISOString();

  for (const p of seed.projects ?? []) {
    const id = p.id ?? `p${++seq}`;
    projects.set(id, { id, owner: byEmail(p.email).id, name: p.name, sketch: p.sketch ?? '', diagram: p.diagram ?? { version: 1, parts: [], wires: [] }, eeprom: null, updatedAt: now() });
  }

  const clone = (v) => JSON.parse(JSON.stringify(v));
  const isAdmin = () => !!current && admins.includes(current.email);
  async function guard() {
    if (fail) throw new AccountError('network', 'tidak dapat menghubungi server');
    if (!current) throw new AccountError('not-signed-in');
  }
  async function adminGuard() {
    await guard();
    if (!isAdmin()) throw new AccountError('forbidden');
  }
  function setUser(acc) {
    current = acc;
    for (const fn of listeners) fn(acc ? { ...acc } : null);
  }
  function mine(id) {
    const p = projects.get(id);
    if (!p || p.owner !== current.id) throw new AccountError('forbidden');
    return p;
  }
  function checkName(name) {
    const n = String(name ?? '').trim();
    if (!n || n.length > 80) throw new AccountError('invalid', 'nama proyek 1–80 karakter');
    return n;
  }

  return {
    user: () => (current ? { ...current } : null),
    onAuthChange(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    async signIn() {
      if (fail) throw new AccountError('network');
      setUser(accounts[0] ?? null);
    },
    /** Khusus backend memori: masuk sebagai akun tertentu. */
    async signInAs(email) {
      if (fail) throw new AccountError('network');
      setUser(byEmail(email) ?? null);
    },
    async signOut() {
      setUser(null);
    },
    async touch() {
      await guard();
      current.lastSeenAt = now();
    },
    /** Token untuk fungsi server (backend memori: token palsu). */
    async accessToken() {
      return current ? `fake-token-${current.id}` : null;
    },

    projects: {
      async list() {
        await guard();
        return [...projects.values()]
          .filter((p) => p.owner === current.id)
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
          .map(({ id, name, updatedAt }) => ({ id, name, updatedAt }));
      },
      async get(id) {
        await guard();
        const p = projects.get(id);
        if (!p || (p.owner !== current.id && !isAdmin())) throw new AccountError('forbidden');
        return clone(p);
      },
      async save({ id, name, sketch = '', diagram, eeprom = null }) {
        await guard();
        const clean = checkName(name);
        if (id) {
          const p = mine(id);
          Object.assign(p, { name: clean, sketch, diagram: clone(diagram), eeprom: clone(eeprom), updatedAt: now() });
          return { id, updatedAt: p.updatedAt };
        }
        const p = { id: `p${++seq}`, owner: current.id, name: clean, sketch, diagram: clone(diagram), eeprom: clone(eeprom), updatedAt: now() };
        projects.set(p.id, p);
        return { id: p.id, updatedAt: p.updatedAt };
      },
      async rename(id, name) {
        await guard();
        const p = mine(id);
        p.name = checkName(name);
        p.updatedAt = now();
      },
      async remove(id) {
        await guard();
        mine(id);
        projects.delete(id);
      },
    },

    progress: {
      async pull() {
        await guard();
        return [...(progress.get(current.id) ?? [])];
      },
      async push(ids) {
        await guard();
        if (!progress.has(current.id)) progress.set(current.id, new Set());
        for (const id of ids) progress.get(current.id).add(id);
      },
    },

    admin: {
      async isAdmin() {
        await guard();
        return isAdmin();
      },
      async requests() {
        await adminGuard();
        const groups = new Map();
        for (const r of requests) {
          const key = r.component.toLowerCase();
          const g = groups.get(key) ?? { component: key, requests: 0, users: new Set(), lastAt: '', examples: [] };
          g.requests++;
          g.users.add(r.userId);
          if (r.createdAt > g.lastAt) g.lastAt = r.createdAt;
          g.examples.unshift(r.prompt);
          groups.set(key, g);
        }
        return [...groups.values()]
          .map((g) => ({ ...g, users: g.users.size, examples: g.examples.slice(0, 3) }))
          .sort((a, b) => b.requests - a.requests);
      },
      async projects() {
        await adminGuard();
        return [...projects.values()]
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
          .map((p) => ({ id: p.id, name: p.name, ownerEmail: accounts.find((a) => a.id === p.owner)?.email ?? '', updatedAt: p.updatedAt }));
      },
      async users() {
        await adminGuard();
        const today = new Date().toISOString().slice(0, 10);
        return accounts.map((a) => {
          const ok = usage.filter((u) => u.userId === a.id && u.ok);
          return {
            id: a.id,
            email: a.email,
            name: a.name,
            projects: [...projects.values()].filter((p) => p.owner === a.id).length,
            aiToday: ok.filter((u) => u.createdAt.slice(0, 10) === today).length,
            aiTotal: ok.length,
            lastSeenAt: a.lastSeenAt,
          };
        });
      },
      async getLimit() {
        await guard();
        return settings.ai_daily_limit;
      },
      async setLimit(n) {
        await adminGuard();
        if (!Number.isInteger(n) || n < 0 || n > 100) throw new AccountError('invalid', 'batas 0–100');
        settings.ai_daily_limit = n;
      },
    },
  };
}
