const { normalizeLocale } = require("./accounts");

const DATA_TYPE_LABEL = {
  PATCH: { zh: "英雄改版", en: "Champion Patch" },
  SYSTEM_UPDATE: { zh: "系統改動", en: "System Update" },
  ITEM_UPDATE: { zh: "裝備改動", en: "Item Update" },
  RUNE_UPDATE: { zh: "符文改動", en: "Rune Update" },
  PLAYER_RADAR: { zh: "選手數據", en: "Player Radar" },
  ESPORTS_H2H_RADAR: { zh: "賽事對位雷達", en: "Matchup Radar" },
  ESPORTS_MATCH_RECAP: { zh: "賽事戰報", en: "Match Recap" },
  META_OFFMETA_PICK: { zh: "Meta Factory 黑科技", en: "Meta Factory Off-Meta" },
  META_TIER_RANKING: { zh: "Meta Factory 梯度榜", en: "Meta Factory Tier Ranking" },
};

const PLATFORM_TAGS = {
  instagram: {
    zh: ["#英雄聯盟", "#lol台服", "#版本更新", "#shorts", "#reels"],
    en: ["#leagueoflegends", "#lolpatch", "#gamingreels", "#reels", "#shorts"],
  },
  threads: {
    zh: ["#英雄聯盟", "#版本改動", "#LoL"],
    en: ["#LeagueOfLegends", "#LoL", "#PatchNotes"],
  },
};

const DATA_TYPE_TAGS = {
  ESPORTS_MATCH_RECAP: {
    zh: ["#賽後分析", "#LoLEsports", "#MSI2026"],
    en: ["#MatchRecap", "#LoLEsports", "#MSI2026"],
  },
  PLAYER_RADAR: {
    zh: ["#LoLEsports", "#選手雷達", "#賽事分析"],
    en: ["#LoLEsports", "#PlayerRadar", "#EsportsAnalysis"],
  },
  META_OFFMETA_PICK: {
    zh: ["#MetaFactory", "#黑科技", "#LoLMeta"],
    en: ["#MetaFactory", "#OffMeta", "#LoLMeta"],
  },
  META_TIER_RANKING: {
    zh: ["#MetaFactory", "#梯度榜", "#LoLMeta"],
    en: ["#MetaFactory", "#TierRanking", "#LoLMeta"],
  },
};

const PLAYER_RADAR_PLATFORM_TAGS = {
  instagram: {
    zh: ["#英雄聯盟", "#LoLEsports", "#選手雷達", "#shorts", "#reels"],
    en: ["#leagueoflegends", "#LoLEsports", "#PlayerRadar", "#reels", "#shorts"],
  },
  threads: {
    zh: ["#英雄聯盟", "#LoLEsports", "#選手雷達"],
    en: ["#LeagueOfLegends", "#LoLEsports", "#PlayerRadar"],
  },
};

const truncate = (text = "", max = 100) => {
  const cleaned = String(text || "").replace(/\s+/g, " ").trim();
  return cleaned.length > max ? `${cleaned.slice(0, Math.max(0, max - 1)).trim()}…` : cleaned;
};

const removeHashtagPrefix = (tag) => String(tag || "").replace(/^#/, "").trim();
const compactText = (text = "") => String(text || "").replace(/\s+/g, " ").trim();

const hasCjk = (text = "") => /[\u3400-\u9fff]/.test(String(text || ""));

const ZH_STAT_TERMS = {
  "frostfire tempest": "霜火風暴",
  "ability haste": "技能加速",
  "trigger damage": "觸發傷害",
  "on-hit damage": "命中特效傷害",
  "damage reduction": "傷害減免",
  "damage": "傷害",
  "attack speed": "攻擊速度",
  "attack damage": "攻擊力",
  "move speed": "跑速",
  "movement speed": "跑速",
  "total cost": "總價格",
};

function hasLatinWord(value = "") {
  return /[A-Za-z]{3,}/.test(String(value || ""));
}

function normalizePhraseKey(value = "") {
  return String(value || "")
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[^a-z0-9\u3400-\u9fff]+/g, " ")
    .trim();
}

function containsInOrder(value, tokens) {
  let cursor = 0;
  for (const token of tokens) {
    const index = value.indexOf(token, cursor);
    if (index < 0) return false;
    cursor = index + token.length;
  }
  return true;
}

function isEnglishFallbackSuffix(value = "") {
  const text = String(value || "").trim();
  if (!text || !/[A-Za-z]/.test(text[0])) return false;
  const punctuation = " '%:+().-";
  for (const character of text) {
    const isLetter = (character >= "A" && character <= "Z") || (character >= "a" && character <= "z");
    const isNumber = character >= "0" && character <= "9";
    if (!isLetter && !isNumber && !punctuation.includes(character)) return false;
  }
  return true;
}

function stripLocalizedEnglishSuffix(value = "") {
  const slash = value.lastIndexOf("/");
  if (slash < 0 || !isEnglishFallbackSuffix(value.slice(slash + 1))) return value;
  return value.slice(0, slash).trim();
}

function extractPatchVersion(value = "") {
  const text = String(value || "");
  for (let start = 0; start < text.length; start += 1) {
    if (text[start] < "0" || text[start] > "9") continue;
    let cursor = start;
    while (cursor < text.length && text[cursor] >= "0" && text[cursor] <= "9") cursor += 1;
    let dotCount = 0;
    while (dotCount < 2 && text[cursor] === ".") {
      const digitsStart = cursor + 1;
      cursor = digitsStart;
      while (cursor < text.length && text[cursor] >= "0" && text[cursor] <= "9") cursor += 1;
      if (cursor === digitsStart) break;
      dotCount += 1;
    }
    if (dotCount >= 1) return text.slice(start, cursor);
  }
  return "";
}

function localizeKnownZhPhrase(value = "", fallback = "") {
  const raw = compactText(value);
  if (!raw) return fallback;
  const normalized = raw.toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, " ");
  const key = normalizePhraseKey(raw);
  if (ZH_STAT_TERMS[key]) return ZH_STAT_TERMS[key];
  if (/frostfire\s+tempest/.test(normalized)) return "霜火風暴";
  if (containsInOrder(normalized, ["readies", "ult", "5", "seconds"]) || containsInOrder(normalized, ["ult", "readies", "5", "seconds"])) return "大絕後預備5秒";
  if (containsInOrder(normalized, ["triggers", "ult", "cast"]) || containsInOrder(normalized, ["ult", "cast", "triggers"])) return "大絕施放觸發";
  if (containsInOrder(normalized, ["damage", "triggers", "next", "attack", "ability"])) return "下次攻擊或技能觸發";
  if (containsInOrder(normalized, ["damage", "triggers", "hit"]) || normalized.includes("on-hit")) return "命中時觸發";
  if (containsInOrder(normalized, ["damage", "reduction", "cast", "source"])) return "減免整段傷害來源";
  if (/damage\s+reduction/.test(normalized)) return "減免下一次傷害";
  if (hasLatinWord(raw) && !hasCjk(raw)) return fallback;
  return raw;
}

function stripEnglishFallback(text = "", locale = "zh") {
  const value = compactText(text);
  if (normalizeLocale(locale) !== "zh") return hasCjk(value) ? "" : value;
  if (hasCjk(value)) return stripLocalizedEnglishSuffix(value);
  return localizeKnownZhPhrase(value, "");
}

const getLocalizedPayload = (analysis = {}, locale = "zh") => {
  const lang = normalizeLocale(locale);
  const localized = analysis.localizedPayloads?.[lang] || analysis.localizedPayloads?.[locale];
  const isPlayerRadar = String(analysis.dataType || localized?.dataType || "").toUpperCase() === "PLAYER_RADAR";
  if (isPlayerRadar && !localized) {
    const rootLocale = normalizeLocale(analysis.locale || "zh");
    if (rootLocale !== lang) {
      throw new Error(`Player Radar localized payload missing for locale: ${lang}`);
    }
  }
  return localized || analysis;
};

function normalizePatchVersion(data = {}) {
  const raw = compactText(data.patchVersion || data.version || data.patch || "");
  if (!raw || raw.toLowerCase() === "latest") return "";
  const version = extractPatchVersion(raw);
  return version || raw.replace(/^patch\s*/i, "");
}

function titleHasPatchVersion(title = "", patchVersion = "") {
  if (!patchVersion) return true;
  return new RegExp(`(?:patch\\s*)?${patchVersion.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i").test(title);
}

function isEsportsRecap(data = {}) {
  return data.dataType === "ESPORTS_MATCH_RECAP";
}

function getEsportsMatch(data = {}) {
  return data.match || {};
}

function getMatchTeams(match = {}) {
  return Array.isArray(match.teams) ? match.teams.filter(Boolean) : [];
}

function formatMatchResult(data = {}) {
  const match = getEsportsMatch(data);
  const teams = getMatchTeams(match);
  const winningTeam = match.winningTeam || data.winningTeam || teams[0] || "";
  const losingTeam = teams.find((team) => team !== winningTeam) || teams[1] || "";
  const score = compactText(match.score || data.score || data.seriesScore || data.scoreLabel || "");
  if (winningTeam && losingTeam && score) return `${winningTeam} ${score} ${losingTeam}`;
  if (teams.length >= 2 && score) return `${teams[0]} ${score} ${teams[1]}`;
  if (teams.length >= 2) return `${teams[0]} vs ${teams[1]}`;
  return compactText(data.seriesId || match.tournament || "賽事");
}

function inferEsportsTitle(data = {}, locale = "zh") {
  const lang = normalizeLocale(locale);
  const result = formatMatchResult(data);
  return lang === "zh"
    ? `${result} 賽後戰報`
    : `${result} Match Recap`;
}

function esportsMetricLabel(metric = "", locale = "zh") {
  const lang = normalizeLocale(locale);
  const key = String(metric || "").toLowerCase();
  if (lang === "zh") {
    if (key === "gold") return "經濟";
    if (key === "damagetochampions" || key === "damage") return "團隊輸出";
    if (key === "score") return "比分";
    if (key === "radar") return "對位分差";
    return metric || "數據";
  }
  if (key === "gold") return "gold";
  if (key === "damagetochampions" || key === "damage") return "team damage";
  if (key === "score") return "score";
  return metric || "stat";
}

function esportsRoleLabel(role = "", locale = "zh") {
  const lang = normalizeLocale(locale);
  const labels = {
    Top: { zh: "上路", en: "top" },
    Jungle: { zh: "打野", en: "jungle" },
    Mid: { zh: "中路", en: "mid" },
    Adc: { zh: "下路", en: "ADC" },
    Support: { zh: "輔助", en: "support" },
  };
  return labels[role]?.[lang] || role || (lang === "zh" ? "關鍵位置" : "key role");
}

function formatEsportsDelta(value, locale = "zh") {
  const number = Number(value);
  if (!Number.isFinite(number)) return "";
  const rounded = Math.round(Math.abs(number)).toLocaleString("en-US");
  return normalizeLocale(locale) === "zh" ? `領先 ${rounded}` : `ahead by ${rounded}`;
}

function formatEsportsRecapPoint(point = {}, data = {}, locale = "zh") {
  const lang = normalizeLocale(locale);
  const matchResult = formatMatchResult(data);
  if (point.type === "result") {
    return lang === "zh"
      ? `${matchResult}，系列賽結果先定調`
      : `${matchResult} sets the series frame`;
  }
  if (point.type === "matchup-edge") {
    const role = esportsRoleLabel(point.role, lang);
    const player = point.player || point.edgePlayer || "";
    const team = point.team || "";
    if (lang === "zh") return [team, player, `${role}打出關鍵對位差`].filter(Boolean).join(" ");
    return [team, player, `created the key ${role} edge`].filter(Boolean).join(" ");
  }
  if (point.type === "team-gap") {
    const metric = esportsMetricLabel(point.metric, lang);
    const delta = formatEsportsDelta(point.delta, lang);
    return lang === "zh"
      ? `${point.team || ""} ${metric}${delta ? ` ${delta}` : ""}`.trim()
      : `${point.team || ""} ${metric}${delta ? ` ${delta}` : ""}`.trim();
  }
  const summary = stripEnglishFallback(point.summary || "", lang);
  return summary || (lang === "zh" ? `${matchResult} 的關鍵轉折` : `${matchResult} key swing`);
}

function getPlatformTags(platformKey = "instagram", locale = "zh", data = {}) {
  const lang = normalizeLocale(locale);
  if (isEsportsRecap(data)) {
    return lang === "zh"
      ? ["#英雄聯盟", "#LoLEsports", "#MSI2026", "#賽後分析"]
      : ["#LeagueOfLegends", "#LoLEsports", "#MSI2026", "#MatchRecap"];
  }
  if (data.dataType === "PLAYER_RADAR") return PLAYER_RADAR_PLATFORM_TAGS[platformKey][lang];
  return PLATFORM_TAGS[platformKey][lang];
}

function withPatchVersion(title = "", patchVersion = "", locale = "zh") {
  const cleaned = compactText(title);
  if (!cleaned || !patchVersion || titleHasPatchVersion(cleaned, patchVersion)) return cleaned;
  return normalizeLocale(locale) === "zh"
    ? `${cleaned}｜${patchVersion} 版本`
    : `${cleaned} | Patch ${patchVersion}`;
}

function inferTitle(data = {}, locale = "zh") {
  const lang = normalizeLocale(locale);
  const type = data.dataType || "PATCH";
  const typeLabel = DATA_TYPE_LABEL[type]?.[lang] || DATA_TYPE_LABEL.PATCH[lang];
  const patchVersion = normalizePatchVersion(data);

  if (data.socialCopy?.title) {
    const explicitTitle = stripEnglishFallback(data.socialCopy.title, lang);
    if (explicitTitle) return withPatchVersion(explicitTitle, patchVersion, lang);
  }
  if (isEsportsRecap(data)) return inferEsportsTitle(data, lang);
  if (type === "PLAYER_RADAR") {
    const explicitTitle = stripEnglishFallback(data.title || data.headline || "", lang);
    if (explicitTitle) return explicitTitle;
    const context = data.matchContext || {};
    const matchup = [context.teamA, context.teamB].filter(Boolean).join(" vs ");
    if (matchup) {
      return lang === "zh" ? `${matchup} 選手雷達` : `${matchup} Player Radar`;
    }
    return typeLabel;
  }
  if (type === "META_OFFMETA_PICK" || type === "META_TIER_RANKING") {
    const explicitTitle = stripEnglishFallback(data.title || data.headline || "", lang);
    if (explicitTitle) return withPatchVersion(explicitTitle, patchVersion, lang);

    if (type === "META_OFFMETA_PICK") {
      const pick = [data.champion, data.role].filter(Boolean).join(" ");
      return pick
        ? `${pick} ${typeLabel}`
        : typeLabel;
    }

    const role = data.role || "";
    const rankingSize = data.rankingSize || (Array.isArray(data.entries) ? data.entries.length : "");
    return lang === "zh"
      ? `${role ? `${role} ` : ""}${typeLabel}${rankingSize ? ` Top ${rankingSize}` : ""}`
      : `${role ? `${role} ` : ""}${typeLabel}${rankingSize ? ` Top ${rankingSize}` : ""}`;
  }
  if (data.targetName || data.localizedName) {
    const name = lang === "zh" ? data.localizedName || data.targetName : data.targetName || data.localizedName;
    return lang === "zh"
      ? `${name} ${patchVersion ? `${patchVersion} ` : ""}${typeLabel}快速看懂`
      : `${name} ${typeLabel}${patchVersion ? ` ${patchVersion}` : ""} Explained`;
  }
  if (data.championName || data.localizedChampionName) {
    const name = lang === "zh" ? data.localizedChampionName || data.championName : data.championName || data.localizedChampionName;
    return lang === "zh"
      ? `${name} ${patchVersion ? `${patchVersion} ` : ""}${typeLabel}快速看懂`
      : `${name} ${typeLabel}${patchVersion ? ` ${patchVersion}` : ""} Explained`;
  }
  if (data.headline) return withPatchVersion(data.headline, patchVersion, lang);
  return lang === "zh"
    ? `${typeLabel}${patchVersion ? ` ${patchVersion}` : ""} 重點整理`
    : `${typeLabel}${patchVersion ? ` ${patchVersion}` : ""} Breakdown`;
}

function inferDescription(data = {}, locale = "zh") {
  const lang = normalizeLocale(locale);
  const explicitDescription = stripEnglishFallback(data.socialCopy?.description || "", lang);
  if (explicitDescription) return explicitDescription;
  if (isEsportsRecap(data)) {
    const matchResult = formatMatchResult(data);
    return lang === "zh"
      ? `用系列賽數據拆解 ${matchResult} 的勝負關鍵。`
      : `A series-data breakdown of why ${matchResult} landed.`;
  }
  const text = [
    data.actionableVerdict?.oneLineVerdict ||
    data.actionableVerdict?.body ||
    data.subtitleScriptText ||
    data.storyboard?.find((scene) => scene?.text)?.text ||
    "",
  ]
    .map((candidate) => stripEnglishFallback(String(candidate).replace(/\n+/g, " "), lang))
    .find(Boolean) || "";
  if (text) return String(text).replace(/\n+/g, " ").trim();
  if (data.dataType === "PLAYER_RADAR") {
    return lang === "zh"
      ? "用對位差和關鍵人物證據拆解這場比賽。"
      : "A matchup-edge and key-player read from this match.";
  }
  return lang === "zh"
    ? "快速拆解這波版本改動的實戰影響。"
    : "A fast breakdown of what this patch change means in game.";
}

function formatStatBullet(stat = {}, locale = "zh") {
  const lang = normalizeLocale(locale);
  const metric = lang === "zh"
    ? localizeKnownZhPhrase(stat.metricName || stat.label || stat.name || "", "核心機制")
    : stripEnglishFallback(stat.metricName || stat.label || stat.name || "", lang);
  const before = lang === "zh"
    ? localizeKnownZhPhrase(stat.beforeValue ?? stat.before ?? stat.oldValue ?? "", "舊機制")
    : compactText(stat.beforeValue ?? stat.before ?? stat.oldValue ?? "");
  const after = lang === "zh"
    ? localizeKnownZhPhrase(stat.afterValue ?? stat.after ?? stat.newValue ?? "", "新機制")
    : compactText(stat.afterValue ?? stat.after ?? stat.newValue ?? "");
  const summary = stripEnglishFallback(stat.summary || stat.impact || stat.note || "", lang);
  const colon = lang === "zh" ? "：" : ": ";
  const comma = lang === "zh" ? "，" : ", ";
  if (metric && before && after) {
    return summary ? `${metric}${colon}${before} → ${after}${comma}${summary}` : `${metric}${colon}${before} → ${after}`;
  }
  if (metric && summary) return `${metric}${colon}${summary}`;
  return metric || summary;
}

function extractCopyBullets(data = {}, locale = "zh") {
  const lang = normalizeLocale(locale);
  if (isEsportsRecap(data)) {
    const points = Array.isArray(data.recapPoints) ? data.recapPoints : [];
    return points
      .map((point) => formatEsportsRecapPoint(point, data, lang))
      .filter(Boolean)
      .slice(0, 3)
      .map((bullet) => truncate(bullet, lang === "zh" ? 48 : 92));
  }
  const statBullets = Array.isArray(data.statChanges)
    ? data.statChanges.map((stat) => formatStatBullet(stat, lang)).filter(Boolean)
    : [];
  if (statBullets.length) return statBullets.slice(0, 3).map((bullet) => truncate(bullet, lang === "zh" ? 54 : 92));

  const verdict = data.actionableVerdict?.oneLineVerdict || data.actionableVerdict?.body || data.actionableVerdict?.title || "";
  const storyboard = Array.isArray(data.storyboard)
    ? data.storyboard.map((scene) => scene?.text || scene?.subtitle || "").filter(Boolean)
    : [];
  return [verdict, ...storyboard]
    .map((line) => stripEnglishFallback(String(line).replace(/\n+/g, " "), lang))
    .filter(Boolean)
    .slice(0, 3)
    .map((bullet) => truncate(bullet, lang === "zh" ? 42 : 90));
}

function buildHook(data = {}, locale = "zh") {
  const lang = normalizeLocale(locale);
  if (isEsportsRecap(data)) {
    const matchResult = formatMatchResult(data);
    return lang === "zh"
      ? `${matchResult}，關鍵不只比分，而是對位與團隊資源差。`
      : `${matchResult}: not just the scoreline, but the lane edges and team-resource gaps.`;
  }
  if (data.dataType === "PLAYER_RADAR") {
    const verdict = stripEnglishFallback(data.verdict || data.proofSegment?.verdict || inferDescription(data, lang), lang);
    return truncate(verdict, lang === "zh" ? 56 : 120);
  }
  const verdict = stripEnglishFallback(
    data.actionableVerdict?.oneLineVerdict || data.actionableVerdict?.body || inferDescription(data, lang),
    lang
  );
  if (verdict) return truncate(verdict, lang === "zh" ? 56 : 120);

  const changeType = String(data.changeType || data.overallTrend || "").toUpperCase();
  if (lang === "zh") {
    if (changeType === "BUFF") return "這波不是只看增強標籤，重點是實戰節奏怎麼變。";
    if (changeType === "NERF") return "這波削弱會直接影響出裝、對線或進場窗口。";
    return "這波屬於節奏調整，建議先看數值再決定打法。";
  }
  if (changeType === "BUFF") return "This is not just a buff label. The real question is tempo.";
  if (changeType === "NERF") return "This nerf changes the window, not just the number.";
  return "This is a tempo shift. Check the numbers before autopiloting.";
}

function assertSupportedCopyPlatform(platformKey = "instagram") {
  const normalized = String(platformKey || "instagram").toLowerCase();
  if (!Object.hasOwn(PLATFORM_TAGS, normalized)) {
    throw new Error(`Unsupported platform: ${normalized}`);
  }
  return normalized;
}

function buildPlatformCta(platformKey = "instagram", locale = "zh", dataType = "") {
  const lang = normalizeLocale(locale);
  const platform = assertSupportedCopyPlatform(platformKey);
  if (dataType === "ESPORTS_MATCH_RECAP") {
    return lang === "zh"
      ? "你覺得這場最關鍵的是哪個位置？"
      : "Which role decided the series?";
  }
  if (dataType === "PLAYER_RADAR") {
    if (lang === "zh") {
      if (platform === "threads") return "這場你站對位差，還是 MVP 理由？";
      return "你覺得這場關鍵人物是誰？留言告訴我。";
    }
    if (platform === "threads") return "Matchup gap or MVP case?";
    return "Who was the real key player in this match?";
  }
  if (lang === "zh") {
    if (platform === "threads") return "你覺得這波是實質增強，還是版本陷阱？";
    return "你會怎麼調整打法？留言告訴我。";
  }
  if (platform === "threads") return "Buff, nerf, or bait?";
  return "Would you change your build or keep the old setup?";
}

function buildCaption({ title, hook, bullets, tags, locale = "zh", platform = "instagram", dataType = "" }) {
  const lang = normalizeLocale(locale);
  const platformKey = assertSupportedCopyPlatform(platform);
  const tagLine = tags.map((tag) => `#${tag}`).join(" ");
  const cta = buildPlatformCta(platformKey, lang, dataType);

  if (platformKey === "threads") {
    const bulletLines = bullets.map((bullet, index) => `${index + 1}. ${bullet}`);
    const label = dataType === "PLAYER_RADAR"
      ? (lang === "zh" ? "賽事判斷：" : "Match read:")
      : (lang === "zh" ? "我的判斷：" : "My read:");
    return [title, hook, label, bulletLines.join("\n"), cta, tagLine].filter(Boolean).join("\n\n").trim();
  }

  if (platformKey === "instagram") {
    const bulletLines = bullets.map((bullet) => `• ${bullet}`);
    const label = dataType === "PLAYER_RADAR"
      ? (lang === "zh" ? "賽事重點：" : "Match notes:")
      : (lang === "zh" ? "這波重點：" : "What changed:");
    return [title, hook, label, bulletLines.join("\n"), cta, tagLine].filter(Boolean).join("\n\n").trim();
  }

  const bulletLines = bullets.map((bullet) => `- ${bullet}`);
  const label = lang === "zh" ? "重點整理：" : "Watch for:";
  return [title, hook, label, bulletLines.join("\n"), cta, tagLine].filter(Boolean).join("\n\n").trim();
}

function buildSocialCopy({ analysis = {}, locale = "zh", platform = "instagram" }) {
  const lang = normalizeLocale(locale);
  const data = getLocalizedPayload(analysis, lang);
  const platformKey = assertSupportedCopyPlatform(platform);
  const baseTags = getPlatformTags(platformKey, lang, data);
  const dataTypeTags = DATA_TYPE_TAGS[data.dataType]?.[lang] || [];
  const aiTags = Array.isArray(data.socialCopy?.tags) ? data.socialCopy.tags : [];
  const mergedTags = [...new Set([...aiTags, ...dataTypeTags, ...baseTags].map(removeHashtagPrefix).filter(Boolean))].slice(0, 12);

  const titleMax = 130;
  const title = truncate(inferTitle(data, lang), titleMax);
  const description = truncate(stripEnglishFallback(inferDescription(data, lang), lang), 180);
  const bullets = extractCopyBullets(data, lang);
  const hook = buildHook(data, lang);
  const caption = buildCaption({
    title,
    hook,
    bullets,
    tags: mergedTags,
    locale: lang,
    platform: platformKey,
    dataType: data.dataType,
  });

  return {
    locale: lang,
    platform: platformKey,
    title,
    description,
    tags: mergedTags,
    bullets,
    caption,
  };
}

module.exports = {
  buildSocialCopy,
  getLocalizedPayload,
  inferTitle,
  inferDescription,
  extractCopyBullets,
  buildCaption,
  normalizePatchVersion,
};
