const PORTFOLIO_VIDEO_URL = "/demo/meta-tier-ranking.mp4";

function createPortfolioDemoState() {
  return {
    candidates: [
      {
        candidateId: "synthetic-portfolio-mid-ranking",
        kind: "META_TIER_RANKING",
        synthetic: true,
        fixtureLabel: "Synthetic portfolio fixture",
        title: "Synthetic Mid-lane ranking",
        role: "Mid",
        rankingSize: 3,
        score: 91,
        sampleSize: 240000,
        entries: [
          { rank: 1, champion: "Synthetic Pick A", tierBand: "S", tierScore: 91, sampleSize: 96000 },
          { rank: 2, champion: "Synthetic Pick B", tierBand: "A", tierScore: 87, sampleSize: 81000 },
          { rank: 3, champion: "Synthetic Pick C", tierBand: "A", tierScore: 84, sampleSize: 63000 },
        ],
        riskLabels: [],
        hardBlock: { blocked: false, reasons: [] },
      },
    ],
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

module.exports = { createPortfolioDemoState };
