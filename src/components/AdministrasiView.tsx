import { useMemo, useState } from 'react';
import {
  Download,
  Edit3,
  Eye,
  FileText,
  FolderOpen,
  Plus,
  Search,
  Trash2,
  UploadCloud,
} from 'lucide-react';
import {
  deleteArchivePermanent,
  downloadDriveFile,
  updateSheetRow,
  uploadFileWithProgress,
} from '../services/apiClient';
import {
  ALLOWED_FILE_EXTENSIONS,
  type AdminGroup,
  type AdministrasiRecord,
  type DokumentasiRecord,
  type WorkspaceBootstrapData,
} from '../types/seniRuang';
import { ConfirmDialog, FilePreviewModal, ModalShell } from './CommonUI';

interface AdministrasiViewProps {
  data: WorkspaceBootstrapData;
  onRefresh: () => Promise<void>;
  onToast: (type: 'success' | 'error' | 'info', text: string) => void;
}

const GROUPS: AdminGroup[] = [
  'Perencanaan Pembelajaran',
  'Administrasi Penilaian',
  'Administrasi Guru',
  'Dokumentasi Kegiatan',
];

export function AdministrasiView({ data, onRefresh, onToast }: AdministrasiViewProps) {
  const [activeGroup, setActiveGroup] = useState<AdminGroup>('Perencanaan Pembelajaran');
  const [search, setSearch] = useState('');
  const [filterSub, setFilterSub] = useState('Semua');
  const [filterKelas, setFilterKelas] = useState('Semua');
  const [filterSemester, setFilterSemester] = useState('Semua');
  const [filterTahun, setFilterTahun] = useState('Semua');

  // Upload modal state
  const [uploadOpen, setUploadOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isUploading, setIsUploading] = useState(false);
  const [judul, setJudul] = useState('');
  const [subKategori, setSubKategori] = useState('');
  const [kelas, setKelas] = useState('Semua Kelas');
  const [semester, setSemester] = useState(data.identitas.semester_aktif || 'Ganjil');
  const [tahunAjaran, setTahunAjaran] = useState(data.identitas.tahun_ajaran_aktif || '2026/2027');
  const [tanggalKegiatan, setTanggalKegiatan] = useState(new Date().toISOString().slice(0, 10));
  const [keterangan, setKeterangan] = useState('');
  const [statusPublikasi, setStatusPublikasi] = useState('Arsip Internal');

  // Edit modal & confirmation state
  const [editingItem, setEditingItem] = useState<{
    id: string;
    sheet: 'ADMINISTRASI' | 'DOKUMENTASI';
    judul: string;
    sub_kategori: string;
    kelas: string;
    semester: string;
    tahun_ajaran: string;
    keterangan: string;
  } | null>(null);
  const [confirmEditOpen, setConfirmEditOpen] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    sheet: 'ADMINISTRASI' | 'DOKUMENTASI';
    judul: string;
    namaFile: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Preview state
  const [previewItem, setPreviewItem] = useState<{
    title: string;
    subtitle: string;
    fileId: string;
    fileName: string;
    format: string;
    driveUrl: string;
  } | null>(null);

  const maxUploadMb = Number(
    data.pengaturan.find((p) => p.kunci === 'max_upload_mb')?.nilai || '15'
  );

  const subCategoriesForGroup = useMemo(() => {
    return data.kategoriDokumen
      .filter((k) => k.kelompok === activeGroup && k.aktif !== 'Tidak')
      .map((k) => k.nama_kategori);
  }, [data.kategoriDokumen, activeGroup]);

  const combinedItems = useMemo(() => {
    if (activeGroup === 'Dokumentasi Kegiatan') {
      return data.dokumentasi.map((d) => ({
        ...d,
        sheet: 'DOKUMENTASI' as const,
        kategori_utama: 'Dokumentasi Kegiatan' as const,
        keterangan: d.deskripsi,
      }));
    }
    return data.administrasi
      .filter((a) => a.kategori_utama === activeGroup)
      .map((a) => ({
        ...a,
        sheet: 'ADMINISTRASI' as const,
      }));
  }, [activeGroup, data.administrasi, data.dokumentasi]);

  const availableYears = useMemo(() => {
    const set = new Set<string>([data.identitas.tahun_ajaran_aktif || '2026/2027']);
    combinedItems.forEach((item) => {
      if (item.tahun_ajaran) set.add(item.tahun_ajaran);
    });
    return Array.from(set);
  }, [combinedItems, data.identitas.tahun_ajaran_aktif]);

  const filteredItems = useMemo(() => {
    return combinedItems.filter((item) => {
      const q = search.trim().toLowerCase();
      const matchSearch =
        !q ||
        item.judul.toLowerCase().includes(q) ||
        item.nama_file.toLowerCase().includes(q) ||
        item.sub_kategori.toLowerCase().includes(q);
      const matchSub = filterSub === 'Semua' || item.sub_kategori === filterSub;
      const matchKelas = filterKelas === 'Semua' || item.kelas === filterKelas;
      const matchSem = filterSemester === 'Semua' || item.semester === filterSemester;
      const matchTahun = filterTahun === 'Semua' || item.tahun_ajaran === filterTahun;
      return matchSearch && matchSub && matchKelas && matchSem && matchTahun;
    });
  }, [combinedItems, search, filterSub, filterKelas, filterSemester, filterTahun]);

  const resolveFolderIdForGroup = (group: AdminGroup) => {
    if (group === 'Perencanaan Pembelajaran') return data.folders.perencanaanId || data.rootFolderId;
    if (group === 'Administrasi Penilaian') return data.folders.penilaianId || data.rootFolderId;
    if (group === 'Administrasi Guru') return data.folders.adminGuruId || data.rootFolderId;
    return data.folders.dokumentasiId || data.rootFolderId;
  };

  const openUploadModal = () => {
    setSelectedFile(null);
    setUploadProgress(0);
    setJudul('');
    setSubKategori(subCategoriesForGroup[0] || '');
    setKelas('Semua Kelas');
    setSemester(data.identitas.semester_aktif || 'Ganjil');
    setTahunAjaran(data.identitas.tahun_ajaran_aktif || '2026/2027');
    setKeterangan('');
    setStatusPublikasi('Arsip Internal');
    setUploadOpen(true);
  };

  const handleFileChange = (file: File | null) => {
    if (!file) {
      setSelectedFile(null);
      return;
    }
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    if (!ALLOWED_FILE_EXTENSIONS.includes(ext as (typeof ALLOWED_FILE_EXTENSIONS)[number])) {
      onToast('error', `Format .${ext} tidak didukung. Gunakan PDF, DOC/X, XLS/X, PPT/X, JPG, JPEG, atau PNG.`);
      return;
    }
    if (file.size > maxUploadMb * 1024 * 1024) {
      onToast('error', `Ukuran file melebihi batas maksimal ${maxUploadMb} MB.`);
      return;
    }
    setSelectedFile(file);
    if (!judul.trim()) {
      setJudul(file.name.replace(/\.[^/.]+$/, ''));
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      onToast('error', 'Pilih file terlebih dahulu sebelum mengunggah.');
      return;
    }
    if (isUploading) return;

    setIsUploading(true);
    setUploadProgress(5);
    try {
      const targetSheet = activeGroup === 'Dokumentasi Kegiatan' ? 'DOKUMENTASI' : 'ADMINISTRASI';
      const folderId = resolveFolderIdForGroup(activeGroup);

      const record: Record<string, string> =
        targetSheet === 'DOKUMENTASI'
          ? {
              judul: judul.trim(),
              sub_kategori: subKategori,
              kelas,
              semester,
              tahun_ajaran: tahunAjaran,
              tanggal_kegiatan: tanggalKegiatan,
              deskripsi: keterangan.trim(),
              status_publikasi: statusPublikasi,
            }
          : {
              judul: judul.trim(),
              kategori_utama: activeGroup,
              sub_kategori: subKategori,
              kelas,
              semester,
              tahun_ajaran: tahunAjaran,
              status_publikasi: statusPublikasi,
              keterangan: keterangan.trim(),
            };

      await uploadFileWithProgress({
        file: selectedFile,
        spreadsheetId: data.spreadsheetId,
        targetSheet,
        folderId,
        record,
        onProgress: setUploadProgress,
      });

      onToast('success', `"${judul.trim()}" berhasil diunggah ke Google Drive dan dicatat di Google Sheets.`);
      setUploadOpen(false);
      await onRefresh();
    } catch (err) {
      onToast('error', err instanceof Error ? err.message : 'Gagal mengunggah dokumen.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleConfirmEditSave = async () => {
    if (!editingItem) return;
    setIsSavingEdit(true);
    try {
      const updates: Record<string, string> =
        editingItem.sheet === 'DOKUMENTASI'
          ? {
              judul: editingItem.judul,
              sub_kategori: editingItem.sub_kategori,
              kelas: editingItem.kelas,
              semester: editingItem.semester,
              tahun_ajaran: editingItem.tahun_ajaran,
              deskripsi: editingItem.keterangan,
            }
          : {
              judul: editingItem.judul,
              sub_kategori: editingItem.sub_kategori,
              kelas: editingItem.kelas,
              semester: editingItem.semester,
              tahun_ajaran: editingItem.tahun_ajaran,
              keterangan: editingItem.keterangan,
            };

      await updateSheetRow(editingItem.sheet, data.spreadsheetId, editingItem.id, updates);
      onToast('success', 'Informasi dokumen berhasil diperbarui di Google Sheets.');
      setConfirmEditOpen(false);
      setEditingItem(null);
      await onRefresh();
    } catch (err) {
      onToast('error', err instanceof Error ? err.message : 'Gagal memperbarui informasi dokumen.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteArchivePermanent(deleteTarget.sheet, data.spreadsheetId, deleteTarget.id);
      onToast('success', `"${deleteTarget.judul}" dan file Google Drive terkait telah dihapus permanen.`);
      setDeleteTarget(null);
      await onRefresh();
    } catch (err) {
      onToast('error', err instanceof Error ? err.message : 'Gagal menghapus arsip.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Segmented Category Tabs + Primary Upload CTA */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-1.5 rounded-xl bg-slate-100 p-1">
          {GROUPS.map((group) => (
            <button
              key={group}
              type="button"
              onClick={() => {
                setActiveGroup(group);
                setFilterSub('Semua');
              }}
              className={`rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
                activeGroup === group
                  ? 'bg-white text-teal-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {group}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={openUploadModal}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 transition-colors whitespace-nowrap shrink-0"
        >
          <Plus className="h-4 w-4" />
          Tambah & Unggah Dokumen
        </button>
      </div>

      {/* Search and Filters */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <div className="relative lg:col-span-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama dokumen atau file..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2 pl-9 pr-3 text-sm focus:border-teal-600 focus:bg-white focus:outline-none"
            />
          </div>
          <select
            value={filterSub}
            onChange={(e) => setFilterSub(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-teal-600 focus:outline-none"
          >
            <option value="Semua">Semua Sub-Kategori</option>
            {subCategoriesForGroup.map((sub) => (
              <option key={sub} value={sub}>
                {sub}
              </option>
            ))}
          </select>
          <select
            value={filterKelas}
            onChange={(e) => setFilterKelas(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-teal-600 focus:outline-none"
          >
            <option value="Semua">Semua Kelas</option>
            <option value="Semua Kelas">Umum / Semua Kelas</option>
            <option value="Tingkat VII">Tingkat VII</option>
            <option value="Tingkat VIII">Tingkat VIII</option>
            <option value="Tingkat IX">Tingkat IX</option>
            {data.kelas.map((k) => (
              <option key={k.id} value={k.nama_kelas}>
                Kelas {k.nama_kelas}
              </option>
            ))}
          </select>
          <select
            value={filterSemester}
            onChange={(e) => setFilterSemester(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-teal-600 focus:outline-none"
          >
            <option value="Semua">Semua Semester</option>
            <option value="Ganjil">Semester Ganjil</option>
            <option value="Genap">Semester Genap</option>
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
        </div>
      </div>

      {/* Document Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white">
        {filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-50 text-teal-600">
              <FolderOpen className="h-6 w-6" />
            </div>
            <h3 className="mt-4 text-base font-semibold text-slate-900">
              Belum ada dokumen pada {activeGroup}
            </h3>
            <p className="mt-1 max-w-md text-sm text-slate-500">
              Unggah file PDF, Word, Excel, PowerPoint, atau foto dokumentasi. Berkas akan disimpan ke folder Google Drive terkait.
            </p>
            <button
              type="button"
              onClick={openUploadModal}
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700"
            >
              <UploadCloud className="h-4 w-4" />
              Unggah Dokumen Pertama
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-600">
                <tr>
                  <th className="px-5 py-3.5">Dokumen & Berkas</th>
                  <th className="px-4 py-3.5">Sub-Kategori</th>
                  <th className="px-4 py-3.5">Kelas & Periode</th>
                  <th className="px-4 py-3.5">Format & Ukuran</th>
                  <th className="px-4 py-3.5">Tanggal Unggah</th>
                  <th className="px-5 py-3.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredItems.map((item) => (
                  <tr key={item.id} className="hover:bg-teal-50/20 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-start gap-3">
                        <FileText className="mt-0.5 h-4.5 w-4.5 shrink-0 text-teal-600" />
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900">{item.judul}</p>
                          <p className="truncate text-xs text-slate-500 max-w-xs">{item.nama_file}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-slate-700">{item.sub_kategori}</td>
                    <td className="px-4 py-3.5 text-xs text-slate-600">
                      <span>{item.kelas}</span>
                      <span className="mx-1.5">·</span>
                      <span>{item.semester}</span>
                      <span className="mx-1.5">·</span>
                      <span className="tabular-nums">{item.tahun_ajaran}</span>
                    </td>
                    <td className="px-4 py-3.5 font-mono text-xs text-slate-600 tabular-nums">
                      {item.format_file} · {item.ukuran_file}
                    </td>
                    <td className="px-4 py-3.5 font-mono text-xs text-slate-500 tabular-nums">
                      {item.tanggal_upload
                        ? new Date(item.tanggal_upload).toLocaleDateString('id-ID')
                        : '-'}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() =>
                            setPreviewItem({
                              title: item.judul,
                              subtitle: `${item.sub_kategori} · ${item.kelas} · ${item.tahun_ajaran}`,
                              fileId: item.drive_file_id,
                              fileName: item.nama_file,
                              format: item.format_file,
                              driveUrl: item.drive_url,
                            })
                          }
                          title="Pratinjau Dokumen"
                          className="rounded-lg p-2 text-slate-600 hover:bg-teal-50 hover:text-teal-700 transition-colors"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            downloadDriveFile(item.drive_file_id, item.nama_file).catch((e) =>
                              onToast('error', e.message)
                            )
                          }
                          title="Unduh Dokumen"
                          className="rounded-lg p-2 text-slate-600 hover:bg-teal-50 hover:text-teal-700 transition-colors"
                        >
                          <Download className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setEditingItem({
                              id: item.id,
                              sheet: item.sheet,
                              judul: item.judul,
                              sub_kategori: item.sub_kategori,
                              kelas: item.kelas,
                              semester: item.semester,
                              tahun_ajaran: item.tahun_ajaran,
                              keterangan: item.keterangan || '',
                            })
                          }
                          title="Edit Informasi"
                          className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                        >
                          <Edit3 className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setDeleteTarget({
                              id: item.id,
                              sheet: item.sheet,
                              judul: item.judul,
                              namaFile: item.nama_file,
                            })
                          }
                          title="Hapus Permanen"
                          className="rounded-lg p-2 text-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
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

      {/* Upload Modal */}
      <ModalShell
        open={uploadOpen}
        onClose={() => !isUploading && setUploadOpen(false)}
        title={`Unggah ke ${activeGroup}`}
        subtitle={`Format didukung: PDF, DOC/X, XLS/X, PPT/X, JPG, PNG (maks. ${maxUploadMb} MB)`}
      >
        <form onSubmit={handleUploadSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700">Pilih File dari Perangkat</label>
            <input
              type="file"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png"
              onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
              className="mt-1.5 block w-full rounded-xl border border-dashed border-teal-300 bg-teal-50/30 p-3 text-sm text-slate-700 file:mr-4 file:rounded-lg file:border-0 file:bg-teal-600 file:px-3.5 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:file:bg-teal-700"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700">Judul Dokumen</label>
            <input
              type="text"
              required
              value={judul}
              onChange={(e) => setJudul(e.target.value)}
              placeholder="Contoh: Modul Ajar Seni Rupa Fase D - Ragam Hias"
              className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm focus:border-teal-600 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700">Sub-Kategori</label>
              <select
                required
                value={subKategori}
                onChange={(e) => setSubKategori(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm focus:border-teal-600 focus:outline-none"
              >
                {subCategoriesForGroup.map((sub) => (
                  <option key={sub} value={sub}>
                    {sub}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">Target Kelas</label>
              <select
                value={kelas}
                onChange={(e) => setKelas(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm focus:border-teal-600 focus:outline-none"
              >
                <option value="Semua Kelas">Semua Kelas</option>
                <option value="Tingkat VII">Tingkat VII</option>
                <option value="Tingkat VIII">Tingkat VIII</option>
                <option value="Tingkat IX">Tingkat IX</option>
                {data.kelas.map((k) => (
                  <option key={k.id} value={k.nama_kelas}>
                    Kelas {k.nama_kelas}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700">Semester</label>
              <select
                value={semester}
                onChange={(e) => setSemester(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm focus:border-teal-600 focus:outline-none"
              >
                <option value="Ganjil">Ganjil</option>
                <option value="Genap">Genap</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">Tahun Ajaran</label>
              <input
                type="text"
                required
                value={tahunAjaran}
                onChange={(e) => setTahunAjaran(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm focus:border-teal-600 focus:outline-none"
              />
            </div>
            {activeGroup === 'Dokumentasi Kegiatan' ? (
              <div>
                <label className="block text-xs font-semibold text-slate-700">Tanggal Kegiatan</label>
                <input
                  type="date"
                  value={tanggalKegiatan}
                  onChange={(e) => setTanggalKegiatan(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm focus:border-teal-600 focus:outline-none"
                />
              </div>
            ) : (
              <div>
                <label className="block text-xs font-semibold text-slate-700">Status</label>
                <select
                  value={statusPublikasi}
                  onChange={(e) => setStatusPublikasi(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm focus:border-teal-600 focus:outline-none"
                >
                  <option value="Arsip Internal">Arsip Internal</option>
                  <option value="Dipublikasikan">Dipublikasikan</option>
                </select>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700">Keterangan / Catatan</label>
            <textarea
              rows={2}
              value={keterangan}
              onChange={(e) => setKeterangan(e.target.value)}
              placeholder="Ringkasan isi dokumen atau catatan pembelajaran..."
              className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm focus:border-teal-600 focus:outline-none"
            />
          </div>

          {isUploading && (
            <div className="space-y-1.5 rounded-xl bg-teal-50 p-3">
              <div className="flex items-center justify-between text-xs font-semibold text-teal-900">
                <span>Mengunggah ke Google Drive...</span>
                <span className="font-mono tabular-nums">{uploadProgress}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-teal-200">
                <div
                  className="h-full bg-teal-600 transition-all duration-200"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2.5 pt-2">
            <button
              type="button"
              disabled={isUploading}
              onClick={() => setUploadOpen(false)}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isUploading}
              className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-5 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-60"
            >
              <UploadCloud className="h-4 w-4" />
              {isUploading ? 'Mengunggah...' : 'Simpan & Unggah'}
            </button>
          </div>
        </form>
      </ModalShell>

      {/* Edit Metadata Modal */}
      <ModalShell
        open={Boolean(editingItem)}
        onClose={() => setEditingItem(null)}
        title="Edit Informasi Dokumen"
        subtitle="Perubahan metadata akan diperbarui pada Google Sheets"
      >
        {editingItem && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setConfirmEditOpen(true);
            }}
            className="space-y-4"
          >
            <div>
              <label className="block text-xs font-semibold text-slate-700">Judul Dokumen</label>
              <input
                type="text"
                required
                value={editingItem.judul}
                onChange={(e) => setEditingItem({ ...editingItem, judul: e.target.value })}
                className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm focus:border-teal-600 focus:outline-none"
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700">Sub-Kategori</label>
                <select
                  value={editingItem.sub_kategori}
                  onChange={(e) => setEditingItem({ ...editingItem, sub_kategori: e.target.value })}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm focus:border-teal-600 focus:outline-none"
                >
                  {subCategoriesForGroup.map((sub) => (
                    <option key={sub} value={sub}>
                      {sub}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">Kelas</label>
                <input
                  type="text"
                  value={editingItem.kelas}
                  onChange={(e) => setEditingItem({ ...editingItem, kelas: e.target.value })}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm focus:border-teal-600 focus:outline-none"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700">Semester</label>
                <select
                  value={editingItem.semester}
                  onChange={(e) => setEditingItem({ ...editingItem, semester: e.target.value })}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm focus:border-teal-600 focus:outline-none"
                >
                  <option value="Ganjil">Ganjil</option>
                  <option value="Genap">Genap</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">Tahun Ajaran</label>
                <input
                  type="text"
                  value={editingItem.tahun_ajaran}
                  onChange={(e) => setEditingItem({ ...editingItem, tahun_ajaran: e.target.value })}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm focus:border-teal-600 focus:outline-none"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">Keterangan</label>
              <textarea
                rows={2}
                value={editingItem.keterangan}
                onChange={(e) => setEditingItem({ ...editingItem, keterangan: e.target.value })}
                className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm focus:border-teal-600 focus:outline-none"
              />
            </div>
            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Batal
              </button>
              <button
                type="submit"
                className="rounded-xl bg-teal-600 px-5 py-2 text-sm font-semibold text-white hover:bg-teal-700"
              >
                Simpan Perubahan
              </button>
            </div>
          </form>
        )}
      </ModalShell>

      <ConfirmDialog
        open={confirmEditOpen}
        variant="primary"
        title="Simpan Perubahan Dokumen?"
        description={`Apakah Anda yakin ingin memperbarui informasi dokumen "${editingItem?.judul}" pada Google Sheets?`}
        confirmLabel="Ya, Perbarui"
        loading={isSavingEdit}
        onConfirm={handleConfirmEditSave}
        onCancel={() => setConfirmEditOpen(false)}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        variant="danger"
        title="Hapus Dokumen Secara Permanen?"
        description={`Dokumen "${deleteTarget?.judul}" (${deleteTarget?.namaFile}) akan dihapus permanen dari Google Drive dan Google Sheets. Tindakan ini tidak dapat dibatalkan.`}
        confirmLabel="Hapus Permanen"
        loading={isDeleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <FilePreviewModal
        open={Boolean(previewItem)}
        title={previewItem?.title || ''}
        subtitle={previewItem?.subtitle}
        fileId={previewItem?.fileId || ''}
        fileName={previewItem?.fileName || ''}
        format={previewItem?.format || ''}
        driveUrl={previewItem?.driveUrl || ''}
        onDownload={() =>
          previewItem &&
          downloadDriveFile(previewItem.fileId, previewItem.fileName).catch((e) =>
            onToast('error', e.message)
          )
        }
        onClose={() => setPreviewItem(null)}
      />
    </div>
  );
}
