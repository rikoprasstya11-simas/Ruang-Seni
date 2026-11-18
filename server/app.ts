import crypto from 'node:crypto';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import {
  ALLOWED_FILE_EXTENSIONS,
  DEFAULT_KATEGORI_DOKUMEN,
  DEFAULT_KATEGORI_KARYA,
  SHEET_HEADERS,
} from '../src/types/seniRuang.ts';
import type {
  IdentitasWebsite,
  UserRole,
  WorkspaceBootstrapData,
  WorkspaceFolders,
} from '../src/types/seniRuang.ts';

const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';
const SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets';

interface TokenIdentity {
  email: string;
  expiresAt: number;
}

const tokenCache = new Map<string, TokenIdentity>();

let activePublicGasUrl =
  process.env.SENI_RUANG_GAS_URL || process.env.VITE_GAS_WEBAPP_URL || '';

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function generateId(prefix: string): string {
  const short = crypto.randomUUID().split('-')[0].toUpperCase();
  const stamp = Date.now().toString(36).toUpperCase();
  return `${prefix}-${stamp}-${short}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

interface AuthedRequest extends Request {
  accessToken?: string;
  userEmail?: string;
}

async function verifyGoogleAccessToken(token: string): Promise<string> {
  const key = hashToken(token);
  const cached = tokenCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.email;
  }

  const res = await fetch(
    `https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${encodeURIComponent(token)}`
  );
  if (!res.ok) {
    throw new Error('Token Google tidak valid atau telah kedaluwarsa. Silakan masuk kembali.');
  }
  const info = (await res.json()) as { email?: string; expires_in?: string | number };
  if (!info.email) {
    throw new Error('Email akun Google tidak ditemukan pada token.');
  }
  const expiresInSec = Number(info.expires_in || 300);
  tokenCache.set(key, {
    email: info.email.toLowerCase(),
    expiresAt: Date.now() + Math.min(expiresInSec, 120) * 1000,
  });
  return info.email.toLowerCase();
}

async function requireGoogleAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization || '';
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (!match) {
      res.status(401).json({ error: 'Autentikasi Google diperlukan.' });
      return;
    }
    const token = match[1].trim();
    const email = await verifyGoogleAccessToken(token);
    req.accessToken = token;
    req.userEmail = email;
    next();
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Autentikasi gagal.';
    res.status(401).json({ error: message });
  }
}

async function googleFetch(url: string, token: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);
  const res = await fetch(url, { ...init, headers });
  if (!res.ok) {
    const errText = await res.text();
    let msg = `Google API Error (${res.status})`;
    try {
      const parsed = JSON.parse(errText);
      msg = parsed?.error?.message || msg;
    } catch {
      if (errText) msg = errText.slice(0, 220);
    }
    const error = new Error(msg) as Error & { status?: number };
    error.status = res.status;
    throw error;
  }
  if (res.status === 204) return null;
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return res.json();
  }
  return res;
}

async function createDriveFolder(
  token: string,
  name: string,
  parentId?: string
): Promise<{ id: string; webViewLink: string }> {
  const metadata: Record<string, unknown> = {
    name,
    mimeType: 'application/vnd.google-apps.folder',
  };
  if (parentId) {
    metadata.parents = [parentId];
  }
  const data = (await googleFetch(
    `${DRIVE_API}/files?fields=id,webViewLink`,
    token,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(metadata),
    }
  )) as { id: string; webViewLink?: string };
  return {
    id: data.id,
    webViewLink: data.webViewLink || `https://drive.google.com/drive/folders/${data.id}`,
  };
}

async function findDriveItem(token: string, query: string) {
  const url = `${DRIVE_API}/files?q=${encodeURIComponent(query)}&fields=files(id,name,webViewLink,parents)&orderBy=modifiedTime desc&pageSize=20`;
  const res = (await googleFetch(url, token)) as {
    files?: Array<{ id: string; name: string; webViewLink?: string; parents?: string[] }>;
  };
  return res.files || [];
}

function rowsToObjects<T = Record<string, string>>(
  values: string[][] | undefined,
  headers: string[]
): T[] {
  if (!values || values.length <= 1) return [];
  const sheetHeaders = values[0].map((h) => String(h).trim());
  return values
    .slice(1)
    .filter((row) => row.some((cell) => cell !== undefined && String(cell).trim() !== ''))
    .map((row) => {
      const obj: Record<string, string> = {};
      headers.forEach((h) => {
        const idx = sheetHeaders.indexOf(h);
        obj[h] = idx >= 0 && row[idx] !== undefined ? String(row[idx]) : '';
      });
      return obj as unknown as T;
    });
}

function objectToRow(obj: Record<string, unknown>, headers: string[]): string[] {
  return headers.map((h) => {
    const val = obj[h];
    return val === undefined || val === null ? '' : String(val);
  });
}

async function getSpreadsheetMeta(token: string, spreadsheetId: string) {
  return (await googleFetch(
    `${SHEETS_API}/${spreadsheetId}?fields=spreadsheetId,spreadsheetUrl,properties.title,sheets(properties(sheetId,title))`,
    token
  )) as {
    spreadsheetId: string;
    spreadsheetUrl: string;
    properties: { title: string };
    sheets: Array<{ properties: { sheetId: number; title: string } }>;
  };
}

async function ensureRequiredSheets(token: string, spreadsheetId: string) {
  const meta = await getSpreadsheetMeta(token, spreadsheetId);
  const existingTitles = new Set(meta.sheets.map((s) => s.properties.title));
  const missingSheets = Object.keys(SHEET_HEADERS).filter((name) => !existingTitles.has(name));

  if (missingSheets.length > 0) {
    await googleFetch(`${SHEETS_API}/${spreadsheetId}:batchUpdate`, token, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: missingSheets.map((title) => ({
          addSheet: { properties: { title } },
        })),
      }),
    });

    const headerData = missingSheets.map((title) => ({
      range: `${title}!A1`,
      values: [SHEET_HEADERS[title]],
    }));

    await googleFetch(`${SHEETS_API}/${spreadsheetId}/values:batchUpdate`, token, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        valueInputOption: 'USER_ENTERED',
        data: headerData,
      }),
    });
  }
  return meta;
}

async function readAllSheets(token: string, spreadsheetId: string) {
  const sheetNames = Object.keys(SHEET_HEADERS);
  const rangesParam = sheetNames.map((n) => `ranges=${encodeURIComponent(`${n}!A1:Z5000`)}`).join('&');
  const res = (await googleFetch(
    `${SHEETS_API}/${spreadsheetId}/values:batchGet?${rangesParam}`,
    token
  )) as { valueRanges?: Array<{ range: string; values?: string[][] }> };

  const mapped: Record<string, string[][]> = {};
  (res.valueRanges || []).forEach((vr, idx) => {
    mapped[sheetNames[idx]] = vr.values || [];
  });
  return mapped;
}

async function appendSheetRows(
  token: string,
  spreadsheetId: string,
  sheetName: string,
  rows: string[][]
) {
  return googleFetch(
    `${SHEETS_API}/${spreadsheetId}/values/${encodeURIComponent(`${sheetName}!A1`)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    token,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: rows }),
    }
  );
}

async function updateSheetRowById(
  token: string,
  spreadsheetId: string,
  sheetName: string,
  id: string,
  updates: Record<string, unknown>
) {
  const headers = SHEET_HEADERS[sheetName];
  if (!headers) throw new Error(`Sheet ${sheetName} tidak dikenali.`);
  const rangeRes = (await googleFetch(
    `${SHEETS_API}/${spreadsheetId}/values/${encodeURIComponent(`${sheetName}!A1:Z5000`)}`,
    token
  )) as { values?: string[][] };

  const values = rangeRes.values || [];
  const sheetHeaders = (values[0] || headers).map((h) => String(h).trim());
  const rowIndex = values.findIndex((row, idx) => idx > 0 && String(row[0]) === String(id));
  if (rowIndex === -1) {
    throw new Error(`Data dengan ID ${id} tidak ditemukan pada sheet ${sheetName}.`);
  }

  const currentRow = values[rowIndex];
  const mergedRow = sheetHeaders.map((h, colIdx) => {
    if (Object.prototype.hasOwnProperty.call(updates, h) && updates[h] !== undefined) {
      return String(updates[h]);
    }
    return currentRow[colIdx] !== undefined ? String(currentRow[colIdx]) : '';
  });

  const targetRowNumber = rowIndex + 1;
  await googleFetch(
    `${SHEETS_API}/${spreadsheetId}/values/${encodeURIComponent(`${sheetName}!A${targetRowNumber}`)}?valueInputOption=USER_ENTERED`,
    token,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: [mergedRow] }),
    }
  );

  const resultObj: Record<string, string> = {};
  sheetHeaders.forEach((h, idx) => {
    resultObj[h] = mergedRow[idx] || '';
  });
  return resultObj;
}

async function deleteSheetRowById(
  token: string,
  spreadsheetId: string,
  sheetName: string,
  id: string
): Promise<Record<string, string> | null> {
  const meta = await getSpreadsheetMeta(token, spreadsheetId);
  const sheetMeta = meta.sheets.find((s) => s.properties.title === sheetName);
  if (!sheetMeta) throw new Error(`Sheet ${sheetName} tidak ditemukan.`);

  const rangeRes = (await googleFetch(
    `${SHEETS_API}/${spreadsheetId}/values/${encodeURIComponent(`${sheetName}!A1:Z5000`)}`,
    token
  )) as { values?: string[][] };

  const values = rangeRes.values || [];
  const sheetHeaders = (values[0] || SHEET_HEADERS[sheetName] || []).map((h) => String(h).trim());
  const rowIndex = values.findIndex((row, idx) => idx > 0 && String(row[0]) === String(id));
  if (rowIndex === -1) return null;

  const deletedObj: Record<string, string> = {};
  sheetHeaders.forEach((h, idx) => {
    deletedObj[h] = values[rowIndex][idx] !== undefined ? String(values[rowIndex][idx]) : '';
  });

  await googleFetch(`${SHEETS_API}/${spreadsheetId}:batchUpdate`, token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId: sheetMeta.properties.sheetId,
              dimension: 'ROWS',
              startIndex: rowIndex,
              endIndex: rowIndex + 1,
            },
          },
        },
      ],
    }),
  });

  return deletedObj;
}

function resolveUserRole(
  userEmail: string,
  users: Array<{ email: string; role: string }>,
  identitas?: IdentitasWebsite,
  siswaList?: Array<{ email: string }>
): UserRole {
  const normalized = userEmail.trim().toLowerCase();
  const matchedUser = users.find((u) => u.email.trim().toLowerCase() === normalized);
  if (matchedUser) {
    const r = matchedUser.role.toUpperCase();
    if (r === 'ADMIN' || r === 'SISWA' || r === 'PENGUNJUNG') return r;
  }
  if (identitas?.email_guru && identitas.email_guru.trim().toLowerCase() === normalized) {
    return 'ADMIN';
  }
  if (users.length === 0) {
    return 'ADMIN';
  }
  if (siswaList?.some((s) => s.email && s.email.trim().toLowerCase() === normalized)) {
    return 'SISWA';
  }
  return 'PENGUNJUNG';
}

function extractFoldersFromPengaturan(
  pengaturan: Array<{ kunci: string; nilai: string }>,
  rootFolderId: string
): WorkspaceFolders {
  const map = new Map(pengaturan.map((p) => [p.kunci, p.nilai]));
  return {
    rootId: map.get('root_folder_id') || rootFolderId || '',
    administrasiRootId: map.get('folder_administrasi_root_id') || '',
    perencanaanId: map.get('folder_perencanaan_id') || '',
    penilaianId: map.get('folder_penilaian_id') || '',
    adminGuruId: map.get('folder_admin_guru_id') || '',
    dokumentasiId: map.get('folder_dokumentasi_id') || '',
    karyaRootId: map.get('folder_karya_root_id') || '',
    karyaViiId: map.get('folder_karya_vii_id') || '',
    karyaViiiId: map.get('folder_karya_viii_id') || '',
    karyaIxId: map.get('folder_karya_ix_id') || '',
    portofolioId: map.get('folder_portofolio_id') || '',
    laporanId: map.get('folder_laporan_id') || '',
    backupId: map.get('folder_backup_id') || '',
  };
}

async function buildBootstrapPayload(
  token: string,
  userEmail: string,
  spreadsheetId: string,
  rootFolderId = ''
): Promise<WorkspaceBootstrapData> {
  const meta = await getSpreadsheetMeta(token, spreadsheetId);
  const rawSheets = await readAllSheets(token, spreadsheetId);

  const users = rowsToObjects<WorkspaceBootstrapData['users'][number]>(rawSheets.USERS, SHEET_HEADERS.USERS);
  const identitasList = rowsToObjects<IdentitasWebsite>(
    rawSheets.IDENTITAS_WEBSITE,
    SHEET_HEADERS.IDENTITAS_WEBSITE
  );
  const identitas: IdentitasWebsite = identitasList[0] || {
    id: 'ID-WEB-01',
    nama_website: 'SENI RUANG',
    tagline: 'Ruang Kreativitas, Dokumentasi, dan Apresiasi Seni.',
    logo_url: '',
    logo_file_id: '',
    nama_guru: userEmail.split('@')[0],
    nip_guru: '',
    email_guru: userEmail,
    nama_sekolah: 'SMP Negeri',
    tahun_ajaran_aktif: '2026/2027',
    semester_aktif: 'Ganjil',
  };

  const kelas = rowsToObjects<WorkspaceBootstrapData['kelas'][number]>(rawSheets.KELAS, SHEET_HEADERS.KELAS);
  const siswa = rowsToObjects<WorkspaceBootstrapData['siswa'][number]>(rawSheets.DATA_SISWA, SHEET_HEADERS.DATA_SISWA);
  const administrasi = rowsToObjects<WorkspaceBootstrapData['administrasi'][number]>(
    rawSheets.ADMINISTRASI,
    SHEET_HEADERS.ADMINISTRASI
  );
  const dokumentasi = rowsToObjects<WorkspaceBootstrapData['dokumentasi'][number]>(
    rawSheets.DOKUMENTASI,
    SHEET_HEADERS.DOKUMENTASI
  );
  const allKarya = rowsToObjects<WorkspaceBootstrapData['karya'][number]>(rawSheets.KARYA_SISWA, SHEET_HEADERS.KARYA_SISWA);
  const kategoriDokumen = rowsToObjects<WorkspaceBootstrapData['kategoriDokumen'][number]>(
    rawSheets.KATEGORI_DOKUMEN,
    SHEET_HEADERS.KATEGORI_DOKUMEN
  );
  const kategoriKarya = rowsToObjects<WorkspaceBootstrapData['kategoriKarya'][number]>(
    rawSheets.KATEGORI_KARYA,
    SHEET_HEADERS.KATEGORI_KARYA
  );
  const aktivitas = rowsToObjects<WorkspaceBootstrapData['aktivitas'][number]>(
    rawSheets.AKTIVITAS,
    SHEET_HEADERS.AKTIVITAS
  );
  const pengaturan = rowsToObjects<WorkspaceBootstrapData['pengaturan'][number]>(
    rawSheets.PENGATURAN,
    SHEET_HEADERS.PENGATURAN
  );

  const role = resolveUserRole(userEmail, users, identitas, siswa);
  const matchedUser = users.find((u) => u.email.trim().toLowerCase() === userEmail.toLowerCase());
  const userName =
    matchedUser?.nama || (role === 'ADMIN' ? identitas.nama_guru : userEmail.split('@')[0]);

  const folders = extractFoldersFromPengaturan(pengaturan, rootFolderId);
  const gasSetting = pengaturan.find((p) => p.kunci === 'gas_webapp_url');
  if (gasSetting?.nilai) {
    activePublicGasUrl = gasSetting.nilai;
  }

  const visibleKarya =
    role === 'ADMIN'
      ? allKarya
      : role === 'SISWA'
        ? allKarya.filter(
            (k) =>
              k.status_publikasi === 'Dipublikasikan' ||
              k.status_publikasi === 'Karya Pilihan' ||
              k.pengunggah.toLowerCase() === userEmail.toLowerCase()
          )
        : allKarya.filter(
            (k) => k.status_publikasi === 'Dipublikasikan' || k.status_publikasi === 'Karya Pilihan'
          );

  return {
    connected: true,
    spreadsheetId,
    spreadsheetUrl: meta.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}`,
    rootFolderId: folders.rootId || rootFolderId,
    rootFolderUrl: (folders.rootId || rootFolderId)
      ? `https://drive.google.com/drive/folders/${folders.rootId || rootFolderId}`
      : '',
    role,
    userEmail,
    userName,
    folders,
    identitas,
    kelas,
    siswa: role === 'ADMIN' ? siswa : role === 'SISWA' ? siswa.filter((s) => s.email.toLowerCase() === userEmail.toLowerCase()) : [],
    administrasi: role === 'ADMIN' ? administrasi : [],
    dokumentasi: role === 'ADMIN' ? dokumentasi : [],
    karya: visibleKarya,
    kategoriDokumen,
    kategoriKarya,
    aktivitas: role === 'ADMIN' ? [...aktivitas].reverse().slice(0, 60) : [],
    pengaturan: role === 'ADMIN' ? pengaturan : pengaturan.filter((p) => p.kunci === 'galeri_publik_aktif' || p.kunci === 'max_upload_mb'),
    users: role === 'ADMIN' ? users : [],
  };
}

async function logActivity(
  token: string,
  spreadsheetId: string,
  pengguna: string,
  role: UserRole,
  aksi: string,
  modul: string,
  judulItem: string,
  keterangan: string
) {
  try {
    const row = objectToRow(
      {
        id: generateId('ACT'),
        waktu: nowIso(),
        pengguna,
        role,
        aksi,
        modul,
        judul_item: judulItem,
        keterangan,
      },
      SHEET_HEADERS.AKTIVITAS
    );
    await appendSheetRows(token, spreadsheetId, 'AKTIVITAS', [row]);
  } catch {
    // Non-blocking audit log
  }
}

async function getAuthoritativeRoleForRequest(
  token: string,
  userEmail: string,
  spreadsheetId: string
): Promise<UserRole> {
  const ranges = [
    `ranges=${encodeURIComponent('USERS!A1:H500')}`,
    `ranges=${encodeURIComponent('IDENTITAS_WEBSITE!A1:K5')}`,
    `ranges=${encodeURIComponent('DATA_SISWA!A1:I1000')}`,
  ].join('&');
  const res = (await googleFetch(
    `${SHEETS_API}/${spreadsheetId}/values:batchGet?${ranges}`,
    token
  )) as { valueRanges?: Array<{ values?: string[][] }> };

  const users = rowsToObjects<{ email: string; role: string }>(res.valueRanges?.[0]?.values, SHEET_HEADERS.USERS);
  const identitasList = rowsToObjects<IdentitasWebsite>(
    res.valueRanges?.[1]?.values,
    SHEET_HEADERS.IDENTITAS_WEBSITE
  );
  const siswa = rowsToObjects<{ email: string }>(res.valueRanges?.[2]?.values, SHEET_HEADERS.DATA_SISWA);
  return resolveUserRole(userEmail, users, identitasList[0], siswa);
}

export function createApiApp() {
  const app = express();
  app.use(express.json({ limit: '10mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'SENI RUANG', timestamp: nowIso() });
  });

  // Public gallery endpoint via configured GAS Web App (for front page & visitors)
  app.get('/api/public/gallery', async (req, res) => {
    const envGasUrl = process.env.SENI_RUANG_GAS_URL || process.env.VITE_GAS_WEBAPP_URL || '';
    const gasUrl = String(req.query.gasUrl || activePublicGasUrl || envGasUrl).trim();
    if (!gasUrl) {
      res.json({ configured: false, karya: [], identitas: null, kelas: [], kategoriKarya: [] });
      return;
    }
    try {
      const response = await fetch(`${gasUrl}${gasUrl.includes('?') ? '&' : '?'}action=publicGallery`, {
        redirect: 'follow',
      });
      const text = await response.text();
      if (text.trim().startsWith('<')) {
        res.status(502).json({
          configured: true,
          error:
            'Google Apps Script mengembalikan halaman HTML (bukan JSON). Pastikan saat Deploy Web App Anda memilih "Execute as: Me" dan "Who has access: Anyone", lalu gunakan URL berakhiran /exec.',
        });
        return;
      }
      let data: Record<string, unknown>;
      try {
        data = JSON.parse(text) as Record<string, unknown>;
      } catch {
        res.status(502).json({
          configured: true,
          error:
            'Respon Google Apps Script bukan JSON yang valid. Pastikan URL berakhiran /exec dan kode Code.gs sudah di-deploy ulang.',
        });
        return;
      }
      res.json({ configured: true, gasEndpoint: gasUrl, ...data });
    } catch (err) {
      res.status(502).json({
        configured: true,
        error:
          err instanceof Error
            ? `Gagal terhubung ke Google Apps Script: ${err.message}`
            : 'Gagal menghubungi Google Apps Script.',
      });
    }
  });

  // Public student submission proxy -> forwards binary file cleanly to teacher's deployed Google Apps Script Web App
  app.post(
    '/api/public/student-upload',
    express.raw({ type: 'application/octet-stream', limit: '15mb' }),
    async (req, res) => {
      try {
        const metaHeader = req.headers['x-student-meta'];
        if (!metaHeader || typeof metaHeader !== 'string') {
          res.status(400).json({ error: 'Metadata pengumpulan karya tidak ditemukan.' });
          return;
        }
        const meta = JSON.parse(decodeURIComponent(metaHeader)) as {
          gasUrl?: string;
          judul_karya: string;
          nama_siswa: string;
          nis_siswa?: string;
          kelas: string;
          kategori_seni: string;
          teknik_berkarya?: string;
          media_bahan?: string;
          deskripsi_karya?: string;
          fileName: string;
          mimeType: string;
        };

        const envGasUrl = process.env.SENI_RUANG_GAS_URL || process.env.VITE_GAS_WEBAPP_URL || '';
        const gasUrl = String(meta.gasUrl || activePublicGasUrl || envGasUrl).trim();
        if (!gasUrl) {
          res.status(400).json({
            error:
              'URL Google Apps Script Web App belum dikonfigurasi oleh guru. Tempel URL Web App Apps Script di halaman utama atau atur VITE_GAS_WEBAPP_URL di Vercel.',
          });
          return;
        }

        if (!meta.judul_karya?.trim() || !meta.nama_siswa?.trim() || !meta.kelas?.trim()) {
          res.status(400).json({ error: 'Judul karya, nama siswa, dan kelas wajib diisi.' });
          return;
        }

        const ext = (meta.fileName.split('.').pop() || '').toLowerCase();
        if (!['jpg', 'jpeg', 'png', 'pdf'].includes(ext)) {
          res.status(400).json({
            error: 'Format tugas harus berupa JPG, JPEG, PNG, atau PDF.',
          });
          return;
        }

        const fileBuffer = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body);
        if (fileBuffer.length === 0) {
          res.status(400).json({ error: 'File karya kosong.' });
          return;
        }

        const gasResponse = await fetch(gasUrl, {
          method: 'POST',
          redirect: 'follow',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({
            action: 'studentUpload',
            judul_karya: meta.judul_karya,
            nama_siswa: meta.nama_siswa,
            nis_siswa: meta.nis_siswa || '',
            kelas: meta.kelas,
            kategori_seni: meta.kategori_seni,
            teknik_berkarya: meta.teknik_berkarya || '',
            media_bahan: meta.media_bahan || '',
            deskripsi_karya: meta.deskripsi_karya || '',
            fileName: meta.fileName,
            mimeType: meta.mimeType || 'image/jpeg',
            base64Data: fileBuffer.toString('base64'),
          }),
        });

        const text = await gasResponse.text();
        if (text.trim().startsWith('<')) {
          res.status(502).json({
            error:
              'Google Apps Script mengembalikan halaman HTML. Pastikan deployment Web App diset "Execute as: Me" dan "Who has access: Anyone".',
          });
          return;
        }
        let result: { ok: boolean; error?: string; record?: Record<string, string> };
        try {
          result = JSON.parse(text) as { ok: boolean; error?: string; record?: Record<string, string> };
        } catch {
          res.status(502).json({
            error:
              'Respon Google Apps Script tidak valid (bukan JSON). Pastikan deployment Web App aktif dan URL berakhiran /exec.',
          });
          return;
        }
        if (!result.ok) {
          res.status(400).json({ error: result.error || 'Google Apps Script menolak unggahan.' });
          return;
        }

        res.json(result);
      } catch (err) {
        res.status(500).json({
          error:
            err instanceof Error
              ? err.message
              : 'Gagal mengirim tugas ke Google Drive melalui Google Apps Script.',
        });
      }
    }
  );

  // Discover existing SENI RUANG workspace in user's Google Drive
  app.get('/api/workspace/discover', requireGoogleAuth, async (req: AuthedRequest, res) => {
    try {
      const token = req.accessToken!;
      const email = req.userEmail!;
      const requestedSpreadsheetId = String(req.query.spreadsheetId || '').trim();
      const requestedFolderId = String(req.query.rootFolderId || '').trim();

      if (requestedSpreadsheetId) {
        await ensureRequiredSheets(token, requestedSpreadsheetId);
        const data = await buildBootstrapPayload(token, email, requestedSpreadsheetId, requestedFolderId);
        res.json(data);
        return;
      }

      const spreadsheets = await findDriveItem(
        token,
        "name = 'SENI RUANG - Database Utama' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false"
      );

      if (spreadsheets.length === 0) {
        res.json({ connected: false, userEmail: email });
        return;
      }

      const ssId = spreadsheets[0].id;
      const folders = await findDriveItem(
        token,
        "name = 'SENI RUANG' and mimeType = 'application/vnd.google-apps.folder' and trashed = false"
      );
      const rootFolderId = folders[0]?.id || '';

      await ensureRequiredSheets(token, ssId);
      const data = await buildBootstrapPayload(token, email, ssId, rootFolderId);
      res.json(data);
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Gagal memeriksa koneksi Google Workspace.',
      });
    }
  });

  app.post('/api/workspace/connect', requireGoogleAuth, async (req: AuthedRequest, res) => {
    try {
      const token = req.accessToken!;
      const email = req.userEmail!;
      const { spreadsheetId, rootFolderId, gasWebAppUrl } = req.body as {
        spreadsheetId?: string;
        rootFolderId?: string;
        gasWebAppUrl?: string;
      };
      if (!spreadsheetId?.trim()) {
        res.status(400).json({ error: 'Spreadsheet ID wajib diisi.' });
        return;
      }
      await ensureRequiredSheets(token, spreadsheetId.trim());
      if (gasWebAppUrl !== undefined) {
        activePublicGasUrl = gasWebAppUrl.trim();
      }
      const data = await buildBootstrapPayload(
        token,
        email,
        spreadsheetId.trim(),
        (rootFolderId || '').trim()
      );
      res.json(data);
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : 'Gagal terhubung ke Spreadsheet.',
      });
    }
  });

  app.post('/api/workspace/provision', requireGoogleAuth, async (req: AuthedRequest, res) => {
    try {
      const token = req.accessToken!;
      const email = req.userEmail!;
      const { namaGuru, namaSekolah, tahunAjaran, semester, namaUser } = req.body as {
        namaGuru?: string;
        namaSekolah?: string;
        tahunAjaran?: string;
        semester?: string;
        namaUser?: string;
      };

      const existingSs = await findDriveItem(
        token,
        "name = 'SENI RUANG - Database Utama' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false"
      );
      if (existingSs.length > 0) {
        const folders = await findDriveItem(
          token,
          "name = 'SENI RUANG' and mimeType = 'application/vnd.google-apps.folder' and trashed = false"
        );
        await ensureRequiredSheets(token, existingSs[0].id);
        const data = await buildBootstrapPayload(token, email, existingSs[0].id, folders[0]?.id || '');
        res.json(data);
        return;
      }

      const rootFolder = await createDriveFolder(token, 'SENI RUANG');
      const [adminRoot, karyaRoot, portofolioFolder, laporanFolder, backupFolder] =
        await Promise.all([
          createDriveFolder(token, '01_ADMINISTRASI_GURU', rootFolder.id),
          createDriveFolder(token, '02_KARYA_SISWA', rootFolder.id),
          createDriveFolder(token, '03_PORTOFOLIO_SISWA', rootFolder.id),
          createDriveFolder(token, '04_LAPORAN', rootFolder.id),
          createDriveFolder(token, '05_BACKUP', rootFolder.id),
        ]);

      const [
        perencanaanFolder,
        penilaianFolder,
        adminGuruFolder,
        dokumentasiFolder,
        karyaViiFolder,
        karyaViiiFolder,
        karyaIxFolder,
      ] = await Promise.all([
        createDriveFolder(token, 'PERENCANAAN_PEMBELAJARAN', adminRoot.id),
        createDriveFolder(token, 'ADMINISTRASI_PENILAIAN', adminRoot.id),
        createDriveFolder(token, 'ADMINISTRASI_GURU', adminRoot.id),
        createDriveFolder(token, 'DOKUMENTASI_KEGIATAN', adminRoot.id),
        createDriveFolder(token, 'KELAS_VII', karyaRoot.id),
        createDriveFolder(token, 'KELAS_VIII', karyaRoot.id),
        createDriveFolder(token, 'KELAS_IX', karyaRoot.id),
      ]);

      const sheetTitles = Object.keys(SHEET_HEADERS);
      const createdSs = (await googleFetch(SHEETS_API, token, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          properties: { title: 'SENI RUANG - Database Utama' },
          sheets: sheetTitles.map((title) => ({ properties: { title } })),
        }),
      })) as { spreadsheetId: string; spreadsheetUrl: string };

      const spreadsheetId = createdSs.spreadsheetId;

      const fileMeta = (await googleFetch(
        `${DRIVE_API}/files/${spreadsheetId}?fields=parents`,
        token
      )) as { parents?: string[] };
      const prevParents = (fileMeta.parents || []).join(',');
      await googleFetch(
        `${DRIVE_API}/files/${spreadsheetId}?addParents=${rootFolder.id}${prevParents ? `&removeParents=${prevParents}` : ''}&fields=id,parents`,
        token,
        { method: 'PATCH' }
      );

      const activeYear = tahunAjaran || '2026/2027';
      const activeSemester = semester || 'Ganjil';
      const teacherName = namaGuru || namaUser || email.split('@')[0];
      const schoolName = namaSekolah || 'SMP Negeri';
      const createdTimestamp = nowIso();

      const kelasRows: string[][] = [SHEET_HEADERS.KELAS];
      (['VII', 'VIII', 'IX'] as const).forEach((tingkat) => {
        for (let i = 1; i <= 11; i++) {
          const namaKelas = `${tingkat}.${i}`;
          kelasRows.push(
            objectToRow(
              {
                id: `KLS-${tingkat}-${String(i).padStart(2, '0')}`,
                nama_kelas: namaKelas,
                tingkat,
                wali_kelas: '-',
                tahun_ajaran: activeYear,
                jumlah_siswa: '0',
                keterangan: `Kelas ${namaKelas} Seni Budaya`,
              },
              SHEET_HEADERS.KELAS
            )
          );
        }
      });

      const katDokRows: string[][] = [SHEET_HEADERS.KATEGORI_DOKUMEN];
      DEFAULT_KATEGORI_DOKUMEN.forEach((item, idx) => {
        katDokRows.push(
          objectToRow(
            {
              id: `KDOK-${String(idx + 1).padStart(3, '0')}`,
              kelompok: item.kelompok,
              nama_kategori: item.nama,
              deskripsi: item.deskripsi,
              aktif: 'Ya',
            },
            SHEET_HEADERS.KATEGORI_DOKUMEN
          )
        );
      });

      const katKaryaRows: string[][] = [SHEET_HEADERS.KATEGORI_KARYA];
      DEFAULT_KATEGORI_KARYA.forEach((item, idx) => {
        katKaryaRows.push(
          objectToRow(
            {
              id: `KKAR-${String(idx + 1).padStart(3, '0')}`,
              nama_kategori: item.nama,
              deskripsi: item.deskripsi,
              aktif: 'Ya',
            },
            SHEET_HEADERS.KATEGORI_KARYA
          )
        );
      });

      const pengaturanPairs: Array<[string, string, string]> = [
        ['spreadsheet_id', spreadsheetId, 'ID Google Sheets Database Utama'],
        ['root_folder_id', rootFolder.id, 'Folder Utama SENI RUANG'],
        ['folder_administrasi_root_id', adminRoot.id, '01_ADMINISTRASI_GURU'],
        ['folder_perencanaan_id', perencanaanFolder.id, 'PERENCANAAN_PEMBELAJARAN'],
        ['folder_penilaian_id', penilaianFolder.id, 'ADMINISTRASI_PENILAIAN'],
        ['folder_admin_guru_id', adminGuruFolder.id, 'ADMINISTRASI_GURU'],
        ['folder_dokumentasi_id', dokumentasiFolder.id, 'DOKUMENTASI_KEGIATAN'],
        ['folder_karya_root_id', karyaRoot.id, '02_KARYA_SISWA'],
        ['folder_karya_vii_id', karyaViiFolder.id, 'KELAS_VII'],
        ['folder_karya_viii_id', karyaViiiFolder.id, 'KELAS_VIII'],
        ['folder_karya_ix_id', karyaIxFolder.id, 'KELAS_IX'],
        ['folder_portofolio_id', portofolioFolder.id, '03_PORTOFOLIO_SISWA'],
        ['folder_laporan_id', laporanFolder.id, '04_LAPORAN'],
        ['folder_backup_id', backupFolder.id, '05_BACKUP'],
        ['galeri_publik_aktif', 'Ya', 'Akses galeri publik untuk pengunjung'],
        ['max_upload_mb', '15', 'Batas ukuran upload file (MB)'],
        ['gas_webapp_url', activePublicGasUrl || '', 'URL Web App Google Apps Script opsional'],
      ];

      const pengaturanRows = [
        SHEET_HEADERS.PENGATURAN,
        ...pengaturanPairs.map(([kunci, nilai, deskripsi], idx) =>
          objectToRow(
            { id: `SET-${String(idx + 1).padStart(3, '0')}`, kunci, nilai, deskripsi },
            SHEET_HEADERS.PENGATURAN
          )
        ),
      ];

      const batchData = [
        {
          range: 'USERS!A1',
          values: [
            SHEET_HEADERS.USERS,
            objectToRow(
              {
                id: 'USR-001',
                email,
                nama: teacherName,
                role: 'ADMIN',
                kelas: 'Semua Kelas',
                status: 'Aktif',
                dibuat_pada: createdTimestamp,
                terakhir_login: createdTimestamp,
              },
              SHEET_HEADERS.USERS
            ),
          ],
        },
        {
          range: 'IDENTITAS_WEBSITE!A1',
          values: [
            SHEET_HEADERS.IDENTITAS_WEBSITE,
            objectToRow(
              {
                id: 'ID-WEB-01',
                nama_website: 'SENI RUANG',
                tagline: 'Ruang Kreativitas, Dokumentasi, dan Apresiasi Seni.',
                logo_url: '',
                logo_file_id: '',
                nama_guru: teacherName,
                nip_guru: '-',
                email_guru: email,
                nama_sekolah: schoolName,
                tahun_ajaran_aktif: activeYear,
                semester_aktif: activeSemester,
              },
              SHEET_HEADERS.IDENTITAS_WEBSITE
            ),
          ],
        },
        { range: 'KELAS!A1', values: kelasRows },
        { range: 'DATA_SISWA!A1', values: [SHEET_HEADERS.DATA_SISWA] },
        { range: 'ADMINISTRASI!A1', values: [SHEET_HEADERS.ADMINISTRASI] },
        { range: 'KARYA_SISWA!A1', values: [SHEET_HEADERS.KARYA_SISWA] },
        { range: 'DOKUMENTASI!A1', values: [SHEET_HEADERS.DOKUMENTASI] },
        { range: 'KATEGORI_DOKUMEN!A1', values: katDokRows },
        { range: 'KATEGORI_KARYA!A1', values: katKaryaRows },
        {
          range: 'AKTIVITAS!A1',
          values: [
            SHEET_HEADERS.AKTIVITAS,
            objectToRow(
              {
                id: generateId('ACT'),
                waktu: createdTimestamp,
                pengguna: email,
                role: 'ADMIN',
                aksi: 'INISIALISASI',
                modul: 'WORKSPACE',
                judul_item: 'SENI RUANG Workspace',
                keterangan: 'Struktur folder Google Drive dan 11 sheet database berhasil dibuat otomatis.',
              },
              SHEET_HEADERS.AKTIVITAS
            ),
          ],
        },
        { range: 'PENGATURAN!A1', values: pengaturanRows },
      ];

      await googleFetch(`${SHEETS_API}/${spreadsheetId}/values:batchUpdate`, token, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          valueInputOption: 'USER_ENTERED',
          data: batchData,
        }),
      });

      const payload = await buildBootstrapPayload(token, email, spreadsheetId, rootFolder.id);
      res.json(payload);
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Gagal membuat workspace Google Drive dan Sheets.',
      });
    }
  });

  app.post(
    '/api/drive/upload',
    requireGoogleAuth,
    express.raw({ type: 'application/octet-stream', limit: '50mb' }),
    async (req: AuthedRequest, res) => {
      try {
        const token = req.accessToken!;
        const email = req.userEmail!;
        const metaHeader = req.headers['x-upload-meta'];
        if (!metaHeader || typeof metaHeader !== 'string') {
          res.status(400).json({ error: 'Metadata unggahan tidak ditemukan.' });
          return;
        }
        const meta = JSON.parse(decodeURIComponent(metaHeader)) as {
          spreadsheetId: string;
          targetSheet: 'ADMINISTRASI' | 'DOKUMENTASI' | 'KARYA_SISWA' | 'IDENTITAS_LOGO';
          folderId: string;
          fileName: string;
          mimeType: string;
          record: Record<string, string>;
        };

        const { spreadsheetId, targetSheet, folderId, fileName, mimeType, record } = meta;
        if (!spreadsheetId || !folderId || !fileName) {
          res.status(400).json({ error: 'Spreadsheet ID, Folder ID, dan nama file wajib tersedia.' });
          return;
        }

        const role = await getAuthoritativeRoleForRequest(token, email, spreadsheetId);
        if (role === 'PENGUNJUNG') {
          res.status(403).json({ error: 'Pengunjung tidak memiliki izin mengunggah berkas.' });
          return;
        }
        if (role === 'SISWA' && targetSheet !== 'KARYA_SISWA') {
          res.status(403).json({ error: 'Siswa hanya dapat mengunggah karya seni.' });
          return;
        }

        const ext = (fileName.split('.').pop() || '').toLowerCase();
        if (!ALLOWED_FILE_EXTENSIONS.includes(ext as (typeof ALLOWED_FILE_EXTENSIONS)[number])) {
          res.status(400).json({
            error: `Format file .${ext} tidak didukung. Gunakan PDF, DOC/DOCX, XLS/XLSX, PPT/PPTX, JPG, JPEG, atau PNG.`,
          });
          return;
        }

        const fileBuffer = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body);
        if (fileBuffer.length === 0) {
          res.status(400).json({ error: 'File kosong atau gagal dibaca.' });
          return;
        }

        if (targetSheet !== 'IDENTITAS_LOGO') {
          const existingRes = (await googleFetch(
            `${SHEETS_API}/${spreadsheetId}/values/${encodeURIComponent(`${targetSheet}!A1:Z5000`)}`,
            token
          )) as { values?: string[][] };
          const existingRows = rowsToObjects(existingRes.values, SHEET_HEADERS[targetSheet]);
          const titleField = targetSheet === 'KARYA_SISWA' ? 'judul_karya' : 'judul';
          const candidateTitle = (record[titleField] || '').trim().toLowerCase();
          const duplicate = existingRows.find(
            (r) =>
              (r[titleField] || '').trim().toLowerCase() === candidateTitle &&
              (r.nama_file || '').trim().toLowerCase() === fileName.trim().toLowerCase() &&
              (r.kelas || '').trim().toLowerCase() === (record.kelas || '').trim().toLowerCase()
          );
          if (duplicate) {
            res.status(409).json({
              error: `Data ganda terdeteksi: "${record[titleField]}" dengan file "${fileName}" sudah tersimpan.`,
            });
            return;
          }
        }

        const boundary = `seni_ruang_boundary_${crypto.randomBytes(8).toString('hex')}`;
        const driveMetadata = JSON.stringify({
          name: fileName,
          parents: [folderId],
        });
        const part1 = Buffer.from(
          `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${driveMetadata}\r\n--${boundary}\r\nContent-Type: ${mimeType || 'application/octet-stream'}\r\n\r\n`,
          'utf8'
        );
        const part2 = Buffer.from(`\r\n--${boundary}--`, 'utf8');
        const multipartBody = Buffer.concat([part1, fileBuffer, part2]);

        const uploaded = (await googleFetch(
          `${DRIVE_UPLOAD_API}/files?uploadType=multipart&fields=id,name,webViewLink,webContentLink,mimeType,size`,
          token,
          {
            method: 'POST',
            headers: {
              'Content-Type': `multipart/related; boundary=${boundary}`,
              'Content-Length': String(multipartBody.length),
            },
            body: multipartBody,
          }
        )) as {
          id: string;
          name: string;
          webViewLink?: string;
          webContentLink?: string;
          size?: string;
        };

        if (
          targetSheet === 'IDENTITAS_LOGO' ||
          record.status_publikasi === 'Dipublikasikan' ||
          record.status_publikasi === 'Karya Pilihan'
        ) {
          try {
            await googleFetch(`${DRIVE_API}/files/${uploaded.id}/permissions`, token, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ role: 'reader', type: 'anyone' }),
            });
          } catch {
            // Optional permission fallback
          }
        }

        const driveUrl = uploaded.webViewLink || `https://drive.google.com/file/d/${uploaded.id}/view`;

        if (targetSheet === 'IDENTITAS_LOGO') {
          const updated = await updateSheetRowById(token, spreadsheetId, 'IDENTITAS_WEBSITE', 'ID-WEB-01', {
            logo_file_id: uploaded.id,
            logo_url: driveUrl,
          });
          await logActivity(token, spreadsheetId, email, role, 'UPLOAD', 'IDENTITAS', fileName, 'Memperbarui logo website di Google Drive');
          res.json({ ok: true, fileId: uploaded.id, driveUrl, record: updated });
          return;
        }

        const prefix =
          targetSheet === 'ADMINISTRASI' ? 'ADM' : targetSheet === 'DOKUMENTASI' ? 'DOK' : 'KRY';
        const newId = generateId(prefix);
        const fullRecord: Record<string, string> = {
          ...record,
          id: newId,
          nama_file: fileName,
          format_file: ext.toUpperCase(),
          ukuran_file: formatBytes(fileBuffer.length),
          drive_file_id: uploaded.id,
          drive_url: driveUrl,
          tanggal_upload: nowIso(),
          ...(targetSheet === 'KARYA_SISWA'
            ? {
                tanggal_pengumpulan: record.tanggal_pengumpulan || nowIso().slice(0, 10),
                apresiasi_count: record.apresiasi_count || '0',
                pengunggah: email,
                status_publikasi:
                  role === 'ADMIN' ? record.status_publikasi || 'Dipublikasikan' : 'Dipublikasikan',
              }
            : {
                pemilik: record.pemilik || email,
              }),
        };

        const row = objectToRow(fullRecord, SHEET_HEADERS[targetSheet]);
        await appendSheetRows(token, spreadsheetId, targetSheet, [row]);
        await logActivity(
          token,
          spreadsheetId,
          email,
          role,
          'UPLOAD',
          targetSheet,
          fullRecord.judul_karya || fullRecord.judul || fileName,
          `Mengunggah ${fileName} (${fullRecord.ukuran_file}) ke Google Drive`
        );

        res.json({ ok: true, fileId: uploaded.id, driveUrl, record: fullRecord });
      } catch (err) {
        res.status(500).json({
          error: err instanceof Error ? err.message : 'Gagal mengunggah berkas ke Google Drive.',
        });
      }
    }
  );

  // Pre-check permissions & duplicates before direct browser-to-Drive upload (bypasses 4.5MB serverless payload limit)
  app.post('/api/drive/prepare-upload', requireGoogleAuth, async (req: AuthedRequest, res) => {
    try {
      const token = req.accessToken!;
      const email = req.userEmail!;
      const { spreadsheetId, targetSheet, folderId, fileName, record } = req.body as {
        spreadsheetId: string;
        targetSheet: 'ADMINISTRASI' | 'DOKUMENTASI' | 'KARYA_SISWA' | 'IDENTITAS_LOGO';
        folderId: string;
        fileName: string;
        record?: Record<string, string>;
      };

      if (!spreadsheetId || !folderId || !fileName) {
        res.status(400).json({ error: 'Spreadsheet ID, Folder ID, dan nama file wajib tersedia.' });
        return;
      }

      const role = await getAuthoritativeRoleForRequest(token, email, spreadsheetId);
      if (role === 'PENGUNJUNG') {
        res.status(403).json({ error: 'Pengunjung tidak memiliki izin mengunggah berkas.' });
        return;
      }
      if (role === 'SISWA' && targetSheet !== 'KARYA_SISWA') {
        res.status(403).json({ error: 'Siswa hanya dapat mengunggah karya seni.' });
        return;
      }

      const ext = (fileName.split('.').pop() || '').toLowerCase();
      if (!ALLOWED_FILE_EXTENSIONS.includes(ext as (typeof ALLOWED_FILE_EXTENSIONS)[number])) {
        res.status(400).json({
          error: `Format file .${ext} tidak didukung. Gunakan PDF, DOC/DOCX, XLS/XLSX, PPT/PPTX, JPG, JPEG, atau PNG.`,
        });
        return;
      }

      if (targetSheet !== 'IDENTITAS_LOGO' && record) {
        const existingRes = (await googleFetch(
          `${SHEETS_API}/${spreadsheetId}/values/${encodeURIComponent(`${targetSheet}!A1:Z5000`)}`,
          token
        )) as { values?: string[][] };
        const existingRows = rowsToObjects(existingRes.values, SHEET_HEADERS[targetSheet]);
        const titleField = targetSheet === 'KARYA_SISWA' ? 'judul_karya' : 'judul';
        const candidateTitle = (record[titleField] || '').trim().toLowerCase();
        const duplicate = existingRows.find(
          (r) =>
            (r[titleField] || '').trim().toLowerCase() === candidateTitle &&
            (r.nama_file || '').trim().toLowerCase() === fileName.trim().toLowerCase() &&
            (r.kelas || '').trim().toLowerCase() === (record.kelas || '').trim().toLowerCase()
        );
        if (duplicate) {
          res.status(409).json({
            error: `Data ganda terdeteksi: "${record[titleField]}" dengan file "${fileName}" sudah tersimpan.`,
          });
          return;
        }
      }

      res.json({ ok: true, role, email });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Gagal memvalidasi unggahan berkas.',
      });
    }
  });

  // Register metadata into Google Sheets after direct browser-to-Drive upload
  app.post('/api/drive/register-upload', requireGoogleAuth, async (req: AuthedRequest, res) => {
    try {
      const token = req.accessToken!;
      const email = req.userEmail!;
      const { spreadsheetId, targetSheet, fileId, webViewLink, fileName, fileSizeBytes, record } = req.body as {
        spreadsheetId: string;
        targetSheet: 'ADMINISTRASI' | 'DOKUMENTASI' | 'KARYA_SISWA' | 'IDENTITAS_LOGO';
        fileId: string;
        webViewLink?: string;
        fileName: string;
        fileSizeBytes: number;
        record: Record<string, string>;
      };

      if (!spreadsheetId || !fileId || !fileName) {
        res.status(400).json({ error: 'Data hasil unggahan Google Drive tidak lengkap.' });
        return;
      }

      const role = await getAuthoritativeRoleForRequest(token, email, spreadsheetId);
      if (role === 'PENGUNJUNG') {
        res.status(403).json({ error: 'Pengunjung tidak memiliki izin menyimpan arsip.' });
        return;
      }
      if (role === 'SISWA' && targetSheet !== 'KARYA_SISWA') {
        res.status(403).json({ error: 'Siswa hanya dapat mengunggah karya seni.' });
        return;
      }

      if (
        targetSheet === 'IDENTITAS_LOGO' ||
        record?.status_publikasi === 'Dipublikasikan' ||
        record?.status_publikasi === 'Karya Pilihan'
      ) {
        try {
          await googleFetch(`${DRIVE_API}/files/${encodeURIComponent(fileId)}/permissions`, token, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ role: 'reader', type: 'anyone' }),
          });
        } catch {
          // Optional permission fallback
        }
      }

      const driveUrl = webViewLink || `https://drive.google.com/file/d/${fileId}/view`;
      const ext = (fileName.split('.').pop() || '').toLowerCase();

      if (targetSheet === 'IDENTITAS_LOGO') {
        const updated = await updateSheetRowById(token, spreadsheetId, 'IDENTITAS_WEBSITE', 'ID-WEB-01', {
          logo_file_id: fileId,
          logo_url: driveUrl,
        });
        await logActivity(token, spreadsheetId, email, role, 'UPLOAD', 'IDENTITAS', fileName, 'Memperbarui logo website di Google Drive');
        res.json({ ok: true, fileId, driveUrl, record: updated });
        return;
      }

      const prefix =
        targetSheet === 'ADMINISTRASI' ? 'ADM' : targetSheet === 'DOKUMENTASI' ? 'DOK' : 'KRY';
      const newId = generateId(prefix);
      const fullRecord: Record<string, string> = {
        ...record,
        id: newId,
        nama_file: fileName,
        format_file: ext.toUpperCase(),
        ukuran_file: formatBytes(Number(fileSizeBytes || 0)),
        drive_file_id: fileId,
        drive_url: driveUrl,
        tanggal_upload: nowIso(),
        ...(targetSheet === 'KARYA_SISWA'
          ? {
              tanggal_pengumpulan: record.tanggal_pengumpulan || nowIso().slice(0, 10),
              apresiasi_count: record.apresiasi_count || '0',
              pengunggah: email,
              status_publikasi:
                role === 'ADMIN' ? record.status_publikasi || 'Dipublikasikan' : 'Dipublikasikan',
            }
          : {
              pemilik: record.pemilik || email,
            }),
      };

      const row = objectToRow(fullRecord, SHEET_HEADERS[targetSheet]);
      await appendSheetRows(token, spreadsheetId, targetSheet, [row]);
      await logActivity(
        token,
        spreadsheetId,
        email,
        role,
        'UPLOAD',
        targetSheet,
        fullRecord.judul_karya || fullRecord.judul || fileName,
        `Mengunggah ${fileName} (${fullRecord.ukuran_file}) ke Google Drive`
      );

      res.json({ ok: true, fileId, driveUrl, record: fullRecord });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Gagal mencatat berkas ke Google Sheets.',
      });
    }
  });

  app.get('/api/drive/file/:fileId', requireGoogleAuth, async (req: AuthedRequest, res) => {
    try {
      const token = req.accessToken!;
      const fileId = req.params.fileId;
      const isDownload = req.query.download === '1';

      const meta = (await googleFetch(
        `${DRIVE_API}/files/${encodeURIComponent(fileId)}?fields=name,mimeType`,
        token
      )) as { name: string; mimeType: string };

      const mediaRes = await fetch(
        `${DRIVE_API}/files/${encodeURIComponent(fileId)}?alt=media`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!mediaRes.ok) {
        res.status(mediaRes.status).json({ error: 'Gagal mengambil berkas dari Google Drive.' });
        return;
      }

      const arrayBuffer = await mediaRes.arrayBuffer();
      res.setHeader('Content-Type', meta.mimeType || 'application/octet-stream');
      res.setHeader(
        'Content-Disposition',
        `${isDownload ? 'attachment' : 'inline'}; filename="${encodeURIComponent(meta.name)}"`
      );
      res.send(Buffer.from(arrayBuffer));
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Gagal mengakses file Google Drive.',
      });
    }
  });

  app.post('/api/sheets/:sheetName', requireGoogleAuth, async (req: AuthedRequest, res) => {
    try {
      const token = req.accessToken!;
      const email = req.userEmail!;
      const sheetName = req.params.sheetName.toUpperCase();
      const { spreadsheetId, record } = req.body as {
        spreadsheetId: string;
        record: Record<string, string>;
      };

      if (!spreadsheetId || !SHEET_HEADERS[sheetName]) {
        res.status(400).json({ error: 'Parameter spreadsheetId atau nama sheet tidak valid.' });
        return;
      }

      const role = await getAuthoritativeRoleForRequest(token, email, spreadsheetId);
      if (role !== 'ADMIN') {
        res.status(403).json({ error: 'Hanya Guru/Administrator yang dapat menambahkan data ini.' });
        return;
      }

      const idPrefix = sheetName.slice(0, 3);
      const newRecord: Record<string, string> = {
        ...record,
        id: record.id || generateId(idPrefix),
      };
      if (sheetName === 'USERS') {
        newRecord.dibuat_pada = newRecord.dibuat_pada || nowIso();
        newRecord.terakhir_login = newRecord.terakhir_login || nowIso();
      }

      const row = objectToRow(newRecord, SHEET_HEADERS[sheetName]);
      await appendSheetRows(token, spreadsheetId, sheetName, [row]);
      await logActivity(
        token,
        spreadsheetId,
        email,
        role,
        'TAMBAH',
        sheetName,
        newRecord.nama_kelas || newRecord.nama_siswa || newRecord.nama_kategori || newRecord.email || newRecord.id,
        `Menambahkan data pada ${sheetName}`
      );

      res.json({ ok: true, record: newRecord });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Gagal menyimpan data.' });
    }
  });

  app.post('/api/sheets/DATA_SISWA/batch', requireGoogleAuth, async (req: AuthedRequest, res) => {
    try {
      const token = req.accessToken!;
      const email = req.userEmail!;
      const { spreadsheetId, records } = req.body as {
        spreadsheetId: string;
        records: Array<Record<string, string>>;
      };

      if (!spreadsheetId || !Array.isArray(records) || records.length === 0) {
        res.status(400).json({ error: 'Data siswa untuk diimpor kosong.' });
        return;
      }

      const role = await getAuthoritativeRoleForRequest(token, email, spreadsheetId);
      if (role !== 'ADMIN') {
        res.status(403).json({ error: 'Hanya Guru/Administrator yang dapat mengimpor data siswa.' });
        return;
      }

      const existingRes = (await googleFetch(
        `${SHEETS_API}/${spreadsheetId}/values/${encodeURIComponent('DATA_SISWA!A1:I5000')}`,
        token
      )) as { values?: string[][] };
      const existing = rowsToObjects(existingRes.values, SHEET_HEADERS.DATA_SISWA);
      const existingKeys = new Set(
        existing.map((s) => `${s.nis.trim().toLowerCase()}::${s.nama_siswa.trim().toLowerCase()}`)
      );

      const newRecords: Array<Record<string, string>> = [];
      for (const item of records) {
        const key = `${(item.nis || '').trim().toLowerCase()}::${(item.nama_siswa || '').trim().toLowerCase()}`;
        if (!item.nama_siswa?.trim() || existingKeys.has(key)) continue;
        existingKeys.add(key);
        newRecords.push({
          id: generateId('SIS'),
          nis: (item.nis || '').trim(),
          nama_siswa: item.nama_siswa.trim(),
          kelas: (item.kelas || '').trim(),
          jenis_kelamin: (item.jenis_kelamin || 'L/P').trim(),
          email: (item.email || '').trim(),
          foto_url: '',
          tahun_ajaran: (item.tahun_ajaran || '2026/2027').trim(),
          status: 'Aktif',
        });
      }

      if (newRecords.length === 0) {
        res.json({ ok: true, importedCount: 0, records: [] });
        return;
      }

      const rows = newRecords.map((r) => objectToRow(r, SHEET_HEADERS.DATA_SISWA));
      await appendSheetRows(token, spreadsheetId, 'DATA_SISWA', rows);
      await logActivity(
        token,
        spreadsheetId,
        email,
        role,
        'IMPORT',
        'DATA_SISWA',
        `${newRecords.length} Siswa`,
        `Mengimpor ${newRecords.length} data siswa dari Excel/CSV`
      );

      res.json({ ok: true, importedCount: newRecords.length, records: newRecords });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Gagal mengimpor siswa.' });
    }
  });

  app.put('/api/sheets/:sheetName/:id', requireGoogleAuth, async (req: AuthedRequest, res) => {
    try {
      const token = req.accessToken!;
      const email = req.userEmail!;
      const sheetName = req.params.sheetName.toUpperCase();
      const id = req.params.id;
      const { spreadsheetId, updates } = req.body as {
        spreadsheetId: string;
        updates: Record<string, string>;
      };

      if (!spreadsheetId || !SHEET_HEADERS[sheetName]) {
        res.status(400).json({ error: 'Parameter update tidak valid.' });
        return;
      }

      const role = await getAuthoritativeRoleForRequest(token, email, spreadsheetId);
      const isAppreciationOnly =
        sheetName === 'KARYA_SISWA' &&
        Object.keys(updates).length === 1 &&
        Object.prototype.hasOwnProperty.call(updates, 'apresiasi_count');

      if (role === 'PENGUNJUNG') {
        res.status(403).json({ error: 'Pengunjung tidak memiliki izin mengubah data.' });
        return;
      }
      if (role === 'SISWA' && !isAppreciationOnly && sheetName !== 'KARYA_SISWA') {
        res.status(403).json({ error: 'Siswa tidak memiliki izin mengubah data administrasi.' });
        return;
      }

      if (role === 'SISWA' && sheetName === 'KARYA_SISWA' && !isAppreciationOnly) {
        const currentRes = (await googleFetch(
          `${SHEETS_API}/${spreadsheetId}/values/${encodeURIComponent('KARYA_SISWA!A1:T5000')}`,
          token
        )) as { values?: string[][] };
        const karyaRows = rowsToObjects(currentRes.values, SHEET_HEADERS.KARYA_SISWA);
        const target = karyaRows.find((k) => k.id === id);
        if (!target || target.pengunggah.toLowerCase() !== email.toLowerCase()) {
          res.status(403).json({ error: 'Siswa hanya dapat mengedit karya miliknya sendiri.' });
          return;
        }
      }

      const updated = await updateSheetRowById(token, spreadsheetId, sheetName, id, updates);

      if (sheetName === 'PENGATURAN' && updates.nilai && updated.kunci === 'gas_webapp_url') {
        activePublicGasUrl = updates.nilai;
      }

      if (!isAppreciationOnly) {
        await logActivity(
          token,
          spreadsheetId,
          email,
          role,
          'EDIT',
          sheetName,
          updated.judul_karya || updated.judul || updated.nama_kelas || updated.nama_website || id,
          `Memperbarui data pada ${sheetName}`
        );
      }

      res.json({ ok: true, record: updated });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Gagal memperbarui data.' });
    }
  });

  app.put('/api/settings/batch', requireGoogleAuth, async (req: AuthedRequest, res) => {
    try {
      const token = req.accessToken!;
      const email = req.userEmail!;
      const { spreadsheetId, settings } = req.body as {
        spreadsheetId: string;
        settings: Array<{ kunci: string; nilai: string; deskripsi?: string }>;
      };

      const role = await getAuthoritativeRoleForRequest(token, email, spreadsheetId);
      if (role !== 'ADMIN') {
        res.status(403).json({ error: 'Hanya Guru/Administrator yang dapat mengubah pengaturan.' });
        return;
      }

      const existingRes = (await googleFetch(
        `${SHEETS_API}/${spreadsheetId}/values/${encodeURIComponent('PENGATURAN!A1:D500')}`,
        token
      )) as { values?: string[][] };
      const existing = rowsToObjects(existingRes.values, SHEET_HEADERS.PENGATURAN);

      for (const item of settings) {
        if (item.kunci === 'gas_webapp_url') {
          activePublicGasUrl = item.nilai;
        }
        const found = existing.find((e) => e.kunci === item.kunci);
        if (found) {
          await updateSheetRowById(token, spreadsheetId, 'PENGATURAN', found.id, { nilai: item.nilai });
        } else {
          await appendSheetRows(token, spreadsheetId, 'PENGATURAN', [
            objectToRow(
              {
                id: generateId('SET'),
                kunci: item.kunci,
                nilai: item.nilai,
                deskripsi: item.deskripsi || item.kunci,
              },
              SHEET_HEADERS.PENGATURAN
            ),
          ]);
        }
      }

      await logActivity(token, spreadsheetId, email, role, 'PENGATURAN', 'PENGATURAN', 'Konfigurasi Sistem', 'Memperbarui pengaturan website dan integrasi Workspace');
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Gagal menyimpan pengaturan.' });
    }
  });

  app.delete('/api/archive/:sheetName/:id', requireGoogleAuth, async (req: AuthedRequest, res) => {
    try {
      const token = req.accessToken!;
      const email = req.userEmail!;
      const sheetName = req.params.sheetName.toUpperCase();
      const id = req.params.id;
      const spreadsheetId = String(req.query.spreadsheetId || '').trim();

      if (!spreadsheetId || !SHEET_HEADERS[sheetName]) {
        res.status(400).json({ error: 'Spreadsheet ID atau nama sheet tidak valid.' });
        return;
      }

      const role = await getAuthoritativeRoleForRequest(token, email, spreadsheetId);
      if (role !== 'ADMIN') {
        res.status(403).json({ error: 'Hanya Guru/Administrator yang dapat menghapus arsip secara permanen.' });
        return;
      }

      const deletedObj = await deleteSheetRowById(token, spreadsheetId, sheetName, id);
      if (!deletedObj) {
        res.status(404).json({ error: 'Data tidak ditemukan.' });
        return;
      }

      const driveFileId = deletedObj.drive_file_id;
      if (driveFileId) {
        try {
          await googleFetch(`${DRIVE_API}/files/${encodeURIComponent(driveFileId)}`, token, {
            method: 'DELETE',
          });
        } catch (driveErr) {
          const status = (driveErr as { status?: number })?.status;
          if (status !== 404) {
            throw driveErr;
          }
        }
      }

      await logActivity(
        token,
        spreadsheetId,
        email,
        role,
        'HAPUS',
        sheetName,
        deletedObj.judul_karya || deletedObj.judul || deletedObj.nama_kelas || deletedObj.nama_siswa || id,
        driveFileId
          ? `Menghapus data dan file permanen dari Google Drive (${driveFileId})`
          : `Menghapus data dari sheet ${sheetName}`
      );

      res.json({ ok: true, deletedId: id, deletedDriveFileId: driveFileId || null });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Gagal menghapus data secara permanen.',
      });
    }
  });

  // Ensure Express middleware errors (like PayloadTooLargeError) always return JSON rather than HTML
  app.use((err: Error & { status?: number; type?: string }, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || (err.type === 'entity.too.large' ? 413 : 500);
    const message =
      status === 413
        ? 'Ukuran file melebihi batas unggahan server. Kompres file terlebih dahulu atau gunakan file lebih kecil.'
        : err.message || 'Terjadi kesalahan internal pada server API.';
    res.status(status).json({ error: message });
  });

  return app;
}
