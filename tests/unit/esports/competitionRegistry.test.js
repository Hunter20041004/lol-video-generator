const assert = require("node:assert/strict");
const test = require("node:test");

const {
  buildTierOneTournamentWhere,
  classifyTierOneTournament,
  listTierOneCompetitions,
} = require("../../../utils/esports/competitionRegistry");

test("competition registry recognizes all 2026 tier-one competitions and rejects lookalikes", () => {
  const supported = new Map([
    ["LCK 2026 Season Play-In", "LCK"],
    ["LCK/2026 Season/Rounds 1-2", "LCK"],
    ["LPL 2026 Split 2", "LPL"],
    ["LEC 2026 Summer", "LEC"],
    ["LCS 2026 Spring", "LCS"],
    ["CBLOL 2026 Split 1", "CBLOL"],
    ["LCP 2026 Split 2", "LCP"],
    ["2026 First Stand", "FIRST_STAND"],
    ["MSI 2026", "MSI"],
    ["World Championship 2026", "WORLDS"],
  ]);

  assert.deepEqual(listTierOneCompetitions().map(({ id }) => id), [...new Set(supported.values())]);
  for (const [name, id] of supported) {
    assert.equal(classifyTierOneTournament(name)?.id, id, name);
  }

  for (const name of [
    "LCK CL 2026",
    "LPL Development League 2026",
    "EMEA Masters 2026",
    "NACL 2026",
    "CBLOL Academy 2026",
    "PCS 2026",
    "Worlds Qualifying Series 2026",
    "LCK 2026 Season Opening",
    "LCS 2026 LoL Classic Showmatch",
    "CBLOL 2026 LoL Classic Showmatch",
    "LCP 2026 Promotion",
    "LCP Wildcard 2026 Philippines Qualifier",
  ]) {
    assert.equal(classifyTierOneTournament(name), null, name);
  }
});

test("competition registry builds an anchored SQL-safe Cargo predicate", () => {
  const { buildCompetitionTournamentWhere } = require("../../../utils/esports/competitionRegistry");
  const where = buildTierOneTournamentWhere("ScoreboardGames.Tournament");

  assert.match(where, /ScoreboardGames\.Tournament = 'LCK'/);
  assert.match(where, /ScoreboardGames\.Tournament LIKE 'LCK %'/);
  assert.match(where, /ScoreboardGames\.Tournament LIKE 'LCK\/%'/);
  assert.match(where, /ScoreboardGames\.Tournament = 'Mid-Season Invitational'/);
  assert.match(where, /ScoreboardGames\.Tournament LIKE 'World Championship %'/);
  assert.doesNotMatch(where, /LIKE '%LCK%'/);
  assert.throws(() => buildTierOneTournamentWhere("unsafe.field; DROP TABLE"), /unsupported Cargo field/i);
  const lcpWhere = buildCompetitionTournamentWhere("LCP", "TournamentRosters.Tournament");
  assert.match(lcpWhere, /TournamentRosters\.Tournament LIKE 'LCP\/%'/);
  assert.match(lcpWhere, /NOT LIKE '%Wildcard%'/);
  assert.match(lcpWhere, /NOT LIKE '%Promotion%'/);
});
