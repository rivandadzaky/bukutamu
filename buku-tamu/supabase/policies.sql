-- ============================================================================
-- Row Level Security & hak akses
-- Jalankan setelah supabase/schema.sql
-- ============================================================================

alter table public.buku_tamu enable row level security;
alter table public.profiles enable row level security;

-- ----------------------------------------------------------------------------
-- Helper: cek apakah user yang login adalah admin.
-- SECURITY DEFINER agar tidak memicu rekursi RLS pada tabel profiles.
-- ----------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- ----------------------------------------------------------------------------
-- Hak akses tabel
-- ----------------------------------------------------------------------------
revoke all on public.buku_tamu from anon, authenticated;

grant usage on schema public to anon, authenticated;
grant insert on public.buku_tamu to anon, authenticated;
grant select, update, delete on public.buku_tamu to authenticated;
grant select on public.profiles to authenticated;

grant execute on function public.kunjungan_harian(date, date) to authenticated;
grant execute on function public.kunjungan_bulanan(int) to authenticated;

-- Fungsi agregasi tidak boleh dipanggil tamu (anon).
revoke all on function public.kunjungan_harian(date, date) from public, anon;
revoke all on function public.kunjungan_bulanan(int) from public, anon;

-- ----------------------------------------------------------------------------
-- Policy buku_tamu
-- Tamu (anon): hanya boleh INSERT, tidak boleh membaca data siapa pun.
-- Admin      : boleh SELECT, UPDATE, DELETE.
-- ----------------------------------------------------------------------------
drop policy if exists "buku_tamu_insert_publik" on public.buku_tamu;
create policy "buku_tamu_insert_publik"
  on public.buku_tamu
  for insert
  to anon, authenticated
  with check (true);

drop policy if exists "buku_tamu_select_admin" on public.buku_tamu;
create policy "buku_tamu_select_admin"
  on public.buku_tamu
  for select
  to authenticated
  using (public.is_admin());

drop policy if exists "buku_tamu_update_admin" on public.buku_tamu;
create policy "buku_tamu_update_admin"
  on public.buku_tamu
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "buku_tamu_delete_admin" on public.buku_tamu;
create policy "buku_tamu_delete_admin"
  on public.buku_tamu
  for delete
  to authenticated
  using (public.is_admin());

-- ----------------------------------------------------------------------------
-- Policy profiles
-- Setiap user hanya dapat membaca profilnya sendiri.
-- ----------------------------------------------------------------------------
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles
  for select
  to authenticated
  using (id = auth.uid());

-- ----------------------------------------------------------------------------
-- Catatan operasional:
-- 1. Di Supabase Dashboard -> Authentication -> Providers -> Email,
--    matikan "Enable sign ups" agar tidak ada pendaftaran publik.
-- 2. Buat akun admin melalui Authentication -> Users -> Add user.
-- 3. Promosikan akun tersebut menjadi admin:
--      update public.profiles set role = 'admin' where id = '<USER_UUID>';
-- 4. Jangan pernah memakai service_role key di frontend.
-- ----------------------------------------------------------------------------
