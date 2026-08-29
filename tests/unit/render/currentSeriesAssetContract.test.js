const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const { preflightEsportsIdentityAssets } = require("../../../utils/render/esportsAssetPreflight");
const { resolvePlayerPortrait } = require("../../../utils/render/playerPortraitManifest");
const { resolveTeamCrest } = require("../../../utils/render/teamCrestManifest");

const ROOT = path.resolve(__dirname, "../../..");

test("2026-08-27 BNK FEARX versus Nongshim resolves every identity asset", () => {
  const viewModel = {
    seriesContext: {
      season: "2026",
      matchDate: "2026-08-27",
      teamA: "BNK FEARX",
      teamB: "Nongshim RedForce",
    },
    proof: {
      player: {
        playerId: "taeyoon",
        name: "Taeyoon (Kim Tae-yoon)",
        team: "BNK FEARX",
      },
    },
  };

  const assets = preflightEsportsIdentityAssets(viewModel, {
    resolvePlayerPortrait: (identity) => resolvePlayerPortrait(identity, { rootDir: ROOT }),
    resolveTeamCrest: (identity) => resolveTeamCrest(identity, { rootDir: ROOT }),
  });

  assert.equal(assets.playerPortrait.publicPath, "/player-portraits/bfx-taeyoon-2026.webp");
  assert.equal(assets.teams.teamA.publicPath, "/team-crests/bnk-fearx-2026.png");
  assert.equal(assets.teams.teamB.publicPath, "/team-crests/nongshim-redforce-2026.png");
});

test("audited crest lockups suppress duplicate external team labels", () => {
  const manifest = require("../../../config/esports-team-crests.json");
  const embedded = manifest.crests.filter((crest) => crest.presentation?.labelMode === "embedded");
  const external = manifest.crests
    .filter((crest) => !crest.presentation)
    .map((crest) => crest.team);

  assert.equal(embedded.length, 51);
  assert.deepEqual(external, [
    "GEN",
    "HLE",
    "Oh My God",
    "Los Ratones",
    "Movistar KOI",
    "Team Heretics",
    "Team Vitality",
  ]);
  assert.equal(resolveTeamCrest({
    team: "HANJIN BRION",
    season: "2026",
    matchDate: "2026-08-27",
  }, { rootDir: ROOT }).labelMode, "embedded");
});
