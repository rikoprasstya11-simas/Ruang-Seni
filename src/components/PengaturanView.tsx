import { useState } from 'react';
import {
  Check,
  Copy,
  Database,
  ExternalLink,
  HardDrive,
  Plus,
  Save,
  Shield,
  Trash2,
  Upload,
} from 'lucide-react';
import {
  appendSheetRow,
  deleteArchivePermanent,
  saveSettingsBatch,
  updateSheetRow,
  uploadFileWithProgress,
} from '../services/apiClient';
import type {
  AdminGroup,
  UserRole,
  WorkspaceBootstrapData,
} from '../types/seniRuang';
import { generateGoogleAppsScriptCode } from '../utils/gasTemplate';
import { ConfirmDialog } from './CommonUI';
import { DriveImage } from './DriveImage';

export function PengaturanView({
  data,
  onRefresh,
  onToast,
}: {
  data: WorkspaceBootstrapData;
  onRefresh: () => Promise<void>;
  onToast: (type: 'success' | 'error' | 'info', text: string) => void;
}) {
  const [tab, setTab] = useState<'identitas' | 'kategori' | 'akses' | 'integrasi'>('identitas');

  // Website Identity form
  const [namaWebsite, setNamaWebsite] = useState(data.identitas.nama_website || 'SENI RUANG');
  const [tagline, setTagline] = useState(data.identitas.tagline || '');
  const [namaGuru, setNamaGuru] = useState(data.identitas.nama_guru || '');
  const [nipGuru, setNipGuru] = useState(data.identitas.nip_guru || '');
  const [emailGuru, setEmailGuru] = useState(data.identitas.email_guru || '');
  const [namaSekolah, setNamaSekolah] = useState(data.identitas.nama_sekolah || '');
  const [tahunAjaran, setTahunAjaran] = useState(data.identitas.tahun_ajaran_aktif || '2026/2027');
  const [semesterAktif, setSemesterAktif] = useState(data.identitas.semester_aktif || 'Ganjil');

  const settingVal = (kunci: string, fallback = '') =>
    data.pengaturan.find((p) => p.kunci === kunci)?.nilai || fallback;

  const [galeriPublik, setGaleriPublik] = useState(settingVal('galeri_publik_aktif', 'Ya'));
  const [maxUploadMb, setMaxUploadMb] = useState(settingVal('max_upload_mb', '15'));
  const [gasUrl, setGasUrl] = useState(settingVal('gas_webapp_url', ''));

  const [confirmSaveIdentitas, setConfirmSaveIdentitas] = useState(false);
  const [savingIdentitas, setSavingIdentitas] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  // Category Management
  const [newDokGroup, setNewDokGroup] = useState<AdminGroup>('Perencanaan Pembelajaran');
  const [newDokName, setNewDokName] = useState('');
  const [newKaryaName, setNewKaryaName] = useState('');
  const [deleteCatTarget, setDeleteCatTarget] = useState<{
    sheet: 'KATEGORI_DOKUMEN' | 'KATEGORI_KARYA';
    id: string;
    name: string;
  } | null>(null);
  const [deletingCat, setDeletingCat] = useState(false);

  // User RBAC management
  const [userEmailInput, setUserEmailInput] = useState('');
  const [userNameInput, setUserNameInput] = useState('');
  const [userRoleInput, setUserRoleInput] = useState<UserRole>('SISWA');
  const [userKelasInput, setUserKelasInput] = useState('Semua Kelas');
  const [savingUser, setSavingUser] = useState(false);
  const [deleteUserTarget, setDeleteUserTarget] = useState<{ id: string; email: string } | null>(null);

  const [copiedGas, setCopiedGas] = useState(false);
  const gasCode = generateGoogleAppsScriptCode(data.spreadsheetId, data.rootFolderId);

  const handleUploadLogo = async (file: File | null) => {
    if (!file) return;
    setUploadingLogo(true);
    try {
      await uploadFileWithProgress({
        file,
        spreadsheetId: data.spreadsheetId,
        targetSheet: 'IDENTITAS_LOGO',
        folderId: data.rootFolderId,
        record: {},
      });
      onToast('success', 'Logo website berhasil diunggah ke Google Drive.');
      await onRefresh();
    } catch (err) {
      onToast('error', err instanceof Error ? err.message : 'Gagal mengunggah logo.');
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleSaveIdentitasAndSettings = async () => {
    setSavingIdentitas(true);
    try {
      await updateSheetRow('IDENTITAS_WEBSITE', data.spreadsheetId, data.identitas.id || 'ID-WEB-01', {
        nama_website: namaWebsite.trim(),
        tagline: tagline.trim(),
        nama_guru: namaGuru.trim(),
        nip_guru: nipGuru.trim(),
        email_guru: emailGuru.trim(),
        nama_sekolah: namaSekolah.trim(),
        tahun_ajaran_aktif: tahunAjaran.trim(),
        semester_aktif: semesterAktif,
      });

      await saveSettingsBatch(data.spreadsheetId, [
        { kunci: 'galeri_publik_aktif', nilai: galeriPublik, deskripsi: 'Akses galeri publik' },
        { kunci: 'max_upload_mb', nilai: maxUploadMb, deskripsi: 'Batas ukuran upload file (MB)' },
        { kunci: 'gas_webapp_url', nilai: gasUrl.trim(), deskripsi: 'URL Web App Google Apps Script' },
      ]);

      onToast('success', 'Pengaturan website dan konfigurasi berhasil disimpan ke Google Sheets.');
      setConfirmSaveIdentitas(false);
      await onRefresh();
    } catch (err) {
      onToast('error', err instanceof Error ? err.message : 'Gagal menyimpan pengaturan.');
    } finally {
      setSavingIdentitas(false);
    }
  };

  const handleAddDokCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDokName.trim()) return;
    try {
      await appendSheetRow('KATEGORI_DOKUMEN', data.spreadsheetId, {
        kelompok: newDokGroup,
        nama_kategori: newDokName.trim(),
        deskripsi: `Kategori ${newDokName.trim()}`,
        aktif: 'Ya',
      });
      setNewDokName('');
      onToast('success', 'Kategori dokumen baru ditambahkan.');
      await onRefresh();
    } catch (err) {
      onToast('error', err instanceof Error ? err.message : 'Gagal menambah kategori.');
    }
  };

  const handleAddKaryaCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKaryaName.trim()) return;
    try {
      await appendSheetRow('KATEGORI_KARYA', data.spreadsheetId, {
        nama_kategori: newKaryaName.trim(),
        deskripsi: `Kategori karya ${newKaryaName.trim()}`,
        aktif: 'Ya',
      });
      setNewKaryaName('');
      onToast('success', 'Kategori karya baru ditambahkan.');
      await onRefresh();
    } catch (err) {
      onToast('error', err instanceof Error ? err.message : 'Gagal menambah kategori karya.');
    }
  };

  const handleDeleteCategory = async () => {
    if (!deleteCatTarget) return;
    setDeletingCat(true);
    try {
      await deleteArchivePermanent(deleteCatTarget.sheet, data.spreadsheetId, deleteCatTarget.id);
      onToast('success', `Kategori "${deleteCatTarget.name}" dihapus.`);
      setDeleteCatTarget(null);
      await onRefresh();
    } catch (err) {
      onToast('error', err instanceof Error ? err.message : 'Gagal menghapus kategori.');
    } finally {
      setDeletingCat(false);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userEmailInput.trim()) return;
    setSavingUser(true);
    try {
      await appendSheetRow('USERS', data.spreadsheetId, {
        email: userEmailInput.trim().toLowerCase(),
        nama: userNameInput.trim() || userEmailInput.split('@')[0],
        role: userRoleInput,
        kelas: userKelasInput,
        status: 'Aktif',
      });
      setUserEmailInput('');
      setUserNameInput('');
      onToast('success', 'Pengguna baru ditambahkan ke hak akses Google Sheets.');
      await onRefresh();
    } catch (err) {
      onToast('error', err instanceof Error ? err.message : 'Gagal menambahkan pengguna.');
    } finally {
      setSavingUser(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteUserTarget) return;
    try {
      await deleteArchivePermanent('USERS', data.spreadsheetId, deleteUserTarget.id);
      onToast('success', `Akses untuk ${deleteUserTarget.email} dihapus.`);
      setDeleteUserTarget(null);
      await onRefresh();
    } catch (err) {
      onToast('error', err instanceof Error ? err.message : 'Gagal menghapus pengguna.');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-slate-900">Pengaturan Website & Integrasi</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Kelola identitas sekolah, kategori arsip, hak akses peran, serta koneksi Google Drive dan Google Sheets
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5 rounded-xl bg-slate-100 p-1 w-fit">
        {[
          { id: 'identitas', label: 'Identitas & Akademik' },
          { id: 'kategori', label: 'Kategori Dokumen & Karya' },
          { id: 'akses', label: 'Hak Akses Pengguna' },
          { id: 'integrasi', label: 'Google Drive, Sheets & GAS' },
        ].map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id as typeof tab)}
            className={`rounded-lg px-4 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
              tab === item.id ? 'bg-white text-teal-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'identitas' && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setConfirmSaveIdentitas(true);
          }}
          className="rounded-2xl border border-slate-200/90 bg-white p-6 space-y-6"
        >
          <div className="flex flex-col gap-4 border-b border-slate-100 pb-6 sm:flex-row sm:items-center">
            <div className="h-16 w-16 overflow-hidden rounded-2xl border border-slate-200 bg-teal-50/40 shrink-0">
              {data.identitas.logo_file_id ? (
                <DriveImage
                  fileId={data.identitas.logo_file_id}
                  fallbackUrl={data.identitas.logo_url}
                  alt="Logo Sekolah"
                  className="h-full w-full object-contain p-1"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xs font-bold text-teal-700">
                  LOGO
                </div>
              )}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Logo Website / Sekolah</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Unggah gambar PNG atau JPG untuk disimpan langsung ke Google Drive.
              </p>
              <label className="mt-2 inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                <Upload className="h-3.5 w-3.5 text-teal-600" />
                {uploadingLogo ? 'Mengunggah...' : 'Ganti Logo'}
                <input
                  type="file"
                  accept=".png,.jpg,.jpeg"
                  className="hidden"
                  onChange={(e) => handleUploadLogo(e.target.files?.[0] || null)}
                />
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700">Nama Website</label>
              <input
                type="text"
                required
                value={namaWebsite}
                onChange={(e) => setNamaWebsite(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm focus:border-teal-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">Tagline</label>
              <input
                type="text"
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm focus:border-teal-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">Nama Guru Pengampu</label>
              <input
                type="text"
                required
                value={namaGuru}
                onChange={(e) => setNamaGuru(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm focus:border-teal-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">NIP / NUPTK Guru</label>
              <input
                type="text"
                value={nipGuru}
                onChange={(e) => setNipGuru(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm focus:border-teal-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">Email Guru (Admin)</label>
              <input
                type="email"
                required
                value={emailGuru}
                onChange={(e) => setEmailGuru(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm focus:border-teal-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">Nama Sekolah</label>
              <input
                type="text"
                required
                value={namaSekolah}
                onChange={(e) => setNamaSekolah(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm focus:border-teal-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">Tahun Ajaran Aktif</label>
              <input
                type="text"
                required
                value={tahunAjaran}
                onChange={(e) => setTahunAjaran(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm focus:border-teal-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">Semester Aktif</label>
              <select
                value={semesterAktif}
                onChange={(e) => setSemesterAktif(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm focus:border-teal-600 focus:outline-none"
              >
                <option value="Ganjil">Ganjil</option>
                <option value="Genap">Genap</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">Akses Galeri Publik</label>
              <select
                value={galeriPublik}
                onChange={(e) => setGaleriPublik(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm focus:border-teal-600 focus:outline-none"
              >
                <option value="Ya">Aktif (Terbuka untuk Pengunjung)</option>
                <option value="Tidak">Terbatas (Hanya Guru & Siswa)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">Batas Ukuran Upload (MB)</label>
              <input
                type="number"
                min={1}
                max={45}
                value={maxUploadMb}
                onChange={(e) => setMaxUploadMb(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm focus:border-teal-600 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-700"
            >
              <Save className="h-4 w-4" />
              Simpan Pengaturan Website
            </button>
          </div>
        </form>
      )}

      {tab === 'kategori' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200/90 bg-white p-6 space-y-4">
            <h3 className="text-base font-semibold text-slate-900">Kategori Dokumen Administrasi</h3>
            <form onSubmit={handleAddDokCategory} className="flex flex-col gap-2 sm:flex-row">
              <select
                value={newDokGroup}
                onChange={(e) => setNewDokGroup(e.target.value as AdminGroup)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium"
              >
                <option value="Perencanaan Pembelajaran">Perencanaan</option>
                <option value="Administrasi Penilaian">Penilaian</option>
                <option value="Administrasi Guru">Administrasi Guru</option>
                <option value="Dokumentasi Kegiatan">Dokumentasi</option>
              </select>
              <input
                type="text"
                value={newDokName}
                onChange={(e) => setNewDokName(e.target.value)}
                placeholder="Nama sub-kategori baru..."
                className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
              />
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-1 rounded-xl bg-teal-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-teal-700"
              >
                <Plus className="h-4 w-4" />
                Tambah
              </button>
            </form>
            <div className="max-h-96 divide-y divide-slate-100 overflow-y-auto">
              {data.kategoriDokumen.map((k) => (
                <div key={k.id} className="flex items-center justify-between py-2.5 text-sm">
                  <div>
                    <p className="font-medium text-slate-900">{k.nama_kategori}</p>
                    <p className="text-xs text-slate-500">{k.kelompok}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setDeleteCatTarget({
                        sheet: 'KATEGORI_DOKUMEN',
                        id: k.id,
                        name: k.nama_kategori,
                      })
                    }
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200/90 bg-white p-6 space-y-4">
            <h3 className="text-base font-semibold text-slate-900">Kategori Karya Seni Siswa</h3>
            <form onSubmit={handleAddKaryaCategory} className="flex gap-2">
              <input
                type="text"
                value={newKaryaName}
                onChange={(e) => setNewKaryaName(e.target.value)}
                placeholder="Nama kategori karya baru..."
                className="flex-1 rounded-xl border border-slate-200 px-3.5 py-2 text-sm focus:border-teal-600 focus:outline-none"
              />
              <button
                type="submit"
                className="inline-flex items-center gap-1 rounded-xl bg-teal-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-teal-700"
              >
                <Plus className="h-4 w-4" />
                Tambah
              </button>
            </form>
            <div className="max-h-96 divide-y divide-slate-100 overflow-y-auto">
              {data.kategoriKarya.map((k) => (
                <div key={k.id} className="flex items-center justify-between py-2.5 text-sm">
                  <div>
                    <p className="font-medium text-slate-900">{k.nama_kategori}</p>
                    <p className="text-xs text-slate-500">{k.deskripsi}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setDeleteCatTarget({
                        sheet: 'KATEGORI_KARYA',
                        id: k.id,
                        name: k.nama_kategori,
                      })
                    }
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'akses' && (
        <div className="rounded-2xl border border-slate-200/90 bg-white p-6 space-y-5">
          <div className="flex items-start gap-3">
            <Shield className="mt-0.5 h-5 w-5 text-teal-600 shrink-0" />
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                Hak Akses Pengguna Tervalidasi Server (Sheet USERS)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Server memverifikasi peran email Google sebelum mengizinkan akses atau perubahan data.
              </p>
            </div>
          </div>

          <form onSubmit={handleAddUser} className="grid grid-cols-1 gap-3 sm:grid-cols-5">
            <input
              type="email"
              required
              value={userEmailInput}
              onChange={(e) => setUserEmailInput(e.target.value)}
              placeholder="Email Google pengguna"
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm sm:col-span-2"
            />
            <input
              type="text"
              value={userNameInput}
              onChange={(e) => setUserNameInput(e.target.value)}
              placeholder="Nama lengkap"
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
            <select
              value={userRoleInput}
              onChange={(e) => setUserRoleInput(e.target.value as UserRole)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              <option value="ADMIN">ADMIN (Guru)</option>
              <option value="SISWA">SISWA</option>
              <option value="PENGUNJUNG">PENGUNJUNG</option>
            </select>
            <button
              type="submit"
              disabled={savingUser}
              className="rounded-xl bg-teal-600 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-700 disabled:opacity-60"
            >
              {savingUser ? 'Menyimpan...' : 'Tambah Akses'}
            </button>
          </form>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-xs text-slate-500">
                <tr>
                  <th className="py-2.5">Nama</th>
                  <th className="py-2.5">Email Google</th>
                  <th className="py-2.5">Peran</th>
                  <th className="py-2.5">Kelas</th>
                  <th className="py-2.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.users.map((u) => (
                  <tr key={u.id}>
                    <td className="py-2.5 font-medium text-slate-900">{u.nama}</td>
                    <td className="py-2.5 font-mono text-xs text-slate-600">{u.email}</td>
                    <td className="py-2.5 font-semibold text-teal-800 text-xs">{u.role}</td>
                    <td className="py-2.5 text-xs text-slate-600">{u.kelas}</td>
                    <td className="py-2.5 text-right">
                      {u.email.toLowerCase() !== data.userEmail.toLowerCase() && (
                        <button
                          type="button"
                          onClick={() => setDeleteUserTarget({ id: u.id, email: u.email })}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'integrasi' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-200/90 bg-white p-5">
              <div className="flex items-center gap-2.5 text-sm font-semibold text-slate-900">
                <Database className="h-4.5 w-4.5 text-teal-600" />
                Google Sheets (Database Utama)
              </div>
              <p className="mt-2 font-mono text-xs text-slate-600 break-all">
                ID: {data.spreadsheetId}
              </p>
              <a
                href={data.spreadsheetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-teal-700 hover:underline"
              >
                Buka Spreadsheet di Tab Baru <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>

            <div className="rounded-2xl border border-slate-200/90 bg-white p-5">
              <div className="flex items-center gap-2.5 text-sm font-semibold text-slate-900">
                <HardDrive className="h-4.5 w-4.5 text-teal-600" />
                Google Drive (Penyimpanan Utama)
              </div>
              <p className="mt-2 font-mono text-xs text-slate-600 break-all">
                Root Folder ID: {data.rootFolderId || '-'}
              </p>
              {data.rootFolderUrl && (
                <a
                  href={data.rootFolderUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-teal-700 hover:underline"
                >
                  Buka Folder SENI RUANG di Drive <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200/90 bg-white p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-slate-900">
                  Integrasi Google Apps Script Web App
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Opsional: Deploy skrip berikut untuk membuka Galeri Publik bagi pengunjung tanpa login Google.
                </p>
              </div>
              <button
                type="button"
                onClick={async () => {
                  await navigator.clipboard.writeText(gasCode);
                  setCopiedGas(true);
                  setTimeout(() => setCopiedGas(false), 2500);
                }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-teal-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-teal-700"
              >
                {copiedGas ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copiedGas ? 'Skrip Tersalin' : 'Salin Code.gs'}
              </button>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                type="url"
                value={gasUrl}
                onChange={(e) => setGasUrl(e.target.value)}
                placeholder="https://script.google.com/macros/s/.../exec"
                className="flex-1 rounded-xl border border-slate-200 px-3.5 py-2 font-mono text-xs focus:border-teal-600 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setConfirmSaveIdentitas(true)}
                className="rounded-xl border border-teal-200 bg-teal-50 px-4 py-2 text-xs font-semibold text-teal-800 hover:bg-teal-100 whitespace-nowrap"
              >
                Simpan URL GAS
              </button>
            </div>

            <div className="rounded-xl border border-teal-100 bg-teal-50/40 p-4 space-y-2 text-xs text-slate-700">
              <p className="font-semibold text-teal-950">
                Panduan Publikasi di Vercel (Agar Siswa Bisa Mengunggah & Melihat Karya di Halaman Depan):
              </p>
              <ol className="list-decimal space-y-1 pl-4">
                <li>
                  Salin kode <code className="font-mono bg-white px-1 rounded">Code.gs</code> di bawah (ID Spreadsheet & Folder Anda sudah terisi otomatis), deploy sebagai Web App di <code className="font-mono">script.google.com</code> (Execute as: <strong>Me</strong>, Who has access: <strong>Anyone</strong>).
                </li>
                <li>
                  Di dashboard Vercel, tambahkan Environment Variable <code className="font-mono bg-white px-1 rounded">VITE_GAS_WEBAPP_URL</code> berisi URL Web App hasil deploy GAS tersebut.
                </li>
                <li>
                  Tambahkan domain Vercel Anda ke <strong>Firebase Console → Authentication → Settings → Authorized domains</strong> agar tombol <em>Masuk Guru</em> berfungsi di Vercel.
                </li>
              </ol>
              {gasUrl.trim() && (
                <p className="pt-1 text-teal-900">
                  Link langsung halaman siswa:{' '}
                  <code className="font-mono bg-white px-1.5 py-0.5 rounded break-all">
                    {`${window.location.origin}/?gas=${encodeURIComponent(gasUrl.trim())}`}
                  </code>
                </p>
              )}
            </div>

            <pre className="max-h-80 overflow-auto rounded-xl bg-slate-950 p-4 font-mono text-xs leading-relaxed text-teal-100">
              {gasCode}
            </pre>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmSaveIdentitas}
        variant="primary"
        title="Simpan Pengaturan Website?"
        description="Perubahan identitas website, tahun ajaran aktif, dan pengaturan integrasi akan disimpan ke Google Sheets."
        confirmLabel="Ya, Simpan"
        loading={savingIdentitas}
        onConfirm={handleSaveIdentitasAndSettings}
        onCancel={() => setConfirmSaveIdentitas(false)}
      />

      <ConfirmDialog
        open={Boolean(deleteCatTarget)}
        variant="danger"
        title="Hapus Kategori?"
        description={`Hapus kategori "${deleteCatTarget?.name}" dari Google Sheets?`}
        confirmLabel="Hapus"
        loading={deletingCat}
        onConfirm={handleDeleteCategory}
        onCancel={() => setDeleteCatTarget(null)}
      />

      <ConfirmDialog
        open={Boolean(deleteUserTarget)}
        variant="danger"
        title="Cabut Akses Pengguna?"
        description={`Hapus akun "${deleteUserTarget?.email}" dari daftar hak akses USERS di Google Sheets?`}
        confirmLabel="Hapus Akses"
        onConfirm={handleDeleteUser}
        onCancel={() => setDeleteUserTarget(null)}
      />
    </div>
  );
}
