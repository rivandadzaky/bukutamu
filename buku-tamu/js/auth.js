/* Autentikasi admin, proteksi halaman, sidebar, dan logout. */
(function () {
  'use strict';

  const U = window.Utils;

  function showBootError(message) {
    const overlay = document.getElementById('bootError');
    if (overlay) {
      overlay.hidden = false;
      const text = overlay.querySelector('[data-boot-message]');
      if (text) text.textContent = message;
      return;
    }
    U.toast(message, 'error', 'Tidak dapat memuat aplikasi');
  }

  async function requireAdmin() {
    let session = null;
    try {
      session = await DB.getSession();
    } catch (err) {
      showBootError('Gagal memeriksa sesi login. Periksa koneksi internet Anda.');
      return null;
    }

    if (!session) {
      const next = encodeURIComponent(location.pathname.split('/').pop() + location.search);
      location.replace(`login.html?next=${next}`);
      return null;
    }

    if (!session.profile || session.profile.role !== 'admin') {
      try { await DB.signOut(); } catch (err) { /* diabaikan */ }
      location.replace('login.html?error=role');
      return null;
    }

    document.body.classList.remove('is-auth-pending');
    return session;
  }

  function renderUser(session) {
    const nama = (session.profile && session.profile.nama) || (session.user && session.user.email) || 'Admin';
    document.querySelectorAll('[data-user-name]').forEach((el) => { el.textContent = nama; });
    document.querySelectorAll('[data-user-email]').forEach((el) => { el.textContent = (session.user && session.user.email) || ''; });
    document.querySelectorAll('[data-user-initial]').forEach((el) => {
      el.textContent = nama.trim().charAt(0).toUpperCase() || 'A';
    });
  }

  function initSidebar() {
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebarBackdrop');
    const toggle = document.getElementById('menuToggle');
    if (!sidebar || !toggle) return;

    const open = () => {
      sidebar.classList.add('is-open');
      if (backdrop) backdrop.classList.add('is-visible');
      document.body.style.overflow = 'hidden';
    };
    const close = () => {
      sidebar.classList.remove('is-open');
      if (backdrop) backdrop.classList.remove('is-visible');
      document.body.style.overflow = '';
    };

    toggle.addEventListener('click', open);
    if (backdrop) backdrop.addEventListener('click', close);
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') close();
    });
    sidebar.querySelectorAll('a').forEach((link) => link.addEventListener('click', close));
  }

  function initLogout() {
    const button = document.getElementById('logoutBtn');
    if (!button) return;
    button.addEventListener('click', async () => {
      if (!window.confirm('Keluar dari akun admin?')) return;
      U.setButtonLoading(button, true, 'Keluar...');
      try {
        await DB.signOut();
        location.replace('login.html?logout=1');
      } catch (err) {
        U.setButtonLoading(button, false);
        U.toast(err.message || 'Gagal logout.', 'error', 'Logout gagal');
      }
    });
  }

  function paintDemoBadges() {
    if (!DB.isDemo) return;
    document.querySelectorAll('[data-demo-badge]').forEach((el) => { el.hidden = false; });
  }

  function initProtectedPage() {
    document.querySelectorAll('[data-year]').forEach((el) => { el.textContent = new Date().getFullYear(); });
    paintDemoBadges();
    initSidebar();
    initLogout();

    requireAdmin().then((session) => {
      if (!session) return;
      renderUser(session);
      if (window.SB) {
        // Jika sesi berakhir/dicabut, arahkan kembali ke halaman login.
        window.SB.auth.onAuthStateChange((event) => {
          if (event === 'SIGNED_OUT') location.replace('login.html');
        });
      }
      document.dispatchEvent(new CustomEvent('auth:ready', { detail: session }));
    });
  }

  function initLoginPage() {
    const form = document.getElementById('loginForm');
    if (!form) return;
    const emailInput = document.getElementById('loginEmail');
    const passwordInput = document.getElementById('loginPassword');
    const errorBox = document.getElementById('loginError');
    const submit = document.getElementById('loginBtn');
    const toggle = document.getElementById('togglePassword');
    const hint = document.getElementById('demoHint');

    if (hint) hint.hidden = !DB.isDemo;
    const fill = document.getElementById('demoFill');
    if (fill) {
      fill.addEventListener('click', () => {
        emailInput.value = DB.demoAccount.email;
        passwordInput.value = DB.demoAccount.password;
        emailInput.focus();
      });
    }

    const params = new URLSearchParams(location.search);
    if (params.get('logout') === '1') {
      U.toast('Anda telah keluar dari akun admin.', 'info', 'Sampai jumpa');
    }
    if (params.get('error') === 'role') {
      errorBox.textContent = 'Akun tersebut tidak memiliki akses admin.';
      errorBox.hidden = false;
    }

    DB.getSession().then((session) => {
      if (session && session.profile && session.profile.role === 'admin') {
        location.replace('dashboard.html');
      }
    }).catch(() => { /* biarkan halaman login tetap tampil */ });

    if (toggle) {
      toggle.addEventListener('click', () => {
        const show = passwordInput.type === 'password';
        passwordInput.type = show ? 'text' : 'password';
        toggle.innerHTML = U.icon(show ? 'eyeOff' : 'eye', 19);
        toggle.setAttribute('aria-label', show ? 'Sembunyikan password' : 'Tampilkan password');
        toggle.setAttribute('aria-pressed', String(show));
      });
    }

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      errorBox.hidden = true;
      U.clearFieldErrors(form);

      const email = emailInput.value.trim();
      const password = passwordInput.value;
      let valid = true;
      if (!email) {
        U.setFieldError(form, 'email', 'Email wajib diisi.');
        valid = false;
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        U.setFieldError(form, 'email', 'Format email tidak valid.');
        valid = false;
      }
      if (!password) {
        U.setFieldError(form, 'password', 'Password wajib diisi.');
        valid = false;
      }
      if (!valid) return;

      U.setButtonLoading(submit, true, 'Memeriksa...');
      try {
        const session = await DB.signIn(email, password);
        const next = params.get('next');
        const target = next && /^[a-z0-9-]+\.html$/i.test(next) ? next : 'dashboard.html';
        U.toast(`Selamat datang, ${session.profile.nama}.`, 'success', 'Login berhasil');
        setTimeout(() => location.replace(target), 350);
      } catch (err) {
        errorBox.textContent = err.message || 'Login gagal. Coba lagi.';
        errorBox.hidden = false;
        passwordInput.select();
        U.setButtonLoading(submit, false);
      }
    });
  }

  window.Auth = { requireAdmin };

  document.addEventListener('DOMContentLoaded', () => {
    const page = document.body.dataset.page;
    if (page === 'login') initLoginPage();
    if (document.body.dataset.protected === 'true') initProtectedPage();
  });
})();
