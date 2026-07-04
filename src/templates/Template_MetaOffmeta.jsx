import React from "react";
import { AbsoluteFill, Img, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { BgmLayer } from "../video-system/BgmLayer";
import { SubtitleCaption } from "../video-system/SubtitleCaption";
import { buildTimeline, getActiveTimelineScene } from "../video-system/pacing";
import { resolveRenderAssetSrc } from "../video-system/renderAssetSrc";
import {
  KineticTitle,
  PipelineBadge,
  PipelineChrome,
  SafeStage,
  getPipelineTheme,
} from "../video-system/VideoPrimitives";

const LOL_GOLD = "#c8aa6e";
const LOL_GOLD_LIGHT = "#f0e6d2";
const LOL_BLUE = "#071323";
const LOL_BLUE_DEEP = "#020711";
const MAGIC_CYAN = "#0ac8b9";
const DANGER_GOLD = "#d9a441";
const META_OFFMETA_SUBTITLE_BOTTOM = 300;
const META_OFFMETA_STAGE_INSET = "112px 90px 230px";
const META_OFFMETA_INTRO_TITLE_SIZE = 72;
const META_OFFMETA_INTRO_BODY_SIZE = 30;
const META_OFFMETA_RAIL_VALUE_SIZE = 28;

const ROLE_LABELS_ZH = {
  Top: "上路",
  Jungle: "打野",
  Mid: "中路",
  ADC: "下路",
  Support: "輔助",
};

const OFFMETA_TYPE_LABELS = {
  OFFROLE_PICK: { zh: "位置黑科技", en: "Off-role tech" },
  OFFMETA_BUILD: { zh: "出裝 / 符文黑科技", en: "Build / rune tech" },
};

const REGION_LABELS_ZH = {
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

const RANK_LABELS_ZH = {
  emerald_plus: "翡翠以上",
  "emerald+": "翡翠以上",
  diamond_plus: "鑽石以上",
  "diamond+": "鑽石以上",
  master_plus: "大師以上",
  "master+": "大師以上",
  all_ranks: "全分段",
  "all ranks": "全分段",
};

const TOPIC_LABELS_ZH = {
  "Off-role tech": "位置黑科技",
  "Off-role pick": "非主流位置",
  "Build / rune tech": "出裝 / 符文黑科技",
  "Build tech": "出裝黑科技",
  "Rune tech": "符文黑科技",
  "Build signal": "出裝訊號",
};

const VISIBLE_ZH_REPLACEMENTS = [
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
];

function isEnglishVideo(data = {}) {
  return String(data.locale || data.outputLanguage || "zh").toLowerCase().startsWith("en");
}

function getRoleLabel(role = "Mid", locale = "zh") {
  return isEnglishVideo({ locale }) ? role || "Mid" : ROLE_LABELS_ZH[role] || role || "中路";
}

const hasAsciiLetters = (value = "") => /[A-Za-z]/.test(String(value || ""));

const localizeZhVisibleText = (value = "") => VISIBLE_ZH_REPLACEMENTS.reduce(
  (text, [source, target]) => String(text || "").split(source).join(target),
  String(value || "")
);

const replaceZhChampionName = (value = "", data = {}) => {
  const source = data.champion;
  const target = data.localizedChampionName || data.displayChampionName;
  if (!source || !target || source === target) return String(value || "");
  return String(value || "").split(source).join(target);
};

const localizeZhRegion = (value = "") => {
  const raw = String(value || "global");
  const label = REGION_LABELS_ZH[raw.toLowerCase()];
  if (label) return label;
  return hasAsciiLetters(raw) ? "指定伺服器" : raw;
};

const localizeZhRank = (value = "") => {
  const raw = String(value || "");
  if (!raw) return "未指定";
  const label = RANK_LABELS_ZH[raw.toLowerCase()];
  if (label) return label;
  return hasAsciiLetters(raw) ? "指定分段" : raw;
};

const localizeZhTopic = (value = "") => {
  const raw = String(value || "黑科技題材");
  const label = TOPIC_LABELS_ZH[raw];
  if (label) return label;
  return hasAsciiLetters(raw) ? "黑科技題材" : raw;
};

const localizeZhRole = (value = "") => ROLE_LABELS_ZH[value] || (
  hasAsciiLetters(value) ? localizeZhVisibleText(value) : String(value || "中路")
);

const sanitizeStoryboardForLocale = (storyboard = [], data = {}) => {
  if (isEnglishVideo(data)) return storyboard;
  return storyboard.map((scene) => ({
    ...scene,
    text: localizeZhVisibleText(replaceZhChampionName(scene?.text || "", data)),
  }));
};

function getOffmetaTypeLabel(type = "OFFROLE_PICK", locale = "zh") {
  const labels = OFFMETA_TYPE_LABELS[type] || OFFMETA_TYPE_LABELS.OFFROLE_PICK;
  return isEnglishVideo({ locale }) ? labels.en : labels.zh;
}

function formatInteger(value = 0) {
  return new Intl.NumberFormat("en-US").format(Math.round(Number(value) || 0));
}

function formatPercent(value = 0) {
  const number = Number(value || 0);
  return Number.isInteger(number) ? `${number}%` : `${number.toFixed(1)}%`;
}

function getOffmetaTemplateCopy(data = {}) {
  const en = isEnglishVideo(data);
  return en ? {
    chromeLeft: "PATCH TECH BRIEF",
    chromeRight: "BUILD / TEST PLAN",
    badge: data.topicFrame || "Off-meta tech",
    championFallback: "Champion",
    roleLabel: data.roleLabel || getRoleLabel(data.role, "en"),
    offmetaTypeLabel: data.offmetaTypeLabel || getOffmetaTypeLabel(data.offmetaType, "en"),
    defaultSubtitle: "Read the setup, then decide if it deserves a test game.",
    scanTitle: "Patch Tech Scan",
    scanBody: "Lock the patch context first. The pick comes after the conditions.",
    loadoutTitle: "Core Setup",
    tryLabel: "Try when",
    skipLabel: "Skip when",
  } : {
    chromeLeft: "版本黑科技",
    chromeRight: "玩法實驗室",
    badge: localizeZhTopic(data.topicFrame || "黑科技題材"),
    championFallback: "英雄",
    roleLabel: localizeZhRole(data.roleLabel || getRoleLabel(data.role, "zh")),
    offmetaTypeLabel: localizeZhTopic(data.offmetaTypeLabel || getOffmetaTypeLabel(data.offmetaType, "zh")),
    defaultSubtitle: "先看這套在打什麼節奏，再決定要不要拿去測。",
    scanTitle: "版本黑科技掃描",
    scanBody: "先鎖定版本條件，再進英雄與玩法。",
    loadoutTitle: "核心玩法起手",
    tryLabel: "可以試",
    skipLabel: "先別抄",
  };
}

function fallbackPlayerStats(data = {}) {
  const en = isEnglishVideo(data);
  return [
    { label: en ? "Win" : "勝率", value: data.winRate ? formatPercent(data.winRate) : "-" },
    { label: en ? "Pick" : "登場率", value: data.pickRate ? formatPercent(data.pickRate) : "-" },
    { label: en ? "Sample" : "樣本", value: formatInteger(data.sampleSize || 0) },
  ];
}

const fallbackTakeaways = (data = {}, copy = getOffmetaTemplateCopy(data)) => {
  const champion = data.localizedChampionName || data.displayChampionName || data.champion || copy.championFallback;
  const itemName = data.coreItems?.[0]?.name;
  const runeName = data.coreRunes?.[0]?.name;
  if (isEnglishVideo(data)) {
    return [
      { label: "Game plan", body: itemName || runeName ? `${champion} changes rhythm with ${[itemName, runeName].filter(Boolean).join(" + ")}.` : `${champion} is the off-role angle. Matchup comes first.` },
      { label: "Try when", body: "You know the champion and can test the first waves without forcing ranked." },
      { label: "Do not force", body: "Skip it when lane matchup or team comp cannot support the plan." },
    ];
  }
  return [
    { label: "打法節奏", body: itemName || runeName ? `${champion}用 ${[itemName, runeName].filter(Boolean).join(" + ")} 改節奏。` : `${champion}是位置黑科技，先看對線能不能成立。` },
    { label: "適合嘗試", body: "你熟這隻英雄，能先用一般對局測前兩波節奏。" },
    { label: "不要盲抄", body: "對線不熟、隊伍不搭，或第一波節奏不對就別硬拿。" },
  ];
};

const fallbackStoryboard = (data = {}) => {
  if (data.storyboard?.length) return data.storyboard;
  const copy = getOffmetaTemplateCopy(data);
  const champion = data.localizedChampionName || data.displayChampionName || data.champion || copy.championFallback;
  const overview = data.versionOverview || {};
  if (isEnglishVideo(data)) {
    const region = overview.region ?? "Global";
    const rankPreset = overview.rankPreset ?? "Ranked";
    return [
      { tag: "VERSION_OVERVIEW", text: `${overview.patch || "Current patch"} ${region}\n${rankPreset} ${copy.roleLabel}`, durationInFrames: 90 },
      { tag: "CORE_TECH", text: `${champion} ${copy.roleLabel}\n${copy.badge}`, durationInFrames: 120 },
      { tag: "TEST_PLAN", text: "Check the setup\nbefore ranked", durationInFrames: 120 },
      { tag: "CONCLUSION_CTA", text: "Would you test it?\nComment your read", durationInFrames: 90 },
    ];
  }
  const region = localizeZhRegion(overview.region ?? data.region);
  const rankPreset = localizeZhRank(overview.rankPreset ?? data.rankPreset);
  return [
    { tag: "VERSION_OVERVIEW", text: `${overview.patch || "目前版本"} ${region}\n${rankPreset} ${copy.roleLabel}`, durationInFrames: 90 },
    { tag: "CORE_TECH", text: `${champion} ${copy.roleLabel}\n${copy.badge}`, durationInFrames: 120 },
    { tag: "TEST_PLAN", text: "先看核心玩法\n再決定要不要抄", durationInFrames: 120 },
    { tag: "CONCLUSION_CTA", text: "你會拿去測嗎\n留言告訴我", durationInFrames: 90 },
  ];
};

const clampText = (value = "", maxLength = 54) => {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
};

const getTakeaway = (items = [], labelIncludes = [], fallback = "") => {
  const found = items.find((item) => labelIncludes.some((label) => String(item?.label || "").includes(label)));
  return found?.body || fallback;
};

const getOverviewItems = (versionOverview = {}, copy, locale = "zh") => {
  const en = isEnglishVideo({ locale });
  return [
    ["版本", versionOverview.patch || (en ? "Current patch" : "目前版本")],
    ["伺服器", en ? (versionOverview.region ?? "Global") : localizeZhRegion(versionOverview.region)],
    ["分段", en ? (versionOverview.rankPreset ?? "Ranked") : localizeZhRank(versionOverview.rankPreset)],
    ["位置", en ? (versionOverview.role || copy.roleLabel) : localizeZhRole(versionOverview.role || copy.roleLabel)],
    ["題材", en ? (versionOverview.techType || copy.badge) : localizeZhTopic(versionOverview.techType || copy.badge)],
  ];
};

const getCoreOptions = (data = {}) => [
  ...(Array.isArray(data.coreItems) ? data.coreItems : []),
  ...(Array.isArray(data.coreRunes) ? data.coreRunes : []),
].filter((item) => item?.name).slice(0, 4);

const CinematicBackdrop = ({ championArt, activeTag, theme }) => {
  const frame = useCurrentFrame();
  const zoom = interpolate(frame, [0, 485], [1.04, 1.16], { extrapolateRight: "clamp" });
  const showChampion = Boolean(championArt);
  const championFilter = activeTag === "VERSION_OVERVIEW"
    ? "brightness(0.34) saturate(0.95) contrast(1.08) blur(1.2px)"
    : "brightness(0.58) saturate(1.1) contrast(1.1)";
  const championOpacity = activeTag === "VERSION_OVERVIEW" ? 0.44 : 1;

  return (
    <AbsoluteFill style={{ backgroundColor: LOL_BLUE_DEEP, overflow: "hidden" }}>
      <AbsoluteFill
        style={{
          background: [
            `linear-gradient(180deg, ${LOL_BLUE} 0%, ${LOL_BLUE_DEEP} 78%)`,
            "radial-gradient(ellipse at 50% 38%, rgba(22,101,52,0.22), transparent 44%)",
            "radial-gradient(ellipse at 50% 18%, rgba(200,170,110,0.12), transparent 36%)",
            "linear-gradient(120deg, rgba(10,200,185,0.10), transparent 46%, rgba(200,170,110,0.08))",
          ].join(", "),
        }}
      />
      {showChampion ? (
        <AbsoluteFill style={{ transform: `scale(${zoom})`, transformOrigin: "50% 28%", opacity: championOpacity }}>
          <Img
            src={resolveRenderAssetSrc(championArt)}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: activeTag === "VERSION_OVERVIEW" ? "center 30%" : "center 22%",
              filter: championFilter,
            }}
          />
        </AbsoluteFill>
      ) : null}
      <AbsoluteFill
        style={{
          backgroundImage:
            "linear-gradient(rgba(200,170,110,0.055) 1px, transparent 1px), linear-gradient(90deg, rgba(10,200,185,0.045) 1px, transparent 1px)",
          backgroundSize: "96px 96px",
          opacity: activeTag === "VERSION_OVERVIEW" ? 0.22 : 0.18,
        }}
      />
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(90deg, rgba(2,7,17,0.96), rgba(2,7,17,0.16) 34%, rgba(2,7,17,0.2) 66%, rgba(2,7,17,0.94)), linear-gradient(180deg, rgba(2,7,17,0.54), rgba(2,7,17,0.18) 44%, rgba(2,7,17,0.94))",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 42,
          border: activeTag === "VERSION_OVERVIEW" ? `1.5px solid ${LOL_GOLD}66` : `2px solid ${LOL_GOLD}aa`,
          boxShadow: activeTag === "VERSION_OVERVIEW"
            ? `0 0 34px ${MAGIC_CYAN}18, inset 0 0 78px rgba(0,0,0,0.62)`
            : `0 0 40px ${MAGIC_CYAN}22, inset 0 0 72px rgba(0,0,0,0.74)`,
          clipPath: activeTag === "VERSION_OVERVIEW" ? undefined : "polygon(34px 0, 100% 0, 100% calc(100% - 34px), calc(100% - 34px) 100%, 0 100%, 0 34px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 62,
          top: 84,
          width: 90,
          height: 3,
          background: `linear-gradient(90deg, ${theme.accent}, transparent)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          right: 62,
          bottom: 92,
          width: 110,
          height: 3,
          background: `linear-gradient(90deg, transparent, ${LOL_GOLD})`,
        }}
      />
    </AbsoluteFill>
  );
};

const MetadataRail = ({ items = [], align = "left" }) => (
  <div
    style={{
      display: "flex",
      justifyContent: align === "center" ? "center" : "flex-start",
      gap: 24,
      flexWrap: "wrap",
    }}
  >
    {items.map(([label, value]) => (
      <div key={`${label}-${value}`} style={{ minWidth: 118 }}>
        <div style={{ color: "rgba(240,230,210,0.52)", fontSize: 19, fontWeight: 850, letterSpacing: 2 }}>{label}</div>
        <div style={{ color: LOL_GOLD_LIGHT, fontSize: META_OFFMETA_RAIL_VALUE_SIZE, fontWeight: 950, marginTop: 6, lineHeight: 1.02 }}>{value}</div>
      </div>
    ))}
  </div>
);

const VersionScanScene = ({ versionOverview, copy, theme, active, locale }) => {
  const { fps } = useVideoConfig();
  const enter = spring({ frame: active.localFrame + 18, fps, config: { stiffness: 95, damping: 18 } });
  return (
    <section
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        gap: 34,
        textAlign: "center",
        transform: `translateY(${interpolate(enter, [0, 1], [28, 0])}px)`,
        opacity: enter,
      }}
    >
      <div style={{ color: LOL_GOLD, fontSize: 24, fontWeight: 950, letterSpacing: 7 }}>{copy.chromeLeft}</div>
      <div style={{ maxWidth: 860 }}>
        <h1 style={{ margin: 0, color: "#fff", fontSize: META_OFFMETA_INTRO_TITLE_SIZE, fontWeight: 950, lineHeight: 1.02, letterSpacing: 0 }}>
          {copy.scanTitle}
        </h1>
        <p style={{ width: 780, maxWidth: "100%", margin: "22px auto 0", color: "#f1d38b", fontSize: META_OFFMETA_INTRO_BODY_SIZE, fontWeight: 850, lineHeight: 1.28 }}>
          {copy.scanBody}
        </p>
      </div>
      <MetadataRail items={getOverviewItems(versionOverview, copy, locale)} align="center" />
    </section>
  );
};

const StatRail = ({ stats = [] }) => (
  <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 22 }}>
    {stats.slice(0, 3).map((stat) => (
      <div
        key={stat.label}
        style={{
          minWidth: 118,
          padding: "10px 12px",
          borderTop: `1px solid ${LOL_GOLD}88`,
          background: "linear-gradient(180deg, rgba(4,10,18,0.68), rgba(4,10,18,0.2))",
          textAlign: "center",
        }}
      >
        <div style={{ color: "rgba(240,230,210,0.58)", fontSize: 16, fontWeight: 900 }}>{stat.label}</div>
        <div style={{ color: "#f4d58d", fontSize: 28, fontWeight: 950, marginTop: 2 }}>{stat.value}</div>
      </div>
    ))}
  </div>
);

const HeroRevealScene = ({ copy, data, titleText, active, playerStats, theme }) => (
  <section
    style={{
      height: "100%",
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      alignItems: "center",
      paddingBottom: 42,
      textAlign: "center",
    }}
  >
    <PipelineBadge theme={theme} localFrame={active.localFrame}>{copy.badge}</PipelineBadge>
    <div style={{ marginTop: 20 }}>
      <KineticTitle
        eyebrow={`${copy.roleLabel} · ${copy.offmetaTypeLabel}`}
        title={titleText}
        subtitle={clampText(data.recommendedStoryAngle || copy.defaultSubtitle, 64)}
        theme={{ ...theme, accent: LOL_GOLD, secondary: "#f1d38b" }}
        localFrame={active.localFrame}
        size={72}
      />
    </div>
    <StatRail stats={playerStats} />
  </section>
);

const LoadoutOption = ({ item, index }) => {
  const { fps } = useVideoConfig();
  const frame = useCurrentFrame();
  const enter = spring({ frame: Math.max(0, frame - 96 - index * 7), fps, config: { stiffness: 130, damping: 18 } });
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "62px 1fr",
        alignItems: "center",
        gap: 16,
        minHeight: 82,
        padding: "10px 14px",
        border: `1px solid ${LOL_GOLD}55`,
        background: "linear-gradient(90deg, rgba(4,10,18,0.78), rgba(12,27,43,0.38))",
        transform: `translateY(${interpolate(enter, [0, 1], [20, 0])}px)`,
        opacity: enter,
      }}
    >
      <div
        style={{
          width: 62,
          height: 62,
          display: "grid",
          placeItems: "center",
          border: `1px solid ${LOL_GOLD}99`,
          background: "rgba(2,7,17,0.78)",
          boxShadow: `0 0 18px ${MAGIC_CYAN}22`,
        }}
      >
        {item.iconUrl ? (
          <Img src={resolveRenderAssetSrc(item.iconUrl)} style={{ width: 54, height: 54, objectFit: "cover" }} />
        ) : (
          <span style={{ color: LOL_GOLD, fontSize: 25, fontWeight: 950 }}>{String(item.name || "?").slice(0, 1)}</span>
        )}
      </div>
      <div>
        <div style={{ color: "#fff", fontSize: 30, fontWeight: 950, lineHeight: 1.05 }}>{item.name}</div>
        {item.sampleSize ? (
          <div style={{ color: "rgba(240,230,210,0.58)", fontSize: 17, fontWeight: 850, marginTop: 5 }}>樣本 {formatInteger(item.sampleSize)}</div>
        ) : null}
      </div>
    </div>
  );
};

const EmptyLoadoutPanel = ({ body }) => (
  <div
    style={{
      maxWidth: 900,
      padding: "26px 30px",
      border: `1.5px solid ${LOL_GOLD}88`,
      background: "linear-gradient(180deg, rgba(5,13,24,0.84), rgba(5,13,24,0.46))",
      boxShadow: `0 22px 46px rgba(0,0,0,0.36), inset 0 1px 0 rgba(255,255,255,0.08)`,
    }}
  >
    <div style={{ color: LOL_GOLD, fontSize: 24, fontWeight: 950, letterSpacing: 4 }}>玩法重點</div>
    <div style={{ color: "#fff", fontSize: 35, fontWeight: 900, lineHeight: 1.26, marginTop: 14 }}>
      {clampText(body, 56)}
    </div>
  </div>
);

const CoreLoadoutScene = ({ copy, data, titleText, playerTakeaways }) => {
  const options = getCoreOptions(data);
  const plan = getTakeaway(playerTakeaways, ["打法", "Game plan"], data.recommendedStoryAngle || copy.defaultSubtitle);
  return (
    <section
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: 30,
        maxWidth: 900,
      }}
    >
      <div>
        <div style={{ color: LOL_GOLD, fontSize: 23, fontWeight: 950, letterSpacing: 6 }}>{copy.loadoutTitle}</div>
        <h2 style={{ margin: "14px 0 0", color: "#fff", fontSize: 68, fontWeight: 950, lineHeight: 1 }}>{titleText}</h2>
        <p style={{ width: 850, maxWidth: "100%", margin: "18px 0 0", color: "#f1d38b", fontSize: 31, fontWeight: 850, lineHeight: 1.24 }}>
          {clampText(plan, 58)}
        </p>
      </div>
      <div style={{ alignSelf: "start", display: "grid", gap: 12 }}>
        {options.length > 0 ? options.map((item, index) => <LoadoutOption key={`${item.name}-${index}`} item={item} index={index} />) : (
          <EmptyLoadoutPanel body={plan} />
        )}
      </div>
    </section>
  );
};

const JudgmentCard = ({ label, body, tone = "try" }) => {
  const accent = tone === "try" ? LOL_GOLD : DANGER_GOLD;
  return (
    <div
      style={{
        minHeight: 278,
        padding: "30px 30px 34px",
        border: `1.5px solid ${accent}88`,
        background: "linear-gradient(180deg, rgba(5,13,24,0.86), rgba(5,13,24,0.48))",
        boxShadow: `0 24px 54px rgba(0,0,0,0.34), inset 0 1px 0 rgba(255,255,255,0.08)`,
      }}
    >
      <div style={{ color: accent, fontSize: 28, fontWeight: 950, letterSpacing: 4 }}>{label}</div>
      <div style={{ color: "#fff", fontSize: 35, fontWeight: 900, lineHeight: 1.24, marginTop: 24 }}>{clampText(body, 50)}</div>
    </div>
  );
};

const TryOrSkipScene = ({ copy, playerTakeaways, titleText }) => {
  const tryText = getTakeaway(playerTakeaways, ["適合", "Try"], copy.defaultSubtitle);
  const skipText = getTakeaway(playerTakeaways, ["不要", "Do not", "Skip"], "不熟對線或隊伍不搭，就先別拿去排位。");
  return (
    <section
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: 34,
      }}
    >
      <div>
        <div style={{ color: LOL_GOLD, fontSize: 23, fontWeight: 950, letterSpacing: 6 }}>實戰判斷</div>
        <h2 style={{ margin: "14px 0 0", color: "#fff", fontSize: 68, fontWeight: 950, lineHeight: 1 }}>{titleText}</h2>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
        <JudgmentCard label={copy.tryLabel} body={tryText} tone="try" />
        <JudgmentCard label={copy.skipLabel} body={skipText} tone="skip" />
      </div>
      <div
        style={{
          alignSelf: "center",
          color: LOL_GOLD_LIGHT,
          borderTop: `1px solid ${LOL_GOLD}88`,
          paddingTop: 18,
          fontSize: 35,
          fontWeight: 950,
          textAlign: "center",
        }}
      >
        這是真貨還是陷阱？留言告訴我
      </div>
    </section>
  );
};

export const Template_MetaOffmeta = ({ data = {} }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const theme = { ...getPipelineTheme("META_OFFMETA_PICK"), accent: MAGIC_CYAN, secondary: LOL_GOLD };
  const timeline = buildTimeline(sanitizeStoryboardForLocale(fallbackStoryboard(data), data), fps, 0);
  const active = getActiveTimelineScene(timeline, frame);
  const copy = getOffmetaTemplateCopy(data);
  const playerStats = data.playerStats || fallbackPlayerStats(data);
  const playerTakeaways = data.playerTakeaways || fallbackTakeaways(data, copy);
  const championArt = data.splashUrl || data.heroImageUrl || data.heroIconUrl;
  const displayChampion = data.localizedChampionName || data.displayChampionName || data.champion || copy.championFallback;
  const titleText = `${displayChampion} ${copy.roleLabel}`.trim();
  const versionOverview = data.versionOverview || {
    patch: data.patch || "",
    region: data.region || "Global",
    rankPreset: data.rankPreset || "",
    role: copy.roleLabel,
    techType: copy.badge,
  };
  const activeTag = active.scene?.tag || "VERSION_OVERVIEW";
  const showSubtitle = !["VERSION_OVERVIEW", "CORE_TECH", "CONCLUSION_CTA"].includes(active.scene?.tag);

  return (
    <AbsoluteFill style={{ backgroundColor: LOL_BLUE_DEEP, color: "#fff", fontFamily: "'Outfit', 'Noto Sans TC', sans-serif", overflow: "hidden" }}>
      <CinematicBackdrop championArt={championArt} activeTag={activeTag} theme={theme} />
      <PipelineChrome theme={{ ...theme, accent: LOL_GOLD, secondary: MAGIC_CYAN }} left={copy.chromeLeft} right={copy.chromeRight} />
      <BgmLayer bgmFile={data.bgmFile || "audio/bgm1.mp3"} />
      <SafeStage inset={META_OFFMETA_STAGE_INSET}>
        {active.scene?.tag === "VERSION_OVERVIEW" ? (
          <VersionScanScene versionOverview={versionOverview} copy={copy} theme={theme} active={active} locale={data.locale} />
        ) : null}
        {active.scene?.tag === "CORE_TECH" ? (
          <HeroRevealScene copy={copy} data={data} titleText={titleText} active={active} playerStats={playerStats} theme={theme} />
        ) : null}
        {active.scene?.tag === "TEST_PLAN" ? (
          <CoreLoadoutScene copy={copy} data={data} titleText={titleText} playerTakeaways={playerTakeaways} />
        ) : null}
        {!["VERSION_OVERVIEW", "CORE_TECH", "TEST_PLAN"].includes(active.scene?.tag) ? (
          <TryOrSkipScene copy={copy} playerTakeaways={playerTakeaways} titleText={titleText} />
        ) : null}
      </SafeStage>
      {showSubtitle ? (
        <SubtitleCaption scene={active.scene} activeStart={active.start} accent={LOL_GOLD} bottom={META_OFFMETA_SUBTITLE_BOTTOM} variant="lowerThird" />
      ) : null}
    </AbsoluteFill>
  );
};
