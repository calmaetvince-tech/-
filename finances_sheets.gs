 var SHEET_NAME     = 'Συναλλαγές';
  var SPREADSHEET_ID = '1NKMXTzvoMOvmetfBYtfwWDEITUMIpoIy8tKIe36zGqI';
                                                                                                                                                                                                                                               function getOrCreateSheet() {
    var ss;                                                                                                                                                                                                                                      if (SPREADSHEET_ID) {
      ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    } else {
      ss = SpreadsheetApp.getActiveSpreadsheet();
    }
    if (!ss) {
      throw new Error('No spreadsheet found. Set SPREADSHEET_ID at the top of the script.');
    }
    var sh = ss.getSheetByName(SHEET_NAME);
    if (!sh) {
      sh = ss.insertSheet(SHEET_NAME);
      sh.getRange(1, 1, 1, 6)
        .setValues([['ID', 'Τύπος', 'Ποσό (€)', 'Κατηγορία', 'Ημερομηνία', 'Περιγραφή']])
        .setFontWeight('bold')
        .setBackground('#4f46e5')
        .setFontColor('#ffffff')
        .setFontSize(11);
      sh.setFrozenRows(1);
      var widths = [140, 90, 110, 140, 120, 240];
      for (var i = 0; i < widths.length; i++) {
        sh.setColumnWidth(i + 1, widths[i]);
      }
    }
    return sh;
  }

  function fmtDate_(v) {
    if (v instanceof Date) {
      return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    }
    return String(v || '');
  }

  function respond(data) {
    return ContentService
      .createTextOutput(JSON.stringify(data))
      .setMimeType(ContentService.MimeType.JSON);
  }

  function doGet(e) {
    var action = (e.parameter && e.parameter.action) || 'import';
    var result;
    try {
      if (action === 'import') {
        result = handleImport();
      } else {
        result = { success: false, error: 'Unknown action: ' + action };
      }
    } catch (err) {
      result = { success: false, error: err.toString() };
    }
    return respond(result);
  }

  function handleImport() {
    var sh   = getOrCreateSheet();
    var last = sh.getLastRow();
    if (last < 2) return { success: true, transactions: [] };
    var rows = sh.getRange(2, 1, last - 1, 6).getValues();
    var transactions = [];
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      if (r[0] === '') continue;
      transactions.push({
        id:          Number(r[0]),
        type:        String(r[1]),
        amount:      Number(r[2]),
        category:    String(r[3]),
        date:        fmtDate_(r[4]),
        description: String(r[5] || '')
      });
    }
    return { success: true, transactions: transactions };
  }

  function handleExportChunk(e) {
    var chunk = parseInt(e.parameter.chunk || '0');
    var total = parseInt(e.parameter.total || '1');
    var data  = JSON.parse(e.parameter.data || '[]');
    var sh    = getOrCreateSheet();
    if (chunk === 0 && sh.getLastRow() > 1) {
      sh.getRange(2, 1, sh.getLastRow() - 1, 6).clearContent().clearFormat();
    }
    if (data.length > 0) {
      var startRow = sh.getLastRow() + 1;
      var rows = [];
      for (var i = 0; i < data.length; i++) {
        var t = data[i];
        rows.push([t.id, t.type, t.amount, t.category, t.date, t.description || '']);
      }
      sh.getRange(startRow, 1, rows.length, 6).setValues(rows);
      for (var j = 0; j < data.length; j++) {
        var bg = data[j].type === 'income' ? '#d1fae5' : '#fee2e2';
        sh.getRange(startRow + j, 1, 1, 6).setBackground(bg);
      }
      if (chunk === total - 1) {
        var totalRows = sh.getLastRow() - 1;
        if (totalRows > 0) {
          sh.getRange(2, 3, totalRows, 1).setNumberFormat('€#,##0.00');
          sh.getRange(2, 5, totalRows, 1).setNumberFormat('@');
        }
      }
    }
    return { success: true, chunk: chunk, total: total, written: data.length };
  }

  function doPost(e) {
    try {
      var payload      = JSON.parse(e.postData.contents);
      var transactions = payload.transactions || [];
      var sh           = getOrCreateSheet();
      if (sh.getLastRow() > 1) {
        sh.getRange(2, 1, sh.getLastRow() - 1, 6).clearContent().clearFormat();
      }
      if (transactions.length === 0) return respond({ success: true, count: 0 });
      var rows = [];
      for (var i = 0; i < transactions.length; i++) {
        var t = transactions[i];
        rows.push([t.id, t.type, t.amount, t.category, t.date, t.description || '']);
      }
      sh.getRange(2, 1, rows.length, 6).setValues(rows);
      for (var j = 0; j < transactions.length; j++) {
        var bg = transactions[j].type === 'income' ? '#d1fae5' : '#fee2e2';
        sh.getRange(j + 2, 1, 1, 6).setBackground(bg);
      }
      sh.getRange(2, 3, rows.length, 1).setNumberFormat('€#,##0.00');
      sh.getRange(2, 5, rows.length, 1).setNumberFormat('@');
      return respond({ success: true, count: transactions.length });
    } catch (err) {
      return respond({ success: false, error: err.toString() });
    }
  }