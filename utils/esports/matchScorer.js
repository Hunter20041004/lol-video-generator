const { mergeEsportsConfig, normalizeMode } = require("./config");

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function byScoreDesc(a, b) {
  return number(b.score) - number(a.score);
}

function scoreSeries(series = {}, configInput = {}) {
  const config = mergeEsportsConfig(configInput);
  const weights = config.scoringWeights;
  const importance = number(series.importanceScore ?? series.importance);
  const traffic = number(series.trafficScore ?? series.traffic);
  const anomaly = number(series.anomalyScore ?? series.anomaly);
  const teamBonus = (series.teams || [])
    .reduce((sum, team) => sum + number(config.hotTeams?.[team]), 0);
  const playerBonus = (series.players || [])
    .reduce((sum, player) => sum + number(config.hotPlayers?.[player.name || player.playerName]), 0);

  return Math.round((
    importance * weights.importance +
    traffic * weights.traffic +
    anomaly * weights.anomaly +
    teamBonus +
    playerBonus
  ) * 100) / 100;
}

function ensureScores(candidates = [], config = {}) {
  return candidates.map((candidate) => ({
    ...candidate,
    score: Number.isFinite(Number(candidate.score)) ? Number(candidate.score) : scoreSeries(candidate, config),
  }));
}

function selectRegularSeries(scoredCandidates, config) {
  const globalTop = [...scoredCandidates].sort(byScoreDesc).slice(0, config.maxDailySeries);
  if (globalTop.length === config.maxDailySeries && globalTop.length > 1) {
    const selectedLeagues = new Set(globalTop.map((candidate) => candidate.league));
    if (selectedLeagues.size === 1) {
      const otherBest = scoredCandidates
        .filter((candidate) => candidate.league !== globalTop[0].league)
        .sort(byScoreDesc)[0];
      const clearsOverride = otherBest && number(globalTop[1].score) - number(otherBest.score) >= number(config.regularOverrideThreshold, 15);
      if (clearsOverride) return globalTop;
    }
  }

  const selected = [];
  const leagues = Array.isArray(config.regularLeagues) && config.regularLeagues.length > 0
    ? config.regularLeagues
    : ["LCK", "LPL"];

  for (const league of leagues) {
    const best = scoredCandidates
      .filter((candidate) => candidate.league === league)
      .sort(byScoreDesc)[0];
    if (best) selected.push(best);
  }

  if (selected.length < config.maxDailySeries) {
    for (const candidate of scoredCandidates.sort(byScoreDesc)) {
      if (selected.length >= config.maxDailySeries) break;
      if (!selected.some((item) => item.seriesId === candidate.seriesId)) selected.push(candidate);
    }
  }

  return selected.slice(0, config.maxDailySeries);
}

function selectDailySeries(candidates = [], configInput = {}) {
  const config = mergeEsportsConfig(configInput);
  const mode = normalizeMode(config.activeMode || "regular");
  const maxDailySeries = Math.max(1, Math.min(2, number(config.maxDailySeries, 2)));
  const scoredCandidates = ensureScores(candidates, config).sort(byScoreDesc);
  const scoped = mode === "regular"
    ? scoredCandidates.filter((candidate) => ["LCK", "LPL"].includes(candidate.league))
    : scoredCandidates.filter((candidate) => candidate.league === (mode === "msi" ? "MSI" : "Worlds"));

  return mode === "regular"
    ? selectRegularSeries(scoped, { ...config, maxDailySeries })
    : scoped.slice(0, maxDailySeries);
}

module.exports = {
  scoreSeries,
  selectDailySeries,
};
