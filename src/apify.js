import { readFile } from "node:fs/promises";
import path from "node:path";

const supportedPlatforms = ["instagram", "youtube", "x"];
const defaultApifyTimeoutMs = 120_000;
const keywordStopwords = new Set([
  "and",
  "for",
  "from",
  "into",
  "near",
  "the",
  "this",
  "that",
  "with",
  "your",
]);
const keywordCorrections = new Map([
  ["marketting", "marketing"],
  ["markting", "marketing"],
  ["youtuvbe", "youtube"],
  ["reals", "reels"],
  ["insta", "instagram"],
  ["automtion", "automation"],
  ["busines", "business"],
]);
const relatedHashtagSlugs = {
  ai: ["aitools", "aiautomation", "aicontent", "aiforbusiness", "generativeai", "artificialintelligence"],
  ads: ["digitalads", "facebookads", "googleads", "performancemarketing", "paidads"],
  agency: ["socialmediaagency", "marketingagency", "agencylife", "agencyowner"],
  automation: ["marketingautomation", "aiautomation", "workflowautomation", "automationtools"],
  brand: ["branding", "brandstrategy", "personalbrand", "brandbuilding"],
  business: ["businesstips", "businessgrowth", "entrepreneurship", "smallbusiness"],
  content: ["contentmarketing", "contentstrategy", "contentcreator", "contentideas"],
  creator: ["creatorbusiness", "contentcreator", "creator economy", "creatorstrategy"],
  ecommerce: ["ecommerce", "ecommercemarketing", "shopify", "dtcbrand"],
  marketing: ["digitalmarketing", "marketingtips", "marketingstrategy", "marketingautomation", "socialmediamarketing"],
  reels: ["instagramreels", "reelstrategy", "reelideas", "reelstips"],
  sales: ["salesstrategy", "b2bsales", "salestips", "leadgeneration"],
  social: ["socialmediamarketing", "socialmediatips", "socialmediastrategy", "instagrammarketing"],
  startup: ["startup", "startupmarketing", "saasstartup", "founder"],
  video: ["videomarketing", "shortformvideo", "videocontent", "reelsvideo"],
};
const regionProfileDefinitions = [
  {
    key: "global",
    label: "Global",
    aliases: ["global", "worldwide"],
    hashtags: [],
    languageHints: ["English"],
    marketAngles: ["Use globally understandable examples and avoid local-only references."],
  },
  {
    key: "india",
    label: "India",
    aliases: ["india", "bharat", "indian"],
    hashtags: ["india", "indianbusiness", "indianstartups", "digitalindia", "marketingindia", "contentcreatorindia"],
    languageHints: ["English", "Hinglish", "Hindi"],
    marketAngles: ["Use affordability, speed, founder-led growth, and practical implementation proof."],
  },
  {
    key: "uae",
    label: "UAE",
    aliases: ["uae", "dubai", "abudhabi", "emirates"],
    hashtags: ["uae", "dubai", "dubaibusiness", "dubaimarketing", "uaebusiness", "abudhabi"],
    languageHints: ["English", "Arabic"],
    marketAngles: ["Use premium positioning, local business growth, service trust, and founder credibility."],
  },
  {
    key: "unitedstates",
    label: "United States",
    aliases: ["united states", "usa", "us", "america", "american"],
    hashtags: ["usa", "usbusiness", "smallbusinessusa", "americanbusiness", "startupusa", "marketingusa"],
    languageHints: ["English"],
    marketAngles: ["Use productivity, creator-led proof, revenue impact, and tool efficiency."],
  },
  {
    key: "unitedkingdom",
    label: "United Kingdom",
    aliases: ["united kingdom", "uk", "britain", "london"],
    hashtags: ["ukbusiness", "londonbusiness", "ukmarketing", "smallbusinessuk", "londonmarketing"],
    languageHints: ["English"],
    marketAngles: ["Use trust, clarity, professional credibility, and practical playbooks."],
  },
  {
    key: "singapore",
    label: "Singapore",
    aliases: ["singapore", "sg"],
    hashtags: ["singapore", "sgbusiness", "singaporebusiness", "singaporemarketing", "sgstartup"],
    languageHints: ["English"],
    marketAngles: ["Use efficiency, regional expansion, B2B trust, and high-density market examples."],
  },
  {
    key: "australia",
    label: "Australia",
    aliases: ["australia", "aussie", "sydney", "melbourne"],
    hashtags: ["australiabusiness", "sydneybusiness", "melbournebusiness", "australiamarketing", "smallbusinessaustralia"],
    languageHints: ["English"],
    marketAngles: ["Use directness, small-business practicality, and low-fluff examples."],
  },
  {
    key: "canada",
    label: "Canada",
    aliases: ["canada", "canadian", "toronto", "vancouver"],
    hashtags: ["canadabusiness", "torontobusiness", "vancouverbusiness", "canadamarketing", "smallbusinesscanada"],
    languageHints: ["English", "French"],
    marketAngles: ["Use trust, local service relevance, and measurable business outcomes."],
  },
  {
    key: "bangalore",
    label: "Bangalore",
    aliases: ["bangalore", "bengaluru"],
    hashtags: ["bangalore", "bengaluru", "bangalorebusiness", "bengalurustartups", "bangaloremarketing"],
    languageHints: ["English", "Hinglish", "Kannada"],
    marketAngles: ["Use startup, SaaS, tech talent, and founder-operator examples."],
  },
  {
    key: "mumbai",
    label: "Mumbai",
    aliases: ["mumbai", "bombay"],
    hashtags: ["mumbai", "mumbaibusiness", "mumbaimarketing", "mumbaicreators", "mumbaistartups"],
    languageHints: ["English", "Hinglish", "Hindi", "Marathi"],
    marketAngles: ["Use brand, creator, agency, entertainment, and business networking examples."],
  },
  {
    key: "delhincr",
    label: "Delhi NCR",
    aliases: ["delhi ncr", "delhi", "gurgaon", "gurugram", "noida"],
    hashtags: ["delhi", "delhincr", "gurgaon", "gurugram", "noida", "delhibusiness", "gurgaonbusiness"],
    languageHints: ["English", "Hinglish", "Hindi"],
    marketAngles: ["Use sales, agency, business growth, founder, and service-market examples."],
  },
];
const regionProfiles = new Map(
  regionProfileDefinitions.flatMap((profile) => [
    [profile.key, profile],
    ...profile.aliases.map((alias) => [normalizeSlug(alias), profile]),
  ]),
);

function dedupeStrings(values) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function compactErrorText(text, limit = 1200) {
  if (!text || text.length <= limit) {
    return text;
  }

  return `${text.slice(0, limit)}...`;
}

function getApifyTimeoutMs() {
  const value = Number(process.env.APIFY_TIMEOUT_MS);
  return Number.isFinite(value) && value > 0 ? value : defaultApifyTimeoutMs;
}

async function fetchWithTimeout(url, options = {}, timeoutMs = defaultApifyTimeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error(`Apify request timed out after ${timeoutMs}ms.`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeSlug(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9_]+/g, "");
}

function getRegionProfile(value) {
  const raw = String(value || "Global").trim();
  const key = normalizeSlug(raw || "global");
  if (!key || key === "global") {
    return regionProfiles.get("global");
  }

  return (
    regionProfiles.get(key) || {
      key,
      label: raw,
      aliases: [raw],
      hashtags: [
        toInstagramHashtagSlug(raw),
        `${toInstagramHashtagSlug(raw)}business`,
        `${toInstagramHashtagSlug(raw)}marketing`,
        `${toInstagramHashtagSlug(raw)}creators`,
      ],
      languageHints: ["English"],
      marketAngles: ["Use local proof, local examples, and market-specific buying triggers."],
    }
  );
}

function isGlobalRegion(value) {
  return getRegionProfile(value).key === "global";
}

function toIsoDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString();
}

function firstString(values, fallback = "") {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return fallback;
}

function firstNumber(values, fallback = 0) {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === "string" && value.trim()) {
      const numeric = Number(value.replace(/[^\d.-]/g, ""));
      if (Number.isFinite(numeric)) {
        return numeric;
      }
    }
  }
  return fallback;
}

function calculateEngagementRate({ views, likes, comments, shares }) {
  const denominator = Math.max(views, 1);
  return (likes + comments + shares) / denominator;
}

function extractHookText(title, caption) {
  const source = firstString([title, caption], "");
  if (!source) {
    return "";
  }

  const firstSentence = source.split(/[.!?]/)[0].trim();
  return firstSentence.slice(0, 140);
}

function normalizeFormat(platform, raw, caption) {
  const explicit = firstString([
    raw?.contentFormat,
    raw?.type,
    raw?.postType,
    raw?.mediaType,
  ]);

  if (platform === "instagram") {
    if (raw?.productType === "clips" || /^video$/i.test(explicit) || /^reel$/i.test(explicit)) {
      return "reel";
    }
    if (/^image$/i.test(explicit)) {
      return "post";
    }
  }

  if (explicit) {
    return explicit.toLowerCase();
  }

  if (platform === "instagram") {
    return "reel";
  }
  if (platform === "youtube") {
    return "short";
  }
  if (caption.toLowerCase().includes("thread")) {
    return "thread";
  }
  return "post";
}

function inferPostUrl(raw, platform) {
  const direct = firstString([
    raw?.url,
    raw?.postUrl,
    raw?.permalink,
    raw?.link,
    raw?.canonicalUrl,
  ]);
  if (direct) {
    return direct;
  }

  const shortCode = firstString([raw?.shortCode, raw?.code]);
  if (shortCode && platform === "instagram") {
    return `https://www.instagram.com/reel/${shortCode}/`;
  }

  return "";
}

function inferMediaUrl(raw) {
  return firstString([
    raw?.mediaUrl,
    raw?.videoUrl,
    raw?.videoPlayUrl,
    raw?.playbackUrl,
    raw?.downloadUrl,
  ]);
}

function inferThumbnailUrl(raw) {
  const candidate = firstString([
    raw?.thumbnailUrl,
    raw?.displayUrl,
    raw?.imageUrl,
    raw?.thumbnailSrc,
    raw?.videoThumbnailUrl,
    raw?.coverUrl,
    raw?.displayResourceUrls?.[0],
    raw?.images?.[0]?.url,
    raw?.image_versions2?.candidates?.[0]?.url,
  ]);

  return candidate || "";
}

function matchedKeywords(text, keywords) {
  const haystack = text.toLowerCase();
  return keywords.filter((keyword) => haystack.includes(keyword.toLowerCase()));
}

function collectRawRegionText(raw) {
  const location = raw?.location || raw?.place || raw?.venue || {};
  const candidates = [
    raw?.locationName,
    raw?.placeName,
    raw?.city,
    raw?.country,
    raw?.region,
    location?.name,
    location?.city,
    location?.country,
    location?.address,
  ];

  return candidates
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter(Boolean)
    .join(" ");
}

function extractRawHashtags(raw, caption) {
  return dedupeStrings([
    ...(Array.isArray(raw?.hashtags) ? raw.hashtags : []),
    ...((caption || "").match(/#([a-z0-9_]+)/gi) || []).map((entry) => entry.replace(/^#/, "")),
  ].map((entry) => String(entry || "").trim()));
}

function inferRegionalMetadata(raw, combinedText, caption, request) {
  const profile = getRegionProfile(request.targetRegion);
  if (profile.key === "global") {
    return {
      targetRegion: profile.label,
      regionConfidence: "global",
      regionSignals: ["Global trend scan"],
      regionLanguageHints: profile.languageHints,
      regionMarketAngles: profile.marketAngles,
    };
  }

  const rawRegionText = collectRawRegionText(raw);
  const hashtags = extractRawHashtags(raw, caption);
  const normalizedHaystack = normalizeSlug(`${combinedText} ${rawRegionText} ${hashtags.join(" ")}`);
  const signalAliases = profile.aliases.filter((alias) => normalizeSlug(alias).length >= 3);
  const aliasSignals = signalAliases.filter((alias) => normalizedHaystack.includes(normalizeSlug(alias)));
  const hashtagSignals = profile.hashtags.filter((tag) => hashtags.some((hashtag) => normalizeSlug(hashtag) === normalizeSlug(tag)));
  const locationSignals = signalAliases.filter((alias) => normalizeSlug(rawRegionText).includes(normalizeSlug(alias)));
  const regionalSearchSignals = buildRegionalInstagramSlugs(request)
    .slice(0, 4)
    .filter((slug) => normalizedHaystack.includes(normalizeSlug(slug)));
  const signals = dedupeStrings([
    ...locationSignals.map((signal) => `location:${signal}`),
    ...hashtagSignals.map((signal) => `hashtag:${signal}`),
    ...aliasSignals.map((signal) => `text:${signal}`),
    ...regionalSearchSignals.map((signal) => `regional-search:${signal}`),
  ]);

  let regionConfidence = "low";
  if (locationSignals.length || hashtagSignals.length >= 2) {
    regionConfidence = "high";
  } else if (aliasSignals.length || hashtagSignals.length || regionalSearchSignals.length) {
    regionConfidence = "medium";
  }

  return {
    targetRegion: profile.label,
    regionConfidence,
    regionSignals: signals.length ? signals.slice(0, 6) : ["Inferred from region-expanded search"],
    regionLanguageHints: profile.languageHints,
    regionMarketAngles: profile.marketAngles,
  };
}

function cleanInstagramHandle(value) {
  return String(value || "")
    .trim()
    .replace(/^@/, "")
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
    .replace(/^\/+/, "")
    .replace(/\/.*$/, "")
    .trim();
}

function normalizeKeywordForSearch(value) {
  return String(value || "")
    .trim()
    .split(/\s+/)
    .map((token) => keywordCorrections.get(token.toLowerCase()) || token)
    .join(" ");
}

function toInstagramHashtagSlug(value) {
  return normalizeKeywordForSearch(value)
    .trim()
    .toLowerCase()
    .replace(/#/g, "")
    .replace(/[^a-z0-9_]+/g, "");
}

function buildInstagramHashtagSlugs(value) {
  const normalized = normalizeKeywordForSearch(value);
  const fullSlug = toInstagramHashtagSlug(normalized);
  const tokens = normalized
    .toLowerCase()
    .replace(/#/g, " ")
    .replace(/[^a-z0-9_\s]+/g, " ")
    .split(/\s+/)
    .map((entry) => entry.trim())
    .filter((entry) => entry && !keywordStopwords.has(entry) && (entry.length >= 3 || entry === "ai"));

  const joinedTokens = tokens.join("");
  const reversedTokens = [...tokens].reverse().join("");
  const slugs = [
    fullSlug,
    joinedTokens,
    reversedTokens,
    `${joinedTokens}tips`,
    `${joinedTokens}strategy`,
    `${joinedTokens}tools`,
    `${joinedTokens}ideas`,
    ...tokens,
    ...tokens.flatMap((token) => relatedHashtagSlugs[token] || []),
  ];

  if (tokens.includes("ai")) {
    slugs.push("artificialintelligence");
  }
  if (tokens.includes("marketing")) {
    slugs.push("digitalmarketing", "marketingautomation");
  }
  if (tokens.includes("content")) {
    slugs.push("contentmarketing", "contentstrategy");
  }

  return dedupeStrings(slugs.map((slug) => slug.replace(/[^a-z0-9_]+/g, ""))).slice(0, 14);
}

function buildRegionalInstagramSlugs(request) {
  const profile = getRegionProfile(request.targetRegion);
  if (profile.key === "global") {
    return [];
  }

  const regionSlugs = dedupeStrings(
    [...profile.hashtags, ...profile.aliases.map((alias) => toInstagramHashtagSlug(alias))]
      .map((slug) => slug.replace(/[^a-z0-9_]+/g, ""))
      .filter(Boolean),
  );
  const keywordSlugs = dedupeStrings(
    [...request.keywords, request.topicOverride]
      .flatMap((value) => buildInstagramHashtagSlugs(value))
      .filter(Boolean),
  ).slice(0, 8);

  const combinedSlugs = keywordSlugs.flatMap((keywordSlug) =>
    regionSlugs.slice(0, 5).flatMap((regionSlug) => [
      `${keywordSlug}${regionSlug}`,
      `${regionSlug}${keywordSlug}`,
    ]),
  );

  return dedupeStrings([
    ...combinedSlugs,
    ...regionSlugs,
    ...regionSlugs.map((slug) => `${slug}contentcreator`),
    ...regionSlugs.map((slug) => `${slug}smallbusiness`),
  ]).slice(0, 18);
}

function buildInstagramDirectUrls(request) {
  const hashtagTerms = [...request.keywords, request.topicOverride]
    .flatMap((value) => buildInstagramHashtagSlugs(value))
    .map((slug) => `https://www.instagram.com/explore/tags/${slug}/`);
  const regionalHashtagTerms = buildRegionalInstagramSlugs(request).map(
    (slug) => `https://www.instagram.com/explore/tags/${slug}/`,
  );

  const competitorProfiles = request.competitors
    .map((value) => cleanInstagramHandle(value))
    .filter(Boolean)
    .map((handle) => `https://www.instagram.com/${handle}/`);

  return dedupeStrings([...regionalHashtagTerms, ...hashtagTerms, ...competitorProfiles]).slice(0, 28);
}

function buildTemplatedActorInput(platform, request, actorConfig) {
  const regionProfile = getRegionProfile(request.targetRegion);
  const variables = {
    competitors: request.competitors,
    keywordString: request.keywords.join(", "),
    keywords: request.keywords,
    lookbackDays: request.lookbackDays,
    maxItemsPerPlatform: request.maxItemsPerPlatform,
    platform,
    regionalHashtags: buildRegionalInstagramSlugs(request),
    regionLabel: regionProfile.label,
    topicOverride: request.topicOverride,
    targetRegion: regionProfile.label,
  };

  return applyTemplate(
    actorConfig?.[platform]?.input || {
      keywords: request.keywords,
      competitors: request.competitors,
      lookbackDays: request.lookbackDays,
      maxItems: request.maxItemsPerPlatform,
    },
    variables,
  );
}

function buildActorAttempts(platform, request, actorConfig) {
  if (platform === "instagram") {
    const directUrls = buildInstagramDirectUrls(request);
    const attempts = [];
    if (directUrls.length) {
      attempts.push({
        strategy: "instagram-direct-urls",
        input: {
          directUrls,
          resultsType: "reels",
          resultsLimit: request.maxItemsPerPlatform,
          onlyPostsNewerThan: `${request.lookbackDays} days`,
          addParentData: true,
        },
      });
      if (request.lookbackDays < 14) {
        attempts.push({
          strategy: "instagram-direct-urls-broadened-14-days",
          input: {
            directUrls,
            resultsType: "reels",
            resultsLimit: request.maxItemsPerPlatform,
            onlyPostsNewerThan: "14 days",
            addParentData: true,
          },
        });
      }
    }

    attempts.push({
      strategy: "configured-template",
      input: buildTemplatedActorInput(platform, request, actorConfig),
    });

    return attempts;
  }

  return [
    {
      strategy: "configured-template",
      input: buildTemplatedActorInput(platform, request, actorConfig),
    },
  ];
}

function buildSearchSuggestions(request) {
  const regionProfile = getRegionProfile(request.targetRegion);
  const normalizedKeywords = request.keywords.map((keyword) => normalizeKeywordForSearch(keyword));
  const suggestedHashtags = dedupeStrings(
    [
      ...normalizedKeywords.flatMap((keyword) => buildInstagramHashtagSlugs(keyword).slice(0, 6)),
      ...buildRegionalInstagramSlugs(request).slice(0, 8),
    ],
  );
  const competitorHint = request.competitors.length
    ? "If competitor profiles are private or weak, try 2-3 public creator handles in the same niche."
    : "Add 2-3 public competitor or creator handles to improve discovery when a keyword is weak.";

  return {
    normalizedKeywords,
    targetRegion: regionProfile.label,
    suggestedHashtags,
    tips: [
      "Use niche phrases instead of broad one-word markets.",
      "Try hashtag-style keywords without spaces, for example aitools, digitalmarketing, or contentstrategy.",
      regionProfile.key === "global"
        ? "Choose a target region when the content decision depends on a local market."
        : `For ${regionProfile.label}, add local creator handles and city-specific hashtags to improve regional confidence.`,
      "Increase lookback to 14 days for smaller niches.",
      competitorHint,
    ],
  };
}

function normalizeRecord(raw, platform, request, mode, index) {
  const caption = firstString([
    raw?.caption,
    raw?.text,
    raw?.description,
    raw?.fullText,
    raw?.title,
  ]);
  const title = firstString([raw?.title, raw?.hookText]);
  const transcript = firstString([
    raw?.transcript,
    raw?.subtitles,
    raw?.subtitleText,
    raw?.closedCaptions,
  ]);
  const views = firstNumber([
    raw?.views,
    raw?.viewCount,
    raw?.playCount,
    raw?.videoViewCount,
    raw?.videoPlayCount,
    raw?.igPlayCount,
  ]);
  const likes = firstNumber([raw?.likes, raw?.likeCount, raw?.likesCount, raw?.favoriteCount]);
  const comments = firstNumber([raw?.comments, raw?.commentCount, raw?.commentsCount, raw?.replyCount]);
  const shares = firstNumber([raw?.shares, raw?.shareCount, raw?.retweetCount]);
  const url = inferPostUrl(raw, platform);
  const authorHandle = firstString([
    raw?.authorHandle,
    raw?.username,
    raw?.authorUsername,
    raw?.ownerUsername,
    raw?.channelHandle,
    raw?.channelUsername,
  ], "unknown");
  const postDate = toIsoDate(
    raw?.postDate || raw?.createdAt || raw?.timestamp || raw?.publishedAt || new Date().toISOString(),
  );
  const combinedText = `${title} ${caption} ${transcript}`.trim();
  const keywords = matchedKeywords(combinedText, request.keywords);
  const engagementRate = calculateEngagementRate({ views, likes, comments, shares });
  const contentFormat = normalizeFormat(platform, raw, caption);
  const regional = inferRegionalMetadata(raw, combinedText, caption, request);

  return {
    id: firstString([raw?.id, raw?.postId, raw?.shortCode, raw?.tweetId], `${platform}-${mode}-${index + 1}`),
    platform,
    sourceMode: mode,
    authorHandle,
    url,
    thumbnailUrl: inferThumbnailUrl(raw),
    mediaUrl: inferMediaUrl(raw),
    hookText: extractHookText(title, caption),
    title,
    caption,
    transcript: transcript || null,
    transcriptStatus: transcript ? "provided" : "missing",
    views,
    likes,
    comments,
    shares,
    engagementRate,
    postDate,
    contentFormat,
    matchedKeywords: keywords,
    targetRegion: regional.targetRegion,
    regionConfidence: regional.regionConfidence,
    regionSignals: regional.regionSignals,
    regionLanguageHints: regional.regionLanguageHints,
    regionMarketAngles: regional.regionMarketAngles,
    viralTag: engagementRate >= 0.05 || views >= 100000,
    raw,
  };
}

function hashSeed(input) {
  return input.split("").reduce((sum, character, index) => sum + character.charCodeAt(0) * (index + 1), 0);
}

function randomFromSeed(seed, min, max) {
  const value = Math.abs(Math.sin(seed) * 10000);
  return Math.round(min + (value % 1) * (max - min));
}

function generateMockItems(platform, request, reason) {
  const keywords = request.keywords.length ? request.keywords : [request.topicOverride || "AI content system"];
  const competitorSeed = request.competitors[0] || "market";
  const regionProfile = getRegionProfile(request.targetRegion);
  const items = [];

  for (let index = 0; index < Math.min(request.maxItemsPerPlatform, 6); index += 1) {
    const keyword = keywords[index % keywords.length];
    const seed = hashSeed(`${platform}-${keyword}-${competitorSeed}-${index}`);
    const views = randomFromSeed(seed, 18000, 180000);
    const likes = randomFromSeed(seed + 7, 1200, 24000);
    const comments = randomFromSeed(seed + 13, 80, 2200);
    const shares = randomFromSeed(seed + 29, 40, 1600);
    const daysBack = index % Math.max(request.lookbackDays, 1);
    const postDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString();
    const regionPhrase = isGlobalRegion(request.targetRegion) ? "global" : regionProfile.label;
    const caption = `${keyword} is outperforming generic advice right now in the ${regionPhrase} market. ${competitorSeed} creators keep framing it around outcomes, speed, and proof.`;

    items.push(
      normalizeRecord(
        {
          id: `${platform}-mock-${index + 1}`,
          title: `${keyword} content angle ${index + 1}`,
          caption,
          username: `${platform}_creator_${index + 1}`,
          url: `https://example.com/${platform}/${index + 1}`,
          createdAt: postDate,
          views,
          likes,
          comments,
          shares,
          type: platform === "youtube" ? "short" : platform === "instagram" ? "reel" : "post",
          locationName: isGlobalRegion(request.targetRegion) ? "" : regionProfile.label,
          hashtags: isGlobalRegion(request.targetRegion) ? [] : regionProfile.hashtags.slice(0, 3),
          mockReason: reason,
        },
        platform,
        request,
        "demo",
        index,
      ),
    );
  }

  return items;
}

function applyTemplate(value, variables) {
  if (typeof value === "string") {
    const match = value.match(/^\{\{(.+)\}\}$/);
    if (match) {
      return variables[match[1].trim()];
    }

    return value.replace(/\{\{(.+?)\}\}/g, (_, key) => {
      const replacement = variables[key.trim()];
      return Array.isArray(replacement) ? replacement.join(", ") : String(replacement ?? "");
    });
  }

  if (Array.isArray(value)) {
    return value.map((entry) => applyTemplate(entry, variables));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [key, applyTemplate(nestedValue, variables)]),
    );
  }

  return value;
}

async function loadActorConfig(rootDir) {
  const configPath = path.join(rootDir, "config", "apify-actors.json");
  try {
    const raw = await readFile(configPath, "utf8");
    return JSON.parse(raw);
  } catch (error) {
    if (error?.code !== "ENOENT") {
      throw error;
    }
  }

  const envConfig = {
    instagram: process.env.APIFY_INSTAGRAM_ACTOR_ID ? { actorId: process.env.APIFY_INSTAGRAM_ACTOR_ID } : null,
    youtube: process.env.APIFY_YOUTUBE_ACTOR_ID ? { actorId: process.env.APIFY_YOUTUBE_ACTOR_ID } : null,
    x: process.env.APIFY_X_ACTOR_ID ? { actorId: process.env.APIFY_X_ACTOR_ID } : null,
  };

  if (Object.values(envConfig).some(Boolean)) {
    return envConfig;
  }

  return null;
}

function normalizeActorIdentifier(actorId) {
  const value = String(actorId || "").trim();
  if (!value) {
    return value;
  }

  return value.includes("/") ? value.replace("/", "~") : value;
}

async function runActor(actorId, input) {
  const normalizedActorId = normalizeActorIdentifier(actorId);
  const url = `https://api.apify.com/v2/acts/${encodeURIComponent(normalizedActorId)}/run-sync-get-dataset-items?token=${encodeURIComponent(process.env.APIFY_TOKEN)}`;

  const response = await fetchWithTimeout(
    url,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify(input),
    },
    getApifyTimeoutMs(),
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Apify actor ${actorId} failed (${response.status}): ${compactErrorText(errorText)}`);
  }

  const items = await response.json();
  return Array.isArray(items) ? items : [];
}

export async function getApifyStatus(rootDir) {
  const actorConfig = await loadActorConfig(rootDir);
  const configuredPlatforms = actorConfig
    ? supportedPlatforms.filter((platform) => actorConfig?.[platform]?.actorId)
    : [];

  return {
    tokenConfigured: Boolean(process.env.APIFY_TOKEN),
    actorConfigFilePresent: Boolean(actorConfig),
    configuredPlatforms,
  };
}

export async function scrapeRecentPosts(request, { rootDir }) {
  const actorConfig = await loadActorConfig(rootDir);
  const errors = [];
  const items = [];
  const livePlatforms = [];
  const demoPlatforms = [];
  const attemptedStrategies = {};

  for (const platform of request.platforms) {
    const actorId = actorConfig?.[platform]?.actorId;

    if (!actorId || !process.env.APIFY_TOKEN) {
      demoPlatforms.push(platform);
      items.push(
        ...generateMockItems(
          platform,
          request,
          actorId ? "APIFY_TOKEN missing, using demo data." : "Actor mapping missing, using demo data.",
        ),
      );
      continue;
    }

    const attempts = buildActorAttempts(platform, request, actorConfig);
    attemptedStrategies[platform] = attempts.map((attempt) => attempt.strategy);
    let platformLiveItems = [];
    let platformErrors = [];

    try {
      for (const attempt of attempts) {
        const rawItems = await runActor(actorId, attempt.input);
        const usableRawItems = rawItems.filter((item) => !item?.error);
        const reportedErrors = rawItems.filter((item) => item?.error);

        if (reportedErrors.length) {
          platformErrors.push({
            platform,
            message: `${attempt.strategy}: ${reportedErrors.map((item) => item.errorDescription || item.error).join("; ")}`,
          });
        }

        if (usableRawItems.length) {
          platformLiveItems = usableRawItems.map((raw, index) => normalizeRecord(raw, platform, request, "live", index));
          break;
        }

        if (!reportedErrors.length) {
          platformErrors.push({
            platform,
            message: `${attempt.strategy}: No public items returned for this input.`,
          });
        }
      }

      livePlatforms.push(platform);
      items.push(...platformLiveItems);
      if (!platformLiveItems.length) {
        errors.push(
          platformErrors.at(-1) || {
            platform,
            message: "No public items returned for this input.",
          },
        );
      }
    } catch (error) {
      errors.push({ platform, message: error.message });
      demoPlatforms.push(platform);
      items.push(...generateMockItems(platform, request, error.message));
    }
  }

  const sortedItems = items
    .sort((left, right) => right.views - left.views || right.engagementRate - left.engagementRate || right.comments - left.comments)
    .map((item) => ({
      ...item,
      matchedKeywords: dedupeStrings(item.matchedKeywords),
    }));
  const platformCounts = new Map();
  const cappedItems = [];
  for (const item of sortedItems) {
    const count = platformCounts.get(item.platform) || 0;
    if (count >= request.maxItemsPerPlatform) {
      continue;
    }
    platformCounts.set(item.platform, count + 1);
    cappedItems.push(item);
  }

  const mode = livePlatforms.length && demoPlatforms.length ? "mixed" : livePlatforms.length ? "live" : "demo";

  return {
    mode,
    items: cappedItems,
    errors,
    diagnostics: {
      actorConfigPresent: Boolean(actorConfig),
      demoPlatforms,
      livePlatforms,
      attemptedStrategies,
      regionProfile: getRegionProfile(request.targetRegion),
      regionalHashtags: buildRegionalInstagramSlugs(request),
      searchSuggestions: cappedItems.length ? null : buildSearchSuggestions(request),
    },
  };
}
