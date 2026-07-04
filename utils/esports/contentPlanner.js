const ROLE_LABELS_ZH = {
  Top: "上路",
  Jungle: "打野",
  Mid: "中路",
  Adc: "下路",
  Support: "輔助",
};

const ROLE_LABELS_EN = {
  Top: "Top",
  Jungle: "Jungle",
  Mid: "Mid",
  Adc: "ADC",
  Support: "Support",
};

const METRIC_FIELDS = {
  KDA: "kda",
  DPM: "dpm",
  "KP%": "kp",
  GPM: "gpm",
  CSM: "csm",
  VPM: "vpm",
};

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function round(value, digits = 2) {
  const multiplier = 10 ** digits;
  return Math.round((Number(value) || 0) * multiplier) / multiplier;
}

function averageRadarScore(player = {}) {
  const stats = Array.isArray(player?.radarStats) ? player.radarStats : [];
  if (stats.length === 0) return 0;
  return round(stats.reduce((sum, stat) => sum + number(stat.normalizedScore), 0) / stats.length, 2);
}

function getMetricValue(player = {}, label = "") {
  const field = METRIC_FIELDS[label];
  return field ? number(player?.rawStats?.[field]) : 0;
}

function buildEdgeReasons(winner = {}, loser = {}) {
  const labels = ["KDA", "DPM", "KP%", "GPM", winner.role === "Support" ? "VPM" : "CSM"];
  return labels
    .map((label) => ({
      metric: label,
      winnerValue: getMetricValue(winner, label),
      loserValue: getMetricValue(loser, label),
      delta: round(getMetricValue(winner, label) - getMetricValue(loser, label), label === "KP%" ? 2 : 0),
    }))
    .filter((reason) => reason.delta > 0)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 2);
}

function buildMatchupEdges(series = {}) {
  return (series.roleMatchups || []).map((matchup) => {
    const leftScore = averageRadarScore(matchup.left);
    const rightScore = averageRadarScore(matchup.right);
    const winnerSide = leftScore >= rightScore ? "left" : "right";
    const winner = matchup[winnerSide];
    const loser = winnerSide === "left" ? matchup.right : matchup.left;

    return {
      role: matchup.role,
      edgeWinner: winner?.team || "",
      edgePlayer: winner?.name || "",
      edgeScore: round(Math.abs(leftScore - rightScore), 2),
      left: summarizePlayer(matchup.left),
      right: summarizePlayer(matchup.right),
      reasons: winner && loser ? buildEdgeReasons(winner, loser) : [],
    };
  });
}

function summarizePlayer(player = {}) {
  return {
    team: player?.team || "",
    name: player?.name || "",
    role: player?.role || "",
    champions: Array.isArray(player?.champions) ? player.champions : [],
    rawStats: player?.rawStats || {},
    radarStats: player?.radarStats || [],
  };
}

function strongestEdge(edges = []) {
  return [...edges].sort((a, b) => number(b.edgeScore) - number(a.edgeScore))[0] || null;
}

function buildRecapPoints(series = {}, matchupEdges = []) {
  const winningTeam = series.winningTeam || series.teams?.[0] || "";
  const losingTeam = (series.teams || []).find((team) => team !== winningTeam) || "";
  const winnerStats = series.teamStats?.[winningTeam] || {};
  const loserStats = series.teamStats?.[losingTeam] || {};
  const edge = strongestEdge(matchupEdges);
  const points = [
    {
      id: "series-result",
      type: "result",
      team: winningTeam,
      metric: "score",
      value: series.score || "",
      summary: `${winningTeam} won ${series.score || "the series"}`,
    },
  ];

  if (edge) {
    points.push({
      id: `matchup-edge-${edge.role}`,
      type: "matchup-edge",
      role: edge.role,
      team: edge.edgeWinner,
      player: edge.edgePlayer,
      metric: edge.reasons[0]?.metric || "radar",
      value: edge.reasons[0]?.winnerValue ?? edge.edgeScore,
      opponentValue: edge.reasons[0]?.loserValue,
      summary: `${edge.edgePlayer} created the clearest ${edge.role} edge`,
    });
  }

  points.push({
    id: "team-damage-gap",
    type: "team-gap",
    team: winningTeam,
    metric: "damageToChampions",
    value: number(winnerStats.damageToChampions),
    opponentValue: number(loserStats.damageToChampions),
    delta: number(winnerStats.damageToChampions) - number(loserStats.damageToChampions),
    summary: `${winningTeam} led team damage by ${number(winnerStats.damageToChampions) - number(loserStats.damageToChampions)}`,
  });

  points.push({
    id: "team-gold-gap",
    type: "team-gap",
    team: winningTeam,
    metric: "gold",
    value: number(winnerStats.gold),
    opponentValue: number(loserStats.gold),
    delta: number(winnerStats.gold) - number(loserStats.gold),
    summary: `${winningTeam} led gold by ${number(winnerStats.gold) - number(loserStats.gold)}`,
  });

  return points.slice(0, 4);
}

function localizeTitle(series = {}, locale = "zh", kind = "radar") {
  const teams = `${series.teamA || series.teams?.[0] || ""} vs ${series.teamB || series.teams?.[1] || ""}`;
  if (locale === "en") return kind === "radar" ? `${teams} Head-to-Head Radar` : `${teams} Match Recap`;
  return kind === "radar" ? `${teams} 五路對位雷達` : `${teams} 賽後數據快報`;
}

function localizeStoryboard(series = {}, locale = "zh", kind = "radar") {
  const teams = `${series.teamA || series.teams?.[0] || ""} vs ${series.teamB || series.teams?.[1] || ""}`;
  if (kind === "radar") {
    return locale === "en" ? [
      { tag: "HOOK", text: `${teams}\nrole by role`, durationInFrames: 90 },
      { tag: "MATCHUPS", text: "Five lane edges\nsame series data", durationInFrames: 300 },
      { tag: "CONCLUSION_CTA", text: "Which edge decided it?\nComment your pick", durationInFrames: 90 },
    ] : [
      { tag: "HOOK", text: `${teams}\n五路對位開拆`, durationInFrames: 90 },
      { tag: "MATCHUPS", text: "同一場系列賽\n五個位置直接比", durationInFrames: 300 },
      { tag: "CONCLUSION_CTA", text: "你覺得哪路最關鍵\n留言告訴我", durationInFrames: 90 },
    ];
  }

  return locale === "en" ? [
    { tag: "HOOK", text: `${teams}\nwhy it mattered`, durationInFrames: 90 },
    { tag: "RECAP_POINTS", text: "Three data-backed gaps\nexplain the result", durationInFrames: 260 },
    { tag: "CONCLUSION_CTA", text: "Follow for daily LoL recaps", durationInFrames: 90 },
  ] : [
    { tag: "HOOK", text: `${teams}\n這場為什麼值得看`, durationInFrames: 90 },
    { tag: "RECAP_POINTS", text: "三個數據差距\n說清楚勝負關鍵", durationInFrames: 260 },
    { tag: "CONCLUSION_CTA", text: "每天賽後重點\n追蹤看下一場", durationInFrames: 90 },
  ];
}

function buildLocalizedPayloads(series = {}, semantic = {}, locale = "zh") {
  const radar = {
    dataType: "ESPORTS_H2H_RADAR",
    locale,
    seriesId: series.seriesId,
    title: localizeTitle(series, locale, "radar"),
    caption: locale === "en" ? "Five roles, one shared data read." : "五路對位，一次看懂整場系列賽。",
    cta: locale === "en" ? "Comment the decisive role." : "留言你覺得最關鍵的位置。",
    match: semantic.match,
    matchupEdges: semantic.matchupEdges,
    roleSegments: semantic.matchupEdges.map((edge) => ({
      role: locale === "en" ? ROLE_LABELS_EN[edge.role] || edge.role : ROLE_LABELS_ZH[edge.role] || edge.role,
      edgePlayer: edge.edgePlayer,
      edgeWinner: edge.edgeWinner,
      reasons: edge.reasons,
    })),
    storyboard: localizeStoryboard(series, locale, "radar"),
  };

  const recap = {
    dataType: "ESPORTS_MATCH_RECAP",
    locale,
    seriesId: series.seriesId,
    title: localizeTitle(series, locale, "recap"),
    caption: locale === "en" ? "A recap built from series-level numbers." : "用系列賽數據講清楚勝負關鍵。",
    cta: locale === "en" ? "Save this before the next match." : "下一場前先收藏這支。",
    match: semantic.match,
    recapPoints: semantic.recapPoints,
    keyPlayers: semantic.keyPlayers,
    storyboard: localizeStoryboard(series, locale, "recap"),
  };

  return { radar, recap };
}

function planSeriesContent(series = {}) {
  const matchupEdges = buildMatchupEdges(series);
  const recapPoints = buildRecapPoints(series, matchupEdges);
  const semantic = {
    seriesId: series.seriesId,
    match: {
      league: series.league,
      tournament: series.tournament,
      date: series.date,
      teams: series.teams || [series.teamA, series.teamB].filter(Boolean),
      winningTeam: series.winningTeam,
      score: series.score,
      games: series.games,
    },
    matchupEdges,
    recapPoints,
    keyPlayers: matchupEdges.slice(0, 2).map((edge) => edge.edgePlayer).filter(Boolean),
    contentConfidence: series.completeness?.hasTenPlayers && series.completeness?.hasFiveRoleMatchups ? "high" : "needs_review",
    dataCompleteness: series.completeness || {},
  };

  return {
    semantic,
    localized: {
      zh: buildLocalizedPayloads(series, semantic, "zh"),
      en: buildLocalizedPayloads(series, semantic, "en"),
    },
  };
}

module.exports = {
  planSeriesContent,
  buildMatchupEdges,
  buildRecapPoints,
};
