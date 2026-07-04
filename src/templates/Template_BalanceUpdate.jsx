import React from "react";
import { AbsoluteFill, Img, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { BgmLayer } from "../video-system/BgmLayer";
import { HEXTECH_COLORS, HextechBackground } from "../video-system/HextechBackground";
import { SubtitleCaption } from "../video-system/SubtitleCaption";
import { buildTimeline, getActiveTimelineScene } from "../video-system/pacing";
import { resolveRenderAssetSrc } from "../video-system/renderAssetSrc";
import { SocialCommentCard } from "../components/SocialCommentCard";

export const BALANCE_LABEL_MAP = {
  BUFF: { text: "英雄增強", short: "增強", color: "#10b981", shadow: "rgba(16, 185, 129, 0.78)" },
  NERF: { text: "慘遭削弱", short: "削弱", color: "#ef4444", shadow: "rgba(239, 68, 68, 0.78)" },
  ADJUST: { text: "數值調整", short: "調整", color: "#f59e0b", shadow: "rgba(245, 158, 11, 0.76)" },
  REWORK: { text: "機制重塑", short: "重製", color: "#06b6d4", shadow: "rgba(6, 182, 212, 0.76)" },
};

const BALANCE_LABEL_MAP_EN = {
  BUFF: { text: "Buffed", short: "BUFF", color: "#10b981", shadow: "rgba(16, 185, 129, 0.78)" },
  NERF: { text: "Nerfed", short: "NERF", color: "#ef4444", shadow: "rgba(239, 68, 68, 0.78)" },
  ADJUST: { text: "Adjusted", short: "ADJUST", color: "#f59e0b", shadow: "rgba(245, 158, 11, 0.76)" },
  REWORK: { text: "Reworked", short: "REWORK", color: "#06b6d4", shadow: "rgba(6, 182, 212, 0.76)" },
};

const DDRAGON_VERSION = "16.9.1";
const GOLD = HEXTECH_COLORS.gold;
const PARCHMENT = "#F0E6D2";
const INK = "#060B12";

const CHAMPION_ID_MAP = {
  "Nunu & Willump": "Nunu",
  Wukong: "MonkeyKing",
  "Renata Glasc": "Renata",
  "Bel'Veth": "Belveth",
  "K'Sante": "KSante",
  "Kai'Sa": "Kaisa",
  "Kha'Zix": "Khazix",
  LeBlanc: "Leblanc",
  "Vel'Koz": "Velkoz",
  "Cho'Gath": "Chogath",
  "Kog'Maw": "KogMaw",
  "Rek'Sai": "RekSai",
  "Master Yi": "MasterYi",
  "Tahm Kench": "TahmKench",
};

const CHAMPION_TW_NAME_MAP = {
  Aatrox: "厄薩斯",
  Ahri: "阿璃",
  Akali: "阿卡莉",
  Alistar: "亞歷斯塔",
  Amumu: "阿姆姆",
  Annie: "安妮",
  Ashe: "艾希",
  Azir: "阿祈爾",
  Caitlyn: "凱特琳",
  Darius: "達瑞斯",
  Draven: "達瑞文",
  Ezreal: "伊澤瑞爾",
  Galio: "加里歐",
  Graves: "葛雷夫",
  Gwen: "關",
  Irelia: "伊瑞莉雅",
  Jinx: "吉茵珂絲",
  KaiSa: "凱莎",
  "Kai'Sa": "凱莎",
  LeeSin: "李星",
  "Lee Sin": "李星",
  Lux: "拉克絲",
  Quinn: "葵恩",
  MasterYi: "易大師",
  "Master Yi": "易大師",
  Riven: "雷玟",
  Shyvana: "希瓦娜",
  TahmKench: "貪啃奇",
  "Tahm Kench": "貪啃奇",
  Vayne: "汎",
  Yasuo: "犽宿",
  Yone: "犽凝",
  Zed: "劫",
};

const SKILL_LABELS = {
  P: "被動",
  Q: "Q 技能",
  W: "W 技能",
  E: "E 技能",
  R: "R 大絕",
  BASE: "基礎數值",
};

const SKILL_LABELS_EN = {
  P: "Passive",
  Q: "Q Ability",
  W: "W Ability",
  E: "E Ability",
  R: "Ultimate",
  BASE: "Base Stats",
};

const SKILL_SHORT = {
  P: "P",
  Q: "Q",
  W: "W",
  E: "E",
  R: "R",
  BASE: "BASE",
};

const METRIC_NAME_MAP = {
  HEAL_SHIELD: "護盾 / 治療",
  DAMAGE: "傷害",
  damage: "傷害",
  COOLDOWN: "冷卻時間",
  cooldown: "冷卻時間",
  cd: "冷卻時間",
  MANA_COST: "魔力消耗",
  "mana cost": "魔力消耗",
  BASE_STATS: "基礎數值",
  "base stats": "基礎數值",
  ATTACK_DAMAGE: "攻擊力",
  "attack damage": "攻擊力",
  "base attack damage": "基礎攻擊力",
  "base ad": "基礎攻擊力",
  ad: "攻擊力",
  "bonus ad": "額外攻擊力",
  ATTACK_SPEED: "攻擊速度",
  "attack speed": "攻擊速度",
  AP_RATIO: "魔法係數",
  "ap ratio": "魔法係數",
  AD_RATIO: "物攻係數",
  "ad ratio": "物攻係數",
  ARMOR: "物理防禦",
  armor: "物理防禦",
  MAGIC_RESIST: "魔法防禦",
  "magic resist": "魔法防禦",
  HEALTH: "生命值",
  health: "生命值",
  "base health": "基礎生命值",
  "base damage": "基礎傷害",
  "magic damage": "魔法傷害",
  "physical damage": "物理傷害",
  "total damage": "總傷害",
  "crit increase": "暴擊收益",
  "critical strike": "暴擊收益",
  "critical strike chance": "暴擊率",
  "crit chance": "暴擊率",
  "crit damage": "暴擊傷害",
  "cast time": "施放前搖",
  range: "距離 / 範圍",
  radius: "範圍半徑",
  duration: "持續時間",
  slow: "緩速效果",
  shield: "護盾值",
  heal: "治療量",
  healing: "治療量",
};

const METRIC_NAME_MAP_EN = Object.fromEntries(
  Object.entries(METRIC_NAME_MAP)
    .filter(([key]) => !/^[a-z_ ]+$/.test(key) || key.includes("_"))
    .map(([key, value]) => [value, String(key).replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())])
);

const NEGATIVE_STAT_PATTERN =
  /cooldown|cd|冷卻|mana cost|魔力|耗魔|cost|價格|cast time|前搖|recharge|充能|damage taken|受到傷害|self damage|自傷|self slow|自我減速/i;

const normalizeChampionId = (name) => {
  const raw = String(name || "Aatrox").trim();
  return CHAMPION_ID_MAP[raw] || raw.replace(/[\s'.]/g, "");
};

const isEnglishVideo = (data = {}) => String(data.locale || data.outputLanguage || "zh").toLowerCase().startsWith("en");
const isSystemUpdate = (data = {}) => data.dataType === "SYSTEM_UPDATE" || String(data.targetType || "").toUpperCase() === "SYSTEM";

const getCopy = (data = {}) => {
  const copy = isEnglishVideo(data) ? {
    patchDossier: "PATCH DOSSIER",
    livePatch: "LIVE PATCH",
    abilityChange: "ABILITY CHANGE",
    change: "CHANGE",
    practicalTranslation: "GAMEPLAY READ",
    practicalRead: "PRACTICAL READ",
    practicalTitle: "Three Things That Matter",
    community: "COMMUNITY REACTION",
    verdictTitle: "Gameplay Verdict",
    fallbackRole: "Patch Role",
    latestPatch: "Latest Patch",
    metricFallback: "Core Stat",
    contextFallback: "This change directly affects lane, jungle, or teamfight timing.",
    sceneNoteFallback: "This change affects real-game tempo.",
    point: "Point",
    backToPractice: "Retest it in real games first.",
  } : {
    patchDossier: "版本檔案",
    livePatch: "即時版本",
    abilityChange: "技能改動",
    change: "改動",
    practicalTranslation: "實戰翻譯",
    practicalRead: "實戰判讀",
    practicalTitle: "實戰要看這三件事",
    community: "社群風向",
    verdictTitle: "實戰結論",
    fallbackRole: "版本定位",
    latestPatch: "最新版本",
    metricFallback: "核心數值",
    contextFallback: "這項改動會直接影響對線、刷野或團戰的節奏判斷。",
    sceneNoteFallback: "這段改動會影響實戰節奏。",
    point: "重點",
    backToPractice: "先回到實戰測試手感。",
  };

  if (!isSystemUpdate(data)) return copy;
  return isEnglishVideo(data)
    ? {
        ...copy,
        patchDossier: "SYSTEM DOSSIER",
        abilityChange: "SYSTEM CHANGE",
        fallbackRole: "Patch System",
        practicalTitle: "What Changes In Game",
        contextFallback: "This system change affects route, role, or objective timing.",
        sceneNoteFallback: "The real impact is timing, priority, and map movement.",
      }
    : {
        ...copy,
        patchDossier: "系統檔案",
        abilityChange: "系統改動",
        fallbackRole: "版本系統",
        practicalTitle: "實戰要看這三個節奏",
        contextFallback: "這項系統改動會影響路線、位置或物件時間點。",
        sceneNoteFallback: "真正影響的是時間點、優先級與跑圖判斷。",
      };
};

const getBalanceLabel = (changeType, data = {}) => {
  if (isSystemUpdate(data)) {
    return isEnglishVideo(data)
      ? { text: "System Shift", short: "SYSTEM", color: "#0AC8B9", shadow: "rgba(10, 200, 185, 0.76)" }
      : { text: "系統調整", short: "系統", color: "#0AC8B9", shadow: "rgba(10, 200, 185, 0.76)" };
  }
  const map = isEnglishVideo(data) ? BALANCE_LABEL_MAP_EN : BALANCE_LABEL_MAP;
  return map[changeType] || map.ADJUST;
};

const getSkillLabel = (skillKey, data = {}) => {
  if (isSystemUpdate(data)) return isEnglishVideo(data) ? "System Rule" : "系統規則";
  const labels = isEnglishVideo(data) ? SKILL_LABELS_EN : SKILL_LABELS;
  return labels[skillKey] || (isEnglishVideo(data) ? `${skillKey} Ability` : `${skillKey} 技能`);
};

const getChampionTWName = (data = {}) => {
  if (isSystemUpdate(data)) {
    return isEnglishVideo(data)
      ? data.targetName || data.localizedName || data.headline || "System Update"
      : data.localizedName || data.targetName || data.headline || "系統改動";
  }
  if (isEnglishVideo(data)) return data.championName || data.localizedChampionName || "Patch Champion";
  const raw = data.localizedChampionName || data.championTwName || data.zhName || data.championName || "版本英雄";
  return CHAMPION_TW_NAME_MAP[raw] || CHAMPION_TW_NAME_MAP[data.championName] || raw;
};

const getChampionIcon = (name) =>
  `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/champion/${normalizeChampionId(name)}.png`;

const getSplash = (data) =>
  isSystemUpdate(data) ? (data.splashUrl || data.heroImageUrl || "") :
  data.splashUrl ||
  data.heroImageUrl ||
  `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${normalizeChampionId(data.championName)}_0.jpg`;

const getChangeType = (data = {}) => {
  const raw = data.changeType || data.overallTrend || data.trend || "ADJUST";
  return BALANCE_LABEL_MAP[raw] ? raw : "ADJUST";
};

const getSkillIcon = (data, scene = {}) => {
  if (isSystemUpdate(data)) return scene.iconUrl || scene.skillIconUrl || data.heroIconUrl || "";
  const skillKey = scene.skillKey || data.skillKey || "BASE";
  return scene.iconUrl || scene.skillIconUrl || data.skillIcons?.[skillKey] || data.skillIconUrl || data.heroIconUrl || getChampionIcon(data.championName);
};

const parseNumber = (value) => {
  const match = String(value ?? "").match(/-?\d+(?:\.\d+)?/);
  const n = match ? Number(match[0]) : NaN;
  return Number.isFinite(n) ? n : null;
};

const isDefinedValue = (value) => value !== undefined && value !== null && String(value).trim() !== "";

const localizeMetricName = (name, data = {}) => {
  const copy = getCopy(data);
  const raw = String(name || copy.metricFallback).trim();
  if (isEnglishVideo(data)) {
    return METRIC_NAME_MAP_EN[raw] || raw;
  }
  const normalized = raw
    .replace(/^[PQWER]\s*[-:：]\s*/i, "")
    .replace(/[_/()-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  return METRIC_NAME_MAP[raw] || METRIC_NAME_MAP[raw.toUpperCase()] || METRIC_NAME_MAP[normalized] || raw;
};

const normalizeMetrics = (scene = {}, data = {}) => {
  const raw = Array.isArray(scene.metrics) && scene.metrics.length > 0
    ? scene.metrics
    : Array.isArray(data.metrics) && data.metrics.length > 0
      ? data.metrics
      : scene.metricName
        ? [scene]
        : isDefinedValue(scene.beforeValue) || isDefinedValue(scene.afterValue)
          ? [scene]
        : data.metricName
          ? [data]
          : [];

  return raw
    .filter(Boolean)
    .slice(0, 4)
    .map((metric) => ({
      metricName: localizeMetricName(metric.metricName || metric.statLabel || scene.statLabel || data.statCategory || getCopy(data).metricFallback, data),
      beforeValue: metric.beforeValue,
      afterValue: metric.afterValue,
      trend: BALANCE_LABEL_MAP[metric.trend] ? metric.trend : scene.trend || data.changeType || "ADJUST",
      summary: compactText(metric.summary || metric.impactText || metric.combatTranslation || "", "", 38),
    }));
};

const getMetricVisual = (metric = {}, data = {}) => {
  const trend = BALANCE_LABEL_MAP[metric.trend] ? metric.trend : "ADJUST";
  const before = parseNumber(metric.beforeValue);
  const after = parseNumber(metric.afterValue);
  const valueMovedDown = before !== null && after !== null && after < before;
  const valueMovedUp = before !== null && after !== null && after > before;
  const label = getBalanceLabel(trend, data);
  const isNegativeStat = NEGATIVE_STAT_PATTERN.test(String(metric.metricName || ""));

  if (trend === "BUFF") {
    return {
      ...label,
      arrow: valueMovedDown ? "↓" : valueMovedUp ? "↑" : "◆",
      direction: isEnglishVideo(data)
        ? (valueMovedDown && isNegativeStat ? "Cost lowered" : valueMovedUp ? "Value increased" : "Power up")
        : (valueMovedDown && isNegativeStat ? "成本降低" : valueMovedUp ? "數值提升" : "強度上修"),
    };
  }

  if (trend === "NERF") {
    return {
      ...label,
      arrow: valueMovedDown ? "↓" : valueMovedUp ? "↑" : "◆",
      direction: isEnglishVideo(data)
        ? (valueMovedUp && isNegativeStat ? "Cost increased" : valueMovedDown ? "Value decreased" : "Power down")
        : (valueMovedUp && isNegativeStat ? "成本提高" : valueMovedDown ? "數值降低" : "強度下修"),
    };
  }

  return { ...label, arrow: "◆", direction: isEnglishVideo(data) ? (trend === "REWORK" ? "Mechanics changed" : "Mixed adjustment") : (trend === "REWORK" ? "機制改寫" : "混合調整") };
};

const cleanLine = (text) => String(text || "").replace(/\s+/g, " ").trim();

const isRawPatchBlob = (text = "") => {
  const value = String(text || "");
  if (value.length > 120) return true;
  if ((value.match(/=>|→|:/g) || []).length >= 3) return true;
  if (/\[[A-Z]\s*-|【[A-Z]\s*-|Shield:|Damage:|Cooldown:/i.test(value)) return true;
  return false;
};

const compactText = (text, fallback, maxLength = 44) => {
  const cleaned = cleanLine(text);
  if (!cleaned || isRawPatchBlob(cleaned)) return fallback;
  return cleaned.length > maxLength ? `${cleaned.slice(0, maxLength)}…` : cleaned;
};

const getSceneImpactText = (scene = {}, metrics = [], data = {}) => {
  const explicit = scene.impactText || scene.combatTranslation || scene.summary || scene.practicalImpact;
  if (explicit) return cleanLine(explicit);
  const metricSummary = metrics.find((metric) => metric.summary)?.summary;
  if (metricSummary) return cleanLine(metricSummary);
  const subtitle = String(scene.text || "").split("\n").map(cleanLine).filter(Boolean).join("，");
  return subtitle || getCopy(data).contextFallback;
};

const buildMechanicPayload = (scene = {}, data = {}) => {
  const en = isEnglishVideo(data);
  const copy = getCopy(data);
  const mechanic = scene.mechanicChange || data.mechanicChange || {};
  const fallbackText = String(scene.text || "").replace(/\n/g, "，");
  const changeBullets = Array.isArray(mechanic.changeBullets) && mechanic.changeBullets.length > 0
    ? mechanic.changeBullets
    : Array.isArray(scene.changeBullets) && scene.changeBullets.length > 0
      ? scene.changeBullets
      : [];
  const rawChangeSummary = mechanic.changeSummary || scene.rawChangeDesc || data.changeDesc || data.statChange || "";
  const rawText = [
    rawChangeSummary,
    mechanic.beforeBehavior,
    mechanic.afterBehavior,
    scene.beforeBehavior,
    scene.afterBehavior,
    fallbackText,
    data.changeDesc,
    data.statChange,
  ].filter(Boolean).join(" ");
  const skillKey = scene.skillKey || data.skillKey || "BASE";
  const isLeeSinW =
    /Lee Sin|李星|Safeguard|摸眼|ward|minion|shield/i.test(rawText) &&
    (skillKey === "W" || /Safeguard|W\s*-|W 技能/i.test(rawText));
  const defaultAfter = isLeeSinW
    ? (en ? "W shield, cooldown, and ward-hop interactions were reworked around engage timing." : "W 的護盾、冷卻與摸眼互動被重整，重點是進退場節奏。")
    : (en ? "The new interaction changes input flow and engage decisions." : "新版互動會影響操作流程與進退場判斷。");
  const defaultBefore = isLeeSinW
    ? (en ? "The old pattern relied on the previous W ward-hop rhythm and shield window." : "舊版打法更依賴原本的 W 摸眼節奏與護盾窗口。")
    : (en ? "The old pattern relied on the previous skill interaction and combo rhythm." : "舊版打法依賴原本的技能互動與連招節奏。");
  const defaultCombos = isLeeSinW
    ? (en ? ["Ward-hop Engage", "Shield Window", "Ranked Test"] : ["摸眼進場", "護盾窗口", "排位實測"])
    : (en ? ["Combo Rhythm", "Engage Timing", "Ranked Test"] : ["連招節奏", "進退場", "排位實測"]);
  const defaultCards = isLeeSinW
    ? (en ? [
        { title: "Shield Window", body: "W defense and cooldown rules changed; do not judge one number alone." },
        { title: "Mobility Feel", body: "Ward-hop, minion-hop, and ally-hop timing must be retested." },
        { title: "Ranked Call", body: "High-mastery players should verify combo stability first." },
      ] : [
        { title: "護盾窗口", body: "W 防護與冷卻規則重整，不能只看單一數字。" },
        { title: "位移手感", body: "摸眼、跳小兵、跳隊友的進退場節奏要重新測。" },
        { title: "排位判斷", body: "主流玩家先確認連招穩定度，再決定是否帶進排位。" },
      ])
    : (en ? [
        { title: "Input Flow", body: "The interaction changed, so old combos may not transfer cleanly." },
        { title: "Game Rhythm", body: "Engage, disengage, trades, or clear windows need a reset." },
        { title: "Ranked Advice", body: "Test feel and build paths before taking it ranked." },
      ] : [
        { title: "操作流程", body: "技能互動改了，舊連招不一定能無痛照搬。" },
        { title: "對局節奏", body: "進場、退場、換血或刷野窗口都要重新評估。" },
        { title: "排位建議", body: "先測手感與出裝，再決定是否投入排位。" },
      ]);

  return {
    title: compactText(mechanic.title || scene.mechanicTitle, `${getSkillLabel(skillKey, data)}${en ? " Focus" : "機制重點"}`, 26),
    changeSummary: compactText(rawChangeSummary || mechanic.afterBehavior || scene.afterBehavior || fallbackText, defaultAfter, 62),
    changeBullets: changeBullets.map((item) => compactText(item, "", 58)).filter(Boolean).slice(0, 4),
    beforeBehavior: compactText(mechanic.beforeBehavior || scene.beforeBehavior, defaultBefore, 48),
    afterBehavior: compactText(mechanic.afterBehavior || scene.afterBehavior || fallbackText, defaultAfter, 48),
    affectedCombos: Array.isArray(mechanic.affectedCombos) && mechanic.affectedCombos.length > 0
      ? mechanic.affectedCombos
      : Array.isArray(scene.affectedCombos) && scene.affectedCombos.length > 0
        ? scene.affectedCombos
        : defaultCombos,
    proImpact: compactText(mechanic.proImpact || scene.proImpact, en ? "High-mastery players must retest combo windows and engage timing." : "高熟練玩家要重新確認連招窗口與進場時機。", 56),
    cards: Array.isArray(mechanic.cards) && mechanic.cards.length > 0 ? mechanic.cards.slice(0, 3) : defaultCards,
  };
};

const normalizeSceneDuration = (scene = {}, index = 0) => {
  if (scene.tag === "HOOK") return 108;
  if (scene.tag === "SKILL_SHOWCASE" || scene.tag === "STAT_REVEAL") return 152;
  if (scene.tag === "MECHANIC_EXPLAINER") return 178;
  if (scene.tag === "IMPACT_BREAKDOWN") return 148;
  if (scene.tag === "COMMUNITY_BUZZ") return 112;
  if (scene.tag === "CONCLUSION_CTA" || scene.tag === "OUTRO" || scene.tag === "VERDICT") return 132;
  return index === 0 ? 108 : 132;
};

const buildImpactScene = (data = {}, sourceScene = {}) => ({
  tag: "IMPACT_BREAKDOWN",
  text: isEnglishVideo(data) ? "Retest combos and builds\nBefore chasing LP" : "連招與出裝先重測\n再決定能不能上分",
  skillKey: sourceScene.skillKey || data.skillKey || "BASE",
  durationInFrames: 148,
});

const buildPatchStoryboard = (data = {}) => {
  const existing = Array.isArray(data.storyboard) && data.storyboard.length > 0 ? data.storyboard : null;
  if (existing) {
    const hook = existing.find((scene) => scene.tag === "HOOK") || existing[0];
    const skillScenes = existing.filter((scene) => scene.tag === "SKILL_SHOWCASE" || scene.tag === "STAT_REVEAL" || scene.tag === "MECHANIC_EXPLAINER").slice(0, 6);
    const social = existing.find((scene) => scene.tag === "COMMUNITY_BUZZ");
    const verdict = existing.find((scene) => ["CONCLUSION_CTA", "OUTRO", "VERDICT"].includes(scene.tag));
    const needsImpactScene = skillScenes.length > 0 && !existing.some((scene) => scene.tag === "IMPACT_BREAKDOWN");
    const impactScene = needsImpactScene ? buildImpactScene(data, skillScenes[skillScenes.length - 1]) : null;
    const ordered = [hook, ...skillScenes, impactScene, social, verdict].filter(Boolean);
    const compact = ordered.length > 0 ? ordered : existing.slice(0, 5);

    return compact.map((scene, index) => ({
      ...scene,
      tag: scene.tag === "STAT_REVEAL" ? "SKILL_SHOWCASE" : scene.tag,
      durationInFrames: normalizeSceneDuration(scene, index),
    }));
  }

  const name = getChampionTWName(data);
  const en = isEnglishVideo(data);
  return [
    { tag: "HOOK", text: en ? `${name} Patch Update\nCheck the real role` : `${name}版本改動\n先看實戰定位`, durationInFrames: 108 },
    {
      tag: "SKILL_SHOWCASE",
      text: en ? "Core numbers changed\nGame tempo needs a reset" : "核心數值出現變化\n對局節奏要重估",
      skillKey: data.skillKey || "BASE",
      metrics: normalizeMetrics(data, data),
      durationInFrames: 152,
    },
    buildImpactScene(data),
    { tag: "CONCLUSION_CTA", text: en ? "Test the play window first\nBefore taking it ranked" : "先測打法窗口\n再決定能不能上分", durationInFrames: 132 },
  ];
};

const DossierChrome = ({ label, data }) => {
  const copy = getCopy(data);
  return (
  <>
    <div
      style={{
        position: "absolute",
        inset: 44,
        zIndex: 4,
        pointerEvents: "none",
        border: `2px solid ${GOLD}cc`,
        boxShadow: `0 0 52px rgba(0,0,0,0.78), inset 0 0 82px rgba(2,6,14,0.9), 0 0 24px ${label.shadow}`,
        clipPath: "polygon(30px 0, 100% 0, 100% calc(100% - 30px), calc(100% - 30px) 100%, 0 100%, 0 30px)",
      }}
    />
    <div
      style={{
        position: "absolute",
        top: 58,
        left: 78,
        right: 78,
        zIndex: 8,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        color: "rgba(240,230,210,0.62)",
        fontSize: 17,
        fontWeight: 950,
        letterSpacing: 4,
      }}
    >
      <span>{copy.patchDossier}</span>
      <span>{data.patchVersion || copy.livePatch}</span>
    </div>
  </>
  );
};

const DossierAtmosphere = ({ label }) => {
  const frame = useCurrentFrame();
  const rotate = frame * 0.035;

  return (
    <>
      <AbsoluteFill
        style={{
          background: [
            "radial-gradient(circle at 52% 17%, rgba(240,230,210,0.12), transparent 24%)",
            "radial-gradient(circle at 50% 52%, rgba(200,170,110,0.18), transparent 30%)",
            "radial-gradient(circle at 50% 58%, rgba(10,30,48,0.42), transparent 44%)",
            "linear-gradient(180deg, rgba(2,6,14,0.12), rgba(2,6,14,0.68) 64%, rgba(2,6,14,0.92))",
          ].join(", "),
          zIndex: 2,
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 760,
          height: 760,
          left: 160,
          top: 420,
          borderRadius: "50%",
          border: `1px solid ${GOLD}22`,
          boxShadow: `inset 0 0 42px ${GOLD}16, 0 0 30px rgba(200,170,110,0.16)`,
          transform: `rotate(${rotate}deg)`,
          zIndex: 3,
          opacity: 0.42,
        }}
      >
        {Array.from({ length: 12 }, (_, index) => (
          <div
            key={index}
            style={{
              position: "absolute",
              left: "50%",
              top: -9,
              width: 18,
              height: 18,
              border: `1px solid ${GOLD}55`,
              transformOrigin: `0 389px`,
              transform: `rotate(${index * 30}deg)`,
            }}
          />
        ))}
      </div>
    </>
  );
};

const DossierStage = ({ children, style = {} }) => (
  <div
    style={{
      position: "absolute",
      inset: "92px 64px 212px",
      zIndex: 10,
      ...style,
    }}
  >
    {children}
  </div>
);

const ClassificationPlate = ({ label, localFrame = 0, compact = false }) => {
  const { fps } = useVideoConfig();
  const pop = spring({ frame: Math.max(0, localFrame), fps, config: { stiffness: 210, damping: 16, mass: 0.7 } });

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 12,
        padding: compact ? "10px 18px" : "13px 26px",
        border: `2px solid ${label.color}`,
        background: `linear-gradient(90deg, rgba(2,6,14,0.92), ${label.shadow}, rgba(2,6,14,0.92))`,
        color: label.color,
        borderRadius: 6,
        boxShadow: `0 0 34px ${label.shadow}, inset 0 0 22px rgba(240,230,210,0.08)`,
        fontSize: compact ? 21 : 28,
        fontWeight: 950,
        letterSpacing: compact ? 3 : 5,
        transform: `translateY(${interpolate(pop, [0, 1], [-18, 0])}px) scale(${interpolate(pop, [0, 1], [0.9, 1])})`,
        opacity: pop,
      }}
    >
      <span>{label.short}</span>
      <span style={{ color: PARCHMENT, opacity: 0.88, letterSpacing: 2 }}>{label.text}</span>
    </div>
  );
};

const SystemGlyph = ({ text = "SYS", fontSize = 34 }) => (
  <div
    style={{
      width: "100%",
      height: "100%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: INK,
      background: `radial-gradient(circle at 50% 42%, ${GOLD}, #f4d58d 58%, rgba(10,200,185,0.74))`,
      fontSize,
      fontWeight: 950,
      letterSpacing: 2,
      textAlign: "center",
    }}
  >
    {text}
  </div>
);

const SystemAwareImage = ({ data, scene = {}, style = {}, fallbackText = "SYS" }) => {
  const src = getSkillIcon(data, scene);
  if (isSystemUpdate(data) && !src) {
    return <SystemGlyph text={fallbackText} fontSize={style.fontSize || 34} />;
  }
  return <Img src={resolveRenderAssetSrc(src || data.heroIconUrl || getChampionIcon(data.championName))} style={style} />;
};

const SkillOrbit = ({ data, scenes = [], label, localFrame = 0 }) => {
  const { fps } = useVideoConfig();
  const pop = spring({ frame: Math.max(0, localFrame - 20), fps, config: { stiffness: 180, damping: 17 } });
  const skillScenes = scenes
    .filter((scene) => scene.tag === "SKILL_SHOWCASE" || scene.tag === "MECHANIC_EXPLAINER")
    .slice(0, 6);

  if (skillScenes.length === 0) return null;

  return (
    <div style={{ display: "flex", gap: 18, justifyContent: "center", marginTop: 32, opacity: pop }}>
      {skillScenes.map((scene, index) => {
        const skillKey = scene.skillKey || "BASE";
        return (
          <div
            key={`${skillKey}-${index}`}
            style={{
              width: 72,
              height: 72,
              borderRadius: 12,
              border: `2px solid ${GOLD}bb`,
              background: "rgba(2,6,14,0.72)",
              overflow: "hidden",
              boxShadow: `0 0 20px ${label.shadow}`,
              transform: `translateY(${interpolate(pop, [0, 1], [28 + index * 4, 0])}px)`,
              position: "relative",
            }}
          >
            <SystemAwareImage data={data} scene={scene} fallbackText={isEnglishVideo(data) ? "SYS" : "系統"} style={{ width: "100%", height: "100%", objectFit: "cover", filter: "saturate(1.06)", fontSize: 22 }} />
            <div
              style={{
                position: "absolute",
                right: 4,
                bottom: 2,
                color: PARCHMENT,
                fontSize: 15,
                fontWeight: 950,
                textShadow: "0 2px 6px rgba(0,0,0,0.95)",
              }}
            >
              {SKILL_SHORT[skillKey] || skillKey}
            </div>
          </div>
        );
      })}
    </div>
  );
};

const HookScene = ({ data, label, storyboard, localFrame }) => {
  const { fps } = useVideoConfig();
  const copy = getCopy(data);
  const heroIn = spring({ frame: Math.max(0, localFrame - 6), fps, config: { stiffness: 130, damping: 14, mass: 0.75 } });
  const name = getChampionTWName(data);
  const role = data.primaryRole || data.role || data.lane || copy.fallbackRole;
  const dossierLabel = isSystemUpdate(data)
    ? (isEnglishVideo(data) ? "SYSTEM DOSSIER" : "系統檔案")
    : (isEnglishVideo(data) ? "CHAMPION DOSSIER" : "英雄檔案");

  return (
    <DossierStage style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
      <ClassificationPlate label={label} localFrame={localFrame} />
      <div
        style={{
          marginTop: 34,
          width: 236,
          height: 236,
          borderRadius: "50%",
          padding: 10,
          border: `3px solid ${GOLD}`,
          background: "linear-gradient(135deg, rgba(240,230,210,0.14), rgba(2,6,14,0.9))",
          boxShadow: `0 0 42px rgba(200,170,110,0.28), 0 0 22px ${label.shadow}, inset 0 0 30px rgba(240,230,210,0.12)`,
          transform: `translateY(${interpolate(heroIn, [0, 1], [46, 0])}px) scale(${interpolate(heroIn, [0, 1], [0.78, 1])})`,
          opacity: heroIn,
        }}
      >
        <div style={{ width: "100%", height: "100%", borderRadius: "50%", overflow: "hidden", border: "2px solid rgba(240,230,210,0.65)" }}>
          {isSystemUpdate(data) && !data.heroIconUrl ? (
            <SystemGlyph text={isEnglishVideo(data) ? "SYS" : "系統"} fontSize={48} />
          ) : (
            <Img src={resolveRenderAssetSrc(data.heroIconUrl || getChampionIcon(data.championName))} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          )}
        </div>
      </div>

      <div style={{ textAlign: "center", marginTop: 26 }}>
        <div style={{ color: GOLD, fontSize: 24, fontWeight: 950, letterSpacing: 7 }}>{dossierLabel}</div>
        <div
          style={{
            color: "#fff",
            fontSize: 104,
            fontWeight: 950,
            lineHeight: 1,
            marginTop: 10,
            textShadow: `0 0 42px ${label.shadow}, 0 10px 34px rgba(0,0,0,0.95)`,
          }}
        >
          {name}
        </div>
        <div style={{ marginTop: 20, display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          {[role, label.text, data.patchVersion || copy.latestPatch].filter(Boolean).slice(0, 3).map((chip) => (
            <span
              key={chip}
              style={{
                padding: "8px 16px",
                borderRadius: 4,
                border: `1px solid ${GOLD}88`,
                color: PARCHMENT,
                background: "rgba(2,6,14,0.62)",
                fontSize: 20,
                fontWeight: 900,
              }}
            >
              {chip}
            </span>
          ))}
        </div>
      </div>
      <SkillOrbit data={data} scenes={storyboard} label={label} localFrame={localFrame} />
    </DossierStage>
  );
};

const MetricPlaque = ({ metric, index, localFrame, compact = false, data = {} }) => {
  const { fps } = useVideoConfig();
  const visual = getMetricVisual(metric, data);
  const pop = spring({ frame: Math.max(0, localFrame - index * 9), fps, config: { stiffness: 220, damping: 18, mass: 0.64 } });
  const beforeText = String(metric.beforeValue ?? "");
  const afterText = String(metric.afterValue ?? "");
  const longValues = beforeText.length > 8 || afterText.length > 8;
  const hasValues =
    isDefinedValue(metric.beforeValue) &&
    isDefinedValue(metric.afterValue) &&
    String(metric.beforeValue) !== String(metric.afterValue);
  const valueFont = longValues ? (compact ? 25 : 29) : (compact ? 42 : 50);
  const afterFont = longValues ? (compact ? 27 : 31) : (compact ? 47 : 56);
  const arrowFont = longValues ? (compact ? 30 : 34) : (compact ? 40 : 48);

  return (
    <div
      style={{
        width: "100%",
        padding: compact ? "18px 24px" : "26px 30px",
        borderRadius: 8,
        border: `1.5px solid ${GOLD}99`,
        background: [
          "linear-gradient(135deg, rgba(240,230,210,0.08), transparent 28%)",
          "linear-gradient(180deg, rgba(9,18,32,0.94), rgba(3,8,16,0.9))",
        ].join(", "),
        boxShadow: `0 20px 44px rgba(0,0,0,0.42), inset 0 0 28px rgba(240,230,210,0.06), 0 0 26px ${visual.shadow}`,
        transform: `translateX(${interpolate(pop, [0, 1], [index % 2 ? 70 : -70, 0])}px) scale(${interpolate(pop, [0, 1], [0.94, 1])})`,
        opacity: pop,
      }}
    >
      <div style={{ display: "grid", gridTemplateColumns: longValues ? "1fr" : "1.2fr 0.95fr", alignItems: "center", gap: longValues ? 16 : 24 }}>
        <div>
          <div style={{ color: PARCHMENT, fontSize: compact ? 28 : 33, fontWeight: 950, lineHeight: 1.12 }}>{metric.metricName}</div>
          <div style={{ color: visual.color, fontSize: compact ? 17 : 20, fontWeight: 950, marginTop: 8, letterSpacing: 2 }}>
            {visual.direction}
          </div>
        </div>
        {hasValues ? (
          <div style={{ display: "grid", gridTemplateColumns: longValues ? "minmax(0, 1fr) 42px minmax(0, 1fr)" : "1fr 54px 1fr", alignItems: "center", gap: longValues ? 8 : 12 }}>
            <div style={{ color: "#aeb8ca", fontSize: valueFont, fontWeight: 950, textAlign: "right", lineHeight: 1.08, wordBreak: "keep-all", overflowWrap: "break-word" }}>
              {metric.beforeValue}
            </div>
            <div style={{ color: visual.color, fontSize: arrowFont, fontWeight: 950, textAlign: "center", textShadow: `0 0 22px ${visual.shadow}` }}>
              {visual.arrow}
            </div>
            <div style={{ color: visual.color, fontSize: afterFont, fontWeight: 950, lineHeight: 1.08, textShadow: `0 0 22px ${visual.shadow}`, wordBreak: "keep-all", overflowWrap: "break-word" }}>
              {metric.afterValue}
            </div>
          </div>
        ) : (
          <div style={{ color: visual.color, fontSize: compact ? 31 : 38, fontWeight: 950, textAlign: "right" }}>{visual.text}</div>
        )}
      </div>
      {metric.summary ? (
        <div style={{ marginTop: compact ? 10 : 16, color: "rgba(240,230,210,0.78)", fontSize: compact ? 19 : 22, fontWeight: 820, lineHeight: 1.24 }}>
          {metric.summary}
        </div>
      ) : null}
    </div>
  );
};

const PracticalTranslation = ({ text, label, localFrame, data = {} }) => {
  const { fps } = useVideoConfig();
  const copy = getCopy(data);
  const pop = spring({ frame: Math.max(0, localFrame - 8), fps, config: { stiffness: 185, damping: 18 } });

  return (
    <div
      style={{
        width: "100%",
        padding: "22px 26px",
        marginTop: 22,
        borderRadius: 8,
        border: `1px solid ${GOLD}88`,
        background: "linear-gradient(90deg, rgba(2,6,14,0.84), rgba(20,30,45,0.78))",
        boxShadow: "0 18px 34px rgba(0,0,0,0.36), inset 0 1px 0 rgba(240,230,210,0.12)",
        transform: `translateY(${interpolate(pop, [0, 1], [34, 0])}px)`,
        opacity: pop,
      }}
    >
      <div style={{ color: GOLD, fontSize: 22, fontWeight: 950, letterSpacing: 4 }}>{copy.practicalTranslation}</div>
      <div style={{ color: "#fff", fontSize: 34, fontWeight: 940, lineHeight: 1.22, marginTop: 8, textWrap: "balance" }}>
        {text}
      </div>
      <div style={{ marginTop: 12, color: label.color, fontSize: 20, fontWeight: 950 }}>{label.text}</div>
    </div>
  );
};

const MechanicExplainer = ({ payload, label, localFrame, data = {} }) => {
  const { fps } = useVideoConfig();
  const en = isEnglishVideo(data);
  const pop = spring({ frame: Math.max(0, localFrame - 6), fps, config: { stiffness: 190, damping: 17 } });
  const hasSpecificChanges = Array.isArray(payload.changeBullets) && payload.changeBullets.length > 0;
  const rows = hasSpecificChanges
    ? [
        ...payload.changeBullets.slice(0, 3).map((body, index) => [en ? `Change ${index + 1}` : `改動 ${index + 1}`, body]),
        [en ? "Gameplay Impact" : "實戰影響", payload.proImpact],
      ]
    : [
        [en ? "Before" : "改動前", payload.beforeBehavior],
        [en ? "After" : "改動後", payload.afterBehavior],
      ];

  return (
    <div style={{ width: "100%", transform: `translateY(${interpolate(pop, [0, 1], [40, 0])}px)`, opacity: pop }}>
      <div
        style={{
          borderRadius: 8,
          border: `1.5px solid ${GOLD}aa`,
          background: "linear-gradient(180deg, rgba(9,18,32,0.92), rgba(3,8,16,0.88))",
          boxShadow: `0 20px 44px rgba(0,0,0,0.44), 0 0 28px ${label.shadow}`,
          padding: "28px 32px 30px",
        }}
      >
        <div style={{ color: label.color, fontSize: 25, fontWeight: 950, letterSpacing: 4 }}>{payload.title}</div>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 12, marginTop: 18, width: "100%" }}>
          {rows.map(([title, body], index) => (
            <div
              key={title}
              style={{
                border: "1px solid rgba(200,170,110,0.42)",
                background: index === rows.length - 1 && hasSpecificChanges ? "rgba(200,170,110,0.1)" : "rgba(2,6,14,0.56)",
                padding: "13px 18px",
                borderRadius: 6,
                minHeight: 0,
                minWidth: 0,
                overflow: "hidden",
              }}
              >
              <div style={{ color: index === rows.length - 1 && hasSpecificChanges ? label.color : GOLD, fontSize: 20, fontWeight: 950 }}>{title}</div>
              <div
                style={{
                  color: "#fff",
                  fontSize: hasSpecificChanges ? 24 : 25,
                  fontWeight: 880,
                  lineHeight: 1.24,
                  marginTop: 8,
                  wordBreak: "keep-all",
                  overflowWrap: "break-word",
                  whiteSpace: "normal",
                }}
              >
                {body}
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 18, display: "flex", flexWrap: "wrap", gap: 10 }}>
          {payload.affectedCombos.slice(0, 4).map((combo) => (
            <span
              key={combo}
              style={{
                padding: "8px 14px",
                borderRadius: 999,
                background: `linear-gradient(90deg, ${GOLD}, #f4d58d)`,
                color: INK,
                fontSize: 20,
                fontWeight: 950,
              }}
            >
              {combo}
            </span>
          ))}
        </div>
        {!hasSpecificChanges ? (
          <div style={{ marginTop: 16, color: PARCHMENT, fontSize: 28, fontWeight: 900, lineHeight: 1.22 }}>{payload.proImpact}</div>
        ) : null}
      </div>
    </div>
  );
};

const SceneContextPanel = ({ data, scene, label, storyboard = [], activeIndex = 0, localFrame }) => {
  const { fps } = useVideoConfig();
  const copy = getCopy(data);
  const skillScenes = storyboard.filter((item) => item.tag === "SKILL_SHOWCASE" || item.tag === "MECHANIC_EXPLAINER");
  const skillSceneIndexes = storyboard
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => item.tag === "SKILL_SHOWCASE" || item.tag === "MECHANIC_EXPLAINER")
    .map(({ index }) => index);
  const currentIndex = Math.max(0, skillSceneIndexes.findIndex((index) => index === activeIndex));
  const skillKey = scene?.skillKey || data.skillKey || "BASE";
  const metrics = normalizeMetrics(scene, data);
  const metricNames = metrics.map((metric) => metric.metricName).filter(Boolean).slice(0, 3);
  const bullets = Array.isArray(scene?.changeBullets) ? scene.changeBullets : [];
  const sceneNote =
    compactText(scene?.impactText || bullets[0] || metrics[0]?.summary || copy.sceneNoteFallback, copy.sceneNoteFallback, 44);
  const pop = spring({ frame: Math.max(0, localFrame - 18), fps, config: { stiffness: 170, damping: 17 } });

  return (
    <div
      style={{
        marginTop: 20,
        width: "100%",
        display: "grid",
        gridTemplateColumns: "180px 1fr",
        gap: 18,
        alignItems: "stretch",
        transform: `translateY(${interpolate(pop, [0, 1], [28, 0])}px)`,
        opacity: pop,
      }}
    >
      <div
        style={{
          border: `1.5px solid ${GOLD}88`,
          borderRadius: 8,
          background: "linear-gradient(180deg, rgba(200,170,110,0.15), rgba(2,6,14,0.72))",
          padding: "18px 16px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          boxShadow: `0 14px 30px rgba(0,0,0,0.32), 0 0 18px ${label.shadow}`,
        }}
      >
        <div style={{ color: GOLD, fontSize: 18, fontWeight: 950, letterSpacing: 4 }}>{copy.change}</div>
        <div style={{ color: "#fff", fontSize: 45, fontWeight: 950, lineHeight: 1, marginTop: 8 }}>
          {currentIndex + 1}<span style={{ color: "rgba(240,230,210,0.58)", fontSize: 26 }}>/{Math.max(skillScenes.length, 1)}</span>
        </div>
        <div style={{ color: label.color, fontSize: 21, fontWeight: 950, marginTop: 10 }}>{getSkillLabel(skillKey, data)}</div>
      </div>
      <div
        style={{
          border: `1.5px solid ${label.color}66`,
          borderRadius: 8,
          background: "linear-gradient(90deg, rgba(9,18,32,0.94), rgba(3,8,16,0.76))",
          padding: "20px 24px",
          boxShadow: `0 14px 30px rgba(0,0,0,0.32), inset 0 1px 0 rgba(240,230,210,0.1)`,
        }}
      >
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
          {(metricNames.length > 0 ? metricNames : [label.text]).map((item) => (
            <span
              key={item}
              style={{
                color: INK,
                background: `linear-gradient(90deg, ${GOLD}, #f4d58d)`,
                borderRadius: 999,
                padding: "7px 13px",
                fontSize: 18,
                fontWeight: 950,
                whiteSpace: "nowrap",
              }}
            >
              {item}
            </span>
          ))}
        </div>
        <div style={{ color: "#fff", fontSize: 28, fontWeight: 900, lineHeight: 1.24, wordBreak: "keep-all", overflowWrap: "anywhere" }}>
          {sceneNote}
        </div>
      </div>
    </div>
  );
};

const ImpactBreakdownScene = ({ data, scene, label, localFrame }) => {
  const { fps } = useVideoConfig();
  const copy = getCopy(data);
  const sourceScene = Array.isArray(data.storyboard)
    ? data.storyboard.find((item) => item.tag === "MECHANIC_EXPLAINER" || item.tag === "SKILL_SHOWCASE")
    : {};
  const payload = buildMechanicPayload(sourceScene || scene, data);
  const cards = Array.isArray(data.impactPoints) && data.impactPoints.length > 0
    ? data.impactPoints.slice(0, 3)
    : payload.cards;
  const pop = spring({ frame: Math.max(0, localFrame), fps, config: { stiffness: 160, damping: 18 } });

  return (
    <DossierStage style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
      <div
        style={{
          color: GOLD,
          fontSize: 26,
          fontWeight: 950,
          letterSpacing: 6,
          marginBottom: 22,
          transform: `translateY(${interpolate(pop, [0, 1], [24, 0])}px)`,
          opacity: pop,
        }}
      >
        {copy.practicalRead}
      </div>
      <div style={{ color: "#fff", fontSize: 62, fontWeight: 950, lineHeight: 1.06, marginBottom: 28 }}>
        {copy.practicalTitle}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {cards.slice(0, 3).map((card, index) => {
          const cardPop = spring({ frame: Math.max(0, localFrame - 2 - index * 6), fps, config: { stiffness: 220, damping: 18 } });
          const title = typeof card === "string" ? `${copy.point} ${index + 1}` : card.title;
          const body = typeof card === "string" ? card : card.body;
          return (
            <div
              key={`${title}-${index}`}
              style={{
                display: "grid",
                gridTemplateColumns: "86px 1fr",
                gap: 22,
                alignItems: "center",
                padding: "24px 28px",
                borderRadius: 8,
                border: `1.5px solid ${GOLD}88`,
                background: "linear-gradient(90deg, rgba(9,18,32,0.94), rgba(3,8,16,0.82))",
                boxShadow: `0 18px 34px rgba(0,0,0,0.38), 0 0 22px ${label.shadow}`,
                transform: `translateX(${interpolate(cardPop, [0, 1], [index % 2 ? 64 : -64, 0])}px)`,
                opacity: cardPop,
              }}
            >
              <div
                style={{
                  width: 68,
                  height: 68,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: INK,
                  background: `linear-gradient(135deg, ${GOLD}, #f4d58d)`,
                  fontSize: 31,
                  fontWeight: 950,
                }}
              >
                {index + 1}
              </div>
              <div>
                <div style={{ color: GOLD, fontSize: 26, fontWeight: 950 }}>{compactText(title, `${copy.point} ${index + 1}`, 12)}</div>
                <div style={{ color: "#fff", fontSize: 34, fontWeight: 900, lineHeight: 1.22, marginTop: 8, wordBreak: "keep-all" }}>
                  {compactText(body, copy.backToPractice, 44)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </DossierStage>
  );
};

const SkillDossierScene = ({ data, scene, label, storyboard, activeIndex = 0, localFrame }) => {
  const { fps } = useVideoConfig();
  const copy = getCopy(data);
  const skillKey = scene?.skillKey || data.skillKey || "BASE";
  const metrics = normalizeMetrics(scene, data);
  const compactMetrics = metrics.length >= 3;
  const iconPop = spring({ frame: Math.max(0, localFrame - 2), fps, config: { stiffness: 210, damping: 16, mass: 0.66 } });
  const iconPulse = 1 + Math.sin((localFrame || 0) / 14) * 0.018;
  const hasNumericMetrics = metrics.some((metric) => isDefinedValue(metric.beforeValue) && isDefinedValue(metric.afterValue) && String(metric.beforeValue) !== String(metric.afterValue));
  const impactText = getSceneImpactText(scene, metrics, data);

  return (
    <DossierStage style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 22, marginBottom: 22 }}>
        <div
          style={{
            width: 148,
            height: 148,
            borderRadius: 18,
            border: `3px solid ${GOLD}`,
            background: "rgba(2,6,14,0.86)",
            boxShadow: `0 0 40px ${label.shadow}, 0 0 0 7px rgba(200,170,110,0.08)`,
            overflow: "hidden",
            transform: `scale(${interpolate(iconPop, [0, 1], [0.74, 1]) * iconPulse}) rotate(${interpolate(iconPop, [0, 1], [-7, 0])}deg)`,
            opacity: iconPop,
          }}
        >
          <SystemAwareImage data={data} scene={scene} fallbackText={isEnglishVideo(data) ? "SYS" : "系統"} style={{ width: "100%", height: "100%", objectFit: "cover", fontSize: 32 }} />
        </div>
        <div>
          <div style={{ color: GOLD, fontSize: 24, fontWeight: 950, letterSpacing: 5 }}>
            {copy.abilityChange}
            {scene?.partTotal > 1 ? (
              <span style={{ color: PARCHMENT, marginLeft: 14, letterSpacing: 2, fontSize: 20 }}>
                {scene.partIndex}/{scene.partTotal}
              </span>
            ) : null}
          </div>
          <div style={{ color: "#fff", fontSize: 68, fontWeight: 950, lineHeight: 1.02 }}>{getSkillLabel(skillKey, data)}</div>
          <div style={{ marginTop: 10 }}>
            <ClassificationPlate label={label} localFrame={localFrame - 8} compact />
          </div>
        </div>
      </div>

      {hasNumericMetrics ? (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: compactMetrics ? 12 : 17 }}>
            {metrics.map((metric, index) => (
              <MetricPlaque key={`${metric.metricName}-${index}`} metric={metric} index={index} localFrame={localFrame - 4} compact={compactMetrics} data={data} />
            ))}
          </div>
          <PracticalTranslation text={impactText} label={label} localFrame={localFrame} data={data} />
        </>
      ) : (
        <MechanicExplainer payload={buildMechanicPayload(scene, data)} label={label} localFrame={localFrame} data={data} />
      )}
      <SceneContextPanel data={data} scene={scene} label={label} storyboard={storyboard} activeIndex={activeIndex} localFrame={localFrame} />
    </DossierStage>
  );
};

const CommunityScene = ({ data, localFrame, sceneStart }) => {
  const buzz = Array.isArray(data.communityBuzz) ? data.communityBuzz.slice(0, 2) : [];
  const copy = getCopy(data);
  return (
    <DossierStage style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 28 }}>
      <div style={{ color: GOLD, fontSize: 34, fontWeight: 950, letterSpacing: 6 }}>{copy.community}</div>
      <SocialCommentCard buzzArray={buzz} sceneStart={sceneStart} />
    </DossierStage>
  );
};

const VerdictScene = ({ data, label, localFrame }) => {
  const { fps } = useVideoConfig();
  const copy = getCopy(data);
  const pop = spring({ frame: Math.max(0, localFrame), fps, config: { stiffness: 165, damping: 17 } });
  const verdict = data.actionableVerdict || {};
  const title = verdict.title || verdict.recommendation || verdict.pickAdvice || copy.verdictTitle;
  const body = verdict.body || verdict.reason || verdict.summary || verdict.oneLineVerdict || (isEnglishVideo(data) ? "Test the strength in normals before taking it ranked." : "先用一般對局測試強度，再決定是否投入排位。");
  const chips = Array.isArray(verdict.chips)
    ? verdict.chips
    : [
        verdict.timing,
        verdict.riskLevel,
        verdict.targetAudience,
        ...(Array.isArray(verdict.bestFor) ? verdict.bestFor : []),
      ].filter(Boolean);

  return (
    <DossierStage style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div
        style={{
          width: "86%",
          padding: "34px 40px",
          borderRadius: 8,
          border: `1.5px solid ${GOLD}aa`,
          background: "linear-gradient(180deg, rgba(9,18,32,0.94), rgba(3,8,16,0.9))",
          boxShadow: `0 22px 48px rgba(0,0,0,0.5), 0 0 34px ${label.shadow}, inset 0 1px 0 rgba(240,230,210,0.14)`,
          textAlign: "center",
          transform: `translateY(${interpolate(pop, [0, 1], [44, 0])}px) scale(${interpolate(pop, [0, 1], [0.94, 1])})`,
          opacity: pop,
        }}
      >
        <div style={{ color: GOLD, fontSize: 28, fontWeight: 950, letterSpacing: 5 }}>{title}</div>
        <div style={{ color: "#fff", fontSize: 47, fontWeight: 950, lineHeight: 1.18, marginTop: 18, textWrap: "balance" }}>{body}</div>
        {chips.length > 0 ? (
          <div style={{ marginTop: 24, display: "flex", justifyContent: "center", gap: 12, flexWrap: "wrap" }}>
            {chips.slice(0, 4).map((chip) => (
              <span
                key={chip}
                style={{
                  color: INK,
                  background: `linear-gradient(90deg, ${GOLD}, #f4d58d)`,
                  borderRadius: 999,
                  padding: "8px 15px",
                  fontSize: 20,
                  fontWeight: 950,
                  whiteSpace: "nowrap",
                }}
              >
                {chip}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </DossierStage>
  );
};

export const Template_BalanceUpdate = ({ data = {} }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const changeType = getChangeType(data);
  const label = getBalanceLabel(changeType, data);
  const storyboard = buildPatchStoryboard(data);
  const timeline = buildTimeline(storyboard, fps, 0);
  const active = getActiveTimelineScene(timeline, frame);
  const tag = active.scene?.tag || "HOOK";

  const renderScene = () => {
    if (tag === "SKILL_SHOWCASE" || tag === "STAT_REVEAL" || tag === "MECHANIC_EXPLAINER") {
      return <SkillDossierScene data={data} scene={active.scene} label={label} storyboard={storyboard} activeIndex={active.index} localFrame={active.localFrame} />;
    }
    if (tag === "COMMUNITY_BUZZ") {
      return <CommunityScene data={data} localFrame={active.localFrame} sceneStart={active.start} />;
    }
    if (tag === "IMPACT_BREAKDOWN") {
      return <ImpactBreakdownScene data={data} scene={active.scene} label={label} localFrame={active.localFrame} />;
    }
    if (tag === "CONCLUSION_CTA" || tag === "OUTRO" || tag === "VERDICT") {
      return <VerdictScene data={data} label={label} localFrame={active.localFrame} />;
    }
    return <HookScene data={data} label={label} storyboard={storyboard} localFrame={active.localFrame} />;
  };

  return (
    <AbsoluteFill style={{ backgroundColor: "#05080d", color: "#fff", fontFamily: "'Outfit', 'Noto Sans TC', sans-serif", overflow: "hidden" }}>
      <BgmLayer bgmFile={data.bgmFile} />
      <HextechBackground splashUrl={getSplash(data)} dimmed={tag === "COMMUNITY_BUZZ"} tactical />
      <DossierAtmosphere label={label} />
      <DossierChrome label={label} data={data} />
      {renderScene()}
      <SubtitleCaption scene={active.scene} activeStart={active.start} accent={GOLD} bottom={224} variant="lowerThird" />
    </AbsoluteFill>
  );
};
