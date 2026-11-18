import { useMemo, useState } from 'react';
import { ChevronRight, Download, Palette, Search, User } from 'lucide-react';
import { downloadDriveFile } from '../services/apiClient';
import type { KaryaSiswaRecord, WorkspaceBootstrapData } from '../types/seniRuang';
import { ModalShell } from './CommonUI';
import { DriveImage } from './DriveImage';

interface StudentPortfolioSummary {
  key: string;
  nama: string;
  kelas: string;
  nis: string;
  fotoUrl: string;
  karyaList: KaryaSiswaRecord[];
  years: string[];
}

export function PortofolioSiswaView({
  data,
  onToast,
}: {
  data: WorkspaceBootstrapData;
  onToast: (type: 'success' | 'error' | 'info', text: string) => void;
}) {
  const [search, setSearch] = useState('');
  const [filterKelas, setFilterKelas] = useState('Semua');
  const [selectedStudent, setSelectedStudent] = useState<StudentPortfolioSummary | null>(null);

  const portfolios = useMemo(() => {
    const map = new Map<string, StudentPortfolioSummary>();

    // Seed from DATA_SISWA first
    data.siswa.forEach((s) => {
      const key = `${s.nama_siswa.trim().toLowerCase()}::${s.kelas.trim().toLowerCase()}`;
      map.set(key, {
        key,
        nama: s.nama_siswa,
        kelas: s.kelas,
        nis: s.nis,
        fotoUrl: s.foto_url,
        karyaList: [],
        years: [],
      });
    });

    // Attach works from KARYA_SISWA
    data.karya.forEach((k) => {
      const key = `${k.nama_siswa.trim().toLowerCase()}::${k.kelas.trim().toLowerCase()}`;
      if (!map.has(key)) {
        map.set(key, {
          key,
          nama: k.nama_siswa,
          kelas: k.kelas,
          nis: k.nis_siswa || '-',
          fotoUrl: '',
          karyaList: [],
          years: [],
        });
      }
      const entry = map.get(key)!;
      entry.karyaList.push(k);
      if (k.tahun_ajaran && !entry.years.includes(k.tahun_ajaran)) {
        entry.years.push(k.tahun_ajaran);
      }
    });

    return Array.from(map.values()).sort((a, b) => b.karyaList.length - a.karyaList.length);
  }, [data.siswa, data.karya]);

  const filteredPortfolios = useMemo(() => {
    const q = search.trim().toLowerCase();
    return portfolios.filter((p) => {
      const matchSearch =
        !q || p.nama.toLowerCase().includes(q) || p.nis.toLowerCase().includes(q);
      const matchKelas = filterKelas === 'Semua' || p.kelas === filterKelas;
      return matchSearch && matchKelas;
    });
  }, [portfolios, search, filterKelas]);

  const groupedByYear = useMemo(() => {
    if (!selectedStudent) return [];
    const byYear = new Map<string, KaryaSiswaRecord[]>();
    selectedStudent.karyaList.forEach((k) => {
      const label = `${k.tahun_ajaran || 'Lainnya'} · Semester ${k.semester || '-'}`;
      if (!byYear.has(label)) byYear.set(label, []);
      byYear.get(label)!.push(k);
    });
    return Array.from(byYear.entries());
  }, [selectedStudent]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-slate-900">Portofolio Digital Siswa</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Kumpulan rekam jejak karya dan perkembangan kreativitas peserta didik per tahun ajaran
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200/90 bg-white p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="relative sm:col-span-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama siswa atau NIS..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2 pl-9 pr-3 text-sm focus:border-teal-600 focus:bg-white focus:outline-none"
            />
          </div>
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
        </div>
      </div>

      {filteredPortfolios.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center">
          <User className="mx-auto h-10 w-10 text-slate-300" />
          <h3 className="mt-3 text-base font-semibold text-slate-900">
            Belum ada portofolio siswa
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            Tambahkan daftar siswa di Manajemen Kelas atau unggah karya di Galeri Karya Siswa.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {filteredPortfolios.map((student) => (
            <button
              key={student.key}
              type="button"
              onClick={() => setSelectedStudent(student)}
              className="group flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-5 text-left transition-colors hover:border-teal-400"
            >
              <div>
                <div className="flex items-center gap-3.5">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-base font-bold text-teal-700">
                    {student.nama.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-base font-semibold text-slate-900 group-hover:text-teal-700">
                      {student.nama}
                    </h3>
                    <p className="text-xs text-slate-500">
                      <span>Kelas {student.kelas}</span>
                      {student.nis && student.nis !== '-' && (
                        <>
                          <span className="mx-1.5">·</span>
                          <span className="font-mono tabular-nums">NIS {student.nis}</span>
                        </>
                      )}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-teal-600 shrink-0" />
                </div>

                {student.karyaList.length > 0 && (
                  <div className="mt-4 grid grid-cols-3 gap-2">
                    {student.karyaList.slice(0, 3).map((k) => (
                      <div
                        key={k.id}
                        className="aspect-square overflow-hidden rounded-lg border border-slate-100 bg-slate-50"
                      >
                        <DriveImage
                          fileId={k.drive_file_id}
                          fallbackUrl={k.drive_url}
                          alt={k.judul_karya}
                          className="h-full w-full object-cover"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-600">
                <span className="font-semibold text-teal-700 tabular-nums">
                  {student.karyaList.length} karya tersimpan
                </span>
                <span>
                  {student.years.length > 0 ? student.years.join(', ') : 'Belum ada unggahan'}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Full Student Portfolio Timeline Modal */}
      <ModalShell
        open={Boolean(selectedStudent)}
        onClose={() => setSelectedStudent(null)}
        title={`Portofolio: ${selectedStudent?.nama || ''}`}
        subtitle={
          selectedStudent
            ? `Kelas ${selectedStudent.kelas} · ${selectedStudent.karyaList.length} karya terdokumentasi`
            : ''
        }
        maxWidth="max-w-4xl"
      >
        {selectedStudent && (
          <div className="space-y-6">
            {groupedByYear.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 py-10 text-center text-sm text-slate-500">
                Siswa ini belum memiliki karya yang diunggah.
              </div>
            ) : (
              groupedByYear.map(([periodLabel, works]) => (
                <section key={periodLabel} className="space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <h4 className="text-sm font-bold text-slate-900">{periodLabel}</h4>
                    <span className="font-mono text-xs text-slate-500 tabular-nums">
                      {works.length} karya
                    </span>
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {works.map((work) => (
                      <div
                        key={work.id}
                        className="flex gap-3.5 rounded-xl border border-slate-200 p-3"
                      >
                        <div className="h-24 w-24 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                          <DriveImage
                            fileId={work.drive_file_id}
                            fallbackUrl={work.drive_url}
                            alt={work.judul_karya}
                            className="h-full w-full object-cover"
                          />
                        </div>
                        <div className="min-w-0 flex-1 flex flex-col justify-between">
                          <div>
                            <p className="text-xs font-medium text-teal-700 flex items-center gap-1">
                              <Palette className="h-3 w-3" />
                              {work.kategori_seni}
                            </p>
                            <h5 className="mt-0.5 truncate text-sm font-semibold text-slate-900">
                              {work.judul_karya}
                            </h5>
                            <p className="mt-0.5 text-xs text-slate-500 line-clamp-2">
                              {work.teknik_berkarya} · {work.media_bahan}
                            </p>
                          </div>
                          <div className="flex items-center justify-between pt-2">
                            <span className="font-mono text-[11px] text-slate-400 tabular-nums">
                              {work.tanggal_pengumpulan}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                downloadDriveFile(work.drive_file_id, work.nama_file).catch((e) =>
                                  onToast('error', e.message)
                                )
                              }
                              className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 hover:text-teal-900"
                            >
                              <Download className="h-3.5 w-3.5" />
                              Unduh
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ))
            )}
          </div>
        )}
      </ModalShell>
    </div>
  );
}
