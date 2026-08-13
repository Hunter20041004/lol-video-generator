const {
  DDRAGON_RENDER_VERSION,
  RENDER_ASSET_FALLBACK_PUBLIC_PATH,
  cacheRemoteImageUrl,
  normalizeChampionId,
} = require("./remoteAssetCache");

const championSplashUrl = (id) =>
  `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${id}_0.jpg`;
const championSquareUrl = (version, id) =>
  `https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${id}.png`;
const smiteUrl = (version) =>
  `https://ddragon.leagueoflegends.com/cdn/${version}/img/spell/SummonerSmite.png`;
const mapUrl = (version) =>
  `https://ddragon.leagueoflegends.com/cdn/${version}/img/map/map11.png`;

function usableAsset(path = "") {
  return String(path).startsWith("/render-assets/")
    && path !== RENDER_ASSET_FALLBACK_PUBLIC_PATH;
}

async function resolvePlayerRadarAssets(viewModel = {}, {
  cacheRemoteImageUrlImpl = cacheRemoteImageUrl,
  cacheRemoteImageUrlOptions = {},
  version = DDRAGON_RENDER_VERSION,
} = {}) {
  const cache = (url) => cacheRemoteImageUrlImpl(url, cacheRemoteImageUrlOptions);
  const edgePlayer = viewModel.matchup?.edgePlayer || {};
  const opponentPlayer = viewModel.matchup?.opponentPlayer || {};
  const proofPlayer = viewModel.proof?.player || {};
  const heroNames = [edgePlayer.championPlayed, opponentPlayer.championPlayed];
  const heroIds = heroNames.map(normalizeChampionId);
  const proofNames = (proofPlayer.champions || []).slice(0, 3);
  const proofIds = proofNames.map(normalizeChampionId);

  const [edgeSplash, edgeSquare, opponentSplash, opponentSquare, ...supporting] = await Promise.all([
    cache(championSplashUrl(heroIds[0])),
    cache(championSquareUrl(version, heroIds[0])),
    cache(championSplashUrl(heroIds[1])),
    cache(championSquareUrl(version, heroIds[1])),
    ...proofIds.map((id) => cache(championSquareUrl(version, id))),
    cache(smiteUrl(version)),
    cache(mapUrl(version)),
  ]);
  const proofSquares = supporting.slice(0, proofIds.length);
  const smiteSrc = supporting[proofIds.length];
  const mapSrc = supporting[proofIds.length + 1];

  const buildHero = (championName, splashSrc, squareSrc) => {
    if (!usableAsset(splashSrc) && !usableAsset(squareSrc)) {
      throw new Error(`Post Match Read official champion art unavailable for ${championName}: splash and square both failed.`);
    }
    if (!usableAsset(splashSrc) && !usableAsset(mapSrc)) {
      throw new Error(`Post Match Read official map unavailable for ${championName} square fallback.`);
    }
    return usableAsset(splashSrc)
      ? { championName, mode: "splash", src: splashSrc, squareSrc: usableAsset(squareSrc) ? squareSrc : null }
      : { championName, mode: "square-map", src: squareSrc, mapSrc };
  };

  return {
    matchup: {
      edge: buildHero(heroNames[0], edgeSplash, edgeSquare),
      opponent: buildHero(heroNames[1], opponentSplash, opponentSquare),
    },
    proof: {
      champions: proofNames.map((championName, index) => ({
        championName,
        src: usableAsset(proofSquares[index]) ? proofSquares[index] : null,
      })),
    },
    smiteSrc: usableAsset(smiteSrc) ? smiteSrc : null,
    mapSrc: usableAsset(mapSrc) ? mapSrc : null,
  };
}

module.exports = {
  championSplashUrl,
  championSquareUrl,
  smiteUrl,
  mapUrl,
  resolvePlayerRadarAssets,
};
