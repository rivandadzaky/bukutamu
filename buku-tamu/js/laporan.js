/* Halaman admin: laporan harian, bulanan, tahunan, dan ekspor Excel. */
(function () {
  'use strict';

  const U = window.Utils;
  const state = {
    mode: 'harian',
    rows: [],
    page: 1,
    pageSize: 15,
    chart: null,
    loading: false,
  };

  let els = {};

  function cacheElements() {
    els = {
      tabs: document.getElementById('reportTabs'),
      controlHarian: document.getElementById('controlHarian'),
      controlBulanan: document.getElementById('controlBulanan'),
      controlTahunan: document.getElementById('controlTahunan'),
      repDate: document.getElementById('repDate'),
      repMonth: document.getElementById('repMonth'),
      repYear: document.getElementById('repYear'),
      stats: document.getElementById('reportStats'),
      chartPanel: document.getElementById('chartPanel'),
      chart: document.getElementById('reportChart'),
      chartSub: document.getElementById('reportChartSub'),
      rekapPanel: document.getElementById('rekapPanel'),
      rekapHead: document.getElementById('rekapHead'),
      rekapBody: document.getElementById('rekapBody'),
      rekapFoot: document.getElementById('rekapFoot'),
      tbody: document.getElementById('reportBody'),
      tableWrap: document.getElementById('reportTableWrap'),
      empty: document.getElementById('reportEmpty'),
      info: document.getElementById('reportInfo'),
      pagination: document.getElementById('reportPagination'),
      prev: document.getElementById('reportPrev'),
      next: document.getElementById('reportNext'),
      pageInfo: document.getElementById('pageInfoReport'),
      exportBtn: document.getElementById('exportReport'),
      title: document.getElementById('reportTitle'),
      subtitle: document.getElementById('reportSubtitle'),
    };
  }

  function currentConfig() {
    const today = U.todayISO();
    if (state.mode === 'harian') {
      const date = els.repDate.value || today;
      return {
        from: date,
        to: date,
        title: 'Laporan Harian',
        subtitle: U.formatDate(date, 'full'),
        filename: `Laporan_Buku_Tamu_${date}.xlsx`,
        empty: 'Tidak ada kunjungan pada tanggal yang dipilih.',
      };
    }
    if (state.mode === 'bulanan') {
      const month = els.repMonth.value || today.slice(0, 7);
      const first = `${month}-01`;
      const d = U.parseISO(first);
      return {
        from: first,
        to: U.endOfMonth(first),
        title: 'Laporan Bulanan',
        subtitle: `${U.monthLabel(d.getMonth())} ${d.getFullYear()}`,
        filename: `Laporan_Buku_Tamu_${month}.xlsx`,
        empty: 'Tidak ada kunjungan pada periode yang dipilih.',
      };
    }
    const year = Number(els.repYear.value) || Number(today.slice(0, 4));
    return {
      from: `${year}-01-01`,
      to: `${year}-12-31`,
      year,
      title: 'Laporan Tahunan',
      subtitle: `Tahun ${year}`,
      filename: `Laporan_Buku_Tamu_${year}.xlsx`,
      empty: 'Tidak ada kunjungan pada periode yang dipilih.',
    };
  }

  function statCard(icon, label, value, sub) {
    return `
      <article class="stat-card">
        <div class="stat-icon stat-icon-${icon}">${U.icon(icon === 'users' ? 'users' : icon, 22)}</div>
        <div class="stat-body">
          <span class="stat-label">${U.escapeHtml(label)}</span>
          <strong class="stat-value">${U.formatNumber(value)}</strong>
          ${sub ? `<small class="stat-sub">${U.escapeHtml(sub)}</small>` : ''}
        </div>
      </article>`;
  }

  function topOf(rows, key) {
    const map = new Map();
    rows.forEach((row) => {
      const value = String(row[key] || '-').trim();
      map.set(value, (map.get(value) || 0) + 1);
    });
    let best = null;
    map.forEach((count, name) => {
      if (!best || count > best.count) best = { name, count };
    });
    return best;
  }

  function renderStats(series, monthly) {
    if (!els.stats) return;
    const rows = state.rows;
    const total = rows.length;

    if (state.mode === 'harian') {
      const instansi = topOf(rows, 'asal_instansi');
      const tujuan = topOf(rows, 'tujuan');
      els.stats.innerHTML = [
        statCard('users', 'Total Kunjungan', total, 'pada tanggal terpilih'),
        statCard('building', 'Instansi Terbanyak', instansi ? instansi.count : 0, instansi ? instansi.name : 'Belum ada data'),
        statCard('target', 'Tujuan Terbanyak', tujuan ? tujuan.count : 0, tujuan ? tujuan.name : 'Belum ada data'),
      ].join('');
      return;
    }

    const cfg = currentConfig();
    const days = Math.max(1, Math.round((U.parseISO(cfg.to) - U.parseISO(cfg.from)) / 86400000) + 1);
    const average = total ? Math.round((total / days) * 10) / 10 : 0;

    let busiestName = '-';
    let busiestCount = 0;
    if (state.mode === 'bulanan' && series) {
      series.forEach((point) => {
        if (point.jumlah > busiestCount) {
          busiestCount = point.jumlah;
          busiestName = U.formatDate(point.tanggal, 'full');
        }
      });
      els.stats.innerHTML = [
        statCard('users', 'Total Kunjungan', total, `${days} hari dalam periode`),
        statCard('chart', 'Rata-rata per Hari', average, `≈ ${U.formatNumber(average)} kunjungan/hari`),
        statCard('calendar', 'Hari Tersibuk', busiestCount, busiestName),
      ].join('');
      return;
    }

    if (monthly) {
      monthly.forEach((month) => {
        if (month.jumlah > busiestCount) {
          busiestCount = month.jumlah;
          busiestName = `${U.monthLabel(month.bulan - 1)} ${cfg.year}`;
        }
      });
    }
    const monthlyAverage = total ? Math.round((total / 12) * 10) / 10 : 0;
    els.stats.innerHTML = [
      statCard('users', 'Total Kunjungan', total, `Tahun ${cfg.year}`),
      statCard('chart', 'Rata-rata per Bulan', monthlyAverage, `≈ ${U.formatNumber(monthlyAverage)} kunjungan/bulan`),
      statCard('calendar', 'Bulan Tersibuk', busiestCount, busiestName),
    ].join('');
  }

  function renderTable() {
    const rows = state.rows;
    const totalPages = Math.max(1, Math.ceil(rows.length / state.pageSize));
    state.page = Math.min(state.page, totalPages);
    const start = (state.page - 1) * state.pageSize;
    const pageRows = rows.slice(start, start + state.pageSize);

    if (!rows.length) {
      if (els.tableWrap) els.tableWrap.hidden = true;
      if (els.empty) {
        els.empty.hidden = false;
        els.empty.querySelector('p').textContent = currentConfig().empty;
      }
      if (els.info) els.info.textContent = '';
      if (els.pagination) els.pagination.hidden = true;
      return;
    }

    if (els.empty) els.empty.hidden = true;
    if (els.tableWrap) els.tableWrap.hidden = false;

    els.tbody.innerHTML = pageRows.map((row, index) => `
      <tr>
        <td class="col-no">${start + index + 1}</td>
        <td class="col-date"><span class="cell-strong">${U.formatDate(row.tanggal)}</span></td>
        <td><span class="cell-strong">${U.escapeHtml(row.nama)}</span></td>
        <td>${U.escapeHtml(row.asal_instansi)}</td>
        <td class="col-tujuan">${U.escapeHtml(row.tujuan)}</td>
        <td class="col-time">${U.formatDateTime(row.created_at)}</td>
      </tr>`).join('');

    if (els.info) els.info.textContent = `Menampilkan ${start + 1}–${Math.min(start + state.pageSize, rows.length)} dari ${U.formatNumber(rows.length)} data`;
    if (els.pageInfo) els.pageInfo.textContent = `Halaman ${state.page} dari ${totalPages}`;
    if (els.pagination) els.pagination.hidden = totalPages <= 1;
    if (els.prev) els.prev.disabled = state.page <= 1;
    if (els.next) els.next.disabled = state.page >= totalPages;
  }

  function renderRekap(series, monthly) {
    if (!els.rekapPanel) return;
    if (state.mode === 'harian') {
      els.rekapPanel.hidden = true;
      return;
    }
    els.rekapPanel.hidden = false;

    if (state.mode === 'bulanan' && series) {
      els.rekapHead.innerHTML = '<tr><th>Tanggal</th><th>Hari</th><th class="text-right">Jumlah</th></tr>';
      const total = series.reduce((sum, point) => sum + point.jumlah, 0);
      const max = Math.max(1, ...series.map((p) => p.jumlah));
      els.rekapBody.innerHTML = series.map((point) => {
        const d = U.parseISO(point.tanggal);
        return `<tr>
          <td><span class="cell-strong">${U.formatDate(point.tanggal)}</span></td>
          <td>${U.DAYS[d.getDay()]}</td>
          <td class="text-right">
            <span class="rekap-count">${U.formatNumber(point.jumlah)}</span>
            <span class="mini-bar"><span style="width:${Math.round((point.jumlah / max) * 100)}%"></span></span>
          </td>
        </tr>`;
      }).join('');
      els.rekapFoot.innerHTML = `<tr><td colspan="2">Total</td><td class="text-right">${U.formatNumber(total)}</td></tr>`;
      return;
    }

    if (monthly) {
      els.rekapHead.innerHTML = '<tr><th>Bulan</th><th class="text-right">Jumlah</th><th class="text-right">Persentase</th></tr>';
      const total = monthly.reduce((sum, month) => sum + month.jumlah, 0);
      els.rekapBody.innerHTML = monthly.map((month) => {
        const pct = total ? Math.round((month.jumlah / total) * 100) : 0;
        return `<tr>
          <td><span class="cell-strong">${U.monthLabel(month.bulan - 1)}</span></td>
          <td class="text-right">${U.formatNumber(month.jumlah)}</td>
          <td class="text-right rekap-pct">${pct}%</td>
        </tr>`;
      }).join('');
      els.rekapFoot.innerHTML = `<tr><td>Total</td><td class="text-right">${U.formatNumber(total)}</td><td class="text-right">100%</td></tr>`;
    }
  }

  function drawChart(points, title, isMonthly) {
    if (!els.chart) return;
    if (!window.Chart) {
      els.chart.parentElement.innerHTML = '<div class="empty"><p>Grafik tidak dapat dimuat karena library Chart.js tidak tersedia.</p></div>';
      return;
    }
    if (els.chartSub) els.chartSub.textContent = title;

    if (state.chart) state.chart.destroy();
    const ctx = els.chart.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 0, 280);
    gradient.addColorStop(0, isMonthly ? 'rgba(13, 148, 136, 0.95)' : 'rgba(13, 148, 136, 0.95)');
    gradient.addColorStop(1, 'rgba(13, 148, 136, 0.4)');

    Chart.defaults.font.family = "'Plus Jakarta Sans', system-ui, sans-serif";
    Chart.defaults.color = '#64756f';

    state.chart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: points.map((p) => p.label),
        datasets: [{
          label: 'Kunjungan',
          data: points.map((p) => p.value),
          backgroundColor: gradient,
          hoverBackgroundColor: '#0f766e',
          borderRadius: 6,
          borderSkipped: false,
          maxBarThickness: 36,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#0b3d38',
            padding: 12,
            cornerRadius: 10,
            displayColors: false,
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
            ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: isMonthly ? 12 : 16, font: { size: 11 } },
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
  }

  function skeletonStats() {
    if (!els.stats) return;
    els.stats.innerHTML = Array.from({ length: 3 }).map(() => `
      <article class="stat-card skeleton-card"><span class="skeleton-line"></span><span class="skeleton-line short"></span></article>`).join('');
  }

  async function generate() {
    if (state.loading) return;
    const cfg = currentConfig();
    state.loading = true;

    if (els.title) els.title.textContent = cfg.title;
    if (els.subtitle) els.subtitle.textContent = cfg.subtitle;
    skeletonStats();
    if (els.tbody) els.tbody.innerHTML = `<tr class="skeleton-row"><td colspan="6"><span class="skeleton-line"></span></td></tr>`;
    if (els.chartPanel) els.chartPanel.hidden = state.mode === 'harian';

    try {
      const rows = await DB.listAll({ from: cfg.from, to: cfg.to, order: 'asc' });
      state.rows = rows;
      state.page = 1;

      let series = null;
      let monthly = null;
      if (state.mode === 'bulanan') {
        series = await DB.countByDay(cfg.from, cfg.to);
      } else if (state.mode === 'tahunan') {
        monthly = await DB.countByMonth(cfg.year);
      }

      renderStats(series, monthly);
      renderTable();
      renderRekap(series, monthly);

      if (state.mode === 'bulanan' && series) {
        drawChart(
          series.map((point) => {
            const d = U.parseISO(point.tanggal);
            return {
              label: `${d.getDate()}`,
              value: point.jumlah,
              full: U.formatDate(point.tanggal, 'full'),
            };
          }),
          `Kunjungan harian · ${cfg.subtitle}`,
          false,
        );
      } else if (state.mode === 'tahunan' && monthly) {
        drawChart(
          monthly.map((month) => ({
            label: U.monthLabelShort(month.bulan - 1),
            value: month.jumlah,
            full: `${U.monthLabel(month.bulan - 1)} ${cfg.year}`,
          })),
          `Kunjungan bulanan · ${cfg.subtitle}`,
          true,
        );
      }
    } catch (err) {
      U.toast(err.message || 'Laporan gagal dimuat.', 'error', 'Gagal memuat laporan');
      if (els.stats) els.stats.innerHTML = '';
      if (els.tbody) els.tbody.innerHTML = '';
      if (els.empty) {
        els.empty.hidden = false;
        els.empty.querySelector('p').textContent = err.message || 'Laporan gagal dimuat.';
      }
    } finally {
      state.loading = false;
    }
  }

  function switchMode(mode) {
    if (!mode || mode === state.mode) return;
    state.mode = mode;
    if (els.tabs) {
      els.tabs.querySelectorAll('[data-mode]').forEach((button) => {
        const active = button.dataset.mode === mode;
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-selected', String(active));
      });
    }
    if (els.controlHarian) els.controlHarian.hidden = mode !== 'harian';
    if (els.controlBulanan) els.controlBulanan.hidden = mode !== 'bulanan';
    if (els.controlTahunan) els.controlTahunan.hidden = mode !== 'tahunan';
    if (els.chartPanel) els.chartPanel.hidden = mode === 'harian';
    generate();
  }

  function initExport() {
    if (!els.exportBtn) return;
    els.exportBtn.addEventListener('click', async () => {
      const cfg = currentConfig();
      if (!state.rows.length) {
        U.toast('Tidak ada data untuk diekspor pada periode ini.', 'info', 'Tidak ada data');
        return;
      }
      U.setButtonLoading(els.exportBtn, true, 'Menyiapkan...');
      try {
        const result = await Export.exportRows({
          rows: state.rows,
          filename: cfg.filename,
          title: `Laporan Buku Tamu Digital — Puskesmas Bulusan`,
          subtitle: `${cfg.title} · ${cfg.subtitle}`,
        });
        U.toast(`${U.formatNumber(result.count)} data berhasil diekspor ke ${result.format.toUpperCase()}.`, 'success', 'Ekspor selesai');
      } catch (err) {
        U.toast(err.message || 'Ekspor gagal. Coba lagi.', 'error', 'Gagal mengekspor');
      } finally {
        U.setButtonLoading(els.exportBtn, false);
      }
    });
  }

  function initLaporan() {
    cacheElements();
    const today = U.todayISO();
    if (els.repDate) els.repDate.value = today;
    if (els.repMonth) els.repMonth.value = today.slice(0, 7);
    if (els.repYear) {
      const current = Number(today.slice(0, 4));
      els.repYear.innerHTML = Array.from({ length: 5 }).map((_, i) => {
        const year = current - i;
        return `<option value="${year}">${year}</option>`;
      }).join('');
      els.repYear.value = String(current);
    }

    if (els.tabs) {
      els.tabs.addEventListener('click', (event) => {
        const button = event.target.closest('[data-mode]');
        if (button) switchMode(button.dataset.mode);
      });
    }
    [els.repDate, els.repMonth, els.repYear].forEach((input) => {
      if (!input) return;
      input.addEventListener('change', () => generate());
    });
    if (els.prev) {
      els.prev.addEventListener('click', () => {
        if (state.page > 1) {
          state.page -= 1;
          renderTable();
        }
      });
    }
    if (els.next) {
      els.next.addEventListener('click', () => {
        const totalPages = Math.max(1, Math.ceil(state.rows.length / state.pageSize));
        if (state.page < totalPages) {
          state.page += 1;
          renderTable();
        }
      });
    }
    initExport();
    generate();
  }

  document.addEventListener('auth:ready', initLaporan);
})();
