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
    seriesContext: { season: "2026", matchDate: "2026-08-13", teamA: "GEN", teamB: "HLE" },
    matchup: {
      edgePlayer: { name: "JackeyLove", championPlayed: edgeChampion },
      opponentPlayer: { name: "Elk", championPlayed: "Vi" },
    },
    proof: {
      player: { playerId: "ruler", name: "Ruler", team: "GEN", champions: ["Lucian", "Varus", "Ezreal"] },
    },
    finalRead: {
      winnerTeam: { name: "GEN", identity: "GEN" },
    },
  };
}

test("resolvePlayerRadarAssets resolves both series teams as verified crests", async () => {
  const resolvedTeams = [];
  const resolved = await resolvePlayerRadarAssets(makeViewModel(), {
    cacheRemoteImageUrlImpl: async () => "/render-assets/official.png",
    resolvePlayerPortraitImpl: makePortrait,
    resolveTeamCrestImpl: (identity) => {
      resolvedTeams.push(identity);
      return {
        team: identity.team,
        publicPath: `/team-crests/${identity.team.toLowerCase()}.png`,
        labelMode: identity.team === "HLE" ? "embedded" : "external",
      };
    },
  });

  assert.deepEqual(resolvedTeams, [
    { team: "GEN", season: "2026", matchDate: "2026-08-13" },
    { team: "HLE", season: "2026", matchDate: "2026-08-13" },
  ]);
  assert.equal(resolved.teams.teamA.publicPath, "/team-crests/gen.png");
  assert.equal(resolved.teams.teamB.publicPath, "/team-crests/hle.png");
  assert.equal(resolved.teams.teamA.labelMode, "external");
  assert.equal(resolved.teams.teamB.labelMode, "embedded");
});

test("resolvePlayerRadarAssets exposes the verified winning-team crest", async () => {
  const viewModel = makeViewModel();
  viewModel.seriesContext.teamAIdentity = "GEN";
  viewModel.seriesContext.teamBIdentity = "HLE";
  viewModel.finalRead = { winnerTeam: { name: "HLE", identity: "HLE" } };

  const resolved = await resolvePlayerRadarAssets(viewModel, {
    cacheRemoteImageUrlImpl: async () => "/render-assets/official.png",
    resolvePlayerPortraitImpl: makePortrait,
    resolveTeamCrestImpl: (identity) => ({
      team: identity.team,
      publicPath: `/team-crests/${identity.team.toLowerCase()}.png`,
      labelMode: identity.team === "HLE" ? "embedded" : "external",
    }),
  });

  assert.equal(resolved.finalRead.winnerCrest.team, "HLE");
  assert.equal(resolved.finalRead.winnerCrest.publicPath, "/team-crests/hle.png");
  assert.equal(resolved.finalRead.winnerCrest.labelMode, "embedded");
});

test("winner full identity reuses the verified HLE crest despite its canonical short name", async () => {
  const viewModel = makeViewModel();
  viewModel.seriesContext.teamBIdentity = "Hanwha Life Esports";
  viewModel.finalRead.winnerTeam = { name: "HLE", identity: "Hanwha Life Esports" };
  const resolved = await resolvePlayerRadarAssets(viewModel, {
    cacheRemoteImageUrlImpl: async () => "/render-assets/official.png",
    resolvePlayerPortraitImpl: makePortrait,
  });
  assert.equal(resolved.finalRead.winnerCrest.team, "HLE");
  assert.equal(resolved.finalRead.winnerCrest.publicPath, "/team-crests/hle.png");
  assert.equal(resolved.finalRead.winnerCrest.sha256, resolved.teams.teamB.sha256);
});

test("winner mapping handles either series slot and canonical names using real crest files", async () => {
  for (const [slot, identity, canonical, path] of [
    ["teamA", "Gen.G", "GEN", "/team-crests/gen.png"],
    ["teamA", "Hanwha Life Esports", "HLE", "/team-crests/hle.png"],
    ["teamB", "Hanwha Life Esports", "HLE", "/team-crests/hle.png"],
  ]) {
    for (const winnerIdentity of [identity, canonical]) {
      const model = makeViewModel();
      model.seriesContext = { season: "2026", matchDate: "2026-09-02",
        teamA: slot === "teamA" ? identity : "GEN", teamB: slot === "teamB" ? identity : "BNK FEARX" };
      model.finalRead.winnerTeam.identity = winnerIdentity;
      const resolved = await resolvePlayerRadarAssets(model, {
        cacheRemoteImageUrlImpl: async () => "/render-assets/official.png",
        resolvePlayerPortraitImpl: makePortrait,
      });
      assert.equal(resolved.finalRead.winnerCrest.publicPath, path);
      assert.equal(resolved.finalRead.winnerCrest.sha256, resolved.teams[slot].sha256);
    }
  }
});

test("winner mapping rejects missing, ambiguous and outside-series identities", async () => {
  for (const identity of ["", "Unknown Team", "BNK FEARX", "HLE"]) {
    const model = makeViewModel();
    if (identity === "HLE") model.seriesContext.teamA = "Hanwha Life Esports";
    model.finalRead.winnerTeam.identity = identity;
    await assert.rejects(() => resolvePlayerRadarAssets(model, {
      cacheRemoteImageUrlImpl: async () => "/render-assets/official.png",
      resolvePlayerPortraitImpl: makePortrait,
    }), /winner crest unavailable/);
  }
});

test("resolvePlayerRadarAssets blocks a winner identity outside the verified series teams", async () => {
  const viewModel = makeViewModel();
  viewModel.finalRead = { winnerTeam: { name: "Unknown", identity: "Unknown Team" } };

  await assert.rejects(
    () => resolvePlayerRadarAssets(viewModel, {
      cacheRemoteImageUrlImpl: async () => "/render-assets/official.png",
      resolvePlayerPortraitImpl: makePortrait,
      resolveTeamCrestImpl: (identity) => ({
        team: identity.team,
        publicPath: `/team-crests/${identity.team.toLowerCase()}.png`,
      }),
    }),
    /winner crest unavailable for Unknown Team/i,
  );
});

test("resolvePlayerRadarAssets uses the repository team crest manifest by default", async () => {
  const resolved = await resolvePlayerRadarAssets(makeViewModel(), {
    cacheRemoteImageUrlImpl: async () => "/render-assets/official.png",
    resolvePlayerPortraitImpl: makePortrait,
  });

  assert.equal(resolved.teams.teamA.publicPath, "/team-crests/gen.png");
  assert.equal(resolved.teams.teamB.publicPath, "/team-crests/hle.png");
  assert.match(resolved.teams.teamA.sha256, /^[a-f0-9]{64}$/);
  assert.match(resolved.teams.teamB.sha256, /^[a-f0-9]{64}$/);
});

const makePortrait = () => ({
  publicName: "Ruler",
  publicPath: "/player-portraits/gen-ruler-2026.webp",
  sourceUrl: "https://example.com/ruler.webp",
  sha256: "verified-hash",
  width: 693,
  height: 549,
});

test("resolvePlayerRadarAssets reports every identity gap before champion network requests", async () => {
  let cacheCalls = 0;
  const missing = () => Object.assign(new Error("not found"), { code: "ASSET_IDENTITY_NOT_FOUND" });

  await assert.rejects(
    () => resolvePlayerRadarAssets({
      ...makeViewModel(),
      seriesContext: { season: "2026", matchDate: "2026-08-27", teamA: "BNK FEARX", teamB: "Nongshim RedForce" },
      proof: { player: { playerId: "taeyoon", name: "Taeyoon", team: "BNK FEARX", champions: ["Ezreal"] } },
    }, {
      cacheRemoteImageUrlImpl: async () => { cacheCalls += 1; return "/render-assets/official.png"; },
      resolvePlayerPortraitImpl: () => { throw missing(); },
      resolveTeamCrestImpl: () => { throw missing(); },
    }),
    (error) => error.code === "ESPORTS_ASSETS_MISSING" && error.missing.length === 3
  );
  assert.equal(cacheCalls, 0);
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
