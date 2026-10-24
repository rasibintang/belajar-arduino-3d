-- Pemantauan situs (tab "Kondisi situs" di halaman pengelola).
-- Ditulis hanya oleh server (/api/log, /api/compile, /api/ai) lewat service role; dibaca pengelola.
-- Tidak menyimpan isi sketch, perintah AI, kunci API, atau email. Data > 30 hari dihapus /api/log.

create table public.site_events (
  id bigint generated always as identity primary key,
  level text not null check (level in ('error', 'warn')),
  source text not null check (source in ('browser', 'server')),
  kind text not null,
  message text not null,
  page text,
  device text,
  browser text,
  fingerprint text not null,
  created_at timestamptz not null default now()
);
create index site_events_time on public.site_events (created_at desc);

create table public.site_metrics (
  id bigint generated always as identity primary key,
  name text not null check (name in ('load', 'compile', 'ai')),
  page text,
  device text,
  value_ms integer not null,
  ok boolean not null default true,
  created_at timestamptz not null default now()
);
create index site_metrics_time on public.site_metrics (created_at desc);

-- kelompok kejadian yang ditandai "Selesai"; tampil lagi bila ada kejadian setelah resolved_at
create table public.site_event_resolved (
  fingerprint text primary key,
  resolved_at timestamptz not null default now()
);

alter table public.site_events enable row level security;
alter table public.site_metrics enable row level security;
alter table public.site_event_resolved enable row level security;

create policy "kejadian situs: pengelola membaca" on public.site_events
  for select to authenticated using (public.is_admin());
create policy "metrik situs: pengelola membaca" on public.site_metrics
  for select to authenticated using (public.is_admin());
create policy "kejadian selesai: pengelola membaca" on public.site_event_resolved
  for select to authenticated using (public.is_admin());
create policy "kejadian selesai: pengelola menandai" on public.site_event_resolved
  for insert to authenticated with check (public.is_admin());
create policy "kejadian selesai: pengelola memperbarui" on public.site_event_resolved
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

revoke all on public.site_events, public.site_metrics, public.site_event_resolved from anon;
revoke insert, update, delete on public.site_events, public.site_metrics from authenticated;
revoke delete on public.site_event_resolved from authenticated;
