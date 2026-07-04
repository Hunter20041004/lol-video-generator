function isEnglish(locale = "zh") {
  return String(locale || "zh").toLowerCase().startsWith("en");
}

const ROLE_LABELS_ZH = {
  Top: "上路",
  Jungle: "打野",
  Mid: "中路",
  ADC: "下路",
  Support: "輔助",
};

const OFFMETA_TYPE_LABELS = {
  OFFROLE_PICK: { zh: "非主流位置", en: "Off-role pick" },
  OFFMETA_BUILD: { zh: "出裝 / 符文黑科技", en: "Build / rune tech" },
};

const RISK_LABELS = {
  LOW_SAMPLE: { zh: "樣本偏低", en: "Low sample" },
  LOW_PICK_RATE: { zh: "登場率偏低", en: "Low pick rate" },
  SOURCE_MISMATCH: { zh: "資料源不一致", en: "Source mismatch" },
  SOURCE_UNAVAILABLE: { zh: "資料來源未驗證", en: "Source unavailable" },
  HIGH_ELO_ONLY: { zh: "高端局限定", en: "High-elo only" },
  NO_MAJOR_RISK: { zh: "暫無主要風險", en: "No major risk" },
};

const EVIDENCE_LABELS = {
  "Win rate": { zh: "勝率", en: "Win rate" },
  Baseline: { zh: "基準勝率", en: "Baseline" },
  "Pick rate": { zh: "登場率", en: "Pick rate" },
};

const REASON_TRANSLATIONS = {
  "Win rate": { zh: "勝率", en: "Win rate" },
  "Pick rate": { zh: "登場率", en: "Pick rate" },
  "Ban rate": { zh: "禁用率", en: "Ban rate" },
  Sample: { zh: "樣本", en: "Sample" },
};

const RANK_PRESET_LABELS = {
  emerald_plus: { zh: "翡翠以上", en: "Emerald+" },
  diamond_plus: { zh: "鑽石以上", en: "Diamond+" },
  master_plus: { zh: "大師以上", en: "Master+" },
  all_ranks: { zh: "全分段", en: "All ranks" },
};

const REGION_LABELS = {
  global: { zh: "全球", en: "Global" },
  kr: { zh: "韓服", en: "KR" },
  na: { zh: "北美", en: "NA" },
  na1: { zh: "北美", en: "NA" },
  euw: { zh: "歐西", en: "EUW" },
  euw1: { zh: "歐西", en: "EUW" },
  eune: { zh: "歐東", en: "EUNE" },
  eun1: { zh: "歐東", en: "EUNE" },
  jp: { zh: "日服", en: "JP" },
  jp1: { zh: "日服", en: "JP" },
  tw: { zh: "台服", en: "TW" },
  tw2: { zh: "台服", en: "TW" },
  sg: { zh: "新加坡服", en: "SG" },
  sg2: { zh: "新加坡服", en: "SG" },
  vn: { zh: "越南服", en: "VN" },
  vn2: { zh: "越南服", en: "VN" },
  th: { zh: "泰服", en: "TH" },
  th2: { zh: "泰服", en: "TH" },
  ph: { zh: "菲律賓服", en: "PH" },
  ph2: { zh: "菲律賓服", en: "PH" },
  br: { zh: "巴西服", en: "BR" },
  br1: { zh: "巴西服", en: "BR" },
  lan: { zh: "拉丁北服", en: "LAN" },
  la1: { zh: "拉丁北服", en: "LAN" },
  las: { zh: "拉丁南服", en: "LAS" },
  la2: { zh: "拉丁南服", en: "LAS" },
  oce: { zh: "大洋洲服", en: "OCE" },
  oc1: { zh: "大洋洲服", en: "OCE" },
  ru: { zh: "俄服", en: "RU" },
  tr: { zh: "土耳其服", en: "TR" },
  tr1: { zh: "土耳其服", en: "TR" },
};

function roleLabel(role = "Mid", locale = "zh") {
  return isEnglish(locale) ? role || "Mid" : ROLE_LABELS_ZH[role] || role || "中路";
}

function offmetaTypeLabel(type = "OFFROLE_PICK", locale = "zh") {
  const labels = OFFMETA_TYPE_LABELS[type] || OFFMETA_TYPE_LABELS.OFFROLE_PICK;
  return isEnglish(locale) ? labels.en : labels.zh;
}

function localizeRiskLabel(label = "", locale = "zh") {
  const labels = RISK_LABELS[label];
  if (!labels) return String(label || "");
  return isEnglish(locale) ? labels.en : labels.zh;
}

function localizeEvidence(evidence = [], locale = "zh") {
  return (Array.isArray(evidence) ? evidence : []).map((item) => {
    const labels = EVIDENCE_LABELS[item?.label];
    return {
      ...item,
      label: labels ? (isEnglish(locale) ? labels.en : labels.zh) : item?.label,
    };
  });
}

function formatInteger(value = 0) {
  return new Intl.NumberFormat("en-US").format(Math.round(Number(value) || 0));
}

function formatNumber(value = 0, digits = 1) {
  const number = Number(value) || 0;
  return Number.isInteger(number) ? String(number) : number.toFixed(digits).replace(/\.0$/, "");
}

function hasBuildDetails(candidate = {}) {
  return [candidate.buildName, candidate.buildPath, candidate.itemBuild, candidate.runePage]
    .some((value) => Boolean(String(value || "").trim())) ||
    (Array.isArray(candidate.coreItems) && candidate.coreItems.length > 0) ||
    (Array.isArray(candidate.coreRunes) && candidate.coreRunes.length > 0) ||
    (Array.isArray(candidate.buildItems) && candidate.buildItems.length > 0) ||
    (Array.isArray(candidate.runes) && candidate.runes.length > 0);
}

function getCoreItems(candidate = {}) {
  return Array.isArray(candidate.coreItems) ? candidate.coreItems : [];
}

function getCoreRunes(candidate = {}) {
  return Array.isArray(candidate.coreRunes) ? candidate.coreRunes : [];
}

function formatOptionNames(items = [], fallback = "") {
  const names = items.map((item) => String(item?.name || item || "").trim()).filter(Boolean);
  return names.length > 0 ? names.slice(0, 2).join(" / ") : fallback;
}

function formatRate(value = 0) {
  return `${formatNumber(value)}%`;
}

function formatRegion(value = "global", locale = "zh") {
  const key = String(value || "global").toLowerCase();
  const labels = REGION_LABELS[key];
  if (labels) return isEnglish(locale) ? labels.en : labels.zh;
  return isEnglish(locale) ? String(value || "Global").toUpperCase() : "指定伺服器";
}

function formatRankPreset(value = "emerald_plus", locale = "zh") {
  const labels = RANK_PRESET_LABELS[String(value || "emerald_plus")];
  if (!labels) return isEnglish(locale) ? String(value || "Emerald+") : "指定分段";
  return isEnglish(locale) ? labels.en : labels.zh;
}

function topicFrameFor(candidate = {}, locale = "zh") {
  const isBuild = candidate.offmetaType === "OFFMETA_BUILD";
  const hasBuild = hasBuildDetails(candidate);
  const hasItems = getCoreItems(candidate).length > 0;
  const hasRunes = getCoreRunes(candidate).length > 0;
  if (isEnglish(locale)) {
    if (!isBuild) return "Off-role tech";
    if (!hasBuild) return "Build signal";
    if (hasItems && hasRunes) return "Build / rune tech";
    return hasItems ? "Build tech" : "Rune tech";
  }
  if (!isBuild) return "位置黑科技";
  if (!hasBuild) return "出裝訊號";
  if (hasItems && hasRunes) return "出裝 / 符文黑科技";
  return hasItems ? "出裝黑科技" : "符文黑科技";
}

function buildPlayerTakeaways(candidate = {}, locale = "zh") {
  const en = isEnglish(locale);
  const champion = candidate.champion || (en ? "Champion" : "這隻英雄");
  const lane = roleLabel(candidate.role || "Mid", locale);
  const sample = formatInteger(candidate.sampleSize || 0);
  const isBuild = candidate.offmetaType === "OFFMETA_BUILD";
  const itemNames = formatOptionNames(getCoreItems(candidate), en ? "the core item" : "核心裝備");
  const runeNames = formatOptionNames(getCoreRunes(candidate), en ? "the core rune" : "核心符文");

  if (en) {
    return [
      { label: "Game plan", body: isBuild ? `${champion} ${lane} uses ${itemNames}${getCoreRunes(candidate).length ? ` with ${runeNames}` : ""} to change the usual lane rhythm.` : `${champion} ${lane} is an off-role angle, so lane matchup matters first.` },
      { label: "Try when", body: `Use it as a test pick when you already know the champion and can compare it against ${sample} games of context.` },
      { label: "Do not force", body: "Do not copy it in ranked until the matchup and first two waves make sense." },
    ];
  }

  return [
    { label: "打法節奏", body: isBuild ? `${champion} ${lane}用 ${itemNames}${getCoreRunes(candidate).length ? ` 搭配 ${runeNames}` : ""}，把原本的對線節奏打歪。` : `${champion} ${lane}是位置黑科技，重點先看對線能不能成立。` },
    { label: "適合嘗試", body: `你熟這隻英雄、也能接受先用一般對局測手感，再參考 ${sample} 場樣本。` },
    { label: "不要盲抄", body: "對線不熟、隊伍缺關鍵功能，或第一波節奏不對，就不要硬拿去排位。" },
  ];
}

function buildVersionOverview(candidate = {}, locale = "zh") {
  return {
    patch: candidate.patch || "",
    region: formatRegion(candidate.region, locale),
    rankPreset: formatRankPreset(candidate.rankPreset, locale),
    role: roleLabel(candidate.role || "Mid", locale),
    techType: topicFrameFor(candidate, locale),
  };
}

function buildPlayerStats(candidate = {}, locale = "zh") {
  const en = isEnglish(locale);
  const evidence = new Map((Array.isArray(candidate.evidence) ? candidate.evidence : []).map((item) => [item.label, item.value]));
  const winRate = evidence.get("Win rate") ?? candidate.winRate;
  const pickRate = evidence.get("Pick rate") ?? candidate.pickRate;
  return [
    { label: en ? "Win" : "勝率", value: formatRate(winRate || 0) },
    { label: en ? "Pick" : "登場率", value: formatRate(pickRate || 0) },
    { label: en ? "Sample" : "樣本", value: formatInteger(candidate.sampleSize || 0) },
  ];
}

function buildOffmetaStoryboard(candidate = {}, locale = "zh") {
  const en = isEnglish(locale);
  const champion = candidate.champion || (en ? "Champion" : "這隻英雄");
  const lane = roleLabel(candidate.role || "Mid", locale);
  const isBuild = candidate.offmetaType === "OFFMETA_BUILD";
  const topicFrame = topicFrameFor(candidate, locale);
  const overview = buildVersionOverview(candidate, locale);
  const itemNames = formatOptionNames(getCoreItems(candidate), en ? "core item" : "核心裝備");
  const runeNames = formatOptionNames(getCoreRunes(candidate), en ? "core rune" : "核心符文");

  if (en) {
    return isBuild ? [
      { tag: "VERSION_OVERVIEW", text: `${overview.patch || "Current patch"} ${overview.region}\n${overview.rankPreset} ${lane}\n${topicFrame}`, durationInFrames: 90 },
      { tag: "CORE_TECH", text: `${champion} ${lane}\n${itemNames}${getCoreRunes(candidate).length ? ` + ${runeNames}` : ""}`, durationInFrames: 120 },
      { tag: "TEST_PLAN", text: "Test the lane rhythm\nbefore ranked", durationInFrames: 120 },
      { tag: "CONCLUSION_CTA", text: "Would you try it?\nComment your read", durationInFrames: 90 },
    ] : [
      { tag: "VERSION_OVERVIEW", text: `${overview.patch || "Current patch"} ${overview.region}\n${overview.rankPreset} ${lane}\n${topicFrame}`, durationInFrames: 90 },
      { tag: "CORE_TECH", text: `${champion} ${lane}\noff-role setup`, durationInFrames: 120 },
      { tag: "TEST_PLAN", text: "Check matchup first\nthen test it", durationInFrames: 120 },
      { tag: "CONCLUSION_CTA", text: "Real tech or bait?\nComment your read", durationInFrames: 90 },
    ];
  }

  return isBuild ? [
    { tag: "VERSION_OVERVIEW", text: `${overview.patch || "目前版本"} ${overview.region}\n${overview.rankPreset} ${lane}\n${topicFrame}`, durationInFrames: 90 },
    { tag: "CORE_TECH", text: `${champion} ${lane}\n${itemNames}${getCoreRunes(candidate).length ? ` + ${runeNames}` : ""}`, durationInFrames: 120 },
    { tag: "TEST_PLAN", text: "先看打法節奏\n再決定要不要抄", durationInFrames: 120 },
    { tag: "CONCLUSION_CTA", text: "你會拿去測嗎\n留言告訴我", durationInFrames: 90 },
  ] : [
    { tag: "VERSION_OVERVIEW", text: `${overview.patch || "目前版本"} ${overview.region}\n${overview.rankPreset} ${lane}\n${topicFrame}`, durationInFrames: 90 },
    { tag: "CORE_TECH", text: `${champion} ${lane}\n位置黑科技`, durationInFrames: 120 },
    { tag: "TEST_PLAN", text: "先看對線情境\n再決定要不要抄", durationInFrames: 120 },
    { tag: "CONCLUSION_CTA", text: "這是真貨還是陷阱\n留言告訴我", durationInFrames: 90 },
  ];
}

function buildRecommendedStoryAngle(candidate = {}, locale = "zh") {
  const en = isEnglish(locale);
  const champion = candidate.champion || (en ? "Champion" : "這隻英雄");
  const lane = roleLabel(candidate.role || "Mid", locale);
  if (en) {
    if (candidate.offmetaType === "OFFMETA_BUILD") {
      const items = formatOptionNames(getCoreItems(candidate), "the core item");
      const runes = formatOptionNames(getCoreRunes(candidate), "");
      return `${champion} ${lane} is about ${items}${runes ? ` plus ${runes}` : ""}: explain the game plan first, then test whether the lane rhythm is worth copying.`;
    }
    return candidate.recommendedStoryAngle || `${champion} ${lane} is an off-role idea. Explain the matchup before anyone copies it.`;
  }
  if (candidate.offmetaType === "OFFMETA_BUILD") {
    const items = formatOptionNames(getCoreItems(candidate), "核心裝備");
    const runes = formatOptionNames(getCoreRunes(candidate), "");
    return `這集看 ${champion} ${lane}的 ${items}${runes ? ` 搭配 ${runes}` : ""}：先講這套在打什麼節奏，再判斷要不要拿去測。`;
  }
  return `${champion} ${lane}是位置黑科技，先講對線與隊伍情境，再決定要不要抄。`;
}

function buildOffmetaPayload(candidate = {}, locale = "zh") {
  const en = isEnglish(locale);
  const normalizedLocale = en ? "en" : "zh";
  const lane = roleLabel(candidate.role || "Mid", normalizedLocale);
  const typeLabel = offmetaTypeLabel(candidate.offmetaType || "OFFROLE_PICK", normalizedLocale);
  const topicFrame = topicFrameFor(candidate, normalizedLocale);
  const itemNames = formatOptionNames(getCoreItems(candidate), "");
  const runeNames = formatOptionNames(getCoreRunes(candidate), "");
  const title = en
    ? `${candidate.champion} ${candidate.role}: ${candidate.offmetaType === "OFFMETA_BUILD" ? topicFrame.toLowerCase() : "real off-meta"} or bait?`
    : candidate.offmetaType === "OFFMETA_BUILD"
      ? `${candidate.champion} ${lane}：${[itemNames, runeNames].filter(Boolean).join(" / ") || "這套玩法"} 黑科技能不能打？`
      : `${candidate.champion} ${lane}：黑科技還是陷阱？`;

  return {
    dataType: "META_OFFMETA_PICK",
    locale: normalizedLocale,
    title,
    champion: candidate.champion,
    role: candidate.role,
    roleLabel: lane,
    offmetaType: candidate.offmetaType || "OFFROLE_PICK",
    offmetaTypeLabel: typeLabel,
    topicFrame,
    score: candidate.score || 0,
    confidence: candidate.confidence || 0,
    sourceAgreement: candidate.sourceAgreement || 0,
    sampleSize: candidate.sampleSize || 0,
    versionOverview: buildVersionOverview(candidate, normalizedLocale),
    coreItems: getCoreItems(candidate),
    coreRunes: getCoreRunes(candidate),
    playerStats: buildPlayerStats(candidate, normalizedLocale),
    riskLabels: (candidate.riskLabels || []).map((label) => localizeRiskLabel(label, normalizedLocale)),
    playerTakeaways: buildPlayerTakeaways(candidate, normalizedLocale),
    evidence: localizeEvidence(candidate.evidence || [], normalizedLocale),
    recommendedStoryAngle: buildRecommendedStoryAngle(candidate, normalizedLocale),
    hardBlock: candidate.hardBlock || { blocked: false, reasons: [] },
    storyboard: buildOffmetaStoryboard(candidate, normalizedLocale),
  };
}

function localizeReasonText(reason = "", locale = "zh") {
  let text = String(reason || "");
  for (const [source, labels] of Object.entries(REASON_TRANSLATIONS)) {
    text = text.replaceAll(source, isEnglish(locale) ? labels.en : labels.zh);
  }
  return text;
}

function buildTierStatLine(entry = {}, locale = "zh") {
  const en = isEnglish(locale);
  const winRate = formatNumber(entry.winRate || 0);
  const pickRate = formatNumber(entry.pickRate || 0);
  const sample = formatInteger(entry.sampleSize || 0);
  return en
    ? `Win ${winRate}% · Pick ${pickRate}% · Sample ${sample}`
    : `勝率 ${winRate}% · 登場率 ${pickRate}% · 樣本 ${sample}`;
}

function buildTierEntries(entries = [], locale = "zh") {
  return (Array.isArray(entries) ? entries : []).map((entry) => ({
    ...entry,
    statLine: buildTierStatLine(entry, locale),
    reasons: (entry.reasons || []).map((reason) => localizeReasonText(reason, locale)),
  }));
}

function buildTierVerdict(locale = "zh") {
  if (isEnglish(locale)) {
    return {
      title: "How to read it",
      body: "This is a composite score, not pure win rate. Prioritize stability, sample size and ban pressure.",
      chips: ["Composite", "Sample", "Ban pressure"],
    };
  }
  return {
    title: "榜單讀法",
    body: "這是綜合強度分，不是單看勝率；優先看穩定度、樣本與禁用壓力。",
    chips: ["綜合分", "樣本", "禁用壓力"],
  };
}

function buildTierPayload(candidate = {}, locale = "zh") {
  const en = isEnglish(locale);
  const normalizedLocale = en ? "en" : "zh";
  const lane = roleLabel(candidate.role || "Mid", normalizedLocale);
  const rankingSize = candidate.rankingSize || 7;
  return {
    dataType: "META_TIER_RANKING",
    locale: normalizedLocale,
    title: en ? `${candidate.role} Top ${rankingSize}` : `${lane} 梯度榜前 ${rankingSize}`,
    role: candidate.role || "Mid",
    roleLabel: lane,
    rankingSize,
    entries: buildTierEntries(candidate.entries || [], normalizedLocale),
    watchPick: candidate.watchPick || null,
    downgradeReason: candidate.downgradeReason || "",
    tierVerdict: buildTierVerdict(normalizedLocale),
    storyboard: [
      { tag: "HOOK", text: en ? `${candidate.role} meta\nTop picks` : `${lane} 版本答案\n先看這幾隻`, durationInFrames: 90 },
      { tag: "STAT_REVEAL", text: en ? "Composite score\nnot pure win rate" : "綜合強度分\n不是只看勝率", durationInFrames: 120 },
      { tag: "CONCLUSION_CTA", text: en ? "Which role next?\nComment below" : "下一路想看哪裡\n留言告訴我", durationInFrames: 90 },
    ],
  };
}

function buildMetaRenderPayload(candidate = {}, locale = "zh") {
  if (candidate.kind === "META_TIER_RANKING") return buildTierPayload(candidate, locale);
  return buildOffmetaPayload(candidate, locale);
}

module.exports = {
  buildMetaRenderPayload,
};
