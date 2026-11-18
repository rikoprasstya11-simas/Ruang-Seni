import { useState } from 'react';
import {
  Check,
  Copy,
  Database,
  ExternalLink,
  FolderTree,
  Globe,
  HardDrive,
  Loader2,
  LogOut,
  Palette,
  RefreshCw,
} from 'lucide-react';
import { generateGoogleAppsScriptCode } from '../utils/gasTemplate';
import { GoogleSignInButton, SeniRuangLogo } from './CommonUI';

interface WorkspaceSetupViewProps {
  mode: 'login' | 'provision';
  userEmail?: string;
  userName?: string;
  loading: boolean;
  error?: string;
  onGoogleLogin: () => void;
  onLogout: () => void;
  onProvision: (payload: {
    namaGuru: string;
    namaSekolah: string;
    tahunAjaran: string;
    semester: string;
  }) => Promise<void>;
  onConnectExisting: (payload: {
    spreadsheetId: string;
    rootFolderId?: string;
    gasWebAppUrl?: string;
  }) => Promise<void>;
  onOpenPublicGallery?: (gasUrl: string) => void;
}

export function WorkspaceSetupView({
  mode,
  userEmail,
  userName,
  loading,
  error,
  onGoogleLogin,
  onLogout,
  onProvision,
  onConnectExisting,
  onOpenPublicGallery,
}: WorkspaceSetupViewProps) {
  const [activeTab, setActiveTab] = useState<'auto' | 'manual' | 'gas'>('auto');
  const [namaGuru, setNamaGuru] = useState(userName || '');
  const [namaSekolah, setNamaSekolah] = useState('SMP Negeri 1');
  const [tahunAjaran, setTahunAjaran] = useState('2026/2027');
  const [semester, setSemester] = useState('Ganjil');

  const [spreadsheetId, setSpreadsheetId] = useState('');
  const [rootFolderId, setRootFolderId] = useState('');
  const [gasUrlInput, setGasUrlInput] = useState('');
  const [visitorGasUrl, setVisitorGasUrl] = useState('');
  const [copiedGas, setCopiedGas] = useState(false);

  const gasCode = generateGoogleAppsScriptCode(spreadsheetId, rootFolderId);

  const handleCopyGas = async () => {
    await navigator.clipboard.writeText(gasCode);
    setCopiedGas(true);
    setTimeout(() => setCopiedGas(false), 2500);
  };

  if (mode === 'login') {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <header className="border-b border-slate-200/80 px-6 py-4">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-8">
            <div className="flex items-center gap-3 whitespace-nowrap shrink-0">
              <SeniRuangLogo size={34} />
              <span className="text-lg font-bold tracking-tight text-slate-900">SENI RUANG</span>
            </div>
            <div className="flex items-center gap-4 shrink-0">
              <GoogleSignInButton onClick={onGoogleLogin} disabled={loading} />
            </div>
          </div>
        </header>

        <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-6 py-12">
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:items-stretch">
            <div className="flex flex-col justify-center lg:col-span-6">
              <p className="text-xs font-semibold tracking-wider text-teal-700 uppercase">
                Platform Pendidikan Seni Budaya SMP
              </p>
              <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl lg:text-[2.65rem] lg:leading-[1.15] [text-wrap:balance]">
                Pusat Administrasi Guru & Galeri Karya Seni Digital
              </h1>
              <p className="mt-4 text-base leading-relaxed text-slate-600 max-w-xl">
                Ruang Kreativitas, Dokumentasi, dan Apresiasi Seni. Seluruh dokumen administrasi, portofolio siswa, dan arsip karya tersimpan langsung di Google Drive dan Google Sheets milik sekolah.
              </p>

              {error && (
                <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                  {error}
                </div>
              )}

              <div className="mt-7 flex flex-wrap items-center gap-4">
                <GoogleSignInButton
                  onClick={onGoogleLogin}
                  disabled={loading}
                  label={loading ? 'Menghubungkan akun...' : 'Masuk dengan Akun Google'}
                />
              </div>

              <div className="mt-8 border-t border-slate-200 pt-6">
                <p className="text-xs font-medium text-slate-500">
                  Akses Pengunjung Galeri Publik (via Google Apps Script Web App)
                </p>
                <div className="mt-2.5 flex flex-col sm:flex-row gap-2.5">
                  <input
                    type="url"
                    value={visitorGasUrl}
                    onChange={(e) => setVisitorGasUrl(e.target.value)}
                    placeholder="Tempel URL Web App Google Apps Script sekolah..."
                    className="flex-1 rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-teal-600 focus:bg-white focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => onOpenPublicGallery?.(visitorGasUrl)}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-teal-200 bg-teal-50 px-4 py-2 text-sm font-semibold text-teal-800 hover:bg-teal-100 transition-colors whitespace-nowrap"
                  >
                    <Globe className="h-4 w-4" />
                    Buka Galeri Publik
                  </button>
                </div>
              </div>
            </div>

            <div className="lg:col-span-6">
              <div className="h-full overflow-hidden rounded-2xl border border-slate-200 bg-teal-50/30">
                <img
                  src="/src/assets/images/seni_ruang_banner_1794962758130.jpg"
                  alt="Ruang pameran dan studio seni budaya SMP SENI RUANG"
                  referrerPolicy="no-referrer"
                  className="h-full min-h-[320px] w-full object-cover"
                />
              </div>
            </div>
          </div>

          <div className="mt-12 grid grid-cols-1 gap-6 border-t border-slate-200 pt-8 sm:grid-cols-3">
            <div>
              <div className="flex items-center gap-2.5 text-sm font-semibold text-slate-900">
                <HardDrive className="h-4 w-4 text-teal-600" />
                Penyimpanan Google Drive
              </div>
              <p className="mt-1.5 text-sm text-slate-600">
                Struktur folder otomatis untuk Perencanaan, Penilaian, Dokumentasi, dan Karya Kelas VII–IX.
              </p>
            </div>
            <div>
              <div className="flex items-center gap-2.5 text-sm font-semibold text-slate-900">
                <Database className="h-4 w-4 text-teal-600" />
                Database Google Sheets
              </div>
              <p className="mt-1.5 text-sm text-slate-600">
                11 tabel terstruktur mencatat metadata file, data siswa, kelas, portofolio, dan log aktivitas.
              </p>
            </div>
            <div>
              <div className="flex items-center gap-2.5 text-sm font-semibold text-slate-900">
                <Palette className="h-4 w-4 text-teal-600" />
                Portofolio & Apresiasi Karya
              </div>
              <p className="mt-1.5 text-sm text-slate-600">
                Galeri visual karya siswa terkelompok per kelas dan tahun ajaran untuk memantau perkembangan kreativitas.
              </p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/70">
      <header className="border-b border-slate-200 bg-white px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <SeniRuangLogo size={32} />
            <div>
              <span className="text-base font-bold text-slate-900">SENI RUANG</span>
              <span className="ml-2 text-xs text-slate-500">Panduan Konfigurasi Workspace</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline text-xs font-medium text-slate-600">{userEmail}</span>
            <button
              type="button"
              onClick={onLogout}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              <LogOut className="h-3.5 w-3.5" />
              Keluar
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
          <div className="flex flex-col gap-4 border-b border-slate-100 pb-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold text-amber-700">
                Status Koneksi: Google Drive & Google Sheets Belum Terhubung
              </p>
              <h1 className="mt-1 text-2xl font-bold text-slate-900">
                Siapkan Ruang Kerja SENI RUANG di Google Workspace
              </h1>
              <p className="mt-1 text-sm text-slate-600">
                Aplikasi ini tidak menggunakan database lokal. Pilih pembuatan otomatis atau hubungkan Spreadsheet yang sudah ada.
              </p>
            </div>
          </div>

          {error && (
            <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {error}
            </div>
          )}

          <div className="mt-6 flex flex-wrap gap-1.5 rounded-xl bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setActiveTab('auto')}
              className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition-colors whitespace-nowrap ${
                activeTab === 'auto'
                  ? 'bg-white text-teal-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              1. Buat Otomatis (Direkomendasikan)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('manual')}
              className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition-colors whitespace-nowrap ${
                activeTab === 'manual'
                  ? 'bg-white text-teal-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              2. Hubungkan ID yang Sudah Ada
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('gas')}
              className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition-colors whitespace-nowrap ${
                activeTab === 'gas'
                  ? 'bg-white text-teal-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              3. Skrip Google Apps Script (Code.gs)
            </button>
          </div>

          {activeTab === 'auto' && (
            <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-12">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  onProvision({ namaGuru, namaSekolah, tahunAjaran, semester });
                }}
                className="space-y-4 lg:col-span-6"
              >
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Nama Guru Pengampu</label>
                  <input
                    type="text"
                    required
                    value={namaGuru}
                    onChange={(e) => setNamaGuru(e.target.value)}
                    placeholder="Contoh: Riko Prasstya, S.Pd."
                    className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-teal-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Nama Sekolah (SMP)</label>
                  <input
                    type="text"
                    required
                    value={namaSekolah}
                    onChange={(e) => setNamaSekolah(e.target.value)}
                    placeholder="Contoh: SMP Negeri 1 Nusantara"
                    className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-teal-600 focus:outline-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">Tahun Ajaran Aktif</label>
                    <input
                      type="text"
                      required
                      value={tahunAjaran}
                      onChange={(e) => setTahunAjaran(e.target.value)}
                      className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-teal-600 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">Semester Aktif</label>
                    <select
                      value={semester}
                      onChange={(e) => setSemester(e.target.value)}
                      className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm bg-white focus:border-teal-600 focus:outline-none"
                    >
                      <option value="Ganjil">Ganjil</option>
                      <option value="Genap">Genap</option>
                    </select>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-teal-600 px-5 py-3 text-sm font-semibold text-white hover:bg-teal-700 transition-colors disabled:opacity-60"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Membuat Folder Drive & 11 Sheet Database...
                    </>
                  ) : (
                    <>
                      <FolderTree className="h-4 w-4" />
                      Buat Otomatis Folder Drive & Database Sheets
                    </>
                  )}
                </button>
              </form>

              <div className="rounded-xl border border-teal-100 bg-teal-50/40 p-5 lg:col-span-6">
                <h3 className="text-sm font-semibold text-teal-950">
                  Struktur yang Akan Dibuat di Akun Google Anda
                </h3>
                <pre className="mt-3 overflow-x-auto font-mono text-xs leading-relaxed text-slate-700">
{`SENI RUANG/
├── 01_ADMINISTRASI_GURU/
│   ├── PERENCANAAN_PEMBELAJARAN/
│   ├── ADMINISTRASI_PENILAIAN/
│   ├── ADMINISTRASI_GURU/
│   └── DOKUMENTASI_KEGIATAN/
├── 02_KARYA_SISWA/
│   ├── KELAS_VII/
│   ├── KELAS_VIII/
│   └── KELAS_IX/
├── 03_PORTOFOLIO_SISWA/
├── 04_LAPORAN/
├── 05_BACKUP/
└── SENI RUANG - Database Utama (11 Sheets)`}
                </pre>
                <p className="mt-3 text-xs text-slate-600">
                  Otomatis mengisi 33 kelas (VII.1–IX.11), kategori administrasi Kurikulum Merdeka, dan 12 kategori karya seni siswa.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'manual' && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                onConnectExisting({ spreadsheetId, rootFolderId, gasWebAppUrl: gasUrlInput });
              }}
              className="mt-6 max-w-xl space-y-4"
            >
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Google Spreadsheet ID <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={spreadsheetId}
                  onChange={(e) => setSpreadsheetId(e.target.value)}
                  placeholder="Contoh: 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
                  className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 font-mono text-xs focus:border-teal-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Google Drive Root Folder ID (SENI RUANG)
                </label>
                <input
                  type="text"
                  value={rootFolderId}
                  onChange={(e) => setRootFolderId(e.target.value)}
                  placeholder="Opsional jika folder ID sudah tersimpan di sheet PENGATURAN"
                  className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 font-mono text-xs focus:border-teal-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  URL Web App Google Apps Script (Opsional)
                </label>
                <input
                  type="url"
                  value={gasUrlInput}
                  onChange={(e) => setGasUrlInput(e.target.value)}
                  placeholder="https://script.google.com/macros/s/.../exec"
                  className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 font-mono text-xs focus:border-teal-600 focus:outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 transition-colors disabled:opacity-60"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Validasi & Hubungkan Workspace
              </button>
            </form>
          )}

          {activeTab === 'gas' && (
            <div className="mt-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-slate-600">
                  Salin skrip <code className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded">Code.gs</code> berikut untuk menyebarkan endpoint Google Apps Script Web App penghubung Sheets & Drive.
                </p>
                <div className="flex items-center gap-2">
                  <a
                    href="https://script.google.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Buka Apps Script
                  </a>
                  <button
                    type="button"
                    onClick={handleCopyGas}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-teal-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-teal-700"
                  >
                    {copiedGas ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {copiedGas ? 'Tersalin' : 'Salin Kode Code.gs'}
                  </button>
                </div>
              </div>
              <pre className="max-h-96 overflow-auto rounded-xl border border-slate-200 bg-slate-950 p-4 font-mono text-xs leading-relaxed text-teal-100">
                {gasCode}
              </pre>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
