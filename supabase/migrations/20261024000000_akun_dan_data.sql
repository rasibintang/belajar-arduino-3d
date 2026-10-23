-- Learn Arduino · Akun & data
-- Jalankan sekali di Supabase (SQL Editor). Akses data dijaga Row Level Security:
-- pengguna hanya membaca/menulis miliknya; pengelola (tabel admins) membaca semua tetapi tidak
-- mengubah milik orang lain. Laporan komponen & pemakaian AI hanya ditulis server (service role).

-- ------------------------------------------------------------------ profil pengguna
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz
);

-- profil dibuat otomatis saat akun Google pertama kali masuk
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ------------------------------------------------------------------ pengelola
create table public.admins (email text primary key);

create function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where lower(email) = lower(auth.jwt() ->> 'email'))
$$;

-- ------------------------------------------------------------------ proyek sandbox
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  sketch text not null default '',
  diagram jsonb not null,
  eeprom jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (octet_length(sketch) <= 200000 and octet_length(diagram::text) <= 500000)
);
create index projects_owner_updated on public.projects (owner, updated_at desc);

create function public.touch_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger projects_touch before update on public.projects
  for each row execute function public.touch_updated_at();

-- ------------------------------------------------------------------ progres pelajaran
create table public.lesson_progress (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  lesson_id text not null,
  done_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);

-- ------------------------------------------------------------------ pengaturan (diubah pengelola)
create table public.settings (
  key text primary key,
  value jsonb not null
);
insert into public.settings (key, value) values ('ai_daily_limit', '1');

-- ------------------------------------------------------------------ AI (ditulis server, proyek 3)
create table public.component_requests (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users (id) on delete set null,
  prompt text,
  component text not null,
  created_at timestamptz not null default now()
);

create table public.ai_usage (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  ok boolean not null,
  created_at timestamptz not null default now()
);
create index ai_usage_user_time on public.ai_usage (user_id, created_at desc);

-- ------------------------------------------------------------------ Row Level Security
alter table public.profiles enable row level security;
alter table public.admins enable row level security;
alter table public.projects enable row level security;
alter table public.lesson_progress enable row level security;
alter table public.settings enable row level security;
alter table public.component_requests enable row level security;
alter table public.ai_usage enable row level security;

create policy "profil: baca milik sendiri atau pengelola" on public.profiles
  for select to authenticated using (id = auth.uid() or public.is_admin());
create policy "profil: ubah milik sendiri" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "proyek: baca milik sendiri atau pengelola" on public.projects
  for select to authenticated using (owner = auth.uid() or public.is_admin());
create policy "proyek: buat milik sendiri" on public.projects
  for insert to authenticated with check (owner = auth.uid());
create policy "proyek: ubah milik sendiri" on public.projects
  for update to authenticated using (owner = auth.uid()) with check (owner = auth.uid());
create policy "proyek: hapus milik sendiri" on public.projects
  for delete to authenticated using (owner = auth.uid());

create policy "progres: baca milik sendiri atau pengelola" on public.lesson_progress
  for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "progres: tulis milik sendiri" on public.lesson_progress
  for insert to authenticated with check (user_id = auth.uid());
create policy "progres: ubah milik sendiri" on public.lesson_progress
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "progres: hapus milik sendiri" on public.lesson_progress
  for delete to authenticated using (user_id = auth.uid());

create policy "pengaturan: semua pengguna membaca" on public.settings
  for select to authenticated using (true);
create policy "pengaturan: hanya pengelola mengubah" on public.settings
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "laporan: baca milik sendiri atau pengelola" on public.component_requests
  for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "pemakaian AI: baca milik sendiri atau pengelola" on public.ai_usage
  for select to authenticated using (user_id = auth.uid() or public.is_admin());
-- admins: tanpa kebijakan = tidak bisa dibaca/ditulis lewat API (hanya lewat is_admin())

-- hak tambahan di atas RLS: anon tidak menyentuh apa pun; kolom profil yang boleh diubah dibatasi
revoke all on all tables in schema public from anon;
revoke all on public.admins from authenticated;
revoke insert, update, delete on public.component_requests, public.ai_usage from authenticated;
revoke insert, delete on public.settings from authenticated;
revoke insert, delete, update on public.profiles from authenticated;
grant update (name, avatar_url, last_seen_at) on public.profiles to authenticated;

-- ------------------------------------------------------------------ tampilan untuk halaman pengelola
-- security_invoker: tampilan memakai RLS pemanggil (pengguna biasa hanya melihat miliknya)
create view public.admin_component_requests with (security_invoker = true) as
  select
    lower(component) as component,
    count(*) as requests,
    count(distinct user_id) as users,
    max(created_at) as last_at,
    (array_agg(prompt order by created_at desc))[1:3] as examples
  from public.component_requests
  group by lower(component);

create view public.admin_users with (security_invoker = true) as
  select
    p.id, p.email, p.name, p.avatar_url, p.created_at, p.last_seen_at,
    (select count(*) from public.projects pr where pr.owner = p.id) as projects,
    (select count(*) from public.ai_usage u where u.user_id = p.id and u.ok and u.created_at >= date_trunc('day', now())) as ai_today,
    (select count(*) from public.ai_usage u where u.user_id = p.id and u.ok) as ai_total
  from public.profiles p;

revoke all on public.admin_component_requests, public.admin_users from anon;
grant select on public.admin_component_requests, public.admin_users to authenticated;

-- ------------------------------------------------------------------ menandai pengelola
-- Jalankan sekali dengan email akun Google Anda:
-- insert into public.admins (email) values ('email-google-anda@contoh.com');
