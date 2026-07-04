const { readCandidateSnapshot } = require("./candidateStore");
const { createPublishJobs: defaultCreatePublishJobs } = require("../publishing");
const { renderVideosFromRequest: defaultRenderVideosFromRequest } = require("../render/renderService");

const PLAYER_RADAR_PLATFORMS = ["instagram", "threads"];

function normalizeLanguages(languages = ["zh", "en"]) {
  const values = Array.isArray(languages) && languages.length > 0 ? languages : ["zh", "en"];
  return [...new Set(values.map((language) => String(language || "zh").toLowerCase().startsWith("en") ? "en" : "zh"))];
}

function averageRadarScore(player = {}) {
  const stats = Array.isArray(player.radarStats) ? player.radarStats : [];
  if (stats.length === 0) return 0;
  return stats.reduce((sum, stat) => sum + Number(stat.normalizedScore || 0), 0) / stats.length;
}

function selectPlayer(series = {}, playerName = "") {
  const players = Array.isArray(series.players) ? series.players : [];
  const requested = String(playerName || "").trim().toLowerCase();
  if (requested) {
    const player = players.find((candidate) => String(candidate.name || "").toLowerCase() === requested);
    if (!player) throw new Error(`Player not found in snapshot: ${playerName}`);
    return player;
  }

  const mvpName = series.recommendedMvp?.name;
  if (mvpName) {
    const player = players.find((candidate) => candidate.name === mvpName);
    if (player) return player;
  }
  const player = [...players].sort((a, b) => averageRadarScore(b) - averageRadarScore(a))[0];
  if (!player) throw new Error(`Player not found in snapshot: ${playerName || "MVP"}`);
  return player;
}

function buildPlayerRadarPayload(series = {}, player = {}, locale = "zh") {
  const highlight = [...(player.radarStats || [])].sort((a, b) => Number(b.normalizedScore || 0) - Number(a.normalizedScore || 0))[0];
  const weakness = [...(player.radarStats || [])].sort((a, b) => Number(a.normalizedScore || 0) - Number(b.normalizedScore || 0))[0];
  const teams = `${series.teamA || series.teams?.[0] || ""} vs ${series.teamB || series.teams?.[1] || ""}`;
  const isEn = locale === "en";

  return {
    dataType: "PLAYER_RADAR",
    locale,
    seriesId: series.seriesId,
    matchContext: {
      league: series.league,
      teamA: series.teamA || series.teams?.[0] || "",
      teamB: series.teamB || series.teams?.[1] || "",
      seriesScore: series.seriesScore || series.score || "",
    },
    player: {
      name: player.name,
      role: player.role,
      championPlayed: player.champions?.[0] || player.champion || "",
      team: player.team,
    },
    radarStats: player.radarStats || [],
    highlight: highlight?.label || "",
    weakness: weakness?.label || "",
    verdict: isEn ? `${player.name} is the data lead` : `${player.name} 是數據焦點`,
    storyboard: isEn ? [
      { tag: "HOOK", text: `${player.name}\n${teams}`, durationInFrames: 90 },
      { tag: "STAT_REVEAL", text: `${highlight?.label || "Radar"} leads\ncheck the score`, durationInFrames: 120 },
      { tag: "STAT_REVEAL", text: `${weakness?.label || "Floor"} is the question\nwatch the context`, durationInFrames: 120 },
      { tag: "CONCLUSION_CTA", text: "MVP or just hype?\nComment your read", durationInFrames: 90 },
    ] : [
      { tag: "HOOK", text: `${player.name}\n${teams}`, durationInFrames: 90 },
      { tag: "STAT_REVEAL", text: `${highlight?.label || "雷達"} 是強項\n先看分數`, durationInFrames: 120 },
      { tag: "STAT_REVEAL", text: `${weakness?.label || "低點"} 是疑問\n要看比賽脈絡`, durationInFrames: 120 },
      { tag: "CONCLUSION_CTA", text: "這場是不是 MVP\n留言告訴我", durationInFrames: 90 },
    ],
  };
}

async function runPlayerRadarFromSnapshot(options = {}, deps = {}) {
  const snapshot = readCandidateSnapshot(options.scanId);
  const series = (snapshot.candidates || []).find((candidate) => candidate.seriesId === options.seriesId);
  if (!series) throw new Error(`Series not found in snapshot: ${options.seriesId || "UNKNOWN"}`);

  const player = selectPlayer(series, options.playerName);
  const languages = normalizeLanguages(options.languages);
  const renderVideosFromRequest = deps.renderVideosFromRequest || defaultRenderVideosFromRequest;
  const createPublishJobs = deps.createPublishJobs || defaultCreatePublishJobs;
  const videos = [];
  const payloads = [];

  for (const locale of languages) {
    const payload = buildPlayerRadarPayload(series, player, locale);
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
    analysis: payloads[0] || { dataType: "PLAYER_RADAR" },
    scheduledAt: options.scheduledAt,
  });

  return {
    success: true,
    scanId: snapshot.scanId,
    seriesId: series.seriesId,
    player,
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
  buildPlayerRadarPayload,
  runPlayerRadarFromSnapshot,
};
