import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { deleteCampaign, listCampaigns, saveCampaign, updateCampaign } from "./src/campaigns.js";
import { getRuntimeStatus, listStoredRuns, runPipeline } from "./src/pipeline.js";
import { getSchedulerStatus, runCampaignNow, runDueCampaigns, startCampaignScheduler } from "./src/scheduler.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, "public");
const port = Number(process.env.PORT || 3000);
const startedAt = new Date();
const maxBodyBytes = Number(process.env.MAX_REQUEST_BODY_BYTES || 1_000_000);
const maxActiveRuns = Number(process.env.MAX_ACTIVE_RUNS || 1);
const schedulerIntervalMs = Number(process.env.SCHEDULER_INTERVAL_MS || 60_000);
let activeRunCount = 0;

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

class HttpError extends Error {
  constructor(statusCode, message, details) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
  }
}

function baseHeaders(extra = {}) {
  return {
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    ...extra,
  };
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    ...baseHeaders({
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    }),
  });
  response.end(JSON.stringify(payload, null, 2));
}

function sendError(response, statusCode, message, details) {
  sendJson(response, statusCode, {
    ok: false,
    error: message,
    details,
  });
}

async function readRequestBody(request) {
  const chunks = [];
  let receivedBytes = 0;
  for await (const chunk of request) {
    receivedBytes += chunk.length;
    if (receivedBytes > maxBodyBytes) {
      throw new HttpError(413, `Request body is too large. Limit is ${maxBodyBytes} bytes.`);
    }
    chunks.push(chunk);
  }

  if (chunks.length === 0) {
    return {};
  }

  const raw = Buffer.concat(chunks).toString("utf8");
  try {
    return JSON.parse(raw);
  } catch {
    throw new HttpError(400, "Invalid JSON request body.");
  }
}

async function serveStatic(request, response) {
  const requestUrl = new URL(request.url, `http://${request.headers.host}`);
  const pathname = requestUrl.pathname === "/" ? "/index.html" : requestUrl.pathname;
  const filePath = path.normalize(path.join(publicDir, pathname));

  if (!filePath.startsWith(publicDir)) {
    sendError(response, 403, "Forbidden.");
    return;
  }

  try {
    const fileStats = await stat(filePath);
    if (!fileStats.isFile()) {
      sendError(response, 404, "Not found.");
      return;
    }

    const extension = path.extname(filePath);
    const contentType = mimeTypes[extension] || "application/octet-stream";
    const contents = await readFile(filePath);
    const cacheControl =
      extension === ".html" ? "no-store" : process.env.NODE_ENV === "production" ? "public, max-age=300" : "no-store";

    response.writeHead(200, baseHeaders({ "Content-Type": contentType, "Cache-Control": cacheControl }));
    response.end(contents);
  } catch (error) {
    if (error?.code === "ENOENT") {
      sendError(response, 404, "Not found.");
      return;
    }
    throw error;
  }
}

async function runWithCapacity(work) {
  if (activeRunCount >= maxActiveRuns) {
    throw new HttpError(
      429,
      `Too many active runs. Current limit is ${maxActiveRuns}. Wait for the current run to finish or increase MAX_ACTIVE_RUNS.`,
    );
  }

  activeRunCount += 1;
  try {
    return await work();
  } finally {
    activeRunCount -= 1;
  }
}

const server = createServer(async (request, response) => {
  const requestUrl = new URL(request.url, `http://${request.headers.host}`);

  try {
    if (request.method === "GET" && requestUrl.pathname === "/api/health") {
      const status = await getRuntimeStatus(__dirname);
      sendJson(response, 200, {
        ok: true,
        status: {
          ...status,
          scheduler: getSchedulerStatus(),
          runtime: {
            startedAt: startedAt.toISOString(),
            uptimeSeconds: Math.round(process.uptime()),
            activeRunCount,
            maxActiveRuns,
            maxBodyBytes,
            nodeEnv: process.env.NODE_ENV || "development",
          },
        },
      });
      return;
    }

    if (request.method === "POST" && requestUrl.pathname === "/api/run") {
      const body = await readRequestBody(request);
      const result = await runWithCapacity(() => runPipeline(body, { rootDir: __dirname }));
      sendJson(response, 200, { ok: true, result });
      return;
    }

    if (request.method === "GET" && requestUrl.pathname === "/api/runs") {
      const limit = Number(requestUrl.searchParams.get("limit") || 10);
      const history = await listStoredRuns(__dirname, Number.isFinite(limit) ? limit : 10);
      sendJson(response, 200, { ok: true, history });
      return;
    }

    if (request.method === "GET" && requestUrl.pathname === "/api/campaigns") {
      const campaigns = await listCampaigns(__dirname);
      sendJson(response, 200, { ok: true, campaigns });
      return;
    }

    if (request.method === "POST" && requestUrl.pathname === "/api/campaigns") {
      const body = await readRequestBody(request);
      const campaign = await saveCampaign(__dirname, body);
      sendJson(response, 200, { ok: true, campaign });
      return;
    }

    const campaignRoute = requestUrl.pathname.match(/^\/api\/campaigns\/([^/]+)(?:\/(run))?$/);
    if (campaignRoute) {
      const campaignId = decodeURIComponent(campaignRoute[1]);
      const action = campaignRoute[2];

      if (request.method === "PATCH" && !action) {
        const body = await readRequestBody(request);
        const campaign = await updateCampaign(__dirname, campaignId, body);
        sendJson(response, 200, { ok: true, campaign });
        return;
      }

      if (request.method === "DELETE" && !action) {
        const deleted = await deleteCampaign(__dirname, campaignId);
        sendJson(response, 200, { ok: true, deleted });
        return;
      }

      if (request.method === "POST" && action === "run") {
        const result = await runWithCapacity(() => runCampaignNow(__dirname, campaignId, "manual"));
        sendJson(response, 200, { ok: true, result });
        return;
      }
    }

    if (request.method === "POST" && requestUrl.pathname === "/api/scheduler/run-due") {
      const results = await runDueCampaigns(__dirname);
      sendJson(response, 200, { ok: true, results, scheduler: getSchedulerStatus() });
      return;
    }

    if (request.method === "GET") {
      await serveStatic(request, response);
      return;
    }

    sendError(response, 405, "Method not allowed.");
  } catch (error) {
    const statusCode = error.statusCode || 500;
    sendError(
      response,
      statusCode,
      error.message || "Unexpected server error.",
      process.env.NODE_ENV === "production" ? error.details : error.details || error.stack,
    );
  }
});

server.listen(port, () => {
  startCampaignScheduler(__dirname, { intervalMs: schedulerIntervalMs });
  console.log(`ASPI Content Pulse listening on http://localhost:${port}`);
});
