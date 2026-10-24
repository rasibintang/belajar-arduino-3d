-- Pengelola hanya akun Google dengan email terverifikasi yang tercantum di tabel admins.
-- Sebelumnya is_admin() memercayai klaim email di token. Akun yang dibuat lewat penyedia lain
-- (mis. email/sandi) dengan email pengelola, atau yang emailnya belum terverifikasi, bisa saja
-- membawa email itu di tokennya. Sekarang yang dibaca adalah baris auth.users milik pemanggil.
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from auth.users u
    join public.admins a on lower(a.email) = lower(u.email)
    where u.id = auth.uid()
      and u.email_confirmed_at is not null
      and coalesce(u.raw_app_meta_data -> 'providers', '[]'::jsonb) ? 'google'
  )
$$;
