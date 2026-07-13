const { execFile } = require("child_process");
const path = require("path");
const fs = require("fs");
const { normalizePipelinePayload } = require("../../src/schemas/pipelineSchemas");
const { assertSupportedDataType } = require("../pipelineRegistry");
const { getChampionEntry, getChampionTWName, getItemEntry, getRuneEntry } = require("../riotLocalization");
const { splitDenseSkillScenes } = require("../patchStoryboard");
const { localizeRemoteImageAssets } = require("./remoteAssetCache");

const DATA_TYPE_TO_COMPOSITION = {
  PATCH: "LeaguePatchVideo",
  SYSTEM_UPDATE: "LeaguePatchVideo",
  PLAYER_RADAR: "PlayerRadarVideo",
  ESPORTS_H2H_RADAR: "EsportsHeadToHeadRadarVideo",
  ESPORTS_MATCH_RECAP: "EsportsMatchRecapVideo",
  ITEM_UPDATE: "ItemUpdateVideo",
  RUNE_UPDATE: "RuneUpdateVideo",
  META_OFFMETA_PICK: "MetaOffmetaVideo",
  META_TIER_RANKING: "MetaTierRankingVideo",
};

const ROLE_MAP = {
  上路: "Top", TOP: "Top", top: "Top",
  打野: "Jungle", JUNGLE: "Jungle", jg: "Jungle", jungle: "Jungle",
  中路: "Mid", MID: "Mid", mid: "Mid",
  下路: "Adc", ADC: "Adc", adc: "Adc", Bottom: "Adc", bottom: "Adc", bot: "Adc",
  輔助: "Support", SUPPORT: "Support", supp: "Support", support: "Support",
};

const META_ROLE_LABELS_ZH = {
  Top: "上路",
  Jungle: "打野",
  Mid: "中路",
  Adc: "下路",
  ADC: "下路",
  Support: "輔助",
};

const META_REGION_LABELS_ZH = {
  global: "全球",
  kr: "韓服",
  na: "北美",
  na1: "北美",
  euw: "歐西",
  euw1: "歐西",
  eune: "歐東",
  eun1: "歐東",
  jp: "日服",
  jp1: "日服",
  tw: "台服",
  tw2: "台服",
  sg: "新加坡服",
  sg2: "新加坡服",
  vn: "越南服",
  vn2: "越南服",
  th: "泰服",
  th2: "泰服",
  ph: "菲律賓服",
  ph2: "菲律賓服",
  br: "巴西服",
  br1: "巴西服",
  lan: "拉丁北服",
  la1: "拉丁北服",
  las: "拉丁南服",
  la2: "拉丁南服",
  oce: "大洋洲服",
  oc1: "大洋洲服",
  ru: "俄服",
  tr: "土耳其服",
  tr1: "土耳其服",
};

const META_RANK_LABELS_ZH = {
  emerald_plus: "翡翠以上",
  "emerald+": "翡翠以上",
  diamond_plus: "鑽石以上",
  "diamond+": "鑽石以上",
  master_plus: "大師以上",
  "master+": "大師以上",
  all_ranks: "全分段",
  "all ranks": "全分段",
};

const META_TOPIC_LABELS_ZH = {
  "Off-role tech": "位置黑科技",
  "Off-role pick": "非主流位置",
  "Build / rune tech": "出裝 / 符文黑科技",
  "Build tech": "出裝黑科技",
  "Rune tech": "符文黑科技",
  "Build signal": "出裝訊號",
};

const cloneJson = (value) => JSON.parse(JSON.stringify(value || {}));
const isEnglish = (locale = "zh") => String(locale || "zh").toLowerCase().startsWith("en");
const getRenderTimeoutMs = () => Math.max(30000, Number(process.env.REMOTION_RENDER_TIMEOUT_MS || 120000));
const getRenderVideoBitrate = () => {
  const value = String(process.env.REMOTION_VIDEO_BITRATE || "8M").trim();
  return /^[0-9]+[kKmM]?$/.test(value) ? value : "8M";
};

const stripRenderControlFields = (payload = {}) => {
  const next = { ...payload };
  delete next.localizedPayloads;
  delete next.renderLanguages;
  delete next.bilingual;
  delete next.generateBilingual;
  delete next.outputLanguages;
  return next;
};

const getPayloadForLanguage = (requestData = {}, locale = "zh") => {
  const localized = requestData.localizedPayloads?.[locale] || requestData.localizedPayloads?.[locale.slice(0, 2)];
  const source = localized ? { ...requestData, ...localized } : requestData;
  return { ...stripRenderControlFields(cloneJson(source)), locale, outputLanguage: locale };
};

const execRender = (executable, args, options) => new Promise((resolve) => {
  execFile(executable, args, options, (error) => resolve(error));
});

async function ensurePatchLocalization(props) {
  if (props.dataType !== "PATCH" || isEnglish(props.locale)) return props;
  if (!props.championName || props.localizedChampionName) return props;

  try {
    const twName = await getChampionTWName(props.championName);
    if (twName && twName !== props.championName) {
      props.localizedChampionName = twName;
    }
  } catch (error) {
    console.warn(`⚠️ [Localization] Champion zh_TW lookup failed for ${props.championName}: ${error.message}`);
  }

  return props;
}

function replaceChampionNameInText(value, englishName, localizedName) {
  if (typeof value !== "string" || !englishName || !localizedName || englishName === localizedName) return value;
  return value.split(englishName).join(localizedName);
}

function replaceVisibleMetaText(props, replacements = []) {
  const replaceText = (value) => replacements.reduce(
    (next, [englishName, localizedName]) => replaceChampionNameInText(next, englishName, localizedName),
    value
  );
  props.title = replaceText(props.title);
  props.recommendedStoryAngle = replaceText(props.recommendedStoryAngle);
  props.subtitleScriptText = replaceText(props.subtitleScriptText);
  if (Array.isArray(props.storyboard)) {
    props.storyboard = props.storyboard.map((scene) => ({
      ...scene,
      text: replaceText(scene.text),
    }));
  }
  if (Array.isArray(props.playerTakeaways)) {
    props.playerTakeaways = props.playerTakeaways.map((item) => ({
      ...item,
      body: replaceText(item.body),
    }));
  }
  return props;
}

function normalizeMetaRoleLabel(value = "") {
  const canonical = ROLE_MAP[value] || ROLE_MAP[String(value || "").toLowerCase()] || value;
  return META_ROLE_LABELS_ZH[canonical] || META_ROLE_LABELS_ZH[value] || String(value || "中路");
}

function normalizeMetaRegionLabel(value = "") {
  const key = String(value || "global").toLowerCase();
  return META_REGION_LABELS_ZH[key] || "指定伺服器";
}

function normalizeMetaRankLabel(value = "") {
  const key = String(value || "emerald_plus").toLowerCase();
  return META_RANK_LABELS_ZH[key] || "指定分段";
}

function normalizeMetaTopicLabel(value = "", offmetaType = "") {
  if (META_TOPIC_LABELS_ZH[value]) return META_TOPIC_LABELS_ZH[value];
  if (String(offmetaType || "") === "OFFMETA_BUILD") return "出裝 / 符文黑科技";
  return String(value || "位置黑科技");
}

function ensureMetaContextLocalization(props) {
  if (props.dataType !== "META_OFFMETA_PICK" || isEnglish(props.locale)) return props;

  const roleLabel = normalizeMetaRoleLabel(props.roleLabel || props.versionOverview?.role || props.role);
  const regionLabel = normalizeMetaRegionLabel(props.versionOverview?.region || props.region);
  const rankLabel = normalizeMetaRankLabel(props.versionOverview?.rankPreset || props.rankPreset);
  const topicLabel = normalizeMetaTopicLabel(props.topicFrame || props.offmetaTypeLabel || props.versionOverview?.techType, props.offmetaType);

  props.roleLabel = roleLabel;
  props.topicFrame = topicLabel;
  props.offmetaTypeLabel = topicLabel;
  props.versionOverview = {
    ...(props.versionOverview || {}),
    patch: props.versionOverview?.patch || props.patch || "",
    region: regionLabel,
    rankPreset: rankLabel,
    role: roleLabel,
    techType: normalizeMetaTopicLabel(props.versionOverview?.techType || topicLabel, props.offmetaType),
  };

  replaceVisibleMetaText(props, [
    ["Build / rune tech", "出裝 / 符文黑科技"],
    ["Off-role tech", "位置黑科技"],
    ["Off-role pick", "非主流位置"],
    ["Build signal", "出裝訊號"],
    ["Build tech", "出裝黑科技"],
    ["Rune tech", "符文黑科技"],
    ["Emerald+", "翡翠以上"],
    ["Diamond+", "鑽石以上"],
    ["Master+", "大師以上"],
    ["All ranks", "全分段"],
    ["Global", "全球"],
    ["KR", "韓服"],
    ["NA", "北美"],
    ["EUW", "歐西"],
    ["EUNE", "歐東"],
    ["JP", "日服"],
    ["TW", "台服"],
    ["SG", "新加坡服"],
    ["VN", "越南服"],
    ["TH", "泰服"],
    ["PH", "菲律賓服"],
    ["BR", "巴西服"],
    ["LAN", "拉丁北服"],
    ["LAS", "拉丁南服"],
    ["OCE", "大洋洲服"],
    ["RU", "俄服"],
    ["TR", "土耳其服"],
    ["Support", "輔助"],
    ["Jungle", "打野"],
    ["Mid", "中路"],
    ["Top", "上路"],
    ["ADC", "下路"],
  ]);

  return props;
}

async function ensureMetaLocalization(props) {
  if (props.dataType !== "META_OFFMETA_PICK" || isEnglish(props.locale)) return props;
  if (!props.champion || props.localizedChampionName) return props;

  try {
    const twName = await getChampionTWName(props.champion);
    if (!twName || twName === props.champion) return props;

    props.localizedChampionName = twName;
    props.displayChampionName = twName;
    replaceVisibleMetaText(props, [[props.champion, twName]]);
  } catch (error) {
    console.warn(`⚠️ [Localization] Meta champion zh_TW lookup failed for ${props.champion}: ${error.message}`);
  }

  return props;
}

async function localizeMetaOptionList(values = [], lookupEntry, label) {
  const localized = [];
  const replacements = [];
  for (const item of values) {
    const nextItem = { ...item };
    try {
      const entry = await lookupEntry(item.name);
      if (entry) {
        if (entry.twName && entry.twName !== item.name) {
          replacements.push([item.name, entry.twName]);
          nextItem.name = entry.twName;
        }
        nextItem.iconUrl = nextItem.iconUrl || entry.iconUrl || "";
      }
    } catch (error) {
      console.warn(`⚠️ [Localization] Meta ${label} zh_TW lookup failed for ${item.name}: ${error.message}`);
    }
    localized.push(nextItem);
  }
  return { localized, replacements };
}

async function ensureMetaGameplayLocalization(props) {
  if (props.dataType !== "META_OFFMETA_PICK" || isEnglish(props.locale)) return props;
  const replacements = [];

  if (Array.isArray(props.coreItems) && props.coreItems.length > 0) {
    const result = await localizeMetaOptionList(props.coreItems, getItemEntry, "item");
    props.coreItems = result.localized;
    replacements.push(...result.replacements);
  }
  if (Array.isArray(props.coreRunes) && props.coreRunes.length > 0) {
    const result = await localizeMetaOptionList(props.coreRunes, getRuneEntry, "rune");
    props.coreRunes = result.localized;
    replacements.push(...result.replacements);
  }
  if (replacements.length > 0) {
    replaceVisibleMetaText(props, replacements);
  }
  return props;
}

async function ensureMetaTierLocalization(props) {
  if (props.dataType !== "META_TIER_RANKING" || isEnglish(props.locale)) return props;
  if (!Array.isArray(props.entries) || props.entries.length === 0) return props;

  const nextEntries = [];
  for (const entry of props.entries) {
    const nextEntry = { ...entry };
    try {
      const champion = await getChampionEntry(entry.champion);
      if (champion) {
        nextEntry.localizedChampionName = champion.twName || entry.champion;
        nextEntry.heroIconUrl = nextEntry.heroIconUrl || champion.iconUrl || "";
      }
    } catch (error) {
      console.warn(`⚠️ [Localization] Meta tier champion zh_TW lookup failed for ${entry.champion}: ${error.message}`);
    }
    nextEntries.push(nextEntry);
  }
  props.entries = nextEntries;
  return props;
}

async function prepareProps(rawProps) {
  let props = cloneJson(rawProps);
  assertSupportedDataType(props.dataType || "PATCH");

  const normalized = normalizePipelinePayload(props);
  if (normalized.issues.length > 0) {
    console.warn(
      `⚠️ [Render Schema Contract] ${props.dataType || "UNKNOWN"} normalized with ${normalized.issues.length} issue(s): ` +
      normalized.issues.map((issue) => `${issue.path.join(".") || "(root)"}:${issue.message}`).slice(0, 4).join(" | ")
    );
  }
  props = normalized.data;
  props.locale = rawProps.locale || props.locale || "zh";
  props.outputLanguage = rawProps.outputLanguage || props.locale;
  props = await ensurePatchLocalization(props);
  props = await ensureMetaLocalization(props);
  props = await ensureMetaGameplayLocalization(props);
  props = ensureMetaContextLocalization(props);
  props = await ensureMetaTierLocalization(props);
  if (props.dataType === "PATCH" && Array.isArray(props.storyboard)) {
    props.storyboard = splitDenseSkillScenes(props.storyboard, {
      locale: props.locale,
      maxMetricsPerScene: 2,
    });
  }

  if (props.bgmFile === null) {
    console.log("🎵 [BGM] muted; no user audio supplied");
  } else {
    console.log(`🎵 [BGM] using caller-provided: ${props.bgmFile}`);
  }

  return props;
}

async function renderOne(rawProps, {
  timestamp,
  locale,
  suffix,
  execRenderImpl = execRender,
  assetFetchImpl,
} = {}) {
  const rendersDir = path.join(process.cwd(), "public", "renders");
  fs.mkdirSync(rendersDir, { recursive: true });

  const props = await localizeRemoteImageAssets(await prepareProps(rawProps), {
    fetchImpl: assetFetchImpl,
  });
  const outputFileName = suffix ? `render_${timestamp}_${suffix}.mp4` : `render_${timestamp}.mp4`;
  const outputPath = path.join(rendersDir, outputFileName);
  const propsFilePath = path.join(rendersDir, `props_${timestamp}${suffix ? `_${suffix}` : ""}.json`);
  const finalProps = { data: props };
  const entryPoint = path.join(process.cwd(), "src", "index.jsx");
  const compositionId = DATA_TYPE_TO_COMPOSITION[props.dataType];
  if (!compositionId) {
    throw new Error(`No render composition registered for data type: ${props.dataType}`);
  }

  fs.writeFileSync(propsFilePath, JSON.stringify(finalProps), "utf8");
  const args = [
    "remotion",
    "render",
    entryPoint,
    compositionId,
    outputPath,
    `--props=${propsFilePath}`,
    `--timeout=${getRenderTimeoutMs()}`,
    `--video-bitrate=${getRenderVideoBitrate()}`,
  ];
  const executionOptions = {
    cwd: process.cwd(),
    maxBuffer: 1024 * 1024 * 50,
    shell: false,
  };

  console.log(`🚀 [系統] 開始執行 Remotion 算圖: ${compositionId} (${locale})...`);
  const error = await execRenderImpl("npx", args, executionOptions);
  try { fs.unlinkSync(propsFilePath); } catch {}

  if (error) {
    console.error("❌ 算圖失敗:", error);
    throw error;
  }

  return {
    locale,
    label: isEnglish(locale) ? "English" : "中文版",
    videoUrl: `/renders/${outputFileName}`,
    fileName: outputFileName,
  };
}

async function renderVideosFromRequest(requestData = {}, options = {}) {
  const timestamp = options.timestamp || Date.now();
  const requestedLanguages = Array.isArray(requestData.renderLanguages)
    ? requestData.renderLanguages.filter(Boolean).map((lang) => String(lang).toLowerCase().startsWith("en") ? "en" : "zh")
    : (requestData.bilingual || requestData.generateBilingual ? ["zh", "en"] : [requestData.locale || "zh"]);
  const languages = [...new Set(requestedLanguages)].slice(0, 2);
  const videos = [];
  for (const lang of languages) {
    const payload = getPayloadForLanguage(requestData, lang);
    videos.push(await renderOne(payload, {
      timestamp,
      locale: lang,
      suffix: languages.length > 1 ? lang : "",
      execRenderImpl: options.execRenderImpl,
      assetFetchImpl: options.assetFetchImpl,
    }));
  }

  return {
    success: true,
    videoUrl: videos[0]?.videoUrl,
    fileName: videos[0]?.fileName,
    videos,
  };
}

module.exports = {
  DATA_TYPE_TO_COMPOSITION,
  getPayloadForLanguage,
  prepareProps,
  renderOne,
  renderVideosFromRequest,
};
