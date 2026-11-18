import { useMemo, useState } from 'react';
import {
  Award,
  Download,
  Edit3,
  Eye,
  Heart,
  Palette,
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
  ALLOWED_IMAGE_EXTENSIONS,
  type KaryaSiswaRecord,
  type WorkspaceBootstrapData,
} from '../types/seniRuang';
import { ConfirmDialog, ModalShell } from './CommonUI';
import { DriveImage } from './DriveImage';

interface GaleriKaryaViewProps {
  data: WorkspaceBootstrapData;
  initialFilterKelas?: string;
  onRefresh: () => Promise<void>;
  onToast: (type: 'success' | 'error' | 'info', text: string) => void;
}

export function GaleriKaryaView({
  data,
  initialFilterKelas = 'Semua',
  onRefresh,
  onToast,
}: GaleriKaryaViewProps) {
  const [search, setSearch] = useState('');
  const [filterKelas, setFilterKelas] = useState(initialFilterKelas);
  const [filterKategori, setFilterKategori] = useState('Semua');
  const [filterStatus, setFilterStatus] = useState('Semua');

  // Upload state
  const [uploadOpen, setUploadOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const [judulKarya, setJudulKarya] = useState('');
  const [namaSiswa, setNamaSiswa] = useState(data.role === 'SISWA' ? data.userName : '');
  const [nisSiswa, setNisSiswa] = useState('');
  const [kelas, setKelas] = useState(data.kelas[0]?.nama_kelas || 'VII.1');
  const [tahunAjaran, setTahunAjaran] = useState(data.identitas.tahun_ajaran_aktif || '2026/2027');
  const [semester, setSemester] = useState(data.identitas.semester_aktif || 'Ganjil');
  const [kategoriSeni, setKategoriSeni] = useState(
    data.kategoriKarya[0]?.nama_kategori || 'Seni Lukis'
  );
  const [teknik, setTeknik] = useState('');
  const [mediaBahan, setMediaBahan] = useState('');
  const [deskripsi, setDeskripsi] = useState('');
  const [statusPublikasi, setStatusPublikasi] = useState('Dipublikasikan');

  // Detail & Edit & Delete
  const [detailKarya, setDetailKarya] = useState<KaryaSiswaRecord | null>(null);
  const [editingKarya, setEditingKarya] = useState<KaryaSiswaRecord | null>(null);
  const [confirmEditOpen, setConfirmEditOpen] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<KaryaSiswaRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const isAdmin = data.role === 'ADMIN';
  const canUpload = data.role === 'ADMIN' || data.role === 'SISWA';
  const maxUploadMb = Number(
    data.pengaturan.find((p) => p.kunci === 'max_upload_mb')?.nilai || '15'
  );

  const filteredKarya = useMemo(() => {
    return data.karya.filter((item) => {
      const q = search.trim().toLowerCase();
      const matchSearch =
        !q ||
        item.judul_karya.toLowerCase().includes(q) ||
        item.nama_siswa.toLowerCase().includes(q) ||
        item.kategori_seni.toLowerCase().includes(q) ||
        item.teknik_berkarya.toLowerCase().includes(q);
      const matchKelas = filterKelas === 'Semua' || item.kelas === filterKelas;
      const matchKategori = filterKategori === 'Semua' || item.kategori_seni === filterKategori;
      const matchStatus = filterStatus === 'Semua' || item.status_publikasi === filterStatus;
      return matchSearch && matchKelas && matchKategori && matchStatus;
    });
  }, [data.karya, search, filterKelas, filterKategori, filterStatus]);

  const resolveKaryaFolderId = (kelasName: string) => {
    if (kelasName.startsWith('IX')) return data.folders.karyaIxId || data.rootFolderId;
    if (kelasName.startsWith('VIII')) return data.folders.karyaViiiId || data.rootFolderId;
    return data.folders.karyaViiId || data.rootFolderId;
  };

  const handleSelectFile = (candidate: File | null) => {
    if (!candidate) {
      setFile(null);
      return;
    }
    const ext = (candidate.name.split('.').pop() || '').toLowerCase();
    if (!ALLOWED_IMAGE_EXTENSIONS.includes(ext as (typeof ALLOWED_IMAGE_EXTENSIONS)[number])) {
      onToast('error', 'Foto karya harus berformat JPG, JPEG, atau PNG.');
      return;
    }
    if (candidate.size > maxUploadMb * 1024 * 1024) {
      onToast('error', `Ukuran gambar maksimal ${maxUploadMb} MB.`);
      return;
    }
    setFile(candidate);
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      onToast('error', 'Pilih foto karya terlebih dahulu.');
      return;
    }
    if (isUploading) return;

    setIsUploading(true);
    setProgress(5);
    try {
      await uploadFileWithProgress({
        file,
        spreadsheetId: data.spreadsheetId,
        targetSheet: 'KARYA_SISWA',
        folderId: resolveKaryaFolderId(kelas),
        record: {
          judul_karya: judulKarya.trim(),
          nama_siswa: namaSiswa.trim(),
          nis_siswa: nisSiswa.trim(),
          kelas,
          tahun_ajaran: tahunAjaran,
          semester,
          kategori_seni: kategoriSeni,
          deskripsi_karya: deskripsi.trim(),
          teknik_berkarya: teknik.trim(),
          media_bahan: mediaBahan.trim(),
          status_publikasi: isAdmin ? statusPublikasi : 'Dipublikasikan',
        },
        onProgress: setProgress,
      });

      onToast('success', `Karya "${judulKarya.trim()}" berhasil diunggah ke galeri.`);
      setUploadOpen(false);
      setFile(null);
      setJudulKarya('');
      setTeknik('');
      setMediaBahan('');
      setDeskripsi('');
      await onRefresh();
    } catch (err) {
      onToast('error', err instanceof Error ? err.message : 'Gagal mengunggah karya.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleAppreciate = async (karya: KaryaSiswaRecord) => {
    try {
      const nextCount = String((Number(karya.apresiasi_count || '0') || 0) + 1);
      await updateSheetRow('KARYA_SISWA', data.spreadsheetId, karya.id, {
        apresiasi_count: nextCount,
      });
      if (detailKarya?.id === karya.id) {
        setDetailKarya({ ...detailKarya, apresiasi_count: nextCount });
      }
      onToast('success', `Apresiasi diberikan untuk "${karya.judul_karya}".`);
      await onRefresh();
    } catch (err) {
      onToast('error', err instanceof Error ? err.message : 'Gagal memberikan apresiasi.');
    }
  };

  const handleToggleFeatured = async (karya: KaryaSiswaRecord) => {
    const nextStatus =
      karya.status_publikasi === 'Karya Pilihan' ? 'Dipublikasikan' : 'Karya Pilihan';
    try {
      await updateSheetRow('KARYA_SISWA', data.spreadsheetId, karya.id, {
        status_publikasi: nextStatus,
      });
      if (detailKarya?.id === karya.id) {
        setDetailKarya({ ...detailKarya, status_publikasi: nextStatus });
      }
      onToast('success', `Status karya diubah menjadi ${nextStatus}.`);
      await onRefresh();
    } catch (err) {
      onToast('error', err instanceof Error ? err.message : 'Gagal mengubah status publikasi.');
    }
  };

  const handleConfirmEdit = async () => {
    if (!editingKarya) return;
    setIsSavingEdit(true);
    try {
      await updateSheetRow('KARYA_SISWA', data.spreadsheetId, editingKarya.id, {
        judul_karya: editingKarya.judul_karya,
        nama_siswa: editingKarya.nama_siswa,
        kelas: editingKarya.kelas,
        kategori_seni: editingKarya.kategori_seni,
        teknik_berkarya: editingKarya.teknik_berkarya,
        media_bahan: editingKarya.media_bahan,
        deskripsi_karya: editingKarya.deskripsi_karya,
        status_publikasi: editingKarya.status_publikasi,
      });
      onToast('success', 'Data karya siswa berhasil diperbarui.');
      setConfirmEditOpen(false);
      setEditingKarya(null);
      setDetailKarya(null);
      await onRefresh();
    } catch (err) {
      onToast('error', err instanceof Error ? err.message : 'Gagal memperbarui data karya.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteArchivePermanent('KARYA_SISWA', data.spreadsheetId, deleteTarget.id);
      onToast('success', `Karya "${deleteTarget.judul_karya}" berhasil dihapus permanen.`);
      setDeleteTarget(null);
      setDetailKarya(null);
      await onRefresh();
    } catch (err) {
      onToast('error', err instanceof Error ? err.message : 'Gagal menghapus karya.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Galeri Karya Seni Peserta Didik</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {filteredKarya.length} karya ditampilkan · Diarsipkan berdasarkan jenjang kelas di Google Drive
          </p>
        </div>

        {canUpload && (
          <button
            type="button"
            onClick={() => setUploadOpen(true)}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="h-4 w-4" />
            Unggah Karya Siswa
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="relative lg:col-span-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari judul karya, nama siswa, teknik..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2 pl-9 pr-3 text-sm focus:border-teal-600 focus:bg-white focus:outline-none"
            />
          </div>
          <select
            value={filterKategori}
            onChange={(e) => setFilterKategori(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-teal-600 focus:outline-none"
          >
            <option value="Semua">Semua Kategori Seni</option>
            {data.kategoriKarya.map((k) => (
              <option key={k.id} value={k.nama_kategori}>
                {k.nama_kategori}
              </option>
            ))}
          </select>
          <select
            value={filterKelas}
            onChange={(e) => setFilterKelas(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-teal-600 focus:outline-none"
          >
            <option value="Semua">Semua Kelas</option>
            {data.kelas.map((k) => (
              <option key={k.id} value={k.nama_kelas}>
                Kelas {k.nama_kelas}
              </option>
            ))}
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-teal-600 focus:outline-none"
          >
            <option value="Semua">Semua Status</option>
            <option value="Karya Pilihan">Karya Pilihan</option>
            <option value="Dipublikasikan">Dipublikasikan</option>
            {isAdmin && <option value="Draft">Draft / Belum Publik</option>}
          </select>
        </div>
      </div>

      {/* Gallery Grid */}
      {filteredKarya.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 py-14 text-center">
          <img
            src="/src/assets/images/seni_ruang_studio_empty_1794962758515.jpg"
            alt="Meja studio seni budaya"
            referrerPolicy="no-referrer"
            className="h-44 w-60 rounded-xl object-cover border border-slate-200"
          />
          <h3 className="mt-5 text-base font-semibold text-slate-900">
            Galeri Karya Masih Kosong
          </h3>
          <p className="mt-1 max-w-md text-sm text-slate-500">
            Unggah foto karya siswa untuk mulai membangun pameran digital dan portofolio kreativitas kelas.
          </p>
          {canUpload && (
            <button
              type="button"
              onClick={() => setUploadOpen(true)}
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700"
            >
              <UploadCloud className="h-4 w-4" />
              Unggah Karya Pertama
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filteredKarya.map((karya) => (
            <article
              key={karya.id}
              className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white transition-colors hover:border-teal-400"
            >
              <button
                type="button"
                onClick={() => setDetailKarya(karya)}
                className="relative aspect-[4/3] w-full overflow-hidden bg-slate-100 text-left"
              >
                <DriveImage
                  fileId={karya.drive_file_id}
                  fallbackUrl={karya.drive_url}
                  alt={karya.judul_karya}
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                />
              </button>

              <div className="flex flex-1 flex-col justify-between p-5">
                <div>
                  <p className="text-xs font-medium text-teal-700">
                    <span>{karya.kategori_seni}</span>
                    <span className="mx-1.5 text-slate-300">·</span>
                    <span>Kelas {karya.kelas}</span>
                    {karya.status_publikasi === 'Karya Pilihan' && (
                      <>
                        <span className="mx-1.5 text-slate-300">·</span>
                        <span className="text-amber-700 font-semibold">Karya Pilihan</span>
                      </>
                    )}
                  </p>
                  <button
                    type="button"
                    onClick={() => setDetailKarya(karya)}
                    className="mt-1.5 text-left text-base font-semibold text-slate-900 hover:text-teal-700 line-clamp-1"
                  >
                    {karya.judul_karya}
                  </button>
                  <p className="mt-0.5 text-sm text-slate-600">{karya.nama_siswa}</p>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                  <button
                    type="button"
                    onClick={() => handleAppreciate(karya)}
                    disabled={data.role === 'PENGUNJUNG'}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-rose-600 disabled:opacity-50 transition-colors tabular-nums"
                    title="Beri Apresiasi"
                  >
                    <Heart className="h-4 w-4" />
                    {karya.apresiasi_count || '0'}
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setDetailKarya(karya)}
                      className="rounded-lg p-1.5 text-slate-500 hover:bg-teal-50 hover:text-teal-700"
                      title="Detail Karya"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        downloadDriveFile(karya.drive_file_id, karya.nama_file).catch((e) =>
                          onToast('error', e.message)
                        )
                      }
                      className="rounded-lg p-1.5 text-slate-500 hover:bg-teal-50 hover:text-teal-700"
                      title="Unduh Gambar"
                    >
                      <Download className="h-4 w-4" />
                    </button>
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => handleToggleFeatured(karya)}
                        className={`rounded-lg p-1.5 transition-colors ${
                          karya.status_publikasi === 'Karya Pilihan'
                            ? 'text-amber-600 bg-amber-50'
                            : 'text-slate-400 hover:bg-amber-50 hover:text-amber-600'
                        }`}
                        title="Tandai Karya Pilihan"
                      >
                        <Award className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Upload Artwork Modal */}
      <ModalShell
        open={uploadOpen}
        onClose={() => !isUploading && setUploadOpen(false)}
        title="Unggah Karya Seni Siswa"
        subtitle="Foto karya disimpan otomatis ke folder kelas di Google Drive"
      >
        <form onSubmit={handleUploadSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700">Foto Karya (JPG / PNG)</label>
            <input
              type="file"
              accept=".jpg,.jpeg,.png"
              onChange={(e) => handleSelectFile(e.target.files?.[0] || null)}
              className="mt-1.5 block w-full rounded-xl border border-dashed border-teal-300 bg-teal-50/30 p-3 text-sm text-slate-700 file:mr-4 file:rounded-lg file:border-0 file:bg-teal-600 file:px-3.5 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:file:bg-teal-700"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700">Judul Karya</label>
              <input
                type="text"
                required
                value={judulKarya}
                onChange={(e) => setJudulKarya(e.target.value)}
                placeholder="Contoh: Harmoni Ragam Hias Nusantara"
                className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm focus:border-teal-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">Kategori Seni</label>
              <select
                value={kategoriSeni}
                onChange={(e) => setKategoriSeni(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm focus:border-teal-600 focus:outline-none"
              >
                {data.kategoriKarya.map((k) => (
                  <option key={k.id} value={k.nama_kategori}>
                    {k.nama_kategori}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700">Nama Siswa</label>
              <input
                type="text"
                required
                value={namaSiswa}
                onChange={(e) => setNamaSiswa(e.target.value)}
                placeholder="Nama lengkap siswa"
                className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm focus:border-teal-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">NIS (Opsional)</label>
              <input
                type="text"
                value={nisSiswa}
                onChange={(e) => setNisSiswa(e.target.value)}
                placeholder="Nomor induk"
                className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm focus:border-teal-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">Kelas</label>
              <select
                value={kelas}
                onChange={(e) => setKelas(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm focus:border-teal-600 focus:outline-none"
              >
                {data.kelas.map((k) => (
                  <option key={k.id} value={k.nama_kelas}>
                    {k.nama_kelas}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700">Teknik Berkarya</label>
              <input
                type="text"
                required
                value={teknik}
                onChange={(e) => setTeknik(e.target.value)}
                placeholder="Contoh: Arsir, Plakat, Cukil, Digital Vektor"
                className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm focus:border-teal-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">Media & Bahan</label>
              <input
                type="text"
                required
                value={mediaBahan}
                onChange={(e) => setMediaBahan(e.target.value)}
                placeholder="Contoh: Kertas A3, Cat Akrilik, Kuas"
                className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm focus:border-teal-600 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700">Tahun Ajaran</label>
              <input
                type="text"
                value={tahunAjaran}
                onChange={(e) => setTahunAjaran(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm focus:border-teal-600 focus:outline-none"
              />
            </div>
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
            {isAdmin && (
              <div>
                <label className="block text-xs font-semibold text-slate-700">Status Publikasi</label>
                <select
                  value={statusPublikasi}
                  onChange={(e) => setStatusPublikasi(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm focus:border-teal-600 focus:outline-none"
                >
                  <option value="Dipublikasikan">Dipublikasikan</option>
                  <option value="Karya Pilihan">Karya Pilihan</option>
                  <option value="Draft">Draft</option>
                </select>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700">Deskripsi Karya</label>
            <textarea
              rows={3}
              value={deskripsi}
              onChange={(e) => setDeskripsi(e.target.value)}
              placeholder="Ceritakan konsep, makna, atau inspirasi di balik karya..."
              className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm focus:border-teal-600 focus:outline-none"
            />
          </div>

          {isUploading && (
            <div className="space-y-1.5 rounded-xl bg-teal-50 p-3">
              <div className="flex items-center justify-between text-xs font-semibold text-teal-900">
                <span>Mengunggah foto karya ke Google Drive...</span>
                <span className="font-mono tabular-nums">{progress}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-teal-200">
                <div
                  className="h-full bg-teal-600 transition-all duration-200"
                  style={{ width: `${progress}%` }}
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
              {isUploading ? 'Mengunggah...' : 'Publikasikan Karya'}
            </button>
          </div>
        </form>
      </ModalShell>

      {/* Lightbox Detail Modal */}
      <ModalShell
        open={Boolean(detailKarya)}
        onClose={() => setDetailKarya(null)}
        title={detailKarya?.judul_karya || ''}
        subtitle={
          detailKarya
            ? `${detailKarya.nama_siswa} · Kelas ${detailKarya.kelas} · ${detailKarya.kategori_seni}`
            : ''
        }
        maxWidth="max-w-4xl"
      >
        {detailKarya && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50 lg:col-span-7">
              <DriveImage
                fileId={detailKarya.drive_file_id}
                fallbackUrl={detailKarya.drive_url}
                alt={detailKarya.judul_karya}
                className="max-h-[60vh] w-full object-contain"
              />
            </div>

            <div className="flex flex-col justify-between space-y-5 lg:col-span-5">
              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-2 text-xs font-semibold text-teal-700">
                  <Palette className="h-4 w-4" />
                  <span>{detailKarya.status_publikasi}</span>
                </div>
                <p className="leading-relaxed text-slate-700">
                  {detailKarya.deskripsi_karya || 'Tidak ada deskripsi tambahan.'}
                </p>

                <dl className="grid grid-cols-2 gap-3 border-t border-slate-100 pt-3 text-xs">
                  <div>
                    <dt className="text-slate-500">Teknik Berkarya</dt>
                    <dd className="mt-0.5 font-semibold text-slate-900">
                      {detailKarya.teknik_berkarya || '-'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Media & Bahan</dt>
                    <dd className="mt-0.5 font-semibold text-slate-900">
                      {detailKarya.media_bahan || '-'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Tahun Ajaran</dt>
                    <dd className="mt-0.5 font-semibold text-slate-900 tabular-nums">
                      {detailKarya.tahun_ajaran} ({detailKarya.semester})
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Tanggal Pengumpulan</dt>
                    <dd className="mt-0.5 font-mono font-semibold text-slate-900 tabular-nums">
                      {detailKarya.tanggal_pengumpulan || '-'}
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => handleAppreciate(detailKarya)}
                  disabled={data.role === 'PENGUNJUNG'}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50 tabular-nums"
                >
                  <Heart className="h-3.5 w-3.5" />
                  Apresiasi ({detailKarya.apresiasi_count || '0'})
                </button>
                <button
                  type="button"
                  onClick={() =>
                    downloadDriveFile(detailKarya.drive_file_id, detailKarya.nama_file).catch((e) =>
                      onToast('error', e.message)
                    )
                  }
                  className="inline-flex items-center gap-1.5 rounded-xl bg-teal-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-teal-700"
                >
                  <Download className="h-3.5 w-3.5" />
                  Unduh
                </button>
                {(isAdmin ||
                  (data.role === 'SISWA' &&
                    detailKarya.pengunggah.toLowerCase() === data.userEmail.toLowerCase())) && (
                  <button
                    type="button"
                    onClick={() => setEditingKarya(detailKarya)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                    Edit
                  </button>
                )}
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(detailKarya)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-white px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Hapus
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </ModalShell>

      {/* Edit Karya Modal */}
      <ModalShell
        open={Boolean(editingKarya)}
        onClose={() => setEditingKarya(null)}
        title="Edit Informasi Karya Siswa"
      >
        {editingKarya && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setConfirmEditOpen(true);
            }}
            className="space-y-4"
          >
            <div>
              <label className="block text-xs font-semibold text-slate-700">Judul Karya</label>
              <input
                type="text"
                required
                value={editingKarya.judul_karya}
                onChange={(e) => setEditingKarya({ ...editingKarya, judul_karya: e.target.value })}
                className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm focus:border-teal-600 focus:outline-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700">Nama Siswa</label>
                <input
                  type="text"
                  required
                  value={editingKarya.nama_siswa}
                  onChange={(e) => setEditingKarya({ ...editingKarya, nama_siswa: e.target.value })}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm focus:border-teal-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">Kategori Seni</label>
                <select
                  value={editingKarya.kategori_seni}
                  onChange={(e) =>
                    setEditingKarya({ ...editingKarya, kategori_seni: e.target.value })
                  }
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm focus:border-teal-600 focus:outline-none"
                >
                  {data.kategoriKarya.map((k) => (
                    <option key={k.id} value={k.nama_kategori}>
                      {k.nama_kategori}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700">Teknik Berkarya</label>
                <input
                  type="text"
                  value={editingKarya.teknik_berkarya}
                  onChange={(e) =>
                    setEditingKarya({ ...editingKarya, teknik_berkarya: e.target.value })
                  }
                  className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm focus:border-teal-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">Media & Bahan</label>
                <input
                  type="text"
                  value={editingKarya.media_bahan}
                  onChange={(e) => setEditingKarya({ ...editingKarya, media_bahan: e.target.value })}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm focus:border-teal-600 focus:outline-none"
                />
              </div>
            </div>
            {isAdmin && (
              <div>
                <label className="block text-xs font-semibold text-slate-700">Status Publikasi</label>
                <select
                  value={editingKarya.status_publikasi}
                  onChange={(e) =>
                    setEditingKarya({ ...editingKarya, status_publikasi: e.target.value })
                  }
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm focus:border-teal-600 focus:outline-none"
                >
                  <option value="Dipublikasikan">Dipublikasikan</option>
                  <option value="Karya Pilihan">Karya Pilihan</option>
                  <option value="Draft">Draft</option>
                </select>
              </div>
            )}
            <div>
              <label className="block text-xs font-semibold text-slate-700">Deskripsi</label>
              <textarea
                rows={3}
                value={editingKarya.deskripsi_karya}
                onChange={(e) =>
                  setEditingKarya({ ...editingKarya, deskripsi_karya: e.target.value })
                }
                className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm focus:border-teal-600 focus:outline-none"
              />
            </div>
            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setEditingKarya(null)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700"
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
        title="Simpan Perubahan Karya?"
        description={`Perbarui informasi karya "${editingKarya?.judul_karya}" di Google Sheets?`}
        confirmLabel="Ya, Simpan"
        loading={isSavingEdit}
        onConfirm={handleConfirmEdit}
        onCancel={() => setConfirmEditOpen(false)}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        variant="danger"
        title="Hapus Karya Secara Permanen?"
        description={`Karya "${deleteTarget?.judul_karya}" oleh ${deleteTarget?.nama_siswa} akan dihapus permanen dari Google Drive dan Google Sheets.`}
        confirmLabel="Hapus Permanen"
        loading={isDeleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
