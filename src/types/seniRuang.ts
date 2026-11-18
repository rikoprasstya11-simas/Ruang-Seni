export type UserRole = 'ADMIN' | 'SISWA' | 'PENGUNJUNG';

export type AdminGroup =
  | 'Perencanaan Pembelajaran'
  | 'Administrasi Penilaian'
  | 'Administrasi Guru'
  | 'Dokumentasi Kegiatan';

export type PublikasiStatus = 'Dipublikasikan' | 'Karya Pilihan' | 'Draft' | 'Arsip Internal';

export interface UserRecord {
  id: string;
  email: string;
  nama: string;
  role: UserRole;
  kelas: string;
  status: string;
  dibuat_pada: string;
  terakhir_login: string;
}

export interface IdentitasWebsite {
  id: string;
  nama_website: string;
  tagline: string;
  logo_url: string;
  logo_file_id: string;
  nama_guru: string;
  nip_guru: string;
  email_guru: string;
  nama_sekolah: string;
  tahun_ajaran_aktif: string;
  semester_aktif: string;
}

export interface KelasRecord {
  id: string;
  nama_kelas: string;
  tingkat: 'VII' | 'VIII' | 'IX';
  wali_kelas: string;
  tahun_ajaran: string;
  jumlah_siswa: string;
  keterangan: string;
}

export interface SiswaRecord {
  id: string;
  nis: string;
  nama_siswa: string;
  kelas: string;
  jenis_kelamin: string;
  email: string;
  foto_url: string;
  tahun_ajaran: string;
  status: string;
}

export interface AdministrasiRecord {
  id: string;
  judul: string;
  kategori_utama: 'Perencanaan Pembelajaran' | 'Administrasi Penilaian' | 'Administrasi Guru';
  sub_kategori: string;
  kelas: string;
  semester: string;
  tahun_ajaran: string;
  nama_file: string;
  format_file: string;
  ukuran_file: string;
  pemilik: string;
  tanggal_upload: string;
  drive_file_id: string;
  drive_url: string;
  status_publikasi: string;
  keterangan: string;
}

export interface DokumentasiRecord {
  id: string;
  judul: string;
  sub_kategori: string;
  kelas: string;
  semester: string;
  tahun_ajaran: string;
  tanggal_kegiatan: string;
  deskripsi: string;
  nama_file: string;
  format_file: string;
  ukuran_file: string;
  pemilik: string;
  tanggal_upload: string;
  drive_file_id: string;
  drive_url: string;
  status_publikasi: string;
}

export interface KaryaSiswaRecord {
  id: string;
  judul_karya: string;
  nama_siswa: string;
  nis_siswa: string;
  kelas: string;
  tahun_ajaran: string;
  semester: string;
  kategori_seni: string;
  deskripsi_karya: string;
  teknik_berkarya: string;
  media_bahan: string;
  tanggal_pengumpulan: string;
  nama_file: string;
  format_file: string;
  ukuran_file: string;
  drive_file_id: string;
  drive_url: string;
  status_publikasi: PublikasiStatus | string;
  apresiasi_count: string;
  pengunggah: string;
  tanggal_upload?: string;
}

export interface KategoriDokumenRecord {
  id: string;
  kelompok: AdminGroup;
  nama_kategori: string;
  deskripsi: string;
  aktif: string;
}

export interface KategoriKaryaRecord {
  id: string;
  nama_kategori: string;
  deskripsi: string;
  aktif: string;
}

export interface AktivitasRecord {
  id: string;
  waktu: string;
  pengguna: string;
  role: string;
  aksi: string;
  modul: string;
  judul_item: string;
  keterangan: string;
}

export interface PengaturanRecord {
  id: string;
  kunci: string;
  nilai: string;
  deskripsi: string;
}

export interface WorkspaceFolders {
  rootId: string;
  administrasiRootId: string;
  perencanaanId: string;
  penilaianId: string;
  adminGuruId: string;
  dokumentasiId: string;
  karyaRootId: string;
  karyaViiId: string;
  karyaViiiId: string;
  karyaIxId: string;
  portofolioId: string;
  laporanId: string;
  backupId: string;
}

export interface WorkspaceBootstrapData {
  connected: boolean;
  spreadsheetId: string;
  spreadsheetUrl: string;
  rootFolderId: string;
  rootFolderUrl: string;
  role: UserRole;
  userEmail: string;
  userName: string;
  folders: WorkspaceFolders;
  identitas: IdentitasWebsite;
  kelas: KelasRecord[];
  siswa: SiswaRecord[];
  administrasi: AdministrasiRecord[];
  dokumentasi: DokumentasiRecord[];
  karya: KaryaSiswaRecord[];
  kategoriDokumen: KategoriDokumenRecord[];
  kategoriKarya: KategoriKaryaRecord[];
  aktivitas: AktivitasRecord[];
  pengaturan: PengaturanRecord[];
  users: UserRecord[];
}

export const ALLOWED_FILE_EXTENSIONS = [
  'pdf',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'ppt',
  'pptx',
  'jpg',
  'jpeg',
  'png',
] as const;

export const ALLOWED_IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png'] as const;

export const SHEET_HEADERS: Record<string, string[]> = {
  USERS: ['id', 'email', 'nama', 'role', 'kelas', 'status', 'dibuat_pada', 'terakhir_login'],
  IDENTITAS_WEBSITE: [
    'id',
    'nama_website',
    'tagline',
    'logo_url',
    'logo_file_id',
    'nama_guru',
    'nip_guru',
    'email_guru',
    'nama_sekolah',
    'tahun_ajaran_aktif',
    'semester_aktif',
  ],
  KELAS: ['id', 'nama_kelas', 'tingkat', 'wali_kelas', 'tahun_ajaran', 'jumlah_siswa', 'keterangan'],
  DATA_SISWA: [
    'id',
    'nis',
    'nama_siswa',
    'kelas',
    'jenis_kelamin',
    'email',
    'foto_url',
    'tahun_ajaran',
    'status',
  ],
  ADMINISTRASI: [
    'id',
    'judul',
    'kategori_utama',
    'sub_kategori',
    'kelas',
    'semester',
    'tahun_ajaran',
    'nama_file',
    'format_file',
    'ukuran_file',
    'pemilik',
    'tanggal_upload',
    'drive_file_id',
    'drive_url',
    'status_publikasi',
    'keterangan',
  ],
  KARYA_SISWA: [
    'id',
    'judul_karya',
    'nama_siswa',
    'nis_siswa',
    'kelas',
    'tahun_ajaran',
    'semester',
    'kategori_seni',
    'deskripsi_karya',
    'teknik_berkarya',
    'media_bahan',
    'tanggal_pengumpulan',
    'nama_file',
    'format_file',
    'ukuran_file',
    'drive_file_id',
    'drive_url',
    'status_publikasi',
    'apresiasi_count',
    'pengunggah',
  ],
  DOKUMENTASI: [
    'id',
    'judul',
    'sub_kategori',
    'kelas',
    'semester',
    'tahun_ajaran',
    'tanggal_kegiatan',
    'deskripsi',
    'nama_file',
    'format_file',
    'ukuran_file',
    'pemilik',
    'tanggal_upload',
    'drive_file_id',
    'drive_url',
    'status_publikasi',
  ],
  KATEGORI_DOKUMEN: ['id', 'kelompok', 'nama_kategori', 'deskripsi', 'aktif'],
  KATEGORI_KARYA: ['id', 'nama_kategori', 'deskripsi', 'aktif'],
  AKTIVITAS: ['id', 'waktu', 'pengguna', 'role', 'aksi', 'modul', 'judul_item', 'keterangan'],
  PENGATURAN: ['id', 'kunci', 'nilai', 'deskripsi'],
};

export const DEFAULT_KATEGORI_DOKUMEN: Array<{ kelompok: AdminGroup; nama: string; deskripsi: string }> = [
  // Perencanaan Pembelajaran
  { kelompok: 'Perencanaan Pembelajaran', nama: 'Capaian Pembelajaran (CP)', deskripsi: 'Dokumen CP fase D Seni Budaya SMP' },
  { kelompok: 'Perencanaan Pembelajaran', nama: 'Alur Tujuan Pembelajaran (ATP)', deskripsi: 'Alur penyusunan tujuan pembelajaran per fase' },
  { kelompok: 'Perencanaan Pembelajaran', nama: 'Program Tahunan (PROTA)', deskripsi: 'Rencana alokasi waktu pembelajaran satu tahun' },
  { kelompok: 'Perencanaan Pembelajaran', nama: 'Program Semester (PROMES)', deskripsi: 'Penjabaran program tahunan per semester' },
  { kelompok: 'Perencanaan Pembelajaran', nama: 'Modul Ajar', deskripsi: 'Modul ajar Kurikulum Merdeka Seni Budaya' },
  { kelompok: 'Perencanaan Pembelajaran', nama: 'Rencana Pelaksanaan Pembelajaran', deskripsi: 'RPP pertemuan tatap muka dan praktik' },
  { kelompok: 'Perencanaan Pembelajaran', nama: 'Tujuan Pembelajaran', deskripsi: 'Rumusan kompetensi dan lingkup materi' },
  { kelompok: 'Perencanaan Pembelajaran', nama: 'Bahan Ajar', deskripsi: 'Materi ajar, presentasi, dan referensi seni' },
  { kelompok: 'Perencanaan Pembelajaran', nama: 'LKPD', deskripsi: 'Lembar Kerja Peserta Didik praktik dan teori' },
  // Administrasi Penilaian
  { kelompok: 'Administrasi Penilaian', nama: 'Kisi-kisi soal', deskripsi: 'Pemetaan indikator dan level kognitif soal' },
  { kelompok: 'Administrasi Penilaian', nama: 'Bank soal', deskripsi: 'Kumpulan butir soal harian, PTS, dan PAS' },
  { kelompok: 'Administrasi Penilaian', nama: 'Soal penilaian harian', deskripsi: 'Naskah evaluasi formatif bab pembelajaran' },
  { kelompok: 'Administrasi Penilaian', nama: 'Soal sumatif', deskripsi: 'Naskah penilaian tengah dan akhir semester' },
  { kelompok: 'Administrasi Penilaian', nama: 'Rubrik penilaian', deskripsi: 'Kriteria penilaian karya praktik dan apresiasi' },
  { kelompok: 'Administrasi Penilaian', nama: 'Daftar nilai', deskripsi: 'Rekap nilai pengetahuan dan keterampilan siswa' },
  { kelompok: 'Administrasi Penilaian', nama: 'Rekap hasil belajar', deskripsi: 'Laporan capaian kompetensi per kelas' },
  { kelompok: 'Administrasi Penilaian', nama: 'Analisis hasil belajar', deskripsi: 'Analisis ketuntasan, remedial, dan pengayaan' },
  // Administrasi Guru
  { kelompok: 'Administrasi Guru', nama: 'Kalender pendidikan', deskripsi: 'Kalender akademik sekolah dan hari efektif' },
  { kelompok: 'Administrasi Guru', nama: 'Jadwal mengajar', deskripsi: 'Pembagian jam tatap muka per kelas' },
  { kelompok: 'Administrasi Guru', nama: 'Jurnal mengajar', deskripsi: 'Catatan harian pelaksanaan pembelajaran' },
  { kelompok: 'Administrasi Guru', nama: 'Daftar hadir siswa', deskripsi: 'Rekap presensi kehadiran peserta didik' },
  { kelompok: 'Administrasi Guru', nama: 'Agenda kegiatan', deskripsi: 'Jadwal agenda pembelajaran dan kegiatan seni' },
  { kelompok: 'Administrasi Guru', nama: 'Catatan pembinaan', deskripsi: 'Log pembimbingan siswa dan ekstrakurikuler' },
  { kelompok: 'Administrasi Guru', nama: 'Laporan kegiatan pembelajaran', deskripsi: 'Laporan berkala pelaksanaan KBM' },
  { kelompok: 'Administrasi Guru', nama: 'Dokumen supervisi', deskripsi: 'Instrumen dan hasil supervisi akademik' },
  // Dokumentasi Kegiatan
  { kelompok: 'Dokumentasi Kegiatan', nama: 'Praktik berkarya seni', deskripsi: 'Foto dan laporan proses berkarya di kelas' },
  { kelompok: 'Dokumentasi Kegiatan', nama: 'Pameran seni', deskripsi: 'Dokumentasi pameran karya seni sekolah' },
  { kelompok: 'Dokumentasi Kegiatan', nama: 'Kegiatan apresiasi seni', deskripsi: 'Kunjungan galeri dan diskusi kritik seni' },
  { kelompok: 'Dokumentasi Kegiatan', nama: 'Proyek kelompok', deskripsi: 'Dokumentasi Proyek Penguatan Profil Pelajar Pancasila' },
  { kelompok: 'Dokumentasi Kegiatan', nama: 'Kegiatan ekstrakurikuler', deskripsi: 'Dokumentasi sanggar seni rupa dan tari/musik' },
  { kelompok: 'Dokumentasi Kegiatan', nama: 'Dokumentasi kegiatan sekolah', deskripsi: 'Kegiatan pentas seni dan hari besar sekolah' },
];

export const DEFAULT_KATEGORI_KARYA: Array<{ nama: string; deskripsi: string }> = [
  { nama: 'Seni Lukis', deskripsi: 'Karya lukisan cat air, akrilik, poster, atau mix media' },
  { nama: 'Seni Gambar', deskripsi: 'Gambar bentuk, ilustrasi, sketsa pensil, dan arsir' },
  { nama: 'Seni Patung', deskripsi: 'Karya tiga dimensi tanah liat, sabun, gips, atau kawat' },
  { nama: 'Seni Grafis', deskripsi: 'Cetak tinggi, cetak saring, cukil lino, dan stensil' },
  { nama: 'Desain Poster', deskripsi: 'Poster edukasi, layanan masyarakat, dan kampanye visual' },
  { nama: 'Tipografi', deskripsi: 'Eksplorasi huruf, kaligrafi kontemporer, dan lettering' },
  { nama: 'Desain Logo', deskripsi: 'Identitas visual, simbol, dan monogram kreatif' },
  { nama: 'Ragam Hias', deskripsi: 'Motif flora, fauna, geometris, dan figuratif Nusantara' },
  { nama: 'Batik', deskripsi: 'Karya batik tulis, cap, ikat celup, dan shibori' },
  { nama: 'Kerajinan', deskripsi: 'Kriya bahan alam, tekstil, serat, dan daur ulang' },
  { nama: 'Karya Seni Digital', deskripsi: 'Ilustrasi vektor, digital painting, dan kolase digital' },
  { nama: 'Karya Seni Lainnya', deskripsi: 'Eksplorasi media campuran dan instalasi kreatif' },
];
