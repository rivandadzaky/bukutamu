/* Inisialisasi Supabase client (jika dikonfigurasi). */
(function () {
  'use strict';

  const cfg = window.APP_CONFIG || {};
  const url = String(cfg.SUPABASE_URL || '').trim().replace(/\/+$/, '');
  const key = String(cfg.SUPABASE_ANON_KEY || '').trim();
  const looksValid = /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url) && key.length > 30;

  if (looksValid && window.supabase && typeof window.supabase.createClient === 'function') {
    window.SB = window.supabase.createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    });
    console.info('[Buku Tamu] Terhubung ke Supabase:', url);
  } else {
    window.SB = null;
    if (url || key) {
      console.warn('[Buku Tamu] Konfigurasi Supabase tidak lengkap. Aplikasi berjalan dalam mode demo.');
    } else {
      console.info('[Buku Tamu] Mode demo aktif (data disimpan di browser).');
    }
  }
})();
