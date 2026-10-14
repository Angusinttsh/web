/* ===== 貼文：從 Google 試算表載入，並支援留言 =====
   把 Apps Script 部署後得到的網址（結尾是 /exec）貼在下面。
   留空或連線失敗時，頁面會維持 index.html 裡的離線範例。 */
const API_URL = "https://script.google.com/macros/s/AKfycbxeQ_fF57L5bTD5PWABRBwTv2xV9rB3RATkE05JZtO0YGe6J5EhZgc1nZWI3ciSGz2VZg/exec";

const MAX_COMMENTS = 7;           // 試算表 D~J 欄，共 7 則留言
const root = document.getElementById("posts-root");

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;   // 一律用 textContent，避免被塞入惡意 HTML
  return e;
}

/* 內文以 / 分段；網址中的 / 不會被切開 */
function splitBody(body) {
  const urls = [];
  const safe = body.replace(/https?:\/\/[^\s／]+/g, u => { urls.push(u); return "\u0000" + (urls.length - 1) + "\u0000"; });
  return safe.split(/[\/／]/)
    .map(t => t.trim().replace(/\u0000(\d+)\u0000/g, (_, i) => urls[i]))
    .filter(Boolean);
}

function parseComment(raw) {
  const parts = String(raw).split("｜");
  if (parts.length >= 3) return { time: parts[0], name: parts[1], text: parts.slice(2).join("｜") };
  return { time: "", name: "匿名", text: String(raw) };
}

function commentNode(raw) {
  const c = parseComment(raw);
  const item = el("div", "c-item");
  const meta = el("div", "c-meta");
  meta.appendChild(el("b", null, c.name));
  meta.appendChild(document.createTextNode(c.time));
  item.appendChild(meta);
  item.appendChild(el("div", "c-text", c.text));
  return item;
}

function renderComments(post) {
  const box = el("div", "comments");
  const summary = el("button", "c-toggle");
  summary.type = "button"; summary.setAttribute("aria-expanded", "false");
  const panel = el("div", "c-panel"); panel.hidden = true;
  const list = el("div", "c-list");
  let count = post.comments.length;
  const setCount = () => { summary.textContent = "留言（" + count + "）"; };
  setCount();
  post.comments.forEach(c => list.appendChild(commentNode(c)));

  const form = el("form", "c-form");
  const name = el("input"); name.type = "text"; name.placeholder = "暱稱（可不填）"; name.maxLength = 20;
  const text = el("textarea"); text.placeholder = "寫下你的留言…"; text.maxLength = 300; text.required = true;
  const hp = el("input", "hp"); hp.type = "text"; hp.tabIndex = -1; hp.autocomplete = "off"; hp.setAttribute("aria-hidden", "true");
  const btn = el("button", null, "送出留言"); btn.type = "submit";
  const note = el("div", "c-note");
  form.append(name, text, hp, btn, note);
  panel.append(list, form);

  const full = () => { form.style.display = "none"; list.after(el("div", "c-note", "此貼文的留言已滿。")); };
  if (count >= MAX_COMMENTS) full();

  form.addEventListener("submit", async e => {
    e.preventDefault();
    btn.disabled = true; note.className = "c-note"; note.textContent = "送出中…";
    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },   // 避免 CORS 預檢
        body: JSON.stringify({ row: post.row, title: post.title, name: name.value, text: text.value, hp: hp.value })
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      list.appendChild(commentNode(data.comment));
      count++; setCount();
      text.value = ""; note.textContent = "已送出，謝謝你的留言！";
      if (count >= MAX_COMMENTS) full();
    } catch (err) {
      note.className = "c-note err";
      note.textContent = err.message === "full" ? "此貼文的留言已滿。"
        : err.message === "stale" ? "貼文內容已更新，請重新整理頁面後再試。"
        : "送出失敗，請稍後再試。";
    }
    btn.disabled = false;
  });

  summary.addEventListener("click", () => {
    const open = panel.hidden;
    panel.hidden = !open;
    summary.setAttribute("aria-expanded", String(open));
  });

  box.append(summary, panel);
  return box;
}

function renderPost(post) {
  const sec = el("section");
  sec.appendChild(el("h2", null, post.title));
  sec.appendChild(el("h4", null, post.date));
  splitBody(post.body).forEach(t => sec.appendChild(el("p", null, t)));
  sec.appendChild(renderComments(post));
  return sec;
}

async function loadPosts() {
  if (!API_URL || !root || !navigator.onLine) return;       // 離線：保留範例內容
  try {
    const res = await fetch(API_URL);
    const data = await res.json();
    if (!data.ok || !data.posts.length) return;
    root.innerHTML = "";
    data.posts.forEach(p => root.appendChild(renderPost(p)));
    // 若使用者正停在貼文頁，重建右側目錄
    if (document.getElementById("works").classList.contains("active")) buildToc("works");
  } catch (err) {
    console.warn("無法連線到雲端試算表，改用離線範例。", err);
  }
}
loadPosts();
