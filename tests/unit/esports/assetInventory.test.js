const assert = require("node:assert/strict");
const test = require("node:test");

const fixture = require("../../fixtures/esports/asset-inventory-cargo.json");
const {
  compareInventoryToManifests,
  fetchTierOneAssetInventory,
  parseRosterRows,
} = require("../../../utils/esports/assetInventory");
const { markdownReport } = require("../../../scripts/esportsAssetInventory");

test("parseRosterRows aligns player roles, deduplicates registrations, and excludes lower tiers", () => {
  const parsed = parseRosterRows([
    ...fixture.rosters,
    {
      Team: "GEN",
      Short: "GEN",
      Tournament: "LCK/2026 Season/Rounds 1-2",
      RosterLinks: "Ruler;;Coach Kim",
      Roles: "Bot;;Coach",
    },
  ], { year: "2026" });

  assert.deepEqual(parsed.teams.map(({ team }) => team), ["GEN", "G2 Esports"]);
  assert.deepEqual(parsed.players.map(({ playerId, team, role }) => [playerId, team, role]), [
    ["ruler", "GEN", "Adc"],
    ["mata", "GEN", "Support"],
    ["caps", "G2 Esports", "Mid"],
  ]);
  assert.equal(parsed.players.some(({ playerId }) => playerId === "coach-kim"), false);
});

test("fetchTierOneAssetInventory uses the four documented Cargo tables and preserves provenance", async () => {
  const calls = [];
  const rowsByTable = {
    Tournaments: fixture.tournaments,
    TournamentRosters: fixture.rosters,
    PlayerImages: fixture.playerImages,
    Teams: fixture.teams,
  };
  const inventory = await fetchTierOneAssetInventory({ year: "2026", asOf: "2026-08-28" }, {
    cargoQuery: async (query) => {
      calls.push(query);
      return rowsByTable[query.tables];
    },
  });

  assert.deepEqual(calls.map(({ tables }) => tables), ["Tournaments", "TournamentRosters", "PlayerImages", "Teams"]);
  assert.equal(inventory.asOf, "2026-08-28");
  assert.deepEqual(inventory.sourceTables, ["Tournaments", "TournamentRosters", "PlayerImages", "Teams"]);
  assert.equal(inventory.teams.length, 2);
  assert.equal(inventory.players.length, 3);
  const ruler = inventory.players.find(({ playerId }) => playerId === "ruler");
  assert.equal(ruler.candidateImage.fileName, "GEN Ruler.png");
  assert.deepEqual(ruler.candidateSources, [{
    sourceKind: "leaguepedia",
    sourcePage: "https://lol.fandom.com/wiki/File:GEN%20Ruler.png",
    sourceUrl: "https://lol.fandom.com/wiki/Special:Redirect/file/GEN%20Ruler.png",
  }]);
  assert.deepEqual(inventory.teams.find(({ team }) => team === "GEN").candidateSources, [
    { sourceKind: "team", sourcePage: "https://geng.gg/" },
    {
      sourceKind: "leaguepedia",
      sourcePage: "https://lol.fandom.com/wiki/File:Gen.Glogo.png",
      sourceUrl: "https://lol.fandom.com/wiki/Special:Redirect/file/Gen.Glogo.png",
    },
  ]);
});

test("fetchTierOneAssetInventory never treats an empty tournament boundary as zero coverage", async () => {
  await assert.rejects(
    () => fetchTierOneAssetInventory({ year: "2026", asOf: "2026-08-28" }, {
      cargoQuery: async ({ tables }) => tables === "Tournaments" ? [] : fixture[tables],
    }),
    /returned no eligible tournaments/i
  );
});

test("compareInventoryToManifests reports calibrated team and player coverage", () => {
  const inventory = {
    asOf: "2026-08-28",
    teams: [{ team: "GEN" }, { team: "G2 Esports" }],
    players: [
      { playerId: "ruler", publicName: "Ruler", team: "GEN" },
      { playerId: "mata", publicName: "Mata", team: "GEN" },
      { playerId: "caps", publicName: "Caps", team: "G2 Esports" },
    ],
  };
  const report = compareInventoryToManifests(inventory, {
    portraits: [{ playerId: "ruler", publicName: "Ruler", team: "GEN", season: "2026" }],
    crests: [{ team: "GEN", season: "2026" }],
  });

  assert.deepEqual(report.counts, {
    teams: 2,
    coveredTeams: 1,
    missingTeams: 1,
    players: 3,
    coveredPlayers: 1,
    missingPlayers: 2,
  });
  assert.deepEqual(report.missingTeams.map(({ team }) => team), ["G2 Esports"]);
  assert.deepEqual(report.missingPlayers.map(({ playerId }) => playerId), ["caps", "mata"]);
});

test("markdown inventory exposes review candidates without approving them", () => {
  const inventory = {
    sourceTables: ["Tournaments", "TournamentRosters", "PlayerImages", "Teams"],
    teams: [{
      team: "GEN",
      candidateSources: [{ sourceKind: "team", sourcePage: "https://geng.gg/" }],
    }],
    players: [{
      publicName: "Ruler",
      team: "GEN",
      candidateSources: [{ sourceKind: "leaguepedia", sourcePage: "https://lol.fandom.com/wiki/File:GEN%20Ruler.png" }],
    }],
  };
  const coverage = {
    asOf: "2026-08-28",
    counts: { coveredTeams: 0, teams: 1, coveredPlayers: 0, players: 1 },
    missingTeams: inventory.teams,
    missingPlayers: inventory.players,
  };

  const report = markdownReport(inventory, coverage);

  assert.match(report, /GEN — \[team candidate\]\(https:\/\/geng\.gg\/\)/);
  assert.match(report, /Ruler — GEN — \[leaguepedia candidate\]/);
  assert.match(report, /Candidates require explicit review; this report does not approve them/);
});
