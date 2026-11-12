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
