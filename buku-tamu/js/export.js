/* Ekspor data ke Excel (.xlsx) dengan fallback CSV. */
(function () {
  'use strict';

  const U = window.Utils;

  function dateDMY(iso) {
    const parts = String(iso || '').slice(0, 10).split('-');
    if (parts.length !== 3) return iso || '';
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }

  // Cegah formula injection saat file dibuka di Excel.
  function safeCell(value) {
    const text = String(value == null ? '' : value);
    return /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  }

  function downloadCsv(aoa, filename) {
    const csv = aoa
      .map((row) => row.map((cell) => {
        const text = cell == null ? '' : String(cell);
        return /[",;\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
      }).join(';'))
      .join('\r\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename.replace(/\.xlsx$/i, '.csv');
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  async function exportRows({ rows, filename, title, subtitle }) {
    if (!Array.isArray(rows) || !rows.length) {
      throw new Error('Tidak ada data untuk diekspor pada periode ini.');
    }

    const aoa = [
      [title || 'Laporan Buku Tamu Digital'],
      [subtitle || ''],
      [],
      ['No', 'Tanggal', 'Nama', 'Asal Instansi', 'Tujuan', 'Waktu Pencatatan'],
    ];

    rows.forEach((row, index) => {
      aoa.push([
        index + 1,
        dateDMY(row.tanggal),
        safeCell(row.nama),
        safeCell(row.asal_instansi),
        safeCell(row.tujuan),
        U.formatDateTime(row.created_at),
      ]);
    });

    const safeName = String(filename || 'Laporan_Buku_Tamu.xlsx').replace(/[\\/:*?"<>|]/g, '_');

    if (window.XLSX && window.XLSX.utils) {
      const sheet = window.XLSX.utils.aoa_to_sheet(aoa);
      sheet['!cols'] = [
        { wch: 5 }, { wch: 12 }, { wch: 26 }, { wch: 34 }, { wch: 40 }, { wch: 24 },
      ];
      sheet['!autofilter'] = { ref: `A4:F${aoa.length}` };
      const workbook = window.XLSX.utils.book_new();
      window.XLSX.utils.book_append_sheet(workbook, sheet, 'Buku Tamu');
      window.XLSX.writeFile(workbook, safeName);
      return { format: 'xlsx', count: rows.length };
    }

    downloadCsv(aoa, safeName);
    return { format: 'csv', count: rows.length };
  }

  window.Export = { exportRows };
})();
