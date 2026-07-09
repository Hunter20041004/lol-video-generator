const { readCandidateSnapshot } = require("./candidateStore");
const { createPublishJobs: defaultCreatePublishJobs } = require("../publishing");
const { renderVideosFromRequest: defaultRenderVideosFromRequest } = require("../render/renderService");
const { buildRadarStats } = require("./seriesAggregator");

const PLAYER_RADAR_PLATFORMS = ["instagram", "threads"];
const MIN_AUTO_PROOF_AXES = 3;
const METRIC_FIELDS = {
  KDA: "kda",
  DPM: "dpm",
  "KP%": "kp",
  GPM: "gpm",
  CSM: "csm",
  VPM: "vpm",
};

function normalizeLanguages(languages = ["zh", "en"]) {
  const values = Array.isArray(languages) && languages.length > 0 ? languages : ["zh", "en"];
  return [...new Set(values.map((language) => String(language || "zh").toLowerCase().startsWith("en") ? "en" : "zh"))];
}

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function round(value, digits = 2) {
  const multiplier = 10 ** digits;
  return Math.round((Number(value) || 0) * multiplier) / multiplier;
}

function normalizePlayerName(name = "") {
  return String(name || "").trim().toLowerCase();
}

function summarizePlayer(player = {}) {
  return {
    name: player.name || "",
    team: player.team || "",
    role: player.role || "",
    championPlayed: player.champions?.[0] || player.champion || "",
    champions: Array.isArray(player.champions) ? player.champions : [],
    rawStats: player.rawStats || {},
    radarStats: sourceRadarStats(player),
  };
}

function sourceRadarStats(player = {}) {
  return buildRadarStats({
    ...(player.rawStats || {}),
    role: player.rawStats?.role || player.role,
  });
}

function sourceRadarStatsByMetric(player = {}) {
  return new Map(sourceRadarStats(player).map((stat) => [String(stat.label || "").toLowerCase(), stat]));
}

function averageStats(stats = []) {
  if (stats.length === 0) return 0;
  return stats.reduce((sum, stat) => sum + Number(stat.normalizedScore || 0), 0) / stats.length;
}

function findPlayer(series = {}, playerName = "") {
  const requested = normalizePlayerName(playerName);
  const players = Array.isArray(series.players) ? series.players : [];
  const player = players.find((candidate) => normalizePlayerName(candidate.name) === requested);
  if (!player) throw new Error(`Player not found in snapshot: ${playerName}`);
  return player;
}

function averageRadarScore(player = {}) {
  const stats = sourceRadarStats(player);
  if (stats.length < MIN_AUTO_PROOF_AXES) return Number.NEGATIVE_INFINITY;
  return averageStats(stats);
}

function calculateCommonMatchupScores(left = {}, right = {}) {
  const leftStats = sourceRadarStatsByMetric(left);
  const rightStats = sourceRadarStatsByMetric(right);
  const common = [...leftStats.entries()]
    .filter(([metric]) => rightStats.has(metric))
    .map(([metric, leftStat]) => ({
      leftScore: Number(leftStat.normalizedScore),
      rightScore: Number(rightStats.get(metric).normalizedScore),
    }))
    .filter((pair) => Number.isFinite(pair.leftScore) && Number.isFinite(pair.rightScore));
  if (common.length < 2) return null;
  const leftAverage = common.reduce((sum, pair) => sum + pair.leftScore, 0) / common.length;
  const rightAverage = common.reduce((sum, pair) => sum + pair.rightScore, 0) / common.length;
  return {
    leftAverage,
    rightAverage,
    edgeScore: round(Math.abs(leftAverage - rightAverage), 2),
  };
}

function selectPlayer(series = {}, playerName = "") {
  if (String(playerName || "").trim()) return findPlayer(series, playerName);

  const mvpName = series.recommendedMvp?.name;
  if (mvpName) {
    const player = (series.players || []).find((candidate) => candidate.name === mvpName);
    if (player) return player;
  }

  const player = [...(series.players || [])]
    .map((candidate) => ({ candidate, score: averageRadarScore(candidate) }))
    .filter((entry) => Number.isFinite(entry.score))
    .sort((a, b) => b.score - a.score)[0]?.candidate;
  if (!player) throw new Error(`Player not found in snapshot: ${playerName || "MVP"}`);
  return player;
}

function getRoleMatchups(series = {}) {
  if (Array.isArray(series.roleMatchups) && series.roleMatchups.length > 0) {
    return series.roleMatchups;
  }
  const teams = series.teams || [series.teamA, series.teamB].filter(Boolean);
  const players = Array.isArray(series.players) ? series.players : [];
  const roles = [...new Set(players.map((player) => player.role).filter(Boolean))];
  return roles.map((role) => ({
    role,
    left: players.find((player) => player.role === role && player.team === teams[0]) || null,
    right: players.find((player) => player.role === role && player.team === teams[1]) || null,
  }));
}

function getMetricValue(player = {}, label = "") {
  const field = METRIC_FIELDS[label];
  if (!field) return null;
  const rawValue = player.rawStats?.[field];
  if (rawValue === null || rawValue === undefined || String(rawValue).trim() === "") return null;
  const value = Number(rawValue);
  return Number.isFinite(value) ? value : null;
}

function getMetricDisplayValue(player = {}, label = "") {
  const field = METRIC_FIELDS[label];
  if (!field) return "";
  const rawValue = player.rawStats?.[field];
  const numericValue = Number(rawValue);
  if (!Number.isFinite(numericValue)) return "";
  if (label === "KP%") return `${Math.round(numericValue * 100)}%`;
  return String(rawValue);
}

function buildEdgeReasons(winner = {}, loser = {}) {
  const labels = ["KDA", "DPM", "KP%", "GPM", winner.role === "Support" ? "VPM" : "CSM"];
  return labels
    .map((label) => {
      const winnerValue = getMetricValue(winner, label);
      const loserValue = getMetricValue(loser, label);
      if (!Number.isFinite(winnerValue) || !Number.isFinite(loserValue)) return null;
      return {
        metric: label,
        winnerValue,
        loserValue,
        delta: round(winnerValue - loserValue, label === "DPM" || label === "GPM" ? 0 : 2),
      };
    })
    .filter((reason) => reason && reason.delta > 0)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 3);
}

function buildMatchupCandidate(series = {}, matchup = {}, focusPlayer = null) {
  if (!matchup.left || !matchup.right) return null;
  const commonScores = calculateCommonMatchupScores(matchup.left, matchup.right);
  if (!commonScores) return null;
  const leftScore = commonScores.leftAverage;
  const rightScore = commonScores.rightAverage;
  const edgePlayer = leftScore >= rightScore ? matchup.left : matchup.right;
  const metricOpponentPlayer = edgePlayer === matchup.left ? matchup.right : matchup.left;
  const opponentPlayer = focusPlayer
    ? (normalizePlayerName(focusPlayer.name) === normalizePlayerName(matchup.left.name) ? matchup.right : matchup.left)
    : metricOpponentPlayer;
  const reasons = buildEdgeReasons(edgePlayer, metricOpponentPlayer);
  const winningTeam = series.winningTeam || "";
  return {
    role: matchup.role,
    focusPlayer: summarizePlayer(focusPlayer || edgePlayer),
    edgePlayer: summarizePlayer(edgePlayer),
    opponentPlayer: summarizePlayer(opponentPlayer),
    edgeWinnerTeam: edgePlayer.team || "",
    edgeScore: commonScores.edgeScore,
    edgeType: winningTeam && edgePlayer.team !== winningTeam ? "loser-highlight" : "winner-breakpoint",
    reasons,
  };
}

function validateMatchupSegment(segment = {}) {
  if (!segment) {
    throw new Error("Player Radar matchup segment needs a complete role matchup.");
  }
  if ((segment.reasons || []).length < 2) {
    throw new Error(`Player Radar matchup segment needs at least 2 verifiable reasons for ${segment.role}.`);
  }
  return segment;
}

function selectMatchupSegment(series = {}, matchupPlayerName = "") {
  const matchups = getRoleMatchups(series);
  if (matchups.length === 0) throw new Error("Player Radar matchup segment needs at least one role matchup.");

  if (String(matchupPlayerName || "").trim()) {
    const focus = findPlayer(series, matchupPlayerName);
    const matchup = matchups.find((candidate) =>
      candidate.role === focus.role &&
      [candidate.left?.name, candidate.right?.name].includes(focus.name)
    );
    if (!matchup || !matchup.left || !matchup.right) {
      throw new Error(`Opponent not found in snapshot for player: ${matchupPlayerName}`);
    }
    const segment = buildMatchupCandidate(series, matchup, focus);
    if (!segment) {
      throw new Error(`Player Radar matchup segment needs at least 2 verifiable reasons for ${focus.role}.`);
    }
    return validateMatchupSegment(segment);
  }

  const candidates = matchups
    .map((matchup) => buildMatchupCandidate(series, matchup))
    .filter(Boolean)
    .sort((a, b) => Number(b.edgeScore || 0) - Number(a.edgeScore || 0));
  return validateMatchupSegment(candidates[0]);
}

function isRecommendedMvp(series = {}, player = {}) {
  return Boolean(series.recommendedMvp?.name && normalizePlayerName(series.recommendedMvp.name) === normalizePlayerName(player.name));
}

function buildProofReasons(player = {}) {
  return sourceRadarStats(player)
    .filter((stat) => stat?.label)
    .map((stat) => {
      const rawScore = stat.normalizedScore;
      if (rawScore === null || rawScore === undefined || rawScore === "") return null;
      const score = Number(rawScore);
      const inlineRawValue = stat.rawValue === null || stat.rawValue === undefined ? "" : String(stat.rawValue).trim();
      const rawValue = inlineRawValue || getMetricDisplayValue(player, stat.label);
      if (!Number.isFinite(score) || !rawValue) return null;
      return {
        metric: stat.label,
        rawValue,
        score,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}

function selectProofSegment(series = {}, proofPlayerName = "", locale = "zh") {
  const requested = String(proofPlayerName || "").trim();
  const player = requested ? findPlayer(series, requested) : selectPlayer(series);
  const proofReasons = buildProofReasons(player);
  if (proofReasons.length < 2) {
    throw new Error(`Player Radar proof segment needs at least 2 verifiable reasons for ${player.name}.`);
  }

  const recommended = isRecommendedMvp(series, player);
  const proofType = requested && !recommended ? "key-player" : "mvp";
  return {
    player: summarizePlayer(player),
    proofType,
    isRecommendedMvp: recommended,
    proofStats: proofReasons,
    proofReasons,
    verdict: locale === "en"
      ? `${player.name} has the strongest ${proofType === "mvp" ? "MVP" : "key-player"} case.`
      : `${player.name} 有這場最清楚的${proofType === "mvp" ? "MVP" : "關鍵人物"}理由。`,
  };
}

function buildPlayerRadarStoryboard(payload = {}, locale = "zh") {
  const matchupName = payload.matchupSegment?.focusPlayer?.name || payload.matchupSegment?.edgePlayer?.name || "對位焦點";
  const edgeName = payload.matchupSegment?.edgePlayer?.name || "";
  const proofName = payload.proofSegment?.player?.name || "關鍵人物";
  const focusOwnsEdge = normalizePlayerName(matchupName) === normalizePlayerName(edgeName);
  const samePlayer = normalizePlayerName(edgeName) === normalizePlayerName(proofName);
  if (locale === "en") {
    return [
      { tag: "HOOK", text: "Biggest lane gap\nsame as MVP?", durationInFrames: 90 },
      { tag: "MATCHUP_EDGE", text: focusOwnsEdge ? `${matchupName}\ncreated the matchup gap` : `${matchupName}\nwhere the matchup swung`, durationInFrames: 126 },
      { tag: "PLAYER_PROOF", text: `${proofName}\ncheck the player case`, durationInFrames: 126 },
      { tag: "CONCLUSION_CTA", text: samePlayer ? "One player, two cases\ncomment your read" : "Gap and MVP split\ncomment your read", durationInFrames: 90 },
    ];
  }
  return [
    { tag: "HOOK", text: "最大差距和 MVP\n是同一個人嗎", durationInFrames: 90 },
    { tag: "MATCHUP_EDGE", text: focusOwnsEdge ? `${matchupName}\n打出最大對位差` : `${matchupName}\n這路差距最關鍵`, durationInFrames: 126 },
    { tag: "PLAYER_PROOF", text: `${proofName}\n關鍵人物證明`, durationInFrames: 126 },
    { tag: "CONCLUSION_CTA", text: samePlayer ? "同一人雙重證明\n你同意嗎" : "對位差和關鍵人物\n你怎麼看", durationInFrames: 90 },
  ];
}

function normalizePayloadSelection(selectionOrPlayer = {}) {
  if (selectionOrPlayer?.name) return { playerName: selectionOrPlayer.name };
  return selectionOrPlayer || {};
}

function buildPlayerRadarPayload(series = {}, selectionOrPlayer = {}, locale = "zh") {
  const selection = normalizePayloadSelection(selectionOrPlayer);
  const matchupName = selection.matchupPlayerName || selection.playerName || "";
  const proofName = selection.mvpPlayerName || selection.playerName || "";
  const matchupSegment = selectMatchupSegment(series, matchupName);
  const proofSegment = selectProofSegment(series, proofName, locale);
  const teams = `${series.teamA || series.teams?.[0] || ""} vs ${series.teamB || series.teams?.[1] || ""}`;
  const payload = {
    dataType: "PLAYER_RADAR",
    locale,
    seriesId: series.seriesId,
    matchContext: {
      league: series.league,
      teamA: series.teamA || series.teams?.[0] || "",
      teamB: series.teamB || series.teams?.[1] || "",
      winningTeam: series.winningTeam || "",
      seriesScore: series.seriesScore || series.score || "",
    },
    title: locale === "en" ? `${teams} Player Radar` : `${teams} 選手雷達`,
    matchupSegment,
    proofSegment,
    player: proofSegment.player,
    radarStats: proofSegment.player.radarStats || [],
    highlight: proofSegment.proofReasons[0]?.metric || "",
    weakness: matchupSegment.reasons.at(-1)?.metric || "",
    verdict: proofSegment.verdict,
  };
  return {
    ...payload,
    storyboard: buildPlayerRadarStoryboard(payload, locale),
  };
}

async function runPlayerRadarFromSnapshot(options = {}, deps = {}) {
  const snapshot = readCandidateSnapshot(options.scanId);
  const series = (snapshot.candidates || []).find((candidate) => candidate.seriesId === options.seriesId);
  if (!series) throw new Error(`Series not found in snapshot: ${options.seriesId || "UNKNOWN"}`);

  const selection = {
    playerName: options.playerName,
    matchupPlayerName: options.matchupPlayerName,
    mvpPlayerName: options.mvpPlayerName,
  };
  const languages = normalizeLanguages(options.languages);
  const renderVideosFromRequest = deps.renderVideosFromRequest || defaultRenderVideosFromRequest;
  const createPublishJobs = deps.createPublishJobs || defaultCreatePublishJobs;
  const videos = [];
  const payloads = [];

  for (const locale of languages) {
    const payload = buildPlayerRadarPayload(series, selection, locale);
    payloads.push(payload);
    const render = await renderVideosFromRequest({
      ...payload,
      renderLanguages: [locale],
    });
    const video = Array.isArray(render.videos) ? render.videos[0] : {
      locale,
      videoUrl: render.videoUrl,
      fileName: render.fileName,
    };
    videos.push({ ...video, type: "player-radar", locale });
  }

  const publish = await createPublishJobs({
    videos,
    platforms: PLAYER_RADAR_PLATFORMS,
    action: "queue",
    analysis: payloads[0]
      ? {
        ...payloads[0],
        localizedPayloads: Object.fromEntries(payloads.map((payload) => [payload.locale, payload])),
      }
      : { dataType: "PLAYER_RADAR" },
    scheduledAt: options.scheduledAt,
  });

  return {
    success: true,
    scanId: snapshot.scanId,
    seriesId: series.seriesId,
    player: payloads[0]?.proofSegment?.player || null,
    matchupSegment: payloads[0]?.matchupSegment || null,
    proofSegment: payloads[0]?.proofSegment || null,
    languages,
    payloads,
    videos,
    publish,
  };
}

module.exports = {
  PLAYER_RADAR_PLATFORMS,
  normalizeLanguages,
  selectPlayer,
  selectMatchupSegment,
  selectProofSegment,
  buildPlayerRadarPayload,
  runPlayerRadarFromSnapshot,
};
