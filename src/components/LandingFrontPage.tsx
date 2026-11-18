import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Check,
  Copy,
  Database,
  Eye,
  FileText,
  Globe,
  HardDrive,
  Loader2,
  Palette,
  Plus,
  RefreshCw,
  Search,
  UploadCloud,
} from 'lucide-react';
import {
  fetchPublicGallery,
  uploadStudentWorkPublic,
  type PublicGalleryResponse,
} from '../services/apiClient';
import { DEFAULT_KATEGORI_KARYA } from '../types/seniRuang';
import { generateGoogleAppsScriptCode } from '../utils/gasTemplate';
import { FIREBASE_AUTH_DOMAINS_URL } from '../services/firebaseAuth';
import { GoogleSignInButton, ModalShell, SeniRuangLogo } from './CommonUI';
import { DriveImage } from './DriveImage';

const DEFAULT_CLASS_LIST: string[] = (() => {
  const list: string[] = [];
  (['VII', 'VIII', 'IX'] as const).forEach((t) => {
    for (let i = 1; i <= 11; i++) list.push(`${t}.${i}`);
  });
  return list;
})();

const GAS_STORAGE_KEY = 'seni_ruang_public_gas_url';

interface LandingFrontPageProps {
  authLoading: boolean;
  authError?: string;
  onGoogleLogin: () => void;
  onToast: (type: 'success' | 'error' | 'info', text: string) => void;
}

export function LandingFrontPage({
  authLoading,
  authError,
  onGoogleLogin,
  onToast,
}: LandingFrontPageProps) {
  const envGasUrl = (import.meta.env.VITE_GAS_WEBAPP_URL as string | undefined) || '';
  const [gasUrl, setGasUrl] = useState<string>(() => {
    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get('gas');
    if (fromQuery) {
      localStorage.setItem(GAS_STORAGE_KEY, fromQuery);
      return fromQuery;
    }
    return envGasUrl || localStorage.getItem(GAS_STORAGE_KEY) || '';
  });
  const [gasInput, setGasInput] = useState(gasUrl);

  const [galleryData, setGalleryData] = useState<PublicGalleryResponse | null>(null);
  const [loadingGallery, setLoadingGallery] = useState(false);

  // Filters for Karya Terbaru
  const [search, setSearch] = useState('');
  const [filterKategori, setFilterKategori] = useState('Semua');
  const [filterKelas, setFilterKelas] = useState('Semua');
  const [selectedArtwork, setSelectedArtwork] = useState<Record<string, string> | null>(null);

  // Student Upload Modal
  const [uploadOpen, setUploadOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const [namaSiswa, setNamaSiswa] = useState('');
  const [nisSiswa, setNisSiswa] = useState('');
  const [kelas, setKelas] = useState('VII.1');
  const [kategoriSeni, setKategoriSeni] = useState(DEFAULT_KATEGORI_KARYA[0].nama);
  const [judulKarya, setJudulKarya] = useState('');
  const [teknik, setTeknik] = useState('');
  const [mediaBahan, setMediaBahan] = useState('');
  const [deskripsi, setDeskripsi] = useState('');

  // Vercel & GAS Guide Modal
  const [guideOpen, setGuideOpen] = useState(false);
  const [copiedGas, setCopiedGas] = useState(false);

  const loadGallery = useCallback(
    async (targetUrl?: string) => {
      const activeUrl = (targetUrl ?? gasUrl).trim();
      setLoadingGallery(true);
      try {
        const res = await fetchPublicGallery(activeUrl || undefined);
        setGalleryData(res);
        if (res.error) {
          onToast('error', res.error);
        }
      } catch {
        onToast('error', 'Gagal memuat galeri karya terbaru.');
      } finally {
        setLoadingGallery(false);
      }
    },
    [gasUrl, onToast]
  );

  useEffect(() => {
    loadGallery();
  }, [loadGallery]);

  const kelasOptions = useMemo(() => {
    if (galleryData?.kelas && galleryData.kelas.length > 0) return galleryData.kelas;
    return DEFAULT_CLASS_LIST;
  }, [galleryData]);

  const kategoriOptions = useMemo(() => {
    if (galleryData?.kategoriKarya && galleryData.kategoriKarya.length > 0) {
      return galleryData.kategoriKarya;
    }
    return DEFAULT_KATEGORI_KARYA.map((k) => k.nama);
  }, [galleryData]);

  const karyaList = useMemo(() => galleryData?.karya || [], [galleryData]);

  const filteredKarya = useMemo(() => {
    const q = search.trim().toLowerCase();
    return karyaList.filter((item) => {
      const matchSearch =
        !q ||
        (item.judul_karya || '').toLowerCase().includes(q) ||
        (item.nama_siswa || '').toLowerCase().includes(q) ||
        (item.kategori_seni || '').toLowerCase().includes(q);
      const matchKat = filterKategori === 'Semua' || item.kategori_seni === filterKategori;
      const matchKelas = filterKelas === 'Semua' || item.kelas === filterKelas;
      return matchSearch && matchKat && matchKelas;
    });
  }, [karyaList, search, filterKategori, filterKelas]);

  const handleSaveGasUrl = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = gasInput.trim();
    if (cleaned) {
      localStorage.setItem(GAS_STORAGE_KEY, cleaned);
    } else {
      localStorage.removeItem(GAS_STORAGE_KEY);
    }
    setGasUrl(cleaned);
    loadGallery(cleaned);
    onToast('success', 'URL Google Apps Script diperbarui.');
  };

  const handleSelectStudentFile = (candidate: File | null) => {
    if (!candidate) {
      setFile(null);
      return;
    }
    const ext = (candidate.name.split('.').pop() || '').toLowerCase();
    if (!['jpg', 'jpeg', 'png', 'pdf'].includes(ext)) {
      onToast('error', 'File tugas harus berformat JPG, JPEG, PNG, atau PDF.');
      return;
    }
    if (candidate.size > 10 * 1024 * 1024) {
      onToast('error', 'Ukuran file maksimal untuk unggahan siswa adalah 10 MB.');
      return;
    }
    setFile(candidate);
  };

  const handleStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      onToast('error', 'Pilih foto karya atau file PDF tugas Anda terlebih dahulu.');
      return;
    }
    if (!gasUrl.trim()) {
      onToast(
        'error',
        'Koneksi Google Apps Script belum diatur oleh guru. Buka "Panduan Vercel & GAS" untuk menempelkan URL Web App.'
      );
      return;
    }

    setIsUploading(true);
    setUploadProgress(10);
    try {
      await uploadStudentWorkPublic({
        file,
        gasUrl: gasUrl.trim(),
        judul_karya: judulKarya.trim(),
        nama_siswa: namaSiswa.trim(),
        nis_siswa: nisSiswa.trim(),
        kelas,
        kategori_seni: kategoriSeni,
        teknik_berkarya: teknik.trim(),
        media_bahan: mediaBahan.trim(),
        deskripsi_karya: deskripsi.trim(),
        onProgress: setUploadProgress,
      });

      onToast(
        'success',
        `Karya "${judulKarya.trim()}" berhasil diunggah! Karya Anda langsung tampil di halaman utama.`
      );
      setUploadOpen(false);
      setFile(null);
      setJudulKarya('');
      setTeknik('');
      setMediaBahan('');
      setDeskripsi('');
      await loadGallery();
    } catch (err) {
      onToast('error', err instanceof Error ? err.message : 'Gagal mengirim karya siswa.');
    } finally {
      setIsUploading(false);
    }
  };

  const identitas = galleryData?.identitas || {};
  const isConnected = Boolean(galleryData?.configured && !galleryData?.error);

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 backdrop-blur-xs px-6 py-3.5">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-8">
          <a href="#top" className="flex items-center gap-2.5 whitespace-nowrap shrink-0">
            <SeniRuangLogo size={32} />
            <span className="text-lg font-bold tracking-tight text-slate-900">
              {identitas.nama_website || 'SENI RUANG'}
            </span>
          </a>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            <a
              href="#karya-terbaru"
              className="hover:text-teal-700 transition-colors whitespace-nowrap shrink-0"
            >
              Karya Terbaru
            </a>
            <button
              type="button"
              onClick={() => setUploadOpen(true)}
              className="hover:text-teal-700 transition-colors whitespace-nowrap shrink-0"
            >
              Unggah Tugas Siswa
            </button>
            <button
              type="button"
              onClick={() => setGuideOpen(true)}
              className="hover:text-teal-700 transition-colors whitespace-nowrap shrink-0"
            >
              Panduan Vercel
            </button>
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            <GoogleSignInButton
              onClick={onGoogleLogin}
              disabled={authLoading}
              label={authLoading ? 'Menghubungkan...' : 'Masuk Guru'}
            />
          </div>
        </div>
      </header>

      <main id="top" className="flex-1">
        {/* Hero Split Section */}
        <section className="mx-auto max-w-6xl px-6 py-10 lg:py-14">
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:items-stretch">
            <div className="flex flex-col justify-center lg:col-span-6">
              <p className="text-xs font-semibold tracking-wider text-teal-700 uppercase">
                {identitas.nama_sekolah || 'Platform Seni Budaya SMP'}
              </p>
              <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl lg:text-[2.65rem] lg:leading-[1.15] [text-wrap:balance]">
                Ruang Kreativitas, Dokumentasi & Apresiasi Karya Siswa
              </h1>
              <p className="mt-4 text-base leading-relaxed text-slate-600 max-w-xl">
                {identitas.tagline ||
                  'Siswa dapat mengunggah tugas karya seni secara langsung dan melihat hasil karya terbaru teman-teman sekelas yang tersimpan rapi di Google Drive sekolah.'}
              </p>

              {authError && (
                <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 space-y-2">
                  <p>{authError}</p>
                  {authError.includes('Authorized Domains') && (
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(window.location.hostname);
                          onToast('success', `Domain "${window.location.hostname}" disalin.`);
                        }}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-2.5 py-1 text-xs font-semibold text-red-800 hover:bg-red-100"
                      >
                        <Copy className="h-3 w-3" />
                        Salin: {window.location.hostname}
                      </button>
                      <a
                        href={FIREBASE_AUTH_DOMAINS_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-lg bg-red-700 px-2.5 py-1 text-xs font-semibold text-white hover:bg-red-800"
                      >
                        Buka Firebase Authorized Domains
                      </a>
                    </div>
                  )}
                </div>
              )}

              <div className="mt-7 flex flex-wrap items-center gap-3.5">
                <button
                  type="button"
                  onClick={() => setUploadOpen(true)}
                  className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-5 py-3 text-sm font-semibold text-white hover:bg-teal-700 transition-colors whitespace-nowrap"
                >
                  <UploadCloud className="h-4.5 w-4.5" />
                  Unggah Tugas / Karya Siswa
                </button>
                <a
                  href="#karya-terbaru"
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap"
                >
                  <Palette className="h-4.5 w-4.5 text-teal-600" />
                  Lihat Karya Terbaru
                </a>
              </div>
            </div>

            <div className="lg:col-span-6">
              <div className="h-full overflow-hidden rounded-2xl border border-slate-200 bg-teal-50/30">
                <img
                  src="/src/assets/images/seni_ruang_banner_1794962758130.jpg"
                  alt="Galeri pameran karya seni budaya SMP SENI RUANG"
                  referrerPolicy="no-referrer"
                  className="h-full min-h-[300px] w-full object-cover"
                />
              </div>
            </div>
          </div>

          {/* 3-Column Feature Summary */}
          <div className="mt-10 grid grid-cols-1 gap-6 border-t border-slate-200 pt-8 sm:grid-cols-3">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <UploadCloud className="h-4 w-4 text-teal-600" />
                Pengumpulan Tugas Mandiri
              </div>
              <p className="mt-1 text-sm text-slate-600">
                Siswa mengunggah foto karya atau PDF langsung dari ponsel/laptop tanpa perlu login admin.
              </p>
            </div>
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <HardDrive className="h-4 w-4 text-teal-600" />
                Terarsip di Google Drive & Sheets
              </div>
              <p className="mt-1 text-sm text-slate-600">
                Otomatis masuk ke folder kelas (VII, VIII, IX) dan tercatat pada database Google Sheets guru.
              </p>
            </div>
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Database className="h-4 w-4 text-teal-600" />
                Siap Dipublikasikan ke Vercel
              </div>
              <p className="mt-1 text-sm text-slate-600">
                Mendukung variabel <code className="font-mono text-xs">VITE_GAS_WEBAPP_URL</code> untuk hosting publik di Vercel.
              </p>
            </div>
          </div>
        </section>

        {/* Latest Student Works Showcase on Front Page */}
        <section id="karya-terbaru" className="border-t border-slate-200 bg-slate-50/60 py-12">
          <div className="mx-auto max-w-6xl px-6 space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-semibold text-teal-700 uppercase">Etalase Galeri Siswa</p>
                <h2 className="mt-1 text-2xl font-bold text-slate-900">Hasil Karya Terbaru</h2>
                <p className="mt-1 text-sm text-slate-600">
                  {isConnected
                    ? `Menampilkan ${filteredKarya.length} karya seni yang baru dikumpulkan dan dipublikasikan.`
                    : 'Hubungkan URL Google Apps Script Web App untuk menampilkan karya siswa secara langsung.'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => loadGallery()}
                  disabled={loadingGallery}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${loadingGallery ? 'animate-spin text-teal-600' : ''}`} />
                  Muat Ulang
                </button>
                <button
                  type="button"
                  onClick={() => setUploadOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-teal-600 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-700"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Kirim Karya
                </button>
              </div>
            </div>

            {/* Connection / GAS URL Quick Config if not configured via Vercel env */}
            {!isConnected && (
              <div className="rounded-2xl border border-teal-200 bg-white p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">
                      Hubungkan Endpoint Galeri & Pengumpulan Tugas Siswa
                    </h3>
                    <p className="mt-1 text-xs text-slate-600">
                      Tempel URL Web App Google Apps Script sekolah di bawah (atau atur{' '}
                      <code className="font-mono bg-slate-100 px-1 py-0.5 rounded">
                        VITE_GAS_WEBAPP_URL
                      </code>{' '}
                      saat deploy di Vercel).
                    </p>
                  </div>
                  <form onSubmit={handleSaveGasUrl} className="flex flex-1 max-w-xl gap-2">
                    <input
                      type="url"
                      value={gasInput}
                      onChange={(e) => setGasInput(e.target.value)}
                      placeholder="https://script.google.com/macros/s/.../exec"
                      className="flex-1 rounded-xl border border-slate-200 px-3.5 py-2 font-mono text-xs focus:border-teal-600 focus:outline-none"
                    />
                    <button
                      type="submit"
                      className="inline-flex items-center gap-1.5 rounded-xl bg-teal-600 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-700 whitespace-nowrap"
                    >
                      <Globe className="h-3.5 w-3.5" />
                      Hubungkan
                    </button>
                  </form>
                </div>
              </div>
            )}

            {/* Filter Bar */}
            <div className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-4">
              <div className="relative sm:col-span-2">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Cari judul karya atau nama siswa..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2 pl-9 pr-3 text-sm focus:border-teal-600 focus:bg-white focus:outline-none"
                />
              </div>
              <select
                value={filterKategori}
                onChange={(e) => setFilterKategori(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
              >
                <option value="Semua">Semua Kategori Seni</option>
                {kategoriOptions.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
              <select
                value={filterKelas}
                onChange={(e) => setFilterKelas(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
              >
                <option value="Semua">Semua Kelas</option>
                {kelasOptions.map((k) => (
                  <option key={k} value={k}>
                    Kelas {k}
                  </option>
                ))}
              </select>
            </div>

            {/* Gallery Grid */}
            {loadingGallery ? (
              <div className="flex items-center justify-center rounded-2xl border border-slate-200 bg-white py-16">
                <Loader2 className="h-6 w-6 animate-spin text-teal-600" />
                <span className="ml-2.5 text-sm text-slate-600">Memuat karya terbaru...</span>
              </div>
            ) : filteredKarya.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 py-14 text-center">
                <img
                  src="/src/assets/images/seni_ruang_studio_empty_1794962758515.jpg"
                  alt="Meja studio seni budaya"
                  referrerPolicy="no-referrer"
                  className="h-40 w-56 rounded-xl object-cover border border-slate-200"
                />
                <h3 className="mt-4 text-base font-semibold text-slate-900">
                  {isConnected
                    ? 'Belum ada karya yang dipublikasikan'
                    : 'Galeri Publik Menunggu Koneksi Apps Script'}
                </h3>
                <p className="mt-1 max-w-md text-sm text-slate-500">
                  {isConnected
                    ? 'Jadilah siswa pertama yang mengunggah karya tugas melalui tombol Unggah Tugas di atas.'
                    : 'Guru dapat masuk untuk membuat workspace otomatis, lalu menempelkan URL Google Apps Script Web App.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {filteredKarya.map((item, idx) => {
                  const isPdf = (item.format_file || '').toUpperCase() === 'PDF';
                  return (
                    <button
                      key={item.id || idx}
                      type="button"
                      onClick={() => setSelectedArtwork(item)}
                      className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white text-left transition-colors hover:border-teal-400"
                    >
                      <div className="aspect-[4/3] w-full overflow-hidden bg-slate-100">
                        {isPdf ? (
                          <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-teal-50/40 text-teal-800 p-4">
                            <FileText className="h-10 w-10 text-teal-600" />
                            <span className="text-xs font-semibold">Dokumen Tugas PDF</span>
                          </div>
                        ) : (
                          <DriveImage
                            fileId={item.drive_file_id}
                            fallbackUrl={item.drive_url}
                            alt={item.judul_karya || 'Karya Siswa'}
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                          />
                        )}
                      </div>
                      <div className="flex flex-1 flex-col justify-between p-4">
                        <div>
                          <p className="text-xs font-medium text-teal-700">
                            <span>{item.kategori_seni}</span>
                            <span className="mx-1.5 text-slate-300">·</span>
                            <span>Kelas {item.kelas}</span>
                            {item.status_publikasi === 'Karya Pilihan' && (
                              <>
                                <span className="mx-1.5 text-slate-300">·</span>
                                <span className="font-semibold text-amber-700">Karya Pilihan</span>
                              </>
                            )}
                          </p>
                          <h3 className="mt-1 truncate text-base font-semibold text-slate-900 group-hover:text-teal-700">
                            {item.judul_karya}
                          </h3>
                          <p className="mt-0.5 text-sm text-slate-600">{item.nama_siswa}</p>
                        </div>
                        <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5 text-xs text-slate-500">
                          <span className="font-mono tabular-nums">
                            {item.tanggal_pengumpulan || '-'}
                          </span>
                          <span className="inline-flex items-center gap-1 font-semibold text-teal-700">
                            <Eye className="h-3.5 w-3.5" /> Lihat Detail
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white px-6 py-5">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 text-xs text-slate-500 sm:flex-row">
          <span>
            {identitas.nama_website || 'SENI RUANG'} · {identitas.nama_sekolah || 'Seni Budaya SMP'}
          </span>
          <button
            type="button"
            onClick={() => setGuideOpen(true)}
            className="font-semibold text-teal-700 hover:underline"
          >
            Panduan Publikasi Vercel & Google Apps Script
          </button>
        </div>
      </footer>

      {/* Student Submission Modal */}
      <ModalShell
        open={uploadOpen}
        onClose={() => !isUploading && setUploadOpen(false)}
        title="Unggah Tugas / Karya Siswa"
        subtitle="Pilih foto karya (JPG/PNG) atau file PDF tugas Anda untuk dikumpulkan ke guru"
      >
        <form onSubmit={handleStudentSubmit} className="space-y-4">
          {!gasUrl.trim() && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              URL Google Apps Script sekolah belum terpasang. Pastikan guru sudah mengatur{' '}
              <code className="font-mono">VITE_GAS_WEBAPP_URL</code> di Vercel atau menempelkannya di halaman utama.
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700">
              File Karya / Tugas (JPG, PNG, atau PDF · Maks. 10 MB)
            </label>
            <input
              type="file"
              accept=".jpg,.jpeg,.png,.pdf"
              onChange={(e) => handleSelectStudentFile(e.target.files?.[0] || null)}
              className="mt-1.5 block w-full rounded-xl border border-dashed border-teal-300 bg-teal-50/30 p-3 text-sm text-slate-700 file:mr-4 file:rounded-lg file:border-0 file:bg-teal-600 file:px-3.5 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:file:bg-teal-700"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700">Nama Lengkap Siswa</label>
              <input
                type="text"
                required
                value={namaSiswa}
                onChange={(e) => setNamaSiswa(e.target.value)}
                placeholder="Nama lengkap sesuai absen"
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
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700">Kelas</label>
              <select
                value={kelas}
                onChange={(e) => setKelas(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm focus:border-teal-600 focus:outline-none"
              >
                {kelasOptions.map((k) => (
                  <option key={k} value={k}>
                    Kelas {k}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">Kategori Seni</label>
              <select
                value={kategoriSeni}
                onChange={(e) => setKategoriSeni(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm focus:border-teal-600 focus:outline-none"
              >
                {kategoriOptions.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700">Judul Karya / Tugas</label>
            <input
              type="text"
              required
              value={judulKarya}
              onChange={(e) => setJudulKarya(e.target.value)}
              placeholder="Contoh: Poster Edukasi Lingkungan Sekolah"
              className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm focus:border-teal-600 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700">Teknik Berkarya</label>
              <input
                type="text"
                value={teknik}
                onChange={(e) => setTeknik(e.target.value)}
                placeholder="Contoh: Arsir, Plakat, Cukil, Digital"
                className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm focus:border-teal-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">Media & Bahan</label>
              <input
                type="text"
                value={mediaBahan}
                onChange={(e) => setMediaBahan(e.target.value)}
                placeholder="Contoh: Kertas A3, Cat Air"
                className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm focus:border-teal-600 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700">Deskripsi Karya</label>
            <textarea
              rows={2}
              value={deskripsi}
              onChange={(e) => setDeskripsi(e.target.value)}
              placeholder="Jelaskan makna atau proses pembuatan karya Anda..."
              className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm focus:border-teal-600 focus:outline-none"
            />
          </div>

          {isUploading && (
            <div className="space-y-1.5 rounded-xl bg-teal-50 p-3">
              <div className="flex items-center justify-between text-xs font-semibold text-teal-900">
                <span>Mengirim karya ke Google Drive sekolah...</span>
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
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isUploading}
              className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-5 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-60"
            >
              <UploadCloud className="h-4 w-4" />
              {isUploading ? 'Mengunggah...' : 'Kirim Karya Sekarang'}
            </button>
          </div>
        </form>
      </ModalShell>

      {/* Lightbox Artwork Modal */}
      <ModalShell
        open={Boolean(selectedArtwork)}
        onClose={() => setSelectedArtwork(null)}
        title={selectedArtwork?.judul_karya || ''}
        subtitle={
          selectedArtwork
            ? `${selectedArtwork.nama_siswa} · Kelas ${selectedArtwork.kelas} · ${selectedArtwork.kategori_seni}`
            : ''
        }
        maxWidth="max-w-3xl"
      >
        {selectedArtwork && (
          <div className="space-y-4">
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
              {(selectedArtwork.format_file || '').toUpperCase() === 'PDF' ? (
                <iframe
                  src={`https://drive.google.com/file/d/${encodeURIComponent(selectedArtwork.drive_file_id || '')}/preview`}
                  title={selectedArtwork.judul_karya || 'Dokumen PDF'}
                  className="h-[55vh] w-full"
                />
              ) : (
                <DriveImage
                  fileId={selectedArtwork.drive_file_id}
                  fallbackUrl={selectedArtwork.drive_url}
                  alt={selectedArtwork.judul_karya || 'Karya Siswa'}
                  className="max-h-[55vh] w-full object-contain"
                />
              )}
            </div>
            <p className="text-sm text-slate-700">
              {selectedArtwork.deskripsi_karya || 'Tidak ada deskripsi tambahan.'}
            </p>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-xs text-slate-500">
              <span>
                Teknik: {selectedArtwork.teknik_berkarya || '-'} · Media:{' '}
                {selectedArtwork.media_bahan || '-'}
              </span>
              {selectedArtwork.drive_url && (
                <a
                  href={selectedArtwork.drive_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-teal-700 hover:underline"
                >
                  Buka Berkas di Google Drive
                </a>
              )}
            </div>
          </div>
        )}
      </ModalShell>

      {/* Vercel & GAS Guide Modal */}
      <ModalShell
        open={guideOpen}
        onClose={() => setGuideOpen(false)}
        title="Panduan Publikasi Website SENI RUANG di Vercel"
        subtitle="Langkah lengkap agar guru, siswa, dan pengunjung dapat mengakses website secara publik"
        maxWidth="max-w-3xl"
      >
        <div className="space-y-5 text-sm text-slate-700">
          <ol className="list-decimal space-y-2.5 pl-5">
            <li>
              <strong>Masuk sebagai Guru terlebih dahulu</strong> dengan tombol <em>Masuk Guru</em> di pojok kanan atas untuk membuat otomatis folder Google Drive & 11 Sheet Database.
            </li>
            <li>
              <strong>Deploy Google Apps Script (<code className="font-mono text-xs">Code.gs</code>)</strong>: Buka{' '}
              <a
                href="https://script.google.com"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-teal-700 underline"
              >
                script.google.com
              </a>
              , tempel kode di bawah, isi <code className="font-mono text-xs">SPREADSHEET_ID</code> dan{' '}
              <code className="font-mono text-xs">ROOT_FOLDER_ID</code>, lalu klik{' '}
              <strong>Deploy → New deployment → Web app</strong> (Execute as: <strong>Me</strong>, Who has access: <strong>Anyone</strong>).
            </li>
            <li>
              <strong>Import Project ke Vercel</strong>: Unggah kode project ini ke GitHub lalu import di{' '}
              <strong>Vercel</strong> (Build Command: <code className="font-mono text-xs">npm run build</code>, Output Directory: <code className="font-mono text-xs">dist</code> — sudah otomatis di <code className="font-mono text-xs">vercel.json</code>).
            </li>
            <li>
              <strong>Atur Environment Variable di Vercel</strong>: Tambahkan{' '}
              <code className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded">VITE_GAS_WEBAPP_URL</code> berisi URL Web App Apps Script agar halaman depan langsung menampilkan karya terbaru dan menerima unggahan siswa!
            </li>
            <li>
              <strong>Izinkan Domain Vercel di Firebase Auth</strong>: Buka Firebase Console → Authentication → Settings → Authorized domains, lalu tambahkan domain Vercel Anda (mis. <code className="font-mono text-xs">seni-ruang.vercel.app</code>) agar login Google Guru berfungsi di domain produksi.
            </li>
          </ol>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-900">Kode Google Apps Script (Code.gs)</span>
              <button
                type="button"
                onClick={async () => {
                  await navigator.clipboard.writeText(generateGoogleAppsScriptCode());
                  setCopiedGas(true);
                  setTimeout(() => setCopiedGas(false), 2500);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-700"
              >
                {copiedGas ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copiedGas ? 'Tersalin' : 'Salin Code.gs'}
              </button>
            </div>
            <pre className="max-h-56 overflow-auto rounded-xl bg-slate-950 p-4 font-mono text-xs text-teal-100">
              {generateGoogleAppsScriptCode()}
            </pre>
          </div>
        </div>
      </ModalShell>
    </div>
  );
}
