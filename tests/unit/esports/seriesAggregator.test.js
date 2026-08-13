const test = require("node:test");
const assert = require("node:assert/strict");

const ROLES = ["Top", "Jungle", "Mid", "Adc", "Support"];

function player(team, role, name, stats) {
  return { team, role, name, ...stats };
}

function makeGame({ gameId, durationSeconds, blueMid, blueKills, redKills }) {
  return {
    gameId,
    seriesId: "lck-t1-gen-2026-06-20",
    date: "2026-06-20",
    league: "LCK",
    tournament: "LCK 2026 Summer",
    teamA: "T1",
    teamB: "GEN",
    winTeam: "T1",
    durationSeconds,
    players: [
      player("T1", "Top", "Blue Top", { kills: blueKills[0], deaths: 1, assists: 4, damageToChampions: 12000, gold: 11000, cs: 240, visionScore: 30 }),
      player("T1", "Jungle", "Blue Jungle", { kills: blueKills[1], deaths: 2, assists: 8, damageToChampions: 14000, gold: 10500, cs: 180, visionScore: 44 }),
      player("T1", "Mid", "Blue Mid", blueMid),
      player("T1", "Adc", "Blue ADC", { kills: blueKills[3], deaths: 1, assists: 5, damageToChampions: 21000, gold: 14500, cs: 310, visionScore: 24 }),
      player("T1", "Support", "Blue Support", { kills: blueKills[4], deaths: 3, assists: 12, damageToChampions: 6000, gold: 7200, cs: 40, visionScore: 72 }),
      player("GEN", "Top", "Red Top", { kills: redKills[0], deaths: 2, assists: 3, damageToChampions: 10000, gold: 10100, cs: 235, visionScore: 24 }),
      player("GEN", "Jungle", "Red Jungle", { kills: redKills[1], deaths: 3, assists: 4, damageToChampions: 9000, gold: 9500, cs: 170, visionScore: 36 }),
      player("GEN", "Mid", "Red Mid", { kills: redKills[2], deaths: 4, assists: 3, damageToChampions: 16000, gold: 11800, cs: 280, visionScore: 28 }),
      player("GEN", "Adc", "Red ADC", { kills: redKills[3], deaths: 3, assists: 4, damageToChampions: 18000, gold: 13200, cs: 300, visionScore: 20 }),
      player("GEN", "Support", "Red Support", { kills: redKills[4], deaths: 4, assists: 6, damageToChampions: 5000, gold: 6500, cs: 36, visionScore: 60 }),
    ],
  };
}

function makeTwoGameSeries() {
  return [
    makeGame({
      gameId: "game-1",
      durationSeconds: 1800,
      blueKills: [2, 3, 4, 5, 0],
      redKills: [1, 2, 3, 4, 0],
      blueMid: { kills: 4, deaths: 1, assists: 4, damageToChampions: 18000, gold: 12000, cs: 270, visionScore: 30 },
    }),
    makeGame({
      gameId: "game-2",
      durationSeconds: 2400,
      blueKills: [1, 2, 3, 4, 0],
      redKills: [1, 1, 2, 3, 0],
      blueMid: { kills: 3, deaths: 2, assists: 4, damageToChampions: 24000, gold: 16000, cs: 360, visionScore: 40 },
    }),
  ];
}

test("aggregateSeries computes BO3 player KDA, per-minute stats, weighted KP, and five role matchups", () => {
  const { aggregateSeries } = require("../../../utils/esports/seriesAggregator");

  const series = aggregateSeries(makeTwoGameSeries());
  const mid = series.players.find((seriesPlayer) => seriesPlayer.name === "Blue Mid");

  assert.equal(series.seriesId, "lck-t1-gen-2026-06-20");
  assert.equal(series.score, "2-0");
  assert.equal(series.teamStats.T1.kills, 24);
  assert.equal(mid.rawStats.kills, 7);
  assert.equal(mid.rawStats.kda, 5);
  assert.equal(mid.rawStats.dpm, 600);
  assert.equal(mid.rawStats.gpm, 400);
  assert.equal(mid.rawStats.csm, 9);
  assert.equal(mid.rawStats.vpm, 1);
  assert.equal(mid.rawStats.kp, 0.63);
  assert.deepEqual(series.roleMatchups.map((matchup) => matchup.role), ROLES);
  assert.equal(series.completeness.hasTenPlayers, true);
  assert.equal(series.completeness.hasFiveRoleMatchups, true);
});

test("aggregateSeries preserves numbered per-game team-final evidence", () => {
  const { aggregateSeries } = require("../../../utils/esports/seriesAggregator");
  const games = makeTwoGameSeries();
  games[0].teamFinalStats = [
    { gameId: "game-1", team: "T1", towers: 8, snapshotType: "team-final" },
    { gameId: "game-1", team: "GEN", towers: 4, snapshotType: "team-final" },
  ];

  const series = aggregateSeries(games);

  assert.equal(series.gameTeamStats.length, 2);
  assert.equal(series.gameTeamStats[0].gameNumber, 1);
  assert.equal(series.gameTeamStats[0].gameId, "game-1");
  assert.equal(series.gameTeamStats[0].teams[0].snapshotType, "team-final");
  assert.equal(series.gameTeamStats[0].hasEventTimestamps, false);
  assert.deepEqual(series.gameTeamStats[1].teams, []);
});

test("aggregateSeries rejects empty input and normalizes role aliases", () => {
  const { aggregateSeries, normalizeRole } = require("../../../utils/esports/seriesAggregator");

  assert.throws(() => aggregateSeries([]), /at least one game/);
  assert.equal(normalizeRole("jg"), "Jungle");
  assert.equal(normalizeRole("Bottom"), "Adc");
  assert.equal(normalizeRole("unknown-role"), "unknown-role");
});

test("aggregateSeries marks incomplete role matchups when players are missing", () => {
  const { aggregateSeries } = require("../../../utils/esports/seriesAggregator");
  const game = makeTwoGameSeries()[0];
  const series = aggregateSeries([{
    ...game,
    durationSeconds: undefined,
    gamelengthStr: "31:30",
    players: game.players.filter((playerEntry) => playerEntry.role !== "Support"),
  }]);

  assert.equal(series.completeness.hasTenPlayers, false);
  assert.equal(series.completeness.hasFiveRoleMatchups, false);
  assert.deepEqual(series.completeness.missingRoles, ["Support"]);
});

test("aggregateSeries marks per-minute stats unavailable when any contributing game lacks duration", () => {
  const { aggregateSeries } = require("../../../utils/esports/seriesAggregator");
  const games = makeTwoGameSeries();
  delete games[1].durationSeconds;
  delete games[1].durationMinutes;
  delete games[1].gamelengthMin;
  delete games[1].gamelengthStr;

  const series = aggregateSeries(games);
  const mid = series.players.find((seriesPlayer) => seriesPlayer.name === "Blue Mid");

  assert.equal(mid.rawStats.damageToChampions, 42000);
  assert.equal(mid.rawStats.dpm, null);
  assert.equal(mid.rawStats.gpm, null);
  assert.equal(mid.rawStats.csm, null);
  assert.equal(mid.rawStats.vpm, null);
  assert.equal(mid.radarStats.some((stat) => ["DPM", "GPM", "CSM"].includes(stat.label)), false);
});

test("aggregateSeries accepts matchContext teams, nested stats, and zero-duration fallbacks", () => {
  const { aggregateSeries } = require("../../../utils/esports/seriesAggregator");
  const roles = ["Top", "Jungle", "Mid", "Adc", "Support"];
  const game = {
    gameId: "nested-game",
    dateUtc: "2026-06-20T12:00:00Z",
    tournament: "MSI 2026",
    matchContext: { league: "MSI", teamA: "T1", teamB: "BLG" },
    winTeam: "BLG",
    players: roles.flatMap((role) => [
      { Team: "T1", Role: role, Name: `T1 ${role}`, Champion: "A", stats: { kills: 1, deaths: 0, assists: 1, DamageToChamps: "1000", Gold: "500", CS: "10", VisionScore: "3" } },
      { Team: "BLG", Role: role, Name: `BLG ${role}`, Champion: "B", stats: { kills: 2, deaths: 1, assists: 2, damageToChampions: "2000", gold: "600", cs: "11", visionScore: "4" } },
    ]),
  };

  const series = aggregateSeries([game]);

  assert.equal(series.league, "MSI");
  assert.equal(series.teamA, "T1");
  assert.equal(series.winningTeam, "BLG");
  assert.equal(series.players.find((playerEntry) => playerEntry.name === "T1 Top").rawStats.kda, 2);
});

test("aggregateSeries preserves raw Leaguepedia damage and gold from normalized player rows", () => {
  const { aggregateSeries } = require("../../../utils/esports/seriesAggregator");
  const { normalizePlayerRow } = require("../../../utils/leaguepediaApi");
  const match = { winTeam: "T1", gamelengthMin: 30 };
  const leaguepediaPlayer = normalizePlayerRow({
    Link: "Doran",
    Team: "T1",
    Role: "Top",
    Champion: "Aatrox",
    Kills: "3",
    Deaths: "1",
    Assists: "8",
    CS: "275",
    Gold: "14000",
    DamageToChamps: "12345",
    VisionScore: "31",
  }, match);

  const series = aggregateSeries([{
    seriesId: "msi-t1-tl",
    date: "2026-06-28",
    league: "MSI",
    tournament: "Mid-Season Invitational 2026",
    teamA: "T1",
    teamB: "Team Liquid",
    winTeam: "T1",
    durationSeconds: 1800,
    players: [leaguepediaPlayer],
  }]);
  const top = series.players.find((playerEntry) => playerEntry.name === "Doran");

  assert.equal(top.rawStats.damageToChampions, 12345);
  assert.equal(top.rawStats.gold, 14000);
  assert.equal(top.rawStats.dpm, 412);
  assert.equal(top.rawStats.gpm, 467);
});

test("Leaguepedia rows keep real duration and missing stats unavailable for player radar", () => {
  const { aggregateSeries } = require("../../../utils/esports/seriesAggregator");
  const { buildPlayerRadarPayload } = require("../../../utils/esports/playerRadarRunner");
  const { normalizeMatchRow, normalizePlayerRow } = require("../../../utils/leaguepediaApi");

  const match = normalizeMatchRow({
    Tournament: "LCK 2026 Summer",
    Team1: "T1",
    Team2: "GEN",
    WinTeam: "T1",
    GameId: "t1-gen-game-1",
    Gamelength: "20:00",
    "DateTime UTC": "2026-06-20T12:00:00Z",
  });
  const rows = [
    ["T1 Top", "T1", "Top", "3", "1", "6", "260", "12000", "12000", "24"],
    ["T1 Jungle", "T1", "Jungle", "4", "1", "7", "180", "11200", "14000", "42"],
    ["Faker", "T1", "Mid", "7", "1", "9", "245", "13500", "20000", "28"],
    ["T1 ADC", "T1", "Adc", "5", "1", "6", "275", "14200", "19000", "18"],
    ["T1 Support", "T1", "Support", "0", "2", "15", "35", "7300", "5400", "68"],
    ["GEN Top", "GEN", "Top", "1", "3", "2", "230", "9600", "9000", "22"],
    ["GEN Jungle", "GEN", "Jungle", "1", "4", "3", "160", "8800", "7600", "34"],
    ["Chovy", "GEN", "Mid", "2", "4", "4", "220", "10400", undefined, "24"],
    ["GEN ADC", "GEN", "Adc", "3", "4", "3", "250", "11800", "13000", "20"],
    ["GEN Support", "GEN", "Support", "0", "4", "5", "30", "6100", "4200", "54"],
  ].map(([Link, Team, Role, Kills, Deaths, Assists, CS, Gold, DamageToChamps, VisionScore]) => {
    const row = { Link, Team, Role, Champion: "Azir", Kills, Deaths, Assists, CS, Gold, VisionScore };
    if (DamageToChamps !== undefined) row.DamageToChamps = DamageToChamps;
    return normalizePlayerRow(row, match);
  });

  const series = aggregateSeries([{ ...match, teamA: "T1", teamB: "GEN", players: rows }]);
  const faker = series.players.find((playerEntry) => playerEntry.name === "Faker");
  const chovy = series.players.find((playerEntry) => playerEntry.name === "Chovy");
  const payload = buildPlayerRadarPayload(series, { playerName: "Faker" }, "zh");

  assert.equal(match.durationSeconds, 1200);
  assert.equal(faker.rawStats.dpm, 1000);
  assert.equal(faker.radarStats.find((stat) => stat.label === "DPM").rawValue, "1000");
  assert.equal(chovy.rawStats.damageToChampions, null);
  assert.equal(chovy.rawStats.dpm, null);
  assert.equal(chovy.radarStats.some((stat) => stat.label === "DPM"), false);
  assert.equal(payload.proofSegment.player.name, "Faker");
  assert.equal(payload.proofSegment.player.radarStats.find((stat) => stat.label === "DPM").rawValue, "1000");
});

test("aggregateSeries handles durationMinutes, comma numbers, blank roles, and missing champions", () => {
  const { aggregateSeries, normalizeRole, buildRadarStats } = require("../../../utils/esports/seriesAggregator");
  const game = {
    MatchId: "match-from-cargo",
    DateTime_UTC: "2026-06-20T12:00:00Z",
    Tournament: "LCK 2026 Summer",
    team1: "T1",
    team2: "GEN",
    durationMinutes: "30",
    winTeam: "GEN",
    players: [
      { team: "T1", role: "", name: "Blank Role", kills: "1,000", deaths: "0", assists: "2", damageToChampions: "1,200", gold: "9,000", cs: "200", visionScore: "30" },
      { team: "GEN", role: "middle", name: "Alias Mid", kills: "2", deaths: "1", assists: "4", damageToChampions: "2,400", gold: "10,000", cs: "220", visionScore: "35" },
    ],
  };

  const series = aggregateSeries([game]);
  const blankRole = series.players.find((playerEntry) => playerEntry.name === "Blank Role");

  assert.equal(series.seriesId, "match-from-cargo");
  assert.equal(series.date, "2026-06-20T12:00:00Z");
  assert.equal(series.tournament, "LCK 2026 Summer");
  assert.equal(series.score, "0-1");
  assert.equal(series.teamStats.T1.kills, 1000);
  assert.equal(blankRole.role, "Mid");
  assert.equal(blankRole.rawStats.kda, 1002);
  assert.deepEqual(blankRole.champions, []);
  assert.equal(normalizeRole(""), "Mid");
  assert.equal(buildRadarStats({ role: "Support", kda: 20, dpm: 1200, kp: 1.5, gpm: 800, vpm: 5 })[0].normalizedScore, 100);
});

test("aggregateSeries falls back gracefully when a game has no teams or player array", () => {
  const { aggregateSeries } = require("../../../utils/esports/seriesAggregator");

  const series = aggregateSeries([{
    date: "2026-06-20",
    winTeam: "UNKNOWN",
    Gamelength: "29m45",
    players: "not-array",
  }]);

  assert.equal(series.seriesId, "2026-06-20");
  assert.deepEqual(series.teams, []);
  assert.equal(series.winningTeam, "UNKNOWN");
  assert.equal(series.score, "");
  assert.equal(series.players.length, 0);
  assert.deepEqual(series.completeness.missingRoles, ROLES);
});
