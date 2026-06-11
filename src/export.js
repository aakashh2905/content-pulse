function asText(value, fallback = "") {
  if (value === null || value === undefined) {
    return fallback;
  }
  return String(value);
}

function htmlEscape(value) {
  return asText(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function markdownCell(value) {
  return asText(value, "-").replace(/\|/g, "\\|").replace(/\r?\n/g, " ").trim() || "-";
}

function safeFilePart(value) {
  return (
    asText(value, "aspi-content-pulse")
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 90) || "aspi-content-pulse"
  );
}

function formatNumber(value) {
  return Number.isFinite(Number(value)) ? Math.round(Number(value)) : "";
}

function formatPercent(value) {
  return Number.isFinite(Number(value)) ? `${(Number(value) * 100).toFixed(2)}%` : "";
}

function markdownTable(headers, rows) {
  return [
    `| ${headers.map(markdownCell).join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.map(markdownCell).join(" | ")} |`),
  ].join("\n");
}

function tableHtml(title, headers, rows) {
  return `
    <h2>${htmlEscape(title)}</h2>
    <table>
      <thead>
        <tr>${headers.map((header) => `<th>${htmlEscape(header)}</th>`).join("")}</tr>
      </thead>
      <tbody>
        ${rows
          .map((row) => `<tr>${row.map((cell) => `<td>${htmlEscape(cell)}</td>`).join("")}</tr>`)
          .join("")}
      </tbody>
    </table>
  `;
}

function mapCardMetadata(result) {
  const metadata = new Map();
  for (const bucket of result.scrapeCardBuckets || []) {
    for (const card of bucket.cards || []) {
      metadata.set(card.id, {
        bucket: bucket.bucket,
        topic: card.topic,
        thumbnailUrl: card.thumbnailUrl,
        score: card.totalScore,
      });
    }
  }
  return metadata;
}

function mapValidationMetadata(result) {
  const metadata = new Map();
  for (const entry of result.validation?.topics || []) {
    metadata.set(entry.id, {
      topic: entry.topic,
      bucket: entry.bucket,
    });
  }

  for (const post of result.validation?.scoredPosts || []) {
    const existing = metadata.get(post.id) || {};
    metadata.set(post.id, {
      topic: post.topic || existing.topic,
      bucket: post.bucket || existing.bucket,
      score: post.totalScore,
    });
  }

  for (const bucket of result.validation?.contentBuckets || []) {
    for (const card of bucket.cards || []) {
      const existing = metadata.get(card.id) || {};
      metadata.set(card.id, {
        ...existing,
        topic: card.topic || existing.topic,
        bucket: bucket.bucket || existing.bucket,
        score: card.totalScore ?? existing.score,
      });
    }
  }

  return metadata;
}

function getPostRows(result) {
  const cardMetadata = mapCardMetadata(result);
  const validationMetadata = mapValidationMetadata(result);
  const items = result.scrape?.items || [];

  if (items.length) {
    return items.map((item) => {
      const card = cardMetadata.get(item.id) || {};
      const validation = validationMetadata.get(item.id) || {};
      return {
        id: item.id,
        client: result.request?.clientName || "",
        keyword: result.request?.keywords?.join(", ") || result.request?.topicOverride || "",
        targetRegion: item.targetRegion || result.request?.targetRegion || "Global",
        regionConfidence: item.regionConfidence || "",
        platform: item.platform || "",
        format: item.contentFormat || item.format || "",
        bucket: card.bucket || validation.bucket || "",
        topic: card.topic || validation.topic || "",
        author: item.authorHandle || "",
        hook: item.hookText || item.title || "",
        caption: item.caption || "",
        views: formatNumber(item.views),
        likes: formatNumber(item.likes),
        comments: formatNumber(item.comments),
        shares: formatNumber(item.shares),
        engagementRate: formatPercent(item.engagementRate),
        score: validation.score ?? card.score ?? "",
        viralTag: item.viralTag ? "Yes" : "",
        postDate: item.postDate || "",
        sourceUrl: item.url || "",
        thumbnailUrl: item.thumbnailUrl || card.thumbnailUrl || "",
      };
    });
  }

  return (result.scrapeCardBuckets || []).flatMap((bucket) =>
    (bucket.cards || []).map((card) => ({
      id: card.id,
      client: result.request?.clientName || "",
      keyword: result.request?.keywords?.join(", ") || result.request?.topicOverride || "",
      targetRegion: card.targetRegion || result.request?.targetRegion || "Global",
      regionConfidence: card.regionConfidence || "",
      platform: card.platform || "",
      format: card.format || "",
      bucket: bucket.bucket || "",
      topic: card.topic || "",
      author: card.authorHandle || "",
      hook: card.hookText || "",
      caption: card.caption || "",
      views: formatNumber(card.views),
      likes: "",
      comments: "",
      shares: "",
      engagementRate: formatPercent(card.engagementRate),
      score: card.totalScore ?? "",
      viralTag: card.viralTag ? "Yes" : "",
      postDate: card.postDate || "",
      sourceUrl: card.url || "",
      thumbnailUrl: card.thumbnailUrl || "",
    })),
  );
}

function getSummaryRows(result) {
  return [
    ["Run ID", result.runId],
    ["Client", result.request?.clientName || "Not specified"],
    ["Keywords", result.request?.keywords?.join(", ") || "Not specified"],
    ["Target region", result.request?.targetRegion || "Global"],
    ["Output language", result.request?.outputLanguage || "english"],
    ["Run target", result.request?.runTarget || "run-all"],
    ["Scrape mode", result.scrape?.mode || ""],
    ["Posts captured", result.scrape?.items?.length || 0],
    ["Recommended topic", result.validation?.recommendation?.topic || result.voice?.topic || ""],
    ["SharePoint status", result.storage?.sharePoint?.status || "not configured"],
    ["Local run folder", result.storage?.local?.runDir || result.runDir || ""],
  ];
}

function buildExcel(result) {
  const postRows = getPostRows(result);
  const postHeaders = [
    "Client",
    "Keyword",
    "Target Region",
    "Regional Fit",
    "Platform",
    "Format",
    "Content Bucket",
    "Topic",
    "Creator",
    "Hook / Title",
    "Caption",
    "Views",
    "Likes",
    "Comments",
    "Shares",
    "Engagement Rate",
    "Score",
    "Viral",
    "Post Date",
    "Source URL",
    "Thumbnail URL",
  ];
  const postCells = postRows.map((row) => [
    row.client,
    row.keyword,
    row.targetRegion,
    row.regionConfidence,
    row.platform,
    row.format,
    row.bucket,
    row.topic,
    row.author,
    row.hook,
    row.caption,
    row.views,
    row.likes,
    row.comments,
    row.shares,
    row.engagementRate,
    row.score,
    row.viralTag,
    row.postDate,
    row.sourceUrl,
    row.thumbnailUrl,
  ]);
  const topicRows = (result.validation?.topicRankings || []).map((topic) => [
    topic.topic,
    topic.postCount,
    formatNumber(topic.averageViews),
    formatPercent(topic.averageEngagementRate),
    topic.repeatViralSignal ? "Yes" : "",
  ]);
  const bucketRows = (result.validation?.contentBuckets || result.scrapeCardBuckets || []).map((bucket) => [
    bucket.bucket,
    bucket.postCount,
    formatNumber(bucket.averageViews),
    formatPercent(bucket.averageEngagementRate),
  ]);
  const hookRows = (result.hooks?.hooks || []).map((hook, index) => [
    index + 1,
    hook.pattern,
    hook.hook,
    hook.matchReason,
    hook.confidence,
  ]);

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      body { font-family: Arial, sans-serif; color: #111827; }
      h1 { font-size: 22px; margin: 0 0 12px; }
      h2 { font-size: 17px; margin: 22px 0 8px; }
      table { border-collapse: collapse; width: 100%; margin-bottom: 18px; }
      th { background: #0f172a; color: #ffffff; font-weight: 700; }
      th, td { border: 1px solid #cbd5e1; padding: 8px; vertical-align: top; font-size: 12px; }
      td { mso-number-format: "\\@"; }
    </style>
  </head>
  <body>
    <h1>ASPI Content Pulse Export</h1>
    ${tableHtml("Run Summary", ["Field", "Value"], getSummaryRows(result))}
    ${tableHtml("Trending Posts", postHeaders, postCells)}
    ${tableHtml("Topic Rankings", ["Topic", "Posts", "Avg Views", "Avg ER", "Repeat Signal"], topicRows)}
    ${tableHtml("Content Buckets", ["Bucket", "Posts", "Avg Views", "Avg ER"], bucketRows)}
    ${tableHtml("Hooks", ["#", "Pattern", "Hook", "Reason", "Confidence"], hookRows)}
  </body>
</html>`;
}

function buildMarkdown(result) {
  const postRows = getPostRows(result)
    .slice(0, 20)
    .map((row) => [
      row.bucket || "-",
      row.topic || "-",
      row.platform,
      row.author,
      row.views,
      row.engagementRate,
      row.sourceUrl,
    ]);
  const topicRows = (result.validation?.topicRankings || []).map((topic) => [
    topic.topic,
    topic.postCount,
    formatNumber(topic.averageViews),
    formatPercent(topic.averageEngagementRate),
    topic.repeatViralSignal ? "Yes" : "",
  ]);
  const hooks = (result.hooks?.hooks || [])
    .map((hook, index) => `${index + 1}. **${hook.pattern}:** ${hook.hook}`)
    .join("\n");

  return `# ASPI Content Pulse Report

Run ID: \`${result.runId}\`

## Summary
- Client: ${result.request?.clientName || "Not specified"}
- Keywords: ${result.request?.keywords?.join(", ") || "Not specified"}
- Target region: ${result.request?.targetRegion || "Global"}
- Posts captured: ${result.scrape?.items?.length || 0}
- Recommended topic: ${result.validation?.recommendation?.topic || result.voice?.topic || "Not generated"}

## Recommendation
${result.validation?.recommendation?.reason || "No validation recommendation was generated."}

## Topic Rankings
${markdownTable(["Topic", "Posts", "Avg Views", "Avg ER", "Repeat Signal"], topicRows)}

## Top Posts
${markdownTable(["Bucket", "Topic", "Platform", "Creator", "Views", "ER", "Source"], postRows)}

## Script
${result.voice?.script || "Writer stage was not run."}

## Hooks
${hooks || "Hook stage was not run."}
`;
}

export function getRunExport(result, requestedFormat = "excel") {
  const normalized = asText(requestedFormat, "excel").toLowerCase();
  const baseName = `${safeFilePart(result.request?.clientName || "aspi")}-${safeFilePart(result.runId)}`;

  if (["json", "raw"].includes(normalized)) {
    return {
      contentType: "application/json; charset=utf-8",
      fileName: `${baseName}.json`,
      body: `${JSON.stringify(result, null, 2)}\n`,
    };
  }

  if (["markdown", "md", "report"].includes(normalized)) {
    return {
      contentType: "text/markdown; charset=utf-8",
      fileName: `${baseName}.md`,
      body: buildMarkdown(result),
    };
  }

  return {
    contentType: "application/vnd.ms-excel; charset=utf-8",
    fileName: `${baseName}.xls`,
    body: buildExcel(result),
  };
}

const leadColumnPriority = [
  "postedBy",
  "posted by",
  "author",
  "name",
  "profile",
  "postContent",
  "post content",
  "content",
  "text",
  "signals",
  "date",
  "postDate",
  "post date",
  "keyword",
  "currentKeyword",
  "region",
  "sourceUrl",
  "source url",
  "url",
  "profileUrl",
  "profile url",
  "postUrl",
  "post url",
  "likes",
  "comments",
  "reposts",
];

function normalizeColumnName(value) {
  return asText(value)
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function normalizeRow(row) {
  if (row && typeof row === "object" && !Array.isArray(row)) {
    return Object.fromEntries(
      Object.entries(row).map(([key, value]) => [
        key,
        Array.isArray(value) ? value.join(" | ") : asText(value),
      ]),
    );
  }

  return {
    value: asText(row),
  };
}

function extractTableRows(input) {
  if (Array.isArray(input)) {
    return input.map(normalizeRow);
  }

  if (!input || typeof input !== "object") {
    return [];
  }

  const candidates = [input.rows, input.leads, input.items, input.data, input.results];
  const rows = candidates.find((entry) => Array.isArray(entry)) || [];
  return rows.map(normalizeRow);
}

function inferColumns(rows) {
  const keys = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const priority = leadColumnPriority
    .map((candidate) => keys.find((key) => key.toLowerCase() === candidate.toLowerCase()))
    .filter(Boolean);
  const rest = keys.filter((key) => !priority.includes(key)).sort((left, right) => left.localeCompare(right));
  return [...priority, ...rest];
}

export function normalizeTablePayload(input) {
  const source = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  const rows = extractTableRows(input);
  const columns = inferColumns(rows);

  return {
    title: asText(source.title || source.name || "Browser Lead Capture"),
    source: asText(source.source || source.platform || "browser"),
    sourceUrl: asText(source.sourceUrl || source.url || source.pageUrl),
    currentKeyword: asText(source.currentKeyword || source.keyword || source.searchKeyword),
    stats: source.stats && typeof source.stats === "object" ? source.stats : {},
    rows,
    columns,
  };
}

function buildGenericExcel(payload) {
  const normalized = normalizeTablePayload(payload);
  const summaryRows = [
    ["Title", normalized.title],
    ["Source", normalized.source],
    ["Keyword", normalized.currentKeyword],
    ["Source URL", normalized.sourceUrl],
    ["Rows", normalized.rows.length],
    ["Exported At", new Date().toISOString()],
    ...Object.entries(normalized.stats).map(([key, value]) => [normalizeColumnName(key), asText(value)]),
  ];
  const headers = normalized.columns.map(normalizeColumnName);
  const rows = normalized.rows.map((row) => normalized.columns.map((column) => row[column] ?? ""));

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      body { font-family: Arial, sans-serif; color: #111827; }
      h1 { font-size: 22px; margin: 0 0 12px; }
      h2 { font-size: 17px; margin: 22px 0 8px; }
      table { border-collapse: collapse; width: 100%; margin-bottom: 18px; }
      th { background: #0f172a; color: #ffffff; font-weight: 700; }
      th, td { border: 1px solid #cbd5e1; padding: 8px; vertical-align: top; font-size: 12px; }
      td { mso-number-format: "\\@"; }
    </style>
  </head>
  <body>
    <h1>${htmlEscape(normalized.title)}</h1>
    ${tableHtml("Capture Summary", ["Field", "Value"], summaryRows)}
    ${tableHtml("Collected Rows", headers, rows)}
  </body>
</html>`;
}

function buildGenericMarkdown(payload) {
  const normalized = normalizeTablePayload(payload);
  const headers = normalized.columns.map(normalizeColumnName);
  const rows = normalized.rows.map((row) => normalized.columns.map((column) => row[column] ?? ""));

  return `# ${normalized.title}

- Source: ${normalized.source || "browser"}
- Keyword: ${normalized.currentKeyword || "not specified"}
- Source URL: ${normalized.sourceUrl || "not captured"}
- Rows: ${normalized.rows.length}

${markdownTable(headers, rows)}
`;
}

export function getTableRowsExport(input, requestedFormat = "excel") {
  const normalized = normalizeTablePayload(input);
  const format = asText(requestedFormat, "excel").toLowerCase();
  const baseName = `${safeFilePart(normalized.title)}-${safeFilePart(normalized.currentKeyword || "capture")}`;

  if (["json", "raw"].includes(format)) {
    return {
      contentType: "application/json; charset=utf-8",
      fileName: `${baseName}.json`,
      body: `${JSON.stringify(normalized, null, 2)}\n`,
    };
  }

  if (["markdown", "md", "report"].includes(format)) {
    return {
      contentType: "text/markdown; charset=utf-8",
      fileName: `${baseName}.md`,
      body: buildGenericMarkdown(normalized),
    };
  }

  return {
    contentType: "application/vnd.ms-excel; charset=utf-8",
    fileName: `${baseName}.xls`,
    body: buildGenericExcel(normalized),
  };
}
