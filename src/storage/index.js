import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { getSharePointStatus, listRecentSharePointRuns, persistResultToSharePoint } from "./sharepoint.js";

async function listLocalRuns(rootDir, limit) {
  const runsDir = path.join(rootDir, "data", "runs");
  let entries = [];

  try {
    entries = await readdir(runsDir, { withFileTypes: true });
  } catch {
    return [];
  }

  const runs = [];
  for (const entry of entries.filter((item) => item.isDirectory())) {
    const filePath = path.join(runsDir, entry.name, "pipeline-result.json");
    try {
      const raw = await readFile(filePath, "utf8");
      const result = JSON.parse(raw);
      runs.push({
        id: result.runId,
        createdDateTime: result.runId,
        source: "local",
        runId: result.runId,
        title: `Run ${result.runId}`,
        clientName: result.request?.clientName || "",
        industryPreset: result.request?.industryPreset || "",
        primaryGoal: result.request?.primaryGoal || "",
        targetRegion: result.request?.targetRegion || "Global",
        runTarget: result.request?.runTarget || "",
        keywords: result.request?.keywords?.join(", ") || "",
        platforms: result.request?.platforms?.join(", ") || "",
        scrapeMode: result.scrape?.mode || "",
        scrapedPosts: result.scrape?.items?.length || 0,
        contentBuckets: result.validation?.contentBuckets?.length || 0,
        recommendedTopic: result.validation?.recommendation?.topic || result.voice?.topic || "",
      });
    } catch {
      // Ignore partial or old run folders that do not match the current result contract.
    }
  }

  return runs
    .sort((left, right) => String(right.runId).localeCompare(String(left.runId)))
    .slice(0, limit);
}

export async function getStorageStatus(rootDir) {
  const sharePoint = getSharePointStatus();
  return {
    provider: sharePoint.provider,
    local: {
      enabled: true,
      path: path.join(rootDir, "data", "runs"),
    },
    sharePoint,
  };
}

export async function persistExternalStorage(result) {
  try {
    return await persistResultToSharePoint(result);
  } catch (error) {
    return {
      provider: "sharepoint",
      status: "failed",
      error: error.message,
    };
  }
}

export async function listRecentRuns(rootDir, limit = 10) {
  const sharePoint = getSharePointStatus();
  if (sharePoint.requested && sharePoint.configured) {
    try {
      const runs = await listRecentSharePointRuns(limit);
      return {
        source: "sharepoint",
        runs: runs || [],
      };
    } catch (error) {
      return {
        source: "local",
        warning: `SharePoint history unavailable: ${error.message}`,
        runs: await listLocalRuns(rootDir, limit),
      };
    }
  }

  return {
    source: "local",
    runs: await listLocalRuns(rootDir, limit),
  };
}
