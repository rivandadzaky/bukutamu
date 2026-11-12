-- ============================================================================
-- SETUP LENGKAP - Buku Tamu Digital Puskesmas Bulusan
-- Jalankan SATU KALI di Supabase SQL Editor.
-- Isi: schema.sql + policies.sql + seed.sql (opsional).
-- Aman dijalankan ulang: tabel/policy memakai IF NOT EXISTS / DROP POLICY IF EXISTS,
-- dan seed hanya mengisi jika tabel masih kosong.
-- ============================================================================

-- ===== BAGIAN 1: SCHEMA =====
-- ============================================================================
-- Buku Tamu Digital Puskesmas Bulusan
-- Schema database (jalankan pertama di Supabase SQL Editor)
-- ============================================================================

create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

-- ----------------------------------------------------------------------------
-- Tabel buku_tamu
-- ----------------------------------------------------------------------------
create table if not exists public.buku_tamu (
  id uuid primary key default gen_random_uuid(),
  tanggal date not null default ((now() at time zone 'Asia/Jakarta')::date),
  nama text not null check (char_length(btrim(nama)) between 1 and 120),
  asal_instansi text not null check (char_length(btrim(asal_instansi)) between 1 and 150),
  tujuan text not null check (char_length(btrim(tujuan)) between 1 and 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users (id) on delete set null
);

comment on table public.buku_tamu is 'Data kunjungan tamu Puskesmas Bulusan';
comment on column public.buku_tamu.tanggal is 'Tanggal kunjungan (zona waktu Asia/Jakarta)';

-- ----------------------------------------------------------------------------
-- Tabel profiles
-- ----------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nama text not null default '',
  role text not null default 'staf' check (role in ('admin', 'staf')),
  created_at timestamptz not null default now()
);

comment on table public.profiles is 'Profil pengguna admin/staf yang terhubung ke auth.users';

-- ----------------------------------------------------------------------------
-- Index untuk pencarian dan filter
-- ----------------------------------------------------------------------------
create index if not exists idx_buku_tamu_tanggal
  on public.buku_tamu (tanggal desc, created_at desc);

create index if not exists idx_buku_tamu_nama_trgm
  on public.buku_tamu using gin (nama gin_trgm_ops);

create index if not exists idx_buku_tamu_instansi_trgm
  on public.buku_tamu using gin (asal_instansi gin_trgm_ops);

create index if not exists idx_buku_tamu_tujuan_trgm
  on public.buku_tamu using gin (tujuan gin_trgm_ops);

-- ----------------------------------------------------------------------------
-- Trigger updated_at
-- ----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_buku_tamu_updated_at on public.buku_tamu;
create trigger trg_buku_tamu_updated_at
  before update on public.buku_tamu
  for each row
  execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- Profil otomatis saat user baru dibuat di Supabase Auth
-- Role default adalah 'staf'. Promosikan ke 'admin' secara manual:
--   update public.profiles set role = 'admin' where id = '<USER_UUID>';
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, nama, role)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'nama', ''), split_part(coalesce(new.email, 'pengguna'), '@', 1)),
    'staf'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- Fungsi agregasi untuk grafik (dipakai dashboard & laporan)
-- ----------------------------------------------------------------------------
create or replace function public.kunjungan_harian(p_start date, p_end date)
returns table (tanggal date, jumlah bigint)
language sql
stable
as $$
  select d::date as tanggal, count(bt.id) as jumlah
  from generate_series(p_start, p_end, interval '1 day') as d
  left join public.buku_tamu bt on bt.tanggal = d::date
  group by d
  order by d;
$$;

create or replace function public.kunjungan_bulanan(p_tahun int)
returns table (bulan int, jumlah bigint)
language sql
stable
as $$
  select m as bulan, count(bt.id) as jumlah
  from generate_series(1, 12) as m
  left join public.buku_tamu bt
    on bt.tanggal >= make_date(p_tahun, m, 1)
   and bt.tanggal < (make_date(p_tahun, m, 1) + interval '1 month')
  group by m
  order by m;
$$;


-- ===== BAGIAN 2: RLS & HAK AKSES =====
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


-- ===== BAGIAN 3: SEED (OPSIONAL) =====
-- ============================================================================
-- Seed data (opsional)
-- Jalankan setelah schema.sql dan policies.sql.
-- ============================================================================

-- Hanya mengisi data contoh jika tabel masih kosong.
do $$
begin
  if (select count(*) from public.buku_tamu) = 0 then
    insert into public.buku_tamu (tanggal, nama, asal_instansi, tujuan, created_at) values
      (current_date, 'Siti Rahmawati', 'Universitas Diponegoro', 'Survei/magang mahasiswa', now() - interval '35 minutes'),
      (current_date, 'Bagus Prakoso', 'Dinas Kesehatan Kab. Semarang', 'Kunjungan dinas', now() - interval '2 hours'),
      (current_date, 'Rina Kusuma', 'Masyarakat Umum', 'Konsultasi program kesehatan', now() - interval '3 hours'),
      (current_date, 'Ahmad Fauzi', 'Kader Posyandu Bulusan', 'Koordinasi kegiatan posyandu', now() - interval '4 hours'),
      (current_date - 1, 'Dewi Lestari', 'PKK Desa Bulusan', 'Rapat lintas sektor', ((current_date - 1) + time '10:15') at time zone 'Asia/Jakarta'),
      (current_date - 1, 'Yoga Pratama', 'PT Kimia Farma', 'Pengiriman dokumen', ((current_date - 1) + time '11:40') at time zone 'Asia/Jakarta'),
      (current_date - 2, 'Nur Aisyah', 'Politeknik Kesehatan Semarang', 'Survei/magang mahasiswa', ((current_date - 2) + time '08:50') at time zone 'Asia/Jakarta'),
      (current_date - 3, 'Hendra Wijaya', 'RSUD Ungaran', 'Kunjungan dinas', ((current_date - 3) + time '13:10') at time zone 'Asia/Jakarta'),
      (current_date - 5, 'Maya Puspita', 'SD Negeri Bulusan', 'Pemeriksaan kesehatan', ((current_date - 5) + time '09:30') at time zone 'Asia/Jakarta'),
      (current_date - 8, 'Rizky Maulana', 'Kantor Kecamatan Tuntang', 'Pengambilan surat keterangan', ((current_date - 8) + time '10:05') at time zone 'Asia/Jakarta');
  end if;
end;
$$;

-- ============================================================================
-- Membuat akun admin
-- ============================================================================
-- 1. Buka Supabase Dashboard -> Authentication -> Users -> Add user.
--    Isi email dan password admin, lalu konfirmasi email jika diminta.
-- 2. Salin UUID user tersebut, lalu jalankan:
--
--      update public.profiles
--      set role = 'admin',
--          nama = 'Administrator Puskesmas'
--      where id = '<USER_UUID>';
--
-- 3. Pastikan login berhasil di halaman login.html.

