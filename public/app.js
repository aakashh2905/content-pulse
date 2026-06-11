const form = document.querySelector("#pipeline-form");
const submitButton = document.querySelector("#submit-button");
const saveCampaignButton = document.querySelector("#save-campaign-button");
const runDueButton = document.querySelector("#run-due-button");
const statusBadges = document.querySelector("#status-badges");
const runMeta = document.querySelector("#run-meta");
const assumptions = document.querySelector("#assumptions");
const scrapeSummary = document.querySelector("#scrape-summary");
const bucketSummary = document.querySelector("#bucket-summary");
const cardGroups = document.querySelector("#card-groups");
const topicRecommendation = document.querySelector("#topic-recommendation");
const topicTableBody = document.querySelector("#topic-table tbody");
const scriptOutput = document.querySelector("#script-output");
const hooksList = document.querySelector("#hooks-list");
const recommendedHook = document.querySelector("#recommended-hook");
const rawOutput = document.querySelector("#raw-output");
const storageStatus = document.querySelector("#storage-status");
const runHistory = document.querySelector("#run-history");
const schedulerStatus = document.querySelector("#scheduler-status");
const campaignList = document.querySelector("#campaign-list");
const industryPositioning = document.querySelector("#industry-positioning");
const industryBriefGrid = document.querySelector("#industry-brief-grid");
const contextSummary = document.querySelector("#context-summary");
const regionalBrief = document.querySelector("#regional-brief");
const regionalGrid = document.querySelector("#regional-grid");
const runSteps = document.querySelector("#run-steps");
const copyScriptButton = document.querySelector("#copy-script-button");
const copyHooksButton = document.querySelector("#copy-hooks-button");
const runTargetLabels = {
  "run-all": "Run client insights",
  "content-scraper": "Find posts only",
  "content-validator": "Rank topics",
  "my-voice-writer": "Write script",
  "hook-generator": "Generate hooks",
};
const industryLabels = {
  "agency-social": "Agency / Social Team",
  "b2b-saas": "B2B SaaS / Thought Leadership",
  "creator-education": "Creator Brand / Education",
  "d2c-brand": "D2C Brand / Social Commerce",
};
const teamModelLabels = {
  "agency-team": "Agency team",
  "in-house-marketing": "In-house marketing",
  "founder-led": "Founder-led brand",
  "creator-ops": "Creator ops",
};
const primaryGoalLabels = {
  pipeline: "Drive leads",
  authority: "Build authority",
  community: "Grow community",
  product: "Support launches",
};
const outputLanguageLabels = {
  auto: "Auto language",
  english: "English",
  hinglish: "Hinglish",
  hindi: "Hindi",
  kannada: "Kannada",
  tamil: "Tamil",
  telugu: "Telugu",
  malayalam: "Malayalam",
  marathi: "Marathi",
  bengali: "Bengali",
  spanish: "Spanish",
  french: "French",
  arabic: "Arabic",
};
let latestCampaigns = [];

function setText(element, value) {
  if (element) {
    element.textContent = value;
  }
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-US").format(Math.round(value || 0));
}

function formatPercent(value) {
  return `${(value * 100).toFixed(2)}%`;
}

function textareaToArray(value) {
  return value
    .split(/[\n,]/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function checkedValues(name) {
  return [...document.querySelectorAll(`input[name="${name}"]:checked`)].map((input) => input.value);
}

function renderSetupPreview(input) {
  const industryText = industryLabels[input.industryPreset] || input.industryPreset || "not set";
  const goalText = primaryGoalLabels[input.primaryGoal] || input.primaryGoal || "not set";
  const runText = runTargetLabels[input.runTarget] || "Run Selected Skill";
  const languageText = outputLanguageLabels[input.outputLanguage] || input.outputLanguage || "English";
  const regionText = input.targetRegion || "Global";
  const clientText = input.clientName || "No client yet";

  setText(contextSummary, `${clientText} | ${goalText} | ${regionText} | ${languageText} | ${runText}`);
  submitButton.textContent = runTargetLabels[input.runTarget] || "Run Selected Skill";
}

function setRunSteps(state) {
  if (!runSteps) {
    return;
  }

  const steps = [...runSteps.querySelectorAll(".step-pill")];
  const activeCount = {
    idle: 1,
    running: 2,
    validating: 3,
    complete: 4,
    error: 1,
  }[state] || 1;

  steps.forEach((step, index) => {
    step.classList.toggle("active", index < activeCount);
    step.classList.toggle("error", state === "error" && index === 0);
  });
}

function setButtonFeedback(button, label) {
  if (!button) {
    return;
  }
  const original = button.dataset.originalLabel || button.textContent;
  button.dataset.originalLabel = original;
  button.textContent = label;
  setTimeout(() => {
    button.textContent = original;
  }, 1200);
}

async function copyText(text, button) {
  const cleanText = String(text || "").trim();
  if (!cleanText || /^No .* yet\.|stage was not run/i.test(cleanText)) {
    setButtonFeedback(button, "Nothing yet");
    return;
  }

  try {
    await navigator.clipboard.writeText(cleanText);
  } catch {
    const helper = document.createElement("textarea");
    helper.value = cleanText;
    helper.setAttribute("readonly", "");
    helper.style.position = "fixed";
    helper.style.opacity = "0";
    document.body.appendChild(helper);
    helper.select();
    document.execCommand("copy");
    helper.remove();
  }

  setButtonFeedback(button, "Copied");
}

function renderBadges(status) {
  statusBadges.innerHTML = "";
  const entries = [
    {
      label: status.openaiConfigured ? "OpenAI ready" : "OpenAI not configured",
      className: status.openaiConfigured ? "live" : "demo",
    },
    {
      label: status.apifyConfigured ? "Apify token ready" : "Apify token missing",
      className: status.apifyConfigured ? "live" : "demo",
    },
    {
      label: status.actorConfigFilePresent ? "Actor mapping ready" : "Actor mapping missing",
      className: status.actorConfigFilePresent ? "live" : "demo",
    },
    {
      label:
        status.storage?.sharePoint?.requested && status.storage?.sharePoint?.configured
          ? "SharePoint storage ready"
          : status.storage?.sharePoint?.requested
            ? "SharePoint storage needs config"
            : "Local storage mode",
      className:
        status.storage?.sharePoint?.requested && status.storage?.sharePoint?.configured
          ? "live"
          : "demo",
    },
  ];

  for (const entry of entries) {
    const badge = document.createElement("span");
    badge.className = `badge ${entry.className}`;
    badge.textContent = entry.label;
    statusBadges.appendChild(badge);
  }
}

function renderStorageStatus(storage) {
  const sharePoint = storage?.sharePoint;
  if (!storage || !sharePoint) {
    storageStatus.textContent = "Storage status unavailable.";
    return;
  }

  if (sharePoint.requested && sharePoint.configured) {
    storageStatus.innerHTML = `
      <span class="strategy-pill">Provider: SharePoint</span>
      <span class="strategy-pill">Runs list: ${sharePoint.runsList}</span>
      <span class="strategy-pill">Posts list: ${sharePoint.postsList}</span>
      <span class="strategy-pill">Campaigns list: ${sharePoint.campaignsList}</span>
    `;
    return;
  }

  if (sharePoint.requested) {
    storageStatus.innerHTML = `
      <span class="strategy-pill">Provider: SharePoint pending</span>
      <span class="strategy-pill">Missing: ${sharePoint.missing.join(", ")}</span>
      <span class="strategy-pill">Fallback: ${storage.local.path}</span>
    `;
    return;
  }

  storageStatus.innerHTML = `
    <span class="strategy-pill">Provider: Local files</span>
    <span class="strategy-pill">${storage.local.path}</span>
  `;
}

function renderSchedulerStatus(scheduler) {
  if (!scheduler) {
    schedulerStatus.textContent = "Scheduler status unavailable.";
    return;
  }

  schedulerStatus.innerHTML = `
    <span class="strategy-pill">Scheduler: ${scheduler.enabled ? "running" : "stopped"}</span>
    <span class="strategy-pill">Last check: ${scheduler.lastCheckedAt ? new Date(scheduler.lastCheckedAt).toLocaleString() : "not checked"}</span>
    <span class="strategy-pill">Running jobs: ${scheduler.running?.length || 0}</span>
    ${scheduler.lastError ? `<span class="strategy-pill">Last error: ${scheduler.lastError}</span>` : ""}
  `;
}

async function loadStatus() {
  const response = await fetch("/api/health");
  const payload = await response.json();
  if (!payload.ok) {
    throw new Error(payload.error || "Could not load runtime status.");
  }
  renderBadges(payload.status);
  renderStorageStatus(payload.status.storage);
  renderSchedulerStatus(payload.status.scheduler);
}

function renderRunHistory(history) {
  const runs = history?.runs || [];
  if (!runs.length) {
    runHistory.innerHTML = `<div class="history-empty muted">No stored runs yet.</div>`;
    return;
  }

  runHistory.innerHTML = runs
    .map(
      (run) => `
        <article class="history-item">
          <div>
            <strong>${run.recommendedTopic || run.keywords || run.runId}</strong>
            <p>${run.clientName || "No client"} | ${run.industryPreset || "industry"} | ${run.primaryGoal || "goal"} | ${run.targetRegion || "Global"} | ${run.runTarget || "run"}</p>
          </div>
          <div class="history-metrics">
            <span>${run.source}</span>
            <span>${run.scrapeMode || "mode"}</span>
            <span>${run.scrapedPosts || 0} posts</span>
          </div>
        </article>
      `,
    )
    .join("");
}

async function loadRunHistory() {
  const response = await fetch("/api/runs?limit=8");
  const payload = await response.json();
  if (!payload.ok) {
    throw new Error(payload.error || "Could not load run history.");
  }
  renderRunHistory(payload.history);
}

function renderCampaigns(payload) {
  latestCampaigns = Array.isArray(payload) ? payload : payload?.campaigns || [];
  if (!latestCampaigns.length) {
    campaignList.innerHTML = `<div class="history-empty muted">No saved campaigns yet.</div>`;
    return;
  }

  campaignList.innerHTML = latestCampaigns
    .map((campaign) => {
      const isActive = campaign.status === "active";
      return `
        <article class="campaign-item">
          <div>
            <strong>${campaign.name}</strong>
            <p>${campaign.clientName || "No client"} | ${(campaign.keywords || []).join(", ") || campaign.topicOverride || "No keyword"} | ${campaign.targetRegion || "Global"} | ${campaign.scheduleTime || "09:00"} | ${campaign.status}</p>
            <p>Last: ${campaign.lastStatus || "not run"}${campaign.lastRunId ? ` | ${campaign.lastRunId}` : ""}</p>
          </div>
          <div class="campaign-actions">
            <button class="icon-button" type="button" data-campaign-action="run" data-campaign-id="${campaign.id}" title="Run now">Run</button>
            <button class="icon-button" type="button" data-campaign-action="toggle" data-campaign-id="${campaign.id}" title="${isActive ? "Pause" : "Activate"}">${isActive ? "Pause" : "Activate"}</button>
            <button class="icon-button danger" type="button" data-campaign-action="delete" data-campaign-id="${campaign.id}" title="Delete">Delete</button>
          </div>
        </article>
      `;
    })
    .join("");
}

async function loadCampaigns() {
  const response = await fetch("/api/campaigns");
  const payload = await response.json();
  if (!payload.ok) {
    throw new Error(payload.error || "Could not load campaigns.");
  }
  renderCampaigns(payload.campaigns);
}

function collectFormInput() {
  return {
    industryPreset: document.querySelector("#industryPreset").value,
    teamModel: document.querySelector("#teamModel").value,
    primaryGoal: document.querySelector("#primaryGoal").value,
    outputLanguage: document.querySelector("#outputLanguage").value,
    targetRegion: document.querySelector("#customRegion").value.trim() || document.querySelector("#targetRegion").value,
    clientName: document.querySelector("#clientName").value.trim(),
    skillLocation: document.querySelector("#skillLocation").value.trim(),
    uiType: document.querySelector("#uiType").value,
    scrapingMethod: document.querySelector("#scrapingMethod").value,
    runTarget: document.querySelector("#runTarget").value,
    outputFormats: checkedValues("outputFormats"),
    keywords: textareaToArray(document.querySelector("#keywords").value),
    competitors: textareaToArray(document.querySelector("#competitors").value),
    platforms: checkedValues("platforms"),
    lookbackDays: Number(document.querySelector("#lookbackDays").value),
    maxItemsPerPlatform: Number(document.querySelector("#maxItemsPerPlatform").value),
    topicOverride: document.querySelector("#topicOverride").value.trim(),
    voiceSamples: document.querySelector("#voiceSamples").value.trim(),
    enableTranscription: document.querySelector("#enableTranscription").checked,
  };
}

function collectCampaignInput() {
  const input = collectFormInput();
  return {
    ...input,
    name:
      document.querySelector("#campaignName").value.trim() ||
      `${input.clientName ? `${input.clientName} ` : ""}${input.keywords[0] || input.topicOverride || "Content"} campaign`,
    status: document.querySelector("#campaignStatus").value,
    scheduleTime: document.querySelector("#campaignScheduleTime").value || "09:00",
    timeZone: "Asia/Calcutta",
  };
}

function renderAssumptions(entries) {
  assumptions.innerHTML = "";
  for (const entry of entries || []) {
    const assumption = document.createElement("span");
    const level = /no public posts|failed|error/i.test(entry)
      ? "warning"
      : /run all skills|only content-scraper|only content-validator|only my-voice-writer|only hook-generator/i.test(entry)
        ? "action"
        : "info";
    assumption.className = `assumption ${level}`;
    assumption.textContent = entry;
    assumptions.appendChild(assumption);
  }
}

function renderIndustryBrief(brief) {
  if (!brief) {
    industryPositioning.textContent = "No industry brief yet.";
    industryBriefGrid.innerHTML = "";
    return;
  }

  industryPositioning.textContent = `${brief.positioning} ${brief.launchNarrative}`;
  const cards = [
    {
      title: "Why This Market Matters",
      lines: [brief.whyNow, ...brief.marketSignals],
    },
    {
      title: "Priority Workflows",
      lines: brief.priorityWorkflows,
    },
    {
      title: "KPI Focus",
      lines: brief.kpiFocus,
    },
    {
      title: "Product Moves",
      lines: brief.productMoves,
    },
    {
      title: "Winning Angle Types",
      lines: brief.anglePrompts,
    },
    {
      title: "Live Signal Summary",
      lines: [
        `Audience: ${brief.audience}`,
        `Team model: ${brief.teamModel}`,
        `Primary goal: ${brief.primaryGoal}`,
        ...(brief.topTopics?.length ? [`Top topics: ${brief.topTopics.join(", ")}`] : []),
        ...(brief.activeFormats?.length ? [`Active formats: ${brief.activeFormats.join(", ")}`] : []),
      ],
    },
  ];

  industryBriefGrid.innerHTML = cards
    .map(
      (card) => `
        <article class="brief-card">
          <span class="preview-label">${card.title}</span>
          <div class="list-stack">
            ${card.lines.map((line) => `<span class="strategy-pill">${line}</span>`).join("")}
          </div>
        </article>
      `,
    )
    .join("");
}

function renderRegionalInsights(validation) {
  const insights = validation?.regionalInsights;
  if (!insights) {
    regionalBrief.textContent = "Regional market lens was not generated for this run.";
    regionalGrid.innerHTML = "";
    return;
  }

  regionalBrief.textContent = `${insights.localOpportunity} ${insights.confidenceNote}`;
  const confidence = insights.confidenceCounts || {};
  const cards = [
    {
      title: "Regional Confidence",
      lines: Object.entries(confidence).length
        ? Object.entries(confidence).map(([label, count]) => `${label}: ${count}`)
        : ["No regional confidence data"],
    },
    {
      title: "Language Move",
      lines: [insights.languageRecommendation],
    },
    {
      title: "Trend Saturation",
      lines: [
        `${insights.trendSaturation?.status || "unknown"} | ${insights.trendSaturation?.score ?? 0}/100`,
        insights.trendSaturation?.reason || "No saturation reason returned.",
      ],
    },
    {
      title: "What To Copy",
      lines: insights.whatToCopy || [],
    },
    {
      title: "What To Avoid",
      lines: insights.whatToAvoid || [],
    },
  ];

  regionalGrid.innerHTML = cards
    .map(
      (card) => `
        <article class="brief-card region-card">
          <span class="preview-label">${card.title}</span>
          <div class="list-stack">
            ${card.lines.map((line) => `<span class="strategy-pill">${line}</span>`).join("")}
          </div>
        </article>
      `,
    )
    .join("");
}

function renderScrape(scrape) {
  const suffix = scrape.errors?.length
    ? ` ${scrape.errors.map((entry) => `${entry.platform}: ${entry.message}`).join(" | ")}`
    : "";
  const region = scrape.diagnostics?.regionProfile?.label || scrape.items?.[0]?.targetRegion || "Global";
  if (!scrape.items.length && scrape.errors?.length) {
    scrapeSummary.textContent = `No live posts returned for ${region}. ${suffix.trim()}`;
    scrapeSummary.classList.add("has-warning");
    return;
  }
  scrapeSummary.textContent = `${scrape.items.length} posts captured for ${region} in ${scrape.mode} mode.${suffix}`;
  scrapeSummary.classList.toggle("has-warning", Boolean(scrape.errors?.length));
}

function renderValidation(validation) {
  if (!validation) {
    topicRecommendation.textContent = "Validation was not run.";
    topicTableBody.innerHTML = "";
    return;
  }
  topicRecommendation.textContent = validation.recommendation
    ? `${validation.recommendation.topic} - ${validation.recommendation.reason}`
    : "No recommendation returned.";
  topicTableBody.innerHTML = "";

  for (const topic of validation.topicRankings) {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${topic.topic}</td>
      <td>${topic.postCount}</td>
      <td>${formatNumber(topic.averageViews)}</td>
      <td>${formatPercent(topic.averageEngagementRate)}</td>
      <td>${topic.repeatViralSignal ? "repeat viral signal" : ""}</td>
    `;
    topicTableBody.appendChild(row);
  }
}

function renderBucketCards(result) {
  const groups = result.scrapeCardBuckets || result.validation?.contentBuckets || [];
  if (!groups.length) {
    const searchSuggestions = result.scrape?.diagnostics?.searchSuggestions;
    const suggestedSeeds = searchSuggestions?.suggestedHashtags?.length
      ? `
        <div class="suggestion-stack">
          ${searchSuggestions.suggestedHashtags
            .slice(0, 8)
            .map((seed) => `<span class="strategy-pill">#${seed}</span>`)
            .join("")}
        </div>
      `
      : "";
    const suggestionTips = searchSuggestions?.tips?.length
      ? `<p class="card-copy">${searchSuggestions.tips.slice(0, 2).join(" ")}</p>`
      : `<p class="card-copy">Try a stronger hashtag-style keyword like aitools, vibe coding, digitalmarketing, or add a competitor handle.</p>`;
    bucketSummary.innerHTML = `
      <article class="bucket-tile empty-state">
        <strong>No clickable Instagram posts yet</strong>
        <div class="bucket-metrics">
          <span>Keyword needs refinement or broader source coverage.</span>
        </div>
      </article>
    `;
    cardGroups.innerHTML = `
      <article class="content-card empty-state">
        <strong>No thumbnails or source links were returned for this run.</strong>
        ${suggestionTips}
        ${suggestedSeeds}
      </article>
    `;
    return;
  }
  bucketSummary.innerHTML = "";
  cardGroups.innerHTML = "";

  for (const bucket of groups) {
    const tile = document.createElement("article");
    tile.className = "bucket-tile";
    tile.innerHTML = `
      <strong>${bucket.bucket}</strong>
      <div class="bucket-metrics">
        <span>${bucket.postCount} posts</span>
        <span>${formatNumber(bucket.averageViews)} avg views</span>
        <span>${formatPercent(bucket.averageEngagementRate)} avg ER</span>
      </div>
    `;
    bucketSummary.appendChild(tile);

    const group = document.createElement("section");
    group.className = "bucket-group";
    group.innerHTML = `
      <div class="bucket-header">
        <div>
          <h4>${bucket.bucket}</h4>
          <p>${bucket.postCount} posts | ${formatNumber(bucket.averageViews)} avg views | ${formatPercent(bucket.averageEngagementRate)} avg ER</p>
        </div>
      </div>
      <div class="card-grid"></div>
    `;

    const grid = group.querySelector(".card-grid");
    for (const card of bucket.cards) {
      const article = document.createElement("article");
      article.className = "content-card";
      const media = card.thumbnailUrl
        ? card.url
          ? `
          <a class="card-media-link" href="${card.url}" target="_blank" rel="noreferrer">
            <img class="card-media" src="${card.thumbnailUrl}" alt="${card.hookText || "Trending post thumbnail"}" loading="lazy" />
          </a>
        `
          : `
          <img class="card-media" src="${card.thumbnailUrl}" alt="${card.hookText || "Trending post thumbnail"}" loading="lazy" />
        `
        : `
          <div class="card-media placeholder">
            <span>No thumbnail</span>
          </div>
        `;
      article.innerHTML = `
        ${media}
        <div class="pill-row">
          <span class="mini-pill">${card.platform}</span>
          <span class="mini-pill">${card.format}</span>
          <span class="mini-pill region-fit ${card.regionConfidence || "unknown"}">${card.targetRegion || "Global"}: ${card.regionConfidence || "unknown"}</span>
          ${card.viralTag ? '<span class="mini-pill viral">viral</span>' : ""}
        </div>
        <h4>${card.url ? `<a class="card-title-link" href="${card.url}" target="_blank" rel="noreferrer">${card.hookText || "-"}</a>` : card.hookText || "-"}</h4>
        <p class="card-copy">${(card.caption || "").slice(0, 180) || "No caption available."}</p>
        <div class="card-meta">
          <span>${card.authorHandle}</span>
          <span>${formatNumber(card.views)} views</span>
          <span>${formatPercent(card.engagementRate)} ER</span>
        </div>
        <div class="card-meta">
          <span>Topic: ${card.topic}</span>
          <span>${card.postDate ? new Date(card.postDate).toLocaleDateString() : ""}</span>
        </div>
        ${card.url ? `<a class="card-link" href="${card.url}" target="_blank" rel="noreferrer">Open original Instagram post</a>` : ""}
      `;
      grid.appendChild(article);
    }

    cardGroups.appendChild(group);
  }
}

function renderVoice(voice) {
  scriptOutput.textContent = voice?.script || "Writer stage was not run.";
}

function renderHooks(hooks) {
  if (!hooks) {
    hooksList.innerHTML = "";
    recommendedHook.textContent = "Hook stage was not run.";
    return;
  }
  hooksList.innerHTML = "";
  const recommendedIndex = hooks.recommendedIndex ?? 0;
  recommendedHook.textContent = hooks.recommendedReason
    ? `Recommended hook #${recommendedIndex + 1}: ${hooks.recommendedReason}`
    : "No recommendation returned.";

  for (const [index, hook] of hooks.hooks.entries()) {
    const item = document.createElement("li");
    item.innerHTML = `
      <strong>${index + 1}. ${hook.pattern}</strong>
      <div>${hook.hook}</div>
      <div class="hook-meta">${hook.matchReason} Confidence: ${hook.confidence}/10</div>
    `;
    hooksList.appendChild(item);
  }
}

async function saveCampaign() {
  saveCampaignButton.disabled = true;
  saveCampaignButton.textContent = "Saving...";
  try {
    const response = await fetch("/api/campaigns", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(collectCampaignInput()),
    });
    const payload = await response.json();
    if (!payload.ok) {
      throw new Error(payload.error || "Campaign save failed.");
    }
    runMeta.textContent = `Campaign "${payload.campaign.name}" saved.`;
    await loadCampaigns();
    await loadStatus();
  } catch (error) {
    runMeta.textContent = `Campaign save failed: ${error.message}`;
  } finally {
    saveCampaignButton.disabled = false;
    saveCampaignButton.textContent = "Save Campaign";
  }
}

async function runDueCampaigns() {
  runDueButton.disabled = true;
  runDueButton.textContent = "Running...";
  try {
    const response = await fetch("/api/scheduler/run-due", { method: "POST" });
    const payload = await response.json();
    if (!payload.ok) {
      throw new Error(payload.error || "Scheduler run failed.");
    }
    runMeta.textContent = `${payload.results.length} due campaign job(s) processed.`;
    renderSchedulerStatus(payload.scheduler);
    await loadCampaigns();
    await loadRunHistory();
  } catch (error) {
    runMeta.textContent = `Scheduler run failed: ${error.message}`;
  } finally {
    runDueButton.disabled = false;
    runDueButton.textContent = "Run Due Campaigns";
  }
}

async function handleCampaignAction(event) {
  const button = event.target.closest("[data-campaign-action]");
  if (!button) {
    return;
  }

  const campaignId = button.dataset.campaignId;
  const action = button.dataset.campaignAction;
  const campaign = latestCampaigns.find((entry) => entry.id === campaignId);
  button.disabled = true;

  try {
    if (action === "run") {
      const response = await fetch(`/api/campaigns/${encodeURIComponent(campaignId)}/run`, { method: "POST" });
      const payload = await response.json();
      if (!payload.ok) {
        throw new Error(payload.error || "Campaign run failed.");
      }
      runMeta.textContent = `Campaign run completed: ${payload.result.runId}.`;
      renderAssumptions(payload.result.assumptions);
      renderIndustryBrief(payload.result.industryBrief);
      renderRegionalInsights(payload.result.validation);
      renderScrape(payload.result.scrape);
      renderValidation(payload.result.validation);
      renderBucketCards(payload.result);
      renderVoice(payload.result.voice);
      renderHooks(payload.result.hooks);
      rawOutput.textContent = JSON.stringify(payload.result, null, 2);
    }

    if (action === "toggle") {
      const nextStatus = campaign?.status === "active" ? "paused" : "active";
      const response = await fetch(`/api/campaigns/${encodeURIComponent(campaignId)}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: nextStatus }),
      });
      const payload = await response.json();
      if (!payload.ok) {
        throw new Error(payload.error || "Campaign update failed.");
      }
      runMeta.textContent = `Campaign "${payload.campaign.name}" is ${payload.campaign.status}.`;
    }

    if (action === "delete") {
      const response = await fetch(`/api/campaigns/${encodeURIComponent(campaignId)}`, { method: "DELETE" });
      const payload = await response.json();
      if (!payload.ok) {
        throw new Error(payload.error || "Campaign delete failed.");
      }
      runMeta.textContent = "Campaign deleted.";
    }

    await loadCampaigns();
    await loadRunHistory();
    await loadStatus();
  } catch (error) {
    runMeta.textContent = `${action} failed: ${error.message}`;
  } finally {
    button.disabled = false;
  }
}

async function runPipeline(event) {
  event.preventDefault();
  submitButton.disabled = true;
  submitButton.textContent = "Running...";
  setRunSteps("running");
  runMeta.textContent = "Finding live Instagram signals and building the client brief...";

  try {
    const response = await fetch("/api/run", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(collectFormInput()),
    });
    const payload = await response.json();
    if (!payload.ok) {
      throw new Error(payload.error || "Pipeline run failed.");
    }

    const { result } = payload;
    renderSetupPreview(result.request);
    setRunSteps("complete");
    const stageLabel = runTargetLabels[result.request.runTarget] || "Selected skill";
    const postCount = result.scrape?.items?.length || 0;
    runMeta.textContent = `${stageLabel} completed${result.request.clientName ? ` for ${result.request.clientName}` : ""}. ${postCount} Instagram post${postCount === 1 ? "" : "s"} returned. Run ID: ${result.runId}.`;
    renderAssumptions(result.assumptions);
    renderIndustryBrief(result.industryBrief);
    renderRegionalInsights(result.validation);
    renderScrape(result.scrape);
    renderValidation(result.validation);
    renderBucketCards(result);
    renderVoice(result.voice);
    renderHooks(result.hooks);
    rawOutput.textContent = JSON.stringify(result, null, 2);
    loadStatus().catch(() => {});
    loadRunHistory().catch(() => {});
    loadCampaigns().catch(() => {});
  } catch (error) {
    setRunSteps("error");
    runMeta.textContent = `Run failed: ${error.message}`;
    renderAssumptions([]);
    renderIndustryBrief(null);
    renderRegionalInsights(null);
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = runTargetLabels[collectFormInput().runTarget] || "Run Selected Skill";
  }
}

form.addEventListener("submit", runPipeline);
saveCampaignButton.addEventListener("click", saveCampaign);
runDueButton.addEventListener("click", runDueCampaigns);
campaignList.addEventListener("click", handleCampaignAction);
form.addEventListener("click", (event) => {
  const keywordButton = event.target.closest("[data-keyword]");
  if (keywordButton) {
    document.querySelector("#keywords").value = keywordButton.dataset.keyword;
    renderSetupPreview(collectFormInput());
  }

  const regionButton = event.target.closest("[data-region]");
  if (regionButton) {
    document.querySelector("#targetRegion").value = regionButton.dataset.region;
    document.querySelector("#customRegion").value = "";
    renderSetupPreview(collectFormInput());
  }
});
form.addEventListener("input", () => {
  renderSetupPreview(collectFormInput());
});
copyScriptButton?.addEventListener("click", () => copyText(scriptOutput.textContent, copyScriptButton));
copyHooksButton?.addEventListener("click", () => copyText(hooksList.innerText || recommendedHook.textContent, copyHooksButton));

renderSetupPreview(collectFormInput());
setRunSteps("idle");
loadStatus().catch((error) => {
  runMeta.textContent = `Status check failed: ${error.message}`;
});
loadRunHistory().catch((error) => {
  runHistory.innerHTML = `<div class="history-empty muted">Run history unavailable: ${error.message}</div>`;
});
loadCampaigns().catch((error) => {
  campaignList.innerHTML = `<div class="history-empty muted">Campaigns unavailable: ${error.message}</div>`;
});
