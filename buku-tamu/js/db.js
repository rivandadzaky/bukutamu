/**
 * Lapisan data aplikasi.
 *
 * - Jika Supabase dikonfigurasi  -> memakai Supabase Auth + PostgreSQL + RLS.
 * - Jika belum dikonfigurasi     -> memakai backend demo berbasis localStorage,
 *                                   agar website bisa langsung dicoba.
 *
 * Semua halaman hanya berkomunikasi lewat window.DB.
 */
(function () {
  'use strict';

  const U = window.Utils;
  const HAS_SB = !!window.SB;
  const DEMO_ROWS_KEY = 'bt_demo_rows_v1';
  const DEMO_SESSION_KEY = 'bt_demo_session_v1';

  const DEMO_ACCOUNT = {
    id: 'demo-admin-0001',
    email: 'admin@puskesmas.test',
    password: 'admin123',
    nama: 'Administrator Puskesmas',
  };

  /* ------------------------------------------------------------------ */
  /* Pesan error yang ramah pengguna                                    */
  /* ------------------------------------------------------------------ */

  function friendly(error, fallback) {
    const raw = String((error && (error.message || error.error_description || error.details)) || '');
    if (/failed to fetch|networkerror|network request|load failed/i.test(raw)) {
      return 'Koneksi ke server gagal. Periksa internet Anda lalu coba lagi.';
    }
    if (/invalid login credentials/i.test(raw)) return 'Email atau password salah.';
    if (/email not confirmed/i.test(raw)) return 'Email belum dikonfirmasi. Hubungi administrator.';
    if (/rate limit|too many requests/i.test(raw)) return 'Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi.';
    if (/row-level security|permission denied|new row violates/i.test(raw)) {
      return 'Akses ditolak. Pastikan akun Anda memiliki hak admin dan RLS sudah dikonfigurasi.';
    }
    if (/duplicate key/i.test(raw)) return 'Data yang sama sudah ada.';
    return fallback || 'Terjadi kesalahan. Silakan coba lagi.';
  }

  /* ------------------------------------------------------------------ */
  /* Backend demo (localStorage)                                        */
  /* ------------------------------------------------------------------ */

  const NAMA_DEPAN = ['Andi', 'Budi', 'Citra', 'Dewi', 'Eko', 'Fitri', 'Galih', 'Hesti', 'Indra', 'Joko', 'Kartika', 'Lukman', 'Maya', 'Nanda', 'Putri', 'Rahmat', 'Sari', 'Teguh', 'Umi', 'Wahyu', 'Yani', 'Zaki'];
  const NAMA_BELAKANG = ['Pratama', 'Saputra', 'Wijaya', 'Lestari', 'Nugroho', 'Handayani', 'Kurniawan', 'Safitri', 'Maulana', 'Puspita', 'Ramadhan', 'Anggraeni'];
  const INSTANSI = [
    'Universitas Diponegoro',
    'Universitas Negeri Semarang',
    'Dinas Kesehatan Kab. Semarang',
    'Puskesmas Ungaran',
    'RSUD Ungaran',
    'Politeknik Kesehatan Semarang',
    'Kantor Kecamatan Tuntang',
    'SD Negeri Bulusan',
    'PKK Desa Bulusan',
    'Vendor Alat Kesehatan',
    'PT Kimia Farma',
    'Masyarakat Umum',
    'Kader Posyandu Bulusan',
    'Bidan Desa Bulusan',
  ];
  const TUJUAN = [
    'Konsultasi program kesehatan',
    'Koordinasi kegiatan posyandu',
    'Kunjungan dinas',
    'Pengambilan surat keterangan',
    'Survei/magang mahasiswa',
    'Pemeriksaan kesehatan',
    'Rapat lintas sektor',
    'Pengiriman dokumen',
    'Pengambilan obat',
    'Konsultasi gizi',
  ];

  function makeRandom(seed) {
    let s = seed || 1;
    return function random() {
      s |= 0;
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function makeId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      return window.crypto.randomUUID();
    }
    return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  }

  function buildDemoRows() {
    const random = makeRandom(20261112);
    const pick = (list) => list[Math.floor(random() * list.length)];
    const rows = [];
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let counter = 0;

    for (let back = 0; back < 400; back += 1) {
      const date = new Date(today);
      date.setDate(today.getDate() - back);
      const dow = date.getDay();
      let base = dow === 0 ? 1 : dow === 6 ? 2.4 : 4.2;
      let count = Math.max(0, Math.round(base + (random() * 4 - 1.6)));
      if (back === 0) count = Math.max(count, 7);
      if (back > 330) count = Math.max(0, Math.round(count * 0.6));

      for (let i = 0; i < count; i += 1) {
        const nama = `${pick(NAMA_DEPAN)} ${pick(NAMA_BELAKANG)}`;
        const jam = 7 + Math.floor(random() * 8);
        const menit = Math.floor(random() * 60);
        const created = new Date(date.getFullYear(), date.getMonth(), date.getDate(), jam, menit, 0);
        rows.push({
          id: `demo-${String(++counter).padStart(4, '0')}`,
          tanggal: U.isoDate(date),
          nama,
          asal_instansi: pick(INSTANSI),
          tujuan: pick(TUJUAN),
          created_at: created.toISOString(),
          updated_at: created.toISOString(),
          created_by: null,
        });
      }
    }
    return rows;
  }

  function readDemoRows() {
    try {
      const raw = localStorage.getItem(DEMO_ROWS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length) return parsed;
      }
    } catch (err) {
      console.warn('[Buku Tamu] Data demo tidak dapat dibaca, membuat ulang.');
    }
    const rows = buildDemoRows();
    try {
      localStorage.setItem(DEMO_ROWS_KEY, JSON.stringify(rows));
    } catch (err) {
      console.warn('[Buku Tamu] Penyimpanan browser tidak tersedia.', err);
    }
    return rows;
  }

  function writeDemoRows(rows) {
    try {
      localStorage.setItem(DEMO_ROWS_KEY, JSON.stringify(rows));
    } catch (err) {
      throw new Error('Penyimpanan browser penuh atau diblokir. Data tidak dapat disimpan.');
    }
  }

  function demoFilter({ search = '', from = '', to = '' } = {}) {
    const q = String(search || '').trim().toLowerCase();
    return readDemoRows().filter((row) => {
      if (from && row.tanggal < from) return false;
      if (to && row.tanggal > to) return false;
      if (!q) return true;
      return [row.nama, row.asal_instansi, row.tujuan]
        .some((value) => String(value || '').toLowerCase().includes(q));
    });
  }

  function sortRows(rows, order = 'desc') {
    return rows.slice().sort((a, b) => {
      const cmp = String(a.tanggal).localeCompare(String(b.tanggal)) ||
        String(a.created_at).localeCompare(String(b.created_at));
      return order === 'asc' ? cmp : -cmp;
    });
  }

  function fillDays(start, end, counts) {
    const result = [];
    let cursor = start;
    let safety = 0;
    while (cursor <= end && safety < 1000) {
      result.push({ tanggal: cursor, jumlah: counts[cursor] || 0 });
      cursor = U.addDays(cursor, 1);
      safety += 1;
    }
    return result;
  }

  function fillMonths(counts) {
    return Array.from({ length: 12 }, (_, i) => ({ bulan: i + 1, jumlah: counts[i + 1] || 0 }));
  }

  function demoStats() {
    const rows = readDemoRows();
    const today = U.todayISO();
    const monthPrefix = today.slice(0, 7);
    const yearPrefix = today.slice(0, 4);
    let day = 0;
    let month = 0;
    let year = 0;
    rows.forEach((row) => {
      if (row.tanggal === today) day += 1;
      if (String(row.tanggal).startsWith(monthPrefix)) month += 1;
      if (String(row.tanggal).startsWith(yearPrefix)) year += 1;
    });
    return { today: day, month, year, total: rows.length };
  }

  /* ------------------------------------------------------------------ */
  /* Backend Supabase                                                   */
  /* ------------------------------------------------------------------ */

  async function sbProfile(userId) {
    const { data, error } = await window.SB
      .from('profiles')
      .select('nama, role')
      .eq('id', userId)
      .maybeSingle();
    if (error) {
      console.warn('[Buku Tamu] Gagal memuat profil:', error.message);
      return null;
    }
    return data;
  }

  function sbDateRange(query, from, to) {
    let q = query;
    if (from) q = q.gte('tanggal', from);
    if (to) q = q.lte('tanggal', to);
    return q;
  }

  function sanitizeSearch(value) {
    return String(value || '').trim().replace(/[,()%\\]/g, ' ').slice(0, 80);
  }

  async function sbCount(from, to) {
    const base = window.SB
      .from('buku_tamu')
      .select('id', { count: 'exact', head: true });
    const { count, error } = await sbDateRange(base, from, to);
    if (error) throw new Error(friendly(error, 'Gagal menghitung data kunjungan.'));
    return count || 0;
  }

  async function sbList({ search = '', from = '', to = '', page = 1, pageSize = 10, order = 'desc' } = {}) {
    const start = (Math.max(1, page) - 1) * pageSize;
    let query = window.SB.from('buku_tamu').select('*', { count: 'exact' });
    query = sbDateRange(query, from, to);
    const q = sanitizeSearch(search);
    if (q) {
      query = query.or(`nama.ilike.%${q}%,asal_instansi.ilike.%${q}%,tujuan.ilike.%${q}%`);
    }
    query = query.order('tanggal', { ascending: order === 'asc' }).order('created_at', { ascending: order === 'asc' });
    query = query.range(start, start + pageSize - 1);

    const { data, count, error } = await query;
    if (error) throw new Error(friendly(error, 'Gagal memuat data buku tamu.'));
    return { rows: data || [], total: count || 0 };
  }

  async function sbListAll({ search = '', from = '', to = '', order = 'asc', limit = 5000 } = {}) {
    let query = window.SB.from('buku_tamu').select('*');
    query = sbDateRange(query, from, to);
    const q = sanitizeSearch(search);
    if (q) {
      query = query.or(`nama.ilike.%${q}%,asal_instansi.ilike.%${q}%,tujuan.ilike.%${q}%`);
    }
    query = query.order('tanggal', { ascending: order === 'asc' }).order('created_at', { ascending: order === 'asc' });
    query = query.limit(limit);
    const { data, error } = await query;
    if (error) throw new Error(friendly(error, 'Gagal memuat data untuk diekspor.'));
    return data || [];
  }

  async function sbCountByDay(start, end) {
    const { data, error } = await window.SB.rpc('kunjungan_harian', { p_start: start, p_end: end });
    if (!error && Array.isArray(data)) {
      const counts = {};
      data.forEach((row) => {
        counts[String(row.tanggal).slice(0, 10)] = Number(row.jumlah) || 0;
      });
      return fillDays(start, end, counts);
    }

    const { data: rows, error: err2 } = await window.SB
      .from('buku_tamu')
      .select('tanggal')
      .gte('tanggal', start)
      .lte('tanggal', end)
      .limit(50000);
    if (err2) throw new Error(friendly(err2, 'Gagal memuat grafik kunjungan.'));
    const counts = {};
    (rows || []).forEach((row) => {
      const key = String(row.tanggal).slice(0, 10);
      counts[key] = (counts[key] || 0) + 1;
    });
    return fillDays(start, end, counts);
  }

  async function sbCountByMonth(year) {
    const { data, error } = await window.SB.rpc('kunjungan_bulanan', { p_tahun: year });
    if (!error && Array.isArray(data)) {
      const counts = {};
      data.forEach((row) => {
        counts[Number(row.bulan)] = Number(row.jumlah) || 0;
      });
      return fillMonths(counts);
    }

    const { data: rows, error: err2 } = await window.SB
      .from('buku_tamu')
      .select('tanggal')
      .gte('tanggal', `${year}-01-01`)
      .lte('tanggal', `${year}-12-31`)
      .limit(50000);
    if (err2) throw new Error(friendly(err2, 'Gagal memuat grafik kunjungan.'));
    const counts = {};
    (rows || []).forEach((row) => {
      const month = Number(String(row.tanggal).slice(5, 7));
      counts[month] = (counts[month] || 0) + 1;
    });
    return fillMonths(counts);
  }

  /* ------------------------------------------------------------------ */
  /* API publik                                                         */
  /* ------------------------------------------------------------------ */

  const DB = {
    isDemo: !HAS_SB,
    demoAccount: DEMO_ACCOUNT,

    async getSession() {
      if (!HAS_SB) {
        try {
          const raw = localStorage.getItem(DEMO_SESSION_KEY);
          if (!raw) return null;
          const session = JSON.parse(raw);
          if (!session || !session.email) return null;
          return {
            user: { id: DEMO_ACCOUNT.id, email: session.email },
            profile: { nama: session.nama || DEMO_ACCOUNT.nama, role: 'admin' },
          };
        } catch (err) {
          return null;
        }
      }
      const { data, error } = await window.SB.auth.getSession();
      if (error || !data || !data.session) return null;
      const user = data.session.user;
      const profile = await sbProfile(user.id);
      return { user, profile };
    },

    async signIn(email, password) {
      const cleanEmail = String(email || '').trim();
      if (!cleanEmail || !password) throw new Error('Email dan password wajib diisi.');

      if (!HAS_SB) {
        await new Promise((resolve) => setTimeout(resolve, 450));
        const cocok = cleanEmail.toLowerCase() === DEMO_ACCOUNT.email && password === DEMO_ACCOUNT.password;
        if (!cocok) throw new Error('Email atau password salah. Gunakan akun demo yang tersedia.');
        localStorage.setItem(DEMO_SESSION_KEY, JSON.stringify({ email: DEMO_ACCOUNT.email, nama: DEMO_ACCOUNT.nama }));
        return {
          user: { id: DEMO_ACCOUNT.id, email: DEMO_ACCOUNT.email },
          profile: { nama: DEMO_ACCOUNT.nama, role: 'admin' },
        };
      }

      const { data, error } = await window.SB.auth.signInWithPassword({ email: cleanEmail, password });
      if (error) throw new Error(friendly(error, 'Login gagal. Periksa email dan password Anda.'));

      const profile = await sbProfile(data.user.id);
      if (!profile || profile.role !== 'admin') {
        await window.SB.auth.signOut();
        throw new Error('Akun ini tidak memiliki akses admin. Hubungi administrator.');
      }
      return { user: data.user, profile };
    },

    async signOut() {
      if (!HAS_SB) {
        localStorage.removeItem(DEMO_SESSION_KEY);
        return;
      }
      const { error } = await window.SB.auth.signOut();
      if (error) throw new Error(friendly(error, 'Gagal keluar dari akun.'));
    },

    async insertTamu(payload) {
      const data = {
        tanggal: payload.tanggal,
        nama: String(payload.nama || '').trim(),
        asal_instansi: String(payload.asal_instansi || '').trim(),
        tujuan: String(payload.tujuan || '').trim(),
      };

      if (!HAS_SB) {
        await new Promise((resolve) => setTimeout(resolve, 350));
        const rows = readDemoRows();
        const now = new Date().toISOString();
        const row = {
          id: makeId(),
          ...data,
          created_at: now,
          updated_at: now,
          created_by: null,
        };
        rows.push(row);
        writeDemoRows(rows);
        return row;
      }

      // Sengaja tanpa .select() agar tamu (anon) tidak memerlukan izin SELECT.
      const { error } = await window.SB.from('buku_tamu').insert(data);
      if (error) throw new Error(friendly(error, 'Data gagal disimpan. Silakan coba lagi.'));
      return { ...data };
    },

    async listTamu(options = {}) {
      if (!HAS_SB) {
        const { page = 1, pageSize = 10, order = 'desc' } = options;
        const filtered = sortRows(demoFilter(options), order);
        const start = (Math.max(1, page) - 1) * pageSize;
        return {
          rows: filtered.slice(start, start + pageSize),
          total: filtered.length,
        };
      }
      return sbList(options);
    },

    async listAll(options = {}) {
      if (!HAS_SB) {
        return sortRows(demoFilter(options), options.order || 'asc').slice(0, options.limit || 5000);
      }
      return sbListAll(options);
    },

    async updateTamu(id, payload) {
      const data = {
        tanggal: payload.tanggal,
        nama: String(payload.nama || '').trim(),
        asal_instansi: String(payload.asal_instansi || '').trim(),
        tujuan: String(payload.tujuan || '').trim(),
      };

      if (!HAS_SB) {
        await new Promise((resolve) => setTimeout(resolve, 300));
        const rows = readDemoRows();
        const index = rows.findIndex((row) => row.id === id);
        if (index === -1) throw new Error('Data tidak ditemukan. Mungkin sudah dihapus.');
        rows[index] = { ...rows[index], ...data, updated_at: new Date().toISOString() };
        writeDemoRows(rows);
        return rows[index];
      }

      const { data: updated, error } = await window.SB
        .from('buku_tamu')
        .update(data)
        .eq('id', id)
        .select()
        .maybeSingle();
      if (error) throw new Error(friendly(error, 'Perubahan gagal disimpan.'));
      if (!updated) throw new Error('Data tidak ditemukan atau Anda tidak memiliki akses.');
      return updated;
    },

    async deleteTamu(id) {
      if (!HAS_SB) {
        await new Promise((resolve) => setTimeout(resolve, 250));
        const rows = readDemoRows();
        const next = rows.filter((row) => row.id !== id);
        if (next.length === rows.length) throw new Error('Data tidak ditemukan. Mungkin sudah dihapus.');
        writeDemoRows(next);
        return true;
      }
      const { error } = await window.SB.from('buku_tamu').delete().eq('id', id);
      if (error) throw new Error(friendly(error, 'Data gagal dihapus.'));
      return true;
    },

    async getStats() {
      if (!HAS_SB) return demoStats();
      const today = U.todayISO();
      const monthStart = U.startOfMonth(today);
      const monthEnd = U.endOfMonth(today);
      const yearStart = `${today.slice(0, 4)}-01-01`;
      const yearEnd = `${today.slice(0, 4)}-12-31`;
      const [day, month, year, total] = await Promise.all([
        sbCount(today, today),
        sbCount(monthStart, monthEnd),
        sbCount(yearStart, yearEnd),
        sbCount('', ''),
      ]);
      return { today: day, month, year, total };
    },

    async countByDay(start, end) {
      if (!HAS_SB) {
        const counts = {};
        demoFilter({ from: start, to: end }).forEach((row) => {
          counts[row.tanggal] = (counts[row.tanggal] || 0) + 1;
        });
        return fillDays(start, end, counts);
      }
      return sbCountByDay(start, end);
    },

    async countByMonth(year) {
      if (!HAS_SB) {
        const counts = {};
        demoFilter({ from: `${year}-01-01`, to: `${year}-12-31` }).forEach((row) => {
          const month = Number(String(row.tanggal).slice(5, 7));
          counts[month] = (counts[month] || 0) + 1;
        });
        return fillMonths(counts);
      }
      return sbCountByMonth(year);
    },

    async getRecent(limit = 5) {
      if (!HAS_SB) {
        return readDemoRows()
          .slice()
          .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
          .slice(0, limit);
      }
      const { data, error } = await window.SB
        .from('buku_tamu')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw new Error(friendly(error, 'Gagal memuat data terbaru.'));
      return data || [];
    },
  };

  window.DB = DB;
})();
