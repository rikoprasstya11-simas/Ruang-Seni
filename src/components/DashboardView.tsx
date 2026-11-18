import { useMemo } from 'react';
import {
  ArrowUpRight,
  BarChart3,
  BookOpen,
  Camera,
  ExternalLink,
  FileText,
  FolderOpen,
  GraduationCap,
  Palette,
  Plus,
  Upload,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { WorkspaceBootstrapData } from '../types/seniRuang';

export type NavSection =
  | 'dashboard'
  | 'administrasi'
  | 'galeri'
  | 'portofolio'
  | 'arsip'
  | 'kelas'
  | 'laporan'
  | 'pengaturan';

interface DashboardViewProps {
  data: WorkspaceBootstrapData;
  onNavigate: (section: NavSection) => void;
}

export function DashboardView({ data, onNavigate }: DashboardViewProps) {
  const totalAdministrasi = data.administrasi.length;
  const totalPerangkat = data.administrasi.filter(
    (a) => a.kategori_utama === 'Perencanaan Pembelajaran'
  ).length;
  const totalKarya = data.karya.length;
  const totalDokumentasi = data.dokumentasi.length;
  const totalKelas = data.kelas.length;

  const karyaByKategori = useMemo(() => {
    const counts = new Map<string, number>();
    data.kategoriKarya.forEach((k) => counts.set(k.nama_kategori, 0));
    data.karya.forEach((item) => {
      const cat = item.kategori_seni || 'Lainnya';
      counts.set(cat, (counts.get(cat) || 0) + 1);
    });
    return Array.from(counts.entries())
      .map(([name, jumlah]) => ({
        name: name.replace('Seni ', '').replace('Desain ', ''),
        fullName: name,
        jumlah,
      }))
      .slice(0, 10);
  }, [data.karya, data.kategoriKarya]);

  const dokumentasiBySemester = useMemo(() => {
    const map = new Map<string, { semester: string; dokumentasi: number; karya: number; administrasi: number }>();
    const ensure = (key: string) => {
      if (!map.has(key)) {
        map.set(key, { semester: key, dokumentasi: 0, karya: 0, administrasi: 0 });
      }
      return map.get(key)!;
    };

    ensure('Ganjil');
    ensure('Genap');

    data.dokumentasi.forEach((d) => {
      const sem = d.semester || 'Ganjil';
      ensure(sem).dokumentasi += 1;
    });
    data.karya.forEach((k) => {
      const sem = k.semester || 'Ganjil';
      ensure(sem).karya += 1;
    });
    data.administrasi.forEach((a) => {
      const sem = a.semester || 'Ganjil';
      ensure(sem).administrasi += 1;
    });

    return Array.from(map.values());
  }, [data.administrasi, data.dokumentasi, data.karya]);

  const stats = [
    {
      label: 'Dokumen Administrasi',
      value: totalAdministrasi,
      sub: 'Perencanaan, Penilaian & Guru',
      icon: FileText,
      target: 'administrasi' as NavSection,
    },
    {
      label: 'Perangkat Pembelajaran',
      value: totalPerangkat,
      sub: 'CP, ATP, Modul Ajar & LKPD',
      icon: BookOpen,
      target: 'administrasi' as NavSection,
    },
    {
      label: 'Karya Siswa',
      value: totalKarya,
      sub: `${data.karya.filter((k) => k.status_publikasi === 'Dipublikasikan' || k.status_publikasi === 'Karya Pilihan').length} dipublikasikan`,
      icon: Palette,
      target: 'galeri' as NavSection,
    },
    {
      label: 'Dokumentasi Kegiatan',
      value: totalDokumentasi,
      sub: 'Praktik, Pameran & Proyek',
      icon: Camera,
      target: 'administrasi' as NavSection,
    },
    {
      label: 'Total Kelas Aktif',
      value: totalKelas,
      sub: `${data.siswa.length} peserta didik terdata`,
      icon: GraduationCap,
      target: 'kelas' as NavSection,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header summary & Workspace quick links */}
      <div className="flex flex-col gap-4 rounded-2xl border border-teal-900/10 bg-gradient-to-r from-teal-50/80 via-emerald-50/40 to-white p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold text-teal-700">
            {data.identitas.nama_sekolah} · Tahun Ajaran {data.identitas.tahun_ajaran_aktif} · Semester {data.identitas.semester_aktif}
          </p>
          <h2 className="mt-1 text-xl font-bold text-slate-900 sm:text-2xl">
            Selamat Datang, {data.userName}
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            {data.identitas.tagline}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {data.rootFolderUrl && (
            <a
              href={data.rootFolderUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:border-teal-300 hover:text-teal-800 transition-colors whitespace-nowrap"
            >
              <FolderOpen className="h-3.5 w-3.5 text-teal-600" />
              Google Drive
              <ExternalLink className="h-3 w-3 text-slate-400" />
            </a>
          )}
          {data.spreadsheetUrl && (
            <a
              href={data.spreadsheetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:border-teal-300 hover:text-teal-800 transition-colors whitespace-nowrap"
            >
              <BarChart3 className="h-3.5 w-3.5 text-teal-600" />
              Google Sheets
              <ExternalLink className="h-3 w-3 text-slate-400" />
            </a>
          )}
        </div>
      </div>

      {/* 5 KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {stats.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.label}
              type="button"
              onClick={() => onNavigate(item.target)}
              className="group flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-5 text-left transition-colors hover:border-teal-400"
            >
              <div className="flex items-center justify-between">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-50 text-teal-700 group-hover:bg-teal-600 group-hover:text-white transition-colors">
                  <Icon className="h-4.5 w-4.5" />
                </span>
                <ArrowUpRight className="h-4 w-4 text-slate-300 group-hover:text-teal-600 transition-colors" />
              </div>
              <div className="mt-4">
                <p className="text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
                  {item.value}
                </p>
                <p className="mt-0.5 text-sm font-semibold text-slate-800">{item.label}</p>
                <p className="mt-0.5 text-xs text-slate-500">{item.sub}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Quick Shortcuts */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-5">
        <h3 className="text-sm font-semibold text-slate-900">Pintasan Menu Utama</h3>
        <div className="mt-3.5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <button
            type="button"
            onClick={() => onNavigate('administrasi')}
            className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-left hover:border-teal-400 hover:bg-teal-50/40 transition-colors"
          >
            <Upload className="h-4 w-4 text-teal-600 shrink-0" />
            <span className="text-xs font-semibold text-slate-800">Unggah Administrasi</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('galeri')}
            className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-left hover:border-teal-400 hover:bg-teal-50/40 transition-colors"
          >
            <Plus className="h-4 w-4 text-teal-600 shrink-0" />
            <span className="text-xs font-semibold text-slate-800">Unggah Karya Siswa</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('kelas')}
            className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-left hover:border-teal-400 hover:bg-teal-50/40 transition-colors"
          >
            <GraduationCap className="h-4 w-4 text-teal-600 shrink-0" />
            <span className="text-xs font-semibold text-slate-800">Kelola Kelas & Siswa</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('laporan')}
            className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-left hover:border-teal-400 hover:bg-teal-50/40 transition-colors"
          >
            <BarChart3 className="h-4 w-4 text-teal-600 shrink-0" />
            <span className="text-xs font-semibold text-slate-800">Ekspor Rekapitulasi</span>
          </button>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="rounded-2xl border border-slate-200/90 bg-white p-6 lg:col-span-7">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                Jumlah Karya Siswa Berdasarkan Kategori
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Distribusi karya terkumpul di Google Sheets
              </p>
            </div>
            <span className="font-mono text-xs font-semibold text-teal-700 tabular-nums">
              {totalKarya} karya
            </span>
          </div>
          <div className="mt-5 h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={karyaByKategori} margin={{ top: 8, right: 12, left: -16, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11, fill: '#475569' }}
                  angle={-20}
                  textAnchor="end"
                  height={48}
                />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#475569' }} />
                <Tooltip
                  contentStyle={{
                    borderRadius: '12px',
                    border: '1px solid #cbd5e1',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="jumlah" name="Jumlah Karya" fill="#0d9488" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/90 bg-white p-6 lg:col-span-5">
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              Dokumentasi & Arsip per Semester
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Perbandingan Ganjil dan Genap
            </p>
          </div>
          <div className="mt-5 h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dokumentasiBySemester} margin={{ top: 8, right: 12, left: -16, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="semester" tick={{ fontSize: 12, fill: '#475569' }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#475569' }} />
                <Tooltip
                  contentStyle={{
                    borderRadius: '12px',
                    border: '1px solid #cbd5e1',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="administrasi" name="Administrasi" fill="#0f766e" radius={[6, 6, 0, 0]} />
                <Bar dataKey="dokumentasi" name="Dokumentasi" fill="#14b8a6" radius={[6, 6, 0, 0]} />
                <Bar dataKey="karya" name="Karya Siswa" fill="#5eead4" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Recent Activity Log */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Aktivitas Pengarsipan Terbaru</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Tercatat otomatis pada sheet AKTIVITAS
            </p>
          </div>
        </div>

        {data.aktivitas.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-slate-200 py-8 text-center text-sm text-slate-500">
            Belum ada aktivitas tercatat. Mulai unggah dokumen atau karya siswa untuk melihat riwayat.
          </div>
        ) : (
          <div className="mt-4 divide-y divide-slate-100">
            {data.aktivitas.slice(0, 8).map((act) => (
              <div key={act.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">
                    {act.judul_item || act.modul}
                  </p>
                  <p className="text-xs text-slate-500">
                    <span>{act.aksi}</span>
                    <span className="mx-1.5">·</span>
                    <span>{act.modul}</span>
                    <span className="mx-1.5">·</span>
                    <span>{act.pengguna}</span>
                  </p>
                </div>
                <span className="font-mono text-xs text-slate-400 tabular-nums shrink-0">
                  {act.waktu ? new Date(act.waktu).toLocaleString('id-ID') : '-'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
