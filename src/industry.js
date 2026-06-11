const industryProfiles = {
  "agency-social": {
    id: "agency-social",
    label: "Agency / Social Team",
    shortLabel: "Agency",
    audience: "Agency strategists, social managers, and client service teams",
    positioning: {
      default: "Trend intelligence and short-form scripting for agencies that need client-ready creative angles fast.",
      pipeline: "Use live category signals to turn trend noise into account-ready campaign opportunities.",
      authority: "Package category movement into sharper POV content that helps agencies look ahead of clients.",
      community: "Turn topical momentum into repeatable social series clients can actually sustain.",
      product: "Map trends to launch angles, creator references, and offer narratives for client campaigns.",
    },
    whyNow:
      "Agency buyers are optimistic about growth, but they still need better differentiation, stronger AI-led personalization, and proof that strategy maps to results.",
    marketSignals: [
      "Agencies expect growth, but marketer-agency perception gaps remain around who is really ahead on trends.",
      "AI-powered personalization is becoming table stakes, so the edge shifts to better strategy packaging and faster execution.",
      "Client teams need evidence-backed angle boards, not just inspiration screenshots.",
    ],
    workflows: [
      "Weekly category watchlist for every active client",
      "Pitch-ready trend board with live post evidence",
      "Monthly reel sprint planning with scripts and hooks",
    ],
    kpis: ["client-ready briefs", "time-to-angle", "repeatable content buckets", "competitive coverage"],
    anglePrompts: ["category trend reaction", "myth busting", "case-study remix", "offer reframing"],
    productMoves: [
      "Show source posts, thumbnails, and proof next to every recommendation.",
      "Turn each run into a deliverable that can be dropped into client review.",
      "Bias scoring toward reusable content patterns, not one-off viral anomalies.",
    ],
    scoreWeights: { views: 0.28, engagement: 0.28, comments: 0.22, freshness: 0.22 },
  },
  "b2b-saas": {
    id: "b2b-saas",
    label: "B2B SaaS / Thought Leadership",
    shortLabel: "B2B SaaS",
    audience: "Founders, GTM leaders, content marketers, and social-led demand teams",
    positioning: {
      default: "Thought-leadership intelligence for B2B SaaS teams that want sharper founder and category content.",
      pipeline: "Turn market chatter into founder-led content that builds trust before buyers talk to sales.",
      authority: "Convert trend evidence into strong category POV, objection handling, and challenger narratives.",
      community: "Create social content that earns qualified engagement from hidden and visible buying group members.",
      product: "Translate product launches into problem-first narratives, comparisons, and proof-driven explainers.",
    },
    whyNow:
      "B2B buying is influenced by hidden decision-makers, so content that informs, challenges, and aligns the buying group matters more than generic reach.",
    marketSignals: [
      "Thought leadership now influences both visible and hidden buyers inside complex B2B deals.",
      "Raw posting volume matters less than distinct point of view and buyer-relevant insight.",
      "Short-form should feed trust, education, and sales conversations, not just awareness.",
    ],
    workflows: [
      "Founder social operating system",
      "Category POV engine for weekly commentary",
      "Problem-solution explainer pipeline for launches and objections",
    ],
    kpis: ["qualified comments", "objection coverage", "sales reuse value", "trust-building reach"],
    anglePrompts: ["strong opinion", "buyer myth", "workflow teardown", "case-study lesson"],
    productMoves: [
      "Bias ranking toward posts with stronger comment density and educational depth.",
      "Turn validated topics into founder-style scripts, not generic trend recap.",
      "Package outputs around problems, hidden buyers, and proof of consequence.",
    ],
    scoreWeights: { views: 0.2, engagement: 0.3, comments: 0.32, freshness: 0.18 },
  },
  "creator-education": {
    id: "creator-education",
    label: "Creator Brand / Education",
    shortLabel: "Creator Brand",
    audience: "Creators, coaches, consultants, and info-product operators",
    positioning: {
      default: "Research-to-script content ops for creator businesses that monetize through expertise and audience trust.",
      pipeline: "Use proven reel patterns to publish faster without sounding templated.",
      authority: "Build authority with explainers, frameworks, and transformation-led storytelling.",
      community: "Create repeatable comment-trigger content that grows trust and DM conversations.",
      product: "Map content ideas directly to offers, workshops, audits, and digital products.",
    },
    whyNow:
      "Creator spend and competition are both rising, so creators need repeatable formats, stronger hooks, and clearer offer alignment to win attention.",
    marketSignals: [
      "Creators are now treated as a full channel, not just social support.",
      "Short-form remains the highest-ROI format, but authority matters more than trend-chasing alone.",
      "The edge is in turning trend signals into consistent series, not isolated posts.",
    ],
    workflows: [
      "Daily idea board from live trend signals",
      "Signature series planning and script generation",
      "Offer-linked reel creation with stronger CTAs",
    ],
    kpis: ["comment triggers", "repeatable series", "offer-fit topics", "authority signals"],
    anglePrompts: ["tutorial", "mistake breakdown", "before-after transformation", "tool workflow"],
    productMoves: [
      "Lead with hooks, transformation stories, and practical demonstrations.",
      "Surface recurring series angles that can become a content franchise.",
      "Keep outputs close to monetization: DM trigger, lead magnet, workshop, or audit CTA.",
    ],
    scoreWeights: { views: 0.3, engagement: 0.32, comments: 0.18, freshness: 0.2 },
  },
  "d2c-brand": {
    id: "d2c-brand",
    label: "D2C Brand / Social Commerce",
    shortLabel: "D2C",
    audience: "Brand marketers, social leads, and product marketing teams",
    positioning: {
      default: "Trend-led planning for product storytelling, social proof, and launch-ready short-form content.",
      pipeline: "Spot the creative patterns that can be remixed into product demand and category relevance.",
      authority: "Translate market movement into stronger brand POV and consumer education.",
      community: "Build repeatable creator-style content that feels native, useful, and shareable.",
      product: "Create launch, promo, and social-proof variations from proven reel patterns.",
    },
    whyNow:
      "Consumer brands can publish a bit less and win more by focusing on higher-quality, trend-aware creative tied to product use cases and proof.",
    marketSignals: [
      "Quality now matters more than simply pushing more posts every day.",
      "Consumer-facing teams still move fastest when they align content to trends, events, and cultural moments.",
      "Winning teams need a stronger bridge between creator-native formats and commerce goals.",
    ],
    workflows: [
      "UGC angle finder and product story board",
      "Launch sprint planning from live category examples",
      "Social-proof reel queue with hooks and scripts",
    ],
    kpis: ["view velocity", "share signal", "product curiosity", "launch-readiness"],
    anglePrompts: ["use-case demo", "social proof", "offer reveal", "objection handling"],
    productMoves: [
      "Prioritize visual proof, creator-native formats, and product clarity.",
      "Turn trend buckets into campaign-ready creative territories.",
      "Keep each run tied to a concrete merch, offer, or collection narrative.",
    ],
    scoreWeights: { views: 0.34, engagement: 0.28, comments: 0.14, freshness: 0.24 },
  },
};

const teamModels = {
  "agency-team": "Agency team",
  "in-house-marketing": "In-house marketing",
  "founder-led": "Founder-led brand",
  "creator-ops": "Creator ops",
};

const primaryGoals = {
  pipeline: "Drive leads",
  authority: "Build authority",
  community: "Grow community",
  product: "Support launches",
};

export function getIndustryProfile(industryPreset) {
  return industryProfiles[industryPreset] || industryProfiles["agency-social"];
}

export function getTeamModelLabel(teamModel) {
  return teamModels[teamModel] || teamModels["agency-team"];
}

export function getPrimaryGoalLabel(primaryGoal) {
  return primaryGoals[primaryGoal] || primaryGoals.pipeline;
}

export function getScoreWeights(industryPreset) {
  return getIndustryProfile(industryPreset).scoreWeights;
}

export function buildIndustryBrief({ request, scrape, validation }) {
  const profile = getIndustryProfile(request.industryPreset);
  const topTopics = validation?.topicRankings?.slice(0, 3).map((entry) => entry.topic) || [];
  const topBuckets =
    validation?.contentBuckets?.slice(0, 3).map((entry) => ({
      bucket: entry.bucket,
      averageViews: entry.averageViews,
      averageEngagementRate: entry.averageEngagementRate,
    })) || [];
  const activeFormats = [...new Set(scrape.items.map((item) => `${item.platform} ${item.contentFormat}`))].slice(0, 4);

  return {
    profileId: profile.id,
    label: profile.label,
    teamModel: getTeamModelLabel(request.teamModel),
    primaryGoal: getPrimaryGoalLabel(request.primaryGoal),
    audience: profile.audience,
    positioning: profile.positioning[request.primaryGoal] || profile.positioning.default,
    whyNow: profile.whyNow,
    marketSignals: profile.marketSignals,
    priorityWorkflows: profile.workflows,
    kpiFocus: profile.kpis,
    anglePrompts: profile.anglePrompts,
    productMoves: profile.productMoves,
    activeFormats,
    topTopics,
    topBuckets,
    launchNarrative: `This product should feel like a ${profile.shortLabel.toLowerCase()} content intelligence desk for ${getTeamModelLabel(request.teamModel).toLowerCase()} teams, not a generic AI writer.`,
  };
}
