/**
 * نتائج امتحان فهم البيانات والقرار — مخبز القمح الذهبي
 *
 * 1. أنشئي جدولاً فارغاً في Google Sheets.
 * 2. من الجدول: الإضافات ← Apps Script، ثم الصقي هذا الملف مكان الكود.
 * 3. انشريه: تطبيق ويب، التنفيذ: أنا، الوصول: أي شخص.
 * 4. الصقي رابط /exec في js/config.js عند sheetsUrl.
 *
 * الأوراق التي تُنشأ وحدها:
 * - ملخص العلامات
 * - تفاصيل الأسئلة
 * - الأخطاء
 */

var SHEET_ID = "1ZL36UcTGhJC5QaHD618d9bO-unIGUzTW5a92qRxAlPE";

function doGet() {
  return ContentService.createTextOutput("امتحان البيانات والقرار — جاهز.");
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    var data = readPayload_(e);
    if (String(data.kind || "") !== "dataExam") throw new Error("unknown kind");
    writeExam_(openSheet_(), data);
    return jsonOut_({ ok: true });
  } catch (err) {
    return jsonOut_({ ok: false, error: String(err) });
  } finally {
    try { lock.releaseLock(); } catch (e2) {}
  }
}

function openSheet_() {
  if (SHEET_ID) return SpreadsheetApp.openById(SHEET_ID);
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error("اربطي السكربت بجدول أو ضعي معرّف الجدول في SHEET_ID");
  return ss;
}

function writeExam_(ss, data) {
  try { ss.rename("نتائج امتحان البيانات والقرار"); } catch (e0) {}

  var sumHead = [
    "الاسم", "الشعبة",
    "وقت البدء", "وقت التسليم", "المدة",
    "صحيحة", "خاطئة", "عدد الأسئلة",
    "الدرجة", "الدرجة الكاملة", "النسبة %",
    "البيانات والمعلومات", "الأولية والثانوية", "القرارات والأخطاء", "البنية التحتية والبيانات",
    "ملخص الأخطاء"
  ];
  var detHead = [
    "الاسم", "الشعبة", "وقت التسليم",
    "رقم السؤال", "المحور", "السؤال",
    "إجابة الطالبة", "الإجابة الصحيحة",
    "النتيجة", "التفسير"
  ];
  var errHead = [
    "الاسم", "الشعبة", "وقت التسليم",
    "رقم السؤال", "المحور", "السؤال",
    "إجابة الطالبة", "الإجابة الصحيحة", "التفسير"
  ];

  var summary = ensureSheet_(ss, "ملخص العلامات", sumHead);
  var details = ensureSheet_(ss, "تفاصيل الأسئلة", detHead);
  var errors = ensureSheet_(ss, "الأخطاء", errHead);
  var topics = data.topics || {};
  var wrong = (data.details || []).filter(function (row) { return row.result !== "صحيحة"; });
  var errorSummary = wrong.length
    ? wrong.map(function (row) { return (row.num || "") + ". " + (row.topic || ""); }).join(" | ")
    : "لا يوجد";

  summary.appendRow([
    data.name || "", data.klass || "",
    data.startedAt || "", data.finishedAt || "", data.durationText || "",
    data.correct || 0, data.wrong || 0, data.total || 0,
    data.correct || 0, data.total || 0, data.percent || 0,
    topics.dataInfo || "", topics.source || "", topics.decision || "", topics.infra || "",
    errorSummary
  ]);

  (data.details || []).forEach(function (row, i) {
    var ok = row.result === "صحيحة";
    details.appendRow([
      data.name || "", data.klass || "", data.finishedAt || "",
      row.num || (i + 1), row.topic || "", row.stem || "",
      row.chosen || "", row.correctText || "",
      row.result || "", row.why || ""
    ]);
    if (!ok) {
      errors.appendRow([
        data.name || "", data.klass || "", data.finishedAt || "",
        row.num || (i + 1), row.topic || "", row.stem || "",
        row.chosen || "", row.correctText || "", row.why || ""
      ]);
    }
  });
}

function firstText_(v) {
  if (v == null) return "";
  if (Object.prototype.toString.call(v) === "[object Array]") v = v.length ? v[0] : "";
  return String(v);
}

function tryParseJson_(text) {
  if (!text) return null;
  try {
    var obj = JSON.parse(String(text).replace(/^\uFEFF/, "").trim());
    if (obj && typeof obj === "object") return obj;
  } catch (err) {}
  return null;
}

function tryParseForm_(text) {
  if (!text || text.indexOf("=") < 0) return null;
  var parts = String(text).split("&");
  for (var i = 0; i < parts.length; i++) {
    var eq = parts[i].indexOf("=");
    if (eq < 0) continue;
    var key = parts[i].slice(0, eq);
    var val = parts[i].slice(eq + 1);
    try { key = decodeURIComponent(key.replace(/\+/g, " ")); } catch (e1) {}
    if (key !== "payload" && key !== "data") continue;
    try { val = decodeURIComponent(val.replace(/\+/g, " ")); } catch (e2) {}
    var parsed = tryParseJson_(val);
    if (parsed) return parsed;
  }
  return null;
}

function readPayload_(e) {
  e = e || {};
  var p = e.parameter || {};
  var ps = e.parameters || {};
  var raw = e.postData && e.postData.contents ? String(e.postData.contents) : "";
  var candidates = [p.payload, p.data, ps.payload, ps.data, raw];
  for (var i = 0; i < candidates.length; i++) {
    var text = firstText_(candidates[i]);
    if (!text) continue;
    var asJson = tryParseJson_(text);
    if (asJson) return asJson;
    var asForm = tryParseForm_(text);
    if (asForm) return asForm;
  }
  throw new Error("empty body");
}

function ensureSheet_(ss, name, headers) {
  var sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  if (sh.getLastRow() < 1) {
    sh.appendRow(headers);
    sh.getRange(1, 1, 1, headers.length).setFontWeight("bold");
    sh.setFrozenRows(1);
  }
  return sh;
}

function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
