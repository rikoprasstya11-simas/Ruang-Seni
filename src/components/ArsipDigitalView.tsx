import { useMemo, useState } from 'react';
import { Archive, Download, Eye, FileText, Search } from 'lucide-react';
import { downloadDriveFile } from '../services/apiClient';
import type { WorkspaceBootstrapData } from '../types/seniRuang';
import { FilePreviewModal } from './CommonUI';

interface UnifiedArchiveItem {
  id: string;
  sumber: 'Administrasi Guru' | 'Dokumentasi Kegiatan' | 'Karya Siswa';
  judul: string;
  kategori: string;
  pemilik: string;
  kelas: string;
  tahunAjaran: string;
  namaFile: string;
  formatFile: string;
  ukuranFile: string;
  tanggalUpload: string;
  driveFileId: string;
  driveUrl: string;
}

export function ArsipDigitalView({
  data,
  onToast,
}: {
  data: WorkspaceBootstrapData;
  onToast: (type: 'success' | 'error' | 'info', text: string) => void;
}) {
  const [search, setSearch] = useState('');
  const [filterSumber, setFilterSumber] = useState('Semua');
  const [filterFormat, setFilterFormat] = useState('Semua');
  const [filterTahun, setFilterTahun] = useState('Semua');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [previewItem, setPreviewItem] = useState<UnifiedArchiveItem | null>(null);

  const unifiedList = useMemo<UnifiedArchiveItem[]>(() => {
    const adminItems: UnifiedArchiveItem[] = data.administrasi.map((a) => ({
      id: a.id,
      sumber: 'Administrasi Guru',
      judul: a.judul,
      kategori: `${a.kategori_utama} · ${a.sub_kategori}`,
      pemilik: a.pemilik,
      kelas: a.kelas,
      tahunAjaran: a.tahun_ajaran,
      namaFile: a.nama_file,
      formatFile: a.format_file,
      ukuranFile: a.ukuran_file,
      tanggalUpload: a.tanggal_upload,
      driveFileId: a.drive_file_id,
      driveUrl: a.drive_url,
    }));

    const dokItems: UnifiedArchiveItem[] = data.dokumentasi.map((d) => ({
      id: d.id,
      sumber: 'Dokumentasi Kegiatan',
      judul: d.judul,
      kategori: d.sub_kategori,
      pemilik: d.pemilik,
      kelas: d.kelas,
      tahunAjaran: d.tahun_ajaran,
      namaFile: d.nama_file,
      formatFile: d.format_file,
      ukuranFile: d.ukuran_file,
      tanggalUpload: d.tanggal_upload,
      driveFileId: d.drive_file_id,
      driveUrl: d.drive_url,
    }));

    const karyaItems: UnifiedArchiveItem[] = data.karya.map((k) => ({
      id: k.id,
      sumber: 'Karya Siswa',
      judul: k.judul_karya,
      kategori: k.kategori_seni,
      pemilik: k.nama_siswa,
      kelas: k.kelas,
      tahunAjaran: k.tahun_ajaran,
      namaFile: k.nama_file,
      formatFile: k.format_file,
      ukuranFile: k.ukuran_file,
      tanggalUpload: k.tanggal_upload || k.tanggal_pengumpulan,
      driveFileId: k.drive_file_id,
      driveUrl: k.drive_url,
    }));

    return [...adminItems, ...dokItems, ...karyaItems];
  }, [data.administrasi, data.dokumentasi, data.karya]);

  const availableYears = useMemo(() => {
    const years = new Set<string>();
    unifiedList.forEach((u) => {
      if (u.tahunAjaran) years.add(u.tahunAjaran);
    });
    return Array.from(years);
  }, [unifiedList]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = unifiedList.filter((item) => {
      const matchSearch =
        !q ||
        item.judul.toLowerCase().includes(q) ||
        item.namaFile.toLowerCase().includes(q) ||
        item.pemilik.toLowerCase().includes(q) ||
        item.kategori.toLowerCase().includes(q);
      const matchSumber = filterSumber === 'Semua' || item.sumber === filterSumber;
      const matchTahun = filterTahun === 'Semua' || item.tahunAjaran === filterTahun;
      const fmt = item.formatFile.toUpperCase();
      const matchFormat =
        filterFormat === 'Semua' ||
        (filterFormat === 'PDF' && fmt === 'PDF') ||
        (filterFormat === 'WORD' && (fmt === 'DOC' || fmt === 'DOCX')) ||
        (filterFormat === 'EXCEL' && (fmt === 'XLS' || fmt === 'XLSX')) ||
        (filterFormat === 'PPT' && (fmt === 'PPT' || fmt === 'PPTX')) ||
        (filterFormat === 'GAMBAR' && (fmt === 'JPG' || fmt === 'JPEG' || fmt === 'PNG'));
      return matchSearch && matchSumber && matchTahun && matchFormat;
    });

    return list.sort((a, b) => {
      const tA = new Date(a.tanggalUpload || 0).getTime();
      const tB = new Date(b.tanggalUpload || 0).getTime();
      return sortOrder === 'newest' ? tB - tA : tA - tB;
    });
  }, [unifiedList, search, filterSumber, filterFormat, filterTahun, sortOrder]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-slate-900">Arsip Digital Terpusat</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Pencarian global seluruh dokumen administrasi, modul ajar, penilaian, dokumentasi, dan karya siswa di Google Drive
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200/90 bg-white p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <div className="relative lg:col-span-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari global: judul, siswa, file, kategori..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2 pl-9 pr-3 text-sm focus:border-teal-600 focus:bg-white focus:outline-none"
            />
          </div>
          <select
            value={filterSumber}
            onChange={(e) => setFilterSumber(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-teal-600 focus:outline-none"
          >
            <option value="Semua">Semua Kategori Sumber</option>
            <option value="Administrasi Guru">Administrasi Guru</option>
            <option value="Dokumentasi Kegiatan">Dokumentasi Kegiatan</option>
            <option value="Karya Siswa">Karya Siswa</option>
          </select>
          <select
            value={filterFormat}
            onChange={(e) => setFilterFormat(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-teal-600 focus:outline-none"
          >
            <option value="Semua">Semua Jenis File</option>
            <option value="PDF">Dokumen PDF</option>
            <option value="WORD">Microsoft Word (DOC/X)</option>
            <option value="EXCEL">Microsoft Excel (XLS/X)</option>
            <option value="PPT">Presentasi (PPT/X)</option>
            <option value="GAMBAR">Gambar (JPG/PNG)</option>
          </select>
          <select
            value={filterTahun}
            onChange={(e) => setFilterTahun(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-teal-600 focus:outline-none"
          >
            <option value="Semua">Semua Tahun Ajaran</option>
            {availableYears.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as 'newest' | 'oldest')}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-teal-600 focus:outline-none"
          >
            <option value="newest">Urutan Terbaru</option>
            <option value="oldest">Urutan Terlama</option>
          </select>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <Archive className="h-10 w-10 text-slate-300" />
            <h3 className="mt-3 text-base font-semibold text-slate-900">
              Tidak ada arsip yang cocok
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Sesuaikan kata kunci pencarian atau unggah dokumen baru terlebih dahulu.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-600">
                <tr>
                  <th className="px-5 py-3.5">Nama Arsip</th>
                  <th className="px-4 py-3.5">Sumber & Kategori</th>
                  <th className="px-4 py-3.5">Pemilik / Siswa</th>
                  <th className="px-4 py-3.5">Format</th>
                  <th className="px-4 py-3.5">Tanggal</th>
                  <th className="px-5 py-3.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((item) => (
                  <tr key={`${item.sumber}-${item.id}`} className="hover:bg-teal-50/20">
                    <td className="px-5 py-3.5">
                      <div className="flex items-start gap-3">
                        <FileText className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" />
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900">{item.judul}</p>
                          <p className="truncate text-xs text-slate-500 max-w-xs">
                            {item.namaFile}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-xs text-slate-700">
                      <p className="font-semibold text-teal-800">{item.sumber}</p>
                      <p className="text-slate-500">{item.kategori}</p>
                    </td>
                    <td className="px-4 py-3.5 text-xs text-slate-700">
                      <span>{item.pemilik}</span>
                      <span className="mx-1.5 text-slate-300">·</span>
                      <span>{item.kelas}</span>
                    </td>
                    <td className="px-4 py-3.5 font-mono text-xs text-slate-600 tabular-nums">
                      {item.formatFile} · {item.ukuranFile}
                    </td>
                    <td className="px-4 py-3.5 font-mono text-xs text-slate-500 tabular-nums">
                      {item.tanggalUpload
                        ? new Date(item.tanggalUpload).toLocaleDateString('id-ID')
                        : '-'}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setPreviewItem(item)}
                          className="rounded-lg p-2 text-slate-600 hover:bg-teal-50 hover:text-teal-700"
                          title="Pratinjau"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            downloadDriveFile(item.driveFileId, item.namaFile).catch((e) =>
                              onToast('error', e.message)
                            )
                          }
                          className="rounded-lg p-2 text-slate-600 hover:bg-teal-50 hover:text-teal-700"
                          title="Unduh"
                        >
                          <Download className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <FilePreviewModal
        open={Boolean(previewItem)}
        title={previewItem?.judul || ''}
        subtitle={
          previewItem
            ? `${previewItem.sumber} · ${previewItem.kategori} · ${previewItem.pemilik}`
            : ''
        }
        fileId={previewItem?.driveFileId || ''}
        fileName={previewItem?.namaFile || ''}
        format={previewItem?.formatFile || ''}
        driveUrl={previewItem?.driveUrl || ''}
        onDownload={() =>
          previewItem &&
          downloadDriveFile(previewItem.driveFileId, previewItem.namaFile).catch((e) =>
            onToast('error', e.message)
          )
        }
        onClose={() => setPreviewItem(null)}
      />
    </div>
  );
}
