const { z } = require("zod");
const {
  ACTIVE_DATA_TYPES,
  normalizeDataType,
} = require("../../utils/pipelineRegistry");

const DATA_TYPES = ACTIVE_DATA_TYPES;

const CHANGE_TYPES = ["BUFF", "NERF", "ADJUST", "REWORK"];

const DataTypeSchema = z.enum(DATA_TYPES).default("PATCH");
const ChangeTypeSchema = z.enum(CHANGE_TYPES).default("ADJUST");

const MetricSchema = z
  .object({
    metricName: z.coerce.string().default("核心數值"),
    beforeValue: z.union([z.string(), z.number(), z.null()]).optional(),
    afterValue: z.union([z.string(), z.number(), z.null()]).optional(),
    trend: ChangeTypeSchema.optional(),
    summary: z.coerce.string().optional(),
  })
  .passthrough();

const MechanicChangeSchema = z
  .object({
    title: z.coerce.string().default("機制改動重點"),
    beforeBehavior: z.coerce.string().default("舊版互動方式未提供明確資料。"),
    afterBehavior: z.coerce.string().default("新版互動需要重新測試操作節奏。"),
    affectedCombos: z.array(z.coerce.string()).default([]),
    proImpact: z.coerce.string().default("高熟練玩家需要重新確認連招窗口。"),
    cards: z.array(
      z.object({
        title: z.coerce.string().default("重點"),
        body: z.coerce.string().default("先回到實戰測試手感。"),
      }).passthrough()
    ).max(3).optional(),
  })
  .partial()
  .passthrough();

const StoryboardSceneSchema = z
  .object({
    tag: z.coerce.string().default("NEUTRAL"),
    text: z.coerce.string().default(""),
    durationInFrames: z.number().int().positive().optional(),
    skillKey: z.coerce.string().optional(),
    metrics: z.array(MetricSchema).max(8).optional(),
    impactText: z.coerce.string().optional(),
    mechanicChange: MechanicChangeSchema.optional(),
  })
  .passthrough();

const StatChangeSchema = z
  .object({
    targetName: z.coerce.string().optional(),
    metricName: z.coerce.string().default("核心數值"),
    beforeValue: z.union([z.string(), z.number(), z.null()]).optional(),
    afterValue: z.union([z.string(), z.number(), z.null()]).optional(),
    trend: ChangeTypeSchema.default("ADJUST"),
    summary: z.coerce.string().optional(),
  })
  .passthrough();

const ActionableVerdictSchema = z
  .object({
    pickAdvice: z.coerce.string().default("觀望"),
    bestFor: z.array(z.coerce.string()).default([]),
    avoidWhen: z.array(z.coerce.string()).default([]),
    oneLineVerdict: z.coerce.string().default("先看實戰數據再決定。"),
  })
  .partial()
  .passthrough();

const MetaEvidenceSchema = z.object({
  label: z.coerce.string().default("Evidence"),
  value: z.union([z.string(), z.number(), z.null()]).optional(),
  detail: z.coerce.string().optional(),
}).passthrough();

const BasePipelineSchema = z
  .object({
    dataType: DataTypeSchema,
    locale: z.coerce.string().default("zh"),
    storyboard: z.array(StoryboardSceneSchema).default([]),
    subtitleScriptText: z.coerce.string().optional(),
    bgmFile: z.union([z.null(), z.coerce.string()]).default(null),
    actionableVerdict: ActionableVerdictSchema.optional(),
  })
  .passthrough();

const MetaOffmetaSchema = BasePipelineSchema.extend({
  dataType: z.literal("META_OFFMETA_PICK").default("META_OFFMETA_PICK"),
  title: z.coerce.string().default("Off-meta pick"),
  champion: z.coerce.string().default("Unknown Champion"),
  role: z.coerce.string().default("Mid"),
  offmetaType: z.enum(["OFFROLE_PICK", "OFFMETA_BUILD"]).default("OFFROLE_PICK"),
  score: z.coerce.number().default(0),
  confidence: z.coerce.number().default(0),
  sourceAgreement: z.coerce.number().default(0),
  sampleSize: z.coerce.number().default(0),
  riskLabels: z.array(z.coerce.string()).default([]),
  evidence: z.array(MetaEvidenceSchema).default([]),
  recommendedStoryAngle: z.coerce.string().default("這個玩法看起來很怪，但數據值得檢查。"),
  hardBlock: z.object({
    blocked: z.boolean().default(false),
    reasons: z.array(z.coerce.string()).default([]),
  }).partial().passthrough().default({ blocked: false, reasons: [] }),
});

const MetaTierRankingSchema = BasePipelineSchema.extend({
  dataType: z.literal("META_TIER_RANKING").default("META_TIER_RANKING"),
  title: z.coerce.string().default("Role tier ranking"),
  role: z.coerce.string().default("Mid"),
  rankingSize: z.coerce.number().int().default(7),
  downgradeReason: z.coerce.string().optional(),
  entries: z.array(z.object({
    champion: z.coerce.string().default("Unknown Champion"),
    role: z.coerce.string().default("Mid"),
    rank: z.coerce.number().int().default(1),
    tierBand: z.enum(["S", "A", "B", "WATCH"]).default("A"),
    tierScore: z.coerce.number().default(0),
    winRate: z.coerce.number().default(0),
    pickRate: z.coerce.number().default(0),
    banRate: z.coerce.number().default(0),
    sampleSize: z.coerce.number().default(0),
    sourceAgreement: z.coerce.number().default(0),
    reasons: z.array(z.coerce.string()).default([]),
    caveats: z.array(z.coerce.string()).default([]),
  }).passthrough()).default([]),
  watchPick: z.any().optional(),
});

const PatchSchema = BasePipelineSchema.extend({
  dataType: z.literal("PATCH").default("PATCH"),
  championName: z.coerce.string().default("Unknown Champion"),
  changeType: ChangeTypeSchema.default("ADJUST"),
  overallTrend: ChangeTypeSchema.optional(),
  skillIcons: z.record(z.string(), z.string()).optional(),
  communityBuzz: z.array(z.any()).optional(),
  primaryRole: z.coerce.string().optional(),
  localizedChampionName: z.coerce.string().optional(),
  mechanicChange: MechanicChangeSchema.optional(),
  impactPoints: z.array(
    z.union([
      z.coerce.string(),
      z.object({
        title: z.coerce.string().default("重點"),
        body: z.coerce.string().default("先回到實戰測試手感。"),
      }).passthrough(),
    ])
  ).max(3).optional(),
});

const SystemUpdateSchema = BasePipelineSchema.extend({
  dataType: z.literal("SYSTEM_UPDATE").default("SYSTEM_UPDATE"),
  targetType: z.literal("SYSTEM").default("SYSTEM"),
  targetName: z.coerce.string().default("System Update"),
  localizedName: z.coerce.string().default("系統改動"),
  headline: z.coerce.string().optional(),
  sectionTitle: z.coerce.string().optional(),
  systemType: z.coerce.string().optional(),
  changeType: ChangeTypeSchema.default("ADJUST"),
  statChanges: z.array(StatChangeSchema).default([]),
  subtopics: z.array(z.coerce.string()).default([]),
  affectedRoles: z.array(z.coerce.string()).default([]),
  impactPoints: z.array(
    z.union([
      z.coerce.string(),
      z.object({
        title: z.coerce.string().default("重點"),
        body: z.coerce.string().default("先回到實戰測試節奏。"),
      }).passthrough(),
    ])
  ).max(4).optional(),
});

const ItemRuneSchema = BasePipelineSchema.extend({
  dataType: z.enum(["ITEM_UPDATE", "RUNE_UPDATE"]).default("ITEM_UPDATE"),
  targetType: z.enum(["ITEM", "RUNE"]).default("ITEM"),
  targetName: z.coerce.string().default("Unknown Target"),
  localizedName: z.coerce.string().default("裝備符文"),
  iconUrl: z.coerce.string().optional(),
  changeType: ChangeTypeSchema.default("ADJUST"),
  statChanges: z.array(StatChangeSchema).default([]),
  synergyImpact: z
    .object({
      champions: z.array(z.coerce.string()).max(3).default([]),
      impactDescription: z.coerce.string().default("核心出裝優先級會被重新評估。"),
    })
    .partial()
    .passthrough()
    .optional(),
});

const PlayerRadarSchema = BasePipelineSchema.extend({
  dataType: z.literal("PLAYER_RADAR").default("PLAYER_RADAR"),
  matchContext: z
    .object({
      league: z.coerce.string().default("LCK"),
      teamA: z.coerce.string().default("T1"),
      teamB: z.coerce.string().default("GEN"),
      seriesScore: z.coerce.string().default("Game 1"),
    })
    .partial()
    .passthrough()
    .default({}),
  player: z
    .object({
      name: z.coerce.string().default("Player"),
      role: z.coerce.string().default("Mid"),
      championPlayed: z.coerce.string().optional(),
    })
    .partial()
    .passthrough()
    .default({}),
  radarStats: z.array(z.any()).default([]),
  highlight: z.coerce.string().optional(),
  weakness: z.coerce.string().optional(),
  verdict: z.coerce.string().optional(),
});

const EsportsH2HRadarSchema = BasePipelineSchema.extend({
  dataType: z.literal("ESPORTS_H2H_RADAR").default("ESPORTS_H2H_RADAR"),
  seriesId: z.coerce.string().optional(),
  title: z.coerce.string().default("Head-to-Head Radar"),
  caption: z.coerce.string().optional(),
  cta: z.coerce.string().optional(),
  match: z.any().optional(),
  matchupEdges: z.array(z.any()).default([]),
  roleSegments: z.array(z.any()).default([]),
});

const EsportsMatchRecapSchema = BasePipelineSchema.extend({
  dataType: z.literal("ESPORTS_MATCH_RECAP").default("ESPORTS_MATCH_RECAP"),
  seriesId: z.coerce.string().optional(),
  title: z.coerce.string().default("Match Recap"),
  caption: z.coerce.string().optional(),
  cta: z.coerce.string().optional(),
  match: z.any().optional(),
  recapPoints: z.array(z.any()).default([]),
  keyPlayers: z.array(z.coerce.string()).default([]),
});

const schemaByDataType = {
  PATCH: PatchSchema,
  SYSTEM_UPDATE: SystemUpdateSchema,
  ITEM_UPDATE: ItemRuneSchema,
  RUNE_UPDATE: ItemRuneSchema,
  PLAYER_RADAR: PlayerRadarSchema,
  ESPORTS_H2H_RADAR: EsportsH2HRadarSchema,
  ESPORTS_MATCH_RECAP: EsportsMatchRecapSchema,
  META_OFFMETA_PICK: MetaOffmetaSchema,
  META_TIER_RANKING: MetaTierRankingSchema,
};

const sanitizeSceneText = (text) =>
  String(text || "")
    .replace(/\s*\n\s*([？。，！?!,.；：、）」』])/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

const ensureTwoLineText = (text, fallback = "版本重點\n快速看懂") => {
  const cleaned = sanitizeSceneText(text || fallback);
  if (cleaned.includes("\n")) return cleaned.split("\n").slice(0, 2).join("\n");
  if (cleaned.length <= 14) return `${cleaned}\n重點看這裡`;
  const splitAt = Math.min(14, Math.max(6, Math.floor(cleaned.length / 2)));
  return `${cleaned.slice(0, splitAt)}\n${cleaned.slice(splitAt, splitAt + 14)}`;
};

const fallbackStoryboardFor = (payload) => {
  const dataType = payload.dataType || "PATCH";
  if (dataType === "PLAYER_RADAR") {
    return [
      { tag: "HOOK", text: "選手數據雷達\n賽後一眼看懂", durationInFrames: 86 },
      { tag: "STAT_REVEAL", text: "強項與弱點\n直接攤開", durationInFrames: 120 },
      { tag: "CONCLUSION_CTA", text: "這場是不是 MVP\n留言告訴我", durationInFrames: 92 },
    ];
  }
  if (dataType === "ESPORTS_H2H_RADAR") {
    return [
      { tag: "HOOK", text: "五路對位雷達\n賽後一眼看懂", durationInFrames: 90 },
      { tag: "MATCHUPS", text: "Top 到 Support\n逐路拆數據差距", durationInFrames: 300 },
      { tag: "CONCLUSION_CTA", text: "哪路最關鍵\n留言告訴我", durationInFrames: 90 },
    ];
  }
  if (dataType === "ESPORTS_MATCH_RECAP") {
    return [
      { tag: "HOOK", text: "賽後數據快報\n這場為什麼值得看", durationInFrames: 90 },
      { tag: "RECAP_POINTS", text: "三個數據差距\n說清楚勝負關鍵", durationInFrames: 260 },
      { tag: "CONCLUSION_CTA", text: "下一場前\n先收藏這支", durationInFrames: 90 },
    ];
  }
  if (dataType === "ITEM_UPDATE" || dataType === "RUNE_UPDATE") {
    return [
      { tag: "HOOK", text: "裝備符文改動\n出裝節奏要重看", durationInFrames: 86 },
      { tag: "STAT_REVEAL", text: "核心數值攤開\n別只看表面", durationInFrames: 98 },
      { tag: "CONCLUSION_CTA", text: "先出還是延後\n新版本見真章", durationInFrames: 90 },
    ];
  }
  if (dataType === "SYSTEM_UPDATE") {
    return [
      { tag: "HOOK", text: "系統改動\n版本節奏要重看", durationInFrames: 86 },
      { tag: "SKILL_SHOWCASE", text: "核心規則改了\n打法時間點要重測", skillKey: "SYS", durationInFrames: 120 },
      { tag: "CONCLUSION_CTA", text: "先重測路線\n再決定打法", durationInFrames: 90 },
    ];
  }
  return [
    { tag: "HOOK", text: "版本重點\n快速看懂", durationInFrames: 86 },
    { tag: "CONCLUSION_CTA", text: "今晚怎麼玩\n看完就知道", durationInFrames: 92 },
  ];
};

function normalizePipelinePayload(rawPayload = {}) {
  const dataType = normalizeDataType(rawPayload.dataType);
  const schema = schemaByDataType[dataType] || BasePipelineSchema;
  const parsed = schema.safeParse({ ...rawPayload, dataType });

  const data = parsed.success
    ? parsed.data
    : BasePipelineSchema.passthrough().parse({ ...rawPayload, dataType });

  if (!Array.isArray(data.storyboard) || data.storyboard.length === 0) {
    data.storyboard = fallbackStoryboardFor(data);
  }

  data.storyboard = data.storyboard.map((scene) => ({
    ...scene,
    tag: scene.tag || "NEUTRAL",
    text: ensureTwoLineText(scene.text),
  }));

  if (!data.subtitleScriptText) {
    data.subtitleScriptText = data.storyboard.map((scene) => scene.text).join("");
  }

  if (!data.actionableVerdict) {
    data.actionableVerdict = {
      pickAdvice: "觀望",
      bestFor: [],
      avoidWhen: [],
      oneLineVerdict: "先看實戰數據再決定。",
    };
  }

  return {
    data,
    issues: parsed.success ? [] : parsed.error.issues,
  };
}

module.exports = {
  DATA_TYPES,
  CHANGE_TYPES,
  DataTypeSchema,
  ChangeTypeSchema,
  MetricSchema,
  StoryboardSceneSchema,
  StatChangeSchema,
  normalizePipelinePayload,
};
