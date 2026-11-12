/* Dashboard admin: statistik, grafik, dan kunjungan terbaru. */
(function () {
  'use strict';

  const U = window.Utils;
  let chart = null;

  function animateNumber(el, value) {
    if (!el) return;
    // Nilai langsung ditampilkan agar tetap benar walau animasi browser tidak berjalan
    // (mis. tab tidak aktif atau prefers-reduced-motion).
    el.textContent = U.formatNumber(value);
    el.classList.remove('is-updated');
    // Memicu animasi halus setiap kali data dimuat ulang.
    void el.offsetWidth;
    el.classList.add('is-updated');
  }

  function rangeFor(period) {
    const today = U.todayISO();
    if (period === '7d') return { start: U.addDays(today, -6), end: today, mode: 'day' };
    if (period === 'prev') {
      const d = U.parseISO(today);
      const prev = new Date(d.getFullYear(), d.getMonth() - 1, 1);
      const iso = U.isoDate(prev);
      return { start: U.startOfMonth(iso), end: U.endOfMonth(iso), mode: 'day' };
    }
    if (period === 'month') return { start: U.startOfMonth(today), end: U.endOfMonth(today), mode: 'day' };
    return {
      start: `${today.slice(0, 4)}-01-01`,
      end: `${today.slice(0, 4)}-12-31`,
      mode: 'month',
      year: Number(today.slice(0, 4)),
    };
  }

  function periodLabel(period, range) {
    if (period === '7d') return '7 hari terakhir';
    if (period === 'prev') return `Bulan ${U.monthLabel(U.parseISO(range.start).getMonth())} ${range.start.slice(0, 4)}`;
    if (period === 'month') return `Bulan ${U.monthLabel(U.parseISO(range.start).getMonth())} ${range.start.slice(0, 4)}`;
    return `Tahun ${range.year}`;
  }

  async function loadStats() {
    try {
      const stats = await DB.getStats();
      animateNumber(document.getElementById('statToday'), stats.today);
      animateNumber(document.getElementById('statMonth'), stats.month);
      animateNumber(document.getElementById('statYear'), stats.year);
      animateNumber(document.getElementById('statTotal'), stats.total);
    } catch (err) {
      U.toast(err.message || 'Statistik gagal dimuat.', 'error', 'Gagal memuat statistik');
    }
  }

  async function loadChart(period) {
    const canvas = document.getElementById('visitChart');
    const sub = document.getElementById('chartSub');
    const summary = document.getElementById('chartSummary');
    if (!canvas) return;
    if (sub) sub.textContent = 'Memuat data...';

    const range = rangeFor(period);
    try {
      let points;
      if (range.mode === 'month') {
        const monthly = await DB.countByMonth(range.year);
        points = monthly.map((row) => ({
          label: U.monthLabelShort(row.bulan - 1),
          value: row.jumlah,
          full: U.monthLabel(row.bulan - 1),
        }));
      } else {
        const daily = await DB.countByDay(range.start, range.end);
        points = daily.map((row) => {
          const d = U.parseISO(row.tanggal);
          const isShort = period === '7d';
          return {
            label: isShort
              ? `${U.DAYS[d.getDay()].slice(0, 3)} ${d.getDate()}`
              : String(d.getDate()),
            value: row.jumlah,
            full: U.formatDate(row.tanggal, 'full'),
          };
        });
      }

      if (sub) sub.textContent = `${periodLabel(period, range)} · ${U.formatDate(range.start)} – ${U.formatDate(range.end)}`;

      const values = points.map((p) => p.value);
      const total = values.reduce((a, b) => a + b, 0);
      const divisor = range.mode === 'month' ? 12 : Math.max(1, points.length);
      const average = Math.round((total / divisor) * 10) / 10;
      const maxValue = Math.max(0, ...values);
      const maxPoint = points.find((p) => p.value === maxValue);

      if (summary) {
        const unit = range.mode === 'month' ? 'bulan' : 'hari';
        summary.innerHTML = `
          <span class="chart-kpi"><strong>${U.formatNumber(total)}</strong> kunjungan</span>
          <span class="chart-kpi"><strong>${U.formatNumber(average)}</strong> rata-rata per ${unit}</span>
          <span class="chart-kpi"><strong>${maxPoint ? U.formatNumber(maxValue) : '0'}</strong> tertinggi${maxPoint ? ` · ${U.escapeHtml(maxPoint.full)}` : ''}</span>`;
      }

      if (!window.Chart) {
        canvas.parentElement.innerHTML = '<div class="empty"><p>Grafik tidak dapat dimuat karena library Chart.js tidak tersedia.</p></div>';
        return;
      }

      if (chart) chart.destroy();
      const ctx = canvas.getContext('2d');
      const gradient = ctx.createLinearGradient(0, 0, 0, 280);
      gradient.addColorStop(0, 'rgba(13, 148, 136, 0.95)');
      gradient.addColorStop(1, 'rgba(13, 148, 136, 0.45)');

      Chart.defaults.font.family = "'Plus Jakarta Sans', system-ui, sans-serif";
      Chart.defaults.color = '#64756f';

      chart = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: points.map((p) => p.label),
          datasets: [{
            label: 'Kunjungan',
            data: values,
            backgroundColor: gradient,
            hoverBackgroundColor: '#0f766e',
            borderRadius: 7,
            borderSkipped: false,
            maxBarThickness: 42,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: { duration: 500 },
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: '#0b3d38',
              padding: 12,
              cornerRadius: 10,
              displayColors: false,
              titleFont: { weight: '600' },
              callbacks: {
                title: (items) => (points[items[0].dataIndex] ? points[items[0].dataIndex].full : ''),
                label: (item) => `${U.formatNumber(item.raw)} kunjungan`,
              },
            },
          },
          scales: {
            x: {
              grid: { display: false },
              border: { display: false },
              ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: range.mode === 'month' ? 12 : 16, font: { size: 11 } },
            },
            y: {
              beginAtZero: true,
              border: { display: false },
              grid: { color: 'rgba(15, 118, 110, 0.08)' },
              ticks: { precision: 0, font: { size: 11 } },
            },
          },
        },
      });
    } catch (err) {
      if (summary) summary.textContent = '';
      if (sub) sub.textContent = 'Grafik gagal dimuat.';
      U.toast(err.message || 'Grafik gagal dimuat.', 'error', 'Gagal memuat grafik');
    }
  }

  async function loadRecent() {
    const tbody = document.getElementById('recentBody');
    const empty = document.getElementById('recentEmpty');
    const wrap = document.getElementById('recentTableWrap');
    if (!tbody) return;

    tbody.innerHTML = `<tr class="skeleton-row"><td colspan="5"><span class="skeleton-line"></span></td></tr>`;
    try {
      const rows = await DB.getRecent(5);
      if (!rows.length) {
        if (wrap) wrap.hidden = true;
        if (empty) empty.hidden = false;
        return;
      }
      tbody.innerHTML = rows.map((row, index) => `
        <tr>
          <td class="col-no">${index + 1}</td>
          <td><span class="cell-strong">${U.escapeHtml(row.nama)}</span></td>
          <td>${U.escapeHtml(row.asal_instansi)}</td>
          <td class="col-tujuan">${U.escapeHtml(row.tujuan)}</td>
          <td class="col-date"><span>${U.formatDate(row.tanggal)}</span><small>${U.formatDateTime(row.created_at).split(' · ')[1] || ''}</small></td>
        </tr>`).join('');
    } catch (err) {
      tbody.innerHTML = '';
      if (empty) {
        empty.hidden = false;
        empty.querySelector('p').textContent = err.message || 'Data terbaru gagal dimuat.';
      }
      U.toast(err.message || 'Data terbaru gagal dimuat.', 'error', 'Gagal memuat data');
    }
  }

  function initDashboard() {
    const today = U.todayISO();
    const todayLabel = document.getElementById('todayLabel');
    if (todayLabel) todayLabel.textContent = U.formatDate(today, 'full');

    const periodSelect = document.getElementById('chartPeriod');
    if (periodSelect) {
      periodSelect.value = '7d';
      periodSelect.addEventListener('change', () => loadChart(periodSelect.value));
    }

    loadStats();
    loadChart(periodSelect ? periodSelect.value : '7d');
    loadRecent();
  }

  document.addEventListener('auth:ready', initDashboard);
})();
