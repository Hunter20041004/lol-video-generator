const test = require("node:test");
const assert = require("node:assert/strict");

function makeMatch(gameId, tournament, teamA, teamB, winTeam) {
  return {
    gameId,
    tournament,
    dateUtc: "2026-06-20T12:00:00Z",
    gamelengthStr: "31:00",
    winTeam,
    matchContext: { league: tournament.startsWith("LPL") ? "LPL" : "LCK", teamA, teamB, seriesScore: "Game 1" },
  };
}

function makePlayers(teamA, teamB) {
  return ["Top", "Jungle", "Mid", "Adc", "Support"].flatMap((role, index) => [
    { team: teamA, role, name: `${teamA} ${role}`, kills: 2 + index, deaths: 1, assists: 5, damageToChampions: 10000, gold: 9000, cs: 220, visionScore: 30 },
    { team: teamB, role, name: `${teamB} ${role}`, kills: 1 + index, deaths: 2, assists: 3, damageToChampions: 8000, gold: 8200, cs: 205, visionScore: 24 },
  ]);
}

test("fetchCompletedSeriesForDate queries active tournament filters and groups games into series candidates", async () => {
  const { fetchCompletedSeriesForDate } = require("../../../utils/esports/seriesFetcher");
  const tournaments = [];

  const candidates = await fetchCompletedSeriesForDate({
    date: "2026-06-20",
    activeMode: { mode: "regular", tournaments: ["LCK", "LPL"] },
  }, {
    fetchRecentMatches: async (hours, tournament) => {
      tournaments.push(tournament);
      if (tournament === "LCK") return [
        makeMatch("lck-g1", "LCK 2026 Summer", "T1", "GEN", "T1"),
        makeMatch("lck-g2", "LCK 2026 Summer", "T1", "GEN", "T1"),
      ];
      return [makeMatch("lpl-g1", "LPL 2026 Summer", "BLG", "TES", "BLG")];
    },
    fetchMatchPlayers: async (gameId) => {
      const isLpl = gameId.startsWith("lpl");
      const match = isLpl
        ? makeMatch(gameId, "LPL 2026 Summer", "BLG", "TES", "BLG")
        : makeMatch(gameId, "LCK 2026 Summer", "T1", "GEN", "T1");
      return { match, players: makePlayers(match.matchContext.teamA, match.matchContext.teamB) };
    },
    fetchMatchTeamStats: async () => [],
  });

  assert.deepEqual(tournaments, ["LCK", "LPL"]);
  assert.equal(candidates.length, 2);
  assert.equal(candidates.find((series) => series.league === "LCK").games.length, 2);
  assert.equal(candidates.find((series) => series.league === "LPL").games.length, 1);
});

test("fetchCompletedSeriesForDate stores ScoreboardTeams rows on their game", async () => {
  const { fetchCompletedSeriesForDate } = require("../../../utils/esports/seriesFetcher");

  const candidates = await fetchCompletedSeriesForDate({
    date: "2026-06-20",
    activeMode: { mode: "regular", tournaments: ["LCK"] },
  }, {
    fetchRecentMatches: async () => [makeMatch("lck-g1", "LCK 2026 Summer", "GEN", "HLE", "GEN")],
    fetchMatchPlayers: async () => ({
      match: makeMatch("lck-g1", "LCK 2026 Summer", "GEN", "HLE", "GEN"),
      players: makePlayers("GEN", "HLE"),
    }),
    fetchMatchTeamStats: async () => [
      { gameId: "lck-g1", team: "GEN", towers: 8, gold: 77031 },
      { gameId: "lck-g1", team: "HLE", towers: 4, gold: 68114 },
    ],
  });

  assert.deepEqual(candidates[0].games[0].teamFinalStats, [
    { gameId: "lck-g1", team: "GEN", towers: 8, gold: 77031 },
    { gameId: "lck-g1", team: "HLE", towers: 4, gold: 68114 },
  ]);
});

test("fetchCompletedSeriesForDate keeps reversed team order in one series", async () => {
  const { fetchCompletedSeriesForDate } = require("../../../utils/esports/seriesFetcher");

  const candidates = await fetchCompletedSeriesForDate({
    date: "2026-06-20",
    activeMode: { mode: "regular", tournaments: ["LCK"] },
  }, {
    fetchRecentMatches: async () => [
      makeMatch("lck-g1", "LCK 2026 Summer", "T1", "GEN", "T1"),
      makeMatch("lck-g2", "LCK 2026 Summer", "GEN", "T1", "GEN"),
    ],
    fetchMatchPlayers: async (gameId) => {
      const reversed = gameId === "lck-g2";
      const match = reversed
        ? makeMatch(gameId, "LCK 2026 Summer", "GEN", "T1", "GEN")
        : makeMatch(gameId, "LCK 2026 Summer", "T1", "GEN", "T1");
      return { match, players: makePlayers(match.matchContext.teamA, match.matchContext.teamB) };
    },
    fetchMatchTeamStats: async () => [],
  });

  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].games.length, 2);
});

test("fetchCompletedSeriesForDate filters other dates and skips games with missing detail", async () => {
  const { fetchCompletedSeriesForDate, seriesKey } = require("../../../utils/esports/seriesFetcher");

  const candidates = await fetchCompletedSeriesForDate({
    date: "2026-06-20",
    activeMode: { mode: "msi", tournaments: ["MSI"] },
  }, {
    fetchRecentMatches: async () => [
      { ...makeMatch("old-game", "MSI 2026", "T1", "BLG", "T1"), dateUtc: "2026-06-19T12:00:00Z" },
      makeMatch("missing-detail", "MSI 2026", "T1", "BLG", "T1"),
      makeMatch("ok-game", "MSI 2026", "T1", "BLG", "T1"),
    ],
    fetchMatchPlayers: async (gameId) => {
      if (gameId === "missing-detail") return null;
      const match = makeMatch(gameId, "MSI 2026", "T1", "BLG", "T1");
      return { match, players: makePlayers("T1", "BLG") };
    },
    fetchMatchTeamStats: async () => [],
  });

  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].games[0].gameId, "ok-game");
  assert.match(seriesKey({ tournament: "MSI 2026", date: "2026-06-20", teamA: "T1", teamB: "BLG" }), /MSI 2026/);
});

test("normalizeGame accepts raw Cargo-style field names", () => {
  const { normalizeGame, seriesKey } = require("../../../utils/esports/seriesFetcher");

  const game = normalizeGame({
    GameId: "cargo-game",
    DateTime_UTC: "2026-06-20T14:00:00Z",
    Tournament: "World Championship 2026",
    Team1: "G2",
    Team2: "T1",
    WinTeam: "T1",
    Gamelength: "29:45",
    players: [{ name: "player" }],
  });

  assert.equal(game.gameId, "cargo-game");
  assert.equal(game.teamA, "G2");
  assert.equal(game.winTeam, "T1");
  assert.equal(seriesKey({ MatchId: "match-1", Tournament: "Worlds", DateTime_UTC: "2026-06-20T00:00:00Z", Team1: "A", Team2: "B" }), "match-1::Worlds::2026-06-20::A::B");
});

test("fetchCompletedSeriesForDate handles empty tournament scope without fetching", async () => {
  const { fetchCompletedSeriesForDate, normalizeGame, seriesKey } = require("../../../utils/esports/seriesFetcher");
  let fetchCalls = 0;

  const candidates = await fetchCompletedSeriesForDate({}, {
    fetchRecentMatches: async () => {
      fetchCalls += 1;
      return [];
    },
    fetchMatchPlayers: async () => {
      throw new Error("no detail fetch expected");
    },
  });
  const game = normalizeGame({
    uniqueGame: "unique-1",
    date: "2026-06-20",
    league: "PCS",
    tournament: "PCS 2026 Summer",
    team1: "CFO",
    team2: "PSG",
    winTeam: "CFO",
    gamelengthMin: 32,
    players: "not-array",
  });

  assert.equal(fetchCalls, 0);
  assert.deepEqual(candidates, []);
  assert.equal(game.gameId, "unique-1");
  assert.equal(game.league, "PCS");
  assert.deepEqual(game.players, []);
  assert.equal(seriesKey({}), "");
});
