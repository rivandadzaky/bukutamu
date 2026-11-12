/**
 * Konfigurasi aplikasi.
 *
 * 1. Buat project di https://supabase.com
 * 2. Salin Project URL dan anon (publishable) key dari
 *    Project Settings -> API
 * 3. Isi dua nilai di bawah ini (boleh juga lewat window.__ENV__ saat deploy).
 *
 * CATATAN KEAMANAN:
 * - Hanya gunakan anon/publishable key di frontend.
 * - JANGAN pernah menaruh service_role key di file ini.
 */
window.APP_CONFIG = {
  SUPABASE_URL: 'https://dmzeckumdtpwlgupylio.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_gKdsSW7BeL8e0fQjzymmtQ_a_w-IAyh',

  APP_NAME: 'Buku Tamu Digital',
  PUSKESMAS: 'Puskesmas Bulusan',
  WILAYAH: 'Kabupaten Semarang',
  ZONA_WAKTU: 'Asia/Jakarta',
};
