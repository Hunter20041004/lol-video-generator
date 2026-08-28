const assert = require("node:assert/strict");
const test = require("node:test");

const { preflightEsportsIdentityAssets } = require("../../../utils/render/esportsAssetPreflight");

function notFound(message) {
  return Object.assign(new Error(message), { code: "ASSET_IDENTITY_NOT_FOUND" });
}

test("preflightEsportsIdentityAssets returns every missing identity in stable order", () => {
  const viewModel = {
    seriesContext: {
      season: "2026",
      matchDate: "2026-08-27",
      teamA: "BNK FEARX",
      teamB: "Nongshim RedForce",
    },
    proof: { player: { playerId: "taeyoon", name: "Taeyoon", team: "BNK FEARX" } },
  };

  assert.throws(
    () => preflightEsportsIdentityAssets(viewModel, {
      resolvePlayerPortrait: () => { throw notFound("portrait missing"); },
      resolveTeamCrest: () => { throw notFound("crest missing"); },
    }),
    (error) => {
      assert.equal(error.code, "ESPORTS_ASSETS_MISSING");
      assert.deepEqual(error.missing, [
        { kind: "portrait", playerId: "taeyoon", publicName: "Taeyoon", team: "BNK FEARX", season: "2026", matchDate: "2026-08-27" },
        { kind: "teamA", team: "BNK FEARX", season: "2026", matchDate: "2026-08-27" },
        { kind: "teamB", team: "Nongshim RedForce", season: "2026", matchDate: "2026-08-27" },
      ]);
      return true;
    }
  );
});

test("preflightEsportsIdentityAssets does not hide integrity failures", () => {
  assert.throws(
    () => preflightEsportsIdentityAssets({
      seriesContext: { season: "2026", matchDate: "2026-08-27", teamA: "GEN", teamB: "HLE" },
      proof: { player: { playerId: "ruler", name: "Ruler", team: "GEN" } },
    }, {
      resolvePlayerPortrait: () => { throw new Error("Player portrait SHA-256 mismatch for Ruler."); },
      resolveTeamCrest: () => ({ publicPath: "/team-crests/team.png" }),
    }),
    /SHA-256 mismatch/
  );
});
