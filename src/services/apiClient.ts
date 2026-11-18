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
  gasEndpoint?: string;
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
  const text = await res.text();
  try {
    return JSON.parse(text) as PublicGalleryResponse;
  } catch {
    return {
      configured: Boolean(gasUrl),
      karya: [],
      error: `Respon server galeri tidak valid (HTTP ${res.status}).`,
    };
  }
}

function parseXhrErrorMessage(xhr: XMLHttpRequest, actionLabel: string): string {
  const raw = (xhr.responseText || '').trim();
  if (xhr.status === 413) {
    return `Ukuran file terlalu besar untuk proxy server (HTTP 413). Gunakan file lebih kecil atau unggah langsung ke Google.`;
  }
  if (xhr.status === 404) {
    return `Layanan ${actionLabel} tidak ditemukan (HTTP 404). Pastikan API server aktif.`;
  }
  if (xhr.status === 502 || xhr.status === 504) {
    return `Server sedang sibuk atau timeout saat ${actionLabel} (HTTP ${xhr.status}). Coba ulangi lagi.`;
  }
  const cleanSnippet = raw
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 140);
  if (cleanSnippet) {
    return `Respon server tidak JSON saat ${actionLabel} (HTTP ${xhr.status}): ${cleanSnippet}`;
  }
  return `Respon server kosong/tidak valid saat ${actionLabel} (HTTP ${xhr.status || '0'}).`;
}

async function optimizeImageIfNeeded(file: File, maxBytes = 2.6 * 1024 * 1024): Promise<File> {
  if (!file.type.startsWith('image/') || file.type === 'image/svg+xml' || file.size <= maxBytes) {
    return file;
  }

  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const maxDim = 2048;
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        const scale = Math.min(maxDim / width, maxDim / height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(file);
        return;
      }
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (blob && blob.size < file.size) {
            const safeName = file.name.replace(/\.[^.]+$/, '') + '.jpg';
            resolve(new File([blob], safeName, { type: 'image/jpeg' }));
          } else {
            resolve(file);
          }
        },
        'image/jpeg',
        0.86
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(file);
    };
    img.src = objectUrl;
  });
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const idx = result.indexOf(',');
      resolve(idx >= 0 ? result.slice(idx + 1) : result);
    };
    reader.onerror = () => reject(new Error('Gagal membaca file karya.'));
    reader.readAsDataURL(file);
  });
}

async function postStudentWorkDirectToGas(
  gasUrl: string,
  fileToSend: File,
  params: {
    judul_karya: string;
    nama_siswa: string;
    nis_siswa?: string;
    kelas: string;
    kategori_seni: string;
    teknik_berkarya?: string;
    media_bahan?: string;
    deskripsi_karya?: string;
    onProgress?: (percent: number) => void;
  }
): Promise<{ ok: boolean; record: Record<string, string> }> {
  params.onProgress?.(45);
  const base64Data = await fileToBase64(fileToSend);
  params.onProgress?.(75);
  const res = await fetch(gasUrl, {
    method: 'POST',
    redirect: 'follow',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({
      action: 'studentUpload',
      judul_karya: params.judul_karya,
      nama_siswa: params.nama_siswa,
      nis_siswa: params.nis_siswa || '',
      kelas: params.kelas,
      kategori_seni: params.kategori_seni,
      teknik_berkarya: params.teknik_berkarya || '',
      media_bahan: params.media_bahan || '',
      deskripsi_karya: params.deskripsi_karya || '',
      fileName: fileToSend.name,
      mimeType: fileToSend.type || 'image/jpeg',
      base64Data,
    }),
  });
  const text = await res.text();
  if (text.trim().startsWith('<')) {
    throw new Error(
      'Google Apps Script mengembalikan halaman HTML. Pastikan Web App di-deploy dengan "Execute as: Me" dan "Who has access: Anyone".'
    );
  }
  let parsed: { ok: boolean; error?: string; record?: Record<string, string> };
  try {
    parsed = JSON.parse(text) as { ok: boolean; error?: string; record?: Record<string, string> };
  } catch {
    throw new Error('Respon Google Apps Script tidak valid (bukan JSON). Pastikan URL berakhiran /exec.');
  }
  if (!parsed.ok || !parsed.record) {
    throw new Error(parsed.error || 'Google Apps Script menolak unggahan karya.');
  }
  params.onProgress?.(100);
  return { ok: true, record: parsed.record };
}

export async function uploadStudentWorkPublic(params: {
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
  const fileToSend = await optimizeImageIfNeeded(params.file);

  if (params.gasUrl && fileToSend.size > 3.5 * 1024 * 1024) {
    return postStudentWorkDirectToGas(params.gasUrl, fileToSend, params);
  }

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
          fileName: fileToSend.name,
          mimeType: fileToSend.type || 'image/jpeg',
        })
      )
    );

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && params.onProgress) {
        const pct = Math.min(95, Math.round((event.loaded / event.total) * 100));
        params.onProgress(pct);
      }
    };

    xhr.onload = async () => {
      try {
        const data = JSON.parse(xhr.responseText || '{}');
        if (xhr.status >= 200 && xhr.status < 300 && data.ok) {
          params.onProgress?.(100);
          resolve(data);
        } else {
          reject(new Error(data.error || `Gagal mengunggah tugas (${xhr.status})`));
        }
      } catch {
        if (params.gasUrl && (xhr.status === 413 || xhr.status === 502 || xhr.status === 504)) {
          try {
            const fallback = await postStudentWorkDirectToGas(params.gasUrl, fileToSend, params);
            resolve(fallback);
            return;
          } catch (fallbackErr) {
            reject(fallbackErr instanceof Error ? fallbackErr : new Error(parseXhrErrorMessage(xhr, 'mengirim karya siswa')));
            return;
          }
        }
        reject(new Error(parseXhrErrorMessage(xhr, 'mengirim karya siswa')));
      }
    };

    xhr.onerror = () => {
      reject(new Error('Koneksi terputus saat mengunggah tugas. Periksa jaringan Anda.'));
    };

    xhr.send(fileToSend);
  });
}

async function uploadDirectToGoogleDrive(params: {
  token: string;
  file: File;
  spreadsheetId: string;
  targetSheet: 'ADMINISTRASI' | 'DOKUMENTASI' | 'KARYA_SISWA' | 'IDENTITAS_LOGO';
  folderId: string;
  record: Record<string, string>;
  onProgress?: (percent: number) => void;
}): Promise<{ ok: boolean; fileId: string; driveUrl: string; record: Record<string, string> }> {
  const prepRes = await fetch('/api/drive/prepare-upload', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${params.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      spreadsheetId: params.spreadsheetId,
      targetSheet: params.targetSheet,
      folderId: params.folderId,
      fileName: params.file.name,
      record: params.record,
    }),
  });
  await handleJsonResponse(prepRes);

  const uploaded = await new Promise<{ id: string; webViewLink?: string }>((resolve, reject) => {
    const boundary = `seni_ruang_${Math.random().toString(36).slice(2)}_${Date.now()}`;
    const driveMeta = JSON.stringify({
      name: params.file.name,
      parents: [params.folderId],
    });
    const part1 =
      `--${boundary}\r\n` +
      `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
      `${driveMeta}\r\n` +
      `--${boundary}\r\n` +
      `Content-Type: ${params.file.type || 'application/octet-stream'}\r\n\r\n`;
    const part2 = `\r\n--${boundary}--`;
    const multipartBlob = new Blob([part1, params.file, part2]);

    const xhr = new XMLHttpRequest();
    xhr.open(
      'POST',
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,size',
      true
    );
    xhr.setRequestHeader('Authorization', `Bearer ${params.token}`);
    xhr.setRequestHeader('Content-Type', `multipart/related; boundary=${boundary}`);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && params.onProgress) {
        const pct = Math.min(92, Math.round((event.loaded / event.total) * 100));
        params.onProgress(pct);
      }
    };

    xhr.onload = () => {
      try {
        const parsed = JSON.parse(xhr.responseText || '{}');
        if (xhr.status >= 200 && xhr.status < 300 && parsed.id) {
          resolve(parsed);
        } else {
          reject(new Error(parsed?.error?.message || `Gagal mengunggah ke Google Drive (${xhr.status})`));
        }
      } catch {
        reject(new Error(parseXhrErrorMessage(xhr, 'mengunggah langsung ke Google Drive')));
      }
    };

    xhr.onerror = () => {
      reject(new Error('Koneksi terputus saat mengunggah langsung ke Google Drive.'));
    };

    xhr.send(multipartBlob);
  });

  params.onProgress?.(96);
  const regRes = await fetch('/api/drive/register-upload', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${params.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      spreadsheetId: params.spreadsheetId,
      targetSheet: params.targetSheet,
      fileId: uploaded.id,
      webViewLink: uploaded.webViewLink,
      fileName: params.file.name,
      fileSizeBytes: params.file.size,
      record: params.record,
    }),
  });
  const regData = await handleJsonResponse<{ ok: boolean; fileId: string; driveUrl: string; record: Record<string, string> }>(regRes);
  params.onProgress?.(100);
  return regData;
}

export async function uploadFileWithProgress(params: {
  file: File;
  spreadsheetId: string;
  targetSheet: 'ADMINISTRASI' | 'DOKUMENTASI' | 'KARYA_SISWA' | 'IDENTITAS_LOGO';
  folderId: string;
  record: Record<string, string>;
  onProgress?: (percent: number) => void;
}): Promise<{ ok: boolean; fileId: string; driveUrl: string; record: Record<string, string> }> {
  const token = getAccessToken();
  if (!token) {
    throw new Error('Sesi Google tidak aktif. Silakan masuk kembali.');
  }

  // Bypass Vercel's 4.5 MB serverless request payload limit automatically for larger files
  if (params.file.size > 3.2 * 1024 * 1024) {
    return uploadDirectToGoogleDrive({ token, ...params });
  }

  return new Promise((resolve, reject) => {
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

    xhr.onload = async () => {
      try {
        const data = JSON.parse(xhr.responseText || '{}');
        if (xhr.status >= 200 && xhr.status < 300) {
          params.onProgress?.(100);
          resolve(data);
        } else {
          reject(new Error(data.error || `Gagal mengunggah (${xhr.status})`));
        }
      } catch {
        // Fallback to direct Google Drive upload if serverless proxy returned 413/502/HTML
        if (xhr.status === 413 || xhr.status === 502 || xhr.status === 504 || xhr.status >= 500) {
          try {
            const directResult = await uploadDirectToGoogleDrive({ token, ...params });
            resolve(directResult);
            return;
          } catch (fallbackErr) {
            reject(fallbackErr instanceof Error ? fallbackErr : new Error(parseXhrErrorMessage(xhr, 'mengunggah file')));
            return;
          }
        }
        reject(new Error(parseXhrErrorMessage(xhr, 'mengunggah file')));
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
