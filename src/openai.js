const responsesEndpoint = "https://api.openai.com/v1/responses";
const transcriptionEndpoint = "https://api.openai.com/v1/audio/transcriptions";
const defaultOpenAITimeoutMs = 60_000;
const defaultMediaDownloadTimeoutMs = 45_000;

export function isOpenAIConfigured() {
  return Boolean(process.env.OPENAI_API_KEY);
}

function getHeaders(extra = {}) {
  return {
    Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    ...extra,
  };
}

function getModel() {
  return process.env.OPENAI_MODEL || "gpt-5-mini";
}

function getTranscriptionModel() {
  return process.env.OPENAI_TRANSCRIPTION_MODEL || "gpt-4o-mini-transcribe";
}

function getTimeoutMs(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

async function fetchWithTimeout(url, options = {}, timeoutMs = defaultOpenAITimeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error(`Request timed out after ${timeoutMs}ms.`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function compactErrorText(text, limit = 1200) {
  if (!text || text.length <= limit) {
    return text;
  }

  return `${text.slice(0, limit)}...`;
}

function extractOutputText(payload) {
  if (typeof payload?.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text.trim();
  }

  const segments = [];
  for (const item of payload?.output || []) {
    for (const content of item?.content || []) {
      if (typeof content?.text === "string" && content.text.trim()) {
        segments.push(content.text.trim());
      }
    }
  }

  return segments.join("\n").trim();
}

function stripCodeFences(text) {
  return text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
}

export async function createTextResponse({ system, user, model }) {
  if (!isOpenAIConfigured()) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const input = [];
  if (system) {
    input.push({
      role: "system",
      content: [{ type: "input_text", text: system }],
    });
  }

  input.push({
    role: "user",
    content: [{ type: "input_text", text: user }],
  });

  const response = await fetchWithTimeout(
    responsesEndpoint,
    {
      method: "POST",
      headers: getHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        model: model || getModel(),
        input,
      }),
    },
    getTimeoutMs("OPENAI_TIMEOUT_MS", defaultOpenAITimeoutMs),
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI response failed (${response.status}): ${compactErrorText(errorText)}`);
  }

  const payload = await response.json();
  return extractOutputText(payload);
}

export async function createJsonResponse({ system, user, model }) {
  const text = await createTextResponse({
    system,
    model,
    user: `${user}\n\nReturn valid JSON only. Do not include markdown fences or commentary.`,
  });

  try {
    return JSON.parse(stripCodeFences(text));
  } catch (error) {
    throw new Error(`OpenAI returned invalid JSON: ${compactErrorText(text, 600)} (${error.message})`);
  }
}

function extensionForContentType(contentType) {
  if (contentType.includes("mpeg") || contentType.includes("mp3")) {
    return ".mp3";
  }
  if (contentType.includes("wav")) {
    return ".wav";
  }
  if (contentType.includes("mp4")) {
    return ".mp4";
  }
  if (contentType.includes("webm")) {
    return ".webm";
  }
  return ".bin";
}

export async function transcribeFromUrl(mediaUrl) {
  if (!isOpenAIConfigured()) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const mediaResponse = await fetchWithTimeout(
    mediaUrl,
    {},
    getTimeoutMs("OPENAI_TRANSCRIPTION_DOWNLOAD_TIMEOUT_MS", defaultMediaDownloadTimeoutMs),
  );
  if (!mediaResponse.ok) {
    throw new Error(`Could not download media for transcription (${mediaResponse.status}).`);
  }

  const mediaBlob = await mediaResponse.blob();
  const contentType = mediaResponse.headers.get("content-type") || mediaBlob.type || "application/octet-stream";
  const filename = `transcription-input${extensionForContentType(contentType)}`;

  const formData = new FormData();
  formData.append("model", getTranscriptionModel());
  formData.append("file", new File([mediaBlob], filename, { type: contentType }));

  const response = await fetchWithTimeout(
    transcriptionEndpoint,
    {
      method: "POST",
      headers: getHeaders(),
      body: formData,
    },
    getTimeoutMs("OPENAI_TRANSCRIPTION_TIMEOUT_MS", defaultOpenAITimeoutMs),
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI transcription failed (${response.status}): ${compactErrorText(errorText)}`);
  }

  const payload = await response.json();
  return payload?.text?.trim() || null;
}
