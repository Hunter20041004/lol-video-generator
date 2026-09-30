const crypto = require("crypto");
const { parseDateRange } = require("./dateRange");
const { fetchTierOneSchedule } = require("./scheduleFetcher");
const { scanEsportsCandidates } = require("./candidateScanner");
const { writeCandidateSnapshot } = require("./candidateStore");
const { classifyTierOneTournament } = require("./competitionRegistry");

function identity(entry) {
  return JSON.stringify([entry.date, entry.tournament, [entry.teamA || entry.teams?.[0], entry.teamB || entry.teams?.[1]].sort()]);
}

function complete(candidate) {
  return candidate.completeness?.hasTenPlayers === true && candidate.completeness?.hasFiveRoleMatchups === true
    && candidate.players?.length === 10 && candidate.roleMatchups?.length === 5
    && candidate.roleMatchups.every((value) => value.left && value.right);
}

function finalScoreMatches(candidate, schedule) {
  const score = String(candidate.score || candidate.seriesScore || "").split("-");
  if (candidate.teamA !== schedule.teamA) score.reverse();
  return /^\d+-\d+$/.test(schedule.seriesScore || "") && score.join("-") === schedule.seriesScore
    && (candidate.games === undefined || candidate.games === score.reduce((sum, value) => sum + Number(value), 0));
}

async function scanEsportsDateRange(options = {}, deps = {}) {
  const { startDate, endDate, dates } = parseDateRange(options.startDate, options.endDate);
  const now = new Date((deps.now || (() => new Date()))());
  const today = now.toISOString().slice(0, 10);
  const schedule = await (deps.fetchSchedule || fetchTierOneSchedule)({ startDate, endDate }, { now: () => now });
  const scans = [];
  for (const date of dates.filter((value) => value <= today)) {
    scans.push(await (deps.scanDate || scanEsportsCandidates)({ ...options, date }, { now: () => now }));
  }
  const scores = scans.flatMap((scan) => scan.candidates || []).filter((value) => dates.includes(value.date)
    && classifyTierOneTournament(value.tournament));
  const entries = schedule.map((entry) => {
    const matches = scores.filter((candidate) => identity(candidate) === identity(entry));
    if (matches.length !== 1) return { ...entry, canPreview: false };
    const candidate = matches[0];
    const canPreview = entry.status === "completed" && complete(candidate) && finalScoreMatches(candidate, entry);
    if (!canPreview) return { ...entry, canPreview: false };
    return { ...entry, ...candidate, dateUtc: entry.dateUtc, status: entry.status,
      seriesId: canPreview ? `${candidate.date}:${candidate.seriesId}` : entry.seriesId,
      seriesScore: canPreview ? candidate.score || candidate.seriesScore : entry.seriesScore,
      canPreview };
  });
  entries.sort((a, b) => String(a.dateUtc || a.date).localeCompare(String(b.dateUtc || b.date)) || String(a.seriesId).localeCompare(String(b.seriesId)));
  const candidates = entries.filter((entry) => entry.canPreview);
  const cached = scans.filter((scan) => scan.sourceStatus?.status === "cached");
  const createdAt = new Date(Math.min(now.getTime(), ...scans.map((scan) => Date.parse(scan.createdAt)))).toISOString();
  if (now.getTime() - Date.parse(createdAt) > 86400000 && candidates.some((candidate) => candidate.date >= today)) {
    throw Object.assign(new Error("今日賽事與超過一天的備援資料無法合成同一份預覽清單。"), { code: "ESPORTS_RANGE_CACHE_EXPIRED" });
  }
  const snapshot = {
    scanId: `scan-range-${startDate}-${endDate}-${crypto.randomUUID()}`,
    createdAt, date: candidates.at(-1)?.date || endDate, range: { startDate, endDate },
    activeMode: "range", tournamentScope: "configured", languages: options.languages || ["zh"],
    sourceStatus: { provider: "Leaguepedia", status: cached.length ? "cached" : entries.length ? "ready" : "empty",
      candidateCount: candidates.length, scheduleCount: entries.length,
      ...(cached.length ? { cacheReason: cached.some((scan) => scan.sourceStatus.cacheReason === "rate_limit") ? "rate_limit" : "fresh", cachedAt: createdAt } : {}) },
    entries, candidates,
  };
  return (deps.writeSnapshot || writeCandidateSnapshot)(snapshot);
}

module.exports = { scanEsportsDateRange };
