// PGlite (Postgres di Node) dengan tiruan bagian Supabase yang dipakai migrasi:
// schema auth (users, uid(), jwt()), peran anon/authenticated/service_role, hak bawaan schema public.
import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const MIGRATIONS = new URL('../../supabase/migrations/', import.meta.url);

const SUPABASE_STUB = `
create schema auth;
create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb not null default '{}'::jsonb,
  raw_app_meta_data jsonb not null default '{}'::jsonb, email_confirmed_at timestamptz);
create function auth.jwt() returns jsonb language sql stable as
  $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
create function auth.uid() returns uuid language sql stable as
  $$ select nullif(auth.jwt() ->> 'sub', '')::uuid $$;
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
grant usage on schema auth to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
`;

/** Database baru: tiruan Supabase + semua migrasi (urut nama berkas). */
export async function freshDb() {
  const db = new PGlite();
  await db.exec(SUPABASE_STUB);
  for (const name of readdirSync(MIGRATIONS).filter((n) => n.endsWith('.sql')).sort()) await db.exec(readFileSync(new URL(name, MIGRATIONS), 'utf8'));
  /** Jalankan sql sebagai pengguna ({ id, email }) atau anon (null). */
  async function as(user, sql, params = []) {
    return db.transaction(async (tx) => {
      const claims = user ? { sub: user.id, email: user.email, role: 'authenticated' } : { role: 'anon' };
      await tx.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify(claims)]);
      await tx.exec(`set local role ${user ? 'authenticated' : 'anon'}`);
      return tx.query(sql, params);
    });
  }
  return { db, as };
}

/** Pengguna baru di auth.users (memicu trigger profil). Bawaan: masuk lewat Google, email terverifikasi. */
export async function addUser(db, { id, email, name, providers = ['google'], confirmed = true }) {
  await db.query(
    `insert into auth.users (id, email, raw_user_meta_data, raw_app_meta_data, email_confirmed_at) values ($1, $2, $3, $4, $5)`,
    [id, email, JSON.stringify({ full_name: name }), JSON.stringify({ provider: providers[0], providers }), confirmed ? new Date().toISOString() : null]
  );
  return { id, email };
}
