const REQUIRED_ROLES = Object.freeze(["Top", "Jungle", "Mid", "Adc", "Support"]);

const POST_MATCH_READ_STORYBOARD = Object.freeze([
  { tag: "HOOK", durationInFrames: 54 },
  { tag: "MATCHUP_EDGE", durationInFrames: 96 },
  { tag: "PLAYER_PROOF", durationInFrames: 120 },
  { tag: "CONCLUSION_CTA", durationInFrames: 90 },
]);

const PUBLIC_COPY = Object.freeze({
  zh: {
    publicTitle: "賽後判讀",
    publicTitleEn: "POST MATCH READ",
    hookQuestion: (role) => `這個系列賽，${role}差距有多誇張？`,
    localClaim: (role) => `${role}差距明顯`,
    maximumClaim: (role) => `五路之中，${role}差距最大`,
    matchupVerdict: "不是小贏，是整個系列賽的斷層。",
    twist: "但真正把優勢變成傷害的，在下路。",
    verdict: "打野拉開局勢，下路把優勢變成勝利。",
    cta: "下一場，你想看哪條路？",
    dataMvpCandidate: "數據 MVP 候選",
    keyPlayer: "關鍵人物",
    officialMvp: "官方 MVP",
  },
  en: {
    publicTitle: "POST MATCH READ",
    publicTitleEn: "POST MATCH READ",
    hookQuestion: (role) => `How wide was the ${role.toLowerCase()} gap?`,
    localClaim: (role) => `A clear ${role.toLowerCase()} gap`,
    maximumClaim: (role) => `The biggest gap across all five roles: ${role}`,
    matchupVerdict: "Not a small edge — a series-long break.",
    twist: "But bot lane turned the lead into damage.",
    verdict: "Jungle built the lead; bot lane turned it into the win.",
    cta: "Which role should we read next?",
    dataMvpCandidate: "DATA MVP CANDIDATE",
    keyPlayer: "KEY PLAYER",
    officialMvp: "OFFICIAL MVP",
  },
});

const ZH_ROLE_LABELS = Object.freeze({
  Top: "上路",
  Jungle: "打野",
  Mid: "中路",
  Adc: "下路",
  Support: "輔助",
});

function hasAllFiveRoleMatchups(series = {}) {
  const complete = new Set(
    (series.roleMatchups || [])
      .filter((matchup) => matchup.left && matchup.right)
      .map((matchup) => matchup.role)
  );
  return REQUIRED_ROLES.every((role) => complete.has(role));
}

function samePlayer(left = {}, right = {}) {
  return Boolean(left.name && right.name && left.name === right.name);
}

function proofLabelType(series = {}, proofPlayer = {}, requestedProofName = "") {
  if (samePlayer(series.officialMvp, proofPlayer)) return "official-mvp";
  if (requestedProofName && !samePlayer(series.recommendedMvp, proofPlayer)) return "key-player";
  return samePlayer(series.recommendedMvp, proofPlayer) ? "data-mvp-candidate" : "key-player";
}

function buildRatioHook(reason = {}, locale = "zh") {
  const left = Number(reason.winnerValue);
  const right = Number(reason.loserValue);
  if (Number.isFinite(left) && Number.isFinite(right) && right > 0 && left / right >= 2) {
    const ratio = Math.round(left / right);
    return {
      metric: reason.metric,
      leftRaw: left,
      rightRaw: right,
      comparisonType: "ratio",
      approximate: true,
      displayValue: locale === "en" ? `~${ratio}×` : `約 ${ratio}×`,
    };
  }
  return {
    metric: reason.metric,
    leftRaw: left,
    rightRaw: right,
    comparisonType: right === 0 ? "side-by-side" : "raw-delta",
    approximate: false,
    displayValue: `${left} vs ${right}`,
  };
}

function shortTeamLabel(team = "", abbreviation = "") {
  if (String(abbreviation).trim()) return String(abbreviation).trim();
  const cleaned = String(team)
    .replace(/\b(?:Team|Esports|Challengers)\b/gi, " ")
    .trim();
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length <= 1) return cleaned.slice(0, 4).toUpperCase();
  return words.map((word) => word[0]).join("").slice(0, 4).toUpperCase();
}

function buildPostMatchReadViewModel({
  series = {},
  matchupSegment = {},
  proofSegment = {},
  selection = {},
  locale = "zh",
} = {}) {
  const copy = PUBLIC_COPY[locale] || PUBLIC_COPY.zh;
  const role = matchupSegment.role || "Jungle";
  const localizedRole = locale === "zh" ? (ZH_ROLE_LABELS[role] || role) : role;
  const allRoles = hasAllFiveRoleMatchups(series);
  const manualMatchup = Boolean(selection.matchupPlayerName || selection.playerName);
  const claimScope = allRoles && !manualMatchup ? "series-maximum" : "role-local";
  const claim = claimScope === "series-maximum"
    ? copy.maximumClaim(localizedRole)
    : copy.localClaim(localizedRole);
  const hook = buildRatioHook(matchupSegment.reasons?.[0], locale);
  const proofPlayer = proofSegment.player || {};
  const labelType = proofLabelType(series, proofPlayer, selection.mvpPlayerName || selection.playerName || "");
  const label = labelType === "official-mvp"
    ? copy.officialMvp
    : labelType === "data-mvp-candidate"
      ? copy.dataMvpCandidate
      : copy.keyPlayer;
  const scopeLabel = `${series.league || ""} · ${series.score || series.seriesScore || ""}`.replace(/\s*·\s*$/, "");
  const sourceTeamA = series.teamA || series.teams?.[0] || "";
  const sourceTeamB = series.teamB || series.teams?.[1] || "";

  return {
    branding: { publicTitle: copy.publicTitle, publicTitleEn: copy.publicTitleEn },
    seriesContext: {
      league: series.league || "",
      seriesId: series.seriesId || "",
      teamA: shortTeamLabel(sourceTeamA, series.teamAAbbreviation),
      teamB: shortTeamLabel(sourceTeamB, series.teamBAbbreviation),
      score: series.score || series.seriesScore || "",
      gameCount: Array.isArray(series.games) ? series.games.length : 0,
      scopeLabel,
    },
    hook: { ...hook, question: copy.hookQuestion(localizedRole) },
    matchup: {
      ...matchupSegment,
      hasAllFiveRoles: allRoles,
      claimScope,
      claim,
      scopeLabel,
    },
    proof: {
      ...proofSegment,
      labelType,
      label,
      claim: `${label}: ${proofPlayer.name || ""}`.replace(/:\s*$/, ""),
    },
    assets: {},
    audioPlan: null,
    storyboard: POST_MATCH_READ_STORYBOARD.map((scene) => ({
      ...scene,
      text: scene.tag === "HOOK"
        ? copy.hookQuestion(localizedRole)
        : scene.tag === "MATCHUP_EDGE"
          ? copy.matchupVerdict
          : scene.tag === "PLAYER_PROOF"
            ? copy.twist
            : `${copy.verdict}\n${copy.cta}`,
    })),
  };
}

module.exports = {
  PUBLIC_COPY,
  REQUIRED_ROLES,
  POST_MATCH_READ_STORYBOARD,
  buildRatioHook,
  hasAllFiveRoleMatchups,
  proofLabelType,
  buildPostMatchReadViewModel,
};
