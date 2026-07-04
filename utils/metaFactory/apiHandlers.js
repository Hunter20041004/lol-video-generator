const crypto = require("crypto");
const { fetchLolalyticsRows: defaultFetchLolalyticsRows } = require("./sourceAdapters/lolalyticsAdapter");
const { verifyCandidate: defaultVerifyCandidate } = require("./sourceAdapters/opggVerifier");
const { candidateKey, scoreOffmetaCandidates, scoreTierRanking } = require("./scoring");
const { writeMetaSnapshot, readMetaSnapshot } = require("./snapshotStore");
const { buildMetaRenderPayload } = require("./candidatePlanner");
const { createPublishJobs: defaultCreatePublishJobs } = require("../publishing");
const { renderVideosFromRequest: defaultRenderVideosFromRequest } = require("../render/renderService");

const META_RENDER_PLATFORMS = ["instagram", "threads"];

function normalizeRenderLanguages(body = {}) {
  const requested = Array.isArray(body.renderLanguages)
    ? body.renderLanguages
    : Array.isArray(body.languages)
      ? body.languages
      : ["zh", "en"];
  const normalized = requested
    .filter(Boolean)
    .map((locale) => String(locale).toLowerCase().startsWith("en") ? "en" : "zh");
  return Array.from(new Set(normalized)).slice(0, 2);
}

function normalizePosition(value = "Mid") {
  const key = String(value || "Mid").toLowerCase();
  if (key === "jungle") return "Jungle";
  if (key === "top") return "Top";
  if (key === "adc" || key === "bottom" || key === "bot") return "ADC";
  if (key === "support") return "Support";
  return "Mid";
}

function normalizeExcludedChampions(value = []) {
  const values = Array.isArray(value) ? value : [];
  return Array.from(new Set(
    values.map((champion) => String(champion || "").trim()).filter(Boolean)
  )).sort((a, b) => a.localeCompare(b));
}

function normalizeScanFilters(body = {}, position = normalizePosition(body.position)) {
  return {
    region: body.region || "global",
    queue: body.queue || "ranked_solo_duo",
    position,
    rankPreset: body.rankPreset || "emerald_plus",
    excludedChampions: normalizeExcludedChampions(body.excludedChampions),
  };
}

function createSnapshotId({ patch = "unknown", filters = {} }, createdAt) {
  const seed = JSON.stringify({ patch, createdAt, filters });
  const hash = crypto.createHash("sha1").update(seed).digest("hex").slice(0, 10);
  return `meta-${patch}-${hash}`;
}

async function buildVerificationMap(rows, verifyCandidate) {
  const entries = [];
  for (const row of rows) {
    entries.push([candidateKey(row), await verifyCandidate(row)]);
  }
  return Object.fromEntries(entries);
}

function summarizeVerifierStatus(verificationByKey = {}) {
  const checks = Object.values(verificationByKey);
  const unavailableRows = checks.filter((entry) => entry?.status === "unavailable").length;
  const mismatchRows = checks.filter((entry) => entry?.status === "mismatch").length;
  const status = checks.length > 0 && unavailableRows === checks.length
    ? "unavailable"
    : unavailableRows > 0 || mismatchRows > 0
      ? "degraded"
      : "checked";
  return {
    provider: "OP.GG",
    status,
    checkedRows: checks.length,
    unavailableRows,
    mismatchRows,
  };
}

async function handleMetaScanRequest(body = {}, deps = {}) {
  if (body.useSample) throw new Error("useSample is not supported for meta factory scans.");
  const now = deps.now || (() => new Date());
  const createdAtValue = now();
  const createdAt = (createdAtValue instanceof Date ? createdAtValue : new Date(createdAtValue)).toISOString();
  const position = normalizePosition(body.position);
  const filters = normalizeScanFilters(body, position);
  const fetchLolalyticsRows = deps.fetchLolalyticsRows || defaultFetchLolalyticsRows;
  const verifyCandidate = deps.verifyCandidate || defaultVerifyCandidate;
  const source = await fetchLolalyticsRows({
    patch: body.patch,
    region: filters.region,
    position: filters.position,
    rankPreset: filters.rankPreset,
  });
  const verificationByKey = await buildVerificationMap(source.rows || [], verifyCandidate);
  const offmeta = scoreOffmetaCandidates(source.rows || [], verificationByKey);
  const tierRanking = scoreTierRanking(source.rows || [], verificationByKey, {
    role: filters.position,
    excludedChampions: filters.excludedChampions,
  });
  const snapshot = writeMetaSnapshot({
    snapshotId: createSnapshotId({ patch: body.patch, filters }, createdAt),
    createdAt,
    patch: body.patch || "",
    filters,
    sourceStatus: {
      primary: source.sourceStatus,
      verifier: summarizeVerifierStatus(verificationByKey),
    },
    candidates: {
      offmeta,
      tierRankings: [tierRanking],
    },
  });
  return { success: true, ...snapshot };
}

function handleMetaSnapshotRequest(snapshotId, options = {}) {
  return { success: true, ...readMetaSnapshot(snapshotId, options) };
}

function isTierMode(mode) {
  return String(mode || "").toLowerCase() === "tier";
}

function candidateRankScore(candidate = {}) {
  if (Number.isFinite(Number(candidate.score))) return Number(candidate.score);
  const topEntryScore = candidate.entries?.[0]?.tierScore;
  return Number.isFinite(Number(topEntryScore)) ? Number(topEntryScore) : 0;
}

function tierRankingHasEntries(candidate = {}) {
  return candidate.kind !== "META_TIER_RANKING" || (Array.isArray(candidate.entries) && candidate.entries.length > 0);
}

function hasOffmetaBuildDetails(candidate = {}) {
  return (Array.isArray(candidate.coreItems) && candidate.coreItems.length > 0) ||
    (Array.isArray(candidate.coreRunes) && candidate.coreRunes.length > 0);
}

function assertRenderableMetaCandidate(candidate = {}) {
  if (candidate.hardBlock?.blocked) {
    throw new Error(`Meta candidate is hard-blocked: ${(candidate.hardBlock.reasons || []).join("; ")}`);
  }
  if (!tierRankingHasEntries(candidate)) {
    throw new Error("Meta candidate is hard-blocked: Tier ranking has no entries.");
  }
  if (candidate.kind === "META_OFFMETA_PICK" && candidate.offmetaType === "OFFMETA_BUILD" && !hasOffmetaBuildDetails(candidate)) {
    throw new Error("Meta candidate is hard-blocked: 缺少核心裝備/符文，不能生成黑科技影片。");
  }
}

function selectMetaCandidate(snapshot = {}, options = {}) {
  const pool = isTierMode(options.mode)
    ? snapshot.candidates?.tierRankings || []
    : snapshot.candidates?.offmeta || [];
  const candidateId = String(options.candidateId || "").trim();
  const candidate = options.useTopCandidate
    ? [...pool]
      .filter((item) => !item.hardBlock?.blocked && tierRankingHasEntries(item))
      .sort((a, b) => candidateRankScore(b) - candidateRankScore(a))[0]
    : pool.find((item) => (
      item.candidateId === candidateId ||
      (item.kind === "META_TIER_RANKING" && item.role === candidateId)
    ));

  if (!candidate) throw new Error(`Meta candidate not found: ${candidateId || "TOP"}`);
  assertRenderableMetaCandidate(candidate);
  return candidate;
}

async function handleMetaRenderRequest(body = {}, deps = {}) {
  const snapshot = readMetaSnapshot(body.snapshotId, {
    now: deps.now,
    maxAgeMs: deps.maxAgeMs,
  });
  const candidate = selectMetaCandidate(snapshot, body);
  const renderVideosFromRequest = deps.renderVideosFromRequest || defaultRenderVideosFromRequest;
  const createPublishJobs = deps.createPublishJobs || defaultCreatePublishJobs;
  const videos = [];
  const payloads = [];
  const renderLanguages = normalizeRenderLanguages(body);

  for (const locale of renderLanguages.length > 0 ? renderLanguages : ["zh", "en"]) {
    const payload = buildMetaRenderPayload(candidate, locale);
    payloads.push(payload);
    const render = await renderVideosFromRequest({
      ...payload,
      renderLanguages: [locale],
    });
    const video = Array.isArray(render.videos) ? render.videos[0] : {
      locale,
      videoUrl: render.videoUrl,
      fileName: render.fileName,
    };
    videos.push({
      ...video,
      type: isTierMode(body.mode) ? "meta-tier-ranking" : "meta-offmeta-pick",
      locale,
    });
  }

  let publish;
  try {
    publish = await createPublishJobs({
      videos,
      platforms: META_RENDER_PLATFORMS,
      action: "queue",
      analysis: payloads[0],
      scheduledAt: body.scheduledAt,
    });
  } catch (error) {
    const message = error?.message || String(error);
    publish = {
      success: false,
      error: message,
      message,
      platforms: META_RENDER_PLATFORMS,
    };
  }

  return {
    success: true,
    snapshotId: snapshot.snapshotId,
    candidate,
    payloads,
    videos,
    publish,
  };
}

module.exports = {
  handleMetaScanRequest,
  handleMetaSnapshotRequest,
  handleMetaRenderRequest,
  normalizePosition,
};
