const test = require("node:test");
const assert = require("node:assert/strict");

const {
  RENDER_ASSET_FALLBACK_PUBLIC_PATH,
} = require("../../../utils/render/remoteAssetCache");
const {
  resolvePlayerRadarAssets,
} = require("../../../utils/render/playerRadarAssetPlanner");

function makeViewModel(edgeChampion = "Xin Zhao") {
  return {
    seriesContext: { season: "2026" },
    matchup: {
      edgePlayer: { name: "JackeyLove", championPlayed: edgeChampion },
      opponentPlayer: { name: "Elk", championPlayed: "Vi" },
    },
    proof: {
      player: { playerId: "ruler", name: "Ruler", team: "GEN", champions: ["Lucian", "Varus", "Ezreal"] },
    },
  };
}

const makePortrait = () => ({
  publicName: "Ruler",
  publicPath: "/player-portraits/gen-ruler-2026.webp",
  sourceUrl: "https://example.com/ruler.webp",
  sha256: "verified-hash",
  width: 693,
  height: 549,
});

test("resolvePlayerRadarAssets blocks rendering when the official square face is unavailable", async () => {
  await assert.rejects(
    () => resolvePlayerRadarAssets(makeViewModel("Ryze"), {
      cacheRemoteImageUrlImpl: async (url) => url.includes("/img/champion/") && !url.includes("/splash/")
        ? RENDER_ASSET_FALLBACK_PUBLIC_PATH
        : "/render-assets/usable.png",
      resolvePlayerPortraitImpl: makePortrait,
    }),
    /official champion square unavailable for Ryze/i
  );
});

test("resolvePlayerRadarAssets uses the official square icon when splash fetch fails", async () => {
  const resolved = await resolvePlayerRadarAssets(makeViewModel(), {
    cacheRemoteImageUrlImpl: async (url) => {
      if (url.includes("/splash/")) return RENDER_ASSET_FALLBACK_PUBLIC_PATH;
      return url.includes("/champion/") ? "/render-assets/champion-square.png" : "/render-assets/supporting.png";
    },
    resolvePlayerPortraitImpl: makePortrait,
  });

  assert.equal(resolved.matchup.edge.fallbackState, "square-map");
  assert.equal(resolved.matchup.edge.squareSrc, "/render-assets/champion-square.png");
  assert.equal(resolved.matchup.edge.atmosphereSrc, null);
  assert.equal(resolved.matchup.edge.mapSrc, "/render-assets/supporting.png");
  assert.equal(resolved.proof.playerPortrait.publicName, "Ruler");
  assert.equal(resolved.proof.playerPortrait.publicPath, "/player-portraits/gen-ruler-2026.webp");
  assert.doesNotMatch(JSON.stringify(resolved), /https?:\/\//);
  assert.doesNotMatch(resolved.matchup.edge.squareSrc, /missing-image/);
});

test("resolvePlayerRadarAssets rejects when the official hero square fails", async () => {
  await assert.rejects(
    () => resolvePlayerRadarAssets(makeViewModel(), {
      cacheRemoteImageUrlImpl: async (url) => url.includes("XinZhao")
        ? RENDER_ASSET_FALLBACK_PUBLIC_PATH
        : "/render-assets/supporting.png",
    }),
    /Post Match Read official champion square unavailable for Xin Zhao\./
  );
});

test("resolvePlayerRadarAssets requires the official map for square fallback mode", async () => {
  await assert.rejects(
    () => resolvePlayerRadarAssets(makeViewModel(), {
      cacheRemoteImageUrlImpl: async (url) => {
        if (url.includes("/splash/XinZhao")) return RENDER_ASSET_FALLBACK_PUBLIC_PATH;
        if (url.includes("/map/")) return RENDER_ASSET_FALLBACK_PUBLIC_PATH;
        return "/render-assets/official.png";
      },
    }),
    /Post Match Read official map unavailable for Xin Zhao square fallback\./
  );
});
