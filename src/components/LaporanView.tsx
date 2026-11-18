import { useMemo } from 'react';
import { Download, FileSpreadsheet, FileText } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import * as XLSX from 'xlsx';
import type { WorkspaceBootstrapData } from '../types/seniRuang';

export function LaporanView({
  data,
  onToast,
}: {
  data: WorkspaceBootstrapData;
  onToast: (type: 'success' | 'error' | 'info', text: string) => void;
}) {
  const karyaByKelas = useMemo(() => {
    const map = new Map<string, number>();
    data.kelas.forEach((k) => map.set(k.nama_kelas, 0));
    data.karya.forEach((k) => {
      map.set(k.kelas, (map.get(k.kelas) || 0) + 1);
    });
    return Array.from(map.entries())
      .map(([kelas, jumlah]) => ({ kelas, jumlah }))
      .filter((r) => r.jumlah > 0);
  }, [data.kelas, data.karya]);

  const karyaByKategori = useMemo(() => {
    const map = new Map<string, number>();
    data.kategoriKarya.forEach((k) => map.set(k.nama_kategori, 0));
    data.karya.forEach((k) => {
      map.set(k.kategori_seni, (map.get(k.kategori_seni) || 0) + 1);
    });
    return Array.from(map.entries()).map(([kategori, jumlah]) => ({ kategori, jumlah }));
  }, [data.kategoriKarya, data.karya]);

  const adminByKelompok = useMemo(() => {
    const groups = [
      'Perencanaan Pembelajaran',
      'Administrasi Penilaian',
      'Administrasi Guru',
    ];
    return groups.map((kelompok) => ({
      kelompok,
      jumlah: data.administrasi.filter((a) => a.kategori_utama === kelompok).length,
    }));
  }, [data.administrasi]);

  const dokumentasiBySub = useMemo(() => {
    const map = new Map<string, number>();
    data.dokumentasi.forEach((d) => {
      map.set(d.sub_kategori, (map.get(d.sub_kategori) || 0) + 1);
    });
    return Array.from(map.entries()).map(([kategori, jumlah]) => ({ kategori, jumlah }));
  }, [data.dokumentasi]);

  const karyaByTahun = useMemo(() => {
    const map = new Map<string, number>();
    data.karya.forEach((k) => {
      const y = k.tahun_ajaran || 'Tidak diketahui';
      map.set(y, (map.get(y) || 0) + 1);
    });
    return Array.from(map.entries()).map(([tahun, jumlah]) => ({ tahun, jumlah }));
  }, [data.karya]);

  const handleExportExcel = () => {
    try {
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet(
          karyaByKategori.map((r) => ({ 'Kategori Seni': r.kategori, 'Jumlah Karya': r.jumlah }))
        ),
        'Rekap Kategori Karya'
      );
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet(
          karyaByKelas.map((r) => ({ Kelas: r.kelas, 'Jumlah Karya': r.jumlah }))
        ),
        'Rekap Karya Per Kelas'
      );
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet(
          adminByKelompok.map((r) => ({ 'Kelompok Administrasi': r.kelompok, 'Jumlah Dokumen': r.jumlah }))
        ),
        'Rekap Administrasi'
      );
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet(
          data.karya.map((k) => ({
            Judul: k.judul_karya,
            Siswa: k.nama_siswa,
            Kelas: k.kelas,
            Kategori: k.kategori_seni,
            Tahun: k.tahun_ajaran,
            Semester: k.semester,
            Status: k.status_publikasi,
            Apresiasi: k.apresiasi_count,
          }))
        ),
        'Data Karya Siswa'
      );

      XLSX.writeFile(
        wb,
        `Laporan_SENI_RUANG_${data.identitas.tahun_ajaran_aktif.replace('/', '-')}.xlsx`
      );
      onToast('success', 'Laporan Excel berhasil diekspor.');
    } catch {
      onToast('error', 'Gagal mengekspor laporan ke Excel.');
    }
  };

  const handleExportPdf = () => {
    try {
      const doc = new jsPDF();
      doc.setFontSize(16);
      doc.text('LAPORAN REKAPITULASI SENI RUANG', 14, 18);
      doc.setFontSize(10);
      doc.text(
        `${data.identitas.nama_sekolah} · Guru: ${data.identitas.nama_guru} · TA ${data.identitas.tahun_ajaran_aktif} (${data.identitas.semester_aktif})`,
        14,
        25
      );

      autoTable(doc, {
        startY: 32,
        head: [['Ringkasan Data', 'Total']],
        body: [
          ['Dokumen Administrasi Guru', String(data.administrasi.length)],
          ['Dokumentasi Kegiatan', String(data.dokumentasi.length)],
          ['Karya Seni Siswa', String(data.karya.length)],
          ['Kelas Aktif', String(data.kelas.length)],
          ['Peserta Didik Terdata', String(data.siswa.length)],
        ],
      });

      const finalY1 = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || 80;
      autoTable(doc, {
        startY: finalY1 + 8,
        head: [['Kategori Karya Seni', 'Jumlah Karya']],
        body: karyaByKategori.map((r) => [r.kategori, String(r.jumlah)]),
      });

      const finalY2 = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || 140;
      autoTable(doc, {
        startY: finalY2 + 8,
        head: [['Kelompok Administrasi', 'Jumlah Dokumen']],
        body: adminByKelompok.map((r) => [r.kelompok, String(r.jumlah)]),
      });

      doc.save(`Laporan_SENI_RUANG_${data.identitas.tahun_ajaran_aktif.replace('/', '-')}.pdf`);
      onToast('success', 'Laporan PDF berhasil diekspor.');
    } catch {
      onToast('error', 'Gagal mengekspor laporan ke PDF.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Laporan & Rekapitulasi</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Ringkasan statistik administrasi, dokumentasi, dan karya seni siswa siap cetak ke PDF & Excel
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleExportExcel}
            className="inline-flex items-center gap-2 rounded-xl border border-teal-200 bg-teal-50 px-4 py-2 text-xs font-semibold text-teal-800 hover:bg-teal-100 transition-colors whitespace-nowrap"
          >
            <FileSpreadsheet className="h-4 w-4" />
            Ekspor Excel (.xlsx)
          </button>
          <button
            type="button"
            onClick={handleExportPdf}
            className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-700 transition-colors whitespace-nowrap"
          >
            <Download className="h-4 w-4" />
            Ekspor PDF
          </button>
        </div>
      </div>

      {/* Chart + Category Breakdown */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="rounded-2xl border border-slate-200/90 bg-white p-6 lg:col-span-7">
          <h3 className="text-base font-semibold text-slate-900">
            Rekapitulasi Karya per Kategori Seni
          </h3>
          <div className="mt-4 h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={karyaByKategori} margin={{ top: 8, right: 12, left: -16, bottom: 25 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis
                  dataKey="kategori"
                  tick={{ fontSize: 10, fill: '#475569' }}
                  angle={-25}
                  textAnchor="end"
                  height={56}
                />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#475569' }} />
                <Tooltip />
                <Bar dataKey="jumlah" name="Jumlah Karya" fill="#0d9488" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/90 bg-white p-6 lg:col-span-5">
          <h3 className="text-base font-semibold text-slate-900">
            Rekap Dokumen Administrasi & Kegiatan
          </h3>
          <div className="mt-4 space-y-3">
            {adminByKelompok.map((row) => (
              <div
                key={row.kelompok}
                className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-3 text-sm"
              >
                <span className="font-medium text-slate-800">{row.kelompok}</span>
                <span className="font-mono font-bold text-teal-700 tabular-nums">
                  {row.jumlah} berkas
                </span>
              </div>
            ))}
            <div className="flex items-center justify-between rounded-xl border border-teal-100 bg-teal-50/50 px-4 py-3 text-sm">
              <span className="font-medium text-teal-950">Dokumentasi Kegiatan</span>
              <span className="font-mono font-bold text-teal-700 tabular-nums">
                {data.dokumentasi.length} berkas
              </span>
            </div>
          </div>

          <h4 className="mt-6 text-sm font-semibold text-slate-900">Karya per Tahun Ajaran</h4>
          <div className="mt-2.5 divide-y divide-slate-100 text-sm">
            {karyaByTahun.length === 0 ? (
              <p className="py-3 text-xs text-slate-500">Belum ada karya siswa tercatat.</p>
            ) : (
              karyaByTahun.map((row) => (
                <div key={row.tahun} className="flex items-center justify-between py-2">
                  <span className="text-slate-700">{row.tahun}</span>
                  <span className="font-mono font-semibold text-slate-900 tabular-nums">
                    {row.jumlah} karya
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Tables: Class Summary & Documentation Summary */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200/90 bg-white p-6">
          <h3 className="text-base font-semibold text-slate-900">Rekap Karya Berdasarkan Kelas</h3>
          {karyaByKelas.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">Belum ada karya yang dikumpulkan per kelas.</p>
          ) : (
            <table className="mt-4 w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-xs text-slate-500">
                <tr>
                  <th className="py-2">Kelas</th>
                  <th className="py-2 text-right">Jumlah Karya</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {karyaByKelas.map((r) => (
                  <tr key={r.kelas}>
                    <td className="py-2.5 font-medium text-slate-800">Kelas {r.kelas}</td>
                    <td className="py-2.5 text-right font-mono font-semibold text-teal-700 tabular-nums">
                      {r.jumlah}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200/90 bg-white p-6">
          <h3 className="text-base font-semibold text-slate-900">Rekap Dokumentasi Kegiatan</h3>
          {dokumentasiBySub.length === 0 ? (
            <div className="mt-4 flex items-center gap-2 text-sm text-slate-500">
              <FileText className="h-4 w-4 text-slate-400" />
              Belum ada dokumentasi kegiatan tercatat.
            </div>
          ) : (
            <table className="mt-4 w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-xs text-slate-500">
                <tr>
                  <th className="py-2">Jenis Kegiatan</th>
                  <th className="py-2 text-right">Jumlah</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {dokumentasiBySub.map((r) => (
                  <tr key={r.kategori}>
                    <td className="py-2.5 font-medium text-slate-800">{r.kategori}</td>
                    <td className="py-2.5 text-right font-mono font-semibold text-teal-700 tabular-nums">
                      {r.jumlah}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
