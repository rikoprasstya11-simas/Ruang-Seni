import type { WorkspaceBootstrapData } from '../types/seniRuang';
import { getAccessToken } from './firebaseAuth';

function authHeaders(extra: Record<string, string> = {}): HeadersInit {
  const token = getAccessToken();
  if (!token) {
    throw new Error('Sesi akses Google tidak tersedia. Silakan masuk kembali.');
  }
  return {
    Authorization: `Bearer ${token}`,
    ...extra,
  };
}

async function handleJsonResponse<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `Permintaan gagal (${res.status})`);
  }
  return data as T;
}

export async function discoverWorkspace(
  spreadsheetId?: string,
  rootFolderId?: string
): Promise<WorkspaceBootstrapData | { connected: false; userEmail: string }> {
  const params = new URLSearchParams();
  if (spreadsheetId) params.set('spreadsheetId', spreadsheetId);
  if (rootFolderId) params.set('rootFolderId', rootFolderId);
  const query = params.toString() ? `?${params.toString()}` : '';
  const res = await fetch(`/api/workspace/discover${query}`, {
    headers: authHeaders(),
  });
  return handleJsonResponse(res);
}

export async function provisionWorkspace(payload: {
  namaGuru: string;
  namaSekolah: string;
  tahunAjaran: string;
  semester: string;
  namaUser?: string;
}): Promise<WorkspaceBootstrapData> {
  const res = await fetch('/api/workspace/provision', {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  return handleJsonResponse(res);
}

export async function connectExistingWorkspace(payload: {
  spreadsheetId: string;
  rootFolderId?: string;
  gasWebAppUrl?: string;
}): Promise<WorkspaceBootstrapData> {
  const res = await fetch('/api/workspace/connect', {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  return handleJsonResponse(res);
}

export interface PublicGalleryResponse {
  configured: boolean;
  galeriAktif?: boolean;
  identitas?: Record<string, string> | null;
  kelas?: string[];
  kategoriKarya?: string[];
  karya?: Array<Record<string, string>>;
  error?: string;
}

export async function fetchPublicGallery(gasUrl?: string): Promise<PublicGalleryResponse> {
  const query = gasUrl ? `?gasUrl=${encodeURIComponent(gasUrl)}` : '';
  const res = await fetch(`/api/public/gallery${query}`);
  return res.json();
}

export function uploadStudentWorkPublic(params: {
  file: File;
  gasUrl?: string;
  judul_karya: string;
  nama_siswa: string;
  nis_siswa?: string;
  kelas: string;
  kategori_seni: string;
  teknik_berkarya?: string;
  media_bahan?: string;
  deskripsi_karya?: string;
  onProgress?: (percent: number) => void;
}): Promise<{ ok: boolean; record: Record<string, string> }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/public/student-upload', true);
    xhr.setRequestHeader('Content-Type', 'application/octet-stream');
    xhr.setRequestHeader(
      'X-Student-Meta',
      encodeURIComponent(
        JSON.stringify({
          gasUrl: params.gasUrl || '',
          judul_karya: params.judul_karya,
          nama_siswa: params.nama_siswa,
          nis_siswa: params.nis_siswa || '',
          kelas: params.kelas,
          kategori_seni: params.kategori_seni,
          teknik_berkarya: params.teknik_berkarya || '',
          media_bahan: params.media_bahan || '',
          deskripsi_karya: params.deskripsi_karya || '',
          fileName: params.file.name,
          mimeType: params.file.type || 'image/jpeg',
        })
      )
    );

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && params.onProgress) {
        const pct = Math.min(95, Math.round((event.loaded / event.total) * 100));
        params.onProgress(pct);
      }
    };

    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText || '{}');
        if (xhr.status >= 200 && xhr.status < 300 && data.ok) {
          params.onProgress?.(100);
          resolve(data);
        } else {
          reject(new Error(data.error || `Gagal mengunggah tugas (${xhr.status})`));
        }
      } catch {
        reject(new Error('Respon server tidak valid saat mengirim karya siswa.'));
      }
    };

    xhr.onerror = () => {
      reject(new Error('Koneksi terputus saat mengunggah tugas. Periksa jaringan Anda.'));
    };

    xhr.send(params.file);
  });
}

export function uploadFileWithProgress(params: {
  file: File;
  spreadsheetId: string;
  targetSheet: 'ADMINISTRASI' | 'DOKUMENTASI' | 'KARYA_SISWA' | 'IDENTITAS_LOGO';
  folderId: string;
  record: Record<string, string>;
  onProgress?: (percent: number) => void;
}): Promise<{ ok: boolean; fileId: string; driveUrl: string; record: Record<string, string> }> {
  return new Promise((resolve, reject) => {
    const token = getAccessToken();
    if (!token) {
      reject(new Error('Sesi Google tidak aktif. Silakan masuk kembali.'));
      return;
    }

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/drive/upload', true);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.setRequestHeader('Content-Type', 'application/octet-stream');
    xhr.setRequestHeader(
      'X-Upload-Meta',
      encodeURIComponent(
        JSON.stringify({
          spreadsheetId: params.spreadsheetId,
          targetSheet: params.targetSheet,
          folderId: params.folderId,
          fileName: params.file.name,
          mimeType: params.file.type || 'application/octet-stream',
          record: params.record,
        })
      )
    );

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && params.onProgress) {
        const pct = Math.min(99, Math.round((event.loaded / event.total) * 100));
        params.onProgress(pct);
      }
    };

    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText || '{}');
        if (xhr.status >= 200 && xhr.status < 300) {
          params.onProgress?.(100);
          resolve(data);
        } else {
          reject(new Error(data.error || `Gagal mengunggah (${xhr.status})`));
        }
      } catch {
        reject(new Error('Respon server tidak valid saat mengunggah file.'));
      }
    };

    xhr.onerror = () => {
      reject(new Error('Koneksi terputus saat mengunggah ke Google Drive. Periksa jaringan Anda lalu coba lagi.'));
    };

    xhr.send(params.file);
  });
}

export async function appendSheetRow<T = Record<string, string>>(
  sheetName: string,
  spreadsheetId: string,
  record: Record<string, string>
): Promise<{ ok: boolean; record: T }> {
  const res = await fetch(`/api/sheets/${encodeURIComponent(sheetName)}`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ spreadsheetId, record }),
  });
  return handleJsonResponse(res);
}

export async function batchImportStudents(
  spreadsheetId: string,
  records: Array<Record<string, string>>
): Promise<{ ok: boolean; importedCount: number; records: Array<Record<string, string>> }> {
  const res = await fetch('/api/sheets/DATA_SISWA/batch', {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ spreadsheetId, records }),
  });
  return handleJsonResponse(res);
}

export async function updateSheetRow<T = Record<string, string>>(
  sheetName: string,
  spreadsheetId: string,
  id: string,
  updates: Record<string, string>
): Promise<{ ok: boolean; record: T }> {
  const res = await fetch(`/api/sheets/${encodeURIComponent(sheetName)}/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ spreadsheetId, updates }),
  });
  return handleJsonResponse(res);
}

export async function saveSettingsBatch(
  spreadsheetId: string,
  settings: Array<{ kunci: string; nilai: string; deskripsi?: string }>
): Promise<{ ok: boolean }> {
  const res = await fetch('/api/settings/batch', {
    method: 'PUT',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ spreadsheetId, settings }),
  });
  return handleJsonResponse(res);
}

export async function deleteArchivePermanent(
  sheetName: string,
  spreadsheetId: string,
  id: string
): Promise<{ ok: boolean; deletedId: string }> {
  const res = await fetch(
    `/api/archive/${encodeURIComponent(sheetName)}/${encodeURIComponent(id)}?spreadsheetId=${encodeURIComponent(spreadsheetId)}`,
    {
      method: 'DELETE',
      headers: authHeaders(),
    }
  );
  return handleJsonResponse(res);
}

const blobUrlCache = new Map<string, string>();

export async function fetchDriveFileBlobUrl(fileId: string): Promise<string> {
  if (!fileId) return '';
  const cached = blobUrlCache.get(fileId);
  if (cached) return cached;

  const token = getAccessToken();
  if (!token) return '';

  const res = await fetch(`/api/drive/file/${encodeURIComponent(fileId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return '';
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  blobUrlCache.set(fileId, objectUrl);
  return objectUrl;
}

export async function downloadDriveFile(fileId: string, fallbackFileName: string) {
  const token = getAccessToken();
  if (!token) {
    throw new Error('Silakan masuk dengan Google untuk mengunduh berkas.');
  }
  const res = await fetch(`/api/drive/file/${encodeURIComponent(fileId)}?download=1`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error('Gagal mengunduh berkas dari Google Drive.');
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fallbackFileName || 'berkas-seni-ruang';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
