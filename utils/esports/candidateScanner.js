const crypto = require("crypto");
const { aggregateSeries } = require("./seriesAggregator");
const { fetchCompletedSeriesForDate } = require("./seriesFetcher");
const { writeCandidateSnapshot, findLatestCompatibleSnapshot, isHistoricalDate, FALLBACK_MAX_AGE_MS } = require("./candidateStore");
const { resolveActiveMode } = require("./config");

function normalizeLanguages(languages = ["zh", "en"]) {
  const values = Array.isArray(languages) && languages.length > 0 ? languages : ["zh", "en"];
  return [...new Set(values.map((language) => String(language || "zh").toLowerCase().startsWith("en") ? "en" : "zh"))];
}

function averageRadarScore(player = {}) {
  const stats = Array.isArray(player.radarStats) ? player.radarStats : [];
  if (stats.length === 0) return 0;
  return stats.reduce((sum, stat) => sum + Number(stat.normalizedScore || 0), 0) / stats.length;
}

function pickRecommendedMvp(players = []) {
  const player = [...players].sort((a, b) => averageRadarScore(b) - averageRadarScore(a))[0];
  if (!player) return null;
  return {
    name: player.name,
    team: player.team,
    role: player.role,
    score: Number(averageRadarScore(player).toFixed(2)),
  };
}

function isAggregatedSeries(candidate = {}) {
  return Array.isArray(candidate.players) && Array.isArray(candidate.roleMatchups);
}

function normalizeCandidate(candidate = {}) {
  const series = isAggregatedSeries(candidate)
    ? candidate
    : aggregateSeries(candidate.games || []);
  const completeness = {
    hasTenPlayers: series.completeness?.hasTenPlayers ?? series.players?.length === 10,
    hasFiveRoleMatchups: series.completeness?.hasFiveRoleMatchups ?? series.roleMatchups?.every((matchup) => matchup.left && matchup.right),
    missingRoles: series.completeness?.missingRoles || [],
  };

  return {
    ...series,
    completeness,
    recommendedMvp: pickRecommendedMvp(series.players || []),
  };
}

function createScanId({ date, activeMode }, createdAt) {
  const hash = crypto
    .createHash("sha1")
    .update(`${date || ""}:${activeMode || ""}:${createdAt}`)
    .digest("hex")
    .slice(0, 10);
  return `scan-${date || "unknown"}-${hash}`;
}

function resolveScanTime(date, now) {
  if (date) return new Date(`${String(date).slice(0, 10)}T15:30:00.000Z`);
  const value = now();
  return value instanceof Date ? value : new Date(value);
}

async function scanEsportsCandidates(options = {}, deps = {}) {
  if (options.useSample) {
    throw new Error("useSample is not supported for esports candidates.");
  }

  const timestamp = new Date((deps.now || (() => new Date()))());
  const now = () => timestamp;
  const createdAt = timestamp.toISOString();
  const fetchSeriesCandidates = deps.fetchSeriesCandidates || fetchCompletedSeriesForDate;
  const activeMode = resolveActiveMode({
    ...(options.config || {}),
    activeMode: options.activeMode || "auto",
  }, resolveScanTime(options.date, now));
  const criteria = {
    date: options.date,
    activeMode: activeMode.mode,
    activeModeDetails: activeMode,
    tournamentScope: options.tournamentScope || "configured",
    languages: normalizeLanguages(options.languages),
  };
  const historical = isHistoricalDate(options.date, now);
  const cached = historical && findLatestCompatibleSnapshot(criteria, { now });
  if (cached) return cachedResponse(cached, "fresh");
  let rawCandidates;
  try {
    rawCandidates = await fetchSeriesCandidates({
      date: options.date,
      activeMode,
      tournamentScope: options.tournamentScope,
      languages: criteria.languages,
    });
  } catch (error) {
    if (historical && error.code === "LEAGUEPEDIA_RATE_LIMITED") {
      const fallback = findLatestCompatibleSnapshot(criteria, { now, maxAgeMs: FALLBACK_MAX_AGE_MS });
      // Record fallback eligibility for preview without resetting the source timestamp.
      if (fallback) return writeCandidateSnapshot(cachedResponse(fallback, "rate_limit"));
    }
    throw error;
  }
  const candidates = (Array.isArray(rawCandidates) ? rawCandidates : []).map(normalizeCandidate);
  const snapshot = {
    scanId: createScanId(options, createdAt),
    createdAt,
    date: options.date,
    activeMode: activeMode.mode,
    activeModeDetails: activeMode,
    languages: normalizeLanguages(options.languages),
    tournamentScope: options.tournamentScope || "configured",
    sourceStatus: {
      provider: "Leaguepedia",
      status: candidates.length > 0 ? "ready" : "empty",
      candidateCount: candidates.length,
    },
    candidates,
  };

  writeCandidateSnapshot(snapshot);
  return snapshot;
}

function cachedResponse(snapshot, cacheReason) {
  return {
    ...snapshot,
    sourceStatus: { ...snapshot.sourceStatus, status: "cached", cacheReason, cachedAt: snapshot.createdAt },
  };
}

module.exports = {
  scanEsportsCandidates,
  normalizeCandidate,
  pickRecommendedMvp,
  averageRadarScore,
};
