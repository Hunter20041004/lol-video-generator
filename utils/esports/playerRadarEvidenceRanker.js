const METRIC_FIELDS = Object.freeze({
  KDA: "kda",
  DPM: "dpm",
  "KP%": "kp",
  GPM: "gpm",
  CSM: "csm",
  VPM: "vpm",
});

const ROLE_METRIC_PRIORITY = Object.freeze({
  Top: ["DPM", "KDA", "CSM", "GPM", "KP%"],
  Jungle: ["KDA", "KP%", "GPM", "DPM", "CSM", "VPM"],
  Mid: ["DPM", "KDA", "GPM", "CSM", "KP%"],
  Adc: ["DPM", "CSM", "KDA", "GPM", "KP%"],
  Support: ["KP%", "VPM", "KDA", "GPM", "DPM"],
});

const DEFAULT_METRIC_PRIORITY = ["DPM", "KDA", "GPM", "CSM", "KP%", "VPM"];

function round(value, digits) {
  const multiplier = 10 ** digits;
  return Math.round(value * multiplier) / multiplier;
}

function rankMatchupReasons({
  role,
  winner = {},
  loser = {},
  winnerRadarStats = [],
  loserRadarStats = [],
} = {}) {
  const priority = ROLE_METRIC_PRIORITY[role] || DEFAULT_METRIC_PRIORITY;
  const winnerScores = new Map(
    winnerRadarStats.map((stat) => [stat.label, Number(stat.normalizedScore)])
  );
  const loserScores = new Map(
    loserRadarStats.map((stat) => [stat.label, Number(stat.normalizedScore)])
  );

  return priority
    .map((metric) => {
      const field = METRIC_FIELDS[metric];
      const winnerValue = Number(winner.rawStats?.[field]);
      const loserValue = Number(loser.rawStats?.[field]);
      const winnerScore = winnerScores.get(metric);
      const loserScore = loserScores.get(metric);
      if (![winnerValue, loserValue, winnerScore, loserScore].every(Number.isFinite)) return null;

      const rawDelta = winnerValue - loserValue;
      const displayedScoreGap = winnerScore - loserScore;
      const bounds = RADAR_BOUNDS[metric];
      const ceilingFallbackGap = displayedScoreGap === 0 && winnerScore === 100 && loserScore === 100 && bounds
        ? (rawDelta / (bounds.max - bounds.min)) * 100
        : 0;
      const normalizedGap = displayedScoreGap || ceilingFallbackGap;
      if (rawDelta <= 0 || normalizedGap <= 0) return null;

      return {
        metric,
        winnerValue,
        loserValue,
        delta: round(rawDelta, metric === "DPM" || metric === "GPM" ? 0 : 2),
        normalizedGap: round(normalizedGap, 2),
      };
    })
    .filter(Boolean)
    .sort((left, right) =>
      right.normalizedGap - left.normalizedGap ||
      priority.indexOf(left.metric) - priority.indexOf(right.metric)
    )
    .slice(0, 3);
}

module.exports = {
  METRIC_FIELDS,
  ROLE_METRIC_PRIORITY,
  rankMatchupReasons,
};
const { RADAR_BOUNDS } = require("./seriesAggregator");
