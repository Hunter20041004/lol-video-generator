import { Composition } from "remotion";
import { PatchVideo, calculatePacing } from "./Composition";

const mockPatchData = {
  championName: "Tahm Kench",
  dataType: "PATCH",
  locale: "zh",
  storyboard: [
    { text: "貪啃奇版本改動\n先看實戰定位", tag: "HOOK" },
    { text: "基礎護盾提高\n換血容錯變強", tag: "SKILL_SHOWCASE" },
    { text: "先測打法窗口\n再決定能不能上分", tag: "CONCLUSION_CTA" },
  ],
};

const mockItemUpdateData = {
  dataType: "ITEM_UPDATE",
  targetType: "ITEM",
  targetName: "Kraken Slayer",
  localizedName: "海妖殺手",
  locale: "zh",
  statChanges: [
    { metricName: "觸發傷害", beforeValue: "140", afterValue: "120", trend: "NERF" },
    { metricName: "攻擊速度", beforeValue: "35%", afterValue: "40%", trend: "BUFF" },
  ],
  storyboard: [
    { text: "海妖殺手數值調整\n射手出裝節奏要變了", tag: "HOOK" },
    { text: "觸發傷害降低\n但攻速手感補強", tag: "SKILL_SHOWCASE" },
    { text: "這件還會是首選嗎？", tag: "CONCLUSION_CTA" },
  ],
};

const mockRuneUpdateData = {
  dataType: "RUNE_UPDATE",
  targetType: "RUNE",
  targetName: "Conqueror",
  localizedName: "征服者",
  locale: "zh",
  storyboard: [
    { text: "征服者迎來增強\n鬥士玩家準備回歸", tag: "HOOK" },
    { text: "疊層收益更有感\n長線對拼更吃香", tag: "SKILL_SHOWCASE" },
    { text: "你會拿誰來測？", tag: "CONCLUSION_CTA" },
  ],
};

const mockPlayerRadarData = {
  dataType: "PLAYER_RADAR",
  matchContext: { league: "LCK", teamA: "T1", teamB: "GEN", seriesScore: "Game 3" },
  player: { name: "Faker", role: "Mid", championPlayed: "Azir" },
  radarStats: [
    { label: "KDA", rawValue: "8.2", normalizedScore: 88 },
    { label: "DPM", rawValue: "612", normalizedScore: 82 },
    { label: "KP%", rawValue: "78%", normalizedScore: 92 },
  ],
  storyboard: [
    { text: "Faker 的真實數據\n你看過嗎？", tag: "HOOK" },
    { text: "團戰參與率 92%\n中路全聯盟最強", tag: "STAT_REVEAL" },
    { text: "這場是不是 MVP\n留言告訴我", tag: "CONCLUSION_CTA" },
  ],
};

const mockEsportsH2HRadarData = {
  dataType: "ESPORTS_H2H_RADAR",
  locale: "zh",
  title: "T1 vs GEN 五路對位雷達",
  match: { league: "LCK", teams: ["T1", "GEN"], score: "2-0" },
  matchupEdges: ["Top", "Jungle", "Mid", "Adc", "Support"].map((role, index) => ({
    role,
    edgeWinner: "T1",
    edgePlayer: `T1 ${role}`,
    edgeScore: 34 - index * 2,
  })),
  storyboard: [
    { tag: "HOOK", text: "T1 vs GEN\n五路對位開拆", durationInFrames: 90 },
    { tag: "MATCHUPS", text: "同一場系列賽\n五個位置直接比", durationInFrames: 300 },
    { tag: "CONCLUSION_CTA", text: "你覺得哪路最關鍵\n留言告訴我", durationInFrames: 90 },
  ],
};

const mockEsportsMatchRecapData = {
  dataType: "ESPORTS_MATCH_RECAP",
  locale: "zh",
  title: "T1 vs GEN 賽後數據快報",
  match: { league: "LCK", teams: ["T1", "GEN"], score: "2-0" },
  recapPoints: [
    { id: "series-result", summary: "T1 以 2-0 收下系列賽", metric: "score", value: "2-0" },
    { id: "team-damage-gap", summary: "T1 團隊輸出明顯領先", metric: "damageToChampions", value: 180000 },
  ],
  storyboard: [
    { tag: "HOOK", text: "T1 vs GEN\n這場為什麼值得看", durationInFrames: 90 },
    { tag: "RECAP_POINTS", text: "三個數據差距\n說清楚勝負關鍵", durationInFrames: 260 },
    { tag: "CONCLUSION_CTA", text: "每天賽後重點\n追蹤看下一場", durationInFrames: 90 },
  ],
};

const mockMetaOffmetaData = {
  dataType: "META_OFFMETA_PICK",
  locale: "zh",
  title: "Velkoz Support 黑科技",
  champion: "Velkoz",
  role: "Support",
  offmetaType: "OFFROLE_PICK",
  score: 82,
  sourceAgreement: 1,
  sampleSize: 18420,
  riskLabels: ["HIGH_ELO_ONLY"],
  recommendedStoryAngle: "非主流輔助打法，先看樣本與風險再抄。",
  storyboard: [
    { tag: "HOOK", text: "Velkoz Support\n看起來很怪", durationInFrames: 90 },
    { tag: "STAT_REVEAL", text: "分數 82\n樣本 18420", durationInFrames: 120 },
    { tag: "RISK", text: "高端局資料較多\n低端先別無腦抄", durationInFrames: 120 },
    { tag: "CONCLUSION_CTA", text: "這是真貨還是陷阱\n留言告訴我", durationInFrames: 90 },
  ],
};

const mockMetaTierRankingData = {
  dataType: "META_TIER_RANKING",
  locale: "zh",
  title: "Mid 梯度榜 Top 3",
  role: "Mid",
  rankingSize: 3,
  entries: [
    { rank: 1, champion: "Ahri", role: "Mid", tierBand: "S", tierScore: 92, reasons: ["穩定先手", "樣本充足"] },
    { rank: 2, champion: "Orianna", role: "Mid", tierBand: "A", tierScore: 88, reasons: ["團戰強", "版本適配"] },
    { rank: 3, champion: "Syndra", role: "Mid", tierBand: "A", tierScore: 84, reasons: ["爆發高", "線權穩"] },
  ],
  downgradeReason: "排除低樣本與資料源不一致的選角。",
  storyboard: [
    { tag: "HOOK", text: "Mid 版本答案\n先看這幾隻", durationInFrames: 90 },
    { tag: "RANKING", text: "綜合強度分\n不是只看勝率", durationInFrames: 210 },
    { tag: "CONCLUSION_CTA", text: "下一路想看哪裡\n留言告訴我", durationInFrames: 90 },
  ],
};

const buildPatchMetadataStoryboard = (data = {}) => {
  const existing = Array.isArray(data.storyboard) && data.storyboard.length > 0
    ? data.storyboard
    : [
        { tag: "HOOK", text: `${data.championName || "版本英雄"}版本改動\n先看實戰定位` },
        { tag: "SKILL_SHOWCASE", text: "核心改動是重點\n先看實戰影響" },
        { tag: "CONCLUSION_CTA", text: "先測打法窗口\n再決定能不能上分" },
      ];

  return existing.map((scene, index) => ({
    ...scene,
    tag: scene.tag === "STAT_REVEAL" ? "SKILL_SHOWCASE" : scene.tag,
    durationInFrames:
      scene.durationInFrames ||
      (index === 0 ? 108 : ["CONCLUSION_CTA", "OUTRO", "VERDICT"].includes(scene.tag) ? 132 : 152),
  }));
};

const buildItemRuneMetadataStoryboard = (data = {}) => {
  if (Array.isArray(data.storyboard) && data.storyboard.length > 0) return data.storyboard;
  const name = data.localizedName || data.targetName || "裝備符文";
  return [
    { text: `${name}版本改動\n這波會改寫出裝順序`, tag: "HOOK", durationInFrames: 104 },
    { text: "核心數值是重點\n先看斬殺線怎麼變", tag: "SKILL_SHOWCASE", durationInFrames: 126 },
    { text: "這件還能不能先出\n新版本第一場就知道", tag: "CONCLUSION_CTA", durationInFrames: 110 },
  ];
};

const getMetadataStoryboards = (data = {}) => {
  if (!data.dataType || data.dataType === "PATCH") return [buildPatchMetadataStoryboard(data)];
  if (data.dataType === "ITEM_UPDATE" || data.dataType === "RUNE_UPDATE") {
    return [buildItemRuneMetadataStoryboard(data)];
  }
  return [
    Array.isArray(data.storyboard) && data.storyboard.length > 0
      ? data.storyboard
      : [{ text: data.subtitleScriptText || "", tag: "NEUTRAL" }],
  ];
};

const calculateMetadata = ({ props }) => {
  const fps = 30;
  const finalBuffer = 30;
  const storyboards = getMetadataStoryboards(props.data);

  const totalFrames = storyboards.reduce((sum, storyboard) => {
    const pacing = calculatePacing(storyboard, fps);
    return sum + pacing.totalFrames + finalBuffer;
  }, 0);

  return {
    durationInFrames: totalFrames,
    props,
  };
};

const retainedCompositions = [
  ["LeaguePatchVideo", mockPatchData],
  ["ItemUpdateVideo", mockItemUpdateData],
  ["RuneUpdateVideo", mockRuneUpdateData],
  ["PlayerRadarVideo", mockPlayerRadarData],
  ["EsportsHeadToHeadRadarVideo", mockEsportsH2HRadarData],
  ["EsportsMatchRecapVideo", mockEsportsMatchRecapData],
  ["MetaOffmetaVideo", mockMetaOffmetaData],
  ["MetaTierRankingVideo", mockMetaTierRankingData],
];

export const RemotionRoot = () => (
  <>
    {retainedCompositions.map(([id, data]) => (
      <Composition
        key={id}
        id={id}
        component={PatchVideo}
        calculateMetadata={calculateMetadata}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{ data }}
      />
    ))}
  </>
);
