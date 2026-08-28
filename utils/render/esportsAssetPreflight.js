function isMissingAssetError(error) {
  return error?.code === "ASSET_IDENTITY_NOT_FOUND" || /\bnot found\b/i.test(error?.message || "");
}

function preflightEsportsIdentityAssets(viewModel = {}, deps = {}) {
  const context = viewModel.seriesContext || {};
  const player = viewModel.proof?.player || {};
  const common = {
    season: context.season || "2026",
    matchDate: context.matchDate || "",
  };
  const requests = [
    {
      missing: { kind: "portrait", playerId: player.playerId, publicName: player.name, team: player.team, ...common },
      resolve: () => deps.resolvePlayerPortrait({
        playerId: player.playerId,
        publicName: player.name,
        team: player.team,
        ...common,
      }),
    },
    {
      missing: { kind: "teamA", team: context.teamA, ...common },
      resolve: () => deps.resolveTeamCrest({ team: context.teamA, ...common }),
    },
    {
      missing: { kind: "teamB", team: context.teamB, ...common },
      resolve: () => deps.resolveTeamCrest({ team: context.teamB, ...common }),
    },
  ];
  const resolved = [];
  const missing = [];

  for (const request of requests) {
    try {
      resolved.push(request.resolve());
    } catch (error) {
      if (!isMissingAssetError(error)) throw error;
      missing.push(request.missing);
      resolved.push(null);
    }
  }

  if (missing.length > 0) {
    throw Object.assign(new Error(`Required esports assets missing (${missing.length}).`), {
      code: "ESPORTS_ASSETS_MISSING",
      status: 422,
      missing,
    });
  }

  return {
    playerPortrait: resolved[0],
    teams: { teamA: resolved[1], teamB: resolved[2] },
  };
}

module.exports = {
  isMissingAssetError,
  preflightEsportsIdentityAssets,
};
