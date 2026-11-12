/* Halaman publik: form buku tamu. */
(function () {
  'use strict';

  const U = window.Utils;

  document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('guestForm');
    if (!form) return;

    const dateInput = document.getElementById('tanggal');
    const submit = document.getElementById('submitBtn');
    const formCard = document.getElementById('formCard');
    const successPanel = document.getElementById('successPanel');
    const successName = document.getElementById('successName');
    const successMeta = document.getElementById('successMeta');
    const successDetails = document.getElementById('successDetails');
    const again = document.getElementById('fillAgain');
    const today = U.todayISO();

    dateInput.value = today;
    dateInput.max = today;

    if (DB.isDemo) {
      document.querySelectorAll('[data-demo-note]').forEach((el) => { el.hidden = false; });
    }

    const rules = {
      nama: (v) => {
        const trimmed = v.trim();
        if (!trimmed) return 'Nama wajib diisi.';
        if (trimmed.length < 2) return 'Nama minimal 2 karakter.';
        if (trimmed.length > 120) return 'Nama maksimal 120 karakter.';
        return '';
      },
      asal_instansi: (v) => {
        const trimmed = v.trim();
        if (!trimmed) return 'Asal instansi wajib diisi.';
        if (trimmed.length > 150) return 'Asal instansi maksimal 150 karakter.';
        return '';
      },
      tujuan: (v) => {
        const trimmed = v.trim();
        if (!trimmed) return 'Tujuan kunjungan wajib diisi.';
        if (trimmed.length > 200) return 'Tujuan maksimal 200 karakter.';
        return '';
      },
      tanggal: (v) => {
        if (!v) return 'Tanggal kunjungan wajib diisi.';
        if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || isNaN(U.parseISO(v).getTime())) {
          return 'Format tanggal tidak valid.';
        }
        return '';
      },
    };

    function validateField(name) {
      const input = form.elements[name];
      const message = rules[name] ? rules[name](input.value) : '';
      U.setFieldError(form, name, message);
      return !message;
    }

    ['nama', 'asal_instansi', 'tujuan', 'tanggal'].forEach((name) => {
      const input = form.elements[name];
      input.addEventListener('blur', () => validateField(name));
      input.addEventListener('input', () => {
        if (input.classList.contains('is-invalid')) validateField(name);
      });
    });

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      U.clearFieldErrors(form);

      const fields = ['tanggal', 'nama', 'asal_instansi', 'tujuan'];
      const valid = fields.map(validateField).every(Boolean);
      if (!valid) {
        const firstInvalid = form.querySelector('.is-invalid');
        if (firstInvalid) firstInvalid.focus();
        U.toast('Periksa kembali data yang Anda isi.', 'error', 'Formulir belum lengkap');
        return;
      }

      const payload = {
        tanggal: dateInput.value,
        nama: form.elements.nama.value.trim(),
        asal_instansi: form.elements.asal_instansi.value.trim(),
        tujuan: form.elements.tujuan.value.trim(),
      };

      U.setButtonLoading(submit, true, 'Menyimpan...');
      try {
        await DB.insertTamu(payload);

        formCard.querySelector('.form-body').hidden = true;
        formCard.querySelector('.card-head').hidden = true;
        successPanel.hidden = false;
        successName.textContent = payload.nama;
        successMeta.textContent = `Kunjungan Anda telah tercatat pada ${U.formatDate(payload.tanggal, 'full')}.`;
        successDetails.innerHTML = `
          <div><span>Nama</span><strong>${U.escapeHtml(payload.nama)}</strong></div>
          <div><span>Asal Instansi</span><strong>${U.escapeHtml(payload.asal_instansi)}</strong></div>
          <div><span>Tujuan</span><strong>${U.escapeHtml(payload.tujuan)}</strong></div>`;
        successPanel.focus?.();
        window.scrollTo({ top: 0, behavior: 'smooth' });
        U.toast('Terima kasih, data kunjungan Anda sudah tersimpan.', 'success', 'Buku tamu terkirim');
      } catch (err) {
        U.toast(err.message || 'Data gagal disimpan. Silakan coba lagi.', 'error', 'Gagal menyimpan');
      } finally {
        U.setButtonLoading(submit, false);
      }
    });

    if (again) {
      again.addEventListener('click', () => {
        form.reset();
        U.clearFieldErrors(form);
        dateInput.value = today;
        successPanel.hidden = true;
        formCard.querySelector('.form-body').hidden = false;
        formCard.querySelector('.card-head').hidden = false;
        form.elements.nama.focus();
      });
    }

    document.querySelectorAll('[data-today]').forEach((el) => {
      el.textContent = U.formatDate(today, 'full');
    });
  });
})();
