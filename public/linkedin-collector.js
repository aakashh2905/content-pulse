(() => {
  const existing = window.__aspiLinkedInCollector;
  if (existing?.destroy) {
    existing.destroy();
  }

  const apiBase = "http://localhost:3000";
  const state = {
    rows: [],
    keys: new Set(),
    logs: [],
    scanning: false,
    stats: {
      cardsSeen: 0,
      added: 0,
      duplicates: 0,
      empty: 0,
      missingUrl: 0,
    },
  };

  function clean(value) {
    return String(value || "")
      .replace(/\u00a0/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function linesFrom(element) {
    return (element?.innerText || "")
      .split(/\n+/)
      .map(clean)
      .filter(Boolean);
  }

  function currentKeyword() {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get("keywords") || params.get("q") || "";
    const searchInput = document.querySelector('input[aria-label*="Search" i], input[placeholder*="Search" i]');
    return clean(fromUrl || searchInput?.value || document.title.replace(/\| LinkedIn.*/i, ""));
  }

  function log(message) {
    state.logs.unshift({
      at: new Date().toLocaleTimeString(),
      message,
    });
    state.logs = state.logs.slice(0, 8);
    render();
  }

  function visible(element) {
    const rect = element.getBoundingClientRect();
    return rect.width > 120 && rect.height > 80 && rect.bottom > 0 && rect.top < window.innerHeight + 500;
  }

  function uniqueElements(elements) {
    return [...new Set(elements)].filter(visible).sort((left, right) => left.getBoundingClientRect().top - right.getBoundingClientRect().top);
  }

  function findCards() {
    const selectors = [
      "div.feed-shared-update-v2",
      "li.reusable-search__result-container",
      "div[data-urn*='activity']",
      "div[data-id*='urn:li:activity']",
      "article",
    ];
    const cards = uniqueElements(selectors.flatMap((selector) => [...document.querySelectorAll(selector)]));
    return cards.filter((card) => clean(card.innerText).length > 40);
  }

  function firstMatchingLine(lines, patterns) {
    return lines.find((line) => patterns.some((pattern) => pattern.test(line))) || "";
  }

  function extractAuthor(card, lines) {
    const actor =
      card.querySelector(".update-components-actor__name") ||
      card.querySelector(".entity-result__title-text") ||
      card.querySelector("[data-anonymize='person-name']") ||
      card.querySelector("span[dir='ltr']");
    const actorText = clean(actor?.innerText);
    if (actorText) {
      return actorText.replace(/\s+View.*$/i, "");
    }

    return lines.find((line) => !/^(promoted|follow|following|like|comment|repost|send)$/i.test(line)) || "Unknown";
  }

  function extractDate(card, lines) {
    const time = card.querySelector("time");
    if (time?.dateTime) {
      return time.dateTime;
    }
    return firstMatchingLine(lines, [/\b\d+\s*(m|h|d|w|mo|yr|y)\b/i, /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/i]);
  }

  function normalizeUrl(url) {
    try {
      const parsed = new URL(url, window.location.href);
      parsed.hash = "";
      return parsed.href;
    } catch {
      return "";
    }
  }

  function extractUrl(card) {
    const anchors = [...card.querySelectorAll("a[href]")].map((anchor) => normalizeUrl(anchor.getAttribute("href")));
    return (
      anchors.find((url) => /linkedin\.com\/feed\/update|linkedin\.com\/posts\//i.test(url)) ||
      anchors.find((url) => /linkedin\.com\/in\//i.test(url)) ||
      anchors.find((url) => /linkedin\.com\//i.test(url)) ||
      ""
    );
  }

  function extractMetrics(text) {
    const comments = text.match(/(\d[\d,]*)\s+comments?/i)?.[1] || "";
    const reposts = text.match(/(\d[\d,]*)\s+reposts?/i)?.[1] || "";
    const reactions = text.match(/(?:like|celebrate|support|love|insightful|curious)?\s*(\d[\d,]*)\s*(?:reactions?)?/i)?.[1] || "";
    return {
      reactions,
      comments,
      reposts,
    };
  }

  function extractContent(lines, author) {
    const ignored = [/^like$/i, /^comment$/i, /^repost$/i, /^send$/i, /^promoted$/i, /^follow$/i, /^following$/i, /^see more$/i];
    const filtered = lines.filter((line) => {
      if (line === author) {
        return false;
      }
      if (ignored.some((pattern) => pattern.test(line))) {
        return false;
      }
      if (/^\d+\s*(comments?|reposts?)$/i.test(line)) {
        return false;
      }
      return true;
    });
    return clean(filtered.join(" ").slice(0, 1400));
  }

  function rowKey(row) {
    if (row.postUrl && !row.postUrl.includes("/search/results/")) {
      return `url:${row.postUrl}`;
    }
    return `text:${row.postedBy.toLowerCase()}|${row.postContent.toLowerCase().slice(0, 260)}|${row.postDate}`;
  }

  function extractRow(card, index) {
    const lines = linesFrom(card);
    const text = clean(card.innerText);
    const postedBy = extractAuthor(card, lines);
    const postDate = extractDate(card, lines);
    const postUrl = extractUrl(card);
    const postContent = extractContent(lines, postedBy);
    const metrics = extractMetrics(text);

    if (!postContent || postContent.length < 15) {
      state.stats.empty += 1;
      return null;
    }
    if (!postUrl) {
      state.stats.missingUrl += 1;
    }

    return {
      keyword: currentKeyword(),
      postedBy,
      postContent,
      signals: [metrics.reactions && `${metrics.reactions} reactions`, metrics.comments && `${metrics.comments} comments`, metrics.reposts && `${metrics.reposts} reposts`]
        .filter(Boolean)
        .join(" | "),
      reactions: metrics.reactions,
      comments: metrics.comments,
      reposts: metrics.reposts,
      postDate,
      postUrl,
      pageUrl: window.location.href,
      capturedAt: new Date().toISOString(),
      fallbackId: `visible-card-${index}-${Date.now()}`,
    };
  }

  function scanVisible() {
    const cards = findCards();
    state.stats.cardsSeen += cards.length;
    let added = 0;

    cards.forEach((card, index) => {
      const row = extractRow(card, index);
      if (!row) {
        return;
      }
      const key = rowKey(row);
      if (state.keys.has(key)) {
        state.stats.duplicates += 1;
        return;
      }
      state.keys.add(key);
      state.rows.push(row);
      added += 1;
    });

    state.stats.added += added;
    log(`Scanned ${cards.length} visible cards. Added ${added} new rows.`);
    render();
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function autoScroll() {
    if (state.scanning) {
      return;
    }

    state.scanning = true;
    render();
    let stagnantPasses = 0;
    let lastCount = state.rows.length;

    for (let pass = 0; pass < 12; pass += 1) {
      scanVisible();
      window.scrollBy({ top: Math.round(window.innerHeight * 0.82), behavior: "smooth" });
      await sleep(1200);
      if (state.rows.length === lastCount) {
        stagnantPasses += 1;
      } else {
        stagnantPasses = 0;
        lastCount = state.rows.length;
      }
      if (stagnantPasses >= 3) {
        break;
      }
    }

    state.scanning = false;
    log(`Auto-scroll finished. Total rows: ${state.rows.length}.`);
    render();
  }

  function escapeHtml(value) {
    return clean(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function downloadBlob(fileName, body, type) {
    const blob = new Blob([body], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function localExcelBody() {
    const columns = ["keyword", "postedBy", "postContent", "signals", "reactions", "comments", "reposts", "postDate", "postUrl", "pageUrl", "capturedAt"];
    const rows = state.rows
      .map((row) => `<tr>${columns.map((column) => `<td>${escapeHtml(row[column])}</td>`).join("")}</tr>`)
      .join("");
    return `<!doctype html><html><head><meta charset="utf-8" /></head><body><table><thead><tr>${columns
      .map((column) => `<th>${escapeHtml(column)}</th>`)
      .join("")}</tr></thead><tbody>${rows}</tbody></table></body></html>`;
  }

  function fileNameFromDisposition(header) {
    const utf8Match = header?.match(/filename\*=UTF-8''([^;]+)/i);
    if (utf8Match) {
      return decodeURIComponent(utf8Match[1]);
    }
    const asciiMatch = header?.match(/filename="([^"]+)"/i);
    return asciiMatch?.[1] || `linkedin-leads-${Date.now()}.xls`;
  }

  async function downloadExcel() {
    if (!state.rows.length) {
      log("No rows yet. Click Scan visible or Auto-scroll first.");
      return;
    }

    const payload = {
      title: "LinkedIn Collected Leads",
      source: "LinkedIn",
      sourceUrl: window.location.href,
      currentKeyword: currentKeyword(),
      stats: state.stats,
      rows: state.rows,
    };

    try {
      const response = await fetch(`${apiBase}/api/linkedin/export`, {
        method: "POST",
        mode: "cors",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        throw new Error(`Local API returned HTTP ${response.status}`);
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileNameFromDisposition(response.headers.get("content-disposition"));
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      log("Excel downloaded from local app.");
    } catch (error) {
      downloadBlob(`linkedin-leads-${Date.now()}.xls`, localExcelBody(), "application/vnd.ms-excel;charset=utf-8");
      log(`Local app unavailable, used browser fallback Excel. ${error.message}`);
    }
  }

  async function copyTable() {
    if (!state.rows.length) {
      log("Nothing to copy yet.");
      return;
    }
    const columns = ["keyword", "postedBy", "postContent", "signals", "postDate", "postUrl"];
    const text = [columns.join("\t"), ...state.rows.map((row) => columns.map((column) => clean(row[column])).join("\t"))].join("\n");
    await navigator.clipboard.writeText(text);
    log("Copied table to clipboard.");
  }

  function render() {
    panel.querySelector("[data-count='rows']").textContent = state.rows.length;
    panel.querySelector("[data-count='cards']").textContent = state.stats.cardsSeen;
    panel.querySelector("[data-count='dupes']").textContent = state.stats.duplicates;
    panel.querySelector("[data-count='missing']").textContent = state.stats.missingUrl;
    panel.querySelector("[data-status]").textContent = state.scanning ? "Auto-scrolling" : "Ready";
    panel.querySelector("[data-keyword]").textContent = currentKeyword() || "not detected";
    panel.querySelector("[data-body]").innerHTML =
      state.rows
        .slice(-8)
        .reverse()
        .map(
          (row) => `
            <article class="aspi-row">
              <strong>${escapeHtml(row.postedBy)}</strong>
              <p>${escapeHtml(row.postContent).slice(0, 260)}</p>
              <small>${escapeHtml(row.signals || "No visible metrics")} ${row.postUrl ? "" : " | no post URL"}</small>
            </article>
          `,
        )
        .join("") || `<div class="aspi-empty">No rows yet. Scan visible cards or auto-scroll.</div>`;
    panel.querySelector("[data-log]").innerHTML = state.logs.map((entry) => `<div>${entry.at} - ${escapeHtml(entry.message)}</div>`).join("");
  }

  function destroy() {
    panel.remove();
    delete window.__aspiLinkedInCollector;
  }

  const style = document.createElement("style");
  style.textContent = `
    #aspi-li-panel {
      position: fixed;
      z-index: 2147483647;
      right: 18px;
      top: 70px;
      width: min(430px, calc(100vw - 32px));
      max-height: calc(100vh - 100px);
      overflow: auto;
      padding: 16px;
      border: 1px solid rgba(125, 211, 252, 0.24);
      border-radius: 20px;
      background: #07111f;
      color: #f8fbff;
      box-shadow: 0 24px 80px rgba(0, 0, 0, 0.42);
      font: 13px/1.45 Arial, sans-serif;
    }
    #aspi-li-panel * { box-sizing: border-box; }
    #aspi-li-panel h2 { margin: 0; font-size: 18px; }
    #aspi-li-panel p { margin: 0; }
    .aspi-top { display: flex; justify-content: space-between; gap: 12px; align-items: start; }
    .aspi-close { border: 0; background: transparent; color: #93c5fd; cursor: pointer; font-size: 20px; }
    .aspi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin: 14px 0; }
    .aspi-metric { padding: 9px; border: 1px solid rgba(148, 163, 184, 0.2); border-radius: 14px; background: rgba(15, 23, 42, 0.9); }
    .aspi-metric strong { display: block; font-size: 18px; color: #e0f2fe; }
    .aspi-metric span { color: #9ca3af; font-size: 11px; }
    .aspi-actions { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; margin-bottom: 12px; }
    .aspi-actions button { min-height: 36px; border: 1px solid rgba(125, 211, 252, 0.28); border-radius: 12px; background: #0f2137; color: #e0f2fe; cursor: pointer; font-weight: 700; }
    .aspi-actions button:hover { background: #123456; }
    .aspi-row { margin-top: 8px; padding: 10px; border: 1px solid rgba(148, 163, 184, 0.2); border-radius: 14px; background: rgba(15, 23, 42, 0.78); }
    .aspi-row strong { display: block; color: #ffffff; }
    .aspi-row p { margin: 5px 0; color: #dbeafe; }
    .aspi-row small, .aspi-empty, .aspi-log { color: #93a4b8; font-size: 12px; }
    .aspi-log { margin-top: 12px; display: grid; gap: 6px; }
    .aspi-keyword { color: #67e8f9; font-weight: 700; word-break: break-word; }
  `;
  document.documentElement.appendChild(style);

  const panel = document.createElement("div");
  panel.id = "aspi-li-panel";
  panel.innerHTML = `
    <div class="aspi-top">
      <div>
        <h2>ASPI LinkedIn Collector</h2>
        <p>Status: <strong data-status>Ready</strong></p>
        <p>Keyword: <span class="aspi-keyword" data-keyword></span></p>
      </div>
      <button class="aspi-close" type="button" title="Close">x</button>
    </div>
    <div class="aspi-grid">
      <div class="aspi-metric"><strong data-count="rows">0</strong><span>Rows</span></div>
      <div class="aspi-metric"><strong data-count="cards">0</strong><span>Cards</span></div>
      <div class="aspi-metric"><strong data-count="dupes">0</strong><span>Duplicates</span></div>
      <div class="aspi-metric"><strong data-count="missing">0</strong><span>Missing URLs</span></div>
    </div>
    <div class="aspi-actions">
      <button type="button" data-action="scan">Scan visible</button>
      <button type="button" data-action="scroll">Auto-scroll</button>
      <button type="button" data-action="excel">Download Excel</button>
      <button type="button" data-action="copy">Copy table</button>
    </div>
    <div data-body></div>
    <div class="aspi-log" data-log></div>
  `;
  document.body.appendChild(panel);

  panel.querySelector(".aspi-close").addEventListener("click", destroy);
  panel.querySelector("[data-action='scan']").addEventListener("click", scanVisible);
  panel.querySelector("[data-action='scroll']").addEventListener("click", autoScroll);
  panel.querySelector("[data-action='excel']").addEventListener("click", downloadExcel);
  panel.querySelector("[data-action='copy']").addEventListener("click", copyTable);

  window.__aspiLinkedInCollector = {
    destroy,
    scanVisible,
    autoScroll,
    downloadExcel,
    rows: state.rows,
  };

  scanVisible();
  log("Collector ready. Use Auto-scroll to collect posts below the fold.");
})();
