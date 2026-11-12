/* Utilitas umum: tanggal, format, toast, dan helper DOM. */
(function () {
  'use strict';

  const MONTHS = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
  ];
  const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

  const pad = (n) => String(n).padStart(2, '0');

  function isoDate(d) {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  function parseISO(value) {
    const [y, m, d] = String(value).slice(0, 10).split('-').map(Number);
    return new Date(y, (m || 1) - 1, d || 1);
  }

  function todayISO() {
    return isoDate(new Date());
  }

  function addDays(iso, days) {
    const d = parseISO(iso);
    d.setDate(d.getDate() + days);
    return isoDate(d);
  }

  function startOfMonth(iso) {
    return String(iso).slice(0, 7) + '-01';
  }

  function endOfMonth(iso) {
    const d = parseISO(iso);
    return isoDate(new Date(d.getFullYear(), d.getMonth() + 1, 0));
  }

  function formatDate(iso, style = 'medium') {
    if (!iso) return '-';
    const d = parseISO(iso);
    if (isNaN(d.getTime())) return '-';
    const day = d.getDate();
    const month = d.getMonth();
    const year = d.getFullYear();
    if (style === 'long') return `${day} ${MONTHS[month]} ${year}`;
    if (style === 'full') return `${DAYS[d.getDay()]}, ${day} ${MONTHS[month]} ${year}`;
    if (style === 'iso') return isoDate(d);
    return `${day} ${MONTHS_SHORT[month]} ${year}`;
  }

  function formatDateTime(value) {
    if (!value) return '-';
    const d = new Date(value);
    if (isNaN(d.getTime())) return '-';
    return `${pad(d.getDate())} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()} · ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function formatNumber(n) {
    return new Intl.NumberFormat('id-ID').format(Number(n) || 0);
  }

  function monthLabel(index) {
    return MONTHS[index] || '';
  }

  function monthLabelShort(index) {
    return MONTHS_SHORT[index] || '';
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function debounce(fn, wait = 300) {
    let timer = null;
    return function debounced(...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), wait);
    };
  }

  const TOAST_ICONS = {
    success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
    error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>',
  };

  function toast(message, type = 'success', title) {
    let root = document.getElementById('toastRoot');
    if (!root) {
      root = document.createElement('div');
      root.id = 'toastRoot';
      root.className = 'toast-root';
      root.setAttribute('aria-live', 'polite');
      document.body.appendChild(root);
    }
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.innerHTML = `
      <span class="toast-icon">${TOAST_ICONS[type] || TOAST_ICONS.info}</span>
      <div class="toast-body">
        ${title ? `<strong>${escapeHtml(title)}</strong>` : ''}
        <span>${escapeHtml(message)}</span>
      </div>
      <button type="button" class="toast-close" aria-label="Tutup notifikasi">&times;</button>`;
    let removed = false;
    const close = () => {
      if (removed) return;
      removed = true;
      el.classList.remove('is-visible');
      setTimeout(() => el.remove(), 250);
    };
    el.querySelector('.toast-close').addEventListener('click', close);
    root.appendChild(el);
    // Paksa reflow agar transisi tetap berjalan tanpa bergantung pada requestAnimationFrame.
    void el.offsetWidth;
    el.classList.add('is-visible');
    setTimeout(close, 4600);
  }

  function setButtonLoading(button, loading, loadingText = 'Memproses...') {
    if (!button) return;
    if (loading) {
      if (!button.dataset.originalHtml) button.dataset.originalHtml = button.innerHTML;
      button.disabled = true;
      button.classList.add('is-loading');
      button.innerHTML = `<span class="spinner" aria-hidden="true"></span>${escapeHtml(loadingText)}`;
    } else {
      button.disabled = false;
      button.classList.remove('is-loading');
      if (button.dataset.originalHtml) {
        button.innerHTML = button.dataset.originalHtml;
        delete button.dataset.originalHtml;
      }
    }
  }

  function setFieldError(form, name, message) {
    const box = form.querySelector(`[data-error-for="${name}"]`);
    const input = form.elements[name];
    if (box) {
      box.textContent = message || '';
      box.classList.toggle('is-visible', !!message);
    }
    if (input) {
      input.classList.toggle('is-invalid', !!message);
      input.setAttribute('aria-invalid', message ? 'true' : 'false');
    }
  }

  function clearFieldErrors(form) {
    form.querySelectorAll('[data-error-for]').forEach((el) => {
      el.textContent = '';
      el.classList.remove('is-visible');
    });
    form.querySelectorAll('.is-invalid').forEach((el) => {
      el.classList.remove('is-invalid');
      el.removeAttribute('aria-invalid');
    });
  }

  function icon(name, size = 20) {
    const paths = {
      calendar: '<rect x="3" y="4" width="18" height="18" rx="3"/><path d="M16 2v4M8 2v4M3 10h18"/>',
      clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
      pin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
      user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
      building: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M9 7h.01M15 7h.01M9 11h.01M15 11h.01M9 15h.01M15 15h.01M10 21v-3h4v3"/>',
      target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
      search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
      download: '<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/>',
      edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
      trash: '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v5M14 11v5"/>',
      plus: '<path d="M12 5v14M5 12h14"/>',
      check: '<path d="M20 6 9 17l-5-5"/>',
      logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
      home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z"/>',
      chart: '<path d="M3 3v18h18"/><path d="M7 15v3M12 10v8M17 6v12"/>',
      table: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M9 10v10"/>',
      report: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6M8 13h8M8 17h5"/>',
      filter: '<path d="M3 5h18l-7 8v6l-4 2v-8Z"/>',
      refresh: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
      menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
      x: '<path d="M18 6 6 18M6 6l12 12"/>',
      arrowRight: '<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>',
      mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
      lock: '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
      eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
      eyeOff: '<path d="m3 3 18 18"/><path d="M10.6 6.2A9.9 9.9 0 0 1 12 6c6.5 0 10 6 10 6a17.7 17.7 0 0 1-3 3.6"/><path d="M6.2 6.5C3.6 8.2 2 10.5 2 10.5s3.5 7 10 7a9.7 9.7 0 0 0 4-.9"/>',
      users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 5.2a3.5 3.5 0 0 1 0 5.6"/><path d="M18 14.5a6.5 6.5 0 0 1 3.5 5.5"/>',
      info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
      spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4"/><path d="m5.6 5.6 2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8"/>',
    };
    const body = paths[name] || paths.info;
    return `<svg class="icon-svg" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
  }

  window.Utils = {
    MONTHS,
    MONTHS_SHORT,
    DAYS,
    pad,
    isoDate,
    parseISO,
    todayISO,
    addDays,
    startOfMonth,
    endOfMonth,
    formatDate,
    formatDateTime,
    formatNumber,
    monthLabel,
    monthLabelShort,
    escapeHtml,
    debounce,
    toast,
    setButtonLoading,
    setFieldError,
    clearFieldErrors,
    icon,
  };
})();
