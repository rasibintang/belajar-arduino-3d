// PGlite (Postgres di Node) dengan tiruan bagian Supabase yang dipakai migrasi:
// schema auth (users, uid(), jwt()), peran anon/authenticated/service_role, hak bawaan schema public.
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const MIGRATION = new URL('../../supabase/migrations/20261024000000_akun_dan_data.sql', import.meta.url);

const SUPABASE_STUB = `
create schema auth;
create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb not null default '{}'::jsonb);
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

/** Database baru: tiruan Supabase + migrasi. */
export async function freshDb() {
  const db = new PGlite();
  await db.exec(SUPABASE_STUB);
  await db.exec(readFileSync(MIGRATION, 'utf8'));
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

/** Pengguna baru di auth.users (memicu trigger profil). */
export async function addUser(db, { id, email, name }) {
  await db.query(`insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)`, [id, email, JSON.stringify({ full_name: name })]);
  return { id, email };
}
