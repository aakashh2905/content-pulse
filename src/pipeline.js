import { access, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { getApifyStatus, scrapeRecentPosts } from "./apify.js";
import {
  buildIndustryBrief,
  getIndustryProfile,
  getPrimaryGoalLabel,
  getScoreWeights,
  getTeamModelLabel,
} from "./industry.js";
import { createJsonResponse, createTextResponse, isOpenAIConfigured, transcribeFromUrl } from "./openai.js";
import { getStorageStatus, listRecentRuns, persistExternalStorage } from "./storage/index.js";

const supportedPlatforms = ["instagram", "youtube", "x"];
const defaultPlatforms = ["instagram"];
const defaultIndustryPreset = "agency-social";
const defaultTeamModel = "agency-team";
const defaultPrimaryGoal = "pipeline";
const defaultOutputLanguage = "english";
const defaultTargetRegion = "Global";
const outputLanguageProfiles = {
  auto: {
    label: "Auto from voice samples",
    instruction: "Infer the language from the supplied voice samples. If no sample is available, use English.",
    scriptNote: "Use the language detected from the supplied voice samples.",
    cta: "Drop the keyword in comments and I will send the setup.",
  },
  english: {
    label: "English",
    instruction: "Write entirely in natural English. Do not use Hindi or Hinglish words unless they appear inside a quoted source.",
    scriptNote: "plain English",
    cta: "Drop the keyword in comments and I will send the setup.",
  },
  hinglish: {
    label: "Hinglish",
    instruction: "Write in conversational Hinglish using Latin script. Mix simple Hindi words with English, but keep it easy to speak.",
    scriptNote: "simple Hinglish",
    cta: "Keyword comment karo, main template bhej dunga.",
  },
  hindi: {
    label: "Hindi",
    instruction: "Write in natural Hindi using Devanagari script. Avoid Hinglish unless a brand or tool name requires English.",
    scriptNote: "Hindi",
    cta: "Comment mein keyword likhiye, main setup bhej dunga.",
  },
  kannada: {
    label: "Kannada",
    instruction: "Write in natural Kannada. Keep tool names and brand names in English when needed.",
    scriptNote: "Kannada",
    cta: "Comment alli keyword haki, setup kalisuttene.",
  },
  tamil: {
    label: "Tamil",
    instruction: "Write in natural Tamil. Keep tool names and brand names in English when needed.",
    scriptNote: "Tamil",
    cta: "Comment la keyword podunga, setup share panren.",
  },
  telugu: {
    label: "Telugu",
    instruction: "Write in natural Telugu. Keep tool names and brand names in English when needed.",
    scriptNote: "Telugu",
    cta: "Comment lo keyword pettandi, setup pampistanu.",
  },
  malayalam: {
    label: "Malayalam",
    instruction: "Write in natural Malayalam. Keep tool names and brand names in English when needed.",
    scriptNote: "Malayalam",
    cta: "Comment il keyword idu, setup ayakkam.",
  },
  marathi: {
    label: "Marathi",
    instruction: "Write in natural Marathi. Keep tool names and brand names in English when needed.",
    scriptNote: "Marathi",
    cta: "Comment madhye keyword liha, mi setup pathavto.",
  },
  bengali: {
    label: "Bengali",
    instruction: "Write in natural Bengali. Keep tool names and brand names in English when needed.",
    scriptNote: "Bengali",
    cta: "Comment e keyword likhun, setup pathiye debo.",
  },
  spanish: {
    label: "Spanish",
    instruction: "Write entirely in natural Spanish. Keep tool names and brand names in English when needed.",
    scriptNote: "Spanish",
    cta: "Comenta la palabra clave y te envio la configuracion.",
  },
  french: {
    label: "French",
    instruction: "Write entirely in natural French. Keep tool names and brand names in English when needed.",
    scriptNote: "French",
    cta: "Commente le mot-cle et je t'envoie la configuration.",
  },
  arabic: {
    label: "Arabic",
    instruction: "Write entirely in natural Arabic. Keep tool names and brand names in English when needed.",
    scriptNote: "Arabic",
    cta: "اكتب الكلمة المفتاحية في التعليقات وسأرسل لك الإعداد.",
  },
};
const topicStopwords = new Set([
  "about",
  "after",
  "before",
  "build",
  "built",
  "click",
  "comment",
  "content",
  "create",
  "creator",
  "daily",
  "dont",
  "entire",
  "first",
  "from",
  "have",
  "into",
  "just",
  "less",
  "make",
  "more",
  "most",
  "post",
  "prompt",
  "really",
  "reel",
  "short",
  "single",
  "than",
  "that",
  "their",
  "them",
  "they",
  "this",
  "today",
  "using",
  "video",
  "viral",
  "what",
  "when",
  "with",
  "your",
]);
const stageOptions = new Set([
  "content-scraper",
  "content-validator",
  "my-voice-writer",
  "hook-generator",
  "run-all",
]);
const languageOptions = new Set(Object.keys(outputLanguageProfiles));

function unique(values) {
  return [...new Set(values)];
}

function toArray(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry).trim()).filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(/[\n,]/)
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  return [];
}

function clampNumber(value, minimum, maximum, fallback) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  return Math.min(Math.max(numeric, minimum), maximum);
}

function toOptionalString(value) {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim();
}

function normalizeOutputLanguage(value) {
  const normalized = toOptionalString(value).toLowerCase();
  return languageOptions.has(normalized) ? normalized : defaultOutputLanguage;
}

function getLanguageProfile(request) {
  return outputLanguageProfiles[request.outputLanguage] || outputLanguageProfiles[defaultOutputLanguage];
}

function normalizeTargetRegion(value) {
  return toOptionalString(value) || defaultTargetRegion;
}

function isRegionalRequest(request) {
  return normalizeTargetRegion(request.targetRegion).toLowerCase() !== defaultTargetRegion.toLowerCase();
}

function percentage(value) {
  return `${(value * 100).toFixed(2)}%`;
}

function numberWithCommas(value) {
  return new Intl.NumberFormat("en-US").format(Math.round(value || 0));
}

function regionalFitBoost(item, request) {
  if (!isRegionalRequest(request)) {
    return 0;
  }

  if (item.regionConfidence === "high") {
    return 8;
  }
  if (item.regionConfidence === "medium") {
    return 4;
  }
  return 0;
}

function formatTimestampForId() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function normalizeRequest(input) {
  const keywords = unique(toArray(input.keywords));
  const competitors = unique(toArray(input.competitors));
  const outputFormats = unique(toArray(input.outputFormats));
  const platforms = unique(toArray(input.platforms).map((value) => value.toLowerCase())).filter((value) =>
    supportedPlatforms.includes(value),
  );

  const normalized = {
    skillLocation: toOptionalString(input.skillLocation) || "C:\\Users\\Win 10\\.codex\\skills",
    uiType: toOptionalString(input.uiType) || "simple local web page",
    scrapingMethod: toOptionalString(input.scrapingMethod) || "Apify + OpenAI",
    campaignId: toOptionalString(input.campaignId),
    campaignName: toOptionalString(input.campaignName),
    clientName: toOptionalString(input.clientName),
    industryPreset: toOptionalString(input.industryPreset) || defaultIndustryPreset,
    teamModel: toOptionalString(input.teamModel) || defaultTeamModel,
    primaryGoal: toOptionalString(input.primaryGoal) || defaultPrimaryGoal,
    outputLanguage: normalizeOutputLanguage(input.outputLanguage),
    targetRegion: normalizeTargetRegion(input.targetRegion),
    runTarget: stageOptions.has(toOptionalString(input.runTarget)) ? toOptionalString(input.runTarget) : "run-all",
    outputFormats: outputFormats.length ? outputFormats : ["markdown table", "json"],
    keywords,
    competitors,
    platforms: platforms.length ? platforms : [...defaultPlatforms],
    lookbackDays: clampNumber(input.lookbackDays, 1, 30, 7),
    maxItemsPerPlatform: clampNumber(input.maxItemsPerPlatform, 1, 25, 10),
    topicOverride: toOptionalString(input.topicOverride),
    voiceSamples: toOptionalString(input.voiceSamples),
    enableTranscription: Boolean(input.enableTranscription),
  };

  if (!normalized.keywords.length && !normalized.topicOverride) {
    throw new Error("Provide at least one keyword or a topic override.");
  }

  return normalized;
}

async function ensurePathExists(targetPath) {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function writeText(filePath, value) {
  await writeFile(filePath, value, "utf8");
}

function markdownTable(headers, rows) {
  const escapeCell = (value) => String(value ?? "").replace(/\|/g, "\\|");
  const lines = [
    `| ${headers.map(escapeCell).join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
  ];

  for (const row of rows) {
    lines.push(`| ${row.map(escapeCell).join(" | ")} |`);
  }

  return lines.join("\n");
}

async function maybeTranscribe(scrape, request) {
  if (!request.enableTranscription || !isOpenAIConfigured()) {
    return scrape;
  }

  const candidates = scrape.items.filter((item) => !item.transcript && item.mediaUrl).slice(0, 3);
  for (const item of candidates) {
    try {
      const transcript = await transcribeFromUrl(item.mediaUrl);
      if (transcript) {
        item.transcript = transcript;
        item.transcriptStatus = "transcribed";
      }
    } catch (error) {
      item.transcriptStatus = `failed: ${error.message}`;
    }
  }

  return scrape;
}

function computeScores(items, request) {
  const recentItems = items.filter((item) => new Date(item.postDate).getTime() >= Date.now() - 30 * 24 * 60 * 60 * 1000);
  let thresholdMode = "strict";
  let filteredItems = recentItems.filter((item) => item.views >= 10000 && item.engagementRate >= 0.02);
  if (!filteredItems.length && recentItems.length) {
    thresholdMode = "relaxed";
    const maxViews = Math.max(...recentItems.map((item) => item.views), 1);
    const minimumViews = Math.max(Math.round(maxViews * 0.18), 1000);
    filteredItems = recentItems.filter((item) => item.views >= minimumViews || item.engagementRate >= 0.008);
  }
  if (!filteredItems.length && recentItems.length) {
    thresholdMode = "fallback-top-posts";
    filteredItems = [...recentItems]
      .sort((left, right) => right.views - left.views || right.engagementRate - left.engagementRate)
      .slice(0, Math.min(5, recentItems.length));
  }
  const maxViews = Math.max(...filteredItems.map((item) => item.views), 1);
  const maxComments = Math.max(...filteredItems.map((item) => item.comments), 1);
  const weights = getScoreWeights(request.industryPreset);

  const scoredPosts = filteredItems.map((item) => {
    const viewScore = (item.views / maxViews) * (weights.views * 100);
    const engagementScore = Math.min(item.engagementRate / 0.05, 1) * (weights.engagement * 100);
    const commentScore = (item.comments / maxComments) * (weights.comments * 100);
    const ageDays = Math.max((Date.now() - new Date(item.postDate).getTime()) / (24 * 60 * 60 * 1000), 0);
    const freshnessScore = Math.max(0, 1 - ageDays / Math.max(request.lookbackDays, 1)) * (weights.freshness * 100);
    const regionScore = regionalFitBoost(item, request);

    return {
      ...item,
      scoreBreakdown: {
        views: Number(viewScore.toFixed(2)),
        engagement: Number(engagementScore.toFixed(2)),
        comments: Number(commentScore.toFixed(2)),
        freshness: Number(freshnessScore.toFixed(2)),
        region: Number(regionScore.toFixed(2)),
      },
      totalScore: Number((viewScore + engagementScore + commentScore + freshnessScore + regionScore).toFixed(2)),
    };
  });

  return {
    filteredOutCount: recentItems.length - filteredItems.length,
    thresholdMode,
    scoredPosts: scoredPosts.sort((left, right) => right.totalScore - left.totalScore),
  };
}

function fallbackTopicLabel(post, request) {
  const phraseTopic = extractPhraseTopic(post);
  if (phraseTopic) {
    return phraseTopic;
  }

  if (post.matchedKeywords.length) {
    return post.matchedKeywords[0];
  }

  if (request.topicOverride) {
    return request.topicOverride;
  }

  const hashtagTopic = extractHashtagTopic(post, request);
  if (hashtagTopic) {
    return hashtagTopic;
  }

  return `${post.platform} ${post.contentFormat}`;
}

function extractHashtagTopic(post, request) {
  const hashtags = [
    ...(Array.isArray(post.raw?.hashtags) ? post.raw.hashtags : []),
    ...((post.caption || "").match(/#([a-z0-9_]+)/gi) || []).map((entry) => entry.replace(/^#/, "")),
  ]
    .map((entry) => String(entry || "").trim())
    .filter(Boolean);

  if (!hashtags.length) {
    return "";
  }

  const normalizedKeywords = request.keywords.map((keyword) => keyword.toLowerCase().replace(/[^a-z0-9]/g, ""));
  const aligned = hashtags.find((tag) => normalizedKeywords.includes(tag.toLowerCase().replace(/[^a-z0-9]/g, "")));
  const selected = aligned || hashtags[0];
  return selected.replace(/[_-]+/g, " ");
}

function extractPhraseTopic(post) {
  const source = `${post.hookText || ""} ${post.title || ""} ${post.caption || ""}`
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/#[a-z0-9_]+/g, " ")
    .replace(/[^a-z0-9\s]/g, " ");

  const tokens = source
    .split(/\s+/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length >= 4 && !topicStopwords.has(entry));

  if (!tokens.length) {
    return "";
  }

  const frequency = new Map();
  for (const token of tokens) {
    frequency.set(token, (frequency.get(token) || 0) + 1);
  }

  const topTerms = [...frequency.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 2)
    .map(([token]) => token);

  return topTerms.join(" ").trim();
}

function fallbackBucketLabel(post) {
  const text = `${post.hookText || ""} ${post.title || ""} ${post.caption || ""}`.toLowerCase();

  if (/\bhow\b|\bstep\b|\bguide\b|\btutorial\b|\bworkflow\b|\bsetup\b/.test(text)) {
    return "Tutorial / Walkthrough";
  }
  if (/\bvs\b|\bcompare\b|\bcomparison\b|\balternative\b/.test(text)) {
    return "Comparison / Alternatives";
  }
  if (/\bmade\b|\bresult\b|\bgrew\b|\brevenue\b|\bviews\b|\b100k\b|\b10x\b/.test(text)) {
    return "Results / Case Study";
  }
  if (/\bmistake\b|\bwrong\b|\bstop\b|\bavoid\b|\bdon't\b/.test(text)) {
    return "Mistake / Myth Busting";
  }
  if (/\btool\b|\bapp\b|\bsoftware\b|\bai\b/.test(text)) {
    return "Tool Spotlight";
  }
  return "Trend / Commentary";
}

async function classifyTopics(scoredPosts, request) {
  const profile = getIndustryProfile(request.industryPreset);
  if (!isOpenAIConfigured() || scoredPosts.length === 0) {
    return {
      topics: scoredPosts.map((post) => ({
        id: post.id,
        topic: fallbackTopicLabel(post, request),
        bucket: fallbackBucketLabel(post),
      })),
      recommendedTopic: {
        topic: fallbackTopicLabel(scoredPosts[0] || { platform: "content", contentFormat: "post", matchedKeywords: [] }, request),
        reason: "Recommendation generated from local score weights because OpenAI is not configured.",
      },
      usedModel: false,
    };
  }

  const summary = scoredPosts.slice(0, 20).map((post) => ({
    id: post.id,
    platform: post.platform,
    hookText: post.hookText,
    caption: post.caption,
    matchedKeywords: post.matchedKeywords,
    views: post.views,
    engagementRate: Number(post.engagementRate.toFixed(4)),
    comments: post.comments,
    totalScore: post.totalScore,
    targetRegion: post.targetRegion,
    regionConfidence: post.regionConfidence,
    regionSignals: post.regionSignals,
  }));

  try {
    const payload = await createJsonResponse({
      system:
        `You are a short-form content strategist for ${profile.label}. Cluster similar social posts into concise topic labels, assign each post to a broader content bucket, and recommend one topic that best serves the goal "${getPrimaryGoalLabel(request.primaryGoal)}".`,
      user: `Cluster these posts and return JSON with this exact shape:
{
  "topics": [{"id": "post-id", "topic": "short topic label", "bucket": "broad bucket label"}],
  "recommendedTopic": {"topic": "label", "reason": "specific reason with numbers"}
}

Topic labeling rules:
- Avoid vague labels such as "trend", "viral", "content", "reel", or "social media".
- Use a 2-5 word label grounded in the caption, hook, keyword, or repeated niche signal.
- Prefer labels that a content strategist can turn directly into a video topic.

Industry context:
- Industry preset: ${profile.label}
- Team model: ${getTeamModelLabel(request.teamModel)}
- Primary goal: ${getPrimaryGoalLabel(request.primaryGoal)}
- Client / brand: ${request.clientName || "internal client account not specified"}
- Target region: ${request.targetRegion}
- Angle priorities: ${profile.anglePrompts.join(", ")}

Regional rule:
- If the target region is not Global, prefer topics that can be localized with regional proof, local examples, or local buying triggers.

Agency rule:
- This product is for an internal marketing agency team helping brand pages grow. Recommend angles that can become client-ready social posts, not generic SaaS advice.

Posts:
${JSON.stringify(summary, null, 2)}`,
    });

    return {
      ...payload,
      usedModel: true,
    };
  } catch {
    return {
      topics: scoredPosts.map((post) => ({
        id: post.id,
        topic: fallbackTopicLabel(post, request),
        bucket: fallbackBucketLabel(post),
      })),
      recommendedTopic: {
        topic: fallbackTopicLabel(scoredPosts[0] || { platform: "content", contentFormat: "post", matchedKeywords: [] }, request),
        reason: "Recommendation fell back to local heuristics after JSON parsing failed.",
      },
      usedModel: false,
    };
  }
}

function buildTopicRankings(scoredPosts, topicMap) {
  const grouped = new Map();

  for (const post of scoredPosts) {
    const topic = topicMap.get(post.id) || "uncategorized";
    const current = grouped.get(topic) || {
      topic,
      postCount: 0,
      totalViews: 0,
      totalEngagementRate: 0,
      totalScore: 0,
    };

    current.postCount += 1;
    current.totalViews += post.views;
    current.totalEngagementRate += post.engagementRate;
    current.totalScore += post.totalScore;
    grouped.set(topic, current);
  }

  return [...grouped.values()]
    .map((entry) => ({
      topic: entry.topic,
      postCount: entry.postCount,
      averageViews: Math.round(entry.totalViews / entry.postCount),
      averageEngagementRate: Number((entry.totalEngagementRate / entry.postCount).toFixed(4)),
      averageScore: Number((entry.totalScore / entry.postCount).toFixed(2)),
      repeatViralSignal: entry.postCount >= 3,
    }))
    .sort((left, right) => right.averageScore - left.averageScore || right.averageViews - left.averageViews)
    .slice(0, 5);
}

function buildFormatRankings(scoredPosts) {
  const grouped = new Map();
  for (const post of scoredPosts) {
    const key = `${post.platform}:${post.contentFormat}`;
    const current = grouped.get(key) || {
      format: post.contentFormat,
      platform: post.platform,
      postCount: 0,
      totalShareSignal: 0,
    };

    current.postCount += 1;
    current.totalShareSignal += post.shares || post.comments;
    grouped.set(key, current);
  }

  return [...grouped.values()]
    .map((entry) => ({
      format: entry.format,
      platform: entry.platform,
      postCount: entry.postCount,
      averageShareSignal: Math.round(entry.totalShareSignal / entry.postCount),
    }))
    .sort((left, right) => right.averageShareSignal - left.averageShareSignal)
    .slice(0, 3);
}

function buildSustainedTrends(scoredPosts, lookbackDays) {
  if (lookbackDays < 14) {
    return [];
  }

  const now = Date.now();
  const currentWindowStart = now - 7 * 24 * 60 * 60 * 1000;
  const previousWindowStart = now - 14 * 24 * 60 * 60 * 1000;
  const currentTop = scoredPosts
    .filter((post) => new Date(post.postDate).getTime() >= currentWindowStart)
    .slice(0, 10)
    .map((post) => post.contentFormat);
  const previousTop = scoredPosts
    .filter((post) => {
      const timestamp = new Date(post.postDate).getTime();
      return timestamp >= previousWindowStart && timestamp < currentWindowStart;
    })
    .slice(0, 10)
    .map((post) => post.contentFormat);

  const previousSet = new Set(previousTop);
  return unique(currentTop.filter((format) => previousSet.has(format))).map((format) => ({
    format,
    label: `${format} appears in the top 10 of both windows.`,
  }));
}

function countBy(values) {
  const counts = new Map();
  for (const value of values) {
    counts.set(value, (counts.get(value) || 0) + 1);
  }
  return Object.fromEntries(counts.entries());
}

function averageAgeDays(posts) {
  if (!posts.length) {
    return null;
  }

  const total = posts.reduce((sum, post) => {
    const timestamp = new Date(post.postDate).getTime();
    if (!Number.isFinite(timestamp)) {
      return sum;
    }
    return sum + Math.max((Date.now() - timestamp) / (24 * 60 * 60 * 1000), 0);
  }, 0);

  return Number((total / posts.length).toFixed(1));
}

function buildTrendSaturation(scoredPosts) {
  if (!scoredPosts.length) {
    return {
      status: "unknown",
      score: 0,
      reason: "No posts were available for saturation scoring.",
    };
  }

  const age = averageAgeDays(scoredPosts) ?? 0;
  const highViewPosts = scoredPosts.filter((post) => post.views >= 100000).length;
  const repeatedTopics = countBy(scoredPosts.map((post) => post.topic || "uncategorized"));
  const repeatDepth = Math.max(...Object.values(repeatedTopics), 1);
  const score = Math.min(100, Math.round(highViewPosts * 12 + repeatDepth * 10 + age * 4));

  if (score >= 72) {
    return {
      status: "saturated",
      score,
      reason: "Multiple high-view or repeated signals suggest the angle may already be widely copied.",
    };
  }
  if (score >= 42) {
    return {
      status: "growing",
      score,
      reason: "The trend has enough proof to use now, but still needs a distinct local angle.",
    };
  }

  return {
    status: "emerging",
    score,
    reason: "The signal is early or low-volume, so use it for fast tests rather than a full campaign bet.",
  };
}

function recommendRegionalLanguage(request, scoredPosts) {
  if (!isRegionalRequest(request)) {
    return "Keep English as the default unless the brand has a market-specific language strategy.";
  }

  const hints = unique(scoredPosts.flatMap((post) => post.regionLanguageHints || []));
  if (!hints.length) {
    return "Keep English as the default, then test a localized variant if comments show local language usage.";
  }

  if (request.outputLanguage !== "english" && request.outputLanguage !== "auto") {
    return `Selected output language is ${outputLanguageProfiles[request.outputLanguage]?.label || request.outputLanguage}; keep that language consistent for this run.`;
  }

  return `Start in English, then test ${hints.slice(0, 3).join(" or ")} if the post is targeting ${request.targetRegion}.`;
}

function buildRegionalInsights(scoredPosts, request, topicRankings) {
  const confidenceCounts = countBy(scoredPosts.map((post) => post.regionConfidence || "unknown"));
  const highConfidencePosts = scoredPosts.filter((post) => post.regionConfidence === "high");
  const usableRegionalPosts = highConfidencePosts.length ? highConfidencePosts : scoredPosts;
  const topPost = usableRegionalPosts[0];
  const saturation = buildTrendSaturation(scoredPosts);
  const topTopic = topicRankings[0]?.topic || topPost?.topic || request.topicOverride || request.keywords[0] || "selected topic";
  const marketAngles = unique(scoredPosts.flatMap((post) => post.regionMarketAngles || [])).slice(0, 4);

  return {
    targetRegion: request.targetRegion,
    isRegional: isRegionalRequest(request),
    confidenceCounts,
    confidenceNote: isRegionalRequest(request)
      ? "Regional fit is inferred from hashtags, caption text, creator/location metadata, and region-expanded search seeds."
      : "Global scan selected; no regional confidence scoring is required.",
    languageRecommendation: recommendRegionalLanguage(request, scoredPosts),
    trendSaturation: saturation,
    localOpportunity: isRegionalRequest(request)
      ? `${topTopic} is the best regional angle to test in ${request.targetRegion}. Use local proof and market-specific examples before copying the global framing.`
      : `${topTopic} is the strongest global angle. Add a target region when you need local market decisions.`,
    whatToCopy: [
      topPost?.hookText ? `Lead with this proven opening pattern: ${topPost.hookText}` : "Lead with the clearest outcome, not the tool name.",
      marketAngles[0] || "Use concrete local proof, simple before/after framing, and short creator-style delivery.",
      "Keep the card evidence visible: source link, thumbnail, views, engagement, and confidence.",
    ],
    whatToAvoid: [
      "Do not treat this as an official Instagram regional ranking.",
      "Do not copy captions word-for-word; reuse the angle, format, and proof structure.",
      saturation.status === "saturated"
        ? "Avoid generic versions of this trend because saturation is already high."
        : "Avoid waiting too long; emerging and growing signals lose advantage quickly.",
    ],
  };
}

function buildContentBuckets(scoredPosts, bucketMap) {
  const grouped = new Map();

  for (const post of scoredPosts) {
    const bucket = bucketMap.get(post.id) || fallbackBucketLabel(post);
    const current = grouped.get(bucket) || {
      bucket,
      postCount: 0,
      totalViews: 0,
      totalEngagementRate: 0,
      cards: [],
    };

    current.postCount += 1;
    current.totalViews += post.views;
    current.totalEngagementRate += post.engagementRate;
    current.cards.push({
      id: post.id,
      platform: post.platform,
      format: post.contentFormat,
      authorHandle: post.authorHandle,
      thumbnailUrl: post.thumbnailUrl,
      hookText: post.hookText || post.title || "-",
      caption: post.caption,
      topic: post.topic,
      views: post.views,
      engagementRate: post.engagementRate,
      targetRegion: post.targetRegion,
      regionConfidence: post.regionConfidence,
      regionSignals: post.regionSignals,
      viralTag: post.viralTag,
      postDate: post.postDate,
      url: post.url,
    });
    grouped.set(bucket, current);
  }

  return [...grouped.values()]
    .map((entry) => ({
      bucket: entry.bucket,
      postCount: entry.postCount,
      averageViews: Math.round(entry.totalViews / entry.postCount),
      averageEngagementRate: Number((entry.totalEngagementRate / entry.postCount).toFixed(4)),
      cards: entry.cards
        .sort((left, right) => right.views - left.views || right.engagementRate - left.engagementRate)
        .slice(0, 6),
    }))
    .sort((left, right) => right.averageViews - left.averageViews);
}

function buildScrapeCardBuckets(scrape) {
  const instagramItems = scrape.items.filter((item) => item.platform === "instagram");
  if (!instagramItems.length) {
    return [];
  }

  return [
    {
      bucket: "Trending Instagram Reels",
      postCount: instagramItems.length,
      averageViews: Math.round(
        instagramItems.reduce((sum, item) => sum + item.views, 0) / Math.max(instagramItems.length, 1),
      ),
      averageEngagementRate: Number(
        (
          instagramItems.reduce((sum, item) => sum + item.engagementRate, 0) / Math.max(instagramItems.length, 1)
        ).toFixed(4),
      ),
      cards: instagramItems.slice(0, 12).map((item) => ({
        id: item.id,
        platform: item.platform,
        format: item.contentFormat,
        authorHandle: item.authorHandle,
        thumbnailUrl: item.thumbnailUrl,
        hookText: item.hookText || item.title || "-",
        caption: item.caption,
        topic: item.topic || item.matchedKeywords?.[0] || "Unbucketed",
        views: item.views,
        engagementRate: item.engagementRate,
        targetRegion: item.targetRegion,
        regionConfidence: item.regionConfidence,
        regionSignals: item.regionSignals,
        viralTag: item.viralTag,
        postDate: item.postDate,
        url: item.url,
      })),
    },
  ];
}

async function validateContent(scrape, request) {
  const { filteredOutCount, scoredPosts, thresholdMode } = computeScores(scrape.items, request);
  const classification = await classifyTopics(scoredPosts, request);
  const topicMap = new Map(classification.topics.map((entry) => [entry.id, entry.topic]));
  const bucketMap = new Map(classification.topics.map((entry) => [entry.id, entry.bucket || fallbackBucketLabel(entry)]));
  const enrichedPosts = scoredPosts.map((post) => ({
    ...post,
    topic: topicMap.get(post.id) || fallbackTopicLabel(post, request),
    contentBucket: bucketMap.get(post.id) || fallbackBucketLabel(post),
  }));
  const topicRankings = buildTopicRankings(enrichedPosts, topicMap);

  return {
    filteredOutCount,
    scoredPosts: enrichedPosts,
    topicRankings,
    formatRankings: buildFormatRankings(enrichedPosts),
    recommendation: classification.recommendedTopic,
    repeatSignals: topicRankings
      .filter((entry) => entry.repeatViralSignal)
      .map((entry) => entry.topic),
    contentBuckets: buildContentBuckets(enrichedPosts, bucketMap),
    sustainedTrends: buildSustainedTrends(enrichedPosts, request.lookbackDays),
    regionalInsights: buildRegionalInsights(enrichedPosts, request, topicRankings),
    thresholdMode,
    notes: [
      classification.usedModel ? null : "Topic clustering used local heuristics because OpenAI output was unavailable.",
      thresholdMode === "relaxed"
        ? "Validation used relaxed scoring because the keyword returned a lower-volume niche dataset."
        : null,
      thresholdMode === "fallback-top-posts"
        ? "Validation used the top available posts because no posts passed the normal engagement thresholds."
        : null,
    ].filter(Boolean),
  };
}

function splitVoiceSamples(rawSamples) {
  if (!rawSamples) {
    return [];
  }

  const labeled = rawSamples.split(/(?:^|\n)\s*Script\s+\d+\s*:/i).map((entry) => entry.trim()).filter(Boolean);
  if (labeled.length > 1) {
    return labeled;
  }

  return rawSamples.split(/\n{2,}/).map((entry) => entry.trim()).filter(Boolean);
}

function fallbackVoiceProfile(samples, request = {}) {
  const languageProfile = getLanguageProfile(request);
  const selectedLanguage =
    request.outputLanguage && request.outputLanguage !== "auto" ? languageProfile.label : "";
  if (!samples.length) {
    return {
      vocabulary: ["direct", "practical", "short-form"],
      sentenceLength: "short punchy lines",
      structure: "[BEAT 1] -> [BEAT 2] -> [BEAT 3] -> [CTA]",
      ctaStyle: "comment trigger",
      languageMix: selectedLanguage || "English",
      energy: "clear and instructional",
      avoid: ["generic filler", "formal corporate phrasing"],
    };
  }

  const source = samples.join(" ");
  const sentenceAverage =
    source
      .split(/[.!?]/)
      .map((entry) => entry.trim().split(/\s+/).filter(Boolean).length)
      .filter(Boolean)
      .reduce((sum, value, _, array) => sum + value / array.length, 0) || 0;

  return {
    vocabulary: unique(
      source
        .toLowerCase()
        .replace(/[^a-z\s]/g, " ")
        .split(/\s+/)
        .filter((word) => word.length > 4),
    ).slice(0, 8),
    sentenceLength: sentenceAverage > 16 ? "explainer-length sentences" : "short punchy lines",
    structure: "[BEAT 1] -> [BEAT 2] -> [BEAT 3] -> [CTA]",
    ctaStyle: source.toLowerCase().includes("comment") ? "comment trigger" : "soft comment prompt",
    languageMix: selectedLanguage || (/karo|hai|nahi|kaise|bhai/i.test(source) ? "Hinglish" : "English"),
    energy: source.includes("!") ? "high energy" : "calm and direct",
    avoid: ["formal corporate phrasing", "long intros"],
  };
}

async function buildVoiceProfile(request) {
  const samples = splitVoiceSamples(request.voiceSamples);
  if (!samples.length) {
    return {
      profile: fallbackVoiceProfile(samples, request),
      notes: ["No voice samples were supplied, so the writer used a default short-form explainer voice."],
    };
  }

  if (!isOpenAIConfigured()) {
    return {
      profile: fallbackVoiceProfile(samples, request),
      notes: ["Voice profiling used local heuristics because OpenAI is not configured."],
    };
  }

  try {
    const languageProfile = getLanguageProfile(request);
    const profile = await createJsonResponse({
      system:
        "You analyze creator scripts and produce a compact voice profile for a short-form video writer. Return JSON only.",
      user: `Read these writing samples and return JSON with:
{
  "vocabulary": ["term"],
  "sentenceLength": "string",
  "structure": "string",
  "ctaStyle": "string",
  "languageMix": "string",
  "energy": "string",
  "avoid": ["string"]
}

Requested output language:
- ${languageProfile.label}: ${languageProfile.instruction}
- If the requested language is not "Auto from voice samples", the final script must follow the requested language even if samples use another language.

Samples:
${JSON.stringify(samples, null, 2)}`,
    });

    return {
      profile: request.outputLanguage !== "auto" ? { ...profile, languageMix: languageProfile.label } : profile,
      notes: [],
    };
  } catch {
    return {
      profile: fallbackVoiceProfile(samples, request),
      notes: ["Voice profiling fell back to local heuristics after OpenAI JSON parsing failed."],
    };
  }
}

function fallbackScript(topic, voiceProfile, request) {
  const languageProfile = getLanguageProfile(request);
  const regionProof = isRegionalRequest(request)
    ? ` Anchor the proof in ${request.targetRegion} so the idea feels local, not generic.`
    : "";
  if (request.outputLanguage === "hinglish") {
    return `[BEAT 1]
${topic} abhi work kar raha hai kyunki creators isse sirf tool list ki tarah nahi, ek clear outcome ki tarah package kar rahe hain. Opening tight rakho aur result pehle bolo.${regionProof}

[BEAT 2]
Ek concrete workflow dikhao, ek common mistake call out karo, aur recent posts se ek proof point add karo. Har line short rakho so it sounds natural on camera.

[BEAT 3]
Viewer ko ek practical next step do jo woh aaj copy kar sake. Energy ${voiceProfile.energy} rakho aur generic mat lagna.

[CTA]
${languageProfile.cta}`;
  }

  if (request.outputLanguage === "hindi") {
    return `[BEAT 1]
${topic} अभी काम कर रहा है क्योंकि creators इसे सिर्फ tool list की तरह नहीं, बल्कि clear outcome की तरह दिखा रहे हैं। शुरुआत छोटी रखिए और पहले result बताइए।

[BEAT 2]
एक concrete workflow दिखाइए, एक common mistake समझाइए, और recent posts से एक proof point जोड़िए। हर line इतनी छोटी हो कि camera पर natural लगे।

[BEAT 3]
Viewer को एक practical next step दीजिए जिसे वह आज ही copy कर सके। Energy ${voiceProfile.energy} रखें और generic advice से बचें।

[CTA]
${languageProfile.cta}`;
  }

  return `[BEAT 1]
${topic} is working right now because creators are packaging it with a clear outcome, not just a tool list. Keep the opening tight and say the result first in ${languageProfile.scriptNote}.${regionProof}

[BEAT 2]
Show one concrete workflow, one mistake people make, and one proof point from the recent posts. Make each line short enough to say fast on camera.

[BEAT 3]
Close with the practical next step your viewer can copy today. Keep the energy ${voiceProfile.energy} and avoid sounding generic.

[CTA]
${languageProfile.cta}`;
}

async function writeScript(validation, request) {
  const voiceProfileResult = await buildVoiceProfile(request);
  const profile = getIndustryProfile(request.industryPreset);
  const languageProfile = getLanguageProfile(request);
  const topic = request.topicOverride || validation.recommendation?.topic || request.keywords[0];
  const topSignals = validation.topicRankings.slice(0, 3);

  if (!isOpenAIConfigured()) {
    return {
      topic,
      voiceProfile: voiceProfileResult.profile,
      notes: [...voiceProfileResult.notes, "Script generation used a local template because OpenAI is not configured."],
      outputLanguage: request.outputLanguage,
      script: fallbackScript(topic, voiceProfileResult.profile, request),
    };
  }

  try {
    const script = await createTextResponse({
      system:
        "You are a short-form script writer. Write crisp camera-ready scripts only. Never include a hook when the user asks for body copy only.",
      user: `Write a short-form script in this voice:
${JSON.stringify(voiceProfileResult.profile, null, 2)}

Topic:
${topic}

Industry context:
- Industry preset: ${profile.label}
- Team model: ${getTeamModelLabel(request.teamModel)}
- Primary goal: ${getPrimaryGoalLabel(request.primaryGoal)}
- Client / brand: ${request.clientName || "internal client account not specified"}
- Target region: ${request.targetRegion}
- Positioning: ${profile.positioning[request.primaryGoal] || profile.positioning.default}
- Angle priorities: ${profile.anglePrompts.join(", ")}

Recent signals:
${JSON.stringify(topSignals, null, 2)}

Regional decision brief:
${JSON.stringify(validation.regionalInsights || {}, null, 2)}

Language rules:
- Output language: ${languageProfile.label}
- ${languageProfile.instruction}
- If a voice sample conflicts with this language selection, keep the style but obey the selected output language.

Rules:
- Use [BEAT 1], [BEAT 2], [BEAT 3], [CTA]
- Keep each beat to 2-3 sentences max
- Never include a hook
- Prefer shorter phrasing over longer phrasing
- Write as a client-ready draft for an agency social media team to review and adapt
- End with a CTA that fits ${getPrimaryGoalLabel(request.primaryGoal).toLowerCase()}`,
    });

    return {
      topic,
      voiceProfile: voiceProfileResult.profile,
      notes: voiceProfileResult.notes,
      outputLanguage: request.outputLanguage,
      script,
    };
  } catch {
    return {
      topic,
      voiceProfile: voiceProfileResult.profile,
      notes: [...voiceProfileResult.notes, "Script generation fell back to a local template after the OpenAI call failed."],
      outputLanguage: request.outputLanguage,
      script: fallbackScript(topic, voiceProfileResult.profile, request),
    };
  }
}

function fallbackHooks(topic, validation, request = { outputLanguage: defaultOutputLanguage }) {
  const signal = validation.topicRankings[0]?.topic || topic;
  const regionPhrase = isRegionalRequest(request) ? ` for ${request.targetRegion}` : "";
  if (request.outputLanguage === "hinglish") {
    return {
      hooks: [
        {
          pattern: "Aspirational outcome",
          hook: `Aisi honi chahiye ${topic}${regionPhrase} strategy jo 3 minute mein idea lock kar de.`,
          matchReason: `Matches the strongest current signal around ${signal}.`,
          confidence: 8,
        },
        {
          pattern: "Pain point",
          hook: `${topic}${regionPhrase} pe content bana rahe ho, phir bhi views flat kyun hain?`,
          matchReason: `Built around the main frustration implied by high-comment posts in ${signal}.`,
          confidence: 7,
        },
        {
          pattern: "Hidden truth",
          hook: `Log nahi jaante ki ${topic} ka real growth angle kya hai.`,
          matchReason: `Uses exclusivity around the recommended topic.`,
          confidence: 8,
        },
        {
          pattern: "Time or money claim",
          hook: `${topic} research 20 minute se 3 minute pe lana hai? Yeh dekho.`,
          matchReason: `Anchors to a concrete speed claim that fits the niche.`,
          confidence: 7,
        },
        {
          pattern: "Curiosity gap",
          hook: `${topic} mein sab ek hi galti repeat kyun kar rahe hain?`,
          matchReason: `Leans into uncertainty and invites the viewer to resolve it.`,
          confidence: 8,
        },
      ],
      recommendedIndex: 0,
      recommendedReason: `The aspirational angle lines up best with the top-performing topic signal: ${signal}.`,
    };
  }

  if (request.outputLanguage === "hindi") {
    return {
      hooks: [
        {
          pattern: "Aspirational outcome",
          hook: `${topic} की ऐसी strategy चाहिए जो 3 minute में idea clear कर दे?`,
          matchReason: `Matches the strongest current signal around ${signal}.`,
          confidence: 8,
        },
        {
          pattern: "Pain point",
          hook: `${topic} पर content बना रहे हैं, फिर भी views flat क्यों हैं?`,
          matchReason: `Built around the main frustration implied by high-comment posts in ${signal}.`,
          confidence: 7,
        },
        {
          pattern: "Hidden truth",
          hook: `लोग ${topic} का असली growth angle नहीं समझते।`,
          matchReason: `Uses exclusivity around the recommended topic.`,
          confidence: 8,
        },
        {
          pattern: "Time or money claim",
          hook: `${topic} research को 20 minute से 3 minute में लाना है?`,
          matchReason: `Anchors to a concrete speed claim that fits the niche.`,
          confidence: 7,
        },
        {
          pattern: "Curiosity gap",
          hook: `${topic} में सब एक ही गलती क्यों repeat कर रहे हैं?`,
          matchReason: `Leans into uncertainty and invites the viewer to resolve it.`,
          confidence: 8,
        },
      ],
      recommendedIndex: 0,
      recommendedReason: `The aspirational angle lines up best with the top-performing topic signal: ${signal}.`,
    };
  }

  return {
    hooks: [
      {
        pattern: "Aspirational outcome",
        hook: `This is the ${topic}${regionPhrase} strategy I would use if I had to find a content idea in 3 minutes.`,
        matchReason: `Matches the strongest current signal around ${signal}.`,
        confidence: 8,
      },
      {
        pattern: "Pain point",
        hook: `You are posting about ${topic}${regionPhrase}, so why are the views still flat?`,
        matchReason: `Built around the main frustration implied by high-comment posts in ${signal}.`,
        confidence: 7,
      },
      {
        pattern: "Hidden truth",
        hook: `Most people miss the real growth angle behind ${topic}.`,
        matchReason: `Uses exclusivity around the recommended topic.`,
        confidence: 8,
      },
      {
        pattern: "Time or money claim",
        hook: `Want to cut ${topic} research from 20 minutes to 3? Start here.`,
        matchReason: `Anchors to a concrete speed claim that fits the niche.`,
        confidence: 7,
      },
      {
        pattern: "Curiosity gap",
        hook: `Why is everyone making the same mistake with ${topic}?`,
        matchReason: `Leans into uncertainty and invites the viewer to resolve it.`,
        confidence: 8,
      },
    ],
    recommendedIndex: 0,
    recommendedReason: `The aspirational angle lines up best with the top-performing topic signal: ${signal}.`,
  };
}

async function generateHooks(validation, voiceResult) {
  const profile = getIndustryProfile(voiceResult.requestMeta?.industryPreset || "agency-social");
  const requestMeta = {
    outputLanguage: voiceResult.requestMeta?.outputLanguage || defaultOutputLanguage,
    primaryGoal: voiceResult.requestMeta?.primaryGoal || defaultPrimaryGoal,
    targetRegion: voiceResult.requestMeta?.targetRegion || defaultTargetRegion,
  };
  const languageProfile = outputLanguageProfiles[requestMeta.outputLanguage] || outputLanguageProfiles[defaultOutputLanguage];
  if (!isOpenAIConfigured()) {
    const fallback = fallbackHooks(voiceResult.topic, validation, requestMeta);
    return {
      ...fallback,
      notes: ["Hook generation used deterministic templates because OpenAI is not configured."],
    };
  }

  try {
    const payload = await createJsonResponse({
      system:
        "You generate five short-form hooks. Keep them spoken-language friendly, concrete, and brief. Return valid JSON only.",
      user: `Generate exactly 5 hooks for this topic and script.

Voice profile:
${JSON.stringify(voiceResult.voiceProfile, null, 2)}

Topic:
${voiceResult.topic}

Script:
${voiceResult.script}

Industry context:
- Industry preset: ${profile.label}
- Primary goal: ${getPrimaryGoalLabel(requestMeta.primaryGoal)}
- Client / brand: ${voiceResult.requestMeta?.clientName || "internal client account not specified"}
- Target region: ${requestMeta.targetRegion}
- Angle priorities: ${profile.anglePrompts.join(", ")}

Validation signals:
${JSON.stringify(validation.topicRankings.slice(0, 3), null, 2)}

Language rules:
- Output language: ${languageProfile.label}
- ${languageProfile.instruction}
- Pattern names may be English, but every hook line must follow the selected output language.

Return JSON:
{
  "hooks": [
    {
      "pattern": "Aisi honi chahiye X",
      "hook": "text",
      "matchReason": "string",
      "confidence": 8
    }
  ],
  "recommendedIndex": 0,
  "recommendedReason": "string"
}

Pattern order:
1. Aspirational outcome
2. Pain point
3. Hidden truth
4. Time or money claim
5. Curiosity gap`,
    });

    return {
      ...payload,
      notes: [],
    };
  } catch {
    return {
      ...fallbackHooks(voiceResult.topic, validation, requestMeta),
      notes: ["Hook generation fell back to deterministic templates after the OpenAI call failed."],
    };
  }
}

function renderScrapeMarkdown(scrape) {
  const rows = scrape.items.slice(0, 20).map((item) => [
    item.platform,
    item.authorHandle,
    item.targetRegion || "Global",
    item.regionConfidence || "unknown",
    item.hookText || item.title || "-",
    numberWithCommas(item.views),
    percentage(item.engagementRate),
    item.viralTag ? "VIRAL" : "",
  ]);

  return `# Scraped Posts

Mode: **${scrape.mode}**

${markdownTable(["Platform", "Author", "Region", "Regional Fit", "Hook", "Views", "ER", "Flag"], rows)}
`;
}

function renderValidationMarkdown(validation) {
  if (!validation) {
    return `# Validation Report

Validation stage was not run.
`;
  }

  const topicRows = validation.topicRankings.map((entry) => [
    entry.topic,
    entry.postCount,
    numberWithCommas(entry.averageViews),
    percentage(entry.averageEngagementRate),
    entry.repeatViralSignal ? "repeat viral signal" : "",
  ]);

  const formatRows = validation.formatRankings.map((entry) => [
    `${entry.platform} ${entry.format}`,
    entry.postCount,
    numberWithCommas(entry.averageShareSignal),
  ]);
  const bucketRows = validation.contentBuckets.map((entry) => [
    entry.bucket,
    entry.postCount,
    numberWithCommas(entry.averageViews),
    percentage(entry.averageEngagementRate),
  ]);
  const regional = validation.regionalInsights;

  return `# Validation Report

**Recommendation:** ${validation.recommendation?.topic || "No topic available"} - ${validation.recommendation?.reason || "No reason available."}

## Regional Market Lens
- Target region: ${regional?.targetRegion || "Global"}
- Confidence: ${regional?.confidenceNote || "No regional confidence data."}
- Language recommendation: ${regional?.languageRecommendation || "No language recommendation."}
- Saturation: ${regional?.trendSaturation?.status || "unknown"} (${regional?.trendSaturation?.score ?? 0}/100) - ${regional?.trendSaturation?.reason || "No saturation reason."}
- Opportunity: ${regional?.localOpportunity || "No regional opportunity generated."}

## Content Buckets
${markdownTable(["Bucket", "Posts", "Avg Views", "Avg ER"], bucketRows)}

## Topic Rankings
${markdownTable(["Topic", "Posts", "Avg Views", "Avg ER", "Signal"], topicRows)}

## Format Rankings
${markdownTable(["Format", "Posts", "Avg Share Signal"], formatRows)}
`;
}

function renderVoiceMarkdown(voiceResult) {
  if (!voiceResult) {
    return `# Script

Writer stage was not run.
`;
  }

  return `# Script

Topic: **${voiceResult.topic}**
Output language: **${outputLanguageProfiles[voiceResult.outputLanguage]?.label || voiceResult.outputLanguage || "English"}**

## Voice Profile
\`\`\`json
${JSON.stringify(voiceResult.voiceProfile, null, 2)}
\`\`\`

## Script
${voiceResult.script}
`;
}

function renderHooksMarkdown(hooksResult) {
  if (!hooksResult) {
    return `# Hooks

Hook stage was not run.
`;
  }

  const rows = hooksResult.hooks.map((hook, index) => [
    index + 1,
    hook.pattern,
    hook.hook,
    hook.confidence,
  ]);

  return `# Hooks

Recommended hook: **${(hooksResult.recommendedIndex ?? 0) + 1}**

${markdownTable(["#", "Pattern", "Hook", "Confidence"], rows)}

Reason: ${hooksResult.recommendedReason}
`;
}

function renderSummaryMarkdown(result) {
  return `# Codex Content System Run

Run ID: \`${result.runId}\`

## Inputs
- Skill location: ${result.request.skillLocation}
- UI type: ${result.request.uiType}
- Scraping method: ${result.request.scrapingMethod}
- Campaign: ${result.request.campaignName || result.request.campaignId || "manual run"}
- Client / brand: ${result.request.clientName || "not specified"}
- Industry preset: ${result.industryBrief.label}
- Team model: ${result.industryBrief.teamModel}
- Primary goal: ${result.industryBrief.primaryGoal}
- Output language: ${outputLanguageProfiles[result.request.outputLanguage]?.label || result.request.outputLanguage}
- Run target: ${result.request.runTarget}
- Output formats: ${result.request.outputFormats.join(", ")}
- Keywords: ${result.request.keywords.join(", ") || "none"}
- Competitors: ${result.request.competitors.join(", ") || "none"}
- Target region: ${result.request.targetRegion}
- Platforms: ${result.request.platforms.join(", ")}
- Lookback: ${result.request.lookbackDays} days

## Outputs
- Scraped posts: ${result.scrape.items.length}
- Content buckets: ${result.validation?.contentBuckets?.length ?? 0}
- Ranked topics: ${result.validation?.topicRankings?.length ?? 0}
- Industry brief: ${result.industryBrief.positioning}
- Script topic: ${result.voice?.topic ?? "not generated"}
- Hooks generated: ${result.hooks?.hooks?.length ?? 0}
- Local storage: ${result.storage?.local?.status ?? "unknown"}
- SharePoint storage: ${result.storage?.sharePoint?.status ?? "not requested"}
`;
}

async function persistResult(runDir, result, { rootDir }) {
  result.storage = {
    local: {
      status: "writing",
      runDir,
    },
    sharePoint: {
      status: "pending",
    },
  };

  await writeJson(path.join(runDir, "request.json"), result.request);
  await writeJson(path.join(runDir, "scraped-posts.json"), result.scrape);
  if (result.validation) {
    await writeJson(path.join(runDir, "validation-report.json"), result.validation);
  }
  if (result.voice) {
    await writeJson(path.join(runDir, "script.json"), result.voice);
  }
  if (result.hooks) {
    await writeJson(path.join(runDir, "hooks.json"), result.hooks);
  }

  await writeText(path.join(runDir, "scraped-posts.md"), renderScrapeMarkdown(result.scrape));
  await writeText(path.join(runDir, "validation-report.md"), renderValidationMarkdown(result.validation));
  await writeText(path.join(runDir, "script.md"), renderVoiceMarkdown(result.voice));
  await writeText(path.join(runDir, "hooks.md"), renderHooksMarkdown(result.hooks));

  result.storage.local.status = "written";
  result.storage.sharePoint = await persistExternalStorage(result, { rootDir });
  if (result.storage.sharePoint?.status === "not_configured") {
    result.assumptions.push(
      "SharePoint is not connected yet, so this run was saved locally. Connect Microsoft Graph settings when you are ready to store runs in SharePoint.",
    );
  }
  if (result.storage.sharePoint?.status === "failed") {
    result.assumptions.push(`SharePoint storage failed: ${result.storage.sharePoint.error}`);
  }

  await writeJson(path.join(runDir, "pipeline-result.json"), result);
  await writeText(path.join(runDir, "summary.md"), renderSummaryMarkdown(result));
}

export async function getRuntimeStatus(rootDir) {
  const apify = await getApifyStatus(rootDir);
  const actorSamplePath = path.join(rootDir, "config", "apify-actors.sample.json");
  const storage = await getStorageStatus(rootDir);

  return {
    openaiConfigured: isOpenAIConfigured(),
    apifyConfigured: apify.tokenConfigured,
    actorConfigFilePresent: apify.actorConfigFilePresent,
    configuredPlatforms: apify.configuredPlatforms,
    sampleConfigAvailable: await ensurePathExists(actorSamplePath),
    storage,
  };
}

export async function listStoredRuns(rootDir, limit) {
  return listRecentRuns(rootDir, limit);
}

export async function runPipeline(input, { rootDir }) {
  const request = normalizeRequest(input);
  const runId = formatTimestampForId();
  const runDir = path.join(rootDir, "data", "runs", runId);
  await mkdir(runDir, { recursive: true });

  const scrapeBase = await scrapeRecentPosts(request, { rootDir });
  const scrape = await maybeTranscribe(scrapeBase, request);
  const industryBriefBase = buildIndustryBrief({ request, scrape, validation: null });
  let validation = null;
  let voice = null;
  let hooks = null;

  if (request.runTarget !== "content-scraper") {
    validation = await validateContent(scrape, request);
  }

  if (request.runTarget === "my-voice-writer" || request.runTarget === "hook-generator" || request.runTarget === "run-all") {
    voice = await writeScript(validation, request);
    voice.requestMeta = {
      industryPreset: request.industryPreset,
      primaryGoal: request.primaryGoal,
      teamModel: request.teamModel,
      outputLanguage: request.outputLanguage,
      targetRegion: request.targetRegion,
      clientName: request.clientName,
    };
  }

  if (request.runTarget === "hook-generator" || request.runTarget === "run-all") {
    hooks = await generateHooks(validation, voice);
  }

  const industryBrief = buildIndustryBrief({ request, scrape, validation });

  const result = {
    runId,
    runDir,
    request,
    scrape,
    validation,
    voice,
    hooks,
    industryBrief,
    scrapeCardBuckets: validation?.contentBuckets?.length ? validation.contentBuckets : buildScrapeCardBuckets(scrape),
    assumptions: [
      scrape.items.length === 0 && scrape.errors?.length
        ? `Instagram returned no public posts for this input: ${scrape.errors.map((entry) => entry.message).join(" | ")}`
        : null,
      scrape.items.length === 0 && scrape.diagnostics?.searchSuggestions?.suggestedHashtags?.length
        ? `Try these stronger keyword seeds: ${scrape.diagnostics.searchSuggestions.suggestedHashtags.slice(0, 8).join(", ")}.`
        : null,
      scrape.mode !== "live"
        ? "Scraper used demo data for at least one platform because Apify was not fully configured."
        : null,
      isRegionalRequest(request)
        ? `${request.targetRegion} regional results are inferred from hashtags, caption text, creator/location metadata, and regional search seeds, not an official Instagram regional ranking.`
        : null,
      !isOpenAIConfigured() ? "OpenAI-dependent stages used local fallback logic." : null,
      request.runTarget !== "run-all"
        ? `Only ${request.runTarget} was selected. Choose "Run all skills" to generate validation, script, and hooks.`
        : null,
      request.runTarget !== "content-scraper" && request.lookbackDays < 14
        ? "Sustained trend detection needs a 14-day lookback; shorter runs will not populate that section."
        : null,
      industryBriefBase.positioning !== industryBrief.positioning ? "Industry framing was refined after validation signals were available." : null,
    ].filter(Boolean),
  };

  await persistResult(runDir, result, { rootDir });
  return result;
}
