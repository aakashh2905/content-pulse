import { campaignToRunInput, getCampaign, listCampaigns, updateCampaign } from "./campaigns.js";
import { runPipeline } from "./pipeline.js";

const runningCampaigns = new Set();
let schedulerTimer = null;
let schedulerState = {
  enabled: false,
  lastCheckedAt: null,
  running: [],
  lastError: "",
};

function parseScheduleTime(value) {
  const match = String(value || "09:00").match(/^(\d{1,2}):(\d{2})$/);
  if (!match) {
    return { hour: 9, minute: 0 };
  }

  return {
    hour: Math.min(Math.max(Number(match[1]), 0), 23),
    minute: Math.min(Math.max(Number(match[2]), 0), 59),
  };
}

function scheduledDateFor(baseDate, scheduleTime) {
  const { hour, minute } = parseScheduleTime(scheduleTime);
  const date = new Date(baseDate);
  date.setHours(hour, minute, 0, 0);
  return date;
}

function isSameLocalDay(left, right) {
  if (!left || !right) {
    return false;
  }

  const leftDate = new Date(left);
  const rightDate = new Date(right);
  return (
    leftDate.getFullYear() === rightDate.getFullYear() &&
    leftDate.getMonth() === rightDate.getMonth() &&
    leftDate.getDate() === rightDate.getDate()
  );
}

export function calculateNextRunAt(campaign, now = new Date()) {
  if (campaign.status !== "active") {
    return null;
  }

  const todayAtSchedule = scheduledDateFor(now, campaign.scheduleTime);
  const ranToday = isSameLocalDay(campaign.lastRunAt, now);
  if (!ranToday && todayAtSchedule.getTime() > now.getTime()) {
    return todayAtSchedule.toISOString();
  }

  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return scheduledDateFor(tomorrow, campaign.scheduleTime).toISOString();
}

function isCampaignDue(campaign, now = new Date()) {
  if (campaign.status !== "active") {
    return false;
  }
  if (runningCampaigns.has(campaign.id)) {
    return false;
  }
  if (isSameLocalDay(campaign.lastRunAt, now)) {
    return false;
  }

  return scheduledDateFor(now, campaign.scheduleTime).getTime() <= now.getTime();
}

export function getSchedulerStatus() {
  return {
    ...schedulerState,
    running: [...runningCampaigns],
  };
}

export async function runCampaignNow(rootDir, campaignId, reason = "manual") {
  const campaign = await getCampaign(rootDir, campaignId);
  if (!campaign) {
    throw new Error("Campaign not found.");
  }
  if (runningCampaigns.has(campaign.id)) {
    throw new Error("Campaign is already running.");
  }

  runningCampaigns.add(campaign.id);
  schedulerState.running = [...runningCampaigns];
  const startedAt = new Date().toISOString();
  await updateCampaign(rootDir, campaign.id, {
    lastStatus: reason === "scheduled" ? "scheduled_running" : "manual_running",
    lastError: "",
  });

  try {
    const result = await runPipeline(campaignToRunInput(campaign), { rootDir });
    await updateCampaign(rootDir, campaign.id, {
      lastRunAt: startedAt,
      nextRunAt: calculateNextRunAt({ ...campaign, lastRunAt: startedAt }),
      lastRunId: result.runId,
      lastStatus: "completed",
      lastError: "",
    });
    return result;
  } catch (error) {
    await updateCampaign(rootDir, campaign.id, {
      lastRunAt: startedAt,
      nextRunAt: calculateNextRunAt({ ...campaign, lastRunAt: startedAt }),
      lastStatus: "failed",
      lastError: error.message,
    });
    throw error;
  } finally {
    runningCampaigns.delete(campaign.id);
    schedulerState.running = [...runningCampaigns];
  }
}

export async function runDueCampaigns(rootDir) {
  schedulerState.lastCheckedAt = new Date().toISOString();
  schedulerState.lastError = "";
  const { campaigns } = await listCampaigns(rootDir);
  const dueCampaigns = campaigns.filter((campaign) => isCampaignDue(campaign));
  const results = [];

  for (const campaign of dueCampaigns) {
    try {
      const result = await runCampaignNow(rootDir, campaign.id, "scheduled");
      results.push({ campaignId: campaign.id, status: "completed", runId: result.runId });
    } catch (error) {
      schedulerState.lastError = error.message;
      results.push({ campaignId: campaign.id, status: "failed", error: error.message });
    }
  }

  return results;
}

export function startCampaignScheduler(rootDir, { intervalMs = 60_000 } = {}) {
  if (schedulerTimer) {
    return getSchedulerStatus();
  }

  schedulerState.enabled = true;
  schedulerTimer = setInterval(() => {
    runDueCampaigns(rootDir).catch((error) => {
      schedulerState.lastError = error.message;
    });
  }, intervalMs);

  runDueCampaigns(rootDir).catch((error) => {
    schedulerState.lastError = error.message;
  });

  return getSchedulerStatus();
}
