(function () {
  "use strict";

  const DATA = window.MARKET_DATA || { updated: "", entries: [] };
  const main = document.getElementById("main");
  const statLine = document.getElementById("statLine");
  const updatedAt = document.getElementById("updatedAt");
  const lb = document.getElementById("lightbox");
  const lbImg = document.getElementById("lbImg");
  const lbCaption = document.getElementById("lbCaption");

  let galleryMonth = "";   // 空 = 全部月份
  let archiveMonth = "";   // 空 = 全部月份

  /* ---------- 工具函数 ---------- */

  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function weekdayOf(dateStr) {
    const d = new Date(dateStr + "T00:00:00");
    return "周" + "日一二三四五六"[d.getDay()];
  }

  function formatDate(dateStr) {
    const [y, m, d] = dateStr.split("-");
    return y + "年" + parseInt(m, 10) + "月" + parseInt(d, 10) + "日";
  }

  function monthLabel(m) {
    const [y, mo] = m.split("-");
    return y + "年" + parseInt(mo, 10) + "月";
  }

  function sortedEntries() {
    return (DATA.entries || []).slice().sort((a, b) => (a.date < b.date ? 1 : -1));
  }

  function groupByMonth(entries) {
    const groups = new Map();
    entries.forEach(function (e) {
      const m = e.date.slice(0, 7);
      if (!groups.has(m)) groups.set(m, []);
      groups.get(m).push(e);
    });
    return groups;
  }

  /* ---------- Markdown 简写渲染 ---------- */

  function renderMarkdown(src) {
    const lines = String(src || "").split(/\r?\n/);
    const out = [];
    let list = null; // "ul" | "ol" | null
    let para = [];

    const flushPara = function () {
      if (para.length) {
        out.push("<p>" + para.join("<br>") + "</p>");
        para = [];
      }
    };
    const flushList = function () {
      if (list) { out.push("</" + list + ">"); list = null; }
    };
    const inline = function (s) {
      s = escapeHtml(s);
      s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
      s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
      s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g,
        '<a href="$2" target="_blank" rel="noopener">$1</a>');
      return s;
    };

    for (const raw of lines) {
      const line = raw.trim();
      if (!line) { flushPara(); flushList(); continue; }

      const h = line.match(/^(#{1,3})\s+(.*)$/);
      if (h) {
        flushPara(); flushList();
        const tag = h[1].length === 1 ? "h2" : "h3";
        out.push("<" + tag + ">" + inline(h[2]) + "</" + tag + ">");
        continue;
      }
      const ul = line.match(/^[-*]\s+(.*)$/);
      if (ul) {
        flushPara();
        if (list !== "ul") { flushList(); out.push("<ul>"); list = "ul"; }
        out.push("<li>" + inline(ul[1]) + "</li>");
        continue;
      }
      const ol = line.match(/^\d+[.)]\s+(.*)$/);
      if (ol) {
        flushPara();
        if (list !== "ol") { flushList(); out.push("<ol>"); list = "ol"; }
        out.push("<li>" + inline(ol[1]) + "</li>");
        continue;
      }
      flushList();
      para.push(inline(line));
    }
    flushPara(); flushList();
    return out.join("");
  }

  /* ---------- 通用组件 ---------- */

  function newsItem(n) {
    const impact = ["利好", "利空", "中性"].includes(n.impact) ? n.impact : "中性";
    const title = n.url
      ? '<a href="' + escapeHtml(n.url) + '" target="_blank" rel="noopener">' + escapeHtml(n.title) + "</a>"
      : escapeHtml(n.title);
    return (
      '<li class="news-item">' +
        '<span class="impact ' + impact + '">' + impact + "</span>" +
        '<span class="news-body">' + title + "</span>" +
      "</li>"
    );
  }

  function newsBlock(e) {
    return (e.news && e.news.length)
      ? '<div class="section-title">当日新闻</div><ul class="news-list">' + e.news.map(newsItem).join("") + "</ul>"
      : "";
  }

  /* --- 聊天本地存储（先存浏览器，接入后端后可迁移到服务端） --- */

  function chatKey(dateStr) { return "market-chat-" + dateStr; }

  function loadChat(dateStr) {
    try { return JSON.parse(localStorage.getItem(chatKey(dateStr)) || "[]"); }
    catch (e) { return []; }
  }

  function saveChat(dateStr, msgs) {
    try { localStorage.setItem(chatKey(dateStr), JSON.stringify(msgs)); }
    catch (e) { /* 忽略存储失败 */ }
  }

  function messageHtml(role, text) {
    return (
      '<div class="msg ' + role + '"><div class="bubble"><span class="bubble-text">' +
      escapeHtml(text) + "</span></div></div>"
    );
  }

  function chatWidget(dateStr) {
    const msgs = loadChat(dateStr);
    let msgsHtml = '<div class="chat-messages">';
    msgs.forEach(function (m) { msgsHtml += messageHtml(m.role, m.text); });
    msgsHtml += "</div>";
    return (
      '<div class="chat" data-date="' + escapeHtml(dateStr) + '">' +
        '<div class="chat-head">' +
          '<span class="chat-title">💬 问问 AI：今天为什么这么走？</span>' +
          '<span class="chat-hint">接口待接入 · 当前为占位</span>' +
          (msgs.length ? '<button type="button" class="chat-clear">清空</button>' : "") +
        "</div>" +
        msgsHtml +
        '<form class="chat-form">' +
          '<input class="chat-input" type="text" placeholder="输入你的问题…" autocomplete="off">' +
          '<button class="chat-send" type="submit">发送</button>' +
        "</form>" +
      "</div>"
    );
  }

  /* ---------- 视图：每日复盘 ---------- */

  function photoItem(p, dateStr) {
    const label = p.label || "照片";
    const cls = label === "开盘" ? "open" : (label === "收盘" ? "close" : "");
    const caption = formatDate(dateStr) + " " + weekdayOf(dateStr) + " · " + label +
      (p.note ? " — " + p.note : "");
    return (
      '<figure class="photo-item" data-src="' + escapeHtml(p.src) + '" data-caption="' + escapeHtml(caption) + '" role="button" tabindex="0">' +
        '<img src="' + escapeHtml(p.src) + '" alt="' + escapeHtml(label) + '" loading="lazy">' +
        '<figcaption class="photo-meta">' +
          '<span class="photo-label ' + cls + '">' + escapeHtml(label) + "</span>" +
          (p.note ? '<span class="photo-note">' + escapeHtml(p.note) + "</span>" : "") +
        "</figcaption>" +
      "</figure>"
    );
  }

  function dayCard(e) {
    const photos = (e.photos || []).map((p) => photoItem(p, e.date)).join("");
    const analysis = e.analysis
      ? '<div class="section-title">复盘分析</div><div class="analysis">' + renderMarkdown(e.analysis) + "</div>"
      : "";
    return (
      '<article class="day-card" id="day-' + escapeHtml(e.date) + '">' +
        '<div class="day-head">' +
          '<h2 class="day-date">' + formatDate(e.date) + "</h2>" +
          '<span class="day-week">' + weekdayOf(e.date) + "</span>" +
          (e.demo ? '<span class="demo-badge">示例</span>' : "") +
        "</div>" +
        (e.summary ? '<div class="day-summary">' + escapeHtml(e.summary) + "</div>" : "") +
        '<div class="photos">' + photos + "</div>" +
        analysis + newsBlock(e) +
        chatWidget(e.date) +
      "</article>"
    );
  }

  function renderReview() {
    const entries = sortedEntries();
    if (!entries.length) {
      return '<div class="empty">还没有记录。<br>把每天的开盘/收盘照片发给 Claude，我会帮你存好并写好分析。</div>';
    }
    return entries.map(dayCard).join("");
  }

  /* ---------- 视图：分析记录 ---------- */

  function chatTranscriptBlock(e) {
    const msgs = loadChat(e.date);
    if (!msgs.length) return "";
    const items = msgs.map(function (m) {
      return messageHtml(m.role, m.text);
    }).join("");
    return '<div class="section-title">与 AI 的问答记录</div><div class="chat-transcript">' + items + "</div>";
  }

  function archiveItem(e) {
    const analysis = e.analysis
      ? '<div class="section-title">复盘分析</div><div class="analysis">' + renderMarkdown(e.analysis) + "</div>"
      : "";
    return (
      '<article class="day-card" id="arc-' + escapeHtml(e.date) + '">' +
        '<div class="day-head">' +
          '<h2 class="day-date">' + formatDate(e.date) + "</h2>" +
          '<span class="day-week">' + weekdayOf(e.date) + "</span>" +
          (e.demo ? '<span class="demo-badge">示例</span>' : "") +
        "</div>" +
        (e.summary ? '<div class="day-summary">' + escapeHtml(e.summary) + "</div>" : "") +
        analysis + newsBlock(e) + chatTranscriptBlock(e) +
      "</article>"
    );
  }

  function monthOptions(current) {
    const months = Array.from(new Set(sortedEntries().map((e) => e.date.slice(0, 7)))).sort().reverse();
    let html = '<option value="">全部月份</option>';
    months.forEach(function (m) {
      html += '<option value="' + m + '"' + (current === m ? " selected" : "") + ">" + monthLabel(m) + "</option>";
    });
    return html;
  }

  function renderArchive() {
    const entries = sortedEntries().filter(function (e) {
      return !archiveMonth || e.date.slice(0, 7) === archiveMonth;
    });
    const toolbar =
      '<div class="gallery-toolbar">' +
        '<select class="month-filter" id="archiveMonthFilter">' + monthOptions(archiveMonth) + "</select>" +
        '<span class="chat-hint">共 ' + entries.length + " 篇分析</span>" +
      "</div>";

    if (!entries.length) {
      return toolbar + '<div class="empty">这个月份还没有分析记录。</div>';
    }

    const groups = groupByMonth(entries);
    let html = toolbar;
    groups.forEach(function (list, m) {
      html += '<div class="gallery-group-title">' + monthLabel(m) + "</div>" + list.map(archiveItem).join("");
    });
    return html;
  }

  /* ---------- 视图：照片库 ---------- */

  function renderGallery() {
    const entries = sortedEntries().filter(function (e) {
      return !galleryMonth || e.date.slice(0, 7) === galleryMonth;
    });

    if (!entries.length) {
      return (
        '<div class="gallery-toolbar">' +
          '<select class="month-filter" id="monthFilter">' + monthOptions(galleryMonth) + "</select>" +
        "</div>" +
        '<div class="empty">这个月份还没有照片。</div>'
      );
    }

    const groups = groupByMonth(entries);
    let html = '<div class="gallery-toolbar"><select class="month-filter" id="monthFilter">' + monthOptions(galleryMonth) + "</select></div>";
    groups.forEach(function (list, m) {
      let count = 0;
      let imgs = "";
      list.forEach(function (e) {
        (e.photos || []).forEach(function (p) {
          count++;
          const label = p.label || "照片";
          const caption = formatDate(e.date) + " " + weekdayOf(e.date) + " · " + label;
          imgs += (
            '<div class="gallery-item" data-src="' + escapeHtml(p.src) + '" data-caption="' + escapeHtml(caption) + '" role="button" tabindex="0">' +
              '<img src="' + escapeHtml(p.src) + '" alt="' + escapeHtml(label) + '" loading="lazy">' +
              '<div class="g-info"><span>' + escapeHtml(label) + "</span><span>" + escapeHtml(e.date.slice(5).replace("-", "/")) + "</span></div>" +
            "</div>"
          );
        });
      });
      html +=
        '<div class="gallery-group-title">' + monthLabel(m) + " · " + count + " 张</div>" +
        '<div class="gallery-grid">' + imgs + "</div>";
    });
    return html;
  }

  /* ---------- 视图：使用说明 ---------- */

  function renderAbout() {
    return (
      '<div class="about-card">' +
        "<h2>这个工具怎么用</h2>" +
        "<ol>" +
          "<li>每个交易日，把<strong>开盘</strong>和<strong>收盘</strong>的截图发给 Claude。</li>" +
          "<li>Claude 结合当天新闻做简单分析，并把照片存进这里。</li>" +
          "<li>「每日复盘」看照片+分析+问 AI；「分析记录」看历史分析；「照片库」翻历史照片。</li>" +
        "</ol>" +
        "<h2>数据都在哪</h2>" +
        "<ul>" +
          "<li>分析正文存在 <code>js/data.js</code>，每天新增一条。</li>" +
          "<li>照片存在 <code>photos/YYYY-MM-DD/</code> 目录下。</li>" +
          "<li>整套东西发布在 GitHub Pages，手机浏览器也能随时看。</li>" +
        "</ul>" +
      "</div>"
    );
  }

  /* ---------- AI 聊天（当前为占位） ---------- */

  function askAI(date, question) {
    // ============================================================
    //  TODO：接入真实 AI 接口后，把这里的占位替换成 Anthropic API 调用。
    //  届时把 data.js 里对应日期的 summary / analysis / news 作为上下文
    //  传给模型，让它结合当天数据回答“为什么这么走”。
    // ============================================================
    return new Promise(function (resolve) {
      setTimeout(function () {
        resolve(
          "（AI 接口还没接入）等接好后，我会结合 " + formatDate(date) +
          " 当天的复盘数据和新闻来回答你。你刚才问的是：「" + question + "」"
        );
      }, 450);
    });
  }

  function appendMsg(container, role, text, typing) {
    const div = document.createElement("div");
    div.className = "msg " + role + (typing ? " typing" : "");
    div.innerHTML = typing
      ? '<div class="bubble"><span class="dots"><i></i><i></i><i></i></span></div>'
      : '<div class="bubble"><span class="bubble-text"></span></div>';
    if (!typing) div.querySelector(".bubble-text").textContent = text;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
    return div;
  }

  /* ---------- 灯箱 ---------- */

  let lbItems = [];
  let lbIndex = 0;

  function updateLightbox() {
    const it = lbItems[lbIndex];
    lbImg.src = it.src;
    lbCaption.textContent = it.caption;
  }

  function showLightbox(items, idx) {
    if (!items.length) return;
    lbItems = items;
    lbIndex = idx;
    updateLightbox();
    lb.hidden = false;
    document.body.style.overflow = "hidden";
  }

  function closeLightbox() {
    lb.hidden = true;
    document.body.style.overflow = "";
  }

  function stepLightbox(delta) {
    if (!lbItems.length) return;
    lbIndex = (lbIndex + delta + lbItems.length) % lbItems.length;
    updateLightbox();
  }

  /* ---------- 事件绑定 ---------- */

  document.getElementById("tabs").addEventListener("click", function (ev) {
    const btn = ev.target.closest(".tab");
    if (!btn) return;
    document.querySelectorAll(".tab").forEach(function (t) { t.classList.remove("active"); });
    btn.classList.add("active");
    render(btn.dataset.view);
  });

  function render(view) {
    if (view === "archive") main.innerHTML = renderArchive();
    else if (view === "gallery") main.innerHTML = renderGallery();
    else if (view === "about") main.innerHTML = renderAbout();
    else main.innerHTML = renderReview();
  }

  // 点击照片 -> 灯箱
  main.addEventListener("click", function (ev) {
    const el = ev.target.closest("[data-src]");
    if (!el) return;
    const imgs = Array.from(main.querySelectorAll("[data-src]"));
    const items = imgs.map(function (i) {
      return { src: i.dataset.src, caption: i.dataset.caption || "" };
    });
    showLightbox(items, imgs.indexOf(el));
  });

  // 键盘：回车/空格打开照片
  main.addEventListener("keydown", function (ev) {
    if (ev.key !== "Enter" && ev.key !== " ") return;
    const el = ev.target.closest("[data-src]");
    if (!el) return;
    ev.preventDefault();
    el.click();
  });

  // 月份筛选（照片库 / 分析记录）
  main.addEventListener("change", function (ev) {
    if (ev.target.id === "monthFilter") {
      galleryMonth = ev.target.value;
      render("gallery");
    } else if (ev.target.id === "archiveMonthFilter") {
      archiveMonth = ev.target.value;
      render("archive");
    }
  });

  // 聊天提交（并把问答存入本地，供「分析记录」展示）
  main.addEventListener("submit", function (ev) {
    const form = ev.target.closest(".chat-form");
    if (!form) return;
    ev.preventDefault();
    const input = form.querySelector(".chat-input");
    const q = input.value.trim();
    if (!q) return;
    const chat = form.closest(".chat");
    const date = chat.dataset.date;
    const msgsEl = chat.querySelector(".chat-messages");

    const history = loadChat(date);
    history.push({ role: "user", text: q });
    saveChat(date, history);

    input.value = "";
    appendMsg(msgsEl, "user", q);
    const typing = appendMsg(msgsEl, "assistant", "", true);

    askAI(date, q).then(function (text) {
      typing.innerHTML = '<div class="bubble"><span class="bubble-text"></span></div>';
      typing.querySelector(".bubble-text").textContent = text;
      typing.classList.remove("typing");

      const cur = loadChat(date);
      cur.push({ role: "assistant", text: text });
      saveChat(date, cur);
    });
  });

  // 清空当天的聊天记录
  main.addEventListener("click", function (ev) {
    const btn = ev.target.closest(".chat-clear");
    if (!btn) return;
    const chat = btn.closest(".chat");
    localStorage.removeItem(chatKey(chat.dataset.date));
    chat.querySelector(".chat-messages").innerHTML = "";
    btn.remove();
  });

  document.getElementById("lbClose").addEventListener("click", closeLightbox);
  document.getElementById("lbPrev").addEventListener("click", function () { stepLightbox(-1); });
  document.getElementById("lbNext").addEventListener("click", function () { stepLightbox(1); });
  lb.addEventListener("click", function (ev) {
    if (ev.target === lb) closeLightbox();
  });
  document.addEventListener("keydown", function (ev) {
    if (lb.hidden) return;
    if (ev.key === "Escape") closeLightbox();
    else if (ev.key === "ArrowLeft") stepLightbox(-1);
    else if (ev.key === "ArrowRight") stepLightbox(1);
  });

  /* ---------- 初始化 ---------- */

  const totalPhotos = (DATA.entries || []).reduce(function (n, e) {
    return n + (e.photos ? e.photos.length : 0);
  }, 0);
  statLine.textContent = (DATA.entries || []).length + " 天 · " + totalPhotos + " 张照片";
  updatedAt.textContent = DATA.updated || "—";
  render("review");
})();
