const graphBaseUrl = "https://graph.microsoft.com/v1.0";
const tokenBaseUrl = "https://login.microsoftonline.com";

const defaultRunsListName = "ASPI Content Pulse Runs";
const defaultPostsListName = "ASPI Content Pulse Posts";
const defaultCampaignsListName = "ASPI Content Pulse Campaigns";

function getEnv(name) {
  return String(process.env[name] || "").trim();
}

function getStorageProvider() {
  return (getEnv("STORAGE_PROVIDER") || "local").toLowerCase();
}

function getSharePointConfig() {
  const config = {
    provider: getStorageProvider(),
    tenantId: getEnv("SHAREPOINT_TENANT_ID"),
    clientId: getEnv("SHAREPOINT_CLIENT_ID"),
    clientSecret: getEnv("SHAREPOINT_CLIENT_SECRET"),
    siteId: getEnv("SHAREPOINT_SITE_ID"),
    runsListId: getEnv("SHAREPOINT_RUNS_LIST_ID"),
    postsListId: getEnv("SHAREPOINT_POSTS_LIST_ID"),
    campaignsListId: getEnv("SHAREPOINT_CAMPAIGNS_LIST_ID"),
    runsListName: getEnv("SHAREPOINT_RUNS_LIST_NAME") || defaultRunsListName,
    postsListName: getEnv("SHAREPOINT_POSTS_LIST_NAME") || defaultPostsListName,
    campaignsListName: getEnv("SHAREPOINT_CAMPAIGNS_LIST_NAME") || defaultCampaignsListName,
  };

  const missing = [];
  for (const [key, value] of Object.entries({
    SHAREPOINT_TENANT_ID: config.tenantId,
    SHAREPOINT_CLIENT_ID: config.clientId,
    SHAREPOINT_CLIENT_SECRET: config.clientSecret,
    SHAREPOINT_SITE_ID: config.siteId,
  })) {
    if (!value) {
      missing.push(key);
    }
  }

  return {
    ...config,
    requested: config.provider === "sharepoint" || config.provider === "hybrid",
    configured: missing.length === 0,
    missing,
  };
}

function compactJson(value, limit = 60000) {
  const raw = JSON.stringify(value);
  if (raw.length <= limit) {
    return raw;
  }

  return JSON.stringify({
    truncated: true,
    reason: `Payload exceeded ${limit} characters for SharePoint list storage.`,
    preview: raw.slice(0, limit),
  });
}

function asText(value, fallback = "") {
  if (value === null || value === undefined) {
    return fallback;
  }
  return String(value);
}

function asShortText(value, limit = 255) {
  return asText(value).slice(0, limit);
}

function getSitePath(config) {
  return `/sites/${config.siteId}`;
}

async function getAccessToken(config) {
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    grant_type: "client_credentials",
    scope: "https://graph.microsoft.com/.default",
  });

  const response = await fetch(`${tokenBaseUrl}/${encodeURIComponent(config.tenantId)}/oauth2/v2.0/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Microsoft Graph token request failed (${response.status}): ${details}`);
  }

  const payload = await response.json();
  return payload.access_token;
}

async function graphFetch(config, token, path, options = {}) {
  const response = await fetch(`${graphBaseUrl}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Microsoft Graph request failed (${response.status}) ${path}: ${details}`);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

async function resolveListId(config, token, listKey) {
  const explicitId =
    listKey === "runs" ? config.runsListId : listKey === "posts" ? config.postsListId : config.campaignsListId;
  if (explicitId) {
    return explicitId;
  }

  const listName =
    listKey === "runs" ? config.runsListName : listKey === "posts" ? config.postsListName : config.campaignsListName;
  const payload = await graphFetch(config, token, `${getSitePath(config)}/lists?$select=id,displayName,name,webUrl`);
  const list = (payload.value || []).find((entry) => entry.displayName === listName || entry.name === listName);
  if (!list) {
    throw new Error(`SharePoint list "${listName}" was not found on the configured site.`);
  }

  return list.id;
}

async function createListItem(config, token, listId, fields) {
  return graphFetch(config, token, `${getSitePath(config)}/lists/${encodeURIComponent(listId)}/items`, {
    method: "POST",
    body: JSON.stringify({ fields }),
  });
}

async function updateListItemFields(config, token, listId, itemId, fields) {
  return graphFetch(
    config,
    token,
    `${getSitePath(config)}/lists/${encodeURIComponent(listId)}/items/${encodeURIComponent(itemId)}/fields`,
    {
      method: "PATCH",
      body: JSON.stringify(fields),
    },
  );
}

async function deleteListItem(config, token, listId, itemId) {
  return graphFetch(
    config,
    token,
    `${getSitePath(config)}/lists/${encodeURIComponent(listId)}/items/${encodeURIComponent(itemId)}`,
    {
      method: "DELETE",
    },
  );
}

function summarizeRun(result) {
  return {
    runId: result.runId,
    request: result.request,
    assumptions: result.assumptions,
    scrape: {
      mode: result.scrape.mode,
      itemCount: result.scrape.items.length,
      errors: result.scrape.errors,
      diagnostics: result.scrape.diagnostics,
    },
    validation: result.validation
      ? {
          recommendation: result.validation.recommendation,
          topicRankings: result.validation.topicRankings,
          formatRankings: result.validation.formatRankings,
          regionalInsights: result.validation.regionalInsights,
          contentBuckets: result.validation.contentBuckets?.map((bucket) => ({
            bucket: bucket.bucket,
            postCount: bucket.postCount,
            averageViews: bucket.averageViews,
            averageEngagementRate: bucket.averageEngagementRate,
          })),
        }
      : null,
    voice: result.voice
      ? {
          topic: result.voice.topic,
          notes: result.voice.notes,
          script: result.voice.script,
        }
      : null,
    hooks: result.hooks,
    industryBrief: result.industryBrief,
  };
}

function buildRunFields(result) {
  return {
    Title: `Run ${result.runId}`,
    RunId: result.runId,
    CampaignId: result.request.campaignId || "",
    CampaignName: result.request.campaignName || "",
    StorageVersion: "1",
    RunStatus: "completed",
    IndustryPreset: asShortText(result.request.industryPreset),
    TeamModel: asShortText(result.request.teamModel),
    PrimaryGoal: asShortText(result.request.primaryGoal),
    RunTarget: asShortText(result.request.runTarget),
    Keywords: result.request.keywords.join(", "),
    Platforms: result.request.platforms.join(", "),
    ScrapeMode: asShortText(result.scrape.mode),
    ScrapedPosts: result.scrape.items.length,
    ContentBuckets: result.validation?.contentBuckets?.length || 0,
    RankedTopics: result.validation?.topicRankings?.length || 0,
    RecommendedTopic: asShortText(result.validation?.recommendation?.topic || result.voice?.topic || ""),
    ResultJson: compactJson(summarizeRun(result)),
  };
}

function findPostTopic(post, result) {
  const scoredPost = result.validation?.scoredPosts?.find((entry) => entry.id === post.id);
  return scoredPost?.topic || post.topic || post.matchedKeywords?.[0] || "";
}

function findPostBucket(post, result) {
  const scoredPost = result.validation?.scoredPosts?.find((entry) => entry.id === post.id);
  return scoredPost?.contentBucket || "";
}

function buildPostFields(post, result) {
  return {
    Title: asShortText(post.hookText || post.title || post.caption || post.id),
    RunId: result.runId,
    CampaignId: result.request.campaignId || "",
    CampaignName: result.request.campaignName || "",
    PostId: asShortText(post.id),
    Platform: asShortText(post.platform),
    ContentFormat: asShortText(post.contentFormat),
    AuthorHandle: asShortText(post.authorHandle),
    SourceUrl: post.url || "",
    ThumbnailUrl: post.thumbnailUrl || "",
    Topic: asShortText(findPostTopic(post, result)),
    Bucket: asShortText(findPostBucket(post, result)),
    Views: post.views || 0,
    Likes: post.likes || 0,
    Comments: post.comments || 0,
    Shares: post.shares || 0,
    EngagementRate: Number((post.engagementRate || 0).toFixed(6)),
    PostDate: post.postDate || null,
    ViralTag: Boolean(post.viralTag),
    PayloadJson: compactJson({
      id: post.id,
      platform: post.platform,
      authorHandle: post.authorHandle,
      url: post.url,
      thumbnailUrl: post.thumbnailUrl,
      hookText: post.hookText,
      caption: post.caption,
      views: post.views,
      likes: post.likes,
      comments: post.comments,
      shares: post.shares,
      engagementRate: post.engagementRate,
      postDate: post.postDate,
      contentFormat: post.contentFormat,
      matchedKeywords: post.matchedKeywords,
      targetRegion: post.targetRegion,
      regionConfidence: post.regionConfidence,
      regionSignals: post.regionSignals,
      raw: post.raw,
    }),
  };
}

function mapRunListItem(item) {
  const fields = item.fields || {};
  return {
    id: item.id,
    createdDateTime: item.createdDateTime,
    source: "sharepoint",
    runId: fields.RunId || "",
    campaignId: fields.CampaignId || "",
    campaignName: fields.CampaignName || "",
    clientName: fields.ClientName || "",
    title: fields.Title || "",
    industryPreset: fields.IndustryPreset || "",
    primaryGoal: fields.PrimaryGoal || "",
    runTarget: fields.RunTarget || "",
    keywords: fields.Keywords || "",
    platforms: fields.Platforms || "",
    scrapeMode: fields.ScrapeMode || "",
    scrapedPosts: fields.ScrapedPosts || 0,
    contentBuckets: fields.ContentBuckets || 0,
    recommendedTopic: fields.RecommendedTopic || "",
  };
}

export function getSharePointStatus() {
  const config = getSharePointConfig();
  return {
    provider: config.provider,
    requested: config.requested,
    configured: config.configured,
    missing: config.missing,
    siteIdConfigured: Boolean(config.siteId),
    runsList: config.runsListId || config.runsListName,
    postsList: config.postsListId || config.postsListName,
    campaignsList: config.campaignsListId || config.campaignsListName,
  };
}

export async function persistResultToSharePoint(result) {
  const config = getSharePointConfig();
  if (!config.requested) {
    return {
      provider: config.provider,
      status: "skipped",
      reason: "SharePoint storage is not requested.",
    };
  }

  if (!config.configured) {
    return {
      provider: config.provider,
      status: "not_configured",
      missing: config.missing,
    };
  }

  const token = await getAccessToken(config);
  const runsListId = await resolveListId(config, token, "runs");
  const postsListId = await resolveListId(config, token, "posts");
  const runItem = await createListItem(config, token, runsListId, buildRunFields(result));
  let postItemCount = 0;

  for (const post of result.scrape.items) {
    await createListItem(config, token, postsListId, buildPostFields(post, result));
    postItemCount += 1;
  }

  return {
    provider: "sharepoint",
    status: "written",
    runItemId: runItem?.id || null,
    postItemCount,
    runsList: config.runsListId || config.runsListName,
    postsList: config.postsListId || config.postsListName,
  };
}

export async function listRecentSharePointRuns(limit = 10) {
  const config = getSharePointConfig();
  if (!config.requested || !config.configured) {
    return null;
  }

  const token = await getAccessToken(config);
  const runsListId = await resolveListId(config, token, "runs");
  const payload = await graphFetch(
    config,
    token,
    `${getSitePath(config)}/lists/${encodeURIComponent(runsListId)}/items?$expand=fields&$top=${Math.max(limit, 1)}`,
  );

  return (payload.value || [])
    .map(mapRunListItem)
    .sort((left, right) => new Date(right.createdDateTime).getTime() - new Date(left.createdDateTime).getTime())
    .slice(0, limit);
}

function buildCampaignFields(campaign) {
  return {
    Title: asShortText(campaign.name || campaign.id),
    CampaignId: campaign.id,
    CampaignStatus: campaign.status,
    IndustryPreset: asShortText(campaign.industryPreset),
    TeamModel: asShortText(campaign.teamModel),
    PrimaryGoal: asShortText(campaign.primaryGoal),
    RunTarget: asShortText(campaign.runTarget),
    Keywords: (campaign.keywords || []).join(", "),
    Competitors: (campaign.competitors || []).join(", "),
    Platforms: (campaign.platforms || []).join(", "),
    LookbackDays: campaign.lookbackDays || 7,
    MaxItemsPerPlatform: campaign.maxItemsPerPlatform || 10,
    ScheduleTime: campaign.scheduleTime || "09:00",
    TimeZone: campaign.timeZone || "Asia/Calcutta",
    LastRunAt: campaign.lastRunAt || null,
    NextRunAt: campaign.nextRunAt || null,
    LastRunId: campaign.lastRunId || "",
    LastStatus: campaign.lastStatus || "",
    LastError: campaign.lastError || "",
    CampaignJson: compactJson(campaign),
  };
}

function mapCampaignListItem(item) {
  const fields = item.fields || {};
  let parsed = null;
  try {
    parsed = fields.CampaignJson ? JSON.parse(fields.CampaignJson) : null;
  } catch {
    parsed = null;
  }

  return {
    ...(parsed || {}),
    id: parsed?.id || fields.CampaignId || item.id,
    sharePointItemId: item.id,
    name: parsed?.name || fields.Title || fields.CampaignId || item.id,
    clientName: parsed?.clientName || fields.ClientName || "",
    status: parsed?.status || fields.CampaignStatus || "active",
    industryPreset: parsed?.industryPreset || fields.IndustryPreset || "agency-social",
    teamModel: parsed?.teamModel || fields.TeamModel || "agency-team",
    primaryGoal: parsed?.primaryGoal || fields.PrimaryGoal || "pipeline",
    runTarget: parsed?.runTarget || fields.RunTarget || "content-validator",
    keywords: parsed?.keywords || String(fields.Keywords || "").split(",").map((entry) => entry.trim()).filter(Boolean),
    competitors:
      parsed?.competitors || String(fields.Competitors || "").split(",").map((entry) => entry.trim()).filter(Boolean),
    platforms: parsed?.platforms || String(fields.Platforms || "instagram").split(",").map((entry) => entry.trim()).filter(Boolean),
    lookbackDays: parsed?.lookbackDays || Number(fields.LookbackDays || 7),
    maxItemsPerPlatform: parsed?.maxItemsPerPlatform || Number(fields.MaxItemsPerPlatform || 10),
    scheduleTime: parsed?.scheduleTime || fields.ScheduleTime || "09:00",
    timeZone: parsed?.timeZone || fields.TimeZone || "Asia/Calcutta",
    lastRunAt: parsed?.lastRunAt || fields.LastRunAt || null,
    nextRunAt: parsed?.nextRunAt || fields.NextRunAt || null,
    lastRunId: parsed?.lastRunId || fields.LastRunId || "",
    lastStatus: parsed?.lastStatus || fields.LastStatus || "",
    lastError: parsed?.lastError || fields.LastError || "",
  };
}

export async function listSharePointCampaigns(limit = 100) {
  const config = getSharePointConfig();
  if (!config.requested || !config.configured) {
    return null;
  }

  const token = await getAccessToken(config);
  const campaignsListId = await resolveListId(config, token, "campaigns");
  const payload = await graphFetch(
    config,
    token,
    `${getSitePath(config)}/lists/${encodeURIComponent(campaignsListId)}/items?$expand=fields&$top=${Math.max(limit, 1)}`,
  );

  return (payload.value || []).map(mapCampaignListItem);
}

export async function saveSharePointCampaign(campaign) {
  const config = getSharePointConfig();
  if (!config.requested || !config.configured) {
    return null;
  }

  const token = await getAccessToken(config);
  const campaignsListId = await resolveListId(config, token, "campaigns");
  const existing = campaign.sharePointItemId
    ? { sharePointItemId: campaign.sharePointItemId }
    : (await listSharePointCampaigns()).find((entry) => entry.id === campaign.id);

  if (existing?.sharePointItemId) {
    await updateListItemFields(config, token, campaignsListId, existing.sharePointItemId, buildCampaignFields(campaign));
    return {
      ...campaign,
      sharePointItemId: existing.sharePointItemId,
    };
  }

  const item = await createListItem(config, token, campaignsListId, buildCampaignFields(campaign));
  return {
    ...campaign,
    sharePointItemId: item?.id || null,
  };
}

export async function deleteSharePointCampaign(campaign) {
  const config = getSharePointConfig();
  if (!config.requested || !config.configured || !campaign?.sharePointItemId) {
    return false;
  }

  const token = await getAccessToken(config);
  const campaignsListId = await resolveListId(config, token, "campaigns");
  await deleteListItem(config, token, campaignsListId, campaign.sharePointItemId);
  return true;
}
