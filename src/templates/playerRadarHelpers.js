const ROLE_LABELS = {
  zh: {
    Top: "上路",
    Jungle: "打野",
    Mid: "中路",
    Adc: "射手",
    ADC: "射手",
    Support: "輔助",
  },
  en: {
    Top: "Top",
    Jungle: "Jungle",
    Mid: "Mid",
    Adc: "ADC",
    ADC: "ADC",
    Support: "Support",
  },
};

const isEnglishLocale = (data = {}) => data.locale === "en";

const getPlayerRadarCopy = (data = {}) => {
  const locale = isEnglishLocale(data) ? "en" : "zh";
  return {
    zh: {
      hookBadge: "PLAYER RADAR",
      hookSeriesLabel: "系列賽",
      hookRoleLabel: "角色",
      hookProofTypeLabels: {
        mvp: "MVP",
        key_player: "關鍵人物",
      },
      matchupTitle: "最大對位差距",
      matchupLoserHighlight: "敗方亮點",
      matchupWinnerBreak: "勝負突破口",
      edgeLeadLabel: "數據領先",
      proofBadgeLabels: {
        mvp: "MVP CASE",
        key_player: "關鍵人物",
      },
      proofSubtitle: "用數據建立關鍵人物理由",
      conclusionFallbackMatchupName: "最大對位差選手",
      conclusionFallbackProofName: "關鍵人物",
      conclusionSamePlayer: "(proofName) 同時拿到最大對位差和關鍵人物理由。",
      conclusionSplit: "最大對位差在 (matchupName)，關鍵人物理由在 (proofName)。",
      conclusionFocusSplit: "(focusName) 是指定觀察點，但這路數據邊在 (edgeName)，關鍵人物理由在 (proofName)。",
      conclusionChipsSamePlayer: ["最大對位差", "MVP 案例", "同一人"],
      conclusionChipsSplit: ["對位差距", "關鍵人物", "雙判讀"],
      storyboard: [
        { tag: "HOOK", text: "(playerName)賽後雷達\n數據一眼看懂", durationInFrames: 86 },
        { tag: "MATCHUP_EDGE", text: "對位差距先看\n誰把優勢打穿", durationInFrames: 126 },
        { tag: "PLAYER_PROOF", text: "關鍵人物理由\n數據直接列出來", durationInFrames: 112 },
        { tag: "CONCLUSION_CTA", text: "這場是不是 MVP\n留言告訴我", durationInFrames: 92 },
      ],
    },
    en: {
      hookBadge: "PLAYER RADAR",
      hookSeriesLabel: "Series",
      hookRoleLabel: "Role",
      hookProofTypeLabels: {
        mvp: "MVP",
        key_player: "Key player",
      },
      matchupTitle: "BIGGEST MATCHUP EDGE",
      matchupLoserHighlight: "Loser highlight",
      matchupWinnerBreak: "Win-condition swing",
      edgeLeadLabel: "Edge winner",
      proofBadgeLabels: {
        mvp: "MVP",
        key_player: "KEY PLAYER",
      },
      proofSubtitle: "Build the key-player case with numbers.",
      conclusionFallbackMatchupName: "matchup edge player",
      conclusionFallbackProofName: "key player",
      conclusionSamePlayer: "(proofName) owns both the matchup edge and the key-player case.",
      conclusionSplit: "The matchup edge belongs to (matchupName), while the key-player case belongs to (proofName).",
      conclusionFocusSplit: "(focusName) is the matchup focus, but the statistical edge belongs to (edgeName); the key-player case belongs to (proofName).",
      conclusionChipsSamePlayer: ["Matchup edge", "MVP case", "Same player"],
      conclusionChipsSplit: ["Matchup edge", "Key player", "Dual read"],
      storyboard: [
        { tag: "HOOK", text: "(playerName) player radar\nThe numbers tell the story", durationInFrames: 86 },
        { tag: "MATCHUP_EDGE", text: "Start with the lane swing\nWho broke the matchup open", durationInFrames: 126 },
        { tag: "PLAYER_PROOF", text: "Make the key-player case\nStack the proof cleanly", durationInFrames: 112 },
        { tag: "CONCLUSION_CTA", text: "Was this the MVP read\nDrop your take below", durationInFrames: 92 },
      ],
    },
  }[locale];
};

const getRoleLabel = (role, data = {}) => {
  const locale = isEnglishLocale(data) ? "en" : "zh";
  return ROLE_LABELS[locale][role] || role || (locale === "en" ? "Mid" : "中路");
};

const getPlayer = (data = {}) => data.player || { name: data.playerName || "Player", role: data.playerRole || data.role || "Mid", championPlayed: data.championPlayed || "" };

const samePlayer = (left = {}, right = {}) => {
  const leftId = left.playerId || left.id;
  const rightId = right.playerId || right.id;
  if (leftId && rightId) return String(leftId).toLowerCase() === String(rightId).toLowerCase();

  const leftParts = [left.name, left.team, left.role].map((value) => String(value || "").trim().toLowerCase());
  const rightParts = [right.name, right.team, right.role].map((value) => String(value || "").trim().toLowerCase());
  const hasLeftIdentity = leftParts.some(Boolean);
  const hasRightIdentity = rightParts.some(Boolean);
  if (!hasLeftIdentity || !hasRightIdentity) return false;

  return leftParts.join("|") === rightParts.join("|");
};

const deriveMatchupDisplayPlayers = (segment = {}) => {
  const focusPlayer = segment.focusPlayer || segment.edgePlayer || {};
  const edgePlayer = segment.edgePlayer || {};
  const actualOpponent = samePlayer(focusPlayer, edgePlayer) ? segment.opponentPlayer || {} : edgePlayer;

  return {
    focusPlayer,
    edgePlayer,
    opponentPlayer: actualOpponent,
  };
};

const getHookProofPillValue = (data = {}) => {
  const proofPlayerName = data.proofSegment?.player?.name;
  if (proofPlayerName) return proofPlayerName;
  if (data.proofSegment?.proofType === "mvp" && data.recommendedMvp) return data.recommendedMvp;
  return getPlayer(data).name || "MVP";
};

const buildConclusionVerdict = (data = {}) => {
  const copy = getPlayerRadarCopy(data);
  const focusPlayer = data.matchupSegment?.focusPlayer || data.matchupSegment?.edgePlayer || {};
  const edgePlayer = data.matchupSegment?.edgePlayer || focusPlayer;
  const proofPlayer = data.proofSegment?.player || {};
  const matchupName = focusPlayer.name || copy.conclusionFallbackMatchupName;
  const edgeName = edgePlayer.name || matchupName;
  const proofName = proofPlayer.name || copy.conclusionFallbackProofName;
  const focusOwnsEdge = samePlayer(focusPlayer, edgePlayer);
  const isSamePlayer = samePlayer(edgePlayer, proofPlayer);
  const bodyTemplate = !focusOwnsEdge && samePlayer(focusPlayer, proofPlayer)
    ? copy.conclusionFocusSplit
    : (isSamePlayer ? copy.conclusionSamePlayer : copy.conclusionSplit);
  const body = bodyTemplate
    .replace("(proofName)", proofName)
    .replace("(matchupName)", isSamePlayer ? matchupName : edgeName)
    .replace("(focusName)", matchupName)
    .replace("(edgeName)", edgeName);

  return {
    body,
    chips: isSamePlayer ? copy.conclusionChipsSamePlayer : copy.conclusionChipsSplit,
    isSamePlayer,
    matchupName,
    edgeName,
    proofName,
  };
};

module.exports = {
  buildConclusionVerdict,
  deriveMatchupDisplayPlayers,
  getHookProofPillValue,
  getPlayer,
  getPlayerRadarCopy,
  getRoleLabel,
  isEnglishLocale,
  samePlayer,
};
