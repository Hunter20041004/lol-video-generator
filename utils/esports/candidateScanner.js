const crypto = require("crypto");
const { aggregateSeries } = require("./seriesAggregator");
const { fetchCompletedSeriesForDate } = require("./seriesFetcher");
const { writeCandidateSnapshot } = require("./candidateStore");

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

async function scanEsportsCandidates(options = {}, deps = {}) {
  if (options.useSample) {
    throw new Error("useSample is not supported for esports candidates.");
  }

  const now = deps.now || (() => new Date());
  const createdAt = (now() instanceof Date ? now() : new Date(now())).toISOString();
  const fetchSeriesCandidates = deps.fetchSeriesCandidates || fetchCompletedSeriesForDate;
  const rawCandidates = await fetchSeriesCandidates({
    date: options.date,
    activeMode: options.activeMode,
    tournamentScope: options.tournamentScope,
    languages: normalizeLanguages(options.languages),
  });
  const candidates = (Array.isArray(rawCandidates) ? rawCandidates : []).map(normalizeCandidate);
  const snapshot = {
    scanId: createScanId(options, createdAt),
    createdAt,
    date: options.date,
    activeMode: options.activeMode || "daily",
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

module.exports = {
  scanEsportsCandidates,
  normalizeCandidate,
  pickRecommendedMvp,
  averageRadarScore,
};
