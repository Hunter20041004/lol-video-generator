const OFFMETA_WEIGHTS = {
  anomaly: 0.35,
  performance: 0.30,
  evidence: 0.20,
  content: 0.15,
};

const TIER_WEIGHTS = {
  winRate: 0.35,
  pickRate: 0.20,
  banPressure: 0.15,
  sampleConfidence: 0.15,
  sourceAgreement: 0.10,
  patchMomentum: 0.05,
};

const MAIN_ROLE_BUILD_PICK_RATE_MAX = 3;

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

function round(value, digits = 2) {
  const multiplier = 10 ** digits;
  return Math.round((Number(value) || 0) * multiplier) / multiplier;
}

function candidateKey(row = {}) {
  return `${row.champion}::${row.role}`;
}

function bandForScore(score) {
  if (score >= 82) return "S";
  if (score >= 68) return "A";
  return "B";
}

function tierScoreForRow(row = {}, verification = {}) {
  const winRateScore = clamp((row.winRate || 0) * 1.5);
  const pickRateScore = clamp((row.pickRate || 0) * 6);
  const banPressureScore = clamp((row.banRate || 0) * 5);
  const sampleConfidence = clamp(Math.log10(Math.max(row.sampleSize || 1, 1)) * 18);
  const sourceAgreement = clamp((verification.sourceAgreement ?? 0.75) * 100);
  const patchMomentum = clamp(((row.winRate || 0) - (row.baselineWinRate || 50)) * 12 + 50);
  return round(
    winRateScore * TIER_WEIGHTS.winRate +
    pickRateScore * TIER_WEIGHTS.pickRate +
    banPressureScore * TIER_WEIGHTS.banPressure +
    sampleConfidence * TIER_WEIGHTS.sampleConfidence +
    sourceAgreement * TIER_WEIGHTS.sourceAgreement +
    patchMomentum * TIER_WEIGHTS.patchMomentum
  );
}

function riskLabelsForOffmeta(row = {}, verification = {}) {
  const labels = [];
  if ((row.sampleSize || 0) < 1000) labels.push("LOW_SAMPLE");
  if ((row.pickRate || 0) < 0.5) labels.push("LOW_PICK_RATE");
  if (verification.status === "mismatch") labels.push("SOURCE_MISMATCH");
  if (verification.status === "unavailable") labels.push("SOURCE_UNAVAILABLE");
  if (String(row.rankPreset || "").includes("master")) labels.push("HIGH_ELO_ONLY");
  return labels;
}

function hasCoreGameplayDetails(row = {}) {
  return (Array.isArray(row.builds) && row.builds.length > 0) ||
    (Array.isArray(row.runes) && row.runes.length > 0);
}

function hasMainRoleBuildTechSignal(row = {}) {
  if (!hasCoreGameplayDetails(row)) return false;
  if (row.buildTech === true || row.offmetaBuild === true) return true;
  return (row.pickRate || 0) > 0 && (row.pickRate || 0) <= MAIN_ROLE_BUILD_PICK_RATE_MAX;
}

function shouldSkipMainRoleWithoutGameplay(row = {}) {
  const isOffRole = row.primaryRole && row.role && row.primaryRole !== row.role;
  return Boolean(row.champion && row.role && !isOffRole && !hasMainRoleBuildTechSignal(row));
}

function hardBlockForOffmeta(row = {}, verification = {}) {
  const reasons = [];
  const isOffRole = row.primaryRole && row.role && row.primaryRole !== row.role;
  if (!row.champion || !row.role) reasons.push("Missing champion or role.");
  if (row.champion && row.role && !isOffRole && !hasCoreGameplayDetails(row)) {
    reasons.push("缺少核心裝備/符文，不能生成黑科技影片。");
  }
  if ((row.sampleSize || 0) < 300) reasons.push("Sample size is below minimum threshold.");
  if ((row.winRate || 0) + 1 < (row.baselineWinRate || 50)) reasons.push("Win rate is below baseline.");
  if (verification.status === "mismatch" && (row.sampleSize || 0) < 2000) reasons.push("Source mismatch with low sample.");
  return { blocked: reasons.length > 0, reasons };
}

function scoreOffmetaCandidates(rows = [], verificationByKey = {}) {
  return rows
    .filter((row) => !shouldSkipMainRoleWithoutGameplay(row))
    .map((row) => {
      const verification = verificationByKey[candidateKey(row)] || { sourceAgreement: 0.5, status: "unavailable" };
      const winDelta = (row.winRate || 0) - (row.baselineWinRate || 50);
      const isOffRole = row.primaryRole && row.role && row.primaryRole !== row.role;
      const anomalyScore = isOffRole ? 90 : 45;
      const performanceScore = clamp(50 + winDelta * 10);
      const evidenceScore = clamp(Math.log10(Math.max(row.sampleSize || 1, 1)) * 18 + (verification.sourceAgreement || 0.5) * 20);
      const contentScore = isOffRole ? 85 : 60;
      const score = round(
        anomalyScore * OFFMETA_WEIGHTS.anomaly +
        performanceScore * OFFMETA_WEIGHTS.performance +
        evidenceScore * OFFMETA_WEIGHTS.evidence +
        contentScore * OFFMETA_WEIGHTS.content
      );
      const riskLabels = riskLabelsForOffmeta(row, verification);
      const hardBlock = hardBlockForOffmeta(row, verification);

      return {
        candidateId: `offmeta-${String(row.champion).toLowerCase()}-${String(row.role).toLowerCase()}`,
        kind: "META_OFFMETA_PICK",
        offmetaType: isOffRole ? "OFFROLE_PICK" : "OFFMETA_BUILD",
        champion: row.champion,
        role: row.role,
        score,
        confidence: round(clamp(evidenceScore) / 100),
        sourceAgreement: round(verification.sourceAgreement ?? 0.5),
        sampleSize: row.sampleSize || 0,
        riskLabels,
        evidence: [
          { label: "Win rate", value: row.winRate },
          { label: "Baseline", value: row.baselineWinRate },
          { label: "Pick rate", value: row.pickRate },
        ],
        recommendedStoryAngle: `${row.champion} ${row.role} looks off-meta, but the sample is worth checking.`,
        hardBlock,
        sourceNotes: Array.isArray(verification.notes) ? verification.notes : [],
        ...(Array.isArray(row.builds) && row.builds.length > 0 ? { coreItems: row.builds } : {}),
        ...(Array.isArray(row.runes) && row.runes.length > 0 ? { coreRunes: row.runes } : {}),
        ...(Array.isArray(row.summonerSpells) && row.summonerSpells.length > 0 ? { summonerSpells: row.summonerSpells } : {}),
      };
    })
    .sort((a, b) => b.score - a.score);
}

function scoreTierRanking(rows = [], verificationByKey = {}, options = {}) {
  const role = options.role || rows[0]?.role || "Mid";
  const excluded = new Set((options.excludedChampions || []).map((name) => String(name).toLowerCase()));
  const eligible = rows
    .filter((row) => row.role === role)
    .filter((row) => !excluded.has(String(row.champion || "").toLowerCase()))
    .map((row) => {
      const verification = verificationByKey[candidateKey(row)] || { sourceAgreement: 0.75 };
      const tierScore = tierScoreForRow(row, verification);
      return {
        champion: row.champion,
        role,
        tierScore,
        winRate: row.winRate || 0,
        pickRate: row.pickRate || 0,
        banRate: row.banRate || 0,
        sampleSize: row.sampleSize || 0,
        sourceAgreement: round(verification.sourceAgreement ?? 0.75),
        reasons: [
          `Win rate ${row.winRate || 0}%`,
          `Pick rate ${row.pickRate || 0}%`,
        ],
        caveats: row.sampleSize < 1000 ? ["Sample size is low."] : [],
      };
    })
    .sort((a, b) => b.tierScore - a.tierScore);

  const rankingSize = eligible.length >= 7 ? 7 : Math.min(5, eligible.length);
  const entries = eligible.slice(0, rankingSize).map((entry, index) => ({
    ...entry,
    rank: index + 1,
    tierBand: bandForScore(entry.tierScore),
  }));
  const hardBlock = entries.length === 0
    ? { blocked: true, reasons: ["Tier ranking has no entries."] }
    : { blocked: false, reasons: [] };

  return {
    kind: "META_TIER_RANKING",
    role,
    rankingSize,
    entries,
    watchPick: eligible[rankingSize] || null,
    downgradeReason: rankingSize < 7 ? "Available candidates did not meet Top 7 confidence." : "",
    hardBlock,
  };
}

module.exports = {
  scoreOffmetaCandidates,
  scoreTierRanking,
  candidateKey,
};
