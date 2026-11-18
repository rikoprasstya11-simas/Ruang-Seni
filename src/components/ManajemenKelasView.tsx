import { useMemo, useState } from 'react';
import {
  Download,
  Edit3,
  FileSpreadsheet,
  GraduationCap,
  Palette,
  Plus,
  Search,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import {
  appendSheetRow,
  batchImportStudents,
  deleteArchivePermanent,
  updateSheetRow,
} from '../services/apiClient';
import type { KelasRecord, SiswaRecord, WorkspaceBootstrapData } from '../types/seniRuang';
import { ConfirmDialog, ModalShell } from './CommonUI';

interface ManajemenKelasViewProps {
  data: WorkspaceBootstrapData;
  onOpenClassGallery: (kelasName: string) => void;
  onRefresh: () => Promise<void>;
  onToast: (type: 'success' | 'error' | 'info', text: string) => void;
}

export function ManajemenKelasView({
  data,
  onOpenClassGallery,
  onRefresh,
  onToast,
}: ManajemenKelasViewProps) {
  const [tingkatTab, setTingkatTab] = useState<'Semua' | 'VII' | 'VIII' | 'IX'>('Semua');
  const [search, setSearch] = useState('');
  const [selectedKelas, setSelectedKelas] = useState<KelasRecord | null>(null);

  // Add/Edit Class
  const [kelasModalOpen, setKelasModalOpen] = useState(false);
  const [editingKelas, setEditingKelas] = useState<KelasRecord | null>(null);
  const [namaKelasInput, setNamaKelasInput] = useState('');
  const [tingkatInput, setTingkatInput] = useState<'VII' | 'VIII' | 'IX'>('VII');
  const [waliKelasInput, setWaliKelasInput] = useState('');
  const [keteranganKelasInput, setKeteranganKelasInput] = useState('');
  const [confirmSaveKelasOpen, setConfirmSaveKelasOpen] = useState(false);
  const [savingKelas, setSavingKelas] = useState(false);

  // Delete Class
  const [deleteKelasTarget, setDeleteKelasTarget] = useState<KelasRecord | null>(null);
  const [deletingKelas, setDeletingKelas] = useState(false);

  // Add Student
  const [siswaModalOpen, setSiswaModalOpen] = useState(false);
  const [nis, setNis] = useState('');
  const [namaSiswa, setNamaSiswa] = useState('');
  const [siswaKelas, setSiswaKelas] = useState(data.kelas[0]?.nama_kelas || 'VII.1');
  const [jenisKelamin, setJenisKelamin] = useState('Laki-laki');
  const [emailSiswa, setEmailSiswa] = useState('');
  const [savingSiswa, setSavingSiswa] = useState(false);

  // Delete Student
  const [deleteSiswaTarget, setDeleteSiswaTarget] = useState<SiswaRecord | null>(null);
  const [deletingSiswa, setDeletingSiswa] = useState(false);

  // Excel/CSV Import
  const [importOpen, setImportOpen] = useState(false);
  const [parsedImportRows, setParsedImportRows] = useState<Array<Record<string, string>>>([]);
  const [importing, setImporting] = useState(false);

  const studentCounts = useMemo(() => {
    const map = new Map<string, number>();
    data.siswa.forEach((s) => {
      map.set(s.kelas, (map.get(s.kelas) || 0) + 1);
    });
    return map;
  }, [data.siswa]);

  const karyaCounts = useMemo(() => {
    const map = new Map<string, number>();
    data.karya.forEach((k) => {
      map.set(k.kelas, (map.get(k.kelas) || 0) + 1);
    });
    return map;
  }, [data.karya]);

  const filteredKelas = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.kelas.filter((k) => {
      const matchTingkat = tingkatTab === 'Semua' || k.tingkat === tingkatTab;
      const matchSearch =
        !q ||
        k.nama_kelas.toLowerCase().includes(q) ||
        k.wali_kelas.toLowerCase().includes(q);
      return matchTingkat && matchSearch;
    });
  }, [data.kelas, tingkatTab, search]);

  const studentsInSelectedClass = useMemo(() => {
    if (!selectedKelas) return [];
    return data.siswa.filter((s) => s.kelas === selectedKelas.nama_kelas);
  }, [data.siswa, selectedKelas]);

  const openAddKelas = () => {
    setEditingKelas(null);
    setNamaKelasInput('');
    setTingkatInput('VII');
    setWaliKelasInput('');
    setKeteranganKelasInput('');
    setKelasModalOpen(true);
  };

  const openEditKelas = (k: KelasRecord) => {
    setEditingKelas(k);
    setNamaKelasInput(k.nama_kelas);
    setTingkatInput(k.tingkat);
    setWaliKelasInput(k.wali_kelas);
    setKeteranganKelasInput(k.keterangan);
    setKelasModalOpen(true);
  };

  const handleSaveKelas = async () => {
    setSavingKelas(true);
    try {
      if (editingKelas) {
        await updateSheetRow('KELAS', data.spreadsheetId, editingKelas.id, {
          nama_kelas: namaKelasInput.trim(),
          tingkat: tingkatInput,
          wali_kelas: waliKelasInput.trim() || '-',
          keterangan: keteranganKelasInput.trim(),
        });
        onToast('success', `Kelas ${namaKelasInput} berhasil diperbarui.`);
      } else {
        await appendSheetRow('KELAS', data.spreadsheetId, {
          nama_kelas: namaKelasInput.trim(),
          tingkat: tingkatInput,
          wali_kelas: waliKelasInput.trim() || '-',
          tahun_ajaran: data.identitas.tahun_ajaran_aktif || '2026/2027',
          jumlah_siswa: '0',
          keterangan: keteranganKelasInput.trim() || `Kelas ${namaKelasInput.trim()}`,
        });
        onToast('success', `Kelas ${namaKelasInput} berhasil ditambahkan.`);
      }
      setConfirmSaveKelasOpen(false);
      setKelasModalOpen(false);
      await onRefresh();
    } catch (err) {
      onToast('error', err instanceof Error ? err.message : 'Gagal menyimpan kelas.');
    } finally {
      setSavingKelas(false);
    }
  };

  const handleDeleteKelas = async () => {
    if (!deleteKelasTarget) return;
    setDeletingKelas(true);
    try {
      await deleteArchivePermanent('KELAS', data.spreadsheetId, deleteKelasTarget.id);
      onToast('success', `Kelas ${deleteKelasTarget.nama_kelas} berhasil dihapus.`);
      if (selectedKelas?.id === deleteKelasTarget.id) setSelectedKelas(null);
      setDeleteKelasTarget(null);
      await onRefresh();
    } catch (err) {
      onToast('error', err instanceof Error ? err.message : 'Gagal menghapus kelas.');
    } finally {
      setDeletingKelas(false);
    }
  };

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSiswa(true);
    try {
      await appendSheetRow('DATA_SISWA', data.spreadsheetId, {
        nis: nis.trim(),
        nama_siswa: namaSiswa.trim(),
        kelas: siswaKelas,
        jenis_kelamin: jenisKelamin,
        email: emailSiswa.trim(),
        foto_url: '',
        tahun_ajaran: data.identitas.tahun_ajaran_aktif || '2026/2027',
        status: 'Aktif',
      });
      onToast('success', `Siswa "${namaSiswa.trim()}" ditambahkan ke kelas ${siswaKelas}.`);
      setSiswaModalOpen(false);
      setNis('');
      setNamaSiswa('');
      setEmailSiswa('');
      await onRefresh();
    } catch (err) {
      onToast('error', err instanceof Error ? err.message : 'Gagal menambahkan siswa.');
    } finally {
      setSavingSiswa(false);
    }
  };

  const handleDeleteStudent = async () => {
    if (!deleteSiswaTarget) return;
    setDeletingSiswa(true);
    try {
      await deleteArchivePermanent('DATA_SISWA', data.spreadsheetId, deleteSiswaTarget.id);
      onToast('success', `Data siswa "${deleteSiswaTarget.nama_siswa}" dihapus.`);
      setDeleteSiswaTarget(null);
      await onRefresh();
    } catch (err) {
      onToast('error', err instanceof Error ? err.message : 'Gagal menghapus data siswa.');
    } finally {
      setDeletingSiswa(false);
    }
  };

  const handleDownloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([
      {
        nis: '202607001',
        nama_siswa: 'Alya Putri Ramadhani',
        kelas: selectedKelas?.nama_kelas || 'VII.1',
        jenis_kelamin: 'Perempuan',
        email: 'alya.siswa@smp.belajar.id',
        tahun_ajaran: data.identitas.tahun_ajaran_aktif || '2026/2027',
      },
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'DATA_SISWA');
    XLSX.writeFile(wb, 'Template_Import_Siswa_SENI_RUANG.xlsx');
  };

  const handleParseImportFile = async (file: File | null) => {
    if (!file) return;
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer);
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet);

      const normalized = jsonRows
        .map((row) => {
          const lowerMap: Record<string, string> = {};
          Object.entries(row).forEach(([k, v]) => {
            lowerMap[k.trim().toLowerCase()] = String(v ?? '').trim();
          });
          return {
            nis: lowerMap.nis || lowerMap.nisn || '',
            nama_siswa: lowerMap.nama_siswa || lowerMap.nama || lowerMap['nama siswa'] || '',
            kelas: lowerMap.kelas || selectedKelas?.nama_kelas || 'VII.1',
            jenis_kelamin: lowerMap.jenis_kelamin || lowerMap.jk || lowerMap['jenis kelamin'] || 'L/P',
            email: lowerMap.email || '',
            tahun_ajaran: lowerMap.tahun_ajaran || data.identitas.tahun_ajaran_aktif || '2026/2027',
          };
        })
        .filter((r) => r.nama_siswa !== '');

      if (normalized.length === 0) {
        onToast('error', 'Tidak ada baris siswa valid ditemukan. Pastikan terdapat kolom "nama_siswa".');
        return;
      }
      setParsedImportRows(normalized);
    } catch {
      onToast('error', 'Gagal membaca file Excel/CSV. Pastikan format file valid.');
    }
  };

  const handleExecuteImport = async () => {
    if (parsedImportRows.length === 0) return;
    setImporting(true);
    try {
      const res = await batchImportStudents(data.spreadsheetId, parsedImportRows);
      onToast('success', `${res.importedCount} data siswa berhasil diimpor ke Google Sheets.`);
      setParsedImportRows([]);
      setImportOpen(false);
      await onRefresh();
    } catch (err) {
      onToast('error', err instanceof Error ? err.message : 'Gagal mengimpor siswa.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Manajemen Kelas & Data Siswa</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {data.kelas.length} kelas aktif · {data.siswa.length} peserta didik terdaftar di Google Sheets
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setImportOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-teal-200 bg-teal-50 px-3.5 py-2 text-xs font-semibold text-teal-800 hover:bg-teal-100 transition-colors whitespace-nowrap"
          >
            <FileSpreadsheet className="h-4 w-4" />
            Import Excel / CSV
          </button>
          <button
            type="button"
            onClick={() => {
              setSiswaKelas(selectedKelas?.nama_kelas || data.kelas[0]?.nama_kelas || 'VII.1');
              setSiswaModalOpen(true);
            }}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap"
          >
            <UserPlus className="h-4 w-4" />
            Tambah Siswa
          </button>
          <button
            type="button"
            onClick={openAddKelas}
            className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-700 transition-colors whitespace-nowrap"
          >
            <Plus className="h-4 w-4" />
            Tambah Kelas
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/90 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-1.5 rounded-xl bg-slate-100 p-1">
          {(['Semua', 'VII', 'VIII', 'IX'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTingkatTab(t)}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                tingkatTab === t ? 'bg-white text-teal-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {t === 'Semua' ? 'Semua Tingkat' : `Kelas ${t}`}
            </button>
          ))}
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari kelas atau wali kelas..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2 pl-9 pr-3 text-sm focus:border-teal-600 focus:bg-white focus:outline-none"
          />
        </div>
      </div>

      {/* Class Cards Grid + Student Detail Split */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className={selectedKelas ? 'lg:col-span-7' : 'lg:col-span-12'}>
          <div
            className={`grid grid-cols-1 gap-4 sm:grid-cols-2 ${
              selectedKelas ? 'xl:grid-cols-2' : 'lg:grid-cols-3 xl:grid-cols-4'
            }`}
          >
            {filteredKelas.map((k) => {
              const sCount = studentCounts.get(k.nama_kelas) || 0;
              const kCount = karyaCounts.get(k.nama_kelas) || 0;
              const isSelected = selectedKelas?.id === k.id;
              return (
                <div
                  key={k.id}
                  className={`flex flex-col justify-between rounded-2xl border p-4 transition-colors ${
                    isSelected
                      ? 'border-teal-500 bg-teal-50/30'
                      : 'border-slate-200/90 bg-white hover:border-teal-300'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between">
                      <button
                        type="button"
                        onClick={() => setSelectedKelas(k)}
                        className="text-left"
                      >
                        <p className="text-xs font-medium text-teal-700">Tingkat {k.tingkat}</p>
                        <h3 className="text-lg font-bold text-slate-900">Kelas {k.nama_kelas}</h3>
                      </button>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEditKelas(k)}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                          title="Edit Kelas"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteKelasTarget(k)}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                          title="Hapus Kelas"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    <p className="mt-1 text-xs text-slate-500 truncate">
                      Wali Kelas: {k.wali_kelas || '-'}
                    </p>
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs">
                    <button
                      type="button"
                      onClick={() => setSelectedKelas(k)}
                      className="inline-flex items-center gap-1.5 font-semibold text-slate-700 hover:text-teal-700 tabular-nums"
                    >
                      <Users className="h-3.5 w-3.5 text-teal-600" />
                      {sCount} siswa
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpenClassGallery(k.nama_kelas)}
                      className="inline-flex items-center gap-1.5 font-semibold text-teal-700 hover:text-teal-900 tabular-nums"
                    >
                      <Palette className="h-3.5 w-3.5" />
                      {kCount} karya
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected Class Roster Panel */}
        {selectedKelas && (
          <div className="rounded-2xl border border-slate-200/90 bg-white p-5 lg:col-span-5 h-fit sticky top-20">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Daftar Siswa Kelas {selectedKelas.nama_kelas}
                </h3>
                <p className="text-xs text-slate-500">
                  {studentsInSelectedClass.length} siswa terdaftar · {karyaCounts.get(selectedKelas.nama_kelas) || 0} karya
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedKelas(null)}
                className="text-xs font-medium text-slate-500 hover:text-slate-900"
              >
                Tutup
              </button>
            </div>

            {studentsInSelectedClass.length === 0 ? (
              <div className="py-10 text-center text-sm text-slate-500">
                <GraduationCap className="mx-auto h-8 w-8 text-slate-300" />
                <p className="mt-2">Belum ada siswa pada kelas ini.</p>
                <button
                  type="button"
                  onClick={() => {
                    setSiswaKelas(selectedKelas.nama_kelas);
                    setSiswaModalOpen(true);
                  }}
                  className="mt-3 text-xs font-semibold text-teal-700 hover:underline"
                >
                  + Tambah Siswa ke {selectedKelas.nama_kelas}
                </button>
              </div>
            ) : (
              <div className="mt-3 max-h-[55vh] divide-y divide-slate-100 overflow-y-auto">
                {studentsInSelectedClass.map((student) => (
                  <div key={student.id} className="flex items-center justify-between py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">
                        {student.nama_siswa}
                      </p>
                      <p className="text-xs text-slate-500">
                        <span className="font-mono tabular-nums">{student.nis || '-'}</span>
                        <span className="mx-1.5">·</span>
                        <span>{student.jenis_kelamin}</span>
                        {student.email && (
                          <>
                            <span className="mx-1.5">·</span>
                            <span>{student.email}</span>
                          </>
                        )}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDeleteSiswaTarget(student)}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 shrink-0"
                      title="Hapus Siswa"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add/Edit Kelas Modal */}
      <ModalShell
        open={kelasModalOpen}
        onClose={() => setKelasModalOpen(false)}
        title={editingKelas ? `Edit Kelas ${editingKelas.nama_kelas}` : 'Tambah Kelas Baru'}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setConfirmSaveKelasOpen(true);
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700">Nama Kelas</label>
              <input
                type="text"
                required
                value={namaKelasInput}
                onChange={(e) => setNamaKelasInput(e.target.value)}
                placeholder="Contoh: VII.12"
                className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm focus:border-teal-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">Tingkat</label>
              <select
                value={tingkatInput}
                onChange={(e) => setTingkatInput(e.target.value as 'VII' | 'VIII' | 'IX')}
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm focus:border-teal-600 focus:outline-none"
              >
                <option value="VII">VII</option>
                <option value="VIII">VIII</option>
                <option value="IX">IX</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700">Wali Kelas</label>
            <input
              type="text"
              value={waliKelasInput}
              onChange={(e) => setWaliKelasInput(e.target.value)}
              placeholder="Nama wali kelas"
              className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm focus:border-teal-600 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700">Keterangan</label>
            <input
              type="text"
              value={keteranganKelasInput}
              onChange={(e) => setKeteranganKelasInput(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm focus:border-teal-600 focus:outline-none"
            />
          </div>
          <div className="flex justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={() => setKelasModalOpen(false)}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700"
            >
              Batal
            </button>
            <button
              type="submit"
              className="rounded-xl bg-teal-600 px-5 py-2 text-sm font-semibold text-white hover:bg-teal-700"
            >
              Simpan Kelas
            </button>
          </div>
        </form>
      </ModalShell>

      {/* Add Student Modal */}
      <ModalShell
        open={siswaModalOpen}
        onClose={() => setSiswaModalOpen(false)}
        title="Tambah Data Siswa"
      >
        <form onSubmit={handleAddStudent} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700">NIS / NISN</label>
              <input
                type="text"
                value={nis}
                onChange={(e) => setNis(e.target.value)}
                placeholder="Nomor induk"
                className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm focus:border-teal-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">Kelas</label>
              <select
                value={siswaKelas}
                onChange={(e) => setSiswaKelas(e.target.value)}
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
          <div>
            <label className="block text-xs font-semibold text-slate-700">Nama Lengkap Siswa</label>
            <input
              type="text"
              required
              value={namaSiswa}
              onChange={(e) => setNamaSiswa(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm focus:border-teal-600 focus:outline-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700">Jenis Kelamin</label>
              <select
                value={jenisKelamin}
                onChange={(e) => setJenisKelamin(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm focus:border-teal-600 focus:outline-none"
              >
                <option value="Laki-laki">Laki-laki</option>
                <option value="Perempuan">Perempuan</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">Email Google Siswa (Opsional)</label>
              <input
                type="email"
                value={emailSiswa}
                onChange={(e) => setEmailSiswa(e.target.value)}
                placeholder="Untuk akses upload siswa"
                className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm focus:border-teal-600 focus:outline-none"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={() => setSiswaModalOpen(false)}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={savingSiswa}
              className="rounded-xl bg-teal-600 px-5 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-60"
            >
              {savingSiswa ? 'Menyimpan...' : 'Simpan Siswa'}
            </button>
          </div>
        </form>
      </ModalShell>

      {/* Excel/CSV Import Modal */}
      <ModalShell
        open={importOpen}
        onClose={() => !importing && setImportOpen(false)}
        title="Import Data Siswa via Excel / CSV"
        subtitle="Mendukung file .xlsx, .xls, dan .csv dengan kolom nis, nama_siswa, kelas, jenis_kelamin, email"
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-xl border border-teal-100 bg-teal-50/50 p-3.5">
            <p className="text-xs text-teal-900">
              Belum memiliki format kolom? Unduh contoh template Excel terlebih dahulu.
            </p>
            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white border border-teal-200 px-3 py-1.5 text-xs font-semibold text-teal-800 hover:bg-teal-50 shrink-0"
            >
              <Download className="h-3.5 w-3.5" />
              Unduh Template
            </button>
          </div>

          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={(e) => handleParseImportFile(e.target.files?.[0] || null)}
            className="block w-full rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3 text-sm file:mr-4 file:rounded-lg file:border-0 file:bg-teal-600 file:px-3.5 file:py-1.5 file:text-xs file:font-semibold file:text-white"
          />

          {parsedImportRows.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-700">
                Pratinjau Data ({parsedImportRows.length} siswa siap diimpor):
              </p>
              <div className="max-h-52 overflow-auto rounded-xl border border-slate-200">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="px-3 py-2">NIS</th>
                      <th className="px-3 py-2">Nama Siswa</th>
                      <th className="px-3 py-2">Kelas</th>
                      <th className="px-3 py-2">L/P</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {parsedImportRows.slice(0, 20).map((r, i) => (
                      <tr key={i}>
                        <td className="px-3 py-1.5 font-mono">{r.nis}</td>
                        <td className="px-3 py-1.5 font-medium">{r.nama_siswa}</td>
                        <td className="px-3 py-1.5">{r.kelas}</td>
                        <td className="px-3 py-1.5">{r.jenis_kelamin}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2.5 pt-2">
            <button
              type="button"
              disabled={importing}
              onClick={() => setImportOpen(false)}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700"
            >
              Batal
            </button>
            <button
              type="button"
              disabled={importing || parsedImportRows.length === 0}
              onClick={handleExecuteImport}
              className="rounded-xl bg-teal-600 px-5 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
            >
              {importing ? 'Mengimpor ke Sheets...' : `Impor ${parsedImportRows.length} Siswa`}
            </button>
          </div>
        </div>
      </ModalShell>

      <ConfirmDialog
        open={confirmSaveKelasOpen}
        variant="primary"
        title={editingKelas ? 'Perbarui Data Kelas?' : 'Tambahkan Kelas Baru?'}
        description={`Simpan data kelas "${namaKelasInput}" ke Google Sheets?`}
        confirmLabel="Ya, Simpan"
        loading={savingKelas}
        onConfirm={handleSaveKelas}
        onCancel={() => setConfirmSaveKelasOpen(false)}
      />

      <ConfirmDialog
        open={Boolean(deleteKelasTarget)}
        variant="danger"
        title="Hapus Data Kelas?"
        description={`Hapus kelas "${deleteKelasTarget?.nama_kelas}" dari daftar kelas di Google Sheets?`}
        confirmLabel="Hapus Kelas"
        loading={deletingKelas}
        onConfirm={handleDeleteKelas}
        onCancel={() => setDeleteKelasTarget(null)}
      />

      <ConfirmDialog
        open={Boolean(deleteSiswaTarget)}
        variant="danger"
        title="Hapus Data Siswa?"
        description={`Hapus data siswa "${deleteSiswaTarget?.nama_siswa}" dari Google Sheets?`}
        confirmLabel="Hapus Siswa"
        loading={deletingSiswa}
        onConfirm={handleDeleteStudent}
        onCancel={() => setDeleteSiswaTarget(null)}
      />
    </div>
  );
}
