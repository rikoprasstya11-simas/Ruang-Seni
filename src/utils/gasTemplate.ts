export function generateGoogleAppsScriptCode(spreadsheetId = '', rootFolderId = ''): string {
  return `/**
 * SENI RUANG — Google Apps Script Web App API Bridge
 * Menghubungkan Website SENI RUANG (termasuk deploy Vercel) dengan Google Sheets & Google Drive.
 *
 * Fitur Utama:
 * - Menampilkan Hasil Karya Terbaru di Halaman Depan (publicGallery)
 * - Menerima Unggahan Karya / Tugas Mandiri dari Siswa tanpa login admin (studentUpload)
 * - Menyimpan file ke folder kelas (KELAS_VII / KELAS_VIII / KELAS_IX) di Google Drive
 * - Mencatat metadata otomatis ke Google Sheets (KARYA_SISWA & AKTIVITAS)
 *
 * Cara Deploy:
 * 1. Buka https://script.google.com -> Project Baru -> Tempel seluruh kode ini ke Code.gs
 * 2. Isi SPREADSHEET_ID dan ROOT_FOLDER_ID di bawah
 * 3. Klik Deploy -> New deployment -> Web app
 * 4. Execute as: Me | Who has access: Anyone
 * 5. Salin Web App URL dan tempel ke Vercel Environment Variable: VITE_GAS_WEBAPP_URL
 *    (atau ke menu Pengaturan Website -> Google Drive, Sheets & GAS di SENI RUANG).
 */

const CONFIG = {
  SPREADSHEET_ID: '${spreadsheetId || 'ISI_SPREADSHEET_ID_ANDA'}',
  ROOT_FOLDER_ID: '${rootFolderId || 'ISI_ROOT_FOLDER_ID_ANDA'}',
};

const SHEET_NAMES = [
  'USERS',
  'IDENTITAS_WEBSITE',
  'KELAS',
  'DATA_SISWA',
  'ADMINISTRASI',
  'KARYA_SISWA',
  'DOKUMENTASI',
  'KATEGORI_DOKUMEN',
  'KATEGORI_KARYA',
  'AKTIVITAS',
  'PENGATURAN',
];

function doGet(e) {
  try {
    const action = (e && e.parameter && e.parameter.action) || 'ping';
    if (action === 'ping') {
      return jsonResponse({ ok: true, service: 'SENI RUANG GAS API', timestamp: new Date().toISOString() });
    }
    if (action === 'publicGallery') {
      const allKarya = readSheetObjects('KARYA_SISWA');
      const published = allKarya.filter(function(item) {
        return item.status_publikasi === 'Dipublikasikan' || item.status_publikasi === 'Karya Pilihan';
      }).reverse();
      const identitas = readSheetObjects('IDENTITAS_WEBSITE')[0] || {};
      const kelas = readSheetObjects('KELAS').map(function(k) { return k.nama_kelas; });
      const kategoriKarya = readSheetObjects('KATEGORI_KARYA').map(function(k) { return k.nama_kategori; });
      const pengaturan = readSheetObjects('PENGATURAN');
      var galeriAktif = 'Ya';
      pengaturan.forEach(function(p) {
        if (p.kunci === 'galeri_publik_aktif') galeriAktif = p.nilai || 'Ya';
      });
      return jsonResponse({
        ok: true,
        galeriAktif: galeriAktif === 'Ya',
        identitas: identitas,
        kelas: kelas,
        kategoriKarya: kategoriKarya,
        karya: galeriAktif === 'Ya' ? published : [],
      });
    }
    if (action === 'readSheet') {
      const sheetName = e.parameter.sheet;
      if (SHEET_NAMES.indexOf(sheetName) === -1) {
        return jsonResponse({ ok: false, error: 'Nama sheet tidak valid' });
      }
      return jsonResponse({ ok: true, data: readSheetObjects(sheetName) });
    }
    if (action === 'rekap') {
      return jsonResponse({
        ok: true,
        rekap: {
          administrasi: readSheetObjects('ADMINISTRASI').length,
          dokumentasi: readSheetObjects('DOKUMENTASI').length,
          karya: readSheetObjects('KARYA_SISWA').length,
          kelas: readSheetObjects('KELAS').length,
          siswa: readSheetObjects('DATA_SISWA').length,
        },
      });
    }
    return jsonResponse({ ok: false, error: 'Action tidak dikenali' });
  } catch (err) {
    return jsonResponse({ ok: false, error: err.message });
  }
}

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents || '{}');
    const action = payload.action;

    if (action === 'studentUpload') {
      if (!payload.judul_karya || !payload.nama_siswa || !payload.kelas || !payload.base64Data) {
        return jsonResponse({ ok: false, error: 'Judul karya, nama siswa, kelas, dan file karya wajib diisi.' });
      }

      const folderId = resolveClassFolderId(payload.kelas);
      const folder = DriveApp.getFolderById(folderId);
      const bytes = Utilities.base64Decode(payload.base64Data);
      const mimeType = payload.mimeType || 'image/jpeg';
      const fileName = payload.fileName || (payload.judul_karya + '.jpg');
      const blob = Utilities.newBlob(bytes, mimeType, fileName);
      const file = folder.createFile(blob);
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

      const now = new Date();
      const id = 'KRY-' + now.getTime().toString(36).toUpperCase();
      const ext = fileName.indexOf('.') !== -1 ? fileName.split('.').pop().toUpperCase() : 'JPG';
      const identitas = readSheetObjects('IDENTITAS_WEBSITE')[0] || {};
      const record = {
        id: id,
        judul_karya: String(payload.judul_karya).trim(),
        nama_siswa: String(payload.nama_siswa).trim(),
        nis_siswa: String(payload.nis_siswa || '').trim(),
        kelas: String(payload.kelas).trim(),
        tahun_ajaran: String(payload.tahun_ajaran || identitas.tahun_ajaran_aktif || '2026/2027'),
        semester: String(payload.semester || identitas.semester_aktif || 'Ganjil'),
        kategori_seni: String(payload.kategori_seni || 'Seni Lukis'),
        deskripsi_karya: String(payload.deskripsi_karya || '').trim(),
        teknik_berkarya: String(payload.teknik_berkarya || '').trim(),
        media_bahan: String(payload.media_bahan || '').trim(),
        tanggal_pengumpulan: now.toISOString().slice(0, 10),
        nama_file: fileName,
        format_file: ext,
        ukuran_file: formatSize(bytes.length),
        drive_file_id: file.getId(),
        drive_url: file.getUrl(),
        status_publikasi: 'Dipublikasikan',
        apresiasi_count: '0',
        pengunggah: String(payload.nama_siswa).trim() + ' (Siswa)',
      };

      appendRowObject('KARYA_SISWA', record);
      appendRowObject('AKTIVITAS', {
        id: 'ACT-' + now.getTime().toString(36).toUpperCase(),
        waktu: now.toISOString(),
        pengguna: record.nama_siswa,
        role: 'SISWA',
        aksi: 'UPLOAD_MANDIRI',
        modul: 'KARYA_SISWA',
        judul_item: record.judul_karya,
        keterangan: 'Siswa kelas ' + record.kelas + ' mengunggah karya ' + fileName,
      });

      return jsonResponse({ ok: true, record: record });
    }

    if (action === 'appendRow') {
      const result = appendRowObject(payload.sheet, payload.data);
      return jsonResponse({ ok: true, data: result });
    }
    if (action === 'updateRow') {
      const updated = updateRowById(payload.sheet, payload.id, payload.data);
      return jsonResponse({ ok: updated });
    }
    if (action === 'deleteRow') {
      const deleted = deleteRowById(payload.sheet, payload.id, payload.driveFileId);
      return jsonResponse({ ok: deleted });
    }
    if (action === 'uploadFile') {
      const folderId = payload.folderId || CONFIG.ROOT_FOLDER_ID;
      const folder = DriveApp.getFolderById(folderId);
      const bytes = Utilities.base64Decode(payload.base64Data);
      const blob = Utilities.newBlob(bytes, payload.mimeType, payload.fileName);
      const file = folder.createFile(blob);
      if (payload.isPublic) {
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      }
      return jsonResponse({
        ok: true,
        fileId: file.getId(),
        url: file.getUrl(),
        downloadUrl: 'https://drive.google.com/uc?export=download&id=' + file.getId(),
      });
    }
    return jsonResponse({ ok: false, error: 'Action POST tidak dikenali' });
  } catch (err) {
    return jsonResponse({ ok: false, error: err.message });
  }
}

function resolveClassFolderId(kelasName) {
  const settings = readSheetObjects('PENGATURAN');
  var key = 'folder_karya_vii_id';
  if (String(kelasName).indexOf('IX') === 0) key = 'folder_karya_ix_id';
  else if (String(kelasName).indexOf('VIII') === 0) key = 'folder_karya_viii_id';

  for (var i = 0; i < settings.length; i++) {
    if (settings[i].kunci === key && settings[i].nilai) {
      return settings[i].nilai;
    }
  }
  return CONFIG.ROOT_FOLDER_ID;
}

function formatSize(bytes) {
  if (!bytes || bytes <= 0) return '0 B';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function readSheetObjects(sheetName) {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0];
  return values.slice(1).filter(function(r) { return r[0] !== ''; }).map(function(row) {
    const obj = {};
    headers.forEach(function(h, idx) {
      obj[String(h)] = row[idx] !== undefined && row[idx] !== null ? String(row[idx]) : '';
    });
    return obj;
  });
}

function appendRowObject(sheetName, obj) {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const sheet = ss.getSheetByName(sheetName);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const row = headers.map(function(h) { return obj[h] !== undefined ? obj[h] : ''; });
  sheet.appendRow(row);
  return obj;
}

function updateRowById(sheetName, id, partialObj) {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const sheet = ss.getSheetByName(sheetName);
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][0]) === String(id)) {
      headers.forEach(function(h, colIdx) {
        if (partialObj[h] !== undefined) {
          sheet.getRange(i + 1, colIdx + 1).setValue(partialObj[h]);
        }
      });
      return true;
    }
  }
  return false;
}

function deleteRowById(sheetName, id, driveFileId) {
  if (driveFileId) {
    try {
      DriveApp.getFileById(driveFileId).setTrashed(true);
    } catch (e) {}
  }
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const sheet = ss.getSheetByName(sheetName);
  const values = sheet.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][0]) === String(id)) {
      sheet.deleteRow(i + 1);
      return true;
    }
  }
  return false;
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
`;
}
