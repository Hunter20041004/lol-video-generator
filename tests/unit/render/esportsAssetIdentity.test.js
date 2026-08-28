const assert = require("node:assert/strict");
const test = require("node:test");

const { resolveDatedEntry } = require("../../../utils/render/esportsAssetIdentity");

const entries = [
  {
    playerId: "example",
    publicName: "Example",
    playerAliases: ["Example (Legal Name)"],
    team: "OLD",
    teamAliases: ["Old Team"],
    season: "2026",
    validFrom: "2026-01-01",
    validTo: "2026-06-30",
  },
  {
    playerId: "example",
    publicName: "Example",
    playerAliases: ["Example (Legal Name)"],
    team: "NEW",
    teamAliases: ["New Team"],
    season: "2026",
    validFrom: "2026-07-01",
    validTo: "2026-12-31",
  },
];

test("resolveDatedEntry selects the identity valid on the match date", () => {
  assert.equal(resolveDatedEntry(entries, {
    publicName: "Example (Legal Name)", team: "Old Team", season: "2026", matchDate: "2026-03-15",
  }, { kind: "player portrait" }).team, "OLD");
  assert.equal(resolveDatedEntry(entries, {
    playerId: "example", team: "NEW", season: "2026", matchDate: "2026-08-15",
  }, { kind: "player portrait" }).team, "NEW");
  assert.throws(
    () => resolveDatedEntry(entries, {
      playerId: "example", team: "OLD", season: "2026", matchDate: "2026-07-15",
    }, { kind: "player portrait" }),
    (error) => error.code === "ASSET_IDENTITY_NOT_FOUND"
  );
});

test("resolveDatedEntry rejects overlapping valid identities", () => {
  const overlapping = [entries[0], { ...entries[0], teamAliases: ["Old Team"], repositoryPath: "other.webp" }];
  assert.throws(
    () => resolveDatedEntry(overlapping, {
      playerId: "example", team: "OLD", season: "2026", matchDate: "2026-03-15",
    }, { kind: "player portrait" }),
    (error) => error.code === "ASSET_IDENTITY_AMBIGUOUS" && /2026-03-15/.test(error.message)
  );
});
