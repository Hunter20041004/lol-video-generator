// Synthetic editorial evidence; not a real match report.
function researchPackage() {
  return {
    identity: { scanId: "scan-synthetic", seriesId: "series-synthetic", date: "2026-08-27", league: "LCK", teamA: "Synthetic Gold", teamB: "Synthetic Red", seriesScore: "3-1" },
    sources: [{ id: "source-1", url: "https://example.com/synthetic-report", title: "Synthetic report", publishedAt: null, retrievedAt: "2026-10-01T00:00:00Z", kind: "article", readStatus: "report", matchExplanation: "Synthetic fixture for this series" }],
    facts: [{ id: "fact-1", statement: "合成隊伍贏下河道交戰。", sourceIds: ["source-1"], evidenceType: "report", scope: "game", gameNumber: 4, limitations: [], conflicts: [] }],
    candidates: [{ id: "candidate-1", kind: "teamfight", headline: "合成交戰", whyInteresting: "合成的交戰轉折", factIds: ["fact-1"], unresolved: [] }],
  };
}
module.exports = { researchPackage };
