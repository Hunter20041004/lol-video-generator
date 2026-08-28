const REQUIRED_ROLES = Object.freeze(["Top", "Jungle", "Mid", "Adc", "Support"]);

const POST_MATCH_READ_STORYBOARD = Object.freeze([
  { tag: "RESULT_HOOK", durationInFrames: 120 },
  { tag: "MATCHUP_EDGE", durationInFrames: 150 },
  { tag: "GAME_FLOW", durationInFrames: 240 },
  { tag: "PLAYER_PROOF", durationInFrames: 150 },
  { tag: "FINAL_READ", durationInFrames: 90 },
]);

const PUBLIC_COPY = Object.freeze({
  zh: {
    publicTitle: "賽後判讀",
    publicTitleEn: "POST MATCH READ",
    hookQuestion: (role) => `這個系列賽，${role}差距有多誇張？`,
    localClaim: (role) => `${role}差距明顯`,
    maximumClaim: (role) => `五路之中，${role}差距最大`,
    matchupVerdict: "不是小贏，是整個系列賽的斷層。",
    gameFlowVerdict: "物件本身不是勝點，物件之後換到幾座塔才是。",
    finalVerdict: "把每次領先換成塔與輸出。",
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
    gameFlowVerdict: "Objectives matter only when they become map control.",
    finalVerdict: "Turn every lead into towers and damage.",
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

const ROLE_READS_ZH = Object.freeze({
  Top: "上路把對線資源換成邊線壓力。",
  Jungle: "打野把資源控制換成地圖節奏。",
  Mid: "不是一波打贏。是每分鐘都在擴大差距。",
  Adc: "下路把穩定經濟換成持續輸出。",
  Support: "輔助把視野與參戰換成開戰主導權。",
});

const ROLE_READS_EN = Object.freeze({
  Top: "Top lane turned resources into side-lane pressure.",
  Jungle: "Jungle turned objective control into map tempo.",
  Mid: "It was not one play. The gap grew every minute.",
  Adc: "Bot lane turned stable income into sustained damage.",
  Support: "Support turned vision and participation into engage control.",
});

function buildMatchupPrimaryEvidence(matchup = {}) {
  const reason = (matchup.reasons || [])[0] || {};
  const delta = Number(reason.delta);
  if (!reason.metric || !Number.isFinite(delta) || delta <= 0) {
    throw new Error("Post Match Read matchup requires a positive primary evidence delta.");
  }
  return {
    metric: reason.metric,
    winnerValue: Number(reason.winnerValue),
    loserValue: Number(reason.loserValue),
    delta,
    displayValue: `+${delta} ${reason.metric}`,
  };
}

function hasFinalTeamEvidence(team = {}) {
  return [team.voidGrubs, team.riftHeralds, team.barons, team.towers, team.gold]
    .every((value) => Number.isFinite(Number(value)));
}

const PRECISE_EVENT_PATTERN = /\b\d{1,2}:\d{2}\b|→\s*(?:上路|中路|下路|top|mid|bot)/i;

function assertNoPreciseEventNarrative(text = "") {
  if (PRECISE_EVENT_PATTERN.test(String(text))) {
    throw new Error("Post Match Read team-final narrative cannot contain an event timestamp or precise path.");
  }
  return text;
}

function buildGameFlow(series = {}, locale = "zh") {
  const game = (series.gameTeamStats || []).find((candidate) =>
    candidate?.hasEventTimestamps === false
    && Array.isArray(candidate.teams)
    && candidate.teams.length === 2
    && candidate.teams.every(hasFinalTeamEvidence)
  );
  if (!game) return null;

  const [first, second] = game.teams;
  const earlyResourceScore = (team) => Number(team.voidGrubs) + Number(team.riftHeralds);
  const early = earlyResourceScore(first) >= earlyResourceScore(second) ? first : second;
  const final = game.teams.find((team) => team.team === game.winningTeam);
  const other = game.teams.find((team) => team !== final);
  if (!final || !other || Number(final.towers) <= Number(other.towers)) return null;

  const analysisClaim = locale === "en"
    ? `${early.team} secured the early resources; ${final.team} finished with the map.`
    : `${early.team} 拿到前期資源，${final.team} 最後拿走地圖。`;
  const conclusion = locale === "en"
    ? "Objectives are not the win condition. What they become on the map is."
    : "物件本身不是勝點，物件之後換到幾座塔才是。";
  assertNoPreciseEventNarrative(analysisClaim);
  assertNoPreciseEventNarrative(conclusion);

  return {
    gameNumber: Number(game.gameNumber),
    gameId: String(game.gameId || ""),
    earlyResourceTeam: String(early.team || ""),
    finalMapTeam: String(final.team || ""),
    earlyResources: {
      voidGrubs: Number(early.voidGrubs),
      riftHeralds: Number(early.riftHeralds),
      displayValue: `${Number(early.voidGrubs)}＋${Number(early.riftHeralds)}`,
    },
    conversion: {
      barons: Number(final.barons),
      towers: Number(final.towers),
      displayValue: `${Number(final.barons)} → ${Number(final.towers)}`,
    },
    goldDelta: Number(final.gold) - Number(other.gold),
    towerScore: `${Number(final.towers)}–${Number(other.towers)}`,
    teamFinals: game.teams.map((team) => ({ ...team })),
    analysisClaim,
    conclusion,
    claimBasis: {
      source: "ScoreboardTeams",
      snapshotType: "team-final",
      fields: ["VoidGrubs", "RiftHeralds", "Barons", "Towers", "Gold"],
      hasEventTimestamps: false,
    },
  };
}

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

function publicPlayer(player = {}) {
  return {
    ...player,
    name: String(player.name || "").replace(/\s*\([^)]*\)\s*$/, "").trim(),
  };
}

function splitScore(score = "") {
  const match = String(score || "").trim().match(/^(\d+)\s*[-–:]\s*(\d+)$/);
  if (!match) throw new Error(`Post Match Read series score is invalid: ${score || "missing"}.`);
  return { left: match[1], separator: "–", right: match[2] };
}

function buildProofRecap(proofSegment = {}) {
  const csm = Number(proofSegment.player?.rawStats?.csm);
  if (Number.isFinite(csm)) {
    return { source: "proof", metric: "CSM", displayValue: `${csm} CSM` };
  }
  const reason = (proofSegment.proofReasons || proofSegment.proofStats || [])[0] || {};
  if (!reason.metric || reason.rawValue === undefined || reason.rawValue === null || String(reason.rawValue).trim() === "") {
    throw new Error("Post Match Read final read requires a displayed proof metric.");
  }
  return {
    source: "proof",
    metric: String(reason.metric),
    displayValue: `${reason.rawValue} ${reason.metric}`,
  };
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
  const roleReads = locale === "en" ? ROLE_READS_EN : ROLE_READS_ZH;
  if (!roleReads[role]) throw new Error(`Post Match Read role copy unavailable for ${role}.`);
  const localizedRole = locale === "zh" ? (ZH_ROLE_LABELS[role] || role) : role;
  const allRoles = hasAllFiveRoleMatchups(series);
  const manualMatchup = Boolean(selection.matchupPlayerName || selection.playerName);
  const claimScope = allRoles && !manualMatchup ? "series-maximum" : "role-local";
  const scopeClaim = claimScope === "series-maximum"
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
  const gameFlow = buildGameFlow(series, locale);
  const score = series.score || series.seriesScore || "";
  const primaryEvidence = buildMatchupPrimaryEvidence(matchupSegment);
  const winningTeam = shortTeamLabel(series.winningTeam || sourceTeamA);
  const resultHook = {
    scoreParts: splitScore(score),
    resultClaim: locale === "en"
      ? `${winningTeam} won the series ${score}.`
      : `${winningTeam} 以 ${score.replace("-", "–")} 拿下系列賽。`,
    displayOrder: [shortTeamLabel(sourceTeamA), shortTeamLabel(sourceTeamB)],
  };
  const finalRead = {
    conclusion: locale === "en"
      ? `${winningTeam} did not win by taking more. Every lead became towers and damage.`
      : `${winningTeam} 的勝點不是搶得多，而是把每次領先換成塔與輸出。`,
    recapReferences: [
      { source: "matchup", metric: primaryEvidence.metric, displayValue: primaryEvidence.displayValue },
      buildProofRecap(proofSegment),
    ],
  };

  return {
    branding: { publicTitle: copy.publicTitle, publicTitleEn: copy.publicTitleEn },
    seriesContext: {
      league: series.league || "",
      seriesId: series.seriesId || "",
      snapshotId: selection.snapshotId || series.snapshotId || "",
      season: String(series.season || String(series.date || "").slice(0, 4) || ""),
      matchDate: String(series.date || "").slice(0, 10),
      teamA: shortTeamLabel(sourceTeamA, series.teamAAbbreviation),
      teamB: shortTeamLabel(sourceTeamB, series.teamBAbbreviation),
      score,
      gameCount: Array.isArray(series.games) ? series.games.length : Number(series.games || 0),
      scopeLabel,
    },
    resultHook,
    hook: { ...hook, question: copy.hookQuestion(localizedRole) },
    matchup: {
      ...matchupSegment,
      focusPlayer: publicPlayer(matchupSegment.focusPlayer),
      edgePlayer: publicPlayer(matchupSegment.edgePlayer),
      opponentPlayer: publicPlayer(matchupSegment.opponentPlayer),
      hasAllFiveRoles: allRoles,
      claimScope,
      scopeClaim,
      claim: roleReads[role],
      primaryEvidence,
      scopeLabel,
    },
    gameFlow,
    proof: {
      ...proofSegment,
      labelType,
      label,
      claim: `${label}: ${proofPlayer.name || ""}`.replace(/:\s*$/, ""),
    },
    finalRead,
    assets: {},
    audioPlan: null,
    storyboard: POST_MATCH_READ_STORYBOARD.map((scene) => ({
      ...scene,
      text: scene.tag === "RESULT_HOOK"
        ? copy.hookQuestion(localizedRole)
        : scene.tag === "MATCHUP_EDGE"
          ? copy.matchupVerdict
          : scene.tag === "GAME_FLOW"
            ? copy.gameFlowVerdict
          : scene.tag === "PLAYER_PROOF"
            ? proofSegment.verdict || proofSegment.claim || ""
            : copy.finalVerdict,
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
  buildMatchupPrimaryEvidence,
  buildGameFlow,
  assertNoPreciseEventNarrative,
  splitScore,
  buildPostMatchReadViewModel,
};
