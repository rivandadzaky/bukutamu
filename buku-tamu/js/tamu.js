/* Halaman admin: pengelolaan data buku tamu. */
(function () {
  'use strict';

  const U = window.Utils;
  const state = {
    search: '',
    from: '',
    to: '',
    page: 1,
    pageSize: 10,
    total: 0,
    rows: [],
    loading: false,
  };

  let els = {};

  function cacheElements() {
    els = {
      search: document.getElementById('tamuSearch'),
      from: document.getElementById('filterFrom'),
      to: document.getElementById('filterTo'),
      reset: document.getElementById('resetFilter'),
      refresh: document.getElementById('refreshBtn'),
      exportBtn: document.getElementById('exportBtn'),
      tbody: document.getElementById('tamuBody'),
      empty: document.getElementById('tamuEmpty'),
      tableWrap: document.getElementById('tamuTableWrap'),
      pagination: document.getElementById('pagination'),
      pageInfo: document.getElementById('pageInfo'),
      dataInfo: document.getElementById('dataInfo'),
      pageSize: document.getElementById('pageSize'),
      editModal: document.getElementById('editModal'),
      editForm: document.getElementById('editForm'),
      editCancel: document.getElementById('editCancel'),
      editClose: document.getElementById('editClose'),
      editSave: document.getElementById('editSave'),
      deleteModal: document.getElementById('deleteModal'),
      deleteName: document.getElementById('deleteName'),
      deleteMeta: document.getElementById('deleteMeta'),
      deleteCancel: document.getElementById('deleteCancel'),
      deleteClose: document.getElementById('deleteClose'),
      deleteConfirm: document.getElementById('deleteConfirm'),
    };
  }

  function openModal(modal) {
    if (!modal) return;
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
    // Paksa reflow agar transisi CSS tetap berjalan tanpa requestAnimationFrame.
    void modal.offsetWidth;
    modal.classList.add('is-open');
    const focusable = modal.querySelector('input, button, select, textarea');
    if (focusable) focusable.focus();
  }

  function closeModal(modal) {
    if (!modal) return;
    modal.classList.remove('is-open');
    document.body.style.overflow = '';
    setTimeout(() => { modal.hidden = true; }, 180);
  }

  function showTableLoading() {
    els.empty.hidden = true;
    els.tableWrap.hidden = false;
    els.tbody.innerHTML = Array.from({ length: Math.min(state.pageSize, 6) }).map(() => `
      <tr class="skeleton-row"><td colspan="7"><span class="skeleton-line"></span></td></tr>`).join('');
    if (els.pagination) els.pagination.hidden = true;
  }

  function renderRows() {
    const { rows, page, pageSize, total } = state;

    if (!rows.length) {
      els.tableWrap.hidden = true;
      els.empty.hidden = false;
      const hasFilter = !!(state.search || state.from || state.to);
      els.empty.querySelector('h3').textContent = hasFilter ? 'Data tamu tidak ditemukan' : 'Belum ada data buku tamu';
      els.empty.querySelector('p').textContent = hasFilter
        ? 'Coba ubah kata kunci pencarian atau rentang tanggal yang dipilih.'
        : 'Data akan muncul di sini setelah tamu mengisi buku tamu.';
      if (els.pagination) els.pagination.hidden = true;
      if (els.dataInfo) els.dataInfo.textContent = '';
      if (els.pageInfo) els.pageInfo.textContent = '';
      return;
    }

    els.empty.hidden = true;
    els.tableWrap.hidden = false;

    els.tbody.innerHTML = rows.map((row, index) => {
      const no = (page - 1) * pageSize + index + 1;
      return `
        <tr>
          <td class="col-no">${no}</td>
          <td class="col-date">
            <span class="cell-strong">${U.formatDate(row.tanggal)}</span>
            <small>${U.DAYS[U.parseISO(row.tanggal).getDay()]}</small>
          </td>
          <td><span class="cell-strong">${U.escapeHtml(row.nama)}</span></td>
          <td>${U.escapeHtml(row.asal_instansi)}</td>
          <td class="col-tujuan">${U.escapeHtml(row.tujuan)}</td>
          <td class="col-time"><span>${U.formatDateTime(row.created_at)}</span></td>
          <td>
            <div class="row-actions">
              <button type="button" class="icon-btn" data-action="edit" data-id="${row.id}" title="Edit data" aria-label="Edit data ${U.escapeHtml(row.nama)}">${U.icon('edit', 17)}</button>
              <button type="button" class="icon-btn icon-btn-danger" data-action="delete" data-id="${row.id}" title="Hapus data" aria-label="Hapus data ${U.escapeHtml(row.nama)}">${U.icon('trash', 17)}</button>
            </div>
          </td>
        </tr>`;
    }).join('');

    const startNo = (page - 1) * pageSize + 1;
    const endNo = Math.min(page * pageSize, total);
    if (els.dataInfo) els.dataInfo.textContent = `Menampilkan ${startNo}–${endNo} dari ${U.formatNumber(total)} data`;
    if (els.pageInfo) els.pageInfo.textContent = `Halaman ${page} dari ${Math.max(1, Math.ceil(total / pageSize))}`;
    renderPagination();
  }

  function renderPagination() {
    if (!els.pagination) return;
    const totalPages = Math.max(1, Math.ceil(state.total / state.pageSize));
    if (state.total === 0) {
      els.pagination.hidden = true;
      return;
    }
    els.pagination.hidden = false;

    const current = state.page;
    let start = Math.max(1, Math.min(current - 2, totalPages - 4));
    const end = Math.min(totalPages, start + 4);
    if (end - start < 4) start = Math.max(1, end - 4);

    const parts = [];
    parts.push(`<button type="button" class="page-btn page-nav" data-page="${current - 1}" ${current === 1 ? 'disabled' : ''} aria-label="Halaman sebelumnya">‹</button>`);

    if (start > 1) {
      parts.push(`<button type="button" class="page-btn" data-page="1">1</button>`);
      if (start > 2) parts.push('<span class="page-ellipsis">…</span>');
    }
    for (let page = start; page <= end; page += 1) {
      parts.push(`<button type="button" class="page-btn ${page === current ? 'is-active' : ''}" data-page="${page}" ${page === current ? 'aria-current="page"' : ''}>${page}</button>`);
    }
    if (end < totalPages) {
      if (end < totalPages - 1) parts.push('<span class="page-ellipsis">…</span>');
      parts.push(`<button type="button" class="page-btn" data-page="${totalPages}">${totalPages}</button>`);
    }
    parts.push(`<button type="button" class="page-btn page-nav" data-page="${current + 1}" ${current === totalPages ? 'disabled' : ''} aria-label="Halaman berikutnya">›</button>`);

    els.pagination.innerHTML = parts.join('');
  }

  async function loadData() {
    if (state.loading) return;
    if (state.from && state.to && state.from > state.to) {
      U.toast('Tanggal mulai tidak boleh melebihi tanggal akhir.', 'error', 'Filter tidak valid');
      return;
    }
    state.loading = true;
    showTableLoading();
    try {
      const result = await DB.listTamu({
        search: state.search,
        from: state.from,
        to: state.to,
        page: state.page,
        pageSize: state.pageSize,
      });
      state.rows = result.rows;
      state.total = result.total;

      if (state.rows.length === 0 && state.page > 1) {
        state.page = Math.max(1, Math.ceil(result.total / state.pageSize));
        state.loading = false;
        return loadData();
      }
      renderRows();
    } catch (err) {
      els.tbody.innerHTML = '';
      els.tableWrap.hidden = true;
      els.empty.hidden = false;
      els.empty.querySelector('h3').textContent = 'Gagal memuat data';
      els.empty.querySelector('p').textContent = err.message || 'Terjadi kesalahan saat memuat data.';
      U.toast(err.message || 'Gagal memuat data.', 'error', 'Gagal memuat data');
    } finally {
      state.loading = false;
    }
  }

  function findRow(id) {
    return state.rows.find((row) => String(row.id) === String(id));
  }

  function openEdit(row) {
    if (!row) return;
    const form = els.editForm;
    U.clearFieldErrors(form);
    document.getElementById('editId').value = row.id;
    form.elements.tanggal.value = String(row.tanggal).slice(0, 10);
    form.elements.nama.value = row.nama;
    form.elements.asal_instansi.value = row.asal_instansi;
    form.elements.tujuan.value = row.tujuan;
    openModal(els.editModal);
  }

  function openDelete(row) {
    if (!row) return;
    els.deleteName.textContent = row.nama;
    els.deleteMeta.textContent = `${U.formatDate(row.tanggal, 'long')} · ${row.asal_instansi}`;
    els.deleteConfirm.dataset.id = row.id;
    openModal(els.deleteModal);
  }

  function validateEditField(name) {
    const input = els.editForm.elements[name];
    const value = input.value.trim();
    let message = '';
    if (name === 'tanggal') {
      if (!input.value || !/^\d{4}-\d{2}-\d{2}$/.test(input.value) || isNaN(U.parseISO(input.value).getTime())) {
        message = 'Tanggal wajib diisi dengan format yang valid.';
      }
    } else if (!value) {
      message = `${input.dataset.label || 'Kolom ini'} wajib diisi.`;
    } else if (value.length < 2) {
      message = 'Minimal 2 karakter.';
    }
    U.setFieldError(els.editForm, name, message);
    return !message;
  }

  function initFilters() {
    if (els.search) {
      els.search.addEventListener('input', U.debounce(() => {
        state.search = els.search.value.trim();
        state.page = 1;
        loadData();
      }, 350));
    }
    if (els.from) {
      els.from.addEventListener('change', () => {
        state.from = els.from.value;
        state.page = 1;
        loadData();
      });
    }
    if (els.to) {
      els.to.addEventListener('change', () => {
        state.to = els.to.value;
        state.page = 1;
        loadData();
      });
    }
    if (els.reset) {
      els.reset.addEventListener('click', () => {
        state.search = '';
        state.from = '';
        state.to = '';
        state.page = 1;
        if (els.search) els.search.value = '';
        if (els.from) els.from.value = '';
        if (els.to) els.to.value = '';
        loadData();
      });
    }
    if (els.refresh) {
      els.refresh.addEventListener('click', () => loadData());
    }
    if (els.pageSize) {
      els.pageSize.addEventListener('change', () => {
        state.pageSize = Number(els.pageSize.value) || 10;
        state.page = 1;
        loadData();
      });
    }
    if (els.pagination) {
      els.pagination.addEventListener('click', (event) => {
        const button = event.target.closest('[data-page]');
        if (!button || button.disabled) return;
        const page = Number(button.dataset.page);
        const totalPages = Math.max(1, Math.ceil(state.total / state.pageSize));
        if (!page || page === state.page || page < 1 || page > totalPages) return;
        state.page = page;
        loadData();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }
  }

  function initTableActions() {
    if (!els.tbody) return;
    els.tbody.addEventListener('click', (event) => {
      const button = event.target.closest('[data-action]');
      if (!button) return;
      const row = findRow(button.dataset.id);
      if (!row) return;
      if (button.dataset.action === 'edit') openEdit(row);
      if (button.dataset.action === 'delete') openDelete(row);
    });
  }

  function initModals() {
    if (els.editForm) {
      els.editForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const fields = ['tanggal', 'nama', 'asal_instansi', 'tujuan'];
        const valid = fields.map(validateEditField).every(Boolean);
        if (!valid) {
          const firstInvalid = els.editForm.querySelector('.is-invalid');
          if (firstInvalid) firstInvalid.focus();
          return;
        }

        const id = document.getElementById('editId').value;
        const payload = {
          tanggal: els.editForm.elements.tanggal.value,
          nama: els.editForm.elements.nama.value.trim(),
          asal_instansi: els.editForm.elements.asal_instansi.value.trim(),
          tujuan: els.editForm.elements.tujuan.value.trim(),
        };

        U.setButtonLoading(els.editSave, true, 'Menyimpan...');
        try {
          await DB.updateTamu(id, payload);
          closeModal(els.editModal);
          U.toast('Perubahan data tamu berhasil disimpan.', 'success', 'Data diperbarui');
          loadData();
        } catch (err) {
          U.toast(err.message || 'Perubahan gagal disimpan.', 'error', 'Gagal menyimpan');
        } finally {
          U.setButtonLoading(els.editSave, false);
        }
      });

      els.editForm.querySelectorAll('input').forEach((input) => {
        input.addEventListener('input', () => {
          if (input.classList.contains('is-invalid')) validateEditField(input.name);
        });
      });
    }

    [els.editCancel, els.editClose].forEach((button) => {
      if (button) button.addEventListener('click', () => closeModal(els.editModal));
    });

    if (els.deleteCancel) {
      els.deleteCancel.addEventListener('click', () => closeModal(els.deleteModal));
    }

    if (els.deleteClose) {
      els.deleteClose.addEventListener('click', () => closeModal(els.deleteModal));
    }

    if (els.deleteConfirm) {
      els.deleteConfirm.addEventListener('click', async () => {
        const id = els.deleteConfirm.dataset.id;
        if (!id) return;
        U.setButtonLoading(els.deleteConfirm, true, 'Menghapus...');
        try {
          await DB.deleteTamu(id);
          closeModal(els.deleteModal);
          U.toast('Data tamu telah dihapus dari database.', 'success', 'Data dihapus');
          if (state.rows.length === 1 && state.page > 1) state.page -= 1;
          loadData();
        } catch (err) {
          U.toast(err.message || 'Data gagal dihapus.', 'error', 'Gagal menghapus');
        } finally {
          U.setButtonLoading(els.deleteConfirm, false);
        }
      });
    }

    document.querySelectorAll('.modal-backdrop').forEach((modal) => {
      modal.addEventListener('click', (event) => {
        if (event.target === modal) closeModal(modal);
      });
    });

    window.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      document.querySelectorAll('.modal-backdrop.is-open').forEach((modal) => closeModal(modal));
    });
  }

  function initExport() {
    if (!els.exportBtn) return;
    els.exportBtn.addEventListener('click', async () => {
      U.setButtonLoading(els.exportBtn, true, 'Menyiapkan...');
      try {
        const rows = await DB.listAll({
          search: state.search,
          from: state.from,
          to: state.to,
          order: 'asc',
        });
        const parts = [];
        if (state.from || state.to) {
          parts.push(`Periode ${state.from ? U.formatDate(state.from) : 'awal'} – ${state.to ? U.formatDate(state.to) : 'akhir'}`);
        }
        if (state.search) parts.push(`Pencarian: "${state.search}"`);
        const result = await Export.exportRows({
          rows,
          filename: `Laporan_Buku_Tamu_${U.todayISO()}.xlsx`,
          title: 'Laporan Buku Tamu Digital — Puskesmas Bulusan',
          subtitle: parts.join(' · ') || 'Seluruh data buku tamu',
        });
        U.toast(`${U.formatNumber(result.count)} data berhasil diekspor ke ${result.format.toUpperCase()}.`, 'success', 'Ekspor selesai');
      } catch (err) {
        U.toast(err.message || 'Ekspor gagal. Coba lagi.', 'error', 'Gagal mengekspor');
      } finally {
        U.setButtonLoading(els.exportBtn, false);
      }
    });
  }

  function initTamuPage() {
    cacheElements();
    initFilters();
    initTableActions();
    initModals();
    initExport();
    loadData();
  }

  document.addEventListener('auth:ready', initTamuPage);
})();
