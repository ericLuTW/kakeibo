/*
 * ReceiptFlow — Google Apps Script
 *
 * 部署步驟：
 * 1. 前往 script.google.com，建立新專案
 * 2. 將此檔案內容貼上，取代原有程式碼
 * 3. 點選「部署」→「新增部署作業」
 * 4. 類型選「網頁應用程式」
 * 5. 執行身分：「我」
 * 6. 誰可以存取：「所有人」
 * 7. 點選「部署」，複製產生的網址
 * 8. 將網址貼入 ReceiptFlow.html 的設定頁面
 *
 * 注意：首次執行時會自動建立所有工作表，無需手動設定。
 * 注意：由於本工具以本機 HTML 執行，前端送出後只能確認請求已送出，
 *       實際寫入結果請以 Google 試算表內容為準。
 */

const CATEGORIES = ['餐飲', '交通', '購物', '娛樂', '醫療', '水電費', '辦公用品', '住宿', '其他'];

function normalizeDateString(value) {
  if (!value) return new Date();
  var m = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return new Date();
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function doGet(e) {
  return ContentService
    .createTextOutput('ReceiptFlow Apps Script is running ✓')
    .setMimeType(ContentService.MimeType.TEXT);
}

function doPost(e) {
  try {
    setupSheetsIfNeeded();

    var payload = JSON.parse(e.postData.contents || '{}');
    var rows = Array.isArray(payload.rows) ? payload.rows : [];

    if (!rows.length) {
      return ContentService
        .createTextOutput(JSON.stringify({ success: false, error: 'No rows provided' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var grouped = { '個人': [], '家庭': [] };

    rows.forEach(function(row) {
      var type = row && row.type === '家庭' ? '家庭' : '個人';
      var item = String((row && row.item) || '').trim();
      if (!item) return;

      var category = CATEGORIES.includes(row.category) ? row.category : '其他';
      var dateValue = normalizeDateString(row.date);
      var price = Number(row.price) || 0;
      var merchant = String((row && row.merchant) || '').trim();
      var currency = String((row && row.currency) || 'JPY').trim();
      var notes = String((row && row.notes) || '').trim();

      grouped[type].push([dateValue, merchant, category, item, price, currency, notes]);
    });

    ['個人', '家庭'].forEach(function(name) {
      if (!grouped[name].length) return;
      var sheet = ss.getSheetByName(name);
      var startRow = sheet.getLastRow() + 1;
      sheet.getRange(startRow, 1, grouped[name].length, 7).setValues(grouped[name]);
      sheet.getRange(startRow, 1, grouped[name].length, 1).setNumberFormat('yyyy-mm-dd');
      sheet.getRange(startRow, 5, grouped[name].length, 1).setNumberFormat('0.00');

      // Sort all data rows by date ascending
      var totalRows = sheet.getLastRow() - 1;
      if (totalRows > 0) {
        if (sheet.getFilter()) sheet.getFilter().remove();
        sheet.getRange(2, 1, totalRows, 7).sort({ column: 1, ascending: true });
      }
    });

    // Refresh summary sheets with computed data
    refreshSummaries(ss);

    return ContentService
      .createTextOutput(JSON.stringify({ success: true, count: rows.length }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function setupSheetsIfNeeded() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // --- Raw data sheets ---
  ['個人', '家庭'].forEach(function(name) {
    if (ss.getSheetByName(name)) return;
    var sheet = ss.insertSheet(name);

    var headers = [['日期', '商家', '類別', '品項', '金額', '幣別', '備註']];
    sheet.getRange(1, 1, 1, 7).setValues(headers);
    sheet.getRange(1, 1, 1, 7).setFontWeight('bold');
    sheet.setFrozenRows(1);

    sheet.setColumnWidth(1, 100);
    sheet.setColumnWidth(2, 150);
    sheet.setColumnWidth(3, 100);
    sheet.setColumnWidth(4, 200);
    sheet.setColumnWidth(5, 80);
    sheet.setColumnWidth(6, 70);
    sheet.setColumnWidth(7, 200);

    sheet.getRange('A:A').setNumberFormat('yyyy-mm-dd');
    sheet.getRange('E:E').setNumberFormat('0.00');
  });

  // --- Summary sheets (create if not exist) ---
  ['個人－月報', '家庭－月報', '個人－日報', '家庭－日報'].forEach(function(name) {
    if (!ss.getSheetByName(name)) ss.insertSheet(name);
  });
}

// ── Debug entry point: run this directly from the editor to see any errors ─
// Select "debugRefresh" in the function dropdown at the top of the editor, then
// click Run. Errors will surface immediately instead of being swallowed by doPost.
function debugRefresh() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  setupSheetsIfNeeded();
  refreshSummaries(ss);
  Logger.log('debugRefresh: done.');
}

// ── Refresh summary sheets with computed data ─────────────
function refreshSummaries(ss) {
  var tz = Session.getScriptTimeZone();

  ['個人', '家庭'].forEach(function(type) {
    try {
    var sheet = ss.getSheetByName(type);
    if (!sheet || sheet.getLastRow() < 2) {
      // No data — write headers only
      writeSummaryHeaders(ss, type);
      return;
    }

    var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 7).getValues();

    // Coerce any string dates back into Date objects (older rows may have
    // been written as strings before the date-format fix).
    function toDate(v) {
      if (v instanceof Date) return v;
      if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) {
        var m = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
        return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
      }
      return null;
    }

    // ── Monthly summary ──
    var monthlyMap = {};
    data.forEach(function(row) {
      var d = toDate(row[0]);
      if (!d) return;
      var key = d.getFullYear() * 100 + (d.getMonth() + 1); // e.g. 202604
      if (!monthlyMap[key]) monthlyMap[key] = {};
      var cat = String(row[2] || '其他');
      monthlyMap[key][cat] = (monthlyMap[key][cat] || 0) + (Number(row[4]) || 0);
    });

    var monthlyKeys = Object.keys(monthlyMap).map(Number).sort(function(a, b) { return a - b; });
    var mHeaders = ['年', '月'].concat(CATEGORIES).concat(['合計']);
    var mRows = monthlyKeys.map(function(key) {
      var year = Math.floor(key / 100);
      var month = key % 100;
      var total = 0;
      var catValues = CATEGORIES.map(function(cat) {
        var val = monthlyMap[key][cat] || 0;
        total += val;
        return val;
      });
      return [year, month].concat(catValues).concat([total]);
    });

    writeSheet(ss, type + '－月報', mHeaders, mRows);

    // ── Daily summary ──
    var dailyMap = {};
    var skippedDaily = 0;
    data.forEach(function(row) {
      var d = toDate(row[0]);
      if (!d) { skippedDaily++; return; }
      var key = Utilities.formatDate(d, tz, 'yyyy-MM-dd');
      if (!dailyMap[key]) dailyMap[key] = {};
      var cat = String(row[2] || '其他');
      dailyMap[key][cat] = (dailyMap[key][cat] || 0) + (Number(row[4]) || 0);
    });
    if (skippedDaily > 0) {
      Logger.log('refreshSummaries: ' + type + ' daily skipped ' + skippedDaily + ' rows (bad date).');
    }

    var dailyKeys = Object.keys(dailyMap).sort();
    var dHeaders = ['日期'].concat(CATEGORIES).concat(['合計']);
    var dRows = dailyKeys.map(function(key) {
      var total = 0;
      var catValues = CATEGORIES.map(function(cat) {
        var val = dailyMap[key][cat] || 0;
        total += val;
        return val;
      });
      return [key].concat(catValues).concat([total]);
    });

    writeSheet(ss, type + '－日報', dHeaders, dRows);
    } catch (err) {
      Logger.log('refreshSummaries: error processing ' + type + ': ' + err);
    }
  });
}

function writeSheet(ss, sheetName, headers, rows) {
  // Summary sheets are purely derived — delete & recreate each run so any
  // leftover state (column groups, protected ranges, trimmed columns,
  // banding, filters) from older versions of the script can't block writes.
  var existing = ss.getSheetByName(sheetName);
  if (existing) {
    ss.deleteSheet(existing);
    // Flush so the deletion is committed to the spreadsheet registry before
    // insertSheet looks up available names — without this, rapid sequences of
    // delete+insert can fail because the old name still appears "taken".
    SpreadsheetApp.flush();
  }
  var sheet = ss.insertSheet(sheetName);

  var numCols = headers.length;

  // Header row
  sheet.getRange(1, 1, 1, numCols).setValues([headers]);
  sheet.getRange(1, 1, 1, numCols).setFontWeight('bold');

  // Freezing is cosmetic — never let it kill the write.
  try { sheet.setFrozenRows(1); } catch (e) {
    Logger.log('writeSheet: setFrozenRows failed on ' + sheetName + ': ' + e);
  }

  // Data rows
  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, numCols).setValues(rows);
    // Format the numeric block (category columns + 合計). Computed from the
    // right edge so it works for both 月報 (prefix: 年, 月) and 日報 (prefix: 日期).
    try {
      var numericWidth = CATEGORIES.length + 1;
      var numericStart = numCols - numericWidth + 1;
      sheet.getRange(2, numericStart, rows.length, numericWidth).setNumberFormat('0.00');
    } catch (e) {
      Logger.log('writeSheet: setNumberFormat failed on ' + sheetName + ': ' + e);
    }
  }

  Logger.log('writeSheet: ' + sheetName + ' wrote ' + rows.length + ' rows.');
}

function writeSummaryHeaders(ss, type) {
  var mHeaders = ['年', '月'].concat(CATEGORIES).concat(['合計']);
  var dHeaders = ['日期'].concat(CATEGORIES).concat(['合計']);

  var mSheet = ss.getSheetByName(type + '－月報');
  if (mSheet) {
    mSheet.clearContents();
    mSheet.getRange(1, 1, 1, mHeaders.length).setValues([mHeaders]);
    mSheet.getRange(1, 1, 1, mHeaders.length).setFontWeight('bold');
    mSheet.setFrozenRows(1);
  }

  var dSheet = ss.getSheetByName(type + '－日報');
  if (dSheet) {
    dSheet.clearContents();
    dSheet.getRange(1, 1, 1, dHeaders.length).setValues([dHeaders]);
    dSheet.getRange(1, 1, 1, dHeaders.length).setFontWeight('bold');
    dSheet.setFrozenRows(1);
  }
}
