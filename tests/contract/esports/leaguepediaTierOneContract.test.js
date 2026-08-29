const assert = require("node:assert/strict");
const test = require("node:test");

const { loadProjectEnv } = require("../../../utils/envLoader");
const { fetchMatchesForDate, fetchMatchPlayers } = require("../../../utils/leaguepediaApi");
const { classifyTierOneTournament } = require("../../../utils/esports/competitionRegistry");
const { seriesKey } = require("../../../utils/esports/seriesFetcher");

// Calibrated against completed matches listed by the official LoL Esports schedule.
// Dates are UTC query dates and must be rechecked when the source calendar changes.
const CALIBRATIONS = [
  { competitionId: "LCK", tournament: "LCK", date: "2026-08-27" },
  { competitionId: "LPL", tournament: "LPL", date: "2026-08-16" },
  { competitionId: "LEC", tournament: "LEC", date: "2026-08-16" },
  { competitionId: "LCS", tournament: "LCS", date: "2026-08-16" },
  { competitionId: "CBLOL", tournament: "CBLOL", date: "2026-08-16" },
  { competitionId: "LCP", tournament: "LCP", date: "2026-08-21" },
  { competitionId: "FIRST_STAND", tournament: "First Stand", date: "2026-03-16" },
  { competitionId: "MSI", tournament: "MSI", date: "2026-07-05" },
];

function isCompleteGameDetail(detail) {
  const players = Array.isArray(detail?.players) ? detail.players : [];
  const roles = new Set(players.map(({ role }) => String(role || "").toLowerCase()));
  return players.length === 10
    && ["top", "jungle", "mid", "adc", "support"].every((role) => roles.has(role));
}

test("Leaguepedia exposes one complete 2026 series for every supported completed competition", async (t) => {
  if (process.env.RUN_EXTERNAL_CONTRACTS !== "1") {
    return t.skip("Set RUN_EXTERNAL_CONTRACTS=1 to verify live tier-one Leaguepedia series.");
  }
  loadProjectEnv();

  for (const calibration of CALIBRATIONS) {
    await t.test(`${calibration.competitionId} ${calibration.date}`, async () => {
      const matches = (await fetchMatchesForDate(calibration.date, calibration.tournament))
        .filter((match) => classifyTierOneTournament(match.tournament)?.id === calibration.competitionId);
      assert.ok(matches.length > 0, `No ${calibration.competitionId} games on ${calibration.date}.`);
      const groups = new Map();
      for (const match of matches) {
        const key = seriesKey(match);
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(match);
      }
      const series = [...groups.values()].find((games) => games.every(({ winTeam, gamelengthStr }) => winTeam && gamelengthStr));
      assert.ok(series?.length > 0, `No completed ${calibration.competitionId} series on ${calibration.date}.`);
      const detail = await fetchMatchPlayers(series[0].gameId);
      assert.ok(isCompleteGameDetail(detail), `Representative ${calibration.competitionId} game lacks ten players or five roles.`);
    });
  }
});

test("Worlds 2026 roster coverage remains pending as of 2026-08-28", (t) => {
  t.skip("Worlds 2026 begins after the 2026-08-28 inventory cutoff; no roster coverage claim is made.");
});

module.exports = { CALIBRATIONS, isCompleteGameDetail };
