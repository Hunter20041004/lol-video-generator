const PORTFOLIO_VIDEO_URL = "/demo/meta-tier-ranking.mp4";
const PORTFOLIO_TIER_RANKING_DATA = {
  candidateId: "synthetic-portfolio-mid-ranking",
  dataType: "META_TIER_RANKING",
  kind: "META_TIER_RANKING",
  synthetic: true,
  fixtureLabel: "Synthetic portfolio fixture",
  bgmFile: null,
  locale: "en",
  title: "Synthetic portfolio demo",
  role: "Mid",
  rankingSize: 3,
  score: 91,
  sampleSize: 240000,
  entries: [
    { rank: 1, champion: "Synthetic Pick A", role: "Mid", tierBand: "S", tierScore: 91, sampleSize: 96000, statLine: "Synthetic sample 96,000" },
    { rank: 2, champion: "Synthetic Pick B", role: "Mid", tierBand: "A", tierScore: 87, sampleSize: 81000, statLine: "Synthetic sample 81,000" },
    { rank: 3, champion: "Synthetic Pick C", role: "Mid", tierBand: "A", tierScore: 84, sampleSize: 63000, statLine: "Synthetic sample 63,000" },
  ],
  downgradeReason: "Generated synthetic evidence · not live Riot, player, or ranked data.",
  tierVerdict: {
    title: "Portfolio evidence",
    body: "Synthetic names, scores, and samples demonstrate the render workflow only.",
    chips: ["SYNTHETIC", "MUTED", "DETERMINISTIC"],
  },
  storyboard: [
    { tag: "HOOK", text: "Synthetic portfolio demo\nGenerated evidence only", durationInFrames: 60 },
    { tag: "RANKING", text: "Synthetic scores and samples\nNot live ranked data", durationInFrames: 90 },
    { tag: "CONCLUSION_CTA", text: "Deterministic render proof\nMuted portfolio evidence", durationInFrames: 60 },
  ],
  riskLabels: [],
  hardBlock: { blocked: false, reasons: [] },
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createPortfolioRenderProps() {
  return { data: clone(PORTFOLIO_TIER_RANKING_DATA) };
}

function createPortfolioDemoState() {
  return {
    candidates: [createPortfolioRenderProps().data],
    renderResult: {
      success: true,
      synthetic: true,
      fixtureLabel: "Synthetic portfolio fixture",
      videos: [
        {
          url: PORTFOLIO_VIDEO_URL,
          videoUrl: PORTFOLIO_VIDEO_URL,
          fileName: "meta-tier-ranking.mp4",
          locale: "zh",
          label: "Synthetic portfolio fixture",
          type: "META_TIER_RANKING",
        },
      ],
    },
  };
}

function createPortfolioDemoStateFromSearch(search = "") {
  const searchParams = new URLSearchParams(search);
  return searchParams.get("portfolio") === "1" ? createPortfolioDemoState() : null;
}

module.exports = {
  createPortfolioDemoState,
  createPortfolioDemoStateFromSearch,
  createPortfolioRenderProps,
};
