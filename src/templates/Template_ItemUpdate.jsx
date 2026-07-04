import React from "react";
import {
  AbsoluteFill,
  Audio,
  Img,
  Sequence,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from "remotion";
import { calculatePacing } from "../Composition";
import { DEFAULT_BGM_VOLUME } from "../constants";
import { SubtitleCaption } from "../video-system/SubtitleCaption";
import { resolveRenderAssetSrc } from "../video-system/renderAssetSrc";
import { safeDisplayList, safeDisplayText } from "../video-system/textSafety";

const DDRAGON = "https://ddragon.leagueoflegends.com";

const EMPTY_TARGET = {
  id: "missing-item-rune-data",
  dataType: "ITEM_UPDATE",
  targetType: "ITEM",
  targetName: "",
  localizedName: "缺少裝備/符文資料",
  iconUrl: "",
  changeType: "ADJUST",
  statChanges: [],
  synergyImpact: null,
  storyboard: [
    { text: "缺少裝備符文資料\n請重新掃描版本", tag: "HOOK", durationInFrames: 110 },
    { text: "沒有 live data 時\n不再塞假案例", tag: "CONCLUSION_CTA", durationInFrames: 110 },
  ],
};

const tagMap = {
  BUFF: { text: "BUFF", color: "#10b981", bg: "rgba(16,185,129,0.16)" },
  NERF: { text: "NERF", color: "#ef4444", bg: "rgba(239,68,68,0.16)" },
  ADJUST: { text: "ADJUST", color: "#f59e0b", bg: "rgba(245,158,11,0.16)" },
  REWORK: { text: "REWORK", color: "#06b6d4", bg: "rgba(6,182,212,0.16)" },
};

const tagMapZh = {
  BUFF: { text: "增強", color: "#10b981", bg: "rgba(16,185,129,0.16)" },
  NERF: { text: "削弱", color: "#ef4444", bg: "rgba(239,68,68,0.16)" },
  ADJUST: { text: "調整", color: "#f59e0b", bg: "rgba(245,158,11,0.16)" },
  REWORK: { text: "重製", color: "#06b6d4", bg: "rgba(6,182,212,0.16)" },
};

const ITEM_LABEL_MAP_ZH = {
  BUFF: { text: "裝備增強", color: "#10b981", shadow: "rgba(16,185,129,0.72)" },
  NERF: { text: "裝備削弱", color: "#ef4444", shadow: "rgba(239,68,68,0.72)" },
  ADJUST: { text: "裝備調整", color: "#f59e0b", shadow: "rgba(245,158,11,0.72)" },
  REWORK: { text: "裝備重製", color: "#06b6d4", shadow: "rgba(6,182,212,0.72)" },
};

const RUNE_LABEL_MAP_ZH = {
  BUFF: { text: "符文增強", color: "#10b981", shadow: "rgba(16,185,129,0.72)" },
  NERF: { text: "符文削弱", color: "#ef4444", shadow: "rgba(239,68,68,0.72)" },
  ADJUST: { text: "符文調整", color: "#f59e0b", shadow: "rgba(245,158,11,0.72)" },
  REWORK: { text: "符文重製", color: "#06b6d4", shadow: "rgba(6,182,212,0.72)" },
};

const ITEM_LABEL_MAP_EN = {
  BUFF: { text: "Item Buff", color: "#10b981", shadow: "rgba(16,185,129,0.72)" },
  NERF: { text: "Item Nerf", color: "#ef4444", shadow: "rgba(239,68,68,0.72)" },
  ADJUST: { text: "Item Adjusted", color: "#f59e0b", shadow: "rgba(245,158,11,0.72)" },
  REWORK: { text: "Item Rework", color: "#06b6d4", shadow: "rgba(6,182,212,0.72)" },
};

const RUNE_LABEL_MAP_EN = {
  BUFF: { text: "Rune Buff", color: "#10b981", shadow: "rgba(16,185,129,0.72)" },
  NERF: { text: "Rune Nerf", color: "#ef4444", shadow: "rgba(239,68,68,0.72)" },
  ADJUST: { text: "Rune Adjusted", color: "#f59e0b", shadow: "rgba(245,158,11,0.72)" },
  REWORK: { text: "Rune Rework", color: "#06b6d4", shadow: "rgba(6,182,212,0.72)" },
};

const isEnglishVideo = (data = {}) => String(data.locale || data.outputLanguage || "zh").toLowerCase().startsWith("en");

const getCopy = (data = {}) => {
  const en = isEnglishVideo(data);
  return en ? {
    missingName: "Missing item/rune data",
    fallbackTarget: data.targetType === "RUNE" ? "Rune Update" : "Item Update",
    focusLabel: data.targetType === "RUNE" ? "RUNE UPDATE FOCUS" : "ITEM UPDATE FOCUS",
    itemCheck: data.targetType === "RUNE" ? "RUNE CHECK" : "ITEM CHECK",
    coreStat: "Core Stat",
    textChange: "Text Change",
    noNumeric: "No reliable before/after value was provided.",
    practicalRead: "GAMEPLAY READ",
    practicalHeadline: "This change is about timing",
    impactedTitle: "IMPACTED CHAMPIONS",
    impactedQuestion: "What changes for these champions?",
    noImpactTitle: "Waiting for live meta impact",
    noImpactBody: "No affected champions were provided, so the video will not fake picks.",
    verdictTitle: "Gameplay Verdict",
    verdictBody: "Build it earlier when the stat directly improves your lane plan.",
    firstLine: "Check first-item timing and early lane pressure.",
    mixedLine: "Mixed changes depend heavily on champion identity and build order.",
    conclusionFallback: "Build earlier when it improves your first-item spike.",
  } : {
    missingName: "缺少裝備/符文資料",
    fallbackTarget: data.targetType === "RUNE" ? "符文改動" : "裝備改動",
    focusLabel: data.targetType === "RUNE" ? "符文改動焦點" : "裝備改動焦點",
    itemCheck: data.targetType === "RUNE" ? "符文檢查" : "裝備檢查",
    coreStat: "核心數值",
    textChange: "文字改動",
    noNumeric: "此項目沒有可拆解的 before/after 數值。",
    practicalRead: "實戰判讀",
    practicalHeadline: "這波改動真正影響的是節奏",
    impactedTitle: "連帶影響英雄",
    impactedQuestion: "這波會怎麼影響英雄？",
    noImpactTitle: "等待 live meta 影響資料",
    noImpactBody: "掃描資料沒有提供受影響英雄時，影片不會用假英雄補畫面。",
    verdictTitle: "實戰結論",
    verdictBody: data.targetType === "RUNE" ? "符文收益提高，適合優先檢查對線節奏。" : "首件收益提高，適合檢查成裝節奏。",
    firstLine: "先看首件成裝與前期對線能不能提早打出壓力。",
    mixedLine: data.targetType === "RUNE" ? "如果數值是混合調整，實戰會更吃英雄特性與符文配置。" : "如果數值是混合調整，實戰會更吃英雄特性與出裝順序。",
    conclusionFallback: data.targetType === "RUNE" ? "符文收益提高，適合優先檢查對線節奏。" : "首件收益提高，適合檢查成裝節奏。",
  };
};

const getItemRuneLabel = (target = {}) => {
  const en = isEnglishVideo(target);
  const isRune = target.targetType === "RUNE";
  const map = en
    ? (isRune ? RUNE_LABEL_MAP_EN : ITEM_LABEL_MAP_EN)
    : (isRune ? RUNE_LABEL_MAP_ZH : ITEM_LABEL_MAP_ZH);
  return map[target.changeType] || map.ADJUST;
};

const statNameMap = {
  "ad": "攻擊力",
  "attack damage": "攻擊力",
  "bonus attack damage": "額外攻擊力",
  "ap": "魔法攻擊",
  "ability power": "魔法攻擊",
  "attack speed": "攻擊速度",
  "as": "攻擊速度",
  "total cost": "總價格",
  "combine cost": "合成價格",
  "cost": "價格",
  "health": "生命值",
  "hp": "生命值",
  "armor": "物理防禦",
  "magic resist": "魔法防禦",
  "mr": "魔法防禦",
  "movement speed": "跑速",
  "move speed": "跑速",
  "melee move speed": "跑速（近戰）",
  "ranged move speed": "跑速（遠程）",
  "move spee": "跑速",
  "move speed ratio": "跑速",
  "move speed per": "跑速",
  "movement speed ratio": "跑速",
  "movement speed per": "跑速",
  "ms": "跑速",
  "crit chance": "暴擊率",
  "critical strike chance": "暴擊率",
  "lifesteal": "普攻吸血",
  "life steal": "普攻吸血",
  "omnivamp": "全能吸血",
  "omnivamp per stack": "每層全能吸血",
  "slay omnivamp": "全能吸血",
  "slay omnivamp per stack": "每層全能吸血",
  "max stacks": "最大層數",
  "slay max stacks": "最大層數",
  "trigger damage": "觸發傷害",
  "on-hit damage": "命中特效傷害",
  "damage per": "每段傷害",
  "minimum damage": "最低傷害",
  "maximum damage": "最高傷害",
  "min damage": "最低傷害",
  "max damage": "最高傷害",
  "damage": "傷害",
  "cooldown": "冷卻時間",
  "ability haste": "技能加速",
  "frostfire tempest": "霜火風暴",
  "blue bubble damage reduction": "藍泡泡減傷",
  "purple bubble damage": "紫泡泡傷害",
  "heal": "治療量",
  "shield": "護盾值",
  "duration": "持續時間",
  "持續": "持續時間",
  "持續時間": "持續時間",
};

const statNameEnMap = {
  "攻擊力": "Attack Damage",
  "額外攻擊力": "Bonus AD",
  "魔法攻擊": "Ability Power",
  "攻擊速度": "Attack Speed",
  "總價格": "Total Cost",
  "合成價格": "Combine Cost",
  "價格": "Cost",
  "生命值": "Health",
  "物理防禦": "Armor",
  "魔法防禦": "Magic Resist",
  "跑速": "Move Speed",
  "跑速（近戰）": "Melee Move Speed",
  "跑速（遠程）": "Ranged Move Speed",
  "持續時間": "Duration",
  "暴擊率": "Crit Chance",
  "普攻吸血": "Life Steal",
  "全能吸血": "Omnivamp",
  "每層全能吸血": "Omnivamp Per Stack",
  "最大層數": "Max Stacks",
  "觸發傷害": "Trigger Damage",
  "命中特效傷害": "On-hit Damage",
  "每段傷害": "Damage Per Hit",
  "最低傷害": "Minimum Damage",
  "最高傷害": "Maximum Damage",
  "傷害": "Damage",
  "冷卻時間": "Cooldown",
  "技能加速": "Ability Haste",
  "霜火風暴": "Frostfire Tempest",
  "治療量": "Heal",
  "護盾值": "Shield",
  "核心數值": "Core Stat",
};

const targetNameMap = {
  "kraken slayer": "海妖殺手",
  "doran's bow": "多蘭之弓",
  "dorans bow": "多蘭之弓",
  "axiom arc": "公理弧刃",
  "conqueror": "征服者",
  "hail of blades": "叢刃",
  "deathfire touch": "冥火之觸",
  "gluttonous greaves": "貪食脛甲",
  "immortal path": "不朽之路",
};

const targetNameEnMap = {
  "多蘭之弓": "Doran's Bow",
  "多蘭之刃": "Doran's Blade",
  "多蘭之盾": "Doran's Shield",
  "多蘭之戒": "Doran's Ring",
  "海妖殺手": "Kraken Slayer",
  "公理弧刃": "Axiom Arc",
  "征服者": "Conqueror",
  "冥火之觸": "Deathfire Touch",
  "貪食脛甲": "Gluttonous Greaves",
  "不朽之路": "Immortal Path",
};

const championNameMap = {
  Aatrox: "厄薩斯",
  Ahri: "阿璃",
  Akali: "阿卡莉",
  Akshan: "埃可尚",
  Alistar: "亞歷斯塔",
  Amumu: "阿姆姆",
  Anivia: "艾妮維亞",
  Annie: "安妮",
  Aphelios: "亞菲利歐",
  Ashe: "艾希",
  AurelionSol: "翱銳龍獸",
  "Aurelion Sol": "翱銳龍獸",
  Azir: "阿祈爾",
  Bard: "巴德",
  Blitzcrank: "布里茨",
  Brand: "布蘭德",
  Braum: "布郎姆",
  Caitlyn: "凱特琳",
  Camille: "卡蜜兒",
  Cassiopeia: "卡莎碧雅",
  Chogath: "科加斯",
  "Cho'Gath": "科加斯",
  Corki: "庫奇",
  Darius: "達瑞斯",
  Diana: "黛安娜",
  Draven: "達瑞文",
  Ekko: "艾克",
  Elise: "伊莉絲",
  Evelynn: "伊芙琳",
  Ezreal: "伊澤瑞爾",
  Fiddlesticks: "費德提克",
  Fiora: "菲歐拉",
  Fizz: "飛斯",
  Galio: "加里歐",
  Gangplank: "剛普朗克",
  Garen: "蓋倫",
  Gnar: "吶兒",
  Gragas: "古拉格斯",
  Graves: "葛雷夫",
  Gwen: "關",
  Hecarim: "赫克林",
  Heimerdinger: "漢默丁格",
  Hwei: "彗",
  Irelia: "伊瑞莉雅",
  Illaoi: "伊羅旖",
  Ivern: "埃爾文",
  Janna: "珍娜",
  JarvanIV: "嘉文四世",
  "Jarvan IV": "嘉文四世",
  Jax: "賈克斯",
  Jayce: "杰西",
  Jhin: "燼",
  Jinx: "吉茵珂絲",
  Kaisa: "凱莎",
  "Kai'Sa": "凱莎",
  Kalista: "克黎思妲",
  Karma: "卡瑪",
  Karthus: "卡爾瑟斯",
  Kassadin: "卡薩丁",
  Katarina: "卡特蓮娜",
  Kayle: "凱爾",
  Kayn: "慨影",
  Kennen: "凱能",
  Khazix: "卡力斯",
  "Kha'Zix": "卡力斯",
  Kindred: "鏡爪",
  Kled: "克雷德",
  KogMaw: "寇格魔",
  "Kog'Maw": "寇格魔",
  KSante: "卡桑帝",
  "K'Sante": "卡桑帝",
  Leblanc: "勒布朗",
  LeBlanc: "勒布朗",
  LeeSin: "李星",
  "Lee Sin": "李星",
  Leona: "雷歐娜",
  Lillia: "莉莉亞",
  Lissandra: "麗珊卓",
  Lucian: "路西恩",
  Lulu: "露璐",
  Lux: "拉克絲",
  Malphite: "墨菲特",
  Malzahar: "馬爾札哈",
  Maokai: "茂凱",
  Milio: "米里歐",
  MissFortune: "好運姐",
  "Miss Fortune": "好運姐",
  Mordekaiser: "魔鬥凱薩",
  Morgana: "魔甘娜",
  Naafiri: "納菲芮",
  Nami: "娜米",
  Nasus: "納瑟斯",
  Nautilus: "納帝魯斯",
  Neeko: "妮可",
  Nidalee: "奈德麗",
  Nilah: "淣菈",
  Nocturne: "夜曲",
  Nunu: "努努和威朗普",
  "Nunu & Willump": "努努和威朗普",
  Olaf: "歐拉夫",
  Orianna: "奧莉安娜",
  Ornn: "鄂爾",
  Pantheon: "潘森",
  Poppy: "波比",
  Pyke: "派克",
  Qiyana: "姬亞娜",
  Quinn: "葵恩",
  Rakan: "銳空",
  Rammus: "拉姆斯",
  RekSai: "雷珂煞",
  "Rek'Sai": "雷珂煞",
  Rell: "銳兒",
  Renata: "睿娜妲",
  "Renata Glasc": "睿娜妲",
  Renekton: "雷尼克頓",
  Rengar: "雷葛爾",
  Riven: "雷玟",
  Rumble: "藍寶",
  Ryze: "雷茲",
  Samira: "煞蜜拉",
  Sejuani: "史瓦妮",
  Senna: "姍娜",
  Seraphine: "瑟菈紛",
  Sett: "賽特",
  Shaco: "薩科",
  Shen: "慎",
  Shyvana: "希瓦娜",
  Singed: "辛吉德",
  Sion: "賽恩",
  Sivir: "希維爾",
  Skarner: "史加納",
  Smolder: "史矛德",
  Sona: "索娜",
  Soraka: "索拉卡",
  Swain: "斯溫",
  Sylas: "賽勒斯",
  Syndra: "星朵拉",
  TahmKench: "貪啃奇",
  "Tahm Kench": "貪啃奇",
  Taliyah: "塔莉雅",
  Talon: "塔隆",
  Taric: "塔里克",
  Teemo: "提摩",
  Thresh: "瑟雷西",
  Tristana: "崔絲塔娜",
  Trundle: "特朗德",
  Tryndamere: "泰達米爾",
  TwistedFate: "逆命",
  "Twisted Fate": "逆命",
  Twitch: "圖奇",
  Udyr: "烏迪爾",
  Urgot: "烏爾加特",
  Varus: "法洛士",
  Vayne: "汎",
  Veigar: "維迦",
  Velkoz: "威寇茲",
  "Vel'Koz": "威寇茲",
  Vex: "薇可絲",
  Vi: "菲艾",
  Viego: "維爾戈",
  Viktor: "維克特",
  Vladimir: "弗拉迪米爾",
  Volibear: "弗力貝爾",
  Warwick: "沃維克",
  Xayah: "剎雅",
  Xerath: "齊勒斯",
  XinZhao: "趙信",
  "Xin Zhao": "趙信",
  Yasuo: "犽宿",
  Yone: "犽凝",
  Yorick: "約瑞科",
  Yunara: "尤娜拉",
  Yuumi: "悠咪",
  Zac: "札克",
  Zed: "劫",
  Zeri: "婕莉",
  Ziggs: "希格斯",
  Zilean: "極靈",
  Zoe: "柔依",
  Zyra: "枷蘿",
  "Master Yi": "易大師",
  MasterYi: "易大師",
  Belveth: "貝爾薇斯",
  "Bel'Veth": "貝爾薇斯",
};

const championIdMap = {
  "Nunu & Willump": "Nunu",
  Wukong: "MonkeyKing",
  "Renata Glasc": "Renata",
  "Bel'Veth": "Belveth",
  Belveth: "Belveth",
  "K'Sante": "KSante",
  "Kai'Sa": "Kaisa",
  Kaisa: "Kaisa",
  "Kha'Zix": "Khazix",
  Khazix: "Khazix",
  LeBlanc: "Leblanc",
  "Vel'Koz": "Velkoz",
  "Cho'Gath": "Chogath",
  "Kog'Maw": "KogMaw",
  "Rek'Sai": "RekSai",
  "Master Yi": "MasterYi",
};

const getChampionIconUrl = (championName) => {
  if (!championName) return "";
  const id = championIdMap[championName] || championName.replace(/[\s'.]/g, "");
  return `${DDRAGON}/cdn/16.9.1/img/champion/${id}.png`;
};

const normalizeLookupKey = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/['’`]/g, "")
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, " ")
    .trim();

const inferStatNameFromFragments = (raw, english = false) => {
  const key = normalizeLookupKey(raw);
  const rules = [
    { test: /melee.*move.*speed|move.*speed.*melee|近戰.*跑速|跑速.*近戰/, zh: "跑速（近戰）", en: "Melee Move Speed" },
    { test: /ranged.*move.*speed|move.*speed.*ranged|遠程.*跑速|跑速.*遠程/, zh: "跑速（遠程）", en: "Ranged Move Speed" },
    { test: /duration|持續時間|持續/, zh: "持續時間", en: "Duration" },
    { test: /total.*cost|cost/, zh: "總價格", en: "Total Cost" },
    { test: /combine.*cost/, zh: "合成價格", en: "Combine Cost" },
    { test: /slay.*omnivamp.*stack|omnivamp.*per.*stack/, zh: "每層全能吸血", en: "Omnivamp Per Stack" },
    { test: /slay.*omnivamp|omnivamp/, zh: "全能吸血", en: "Omnivamp" },
    { test: /max.*stack|stack.*cap/, zh: "最大層數", en: "Max Stacks" },
    { test: /move\s*spee|movement\s*spee|move.*speed|movement.*speed/, zh: "跑速", en: "Move Speed" },
    { test: /attack.*speed|\bas\b/, zh: "攻擊速度", en: "Attack Speed" },
    { test: /attack.*damage|\bad\b/, zh: "攻擊力", en: "Attack Damage" },
    { test: /ability.*power|\bap\b/, zh: "魔法攻擊", en: "Ability Power" },
    { test: /crit|critical/, zh: "暴擊率", en: "Crit Chance" },
    { test: /minimum.*damage|min.*damage|最低.*傷害/, zh: "最低傷害", en: "Minimum Damage" },
    { test: /maximum.*damage|max.*damage|最高.*傷害/, zh: "最高傷害", en: "Maximum Damage" },
    { test: /damage.*per|per.*damage/, zh: "每段傷害", en: "Damage Per Hit" },
    { test: /on.*hit|trigger/, zh: "觸發傷害", en: "Trigger Damage" },
    { test: /ability.*haste|haste/, zh: "技能加速", en: "Ability Haste" },
  ];
  const matched = rules.find((rule) => rule.test.test(key));
  return matched ? (english ? matched.en : matched.zh) : "";
};

const hasPercentValue = (value) => /%/.test(String(value ?? ""));

const isMoveSpeedMetricText = (value) =>
  /跑速|move\s*spee|movement\s*spee|move.*speed|movement.*speed/i.test(String(value || ""));

const isDamageRangeMetricText = (value) =>
  /每段傷害|damage\s*per|damage\s*per\s*hit|per\s*hit|傷害/i.test(String(value || "")) &&
  /(?:\d+(?:\.\d+)?%?\s*[-~]\s*\d+(?:\.\d+)?%?)|(?:over\s+\d)|(?:持續\s*\d)|(?:\d+\s*秒)/i.test(String(value || ""));

const hasLatinWord = (value = "") => /[A-Za-z]{3,}/.test(String(value || ""));

const ZEKES_IMPACT_CHAMPIONS = ["Leona", "Nautilus", "Rell"];

const getTargetSearchText = (target = {}) => [
  target.targetName,
  target.localizedName,
  target.itemName,
  target.runeName,
  target.changeDesc,
  ...(Array.isArray(target.statChanges)
    ? target.statChanges.flatMap((stat) => [
      stat.metricName,
      stat.beforeValue,
      stat.afterValue,
      stat.summary,
      stat.officialText,
    ])
    : []),
].filter(Boolean).join(" ").toLowerCase();

const isZekesConvergenceTarget = (target = {}) => /zeke|錫柯|frostfire|霜火/.test(getTargetSearchText(target));

const localizeKnownZhPhrase = (value = "") => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const normalized = raw
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/\s+/g, " ");

  const exactMap = {
    "frostfire tempest": "霜火風暴",
    "triggers on ult cast": "大絕施放觸發",
    "readies on ult cast for the next 5 seconds, triggering the moment an enemy champion gets within the range or after 5 seconds": "大絕後預備5秒",
    "damage triggers on hit, or on certain abilities / items": "命中或特定技能觸發",
    "damage triggers on next damaging attack or ability, reduced for aoe effects (i.e. nami e)": "下次攻擊或技能觸發",
    "damage reduction affects the next non-0 instance of damage, regardless of how large it is": "減免下一次非零傷害",
    "damage reduction affects the next non-0 damage cast source (temporal carry-over)": "減免下一段傷害來源",
  };
  if (exactMap[normalized]) return exactMap[normalized];
  if (/frostfire\s+tempest/.test(normalized)) return "霜火風暴";
  if (/readies.*ult.*5\s*seconds|ult.*readies.*5\s*seconds/.test(normalized)) return "大絕後預備5秒";
  if (/triggers.*ult.*cast|ult.*cast.*triggers/.test(normalized)) return "大絕施放觸發";
  if (/damage\s+triggers.*next.*attack.*ability/.test(normalized)) return "下次攻擊或技能觸發";
  if (/damage\s+triggers.*hit|on-hit/.test(normalized)) return "命中時觸發";
  if (/damage\s+reduction.*cast\s+source/.test(normalized)) return "減免整段傷害來源";
  if (/damage\s+reduction/.test(normalized)) return "減免下一次傷害";
  return "";
};

const refineMetricNameWithContext = (metricName, stat = {}, index = 0, allStats = [], data = {}) => {
  const en = isEnglishVideo(data);
  const text = `${stat.metricName || ""} ${stat.summary || ""} ${stat.officialText || ""}`;
  const localized = localizeStatName(metricName, data);
  const speedLike = isMoveSpeedMetricText(text) || isMoveSpeedMetricText(localized);
  const speedStatCount = allStats.filter((item) => isMoveSpeedMetricText(`${item.metricName || ""} ${item.summary || ""} ${item.officialText || ""}`)).length;
  const hasDurationSibling = allStats.some((item, itemIndex) =>
    itemIndex >= 2 &&
    isMoveSpeedMetricText(`${item.metricName || ""} ${item.summary || ""} ${item.officialText || ""}`) &&
    !hasPercentValue(item.beforeValue) &&
    !hasPercentValue(item.afterValue));
  const officialGroupedSpeed =
    /近戰|遠程|持續|melee|ranged|duration/i.test(text) &&
    (speedLike || speedStatCount >= 2) ||
    (speedStatCount >= 3 && hasDurationSibling);

  if (officialGroupedSpeed) {
    if (/近戰|melee/i.test(text) && index === 0) return en ? "Melee Move Speed" : "跑速（近戰）";
    if (/遠程|ranged/i.test(text) && index === 1) return en ? "Ranged Move Speed" : "跑速（遠程）";
    if ((/持續|duration/i.test(text) && index >= 2) || (!hasPercentValue(stat.beforeValue) && !hasPercentValue(stat.afterValue) && index >= 2)) {
      return en ? "Duration" : "持續時間";
    }
    if (speedStatCount >= 3) {
      if (index === 0) return en ? "Melee Move Speed" : "跑速（近戰）";
      if (index === 1) return en ? "Ranged Move Speed" : "跑速（遠程）";
      if (index === 2) return en ? "Duration" : "持續時間";
    }
  }

  if (isDamageRangeMetricText(text) && (localized === "每段傷害" || localized === "Damage Per Hit" || localized === "傷害" || localized === "Damage")) {
    if (index === 0) return en ? "Minimum Damage" : "最低傷害";
    if (index === 1) return en ? "Maximum Damage" : "最高傷害";
  }

  return localized;
};

const localizeStatName = (metricName, data = {}) => {
  const raw = String(metricName || "").trim();
  if (isEnglishVideo(data)) {
    const direct = statNameEnMap[raw] || raw;
    const key = normalizeLookupKey(direct);
    const fromZh = statNameEnMap[statNameMap[key]];
    return safeDisplayText(fromZh || statNameMap[key] && statNameEnMap[statNameMap[key]] || inferStatNameFromFragments(direct, true) || direct, "Core Stat", { maxChars: 18 });
  }
  const key = normalizeLookupKey(raw);
  return safeDisplayText(
    statNameMap[key] || inferStatNameFromFragments(raw, false) || localizeKnownZhPhrase(raw) || (hasLatinWord(raw) ? "核心機制" : raw),
    "核心數值",
    { maxChars: 12 },
  );
};

const localizeStatSummary = (summary, stat = {}, data = {}) => {
  const raw = String(summary || "").trim();
  if (!raw) return "";
  if (isEnglishVideo(data)) return safeDisplayText(raw, "", { maxChars: 58 });

  const metric = localizeStatName(stat.metricName, data);
  const trend = stat.trend;
  const isBuff = trend === "BUFF";
  const isNerf = trend === "NERF";

  if (metric === "跑速（近戰）") {
    return isNerf ? "近戰觸發跑速降低" : isBuff ? "近戰觸發跑速提高" : "近戰跑速重新校準";
  }
  if (metric === "跑速（遠程）") {
    return isNerf ? "遠程觸發跑速降低" : isBuff ? "遠程觸發跑速提高" : "遠程跑速重新校準";
  }
  if (metric === "持續時間") {
    return isNerf ? "加速持續時間縮短" : isBuff ? "加速持續時間延長" : "持續時間重新校準";
  }
  if (metric === "最低傷害") {
    return isNerf ? "低端傷害下修，前期壓力下降" : isBuff ? "低端傷害上修，前期壓力提高" : "低端傷害重新校準";
  }
  if (metric === "最高傷害") {
    return isNerf ? "高端傷害下修，後段威脅下降" : isBuff ? "高端傷害上修，後段威脅提高" : "高端傷害重新校準";
  }
  if (metric === "霜火風暴" || /frostfire|ult cast|readies/i.test(raw)) {
    return "大絕施放後先預備，進入範圍再觸發";
  }
  if (/damage reduction|blue bubble/i.test(raw)) {
    return "減傷改看整段傷害來源，容錯要重估";
  }
  if (/damage triggers|purple bubble|on-hit/i.test(raw)) {
    return "觸發條件改成攻擊或技能，爆發窗口要重看";
  }

  if (!/[A-Za-z]{3,}/.test(raw)) return safeDisplayText(raw, "", { maxChars: 32 });

  if (metric === "總價格" || metric === "合成價格" || metric === "價格") {
    return isNerf ? "購買成本提高，成裝時間被延後" : isBuff ? "購買成本降低，成裝時間更早" : "價格調整，出裝節奏要重算";
  }
  if (metric === "每層全能吸血" || metric === "全能吸血" || metric === "普攻吸血") {
    return isNerf ? "吸血收益降低，續戰容錯下降" : isBuff ? "吸血收益提高，長戰更有利" : "續戰收益重新分配";
  }
  if (metric === "最大層數") {
    return isNerf ? "疊層上限降低，後段收益下降" : isBuff ? "疊層上限提高，長戰收益增加" : "疊層曲線重新校準";
  }
  if (metric === "攻擊速度") {
    return isNerf ? "攻速下修，普攻節奏變慢" : isBuff ? "攻速上修，普攻手感更順" : "攻速曲線被重調";
  }
  if (metric === "攻擊力") {
    return isNerf ? "攻擊力下修，前期換血變弱" : isBuff ? "攻擊力上修，前期壓力提高" : "攻擊力配置重新調整";
  }
  if (metric === "跑速") {
    return isNerf ? "跑速下修，支援與拉扯變慢" : isBuff ? "跑速上修，跑圖與拉扯更快" : "跑速曲線重新校準";
  }
  if (metric === "傷害" || metric === "每段傷害" || metric === "觸發傷害" || metric === "命中特效傷害") {
    return isNerf ? "核心傷害下修，換血窗口要重估" : isBuff ? "核心傷害上修，換血窗口更主動" : "傷害曲線重新校準";
  }

  return isNerf ? "核心收益下修，實戰強度要重估" : isBuff ? "核心收益上修，優先級有機會提高" : "數值重新校準，出裝判斷要重看";
};

const normalizeStatValue = (value) => {
  const text = safeDisplayText(value ?? "", "—", { maxChars: 10 });
  return text.replace(/^(-?)\.(\d)/, "$10.$2");
};

const isUnchangedStatChange = (stat = {}) => {
  const before = normalizeStatValue(stat.beforeValue);
  const after = normalizeStatValue(stat.afterValue);
  if (!before || !after || before === "—" || after === "—") return false;
  if (before === after) return true;
  const beforeNum = Number(String(before).replace(/[^\d.-]/g, ""));
  const afterNum = Number(String(after).replace(/[^\d.-]/g, ""));
  return Number.isFinite(beforeNum) && Number.isFinite(afterNum) && beforeNum === afterNum;
};

const normalizeStatDisplayValue = (value, metricName, data = {}) => {
  const raw = String(value ?? "").trim();
  if (!isEnglishVideo(data) && hasLatinWord(raw)) {
    const localized = localizeKnownZhPhrase(raw);
    if (localized) return safeDisplayText(localized, "機制調整", { maxChars: 10 });
    return /after|new|read|next|within|range/i.test(raw) ? "新機制" : "舊機制";
  }
  const normalized = normalizeStatValue(value);
  if (normalized === "—") return normalized;
  const metric = localizeStatName(metricName, data);
  if ((metric === "持續時間" || metric === "Duration") && /^-?\d+(?:\.\d+)?$/.test(normalized)) {
    return isEnglishVideo(data) ? `${normalized}s` : `${normalized}秒`;
  }
  return normalized;
};

const hasStatSignal = (stats, pattern) =>
  stats.some((stat) => pattern.test(`${stat.metricName || ""} ${stat.summary || ""}`.toLowerCase()));

const isRuneTarget = (data = {}) => data.targetType === "RUNE";

const buildTempoNoun = (data = {}) => (isRuneTarget(data) ? "符文配置" : "出裝順序");
const buildFirstTimingNoun = (data = {}) => (isRuneTarget(data) ? "符文配置" : "首件成裝");

const getMetricGameplayFocus = (metricName, stat = {}, data = {}) => {
  const metric = localizeStatName(metricName, data);
  const en = isEnglishVideo(data);
  const text = `${metric} ${stat.summary || ""}`.toLowerCase();

  if (en) {
    if (/move speed|movement/.test(text)) return "Check rotations and engage spacing";
    if (/cost|price|gold/.test(text)) return "Check the timing window";
    if (isZekesConvergenceTarget(data)) return "Check ult-to-engage timing";
    if (/cooldown|haste/.test(text)) return "Check uptime and trading windows";
    if (/damage|trigger|on-hit|crit|attack damage|ability power/.test(text)) return "Check burst and trade windows";
    return isRuneTarget(data) ? "Check rune setup priority" : "Check build priority";
  }

  if (/跑速|move speed|movement/.test(text)) return "先看跑圖與拉扯距離";
  if (/價格|總價格|合成價格|cost|gold/.test(text)) return "先看成形時間怎麼變";
  if (isZekesConvergenceTarget(data)) return "先看大絕後進場時機";
  if (/冷卻|技能加速|cooldown|haste/.test(text)) return "先看觸發頻率怎麼變";
  if (/傷害|每段傷害|觸發傷害|命中特效|暴擊|攻擊力|魔法攻擊|damage|trigger|on-hit|crit|attack damage|ability power/.test(text)) {
    return "先看換血窗口怎麼變";
  }
  return isRuneTarget(data) ? "先看符文配置怎麼變" : "先看出裝節奏怎麼變";
};

const deriveActionableVerdict = (data = {}, stats = []) => {
  const en = isEnglishVideo(data);
  const changeType = data.changeType || "ADJUST";
  const isRune = data.targetType === "RUNE";
  const costNerf = stats.some((stat) => stat.trend === "NERF" && hasStatSignal([stat], /總價格|合成價格|價格|cost/));
  const sustainNerf = stats.some((stat) => stat.trend === "NERF" && hasStatSignal([stat], /吸血|全能吸血|治療|護盾|omnivamp|life steal|heal|shield/));
  const stackBuff = stats.some((stat) => stat.trend === "BUFF" && hasStatSignal([stat], /層數|最大層數|stack/));
  const damageBuff = stats.some((stat) => stat.trend === "BUFF" && hasStatSignal([stat], /攻擊力|攻擊速度|傷害|暴擊|attack|damage|speed|crit/));
  const damageNerf = stats.some((stat) => stat.trend === "NERF" && hasStatSignal([stat], /攻擊力|攻擊速度|傷害|暴擊|attack|damage|speed|crit/));
  const speedBuff = stats.some((stat) => stat.trend === "BUFF" && hasStatSignal([stat], /跑速|move speed|movement speed/));
  const speedNerf = stats.some((stat) => stat.trend === "NERF" && hasStatSignal([stat], /跑速|move speed|movement speed/));

  if (isZekesConvergenceTarget(data)) {
    return en
      ? {
        title: "Gameplay Verdict",
        body: "This mainly helps engage supports that ult from range, then enter the fight before Frostfire triggers.",
        chips: ["Ranged ult", "Enter range", "Tank support"],
      }
      : {
        title: "實戰結論",
        body: "遠距離放大後再進場的坦輔最受益，不是後排輸出裝。",
        chips: ["遠距離放大", "進場觸發", "坦輔優先"],
      };
  }

  if (en) {
    if (costNerf && sustainNerf && stackBuff) {
      return {
        title: "Gameplay Verdict",
        body: "Do not rush it blindly: higher cost and lower sustain hurt early fights. Keep it only on champions that stack it fast.",
        chips: ["Delay first", "Fast stackers", "Check cheaper path"],
      };
    }
    if (costNerf) {
      return {
        title: "Gameplay Verdict",
        body: `The ${isRune ? "rune" : "item"} spike is slower now. Buy it after lane is stable, not as an auto-first choice.`,
        chips: ["Later spike", "Stable lane", "Gold check"],
      };
    }
    if (sustainNerf) {
      return {
        title: "Gameplay Verdict",
        body: "Sustain is weaker, so all-in lanes should be careful. Poke lanes can punish this build harder.",
        chips: ["Less sustain", "Respect poke", "Short trades"],
      };
    }
    if (speedBuff && !speedNerf) {
      return {
        title: "Gameplay Verdict",
        body: isRune
          ? "Mobility is stronger. Champions that roam, chase, or kite can prioritize this rune setup."
          : "Mobility is stronger. Champions that chase or kite can move this item up their build plan.",
        chips: isRune ? ["Roam faster", "Kite better", "Rune priority"] : ["Chase faster", "Kite better", "Build priority"],
      };
    }
    if (speedNerf && !speedBuff) {
      return {
        title: "Gameplay Verdict",
        body: isRune
          ? "Mobility is weaker. Reset this rune setup if your lane depends on spacing or roaming."
          : "Mobility is weaker. Delay this item if your build needs chase or escape speed.",
        chips: isRune ? ["Roam down", "Spacing check", "Rune reset"] : ["Chase down", "Spacing check", "Delay item"],
      };
    }
    if (damageBuff && !damageNerf) {
      return {
        title: "Gameplay Verdict",
        body: "Damage tempo is better. Test it early on champions that can force lane trades before first recall.",
        chips: ["Early trades", "First recall", "Snowball pick"],
      };
    }
    if (damageNerf && !damageBuff) {
      return {
        title: "Gameplay Verdict",
        body: "Burst is weaker. Delay the buy if your champion needs this slot to win the first all-in.",
        chips: ["Burst down", "Delay buy", "Alt damage"],
      };
    }
    if (changeType === "BUFF") {
      return {
        title: "Gameplay Verdict",
        body: `Test this ${isRune ? "rune setup" : "item"} earlier only when it improves your first real fight.`,
        chips: ["Test earlier", "First fight", "Lane value"],
      };
    }
    if (changeType === "NERF") {
      return {
        title: "Gameplay Verdict",
        body: `Delay this ${isRune ? "rune setup" : "item"} unless your champion still uses the changed stat better than alternatives.`,
        chips: ["Delay", "Compare alternatives", "Retest spike"],
      };
    }
    return {
      title: "Gameplay Verdict",
      body: "Treat it as matchup-dependent: keep it for champions that use the buffed stat, skip it when the nerfed stat is your win condition.",
      chips: ["Matchup pick", "Buffed stat", "Avoid autopilot"],
    };
  }

  if (costNerf && sustainNerf && stackBuff) {
    return {
      title: "實戰結論",
      body: "變貴又降吸血，別首出；只有快疊滿的英雄保留。",
      chips: ["延後首出", "快疊層才出", "找便宜替代"],
    };
  }
  if (costNerf) {
    return {
      title: "實戰結論",
      body: `${isRune ? "這套符文" : "這件裝備"}成形變慢，對線沒優勢就延後，不要自動首出。`,
      chips: ["延後首出", "先穩線", "看金錢差"],
    };
  }
  if (sustainNerf) {
    return {
      title: "實戰結論",
      body: "續戰容錯下降，怕消耗的對局要改短換血，或直接找替代裝。",
      chips: ["少打長戰", "怕消耗別出", "找替代"],
    };
  }
  if (speedBuff && !speedNerf) {
    return {
      title: "實戰結論",
      body: isRune
        ? "跑速收益變高，需要支援、追擊或拉扯的英雄可以優先嘗試這套符文。"
        : "跑速收益變高，需要追擊或拉扯的英雄可以把它列入候選。",
      chips: isRune ? ["支援更快", "拉扯更強", "優先嘗試"] : ["追擊更快", "拉扯更強", "列入候選"],
    };
  }
  if (speedNerf && !speedBuff) {
    return {
      title: "實戰結論",
      body: isRune
        ? "跑速收益變低，靠它支援或拉扯的英雄要重新比較替代符文。"
        : "跑速收益變低，靠它追擊或撤退的英雄要延後或換裝。",
      chips: isRune ? ["支援變慢", "拉扯變弱", "換符文"] : ["追擊變慢", "延後購買", "找替代"],
    };
  }
    if (damageBuff && !damageNerf) {
      return {
        title: "實戰結論",
        body: isRune
          ? "輸出節奏變好，能主動換血的英雄可以優先嘗試這套符文。"
          : "輸出節奏變好，能主動換血的英雄可以把它列入首件候選。",
        chips: isRune ? ["主動換血", "優先嘗試", "滾線用"] : ["主動換血", "首件候選", "滾線用"],
      };
    }
    if (damageNerf && !damageBuff) {
      return {
        title: "實戰結論",
        body: isRune
          ? "輸出壓力變低，靠這套符文打前期節奏的英雄要重測。"
          : "爆發或換血壓力變低，靠這件打第一波 all-in 的英雄要延後。",
        chips: isRune ? ["輸出壓力↓", "重測符文", "補傷害"] : ["換血壓力↓", "延後購買", "補傷害"],
      };
    }
  if (changeType === "BUFF") {
    return {
      title: "實戰結論",
      body: isRune
        ? "這套符文只在能打出前期節奏時優先嘗試。"
        : "這件裝備只在能打出第一波優勢時列入首件候選。",
      chips: isRune ? ["優先嘗試", "看前期", "對線收益"] : ["首件候選", "看首波", "對線收益"],
    };
  }
  if (changeType === "NERF") {
    return {
      title: "實戰結論",
      body: isRune
        ? "先重配，除非你的英雄仍比其他符文更吃這個數值。"
        : "先延後，除非你的英雄仍比替代選項更吃這個數值。",
      chips: isRune ? ["重配符文", "比替代", "重測強度"] : ["先延後", "比替代", "重測強度"],
    };
  }
  return {
    title: "實戰結論",
    body: "當成對局選擇：吃到補強數值才出，核心需求被砍就換路線。",
    chips: ["看對局", "吃補強才出", "被砍就換"],
  };
};

const isGenericVerdictText = (body) =>
  /不是無腦先出或放棄|首件收益提高|效率下滑|Do not autopilot|Test this item earlier|Delay this item/i.test(String(body || ""));

const buildVerdictSubtitle = (itemData = {}) => {
  const en = isEnglishVideo(itemData);
  const stats = getStatChanges(itemData);
  const isRune = isRuneTarget(itemData);
  const costNerf = stats.some((stat) => stat.trend === "NERF" && hasStatSignal([stat], /總價格|合成價格|價格|cost/));
  const sustainNerf = stats.some((stat) => stat.trend === "NERF" && hasStatSignal([stat], /吸血|全能吸血|治療|護盾|omnivamp|life steal|heal|shield/));
  const stackBuff = stats.some((stat) => stat.trend === "BUFF" && hasStatSignal([stat], /層數|最大層數|stack/));
  const damageBuff = stats.some((stat) => stat.trend === "BUFF" && hasStatSignal([stat], /攻擊力|攻擊速度|傷害|暴擊|attack|damage|speed|crit/));
  const damageNerf = stats.some((stat) => stat.trend === "NERF" && hasStatSignal([stat], /攻擊力|攻擊速度|傷害|暴擊|attack|damage|speed|crit/));
  const speedBuff = stats.some((stat) => stat.trend === "BUFF" && hasStatSignal([stat], /跑速|move speed|movement speed/));
  const speedNerf = stats.some((stat) => stat.trend === "NERF" && hasStatSignal([stat], /跑速|move speed|movement speed/));

  if (en) {
    if (speedBuff) return "Mobility is stronger\ncheck rotations first";
    if (speedNerf) return "Mobility is weaker\nrespect spacing windows";
    if (isZekesConvergenceTarget(itemData)) return "Ult first safely\ntrigger after engage";
    if (costNerf && sustainNerf && stackBuff) return "Do not rush it\nOnly fast stackers keep it";
    if (costNerf) return "Spike is slower now\nDelay if lane is not winning";
    if (sustainNerf) return "Sustain is weaker\nAvoid long trades";
    if (damageBuff && !damageNerf) return "Damage tempo is better\nTest it on lane bullies";
    if (damageNerf && !damageBuff) return isRune ? "Damage is lower\nRetest rune setup" : "Burst is lower\nDelay the first all-in";
    return itemData.changeType === "BUFF"
      ? "Test it earlier\nonly if first fight improves"
      : itemData.changeType === "NERF"
        ? (isRune ? "Retune setup\nunless no better rune exists" : "Delay the buy\nunless no better option exists")
        : "Use it by matchup\nnot by habit";
  }

  if (speedBuff) return "跑速節奏變好\n先看支援與拉扯";
  if (speedNerf) return "跑速節奏變慢\n進退場要重看";
  if (isZekesConvergenceTarget(itemData)) return "先放大不空燒\n貼身後才觸發";
  if (costNerf && sustainNerf && stackBuff) return "別無腦首出\n快疊滿才保留";
  if (costNerf) return "成形時間變慢\n沒優勢就延後";
  if (sustainNerf) return "續戰容錯下降\n少打長換血";
  if (damageBuff && !damageNerf) return "輸出節奏變好\n主動換血可測";
  if (damageNerf && !damageBuff) return isRune ? "輸出壓力變低\n符文配置要重測" : "換血壓力變低\n第一波要延後";
  return itemData.changeType === "BUFF"
    ? (isRune ? "能打出前期節奏\n才值得優先帶" : "能打出首波優勢\n才列入首件候選")
    : itemData.changeType === "NERF"
      ? (isRune ? "先重配符文\n再決定要不要帶" : "先延後購買\n再比較替代選項")
    : (isRune ? "吃補強才帶\n被砍就換配置" : "吃補強才出\n被砍就換路線");
};

const formatVerdictBody = (body, target = {}) => {
  const text = safeDisplayText(body, "", { maxChars: isEnglishVideo(target) ? 112 : 52 });
  if (!text || text.includes("\n")) return text;
  if (isEnglishVideo(target)) return text;

  const clauses = text
    .replace(/[；;]/g, "，")
    .split(/(?<=，)/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (clauses.length >= 2) {
    const lines = [];
    let current = "";
    clauses.forEach((clause) => {
      if ((current + clause).length > 14 && current) {
        lines.push(current);
        current = clause;
      } else {
        current += clause;
      }
    });
    if (current) lines.push(current);
    return lines.slice(0, 3).join("\n");
  }

  if (text.length <= 15) return text;
  if (text.length <= 30) return `${text.slice(0, Math.ceil(text.length / 2))}\n${text.slice(Math.ceil(text.length / 2))}`;
  return `${text.slice(0, 14)}\n${text.slice(14, 28)}\n${text.slice(28)}`;
};

const localizeTargetName = (name, data = {}) => {
  const raw = String(name || "").trim();
  if (!raw) return isEnglishVideo(data) ? "Item / Rune" : "裝備符文";
  if (isEnglishVideo(data)) {
    const translated = raw
      .split(/\s*\/\s*/)
      .map((part) => targetNameEnMap[part] || part)
      .join(" / ");
    return safeDisplayText(translated, data.targetType === "RUNE" ? "Rune Update" : "Item Update", { maxChars: 26 });
  }
  const translated = raw
    .split(/\s*\/\s*/)
    .map((part) => targetNameMap[normalizeLookupKey(part)] || part)
    .join(" / ");
  return safeDisplayText(translated, "裝備符文", { maxChars: 18 });
};

const localizeChampionName = (championName, data = {}) => {
  const raw = String(championName || "").trim();
  if (!raw) return "";
  if (isEnglishVideo(data)) return safeDisplayText(raw, "", { maxChars: 14 });
  return safeDisplayText(
    championNameMap[raw] || championNameMap[championIdMap[raw]] || championNameMap[raw.replace(/[\s'.]/g, "")] || raw,
    "",
    { maxChars: 8 },
  );
};

const getImpactProfile = (target = {}) => {
  const stats = getStatChanges(target);
  const text = stats.map((stat) => `${stat.metricName} ${stat.summary}`).join(" ").toLowerCase();
  const hasBuff = stats.some((stat) => stat.trend === "BUFF");
  const hasNerf = stats.some((stat) => stat.trend === "NERF");
  const direction = hasBuff && !hasNerf ? "BUFF" : hasNerf && !hasBuff ? "NERF" : "ADJUST";
  if (isZekesConvergenceTarget(target)) {
    return { type: "ZEKE", direction: "ADJUST", isRune: false, en: isEnglishVideo(target) };
  }
  const type = /跑速|move speed|movement speed/.test(text)
    ? "SPEED"
    : /冷卻|技能加速|cooldown|haste/.test(text)
      ? "UPTIME"
      : /吸血|治療|護盾|omnivamp|lifesteal|life steal|heal|shield/.test(text)
        ? "SUSTAIN"
        : /傷害|每段傷害|觸發傷害|命中特效|暴擊|攻擊力|魔法攻擊|damage|trigger|on-hit|crit|attack damage|ability power/.test(text)
          ? "DAMAGE"
          : "GENERAL";
  return { type, direction, isRune: isRuneTarget(target), en: isEnglishVideo(target) };
};

const getImpactSummary = (target = {}) => {
  const { type, direction, isRune, en } = getImpactProfile(target);
  const zhDirection = direction === "NERF" ? "下修" : direction === "BUFF" ? "上修" : "被調整";
  if (en) {
    if (type === "ZEKE") return "This mainly affects engage supports that ult from range, then walk into Frostfire range.";
    if (type === "SPEED") return `${isRune ? "This rune" : "This item"} mainly affects champions that convert mobility into engage, chase, or kiting windows.`;
    if (type === "DAMAGE") return `${isRune ? "This rune" : "This item"} mainly affects champions whose trading pattern depends on early damage pressure.`;
    if (type === "SUSTAIN") return `${isRune ? "This rune" : "This item"} changes how much room these champions have in extended fights.`;
    if (type === "UPTIME") return `${isRune ? "This rune" : "This item"} changes uptime, so champions with repeat trades feel it first.`;
    return `${isRune ? "This rune" : "This item"} changes priority for champions that can turn the new value into tempo.`;
  }
  if (type === "ZEKE") return "最受影響的是遠距離放大後，還要進場貼身的坦輔。";
  if (type === "SPEED") return `${isRune ? "跑速型符文" : "跑速型裝備"}${zhDirection}，主要影響需要進場、追擊與拉扯的英雄。`;
  if (type === "DAMAGE") return `${isRune ? "傷害型符文" : "傷害型裝備"}${zhDirection}，最影響依賴前期換血與爆發節奏的英雄。`;
  if (type === "SUSTAIN") return `${isRune ? "續戰型符文" : "續戰型裝備"}被調整，會改變長時間換血與團戰容錯。`;
  if (type === "UPTIME") return `${isRune ? "觸發頻率型符文" : "冷卻型裝備"}被調整，會影響連續換血與技能輪轉節奏。`;
  return `${isRune ? "這套符文" : "這件裝備"}改動後，最先受影響的是能把新數值轉成節奏的英雄。`;
};

const getChampionImpactDetail = (target = {}, index = 0) => {
  const { type, direction, isRune, en } = getImpactProfile(target);
  const negative = direction === "NERF";
  if (type === "ZEKE") {
    const zekeDetails = en
      ? [
        "Long-range engage gets cleaner because Frostfire no longer burns before the follow-up.",
        "Depth Charge can start the fight, then the storm triggers once Nautilus reaches the target.",
        "Strongest when the support stays in the middle of the fight after the engage.",
      ]
      : [
        "遠距離大絕起手後，貼近目標才開始吃霜火慢速。",
        "深海衝擊先掛後排，進場後不會白白浪費範圍。",
        "強開後留在戰場中央，才能把慢速留給多人吃。",
      ];
    return zekeDetails[index] || zekeDetails[0];
  }
  if (en) {
    const enDetails = {
      SPEED: negative
        ? ["Engage and chase timing are less forgiving.", "Kiting and retreat windows get tighter.", "Still usable, but rotations need cleaner timing."]
        : ["Engage and chase timing become more reliable.", "Kiting after trades becomes easier to convert.", "Roams are faster, but matchup tempo still decides value."],
      DAMAGE: negative
        ? ["Early trades lose pressure, so all-ins need more setup.", "Damage windows are weaker and need cleaner spacing.", "Still viable, but priority depends on matchup."]
        : ["Short trades become more threatening.", "Lane pressure converts into tempo more easily.", "Good when the champion can trigger it consistently."],
      SUSTAIN: negative
        ? ["Long fights are less forgiving.", "Sustain-based trading becomes easier to punish.", "Needs safer timing before committing."]
        : ["Extended trades become more stable.", "Recovery after trades is more forgiving.", "Strongest when fights last longer."],
      UPTIME: negative
        ? ["Repeat-trade cadence slows down.", "Timing windows become easier to punish.", "Needs cleaner cooldown tracking."]
        : ["Repeat trades become smoother.", "More uptime means more pressure windows.", "Best when the kit can trigger it often."],
      GENERAL: ["Priority changes because the value curve moved.", "The champion needs a fresh setup check.", "Playable, but no longer autopilot."],
    };
    return enDetails[type]?.[index] || enDetails.GENERAL[index] || enDetails.GENERAL[0];
  }

  const runePrefix = isRune ? "符文" : "數值";
  const details = {
    SPEED: negative
      ? ["進場與追擊容錯下降，開戰時機要更精準。", "拉扯與撤退空間變小，換血後更怕被反打。", "仍能使用，但支援跑線與進退場要更保守。"]
      : ["進場與追擊更穩，開戰後更容易黏住目標。", "換血後拉開距離更舒服，拉扯容錯提高。", "支援跑線更快，但仍要看對線壓力與隊伍節奏。"],
    DAMAGE: negative
      ? ["前期換血壓力下降，all-in 需要更多前置消耗。", "爆發窗口變窄，不能只靠一波傷害硬打。", "能用，但要看對線與隊伍傷害是否足夠。"]
      : ["短換血威脅提高，更容易把優勢轉成線權。", "前期壓力更強，能更快逼出回補或召喚師技能。", "能穩定觸發時收益最高，適合主動打線。"],
    SUSTAIN: negative
      ? ["長時間換血容錯下降，不能硬吃消耗。", "續戰能力變弱，拉長戰鬥會更吃虧。", "要更保守選擇進場時機。"]
      : ["長時間換血更穩，能把小優勢慢慢滾大。", "續戰容錯提高，團戰中更容易撐到第二輪輸出。", "越能拖長戰鬥，收益越明顯。"],
    UPTIME: negative
      ? ["連續觸發節奏變慢，換血空窗會變大。", "技能輪轉壓力下降，對手更容易抓反打時間。", "需要更精準計算冷卻與進場時機。"]
      : ["連續觸發更順，能更頻繁製造換血窗口。", "技能輪轉壓力提高，對線更容易保持主動。", "越常觸發，越能把改動轉成節奏。"],
    GENERAL: [`${runePrefix}優先級會改變，需要重新檢查對線節奏。`, "強度不是無腦上升，要看英雄能不能吃到新數值。", "能用，但需要看對線與隊伍節奏再決定。"],
  };
  return details[type]?.[index] || details.GENERAL[index] || details.GENERAL[0];
};

const getImpactLabels = (target = {}) => {
  const { type, direction, en } = getImpactProfile(target);
  if (en) {
    if (type === "ZEKE") return ["Riot Named", "Riot Named", "Same Pattern"];
    if (direction === "NERF") return ["Hit Hardest", "Still Affected", "Matchup-Based"];
    if (direction === "BUFF") return ["Biggest Gain", "Stable Gain", "Situational"];
    return ["Needs Review", "Build Check", "Situational"];
  }
  if (type === "ZEKE") return ["官方點名", "官方點名", "同型受益"];
  if (direction === "NERF") return ["最受衝擊", "穩定受影響", "視情況"];
  if (direction === "BUFF") return ["最大受益", "穩定受益", "視情況"];
  return ["最需重看", "節奏受影響", "視情況"];
};

const getImpactChampions = (target = {}, synergyImpact = null) => {
  if (isZekesConvergenceTarget(target)) return ZEKES_IMPACT_CHAMPIONS;
  return Array.isArray(synergyImpact?.champions) && synergyImpact.champions.length > 0
    ? synergyImpact.champions.slice(0, 3)
    : [];
};

const getTrendVisual = (trend, beforeValue, afterValue) => {
  const before = Number(String(beforeValue).replace(/[^\d.-]/g, ""));
  const after = Number(String(afterValue).replace(/[^\d.-]/g, ""));
  const color = trend === "BUFF" ? "#10b981" : trend === "NERF" ? "#ef4444" : "#f59e0b";
  const glow = trend === "BUFF"
    ? "rgba(16,185,129,0.55)"
    : trend === "NERF"
      ? "rgba(239,68,68,0.55)"
      : "rgba(245,158,11,0.5)";

  if (Number.isFinite(before) && Number.isFinite(after)) {
    if (after > before) return { arrow: "▲", color, glow };
    if (after < before) return { arrow: "▼", color, glow };
  }

  if (trend === "BUFF") return { arrow: "▲", color, glow };
  if (trend === "NERF") return { arrow: "▼", color, glow };
  return { arrow: "◆", color, glow };
};

const getStatValueFontSize = (value, baseSize) => {
  const length = String(value ?? "").length;
  if (length > 12) return Math.floor(baseSize * 0.5);
  if (length > 8) return Math.floor(baseSize * 0.62);
  if (length > 5) return Math.floor(baseSize * 0.78);
  return baseSize;
};

const statValueTextStyle = (value, baseSize, extra = {}) => ({
  fontSize: getStatValueFontSize(value, baseSize),
  lineHeight: 1.05,
  overflowWrap: "anywhere",
  wordBreak: "break-word",
  textWrap: "balance",
  minWidth: 0,
  ...extra,
});

const normalizeStatChange = (stat = {}, data = {}, index = 0, allStats = []) => {
  const metricName = refineMetricNameWithContext(stat.metricName, stat, index, allStats, data);
  return ({
  ...stat,
  metricName,
  beforeValue: normalizeStatDisplayValue(stat.beforeValue, metricName, data),
  afterValue: normalizeStatDisplayValue(stat.afterValue, metricName, data),
  trend: ["BUFF", "NERF", "ADJUST"].includes(stat.trend) ? stat.trend : "ADJUST",
  summary: localizeStatSummary(stat.summary, { ...stat, metricName }, data),
  });
};

const getStatChanges = (target) => {
  if (Array.isArray(target?.statChanges) && target.statChanges.length > 0) {
    return target.statChanges
      .filter((stat) => !isUnchangedStatChange(stat))
      .slice(0, 3)
      .map((stat, index, allStats) => normalizeStatChange(stat, target, index, allStats));
  }
  const scene = target?.storyboard?.find((s) => Array.isArray(s.metrics) && s.metrics.length > 0);
  return scene?.metrics
    ?.filter((stat) => !isUnchangedStatChange(stat))
    .slice(0, 3)
    .map((stat, index, allStats) => normalizeStatChange(stat, target, index, allStats)) || [];
};

const normalizeSynergyImpact = (synergyImpact, data = {}) => {
  const copy = getCopy(data);
  if (!synergyImpact || typeof synergyImpact !== "object") return null;
  const stats = Array.isArray(synergyImpact.stats)
    ? synergyImpact.stats.slice(0, 3).map((entry) => ({
      name: safeDisplayText(entry?.name, "", { maxChars: 18 }),
      position: entry?.position || null,
      winRate: safeDisplayText(entry?.winRate, "", { maxChars: 8 }),
      description: safeDisplayText(entry?.description, "", { maxChars: isEnglishVideo(data) ? 80 : 42 }),
    }))
    : [];
  return {
    champions: safeDisplayList(synergyImpact.champions, [], { maxItems: 3, maxChars: 18 }),
    impactDescription: safeDisplayText(
      synergyImpact.impactDescription,
      copy.noImpactBody,
      { maxChars: 46 },
    ),
    impactSource: safeDisplayText(synergyImpact.impactSource, "", { maxChars: 12 }),
    criteria: safeDisplayText(synergyImpact.criteria, "", { maxChars: isEnglishVideo(data) ? 68 : 42 }),
    stats,
  };
};

const normalizeActionableVerdict = (verdict, data = {}) => {
  const copy = getCopy(data);
  const stats = Array.isArray(data.statChanges) ? data.statChanges.map((stat) => normalizeStatChange(stat, data)) : [];
  const derived = deriveActionableVerdict(data, stats);
  if (!verdict || typeof verdict !== "object") return derived;
  const bodySource = verdict.body || verdict.reason;
  const shouldUseDerived = !bodySource || isGenericVerdictText(bodySource);
  return {
    ...verdict,
    title: safeDisplayText(shouldUseDerived ? derived.title : (verdict.title || verdict.recommendation), copy.verdictTitle, { maxChars: 18 }),
    body: safeDisplayText(shouldUseDerived ? derived.body : bodySource, copy.verdictBody, { maxChars: isEnglishVideo(data) ? 112 : 48 }),
    chips: safeDisplayList(shouldUseDerived ? derived.chips : (verdict.chips || [verdict.timing, verdict.riskLevel].filter(Boolean)), [], { maxItems: 3, maxChars: isEnglishVideo(data) ? 18 : 8 }),
  };
};

const normalizeTarget = (data = {}) => {
  const normalizedBase = {
    ...data,
    locale: data.locale || data.outputLanguage || "zh",
    outputLanguage: data.outputLanguage || data.locale || "zh",
    targetType: data.targetType || data.entityType || "ITEM",
  };

  return {
    id: data.id || `${normalizedBase.targetType || "ITEM"}-${data.targetName || data.localizedName || "selected"}`,
    dataType: data.dataType || "ITEM_UPDATE",
    targetType: normalizedBase.targetType,
    locale: normalizedBase.locale,
    outputLanguage: normalizedBase.outputLanguage,
    targetName: safeDisplayText(data.targetName || data.itemName || data.runeName || data.localizedName, "", { maxChars: 24 }),
    localizedName: localizeTargetName(data.localizedName || data.targetName || data.itemName || data.runeName || "", normalizedBase),
    iconUrl: data.iconUrl || data.itemIconUrl || data.runeIconUrl || "",
    changeType: ["BUFF", "NERF", "ADJUST", "REWORK"].includes(data.changeType || data.overallTrend || data.trend)
      ? (data.changeType || data.overallTrend || data.trend)
      : "ADJUST",
    statChanges: getStatChanges(normalizedBase),
    synergyImpact: normalizeSynergyImpact(data.synergyImpact, normalizedBase),
    actionableVerdict: normalizeActionableVerdict(data.actionableVerdict, normalizedBase),
    storyboard: Array.isArray(data.storyboard) ? data.storyboard : null,
  };
};

export const getItemRuneTargets = (data = {}) => {
  const rootTarget = normalizeTarget(data);
  const hasRootTarget =
    Boolean(data.targetName || data.itemName || data.runeName || data.localizedName) ||
    getStatChanges(data).length > 0;

  if (hasRootTarget) {
    return [rootTarget];
  }

  const list = [
    ...(Array.isArray(data.itemChanges) ? data.itemChanges : []),
    ...(Array.isArray(data.runeChanges) ? data.runeChanges : []),
    ...(Array.isArray(data.affectedTargets) ? data.affectedTargets : []),
  ]
    .filter((item) => item && typeof item === "object")
    .map(normalizeTarget)
    .filter((item) => item.targetName || item.localizedName);

  return list;
};

const buildStoryboard = (itemData) => {
  const copy = getCopy(itemData);
  const en = isEnglishVideo(itemData);
  const name = itemData.localizedName || itemData.targetName || copy.fallbackTarget;
  const stat = getStatChanges(itemData)[0];
  const metric = stat ? localizeStatName(stat.metricName, itemData) : copy.coreStat;
  const gameplayFocus = getMetricGameplayFocus(metric, stat, itemData);
  const tempoNoun = buildTempoNoun(itemData);
  const zeke = isZekesConvergenceTarget(itemData);
  const trendWord = en
    ? (stat?.trend === "NERF" ? "nerfed" : stat?.trend === "BUFF" ? "buffed" : "retuned")
    : (stat?.trend === "NERF" ? "下修" : stat?.trend === "BUFF" ? "上修" : "重調");

  if (en) {
    return [
      { text: `${name} patch update\n${isRuneTarget(itemData) ? "Rune setup changes" : "Build timing changes"}`, tag: "HOOK", durationInFrames: 132 },
      {
        text: `${metric} was ${trendWord}\n${gameplayFocus}`,
        tag: "STAT_REVEAL",
        durationInFrames: 126,
      },
      {
        text: zeke ? "The key is ult-to-enter timing\nnot a raw stat line" : "The key is timing\nNot just the label",
        tag: "PRACTICAL_READ",
        durationInFrames: 128,
      },
      {
        text: zeke ? "Engage supports feel this first\nWatch the follow-up window" : "These champions feel it first\nWatch how their windows change",
        tag: "IMPACT",
        durationInFrames: 132,
      },
      { text: buildVerdictSubtitle(itemData), tag: "CONCLUSION_CTA", durationInFrames: 110 },
    ];
  }

  return [
    { text: `${name}版本改動\n這波會改寫${tempoNoun}`, tag: "HOOK", durationInFrames: 132 },
    {
      text: `${metric}${trendWord}是重點\n${gameplayFocus}`,
      tag: "STAT_REVEAL",
      durationInFrames: 126,
    },
    {
      text: zeke ? "重點是大絕後進場\n不是單看數值" : "不要只看單一數字\n對線節奏才是關鍵",
      tag: "PRACTICAL_READ",
      durationInFrames: 128,
    },
    {
      text: zeke ? "坦輔最需要重看\n先看放大後貼身時間" : "真正受影響的是這些英雄\n重點看節奏怎麼變",
      tag: "IMPACT",
      durationInFrames: 132,
    },
    { text: buildVerdictSubtitle(itemData), tag: "CONCLUSION_CTA", durationInFrames: 110 },
  ];
};

const buildInsight = (target, statChanges) => {
  const en = isEnglishVideo(target);
  const changeType = ["BUFF", "NERF", "ADJUST", "REWORK"].includes(target.changeType) ? target.changeType : "ADJUST";
  const targetTypeLabel = target.targetType === "RUNE" ? (en ? "rune" : "符文") : (en ? "item" : "裝備");
  const firstTiming = buildFirstTimingNoun(target);
  const buffCount = statChanges.filter((stat) => stat.trend === "BUFF").length;
  const nerfCount = statChanges.filter((stat) => stat.trend === "NERF").length;

  if (isZekesConvergenceTarget(target)) {
    return en
      ? {
        title: "Gameplay Read",
        body: "The buff is practical: Frostfire can wait after a ranged ultimate, then trigger once the tank support enters range.",
        chips: ["Ranged Ult", "Enter Range", "Tank Support"],
      }
      : {
        title: "實戰判讀",
        body: "重點是先放大不空燒，坦輔貼近目標後才開始吃霜火風暴。",
        chips: ["遠距離放大", "貼身觸發", "坦輔加分"],
      };
  }

  if (changeType === "BUFF") {
    return en
      ? {
        title: "Gameplay Read",
        body: `This ${targetTypeLabel} is stronger, so ${target.targetType === "RUNE" ? "rune setup" : "first-item timing"} and early trades are worth retesting.`,
        chips: target.targetType === "RUNE" ? ["Early Tempo", "Rune Setup", "Lane Trades"] : ["Early Tempo", "First Item", "Lane Trades"],
      }
      : {
        title: "實戰判讀",
        body: `${targetTypeLabel}強度上修，優先檢查${firstTiming}與前期對線收益。`,
        chips: target.targetType === "RUNE" ? ["前期節奏↑", "符文價值↑", "換血壓力↑"] : ["前期節奏↑", "首購價值↑", "換血壓力↑"],
      };
  }

  if (changeType === "NERF") {
    return en
      ? {
        title: "Gameplay Read",
        body: `This ${targetTypeLabel} lost efficiency, so timing windows and setup priority need a reset.`,
        chips: target.targetType === "RUNE" ? ["Tempo Down", "Setup Check", "Find Alternatives"] : ["Pressure Down", "Slower Spike", "Find Alternatives"],
      }
      : {
        title: "實戰判讀",
        body: `${targetTypeLabel}效率下滑，依賴它打節奏或過渡的英雄要重看優先級。`,
        chips: target.targetType === "RUNE" ? ["節奏壓力↓", "配置重看", "替代符文↑"] : ["換血壓力↓", "成型速度↓", "替代裝備↑"],
      };
  }

  if (buffCount > 0 && nerfCount > 0) {
    return en
      ? {
        title: "Gameplay Read",
        body: "This is not a clean buff or nerf. Riot shifted power between uptime, pressure, and setup priority.",
        chips: ["Timing Check", "Sustained Value", "Priority Split"],
      }
      : {
        title: "實戰判讀",
        body: "這不是單純增強或削弱，而是把節奏、拉扯與持續收益重新分配。",
        chips: target.targetType === "RUNE" ? ["節奏重估", "拉扯補強", "配置分歧"] : ["節奏重估", "長戰補償", "出裝分歧"],
      };
  }

  return en
    ? {
      title: "Gameplay Read",
      body: "The core tuning changed. The winners are the champions that convert it into tempo fastest.",
      chips: ["Role Shift", "Playstyle Check", "Patch Watch"],
    }
    : {
      title: "實戰判讀",
      body: "核心機制被重新校準，實際強度要看誰能最快把新數值轉成節奏。",
      chips: ["定位調整", "玩法重估", "版本觀察"],
    };
};

const getStatSignalKind = (stat = {}) => {
  const text = `${stat.metricName || ""} ${stat.summary || ""}`.toLowerCase();
  if (/跑速|move speed|movement/.test(text)) return "SPEED";
  if (/價格|總價格|合成價格|cost|gold/.test(text)) return "COST";
  if (/冷卻|技能加速|cooldown|haste/.test(text)) return "UPTIME";
  if (/吸血|全能吸血|治療|護盾|omnivamp|life steal|lifesteal|heal|shield/.test(text)) return "SUSTAIN";
  if (/層數|最大層數|stack/.test(text)) return "STACK";
  if (/傷害|每段傷害|觸發傷害|命中特效|暴擊|攻擊力|攻擊速度|魔法攻擊|damage|trigger|on-hit|crit|attack damage|attack speed|ability power/.test(text)) {
    return "DAMAGE";
  }
  return "GENERAL";
};

const formatStatDiff = (stat = {}, target = {}) => {
  if (isUnchangedStatChange(stat)) return "";
  const metric = localizeStatName(stat.metricName, target);
  const before = normalizeStatValue(stat.beforeValue);
  const after = normalizeStatValue(stat.afterValue);
  if (!before || before === "—" || !after || after === "—") return metric;
  return `${metric} ${before}→${after}`;
};

const getOfficialRangeContext = (stat = {}, target = {}) => {
  const en = isEnglishVideo(target);
  const text = String(`${stat.officialText || ""} ${stat.summary || ""}`).replace(/⇒/g, "→");
  const arrowParts = text.split(/→|=>|->|>>>|\bto\b/i);
  if (arrowParts.length < 2) return null;

  const extractRange = (value) => {
    const match = String(value || "").match(/(-?\d+(?:\.\d+)?%?)\s*[-~]\s*(-?\d+(?:\.\d+)?%?)/);
    return match ? { min: match[1], max: match[2] } : null;
  };
  const beforeRange = extractRange(arrowParts[0]);
  const afterRange = extractRange(arrowParts.slice(1).join("→"));
  if (!beforeRange || !afterRange) return null;

  const minChanged = !isUnchangedStatChange({ beforeValue: beforeRange.min, afterValue: afterRange.min });
  const maxChanged = !isUnchangedStatChange({ beforeValue: beforeRange.max, afterValue: afterRange.max });
  if (minChanged && !maxChanged) {
    return en
      ? {
        title: "Top End Unchanged",
        detail: `Only the low-end value moved ${beforeRange.min}→${afterRange.min}; the max stays ${beforeRange.max}.`,
      }
      : {
        title: "高端沒變",
        detail: `只有低端從 ${beforeRange.min} 變 ${afterRange.min}，最高值仍是 ${beforeRange.max}。`,
      };
  }
  if (!minChanged && maxChanged) {
    return en
      ? {
        title: "Low End Unchanged",
        detail: `The floor stays ${beforeRange.min}; the max value moved ${beforeRange.max}→${afterRange.max}.`,
      }
      : {
        title: "低端沒變",
        detail: `最低值仍是 ${beforeRange.min}，只有高端從 ${beforeRange.max} 變 ${afterRange.max}。`,
      };
  }
  return null;
};

const buildPracticalCards = (target, statChanges, insight) => {
  const en = isEnglishVideo(target);
  const isRune = isRuneTarget(target);
  const meaningfulStats = statChanges.filter((stat) => !isUnchangedStatChange(stat));
  const primary = meaningfulStats[0] || {};
  const secondary = meaningfulStats[1] || null;
  const kind = getStatSignalKind(primary);
  const buff = primary.trend === "BUFF";
  const nerf = primary.trend === "NERF";
  const diff = formatStatDiff(primary, target);
  const secondaryDiff = secondary ? formatStatDiff(secondary, target) : "";
  const rangeContext = getOfficialRangeContext(primary, target);
  const setupNoun = isRune ? (en ? "rune setup" : "符文配置") : (en ? "build path" : "出裝路線");

  if (isZekesConvergenceTarget(target)) {
    return en
      ? [
        { title: "Ranged Ult Fix", detail: "Leona or Nautilus can ult first without wasting the Frostfire storm too early." },
        { title: "Enter Range First", detail: "After the ult, the item waits up to 5s and triggers when an enemy enters the storm radius." },
        { title: "Support Tank Only", detail: "Prioritize it on engage supports that actually walk into the fight, not backline carries." },
      ]
      : [
        { title: "遠距離開戰", detail: "雷歐娜或納帝魯斯先放大，不會再太早空燒風暴。" },
        { title: "進場再觸發", detail: "大絕後最多等5秒，貼近敵人時才開始吃慢速。" },
        { title: "坦輔才加分", detail: "只看會開戰貼身的輔助；後排輸出不要拿來判斷。" },
      ];
  }

  if (en) {
    if (kind === "SPEED") {
      return buff
        ? [
          { title: "Roam Window Up", detail: `${diff}: rotations, engages, and chase windows arrive earlier.` },
          { title: "Spacing Value Up", detail: `Prioritize it on champions that kite after trades or need one more step to stick.` },
          { title: "Do Not Auto-Swap", detail: `If the champion stays planted in lane, compare it against the current ${setupNoun}.` },
        ]
        : [
          { title: "Roam Window Down", detail: `${diff}: rotations and chase angles are less reliable.` },
          { title: "Spacing Gets Punished", detail: `Champions using it to disengage or re-enter fights need safer timing.` },
          { title: "Retest Alternatives", detail: `Keep it only when the kit still converts the slower speed into tempo.` },
        ];
    }
    if (kind === "COST") {
      return [
        { title: nerf ? "Spike Delayed" : "Spike Earlier", detail: `${diff}: the first meaningful fight timing changes immediately.` },
        { title: "Recall Math Matters", detail: nerf ? "Bad recalls make this path clunky; buy components only from a stable lane." : "Winning lanes can hit the item before the next objective setup." },
        { title: "Compare Alternatives", detail: `Do not lock the old ${setupNoun}; check cheaper paths if tempo is tight.` },
      ];
    }
    if (kind === "SUSTAIN") {
      return [
        { title: nerf ? "Long Trades Down" : "Long Trades Up", detail: `${diff}: extended fights and recovery windows change first.` },
        { title: "Trade Pattern Changes", detail: nerf ? "Short trades are safer than committing to drawn-out fights." : "Champions that re-enter fights can take greedier tempo windows." },
        { title: "Matchup Check", detail: "Poke-heavy lanes and anti-heal timing decide whether this still pays off." },
      ];
    }
    if (kind === "DAMAGE") {
      return [
        { title: nerf ? "Burst Window Down" : "Burst Window Up", detail: `${diff}: the first trade or all-in threshold is the key check.` },
        { title: "Lane Pressure Check", detail: nerf ? "If this was your first damage spike, delay the commit or add damage elsewhere." : "Lane bullies can test earlier fights before the opponent finishes defense." },
        rangeContext || { title: secondaryDiff || "Combo Test", detail: secondaryDiff ? `Also review ${secondaryDiff}; mixed stats can change the final decision.` : "Only prioritize it if the champion can trigger the damage reliably." },
      ];
    }
    if (kind === "UPTIME") {
      return [
        { title: nerf ? "Cooldown Window Down" : "Cooldown Window Up", detail: `${diff}: repeat trades and second rotation timing change.` },
        { title: "Fight Length Check", detail: nerf ? "Avoid fights that require multiple procs before the value appears." : "Extended skirmishes become easier to convert into pressure." },
        { title: "Setup Priority", detail: `Recheck the ${setupNoun} on champions that can trigger it repeatedly.` },
      ];
    }
  }

  if (kind === "SPEED") {
    return buff
      ? [
        { title: "跑線窗口↑", detail: `${diff}，支援、進場與追擊會更早到位。` },
        { title: "拉扯價值↑", detail: "換血後能更快拉開或黏住目標，吃走位的英雄最有感。" },
        { title: "不要無腦換", detail: `只有會主動遊走、進場或拉扯的英雄，才值得優先改${setupNoun}。` },
      ]
      : [
        { title: "跑線窗口↓", detail: `${diff}，支援與追擊角度會更難抓。` },
        { title: "拉扯容錯↓", detail: "靠它退場或二次進場的英雄，要更保守抓開戰時機。" },
        { title: isRune ? "先比配置" : "先比替代", detail: `如果英雄不能穩定轉成節奏，就先保留原本${setupNoun}。` },
      ];
  }

  if (kind === "COST") {
    return [
      { title: nerf ? "成形延後" : "成形提前", detail: `${diff}，第一波小龍或先鋒前的裝備時間會改變。` },
      { title: "回補節奏", detail: nerf ? "對線沒優勢時不要硬走舊路線，先用便宜組件撐節奏。" : "優勢線可以更早卡成裝點，逼對手在物件前接團。" },
      { title: "替代路線", detail: `這不是只看強弱，要重新比較${setupNoun}與回家金額。` },
    ];
  }

  if (kind === "SUSTAIN") {
    return [
      { title: nerf ? "長戰容錯↓" : "長戰容錯↑", detail: `${diff}，最先影響連續換血與團戰續航。` },
      { title: "換血方式", detail: nerf ? "不要拖長互打，改成短換血或等關鍵技能再進場。" : "能二次進場的英雄，可以更敢接拉長的碰撞。" },
      { title: "對局條件", detail: "遇到消耗線、重傷或爆發陣容時，仍要重新評估收益。" },
    ];
  }

  if (kind === "DAMAGE") {
    return [
      { title: nerf ? "斬殺線下降" : "斬殺線提高", detail: `${diff}，第一波換血或 all-in 門檻要重算。` },
      { title: "線權判斷", detail: nerf ? "如果這是主要傷害來源，要延後強開或從其他裝備補傷害。" : "能穩定觸發的英雄，可以更早用傷害逼回補。" },
      rangeContext || { title: secondaryDiff || "觸發條件", detail: secondaryDiff ? `同時檢查 ${secondaryDiff}，避免只看單一補強。` : `只有能穩定觸發這個數值，才值得調整${setupNoun}。` },
    ];
  }

  if (kind === "UPTIME") {
    return [
      { title: nerf ? "連續觸發↓" : "連續觸發↑", detail: `${diff}，影響第二輪技能與反覆換血。` },
      { title: "戰鬥長度", detail: nerf ? "短戰還能打，長戰會更容易露出空窗。" : "拉長碰撞時更容易把第二輪價值打出來。" },
      { title: "英雄條件", detail: `越常觸發這套效果的英雄，越需要重看${setupNoun}。` },
    ];
  }

  return insight.chips.slice(0, 3).map((chip, index) => ({
    title: chip,
    detail: [
      insight.body,
      isRune ? "先確認這套符文是不是仍然符合英雄的對線計畫。" : "先確認這件裝備是不是仍然符合第一波成裝計畫。",
      isRune ? "不要只看標籤，重點是英雄能不能吃到這次改動。" : "不要只看標籤，重點是英雄能不能吃到這次改動。",
    ][index] || insight.body,
  }));
};

const getActiveScene = (storyboard, sceneDurations, frame, narrationStart, fps) => {
  if (frame < narrationStart) {
    return { scene: storyboard[0], index: 0, start: narrationStart };
  }

  let cursor = narrationStart;
  for (let i = 0; i < storyboard.length; i++) {
    const duration = sceneDurations[i] || fps * 3;
    if (frame >= cursor && frame < cursor + duration) {
      return { scene: storyboard[i], index: i, start: cursor };
    }
    cursor += duration;
  }
  const lastIndex = Math.max(0, storyboard.length - 1);
  return { scene: storyboard[lastIndex], index: lastIndex, start: Math.max(narrationStart, cursor - (sceneDurations[lastIndex] || fps * 3)) };
};

const GlassPanelNotice = ({ title, body }) => (
  <div
    style={{
      ...glassPanelStyle("#7dd3fc"),
      border: "2px solid rgba(125,211,252,0.42)",
      borderRadius: 24,
      padding: "32px 34px",
      color: "#dbeafe",
      textAlign: "center",
    }}
  >
    <div style={{ color: "#7dd3fc", fontSize: 32, fontWeight: 950, letterSpacing: 3 }}>{title}</div>
    <div style={{ marginTop: 12, fontSize: 26, fontWeight: 850, lineHeight: 1.35 }}>{body}</div>
  </div>
);

const IconBox = ({ src, label, size = 120, border = "#C8AA6E", radius = 24 }) => (
  <div
    style={{
      width: size,
      height: size,
      flexShrink: 0,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "linear-gradient(145deg, rgba(3,10,20,0.95), rgba(9,28,48,0.88))",
      border: `3px solid ${border}`,
      borderRadius: radius,
      boxShadow: `0 0 ${Math.floor(size / 3)}px ${border}66, inset 0 0 26px rgba(255,255,255,0.08)`,
      overflow: "hidden",
    }}
  >
    {src ? (
      <Img src={resolveRenderAssetSrc(src)} alt={label || ""} style={{ width: "84%", height: "84%", objectFit: "contain" }} />
    ) : (
      <span style={{ color: border, fontWeight: 950, fontSize: Math.floor(size * 0.42) }}>
        {String(label || "?").slice(0, 1)}
      </span>
    )}
  </div>
);

const HexParticleField = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {Array.from({ length: 28 }, (_, i) => {
        const x = (i * 137) % 100;
        const y = (i * 61) % 100;
        const drift = Math.sin((frame + i * 11) / 40) * 10;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${x}%`,
              top: `${y}%`,
              width: 8 + (i % 3) * 4,
              height: 8 + (i % 3) * 4,
              border: "1px solid rgba(200,170,110,0.58)",
              transform: `translate(${drift}px, ${drift * 0.65}px) rotate(${45 + frame * 0.16}deg)`,
              opacity: 0.13 + (i % 5) * 0.035,
              boxShadow: "0 0 14px rgba(200,170,110,0.45)",
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

const Background = () => (
  <>
    <AbsoluteFill
      style={{
        background: [
          "radial-gradient(circle at 50% 20%, rgba(12, 200, 185, 0.22), transparent 28%)",
          "radial-gradient(circle at 50% 84%, rgba(200, 170, 110, 0.15), transparent 32%)",
          "linear-gradient(180deg, #06101f 0%, #091a31 44%, #020611 100%)",
        ].join(", "),
      }}
    />
    <AbsoluteFill
      style={{
        backgroundImage:
          "linear-gradient(rgba(200,170,110,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(200,170,110,0.06) 1px, transparent 1px)",
        backgroundSize: "58px 58px",
        opacity: 0.38,
      }}
    />
    <HexParticleField />
    <div
      style={{
        position: "absolute",
        inset: 46,
        border: "3px solid rgba(200,170,110,0.68)",
        boxShadow: "0 0 42px rgba(12,200,185,0.2), inset 0 0 55px rgba(3,10,20,0.85)",
        clipPath: "polygon(28px 0, 100% 0, 100% calc(100% - 28px), calc(100% - 28px) 100%, 0 100%, 0 28px)",
      }}
    />
  </>
);

const glassPanelStyle = (accent = "rgba(125,211,252,0.55)") => ({
  background: "linear-gradient(135deg, rgba(10, 20, 40, 0.58), rgba(2, 6, 14, 0.46))",
  border: "1px solid rgba(255,255,255,0.12)",
  boxShadow: `0 18px 46px rgba(0,0,0,0.34), 0 0 28px ${accent}33, inset 0 1px 0 rgba(255,255,255,0.16), inset 0 0 28px rgba(200,170,110,0.055)`,
  backdropFilter: "blur(12px)",
  WebkitBackdropFilter: "blur(12px)",
});

const hextechFrameStyle = (accent = "#C8AA6E") => ({
  outline: "1px solid rgba(255,255,255,0.08)",
  borderImage: `linear-gradient(135deg, ${accent}, rgba(125,211,252,0.42), rgba(200,170,110,0.78)) 1`,
});

const StatCard = ({ stat, target, index, revealFrame }) => {
  const { fps } = useVideoConfig();
  const trend = getTrendVisual(stat.trend, stat.beforeValue, stat.afterValue);
  const cardIn = spring({ frame: Math.max(0, revealFrame - index * 10), fps, config: { stiffness: 220, damping: 19, mass: 0.72 } });
  const pulse = 0.94 + Math.sin((revealFrame + index * 12) / 18) * 0.06;
  const metricName = localizeStatName(stat.metricName, target);

  return (
    <div
      style={{
        width: "100%",
        minHeight: 136,
        display: "grid",
        gridTemplateColumns: "1.15fr minmax(0, 0.65fr) 70px minmax(0, 0.65fr)",
        alignItems: "center",
        gap: 22,
        padding: "26px 34px",
        ...glassPanelStyle(trend.color),
        border: `2px solid ${trend.color}88`,
        ...hextechFrameStyle(trend.color),
        borderRadius: 22,
        transform: `translateX(${interpolate(cardIn, [0, 1], [index % 2 === 0 ? -96 : 96, 0])}px) scale(${interpolate(cardIn, [0, 1], [0.9, 1])})`,
        opacity: cardIn,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ color: "#f8fafc", fontSize: 44, fontWeight: 950, lineHeight: 1.05 }}>
          {metricName}
        </div>
        {stat.summary ? (
          <div style={{ color: "#b7c8dc", fontSize: 24, fontWeight: 800, lineHeight: 1.24, marginTop: 10 }}>
            {stat.summary}
          </div>
        ) : null}
      </div>
      <div style={statValueTextStyle(stat.beforeValue, 64, { color: "#b8c4d8", fontWeight: 950, textAlign: "right" })}>
        {stat.beforeValue ?? "—"}
      </div>
      <div
        style={{
          color: trend.color,
          fontSize: 66,
          fontWeight: 950,
          textAlign: "center",
          lineHeight: 1,
          textShadow: `0 0 28px ${trend.glow}`,
          transform: `scale(${pulse})`,
        }}
      >
        {trend.arrow}
      </div>
      <div style={statValueTextStyle(stat.afterValue, 64, { color: trend.color, fontWeight: 950, textShadow: `0 0 22px ${trend.glow}` })}>
        {stat.afterValue ?? "—"}
      </div>
    </div>
  );
};

const InsightBlock = ({ target, statChanges, revealFrame }) => {
  const { fps } = useVideoConfig();
  const insight = buildInsight(target, statChanges);
  const blockIn = spring({ frame: Math.max(0, revealFrame - 44), fps, config: { stiffness: 180, damping: 18, mass: 0.72 } });

  return (
    <section
      style={{
        width: "100%",
        display: "grid",
        gridTemplateColumns: "285px 1fr",
        alignItems: "center",
        gap: 30,
        padding: "30px 34px",
        ...glassPanelStyle("#C8AA6E"),
        border: "2px solid rgba(200,170,110,0.5)",
        ...hextechFrameStyle("#C8AA6E"),
        borderRadius: 20,
        transform: `translateY(${interpolate(blockIn, [0, 1], [54, 0])}px) scale(${interpolate(blockIn, [0, 1], [0.94, 1])})`,
        opacity: blockIn,
      }}
    >
      <div>
        <div style={{ color: "#C8AA6E", fontSize: 33, fontWeight: 950, letterSpacing: 3 }}>{insight.title}</div>
        <div style={{ marginTop: 13, display: "flex", flexWrap: "wrap", gap: 10 }}>
          {insight.chips.map((chip) => (
            <span
              key={chip}
              style={{
                color: "#07111f",
                background: "linear-gradient(90deg, #C8AA6E, #f4d58d)",
                borderRadius: 999,
                padding: "8px 15px",
                fontSize: 21,
                fontWeight: 950,
                whiteSpace: "nowrap",
              }}
            >
              {chip}
            </span>
          ))}
        </div>
      </div>
      <div
        style={{
          color: "#f8fafc",
          fontSize: 36,
          fontWeight: 850,
          lineHeight: 1.32,
          wordBreak: "keep-all",
          textWrap: "balance",
          textShadow: "0 4px 18px rgba(0,0,0,0.65)",
        }}
      >
        {insight.body}
      </div>
    </section>
  );
};

const StatusBadge = ({ status, frameOffset = 0 }) => {
  const { fps } = useVideoConfig();
  const pop = spring({ frame: Math.max(0, frameOffset), fps, config: { stiffness: 170, damping: 14, mass: 0.7 } });

  return (
    <div
      style={{
        color: status.color,
        background: `linear-gradient(135deg, ${status.bg}, rgba(2,6,14,0.68))`,
        border: `3px solid ${status.color}`,
        borderRadius: 20,
        boxShadow: `0 0 38px ${status.color}77, inset 0 0 22px rgba(255,255,255,0.06)`,
        padding: "14px 34px",
        fontSize: 35,
        fontWeight: 950,
        letterSpacing: 6,
        transform: `translateY(${interpolate(pop, [0, 1], [-34, 0])}px) scale(${interpolate(pop, [0, 1], [0.86, 1])})`,
        opacity: pop,
      }}
    >
      {status.text}
    </div>
  );
};

const ItemPortrait = ({ target, compact = false, localFrame = 0 }) => {
  const { fps } = useVideoConfig();
  const drop = spring({ frame: Math.max(0, localFrame - 3), fps, config: { stiffness: 230, damping: 13, mass: 0.62 } });
  const breathe = Math.sin(localFrame / 22) * (compact ? 5 : 9);
  const size = compact ? 210 : 322;
  const iconSize = compact ? 156 : 236;

  return (
    <div
      style={{
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, rgba(200,170,110,0.26), rgba(12,200,185,0.14), rgba(5,12,24,0.92))",
        border: "5px solid rgba(200,170,110,0.94)",
        borderRadius: compact ? 36 : 52,
        boxShadow: "0 0 76px rgba(200,170,110,0.46), 0 26px 76px rgba(0,0,0,0.58), inset 0 0 42px rgba(255,255,255,0.09)",
        transform: `translateY(${interpolate(drop, [0, 1], [-120, breathe])}px) scale(${interpolate(drop, [0, 0.72, 1], [0.62, 1.1, 1])})`,
        opacity: drop,
      }}
    >
      {target.iconUrl ? (
        <Img
          src={resolveRenderAssetSrc(target.iconUrl)}
          alt={target.localizedName}
          style={{
            width: iconSize,
            height: iconSize,
            objectFit: "contain",
            filter: "drop-shadow(0 20px 24px rgba(0,0,0,0.72))",
          }}
        />
      ) : (
        <span style={{ color: "#C8AA6E", fontSize: compact ? 70 : 112, fontWeight: 950 }}>?</span>
      )}
    </div>
  );
};

const BuildSignalStrip = ({ target, statChanges, localFrame }) => {
  const { fps } = useVideoConfig();
  const en = isEnglishVideo(target);
  const firstStat = statChanges[0];
  const isRune = target.targetType === "RUNE";
  const verdictLabel = (() => {
    if (en) {
      if (target.changeType === "NERF") return isRune ? "Retune setup" : "Delay or replace";
      if (target.changeType === "BUFF") return isRune ? "Test setup" : "Test earlier";
      return isRune ? "Setup check" : "Matchup dependent";
    }
    if (target.changeType === "NERF") return isRune ? "重配或保留" : "延後或替代";
    if (target.changeType === "BUFF") return isRune ? "優先嘗試" : "列入候選";
    return isRune ? "看符文適配" : "看英雄適配";
  })();
  const signals = en
    ? [
      { title: "Target", value: isRune ? "Rune Setup" : "Item Slot" },
      { title: "Key Stat", value: firstStat ? localizeStatName(firstStat.metricName, target) : "Core Stat" },
      { title: "Verdict", value: verdictLabel },
    ]
    : [
      { title: "定位", value: isRune ? "符文配置" : "裝備欄位" },
      { title: "核心", value: firstStat ? localizeStatName(firstStat.metricName, target) : "核心數值" },
      { title: "結論", value: verdictLabel },
    ];

  return (
    <div style={{ display: "flex", gap: 18, marginTop: 34 }}>
      {signals.map((slot, index) => {
        const inAnim = spring({ frame: Math.max(0, localFrame - 18 - index * 5), fps, config: { stiffness: 175, damping: 16 } });
        return (
          <div
            key={slot.title}
            style={{
              width: 188,
              minHeight: 120,
              ...glassPanelStyle(index === 1 ? "#C8AA6E" : "#7dd3fc"),
              border: `2px solid ${index === 1 ? "rgba(200,170,110,0.62)" : "rgba(125,211,252,0.38)"}`,
              borderRadius: 20,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              transform: `translateY(${interpolate(inAnim, [0, 1], [42, 0])}px)`,
              opacity: inAnim,
            }}
          >
            <div style={{ color: index === 1 ? "#f4d58d" : "#7dd3fc", fontSize: 21, fontWeight: 950, letterSpacing: 2 }}>
              {slot.title}
            </div>
            <div style={{ color: "#f8fafc", fontSize: en ? 23 : 25, fontWeight: 950, lineHeight: 1.12, textAlign: "center", marginTop: 12, textWrap: "balance" }}>
              {slot.value}
            </div>
          </div>
        );
      })}
    </div>
  );
};

const HookScene = ({ target, status, label, localFrame }) => {
  const { fps } = useVideoConfig();
  const copy = getCopy(target);
  const nameIn = spring({ frame: Math.max(0, localFrame - 20), fps, config: { stiffness: 115, damping: 15 } });
  const statChanges = getStatChanges(target);

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
      <StatusBadge status={status} frameOffset={localFrame} />
      <div style={{ marginTop: 56 }}>
        <ItemPortrait target={target} localFrame={localFrame} />
      </div>
      <div
        style={{
          marginTop: 42,
          textAlign: "center",
          transform: `translateY(${interpolate(nameIn, [0, 1], [36, 0])}px)`,
          opacity: nameIn,
        }}
      >
        <div style={{ color: "#7dd3fc", fontSize: 24, fontWeight: 950, letterSpacing: 6, marginBottom: 14 }}>
          {copy.focusLabel}
        </div>
        <div
          style={{
            color: "#fff",
            fontSize: 82,
            fontWeight: 950,
            lineHeight: 1.03,
            maxWidth: 850,
            textWrap: "balance",
            wordBreak: "keep-all",
            textShadow: "0 0 42px rgba(200,170,110,0.38), 0 8px 28px rgba(0,0,0,0.92)",
          }}
        >
          {target.localizedName}
        </div>
        <div style={{ color: "#C8AA6E", fontSize: 34, fontWeight: 950, marginTop: 18, textShadow: `0 0 26px ${label.shadow}` }}>
          {label.text}
        </div>
      </div>
      <BuildSignalStrip target={target} statChanges={statChanges} localFrame={localFrame} />
    </div>
  );
};

const StatExplosionScene = ({ target, statChanges, status, label, localFrame }) => {
  const { fps } = useVideoConfig();
  const copy = getCopy(target);
  const primary = statChanges[0] || { metricName: copy.textChange, trend: "ADJUST", summary: copy.noNumeric };
  const trend = getTrendVisual(primary.trend, primary.beforeValue, primary.afterValue);
  const blast = spring({ frame: Math.max(0, localFrame - 16), fps, config: { stiffness: 210, damping: 13, mass: 0.7 } });
  const shock = interpolate(Math.sin(localFrame / 5), [-1, 1], [0.92, 1.08]);

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
      <StatusBadge status={status} frameOffset={localFrame} />
      <div style={{ marginTop: 34, display: "flex", alignItems: "center", gap: 28 }}>
        <ItemPortrait target={target} compact localFrame={localFrame} />
        <div>
          <div style={{ color: "#7dd3fc", fontSize: 24, fontWeight: 950, letterSpacing: 5 }}>{copy.itemCheck}</div>
          <div style={{ color: "#fff", fontSize: 54, fontWeight: 950, lineHeight: 1.05, maxWidth: 520, textWrap: "balance" }}>{target.localizedName}</div>
          <div style={{ color: "#C8AA6E", fontSize: 28, fontWeight: 950, marginTop: 8 }}>{label.text}</div>
        </div>
      </div>
      <div
        style={{
          width: "92%",
          marginTop: 52,
          padding: "42px 42px 46px",
          ...glassPanelStyle(trend.color),
          border: `3px solid ${trend.color}88`,
          ...hextechFrameStyle(trend.color),
          borderRadius: 30,
          transform: `scale(${interpolate(blast, [0, 0.75, 1], [0.82, 1.04, 1])})`,
          opacity: blast,
        }}
      >
        <div style={{ color: "#f8fafc", fontSize: 58, fontWeight: 950, textAlign: "center", lineHeight: 1 }}>
          {localizeStatName(primary.metricName, target)}
        </div>
        {primary.summary ? (
          <div style={{ color: "#cbd5e1", fontSize: 28, fontWeight: 850, textAlign: "center", marginTop: 16 }}>
            {primary.summary}
          </div>
        ) : null}
        <div style={{ marginTop: 38, display: "grid", gridTemplateColumns: "minmax(0, 1fr) 120px minmax(0, 1fr)", alignItems: "center", gap: 22 }}>
          <div style={statValueTextStyle(primary.beforeValue, 92, { color: "#b8c4d8", fontWeight: 950, textAlign: "right" })}>{primary.beforeValue ?? "—"}</div>
          <div
            style={{
              color: trend.color,
              fontSize: 96,
              fontWeight: 950,
              textAlign: "center",
              transform: `scale(${shock})`,
              textShadow: `0 0 40px ${trend.glow}`,
              lineHeight: 1,
            }}
          >
            {trend.arrow}
          </div>
          <div style={statValueTextStyle(primary.afterValue, 112, { color: trend.color, fontWeight: 950, textShadow: `0 0 32px ${trend.glow}` })}>
            {primary.afterValue ?? "—"}
          </div>
        </div>
      </div>
      {statChanges.length > 1 ? (
        <div style={{ width: "92%", display: "flex", flexDirection: "column", gap: 14, marginTop: 22 }}>
          {statChanges.slice(1, 3).map((stat, index) => (
            <StatCard key={`${stat.metricName}-${index}`} stat={stat} target={target} index={index} revealFrame={localFrame - 46} />
          ))}
        </div>
      ) : null}
    </div>
  );
};

const PracticalReadScene = ({ target, statChanges, localFrame }) => {
  const { fps } = useVideoConfig();
  const copy = getCopy(target);
  const insight = buildInsight(target, statChanges);
  const cards = buildPracticalCards(target, statChanges, insight);

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: "#C8AA6E", fontSize: 34, fontWeight: 950, letterSpacing: 6 }}>{copy.practicalRead}</div>
      <div style={{ color: "#fff", fontSize: 60, fontWeight: 950, marginTop: 18, textAlign: "center", textWrap: "balance", lineHeight: 1.12 }}>
        {copy.practicalHeadline}
      </div>
      <div style={{ width: "90%", display: "grid", gridTemplateColumns: "1fr", gap: 22, marginTop: 52 }}>
        {cards.map((card, index) => {
          const inAnim = spring({ frame: Math.max(0, localFrame - 18 - index * 10), fps, config: { stiffness: 190, damping: 16 } });
          return (
            <div
              key={`${card.title}-${index}`}
              style={{
                ...glassPanelStyle(index === 1 ? "#C8AA6E" : "#7dd3fc"),
                border: `2px solid ${index === 1 ? "rgba(200,170,110,0.58)" : "rgba(125,211,252,0.45)"}`,
                borderRadius: 24,
                padding: "28px 34px",
                display: "grid",
                gridTemplateColumns: "74px 1fr",
                alignItems: "center",
                gap: 24,
                transform: `translateX(${interpolate(inAnim, [0, 1], [index % 2 ? 84 : -84, 0])}px)`,
                opacity: inAnim,
              }}
            >
              <div
                style={{
                  width: 74,
                  height: 74,
                  borderRadius: 18,
                  background: "linear-gradient(135deg, #C8AA6E, #7dd3fc)",
                  color: "#06101f",
                  fontSize: 36,
                  fontWeight: 950,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 0 28px rgba(125,211,252,0.36)",
                }}
              >
                {index + 1}
              </div>
              <div>
                <div style={{ color: "#f8fafc", fontSize: 42, fontWeight: 950 }}>{card.title}</div>
                <div style={{ color: "#dbeafe", fontSize: 34, fontWeight: 850, lineHeight: 1.28, marginTop: 8 }}>
                  {card.detail}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const ChampionImpactScene = ({ target, synergyImpact, localFrame }) => {
  const { fps } = useVideoConfig();
  const copy = getCopy(target);
  const en = isEnglishVideo(target);
  const champions = getImpactChampions(target, synergyImpact);
  const impactDescription = safeDisplayText(
    getImpactSummary(target),
    copy.noImpactBody,
    { maxChars: en ? 96 : 54 },
  );
  const labels = getImpactLabels(target);

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: "#7dd3fc", fontSize: 33, fontWeight: 950, letterSpacing: 6 }}>{copy.impactedTitle}</div>
      <div style={{ color: "#fff", fontSize: 58, fontWeight: 950, marginTop: 14, textAlign: "center" }}>
        {copy.impactedQuestion}
      </div>
      <div style={{ width: "90%", display: "grid", gridTemplateColumns: "1fr", gap: 20, marginTop: 46 }}>
        {champions.length > 0 ? champions.map((championName, index) => {
          const cardIn = spring({ frame: Math.max(0, localFrame - 18 - index * 11), fps, config: { stiffness: 170, damping: 16 } });
          const liveDetail = safeDisplayText(
            getChampionImpactDetail(target, index),
            en ? "This champion needs a fresh priority check." : "這名英雄需要重新檢查優先級。",
            { maxChars: en ? 88 : 36 },
          );
          return (
            <div
              key={`${championName}-${index}`}
              style={{
                ...glassPanelStyle("#7dd3fc"),
                border: "2px solid rgba(125,211,252,0.48)",
                borderRadius: 26,
                padding: "24px 30px",
                display: "grid",
                gridTemplateColumns: "112px 1fr",
                alignItems: "center",
                gap: 26,
                transform: `translateY(${interpolate(cardIn, [0, 1], [54, 0])}px)`,
                opacity: cardIn,
              }}
            >
              <IconBox src={getChampionIconUrl(championName)} label={championName} size={104} border="#7dd3fc" radius={22} />
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <span
                    style={{
                      color: "#07111f",
                      background: "linear-gradient(90deg, #C8AA6E, #f4d58d)",
                      borderRadius: 999,
                      padding: "7px 14px",
                      fontSize: 20,
                      fontWeight: 950,
                    }}
                  >
                    {labels[index] || (en ? "Impacted" : "受影響")}
                  </span>
                  <span style={{ color: "#fff", fontSize: 39, fontWeight: 950 }}>{localizeChampionName(championName, target)}</span>
                </div>
                <div style={{ color: "#dbeafe", fontSize: 27, fontWeight: 850, lineHeight: 1.32, marginTop: 10 }}>
                  {liveDetail}
                </div>
              </div>
            </div>
          );
        }) : (
          <GlassPanelNotice title={copy.noImpactTitle} body={copy.noImpactBody} />
        )}
      </div>
      <div
        style={{
          width: "90%",
          marginTop: 30,
          padding: "28px 34px",
          ...glassPanelStyle("#C8AA6E"),
          border: "2px solid rgba(200,170,110,0.5)",
          borderRadius: 24,
          color: "#f8fafc",
          fontSize: 34,
          fontWeight: 900,
          lineHeight: 1.34,
          textAlign: "center",
          textWrap: "balance",
          wordBreak: "keep-all",
        }}
      >
        {impactDescription}
      </div>
    </div>
  );
};

const ConclusionScene = ({ target, status, label, localFrame }) => {
  const { fps } = useVideoConfig();
  const copy = getCopy(target);
  const pop = spring({ frame: Math.max(0, localFrame - 14), fps, config: { stiffness: 155, damping: 15 } });
  const verdict = target.actionableVerdict || {};
  const verdictTitle = safeDisplayText(verdict.title || verdict.recommendation, copy.verdictTitle, { maxChars: 18 });
  const verdictBody = formatVerdictBody(verdict.body || verdict.reason || copy.verdictBody, target);
  const chips = safeDisplayList(Array.isArray(verdict.chips) ? verdict.chips : [verdict.timing, verdict.riskLevel].filter(Boolean), [], { maxItems: 3, maxChars: isEnglishVideo(target) ? 14 : 8 });
  const bodyLength = verdictBody.replace(/\n/g, "").length;
  const bodyLines = verdictBody.split("\n").length;
  const bodyFontSize = isEnglishVideo(target)
    ? (bodyLength > 92 ? 44 : bodyLength > 72 ? 50 : 56)
    : (bodyLines >= 3 ? 45 : bodyLength > 40 ? 48 : bodyLength > 32 ? 54 : 62);

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
      <StatusBadge status={status} frameOffset={localFrame} />
      <div style={{ marginTop: 46 }}>
        <ItemPortrait target={target} localFrame={localFrame} />
      </div>
      <div
        style={{
          marginTop: 50,
          width: "88%",
          padding: "42px 34px",
          ...glassPanelStyle(status.color),
          border: `3px solid ${status.color}66`,
          borderRadius: 30,
          textAlign: "center",
          transform: `scale(${interpolate(pop, [0, 1], [0.9, 1])})`,
          opacity: pop,
        }}
      >
        <div style={{ color: "#7dd3fc", fontSize: 27, fontWeight: 950, letterSpacing: 5 }}>{verdictTitle}</div>
        <div
          style={{
            color: "#fff",
            fontSize: bodyFontSize,
            fontWeight: 950,
            lineHeight: 1.16,
            marginTop: 16,
            maxWidth: "100%",
            whiteSpace: "pre-line",
            overflowWrap: "normal",
            wordBreak: "normal",
            textWrap: "balance",
          }}
        >
          {verdictBody}
        </div>
        {chips.length > 0 ? (
          <div style={{ marginTop: 24, display: "flex", justifyContent: "center", gap: 12, flexWrap: "wrap" }}>
            {chips.slice(0, 3).map((chip) => (
              <span
                key={chip}
                style={{
                  color: "#07111f",
                  background: "linear-gradient(90deg, #C8AA6E, #f4d58d)",
                  borderRadius: 999,
                  padding: "8px 15px",
                  fontSize: 22,
                  fontWeight: 950,
                }}
              >
                {chip}
              </span>
            ))}
          </div>
        ) : null}
        <div style={{ color: "#C8AA6E", fontSize: 34, fontWeight: 950, marginTop: 22, textShadow: `0 0 26px ${label.shadow}` }}>
          {label.text}
        </div>
      </div>
    </div>
  );
};

export const Template_ItemUpdate = ({ itemData, data = {} }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const target = normalizeTarget(itemData || data || EMPTY_TARGET);
  const statChanges = target.statChanges;
  const storyboard = buildStoryboard({ ...target, storyboard: target.storyboard });
  const { narrationStart, sceneDurations } = calculatePacing(storyboard, fps);
  const active = getActiveScene(storyboard, sceneDurations, frame, narrationStart, fps);
  const localFrame = Math.max(0, frame - active.start);
  const activeTag = active.scene?.tag || "HOOK";
  const changeType = target.changeType || "ADJUST";
  const statusMap = isEnglishVideo(target) ? tagMap : tagMapZh;
  const status = statusMap[changeType] || statusMap.ADJUST;
  const label = getItemRuneLabel(target);

  const renderScene = () => {
    if (activeTag === "STAT_REVEAL" || activeTag === "SKILL_SHOWCASE") {
      return <StatExplosionScene target={target} statChanges={statChanges} status={status} label={label} localFrame={localFrame} />;
    }

    if (activeTag === "PRACTICAL_READ") {
      return <PracticalReadScene target={target} statChanges={statChanges} localFrame={localFrame} />;
    }

    if (activeTag === "IMPACT") {
      return <ChampionImpactScene target={target} synergyImpact={target.synergyImpact || data.synergyImpact} localFrame={localFrame} />;
    }

    if (activeTag === "CONCLUSION_CTA" || activeTag === "OUTRO") {
      return <ConclusionScene target={target} status={status} label={label} localFrame={localFrame} />;
    }

    return <HookScene target={target} status={status} label={label} localFrame={localFrame} />;
  };

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#07111f",
        color: "#fff",
        fontFamily: "'Outfit', 'Noto Sans TC', sans-serif",
        overflow: "hidden",
      }}
    >
      <Background />
      <div style={{ position: "absolute", inset: "82px 72px 230px" }}>{renderScene()}</div>
      <SubtitleCaption scene={active.scene} activeStart={active.start} accent={status.color} bottom={330} variant="lowerThird" />
    </AbsoluteFill>
  );
};

export const Template_ItemUpdateSequence = ({ data = {} }) => {
  const { fps } = useVideoConfig();
  const targets = getItemRuneTargets(data);
  let cursor = 0;

  return (
    <AbsoluteFill style={{ backgroundColor: "#07111f" }}>
      <Audio src={staticFile(data.bgmFile || "audio/bgm1.mp3")} volume={DEFAULT_BGM_VOLUME} loop={true} />
      {targets.length === 0 ? <Template_ItemUpdate itemData={EMPTY_TARGET} data={data} /> : null}
      {targets.map((target, index) => {
        const storyboard = buildStoryboard(target);
        const { totalFrames } = calculatePacing(storyboard, fps);
        const duration = totalFrames + fps;
        const from = cursor;
        cursor += duration;

        return (
          <Sequence
            key={`${target.targetName || target.localizedName}-${index}`}
            from={from}
            durationInFrames={duration}
            name={`ItemRune[${index}] ${target.localizedName || target.targetName}`}
          >
            <Template_ItemUpdate itemData={target} data={data} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
