const assert = require("node:assert/strict");
const test = require("node:test");

const fixture = require("../../fixtures/esports/asset-inventory-cargo.json");
const {
  compareInventoryToManifests,
  fetchTierOneAssetInventory,
  parseRosterRows,
} = require("../../../utils/esports/assetInventory");

test("parseRosterRows aligns player roles, deduplicates registrations, and excludes lower tiers", () => {
  const parsed = parseRosterRows(fixture.rosters, { year: "2026" });

  assert.deepEqual(parsed.teams.map(({ team }) => team), ["GEN", "G2 Esports"]);
  assert.deepEqual(parsed.players.map(({ playerId, team, role }) => [playerId, team, role]), [
    ["ruler", "GEN", "Adc"],
    ["mata", "GEN", "Support"],
    ["caps", "G2 Esports", "Mid"],
  ]);
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
  assert.equal(inventory.players.find(({ playerId }) => playerId === "ruler").candidateImage.fileName, "GEN Ruler.png");
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
