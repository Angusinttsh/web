/* 貼上到 Google 試算表的 Apps Script（擴充功能 → Apps Script）
   試算表格式：第 1 列為標題列，從第 2 列開始是貼文
   A 標題｜B 日期｜C 內文（以 / 分段）｜D~J 留言（最多 7 則） */

const COMMENT_FIRST_COL = 4;   // D 欄
const COMMENT_SLOTS = 7;       // D~J
const TZ = "Asia/Taipei";

function sheet_() { return SpreadsheetApp.getActiveSpreadsheet().getSheets()[0]; }

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function fmtDate_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, TZ, "yyyy/MM/dd");
  return String(v);
}

// 讀取：回傳所有貼文（最新的在最前面）
function doGet() {
  const sh = sheet_();
  const last = sh.getLastRow();
  const posts = [];
  if (last >= 2) {
    const rows = sh.getRange(2, 1, last - 1, 10).getValues();
    rows.forEach((r, i) => {
      if (String(r[0]) === "" && String(r[2]) === "") return;
      posts.push({
        row: i + 2,
        title: String(r[0]),
        date: fmtDate_(r[1]),
        body: String(r[2]),
        comments: r.slice(3).map(String).filter(c => c !== "")
      });
    });
  }
  return json_({ ok: true, posts: posts.reverse() });
}

function clean_(s, max) {
  return String(s || "").replace(/[\r\n]+/g, " ").replace(/｜/g, "|").trim().slice(0, max);
}

// 寫入：新增一則留言到該貼文同列的第一個空欄位
function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const d = JSON.parse(e.postData.contents);
    if (d.hp) return json_({ ok: false, error: "rejected" });          // 防機器人欄位
    const text = clean_(d.text, 300);
    if (!text) return json_({ ok: false, error: "empty" });
    const name = clean_(d.name, 20) || "匿名";

    const sh = sheet_();
    const row = Number(d.row);
    if (!(row >= 2 && row <= sh.getLastRow())) return json_({ ok: false, error: "stale" });
    if (String(sh.getRange(row, 1).getValue()) !== String(d.title)) return json_({ ok: false, error: "stale" });

    const range = sh.getRange(row, COMMENT_FIRST_COL, 1, COMMENT_SLOTS);
    const cells = range.getValues()[0];
    const idx = cells.findIndex(c => String(c) === "");
    if (idx < 0) return json_({ ok: false, error: "full" });

    const stamp = Utilities.formatDate(new Date(), TZ, "yyyy/MM/dd HH:mm");
    const value = stamp + "｜" + name + "｜" + text;
    const cell = sh.getRange(row, COMMENT_FIRST_COL + idx);
    cell.setNumberFormat("@").setValue(value);                          // 強制純文字
    return json_({ ok: true, comment: value });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    lock.release();
  }
}
