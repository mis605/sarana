/**
 * Google Apps Script (GAS) Rest API for Ceklist Sarana Gedung
 * Copy seluruh isi file ini ke Google Apps Script (misal: api.gs)
 * Lalu pilih Deploy > New Deployment > Web App
 * Execute as: Me
 * Who has access: Anyone
 */

const FOLDER_ID = "11gB1Jkjkqa24qifa1QtkwbK8cxIa4wW9";      // Folder Google Drive Simpan Foto
const SPREADSHEET_ID = "1mQ6Gfb83KkU_qUAYP-tjjlOui8OjZhxA5JBqIbygPPk"; // ID Spreadsheet Data & Config
const SHEET_DATA_NAME = "data";                       // Nama Sheet Riwayat Data
const SHEET_CONFIG_NAME = "db";                        // Nama Sheet Konfigurasi
const SHEET_PETUGAS_NAME = "petugas";                  // Nama Sheet Daftar Petugas

/**
 * Helper untuk membuka Spreadsheet (berlaku untuk container-bound maupun standalone script)
 */
function getSpreadsheet() {
  try {
    const active = SpreadsheetApp.getActiveSpreadsheet();
    if (active) return active;
  } catch (e) {}
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

/**
 * JALANKAN FUNGSI INI SEKALI DI EDITOR APPS SCRIPT (klik Run / Jalankan)
 * untuk memberikan izin akses OAuth ke DriveApp & SpreadsheetApp jika diminta Google.
 */
function testDriveAndSheetAccess() {
  const folder = DriveApp.getFolderById(FOLDER_ID);
  Logger.log("Akses Folder Drive Sukses: " + folder.getName());
  const ss = getSpreadsheet();
  Logger.log("Akses Spreadsheet Sukses: " + ss.getName());
}

function doGet(e) {
  try {
    const action = e && e.parameter ? e.parameter.action : null;
    
    if (action === "dashboard") {
      return responseJSON(getDashboardData());
    }
    
    if (action === "getProgress") {
      const petugas = e.parameter.petugas;
      const ruangan = e.parameter.ruangan;
      const reportType = e.parameter.reportType;
      return responseJSON(getProgressData(petugas, ruangan, reportType));
    }

    // Default: return config data
    const config = getAppConfig();
    return responseJSON(config);
  } catch (err) {
    return responseJSON({ status: "error", message: err.toString() });
  }
}

function doPost(e) {
  try {
    let postData = {};
    if (e && e.postData && e.postData.contents) {
      postData = JSON.parse(e.postData.contents);
    }

    const action = postData.action;

    if (action === "upload") {
      const result = handleUpload(postData);
      return responseJSON(result);
    }

    if (action === "submit") {
      const result = handleSubmit(postData.formData);
      return responseJSON(result);
    }

    if (action === "getProgress") {
      const result = getProgressData(postData.petugas, postData.ruangan, postData.reportType);
      return responseJSON(result);
    }

    if (action === "dashboard") {
      const result = getDashboardData();
      return responseJSON(result);
    }

    return responseJSON({ status: "error", message: "Action tidak dikenal" });

  } catch (err) {
    return responseJSON({ status: "error", message: err.toString() });
  }
}

function responseJSON(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function getAppConfig() {
  const ss = getSpreadsheet();
  
  const settings = {
    app_title: "Ceklist Sarana Gedung",
    folder_id: FOLDER_ID,
    sheet_data: SHEET_DATA_NAME,
    sheet_config: SHEET_CONFIG_NAME
  };

  // Fallback default petugas
  let petugas = [
    { nama: "Muhamad Tajudin", unit: "Facility Management" },
    { nama: "Wahyu", unit: "Facility Management" },
    { nama: "Anom", unit: "Facility Management" }
  ];

  // Fallback default lokasi
  let lokasi = [
    { nama: "Lantai 1", pic: "Muhamad Tajudin", kategori: "Office_Tajudin" },
    { nama: "Lantai 3", pic: "Muhamad Tajudin", kategori: "Office_Tajudin" },
    { nama: "Lobby", pic: "Muhamad Tajudin", kategori: "Lobby" },
    { nama: "Basement", pic: "Wahyu", kategori: "Basement" },
    { nama: "Lantai 2", pic: "Wahyu", kategori: "Office_Wahyu" },
    { nama: "Lantai 5", pic: "Wahyu", kategori: "Lantai_5" },
    { nama: "Rooftop", pic: "Anom", kategori: "Rooftop" }
  ];

  // 1. Dapatkan data Petugas dari Sheet 'petugas' (atau 'Petugas') secara Dinamis
  const petugasSheet = ss.getSheetByName(SHEET_PETUGAS_NAME) || ss.getSheetByName("Petugas");
  if (petugasSheet) {
    try {
      const pData = petugasSheet.getDataRange().getValues();
      if (pData && pData.length > 1) {
        const headerRow = pData[0].map(c => String(c).toLowerCase().trim());
        
        let colNamaIdx = headerRow.findIndex(h => h.includes("nama") || h.includes("petugas"));
        let colUnitIdx = headerRow.findIndex(h => h.includes("unit") || h.includes("jabatan") || h.includes("divisi"));
        let colStatusIdx = headerRow.findIndex(h => h.includes("status"));

        if (colNamaIdx === -1) colNamaIdx = 0;
        if (colUnitIdx === -1) colUnitIdx = 1;
        if (colStatusIdx === -1) colStatusIdx = 2;

        const dynamicPetugas = [];
        for (let r = 1; r < pData.length; r++) {
          const row = pData[r];
          if (!row || row.length === 0) continue;

          const nama = String(row[colNamaIdx] || "").trim();
          const unit = String(row[colUnitIdx] || "Facility Management").trim();
          const status = String(row[colStatusIdx] || "Aktif").trim().toLowerCase();

          if (nama && !nama.toLowerCase().startsWith("nama") && !nama.toLowerCase().startsWith("petugas")) {
            const isNonAktif = status.includes("non") || status.includes("tidak") || status === "off" || status === "0" || status === "false";
            if (!isNonAktif) {
              dynamicPetugas.push({ nama: nama, unit: unit });
            }
          }
        }
        if (dynamicPetugas.length > 0) {
          petugas = dynamicPetugas;
        }
      }
    } catch (errPetugas) {
      Logger.log("Error membaca sheet 'petugas': " + errPetugas.toString());
    }
  }

  // 3. Dapatkan data Settings dari Sheet 'settings', 'Settings', atau 'db' jika ada
  const settingsSheet = ss.getSheetByName("settings") || ss.getSheetByName("Settings") || ss.getSheetByName(SHEET_CONFIG_NAME);
  if (settingsSheet) {
    try {
      const sData = settingsSheet.getDataRange().getValues();
      if (sData && sData.length > 0) {
        sData.forEach(row => {
          if (row && row.length >= 2) {
            const key = String(row[0] || "").trim().toLowerCase();
            const val = String(row[1] || "").trim();
            if (key && val) {
              if (key.includes("title") || key.includes("judul") || key.includes("app")) settings.app_title = val;
              if (key.includes("folder")) settings.folder_id = val;
            }
          }
        });
      }
    } catch (errSettings) {
      Logger.log("Error membaca sheet 'settings': " + errSettings.toString());
    }
  }

  const officeDailyItems = [
    { id: "h_meja", label: "Dusting Meja", col: 6 },
    { id: "h_pintu", label: "Pintu Kaca & Pintu Kayu", col: 7 },
    { id: "h_mop", label: "Sweeping & Mopping Lantai & Karpet", col: 8 },
    { id: "h_sampah", label: "Membuang Sampah", col: 9 },
    { id: "h_toilet_wc", label: "Bersihkan Lantai Toilet & Closet", col: 10 },
    { id: "h_closet", label: "Bersihkan Urinoir", col: 11 },
    { id: "h_cermin", label: "Bersihkan Kaca Cermin", col: 12 },
    { id: "h_tissue", label: "Mengisi Tissue Rol (Terisi)", col: 13 },
    { id: "h_pantry", label: "Cleaning Pantry & Cek Galon", col: 14 }
  ];

  const officeWeeklyItems = [
    { id: "m_kayu", label: "Dusting List-list Kayu", col: 15 },
    { id: "m_lampu", label: "Dusting Kap Lampu", col: 16 },
    { id: "m_vacum", label: "Vacuum Karpet", col: 17 },
    { id: "m_toilet_dnd", label: "Dusting Dinding Toilet", col: 18 },
    { id: "m_drain", label: "Bersihkan Floor Drain", col: 19 },
    { id: "m_exhaust", label: "Bersihkan Exhaust Fan", col: 20 },
    { id: "m_handsoap", label: "Dispenser Handsoap (Terisi)", col: 21 }
  ];

  const officeMonthlyTajudin = [
    { id: "b_karpet", label: "Cuci Karpet Lt. 1, 3", col: 23 },
    { id: "b_glass", label: "Glass Cleaning Kaca Lt. 1, 3", col: 24 },
    { id: "b_coating", label: "Coating Vinyl Lt. 1, 3", col: 26 }
  ];

  const officeMonthlyWahyu = [
    { id: "b_karpet", label: "Cuci Karpet Lt. 2, 5", col: 23 },
    { id: "b_glass", label: "Glass Cleaning Kaca Lt. 2, 5", col: 24 },
    { id: "b_coating", label: "Coating Vinyl Lt. 2, 5", col: 26 }
  ];

  const checklist = {
    Harian: {
      Office_Tajudin: { "Pekerjaan Office": officeDailyItems },
      Office_Wahyu: { "Pekerjaan Lantai 2": officeDailyItems },
      Lantai_5: { "Pekerjaan Lantai 5": officeDailyItems.slice(0, 8) },
      Lobby: {
        "Pekerjaan Lobby": [
          { id: "h_pintu", label: "Pintu Kaca & Pintu Kayu", col: 7 },
          { id: "h_mop", label: "Sweeping & Mopping Lantai", col: 8 },
          { id: "h_sampah", label: "Membuang Sampah", col: 9 },
          { id: "h_toilet_wc", label: "Bersihkan Lantai Toilet & Closet", col: 10 },
          { id: "h_closet", label: "Bersihkan Urinoir", col: 11 },
          { id: "h_cermin", label: "Bersihkan Kaca Cermin", col: 12 },
          { id: "h_tissue", label: "Mengisi Tissue Rol (Terisi)", col: 13 }
        ]
      },
      Basement: {
        "Pekerjaan Basement": [
          { id: "h_pintu", label: "Pintu Kayu/Besi", col: 7 },
          { id: "h_mop", label: "Sweeping & Mopping Lantai", col: 8 },
          { id: "h_sampah", label: "Membuang Sampah", col: 9 },
          { id: "h_toilet_wc", label: "Bersihkan Lantai Toilet & Closet", col: 10 },
          { id: "h_closet", label: "Bersihkan Tempat Wudhu", col: 11 },
          { id: "h_cermin", label: "Bersihkan Kaca Cermin", col: 12 }
        ]
      },
      Rooftop: { "Rooftop": [{ id: "h_sampah", label: "Membuang Sampah", col: 31 }] }
    },
    Mingguan: {
      Office_Tajudin: { "Pekerjaan Mingguan - Office": officeWeeklyItems },
      Office_Wahyu: { "Pekerjaan Mingguan - Lantai 2": officeWeeklyItems },
      Lantai_5: { "Pekerjaan Mingguan - Lantai 5": officeWeeklyItems },
      Lobby: {
        "Pekerjaan Mingguan - Lobby": [
          { id: "m_kayu", label: "Dusting List-list Kayu", col: 15 },
          { id: "m_lampu", label: "Dusting Kap Lampu", col: 16 },
          { id: "m_tangga", label: "Sweeping & Mopping Tangga", col: 22 },
          { id: "m_toilet_dnd", label: "Dusting Dinding Toilet", col: 18 },
          { id: "m_drain", label: "Bersihkan Floor Drain", col: 19 },
          { id: "m_exhaust", label: "Bersihkan Exhaust Fan", col: 20 },
          { id: "m_handsoap", label: "Dispenser Handsoap (Terisi)", col: 21 }
        ]
      },
      Basement: {
        "Pekerjaan Mingguan - Basement": [
          { id: "m_kayu", label: "Dusting List-list Kayu", col: 15 },
          { id: "m_tangga", label: "Sweeping & Mopping Tangga", col: 22 },
          { id: "m_toilet_dnd", label: "Dusting Dinding Toilet", col: 18 },
          { id: "m_drain", label: "Bersihkan Floor Drain", col: 19 },
          { id: "m_exhaust", label: "Bersihkan Exhaust Fan", col: 20 },
          { id: "m_handsoap", label: "Dispenser Handsoap (Terisi)", col: 21 }
        ]
      }
    },
    Bulanan: {
      Office_Tajudin: { "Pekerjaan Bulanan - Office": officeMonthlyTajudin },
      Office_Wahyu: { "Pekerjaan Bulanan - Office": officeMonthlyWahyu },
      Lantai_5: { "Pekerjaan Bulanan - Office": officeMonthlyWahyu },
      Lobby: {
        "Pekerjaan Bulanan - Lobby": [
          { id: "b_glass", label: "Glass Cleaning Kaca Lt. Lobby", col: 24 },
          { id: "b_coating", label: "Coating Vinyl Lt. Lobby", col: 26 },
          { id: "b_grease", label: "Cleaning GreaseTrap Lt. Lobby", col: 27 },
          { id: "b_aloco", label: "Cleaning Alocobone Lobby", col: 28 },
          { id: "b_balkon", label: "Cleaning Balkon Lt. Lobby", col: 30 }
        ]
      },
      Basement: {
        "Pekerjaan Bulanan - Basement": [
          { id: "b_washing", label: "Washing Parkiran Basement", col: 25 },
          { id: "b_grease", label: "Cleaning GreaseTrap Basement", col: 27 },
          { id: "b_rolling", label: "Cleaning Rolling Door Basement", col: 29 }
        ]
      }
    }
  };

  return { status: "success", settings: settings, petugas: petugas, lokasi: lokasi, checklist: checklist };
}

function getItemColumnMap() {
  const config = getAppConfig();
  const map = {};
  const checklist = config.checklist;
  
  for (const reportType in checklist) {
    for (const kategori in checklist[reportType]) {
      for (const section in checklist[reportType][kategori]) {
        const items = checklist[reportType][kategori][section];
        if (Array.isArray(items)) {
          items.forEach(item => {
            if (item.id && item.col !== undefined) {
              map[item.id] = item.col;
            }
          });
        }
      }
    }
  }
  return map;
}

function handleUpload(data) {
  const folder = DriveApp.getFolderById(FOLDER_ID);
  const blob = Utilities.newBlob(Utilities.base64Decode(data.base64), "image/jpeg", data.fileName || "foto.jpg");
  const file = folder.createFile(blob);
  
  // Di Google Workspace (@gos.co.id), pemanggilan setSharing programatik dibungkus try-catch agar tidak error
  try {
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (e) {
    Logger.log("setSharing dilewati karena izin diwariskan dari folder induk: " + e.toString());
  }
  
  // Format URL thumbnail Google Drive
  const fileId = file.getId();
  const webUrl = "https://drive.google.com/thumbnail?id=" + fileId + "&sz=w500";
  return { status: "success", url: webUrl, fileId: fileId };
}

function handleSubmit(formData) {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_DATA_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_DATA_NAME);
  }

  const now = new Date();
  const timeZone = Session.getScriptTimeZone();
  const fullTimestamp = Utilities.formatDate(now, timeZone, "dd/MM/yyyy HH:mm:ss");
  const dateOnly = Utilities.formatDate(now, timeZone, "dd/MM/yyyy");

  // Anti-duplikasi: cegah penulisan ulang jika submit persis sama diterima berturut-turut
  const lastRowIdx = sheet.getLastRow();
  if (lastRowIdx > 1) {
    try {
      const lastRowValues = sheet.getRange(lastRowIdx, 1, 1, 6).getValues()[0];
      const lastTanggal = formatCellDate(lastRowValues[1]);
      const lastPetugas = String(lastRowValues[2] || "").trim();
      const lastRuangan = String(lastRowValues[3] || "").trim();
      const lastType = String(lastRowValues[4] || "Harian").trim();

      if (lastTanggal === dateOnly && 
          lastPetugas === String(formData.petugas || "").trim() && 
          lastRuangan === String(formData.ruangan || "").trim() && 
          lastType.toLowerCase() === String(formData.reportType || "Harian").trim().toLowerCase()) {
        const lastTimestampStr = String(lastRowValues[0] || "");
        if (lastTimestampStr.endsWith(Utilities.formatDate(now, timeZone, "HH:mm:ss"))) {
          Logger.log("Cegah submit duplikat dalam detik yang sama");
          return { status: "success", message: "Laporan berhasil disimpan ke Google Sheets!" };
        }
      }
    } catch(e) {}
  }

  // Dapatkan jumlah kolom saat ini, minimal 35 kolom (sampai AF)
  const lastCol = Math.max(sheet.getLastColumn(), 35);
  const rowData = new Array(lastCol).fill("");

  // Set kolom standar A - F sesuai struktur spreadsheet
  rowData[0] = fullTimestamp;                       // Col A: Timestamp (dd/MM/yyyy HH:mm:ss)
  rowData[1] = dateOnly;                            // Col B: Tanggal (dd/MM/yyyy)
  rowData[2] = formData.petugas || "";              // Col C: Petugas
  rowData[3] = formData.ruangan || "";              // Col D: Ruangan
  rowData[4] = formData.reportType || "Harian";     // Col E: Jenis Laporan
  rowData[5] = "100%";                              // Col F: Status/Progress

  // Petakan URL foto ke kolom spesifik item pekerjaan (Col G..AF)
  const itemColMap = getItemColumnMap();
  
  Object.keys(formData).forEach(key => {
    if (key.startsWith("url_")) {
      const itemId = key.replace("url_", "");
      const colIndex = itemColMap[itemId];
      if (colIndex !== undefined && colIndex < lastCol) {
        rowData[colIndex] = formData[key];
      }
    }
  });

  sheet.appendRow(rowData);
  return { status: "success", message: "Laporan berhasil disimpan ke Google Sheets!" };
}

function formatCellDate(cell) {
  if (!cell) return "";
  if (cell instanceof Date) {
    return Utilities.formatDate(cell, Session.getScriptTimeZone(), "dd/MM/yyyy");
  }
  return String(cell).trim();
}

function getProgressData(petugas, ruangan, reportType) {
  try {
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_DATA_NAME);
    if (!sheet) return [];

    const todayStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy");
    const data = sheet.getDataRange().getValues();
    if (!data || data.length <= 1) return [];

    const itemColMap = getItemColumnMap();
    const colToItemMap = {};
    for (const itemId in itemColMap) {
      colToItemMap[itemColMap[itemId]] = itemId;
    }

    const filledIds = [];
    for (let i = 1; i < data.length; i++) {
      try {
        const row = data[i];
        if (!row || !Array.isArray(row)) continue;

        const rowTanggal = formatCellDate(row[1]);
        const rowPetugas = String(row[2] || "").trim();
        const rowRuangan = String(row[3] || "").trim();
        const rowType = String(row[4] || "Harian").trim();

        if (rowTanggal === todayStr && rowRuangan === ruangan && rowType.toLowerCase() === (reportType || "Harian").toLowerCase()) {
          for (let c = 6; c < row.length; c++) {
            const val = row[c];
            if (val) {
              const strVal = String(val).trim();
              if (strVal.length > 0) {
                const itemId = colToItemMap[c];
                if (itemId) filledIds.push(itemId);
                if (strVal.startsWith('{')) {
                  try {
                    const parsed = JSON.parse(strVal);
                    Object.keys(parsed).forEach(k => {
                      if (k.startsWith("url_")) filledIds.push(k.replace("url_", ""));
                    });
                  } catch (e) {}
                }
              }
            }
          }
        }
      } catch (rowErr) {
        Logger.log("Error processing row " + i + ": " + rowErr.toString());
      }
    }
    return filledIds;
  } catch (err) {
    Logger.log("Error in getProgressData: " + err.toString());
    return [];
  }
}

function getDashboardData() {
  try {
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_DATA_NAME);
    if (!sheet) return [];

    const data = sheet.getDataRange().getValues();
    if (!data || data.length <= 1) return [];

    const itemColMap = getItemColumnMap();
    const colToItemMap = {};
    for (const itemId in itemColMap) {
      colToItemMap[itemColMap[itemId]] = itemId;
    }

    const result = [];
    for (let i = 1; i < data.length; i++) {
      try {
        const row = data[i];
        if (!row || !Array.isArray(row)) continue;

        const rawTimestamp = row[0];
        const timestamp = rawTimestamp instanceof Date ? Utilities.formatDate(rawTimestamp, Session.getScriptTimeZone(), "HH:mm:ss") : String(rawTimestamp || "");
        const tanggal = formatCellDate(row[1]);
        
        let petugas = String(row[2] || "");
        let ruangan = String(row[3] || "");
        let jenis_laporan = String(row[4] || "Harian");
        let progress = String(row[5] || "100%");

        if (typeof progress === 'string' && progress.trim().startsWith('{')) {
          try {
            const parsed = JSON.parse(progress);
            petugas = parsed.petugas || String(row[3]) || petugas;
            ruangan = parsed.ruangan || String(row[4]) || ruangan;
            jenis_laporan = parsed.reportType || String(row[2]) || jenis_laporan;
            progress = "100%";
          } catch(e) {}
        }

        let itemObj = {
          timestamp: timestamp,
          tanggal: tanggal,
          petugas: petugas,
          ruangan: ruangan,
          jenis_laporan: jenis_laporan,
          progress: progress
        };

        for (let c = 6; c < row.length; c++) {
          const val = row[c];
          if (val) {
            const strVal = String(val).trim();
            if (strVal.length > 0) {
              if (strVal.startsWith('{') && strVal.endsWith('}')) {
                try {
                  const parsed = JSON.parse(strVal);
                  Object.assign(itemObj, parsed);
                } catch(e) {}
              } else {
                const itemId = colToItemMap[c];
                if (itemId) {
                  itemObj[`url_${itemId}`] = strVal;
                }
              }
            }
          }
        }

        result.push(itemObj);
      } catch (rowErr) {
        Logger.log("Error reading row " + i + ": " + rowErr.toString());
      }
    }
    return result.reverse();
  } catch (err) {
    Logger.log("Error in getDashboardData: " + err.toString());
    return [];
  }
}
