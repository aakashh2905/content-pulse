import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  deleteSharePointCampaign,
  getSharePointStatus,
  listSharePointCampaigns,
  saveSharePointCampaign,
} from "./storage/sharepoint.js";

const defaultCampaigns = [];
const defaultScheduleTime = "09:00";
const defaultTimeZone = "Asia/Calcutta";

function createId(prefix = "campaign") {
  return `${prefix}-${new Date().toISOString().replace(/[:.]/g, "-")}-${Math.random().toString(36).slice(2, 8)}`;
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

function clampNumber(value, min, max, fallback) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  return Math.min(Math.max(numeric, min), max);
}

function campaignFilePath(rootDir) {
  return path.join(rootDir, "data", "campaigns.json");
}

async function readLocalCampaigns(rootDir) {
  try {
    const raw = await readFile(campaignFilePath(rootDir), "utf8");
    const payload = JSON.parse(raw);
    return Array.isArray(payload.campaigns) ? payload.campaigns : defaultCampaigns;
  } catch {
    return defaultCampaigns;
  }
}

async function writeLocalCampaigns(rootDir, campaigns) {
  await mkdir(path.join(rootDir, "data"), { recursive: true });
  await writeFile(campaignFilePath(rootDir), `${JSON.stringify({ campaigns }, null, 2)}\n`, "utf8");
}

function normalizeCampaign(input, existing = {}) {
  const now = new Date().toISOString();
  const campaign = {
    ...existing,
    id: existing.id || input.id || createId(),
    name: String(input.name || existing.name || "Untitled campaign").trim(),
    clientName: String(input.clientName || existing.clientName || "").trim(),
    status: ["active", "paused"].includes(input.status || existing.status) ? input.status || existing.status : "active",
    industryPreset: String(input.industryPreset || existing.industryPreset || "agency-social").trim(),
    teamModel: String(input.teamModel || existing.teamModel || "agency-team").trim(),
    primaryGoal: String(input.primaryGoal || existing.primaryGoal || "pipeline").trim(),
    outputLanguage: String(input.outputLanguage || existing.outputLanguage || "english").trim(),
    targetRegion: String(input.targetRegion || existing.targetRegion || "Global").trim(),
    runTarget: String(input.runTarget || existing.runTarget || "content-validator").trim(),
    outputFormats: toArray(input.outputFormats?.length ? input.outputFormats : existing.outputFormats || ["markdown table", "json"]),
    keywords: toArray(input.keywords?.length ? input.keywords : existing.keywords),
    competitors: toArray(input.competitors?.length ? input.competitors : existing.competitors),
    platforms: toArray(input.platforms?.length ? input.platforms : existing.platforms || ["instagram"]),
    lookbackDays: clampNumber(input.lookbackDays ?? existing.lookbackDays, 1, 30, 7),
    maxItemsPerPlatform: clampNumber(input.maxItemsPerPlatform ?? existing.maxItemsPerPlatform, 1, 25, 10),
    topicOverride: String(input.topicOverride ?? existing.topicOverride ?? "").trim(),
    voiceSamples: String(input.voiceSamples ?? existing.voiceSamples ?? "").trim(),
    enableTranscription: Boolean(input.enableTranscription ?? existing.enableTranscription),
    scheduleTime: String(input.scheduleTime || existing.scheduleTime || defaultScheduleTime).trim(),
    timeZone: String(input.timeZone || existing.timeZone || defaultTimeZone).trim(),
    lastRunAt: input.lastRunAt ?? existing.lastRunAt ?? null,
    nextRunAt: input.nextRunAt ?? existing.nextRunAt ?? null,
    lastRunId: input.lastRunId ?? existing.lastRunId ?? "",
    lastStatus: input.lastStatus ?? existing.lastStatus ?? "",
    lastError: input.lastError ?? existing.lastError ?? "",
    sharePointItemId: input.sharePointItemId ?? existing.sharePointItemId ?? null,
    createdAt: existing.createdAt || input.createdAt || now,
    updatedAt: now,
  };

  if (!campaign.keywords.length && !campaign.topicOverride) {
    throw new Error("Campaign requires at least one keyword or topic override.");
  }

  return campaign;
}

function toRunInput(campaign) {
  return {
    campaignId: campaign.id,
    campaignName: campaign.name,
    clientName: campaign.clientName,
    industryPreset: campaign.industryPreset,
    teamModel: campaign.teamModel,
    primaryGoal: campaign.primaryGoal,
    outputLanguage: campaign.outputLanguage,
    targetRegion: campaign.targetRegion,
    runTarget: campaign.runTarget,
    outputFormats: campaign.outputFormats,
    keywords: campaign.keywords,
    competitors: campaign.competitors,
    platforms: campaign.platforms,
    lookbackDays: campaign.lookbackDays,
    maxItemsPerPlatform: campaign.maxItemsPerPlatform,
    topicOverride: campaign.topicOverride,
    voiceSamples: campaign.voiceSamples,
    enableTranscription: campaign.enableTranscription,
    scrapingMethod: "Apify + OpenAI",
  };
}

async function readCampaignsFromBestStore(rootDir) {
  const sharePoint = getSharePointStatus();
  if (sharePoint.requested && sharePoint.configured) {
    try {
      const campaigns = await listSharePointCampaigns();
      if (campaigns) {
        await writeLocalCampaigns(rootDir, campaigns);
        return {
          source: "sharepoint",
          campaigns,
        };
      }
    } catch (error) {
      return {
        source: "local",
        warning: `SharePoint campaigns unavailable: ${error.message}`,
        campaigns: await readLocalCampaigns(rootDir),
      };
    }
  }

  return {
    source: "local",
    campaigns: await readLocalCampaigns(rootDir),
  };
}

export function campaignToRunInput(campaign) {
  return toRunInput(campaign);
}

export async function listCampaigns(rootDir) {
  const result = await readCampaignsFromBestStore(rootDir);
  return {
    ...result,
    campaigns: result.campaigns.sort((left, right) => String(right.updatedAt).localeCompare(String(left.updatedAt))),
  };
}

export async function getCampaign(rootDir, campaignId) {
  const { campaigns } = await readCampaignsFromBestStore(rootDir);
  return campaigns.find((campaign) => campaign.id === campaignId) || null;
}

export async function saveCampaign(rootDir, input) {
  const localCampaigns = await readLocalCampaigns(rootDir);
  const existing = localCampaigns.find((campaign) => campaign.id === input.id) || {};
  let campaign = normalizeCampaign(input, existing);
  const updated = [campaign, ...localCampaigns.filter((entry) => entry.id !== campaign.id)];
  await writeLocalCampaigns(rootDir, updated);

  const sharePoint = getSharePointStatus();
  if (sharePoint.requested && sharePoint.configured) {
    campaign = await saveSharePointCampaign(campaign);
    await writeLocalCampaigns(rootDir, [campaign, ...updated.filter((entry) => entry.id !== campaign.id)]);
  }

  return campaign;
}

export async function updateCampaign(rootDir, campaignId, patch) {
  const localCampaigns = await readLocalCampaigns(rootDir);
  const existing = localCampaigns.find((campaign) => campaign.id === campaignId);
  if (!existing) {
    throw new Error("Campaign not found.");
  }

  return saveCampaign(rootDir, {
    ...existing,
    ...patch,
    id: campaignId,
  });
}

export async function deleteCampaign(rootDir, campaignId) {
  const localCampaigns = await readLocalCampaigns(rootDir);
  const existing = localCampaigns.find((campaign) => campaign.id === campaignId);
  if (!existing) {
    return false;
  }

  const sharePoint = getSharePointStatus();
  if (sharePoint.requested && sharePoint.configured) {
    await deleteSharePointCampaign(existing);
  }

  await writeLocalCampaigns(rootDir, localCampaigns.filter((campaign) => campaign.id !== campaignId));
  return true;
}
