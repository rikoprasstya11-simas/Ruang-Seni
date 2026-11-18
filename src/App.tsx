import { useCallback, useEffect, useState } from 'react';
import {
  Archive,
  BarChart3,
  FileText,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu,
  Palette,
  RefreshCw,
  Settings,
  UserSquare2,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { AdministrasiView } from './components/AdministrasiView';
import { ArsipDigitalView } from './components/ArsipDigitalView';
import { SeniRuangLogo, ToastContainer, type ToastMessage } from './components/CommonUI';
import { DashboardView, type NavSection } from './components/DashboardView';
import { DriveImage } from './components/DriveImage';
import { GaleriKaryaView } from './components/GaleriKaryaView';
import { LandingFrontPage } from './components/LandingFrontPage';
import { LaporanView } from './components/LaporanView';
import { ManajemenKelasView } from './components/ManajemenKelasView';
import { PengaturanView } from './components/PengaturanView';
import { PortofolioSiswaView } from './components/PortofolioSiswaView';
import { WorkspaceSetupView } from './components/WorkspaceSetupView';
import {
  connectExistingWorkspace,
  discoverWorkspace,
  provisionWorkspace,
} from './services/apiClient';
import { googleSignIn, initAuth, logout } from './services/firebaseAuth';
import type { UserRole, WorkspaceBootstrapData } from './types/seniRuang';

interface NavItem {
  id: NavSection;
  label: string;
  icon: typeof LayoutDashboard;
  roles: UserRole[];
}

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['ADMIN'] },
  { id: 'administrasi', label: 'Administrasi Guru', icon: FileText, roles: ['ADMIN'] },
  { id: 'galeri', label: 'Galeri Karya Siswa', icon: Palette, roles: ['ADMIN', 'SISWA', 'PENGUNJUNG'] },
  { id: 'portofolio', label: 'Portofolio Siswa', icon: UserSquare2, roles: ['ADMIN', 'SISWA'] },
  { id: 'arsip', label: 'Arsip Digital', icon: Archive, roles: ['ADMIN'] },
  { id: 'kelas', label: 'Manajemen Kelas', icon: GraduationCap, roles: ['ADMIN'] },
  { id: 'laporan', label: 'Laporan & Rekap', icon: BarChart3, roles: ['ADMIN'] },
  { id: 'pengaturan', label: 'Pengaturan Website', icon: Settings, roles: ['ADMIN'] },
];

export default function App() {
  const [needsAuth, setNeedsAuth] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string>('');
  const [userEmail, setUserEmail] = useState<string>('');
  const [userName, setUserName] = useState<string>('');

  const [workspaceData, setWorkspaceData] = useState<WorkspaceBootstrapData | null>(null);
  const [needsProvision, setNeedsProvision] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [activeSection, setActiveSection] = useState<NavSection>('dashboard');
  const [galleryClassFilter, setGalleryClassFilter] = useState<string>('Semua');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback((type: 'success' | 'error' | 'info', text: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev, { id, type, text }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }, []);

  const loadWorkspace = useCallback(
    async (spreadsheetId?: string, rootFolderId?: string) => {
      setRefreshing(true);
      setAuthError('');
      try {
        const res = await discoverWorkspace(spreadsheetId, rootFolderId);
        if (res.connected) {
          setWorkspaceData(res);
          setNeedsProvision(false);
          if (res.role !== 'ADMIN' && activeSection === 'dashboard') {
            setActiveSection('galeri');
          }
        } else {
          setWorkspaceData(null);
          setNeedsProvision(true);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Gagal memuat data Google Workspace.';
        setAuthError(msg);
        addToast('error', msg);
      } finally {
        setRefreshing(false);
      }
    },
    [activeSection, addToast]
  );

  useEffect(() => {
    const unsub = initAuth(
      (user) => {
        setUserEmail(user.email || '');
        setUserName(user.displayName || user.email?.split('@')[0] || '');
        setNeedsAuth(false);
        loadWorkspace();
      },
      () => {
        setNeedsAuth(true);
        setWorkspaceData(null);
        setNeedsProvision(false);
      }
    );
    return () => unsub();
  }, [loadWorkspace]);

  const handleGoogleLogin = async () => {
    setAuthLoading(true);
    setAuthError('');
    try {
      const result = await googleSignIn();
      setUserEmail(result.user.email || '');
      setUserName(result.user.displayName || result.user.email?.split('@')[0] || '');
      setNeedsAuth(false);
      await loadWorkspace();
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Gagal masuk dengan akun Google. Silakan coba lagi.';
      setAuthError(msg);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    setWorkspaceData(null);
    setNeedsAuth(true);
    setNeedsProvision(false);
    setActiveSection('dashboard');
  };

  const handleProvision = async (payload: {
    namaGuru: string;
    namaSekolah: string;
    tahunAjaran: string;
    semester: string;
  }) => {
    setAuthLoading(true);
    setAuthError('');
    try {
      const created = await provisionWorkspace({ ...payload, namaUser: userName });
      setWorkspaceData(created);
      setNeedsProvision(false);
      setActiveSection('dashboard');
      addToast('success', 'Folder Google Drive dan 11 Sheet Database berhasil dibuat otomatis!');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal menyiapkan Google Workspace.';
      setAuthError(msg);
      addToast('error', msg);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleConnectExisting = async (payload: {
    spreadsheetId: string;
    rootFolderId?: string;
    gasWebAppUrl?: string;
  }) => {
    setAuthLoading(true);
    setAuthError('');
    try {
      const connected = await connectExistingWorkspace(payload);
      setWorkspaceData(connected);
      setNeedsProvision(false);
      setActiveSection(connected.role === 'ADMIN' ? 'dashboard' : 'galeri');
      addToast('success', 'Berhasil terhubung ke Google Spreadsheet dan Drive.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal menghubungkan Spreadsheet.';
      setAuthError(msg);
      addToast('error', msg);
    } finally {
      setAuthLoading(false);
    }
  };

  // Unauthenticated Front Page (Karya Terbaru + Unggah Tugas Siswa + Login Guru)
  if (needsAuth) {
    return (
      <>
        <LandingFrontPage
          authLoading={authLoading}
          authError={authError}
          onGoogleLogin={handleGoogleLogin}
          onToast={addToast}
        />
        <ToastContainer
          toasts={toasts}
          onDismiss={(id) => setToasts((p) => p.filter((t) => t.id !== id))}
        />
      </>
    );
  }

  // Signed in, loading workspace discovery or needs setup
  if (needsProvision || !workspaceData) {
    return (
      <>
        {refreshing && !needsProvision ? (
          <div className="min-h-screen flex flex-col items-center justify-center bg-white gap-3">
            <SeniRuangLogo size={44} />
            <p className="text-sm font-medium text-slate-600">
              Menghubungkan ke Google Drive & Google Sheets...
            </p>
          </div>
        ) : (
          <WorkspaceSetupView
            mode="provision"
            userEmail={userEmail}
            userName={userName}
            loading={authLoading}
            error={authError}
            onGoogleLogin={handleGoogleLogin}
            onLogout={handleLogout}
            onProvision={handleProvision}
            onConnectExisting={handleConnectExisting}
          />
        )}
        <ToastContainer
          toasts={toasts}
          onDismiss={(id) => setToasts((p) => p.filter((t) => t.id !== id))}
        />
      </>
    );
  }

  const visibleNavItems = NAV_ITEMS.filter((item) => item.roles.includes(workspaceData.role));
  const currentNav = visibleNavItems.find((i) => i.id === activeSection) || visibleNavItems[0];

  const handleNavigate = (section: NavSection) => {
    setGalleryClassFilter('Semua');
    setActiveSection(section);
    setMobileMenuOpen(false);
  };

  const renderSidebarContent = () => (
    <div className="flex h-full flex-col justify-between bg-white px-4 py-5">
      <div>
        <div className="flex items-center gap-3 px-2 pb-6">
          {workspaceData.identitas.logo_file_id ? (
            <div className="h-9 w-9 overflow-hidden rounded-xl border border-slate-200 bg-white shrink-0">
              <DriveImage
                fileId={workspaceData.identitas.logo_file_id}
                fallbackUrl={workspaceData.identitas.logo_url}
                alt={workspaceData.identitas.nama_website}
                className="h-full w-full object-contain p-0.5"
              />
            </div>
          ) : (
            <SeniRuangLogo size={36} />
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-bold tracking-tight text-slate-900">
              {workspaceData.identitas.nama_website || 'SENI RUANG'}
            </p>
            <p className="truncate text-[11px] text-slate-500">
              {workspaceData.identitas.nama_sekolah}
            </p>
          </div>
        </div>

        <nav className="space-y-1" aria-label="Navigasi Utama">
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const active = currentNav.id === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavigate(item.id)}
                className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors ${
                  active
                    ? 'bg-teal-50 text-teal-800 font-semibold'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <Icon className={`h-4.5 w-4.5 shrink-0 ${active ? 'text-teal-700' : 'text-slate-400'}`} />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      <div className="border-t border-slate-100 pt-4 space-y-3">
        <div className="px-2">
          <p className="truncate text-xs font-semibold text-slate-900">{workspaceData.userName}</p>
          <p className="truncate text-[11px] text-slate-500">{workspaceData.userEmail}</p>
          <p className="mt-1 text-[11px] font-semibold text-teal-700">
            Peran: {workspaceData.role}
          </p>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
        >
          <LogOut className="h-3.5 w-3.5" />
          Keluar Akun
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50/60 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-[260px] shrink-0 border-r border-slate-200/80 bg-white sticky top-0 h-screen">
        {renderSidebarContent()}
      </aside>

      {/* Mobile Sidebar Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-slate-900/40"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative z-10 w-[260px] max-w-[80vw] h-full border-r border-slate-200 bg-white shadow-xl">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              className="absolute right-3 top-4 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
              aria-label="Tutup menu"
            >
              <X className="h-5 w-5" />
            </button>
            {renderSidebarContent()}
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 backdrop-blur-xs px-4 py-3.5 sm:px-8">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                className="rounded-xl border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 lg:hidden"
                aria-label="Buka navigasi"
              >
                <Menu className="h-5 w-5" />
              </button>
              <div className="min-w-0">
                <h1 className="truncate text-base font-bold text-slate-900 sm:text-lg">
                  {currentNav.label}
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              <button
                type="button"
                disabled={refreshing}
                onClick={() =>
                  loadWorkspace(workspaceData.spreadsheetId, workspaceData.rootFolderId)
                }
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 whitespace-nowrap"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin text-teal-600' : ''}`} />
                Sinkronkan
              </button>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1280px] flex-1 px-4 py-6 sm:px-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentNav.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.16 }}
            >
              {currentNav.id === 'dashboard' && (
                <DashboardView data={workspaceData} onNavigate={handleNavigate} />
              )}
              {currentNav.id === 'administrasi' && (
                <AdministrasiView
                  data={workspaceData}
                  onRefresh={() =>
                    loadWorkspace(workspaceData.spreadsheetId, workspaceData.rootFolderId)
                  }
                  onToast={addToast}
                />
              )}
              {currentNav.id === 'galeri' && (
                <GaleriKaryaView
                  data={workspaceData}
                  initialFilterKelas={galleryClassFilter}
                  onRefresh={() =>
                    loadWorkspace(workspaceData.spreadsheetId, workspaceData.rootFolderId)
                  }
                  onToast={addToast}
                />
              )}
              {currentNav.id === 'portofolio' && (
                <PortofolioSiswaView data={workspaceData} onToast={addToast} />
              )}
              {currentNav.id === 'arsip' && (
                <ArsipDigitalView data={workspaceData} onToast={addToast} />
              )}
              {currentNav.id === 'kelas' && (
                <ManajemenKelasView
                  data={workspaceData}
                  onOpenClassGallery={(kelasName) => {
                    setGalleryClassFilter(kelasName);
                    setActiveSection('galeri');
                  }}
                  onRefresh={() =>
                    loadWorkspace(workspaceData.spreadsheetId, workspaceData.rootFolderId)
                  }
                  onToast={addToast}
                />
              )}
              {currentNav.id === 'laporan' && (
                <LaporanView data={workspaceData} onToast={addToast} />
              )}
              {currentNav.id === 'pengaturan' && (
                <PengaturanView
                  data={workspaceData}
                  onRefresh={() =>
                    loadWorkspace(workspaceData.spreadsheetId, workspaceData.rootFolderId)
                  }
                  onToast={addToast}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      <ToastContainer
        toasts={toasts}
        onDismiss={(id) => setToasts((p) => p.filter((t) => t.id !== id))}
      />
    </div>
  );
}
