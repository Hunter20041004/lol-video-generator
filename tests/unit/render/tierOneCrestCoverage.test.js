const test = require("node:test");
const assert = require("node:assert/strict");
const { resolveTeamCrest } = require("../../../utils/render/teamCrestManifest");

test("all formerly unresolved 2026 tier-one team crests resolve by exact identity", () => {
  for (const team of ["BRION", "DRX", "Ninjas in Pyjamas.CN", "LYON (2024 American Team)"]) {
    const crest = resolveTeamCrest({ team, season: "2026", matchDate: "2026-09-30" });
    assert.equal(crest.team, team);
    assert.match(crest.publicPath, /\.png$/);
  }
});
