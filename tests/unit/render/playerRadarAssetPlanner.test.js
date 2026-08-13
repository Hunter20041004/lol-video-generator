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
    matchup: {
      edgePlayer: { name: "JackeyLove", championPlayed: edgeChampion },
      opponentPlayer: { name: "Elk", championPlayed: "Vi" },
    },
    proof: {
      player: { name: "Peyz", champions: ["Lucian", "Varus", "Ezreal"] },
    },
  };
}

test("resolvePlayerRadarAssets uses the official square icon when splash fetch fails", async () => {
  const resolved = await resolvePlayerRadarAssets(makeViewModel(), {
    cacheRemoteImageUrlImpl: async (url) => {
      if (url.includes("/splash/")) return RENDER_ASSET_FALLBACK_PUBLIC_PATH;
      return url.includes("/champion/") ? "/render-assets/champion-square.png" : "/render-assets/supporting.png";
    },
  });

  assert.equal(resolved.matchup.edge.mode, "square-map");
  assert.equal(resolved.matchup.edge.src, "/render-assets/champion-square.png");
  assert.equal(resolved.matchup.edge.mapSrc, "/render-assets/supporting.png");
  assert.doesNotMatch(resolved.matchup.edge.src, /missing-image/);
});

test("resolvePlayerRadarAssets rejects when both official hero sources fail", async () => {
  await assert.rejects(
    () => resolvePlayerRadarAssets(makeViewModel(), {
      cacheRemoteImageUrlImpl: async (url) => url.includes("XinZhao")
        ? RENDER_ASSET_FALLBACK_PUBLIC_PATH
        : "/render-assets/supporting.png",
    }),
    /Post Match Read official champion art unavailable for Xin Zhao: splash and square both failed\./
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
