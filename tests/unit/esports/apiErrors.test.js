const test = require("node:test");
const assert = require("node:assert/strict");
const { performance } = require("node:perf_hooks");

test("Leaguepedia rate-limit detection stays fast on repeated untrusted prefixes", () => {
  const { isLeaguepediaRateLimit } = require("../../../utils/esports/apiErrors");
  const adversarialMessage = "Leaguepedia API returned error:".repeat(3000);
  const startedAt = performance.now();

  assert.equal(isLeaguepediaRateLimit(adversarialMessage), false);
  assert.ok(performance.now() - startedAt < 50, "rate-limit detection should finish within 50ms");
});

test("formatEsportsApiError turns Leaguepedia rate limits into actionable UI errors", () => {
  const { formatEsportsApiError } = require("../../../utils/esports/apiErrors");

  const result = formatEsportsApiError(new Error("Leaguepedia API returned error: You've exceeded your rate limit. Please wait some time and try again."), {
    fallbackMessage: "Esports daily pipeline failed.",
  });

  assert.equal(result.success, false);
  assert.equal(result.code, "LEAGUEPEDIA_RATE_LIMITED");
  assert.equal(result.status, 429);
  assert.equal(result.recoverable, true);
  assert.match(result.userMessage, /Leaguepedia 資料源目前限流/);
  assert.equal(result.retryAfterSeconds, 900);
  assert.match(result.recoverySuggestion, /約 15 分鐘/);
  assert.match(result.error, /exceeded your rate limit/);
});

test("formatEsportsApiError preserves Leaguepedia cooldown retry metadata", () => {
  const { formatEsportsApiError } = require("../../../utils/esports/apiErrors");

  const error = new Error("Leaguepedia API cooldown active until 2026-07-07T19:15:00.000Z");
  error.code = "LEAGUEPEDIA_RATE_LIMITED";
  error.status = 429;
  error.recoverable = true;
  error.cooldownUntil = "2026-07-07T19:15:00.000Z";
  error.retryAfterSeconds = 600;

  const result = formatEsportsApiError(error, {
    fallbackMessage: "候選賽事掃描失敗。",
  });

  assert.equal(result.success, false);
  assert.equal(result.code, "LEAGUEPEDIA_RATE_LIMITED");
  assert.equal(result.status, 429);
  assert.equal(result.recoverable, true);
  assert.equal(result.cooldownUntil, "2026-07-07T19:15:00.000Z");
  assert.equal(result.retryAfterSeconds, 600);
  assert.match(result.recoverySuggestion, /約 10 分鐘/);
});

test("formatEsportsApiError surfaces Leaguepedia bot auth failures as credential errors", () => {
  const { formatEsportsApiError } = require("../../../utils/esports/apiErrors");

  const error = new Error("Fandom bot authentication failed: The supplied credentials could not be authenticated.");
  error.code = "LEAGUEPEDIA_AUTH_FAILED";
  error.status = 401;

  const result = formatEsportsApiError(error, {
    fallbackMessage: "候選賽事掃描失敗。",
  });

  assert.equal(result.success, false);
  assert.equal(result.code, "LEAGUEPEDIA_AUTH_FAILED");
  assert.equal(result.status, 401);
  assert.equal(result.recoverable, false);
  assert.match(result.userMessage, /Bot 登入失敗/);
  assert.match(result.recoverySuggestion, /FANDOM_BOT_USERNAME/);
  assert.match(result.error, /supplied credentials/);
});

test("formatEsportsApiError preserves unknown errors as server failures", () => {
  const { formatEsportsApiError } = require("../../../utils/esports/apiErrors");

  const result = formatEsportsApiError(new Error("renderer exploded"), {
    fallbackMessage: "Player radar failed.",
  });

  assert.equal(result.success, false);
  assert.equal(result.code, "ESPORTS_PIPELINE_ERROR");
  assert.equal(result.status, 500);
  assert.equal(result.recoverable, false);
  assert.equal(result.userMessage, "Player radar failed.");
  assert.equal(result.error, "renderer exploded");
});

test("formatEsportsApiError preserves a safe structured esports asset gap", () => {
  const { formatEsportsApiError } = require("../../../utils/esports/apiErrors");
  const error = Object.assign(new Error("Required esports assets missing (3)."), {
    code: "ESPORTS_ASSETS_MISSING",
    missing: [
      { kind: "portrait", publicName: "Taeyoon", team: "BNK FEARX" },
      { kind: "teamA", team: "BNK FEARX" },
      { kind: "teamB", team: "Nongshim RedForce" },
    ],
  });

  const result = formatEsportsApiError(error);

  assert.equal(result.code, "ESPORTS_ASSETS_MISSING");
  assert.equal(result.status, 422);
  assert.equal(result.recoverable, false);
  assert.match(result.userMessage, /3 項正式素材/);
  assert.deepEqual(result.missing, error.missing);
  assert.doesNotMatch(JSON.stringify(result), /Users\//);
});
