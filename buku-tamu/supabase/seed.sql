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
