const DEFAULT_TIMEOUT_MS = 30_000;
const MIN_TIMEOUT_MS = 1_000;
const MAX_TIMEOUT_MS = 60_000;

function normalizeModelTimeoutMs(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_TIMEOUT_MS;
  return Math.max(MIN_TIMEOUT_MS, Math.min(MAX_TIMEOUT_MS, Math.round(parsed)));
}

function createGoogleGenAI(options) {
  const { GoogleGenAI } = require("@google/genai");
  return new GoogleGenAI(options);
}

async function generateModelText({
  apiKey,
  model,
  prompt,
  timeoutMs,
  clientFactory = createGoogleGenAI,
}) {
  const client = clientFactory({ apiKey });
  const response = await client.models.generateContent({
    model,
    contents: prompt,
    config: {
      httpOptions: {
        timeout: normalizeModelTimeoutMs(timeoutMs),
      },
    },
  });
  return String(response.text || "");
}

module.exports = {
  generateModelText,
  normalizeModelTimeoutMs,
};
