function hasValue(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === "number") return Number.isFinite(value);
  return String(value).trim().length > 0;
}

function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isNumericString(value) {
  return /^-?(?:\d+|\d*\.\d+)(?:e[+-]?\d+)?$/i.test(String(value).trim());
}

function hasFiniteNumber(value) {
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "string" && isNumericString(value)) return Number.isFinite(Number(value));
  return false;
}

function toFiniteNumber(value) {
  return hasFiniteNumber(value) ? Number(value) : NaN;
}

function hasEvidenceDisplayValue(value) {
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value !== "string") return false;
  const text = value.trim();
  if (!text) return false;
  return isNumericString(text.endsWith("%") ? text.slice(0, -1) : text);
}

function isVerifiableMatchupReason(reason = {}) {
  return hasText(reason.metric)
    && hasFiniteNumber(reason.winnerValue)
    && hasFiniteNumber(reason.loserValue)
    && hasFiniteNumber(reason.delta);
}

function isVerifiableProofReason(reason = {}) {
  return hasText(reason.metric)
    && hasEvidenceDisplayValue(reason.rawValue)
    && hasFiniteNumber(reason.score);
}

function isScoreInRange(value) {
  const score = toFiniteNumber(value);
  return Number.isFinite(score) && score >= 0 && score <= 100;
}

function isVerifiableRadarStat(stat = {}) {
  return hasText(stat.label)
    && hasEvidenceDisplayValue(stat.rawValue)
    && hasFiniteNumber(stat.normalizedScore);
}

const VALID_EDGE_TYPES = new Set(["winner-breakpoint", "loser-highlight"]);
const METRIC_FIELDS = {
  KDA: "kda",
  DPM: "dpm",
  "KP%": "kp",
  GPM: "gpm",
  CSM: "csm",
  VPM: "vpm",
};

function metricKey(value = "") {
  return String(value || "").trim().toLowerCase();
}

function hasUniqueMetrics(entries = [], field = "metric") {
  const keys = entries.map((entry) => metricKey(entry?.[field])).filter(Boolean);
  return keys.length === new Set(keys).size;
}

function hasConsistentPositiveDelta(reason = {}) {
  const winnerValue = toFiniteNumber(reason.winnerValue);
  const loserValue = toFiniteNumber(reason.loserValue);
  const delta = toFiniteNumber(reason.delta);
  if (![winnerValue, loserValue, delta].every(Number.isFinite)) return false;
  const computedDelta = winnerValue - loserValue;
  const tolerance = Math.max(0.001, Math.abs(computedDelta) * 0.001);
  return computedDelta > 0
    && delta > 0
    && Math.abs(computedDelta - delta) <= tolerance;
}

function sameDisplayValue(left, right) {
  return String(left ?? "").trim() === String(right ?? "").trim();
}

function samePlayer(left = {}, right = {}) {
  const leftId = left.playerId || left.id;
  const rightId = right.playerId || right.id;
  if (leftId && rightId) return String(leftId).toLowerCase() === String(rightId).toLowerCase();
  return ["name", "team", "role"].every((field) =>
    String(left[field] || "").trim().toLowerCase() === String(right[field] || "").trim().toLowerCase()
  );
}

function sameNumber(left, right) {
  const a = toFiniteNumber(left);
  const b = toFiniteNumber(right);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  const tolerance = Math.max(0.001, Math.abs(b) * 0.001);
  return Math.abs(a - b) <= tolerance;
}

function metricField(metric = "") {
  return METRIC_FIELDS[String(metric || "").trim()] || null;
}

function rawMetricValue(player = {}, metric = "") {
  const field = metricField(metric);
  if (!field) return null;
  const rawValue = player.rawStats?.[field];
  return rawValue === null || rawValue === undefined || rawValue === "" ? null : rawValue;
}

function displayMetricValue(player = {}, metric = "") {
  const rawValue = rawMetricValue(player, metric);
  if (rawValue === null) return "";
  if (metric === "KP%") return `${Math.round(Number(rawValue) * 100)}%`;
  return String(rawValue);
}

function proofReasonsMatchRadarStats(reasons = [], radarStats = []) {
  const statsByMetric = new Map(
    radarStats.map((stat) => [metricKey(stat.label), stat])
  );
  return reasons.every((reason) => {
    const stat = statsByMetric.get(metricKey(reason.metric));
    return Boolean(stat)
      && sameDisplayValue(reason.rawValue, stat.rawValue)
      && toFiniteNumber(reason.score) === toFiniteNumber(stat.normalizedScore);
  });
}

function hasCompleteMatchContext(context = {}) {
  return hasText(context.league)
    && hasText(context.teamA)
    && hasText(context.teamB)
    && hasText(context.seriesScore);
}

function teamIsInMatch(player = {}, context = {}) {
  return [context.teamA, context.teamB].map((team) => String(team || "").trim()).includes(String(player.team || "").trim());
}

function segmentPlayersMatchRole(segment = {}) {
  return hasText(segment.role)
    && [segment.focusPlayer, segment.edgePlayer, segment.opponentPlayer].every((player) => String(player?.role || "") === String(segment.role));
}

function getMetricLoserPlayer(segment = {}) {
  return samePlayer(segment.focusPlayer, segment.edgePlayer)
    ? segment.opponentPlayer
    : segment.focusPlayer;
}

function matchupReasonsMatchSourceStats(segment = {}, reasons = []) {
  const loserPlayer = getMetricLoserPlayer(segment);
  return reasons.every((reason) => {
    const field = metricField(reason.metric);
    if (!field) return false;
    return sameNumber(reason.winnerValue, rawMetricValue(segment.edgePlayer, reason.metric))
      && sameNumber(reason.loserValue, rawMetricValue(loserPlayer, reason.metric));
  });
}

function proofEvidenceMatchesSourceStats(proofSegment = {}, reasons = [], radarStats = []) {
  return [...reasons, ...radarStats.map((stat) => ({
    metric: stat.label,
    rawValue: stat.rawValue,
    score: stat.normalizedScore,
  }))].every((entry) => {
    const field = metricField(entry.metric);
    if (!field) return false;
    return sameDisplayValue(entry.rawValue, displayMetricValue(proofSegment.player, entry.metric));
  });
}

function hasCompletePlayerIdentity(player = {}) {
  return hasText(player.name)
    && hasText(player.team)
    && hasText(player.role);
}

function isPlainPayloadObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isPlayerRadarPayload(payload = {}) {
  return String(payload?.dataType || "").toUpperCase() === "PLAYER_RADAR";
}

function localizedPayloadValues(payload = {}) {
  if (payload.localizedPayloads === null || payload.localizedPayloads === undefined) return [];
  if (typeof payload.localizedPayloads === "object") return Object.values(payload.localizedPayloads);
  return [];
}

function hasPlayerRadarPayload(payload = {}) {
  return isPlayerRadarPayload(payload)
    || localizedPayloadValues(payload).some((localizedPayload) => isPlainPayloadObject(localizedPayload) && isPlayerRadarPayload(localizedPayload));
}

function localizedPayloadEntries(payload = {}) {
  if (payload.localizedPayloads === null || payload.localizedPayloads === undefined) return [];
  if (typeof payload.localizedPayloads !== "object" || Array.isArray(payload.localizedPayloads)) {
    throw new Error("Player Radar localizedPayloads must be an object.");
  }
  return Object.values(payload.localizedPayloads).map((localizedPayload) => {
    if (!isPlainPayloadObject(localizedPayload)) {
      throw new Error("Player Radar localized payload must be an object.");
    }
    return localizedPayload;
  });
}

function assertSinglePlayerRadarEvidence(payload = {}) {
  const matchupSegment = payload.matchupSegment;
  if (!matchupSegment || typeof matchupSegment !== "object") {
    throw new Error("Player Radar matchup segment needs a complete role matchup.");
  }

  const displayedMatchupReasons = Array.isArray(matchupSegment.reasons)
    ? matchupSegment.reasons.slice(0, 3)
    : [];
  if (displayedMatchupReasons.length < 2) {
    throw new Error(`Player Radar matchup segment needs at least 2 verifiable reasons for ${matchupSegment.role}.`);
  }
  if (!displayedMatchupReasons.every(isVerifiableMatchupReason)) {
    throw new Error(`Player Radar matchup segment contains unverifiable displayed reasons for ${matchupSegment.role}.`);
  }
  if (!VALID_EDGE_TYPES.has(String(matchupSegment.edgeType || ""))) {
    throw new Error("Player Radar matchup segment needs a valid edge type.");
  }
  const edgeScore = toFiniteNumber(matchupSegment.edgeScore);
  if (!Number.isFinite(edgeScore) || edgeScore < 0) {
    throw new Error("Player Radar matchup segment needs a finite nonnegative edge score.");
  }
  if (!hasUniqueMetrics(displayedMatchupReasons)) {
    throw new Error("Player Radar matchup segment needs unique displayed metrics.");
  }
  if (!displayedMatchupReasons.every(hasConsistentPositiveDelta)) {
    throw new Error("Player Radar matchup segment contains inconsistent displayed deltas.");
  }
  if (!hasCompletePlayerIdentity(matchupSegment.focusPlayer)
    || !hasCompletePlayerIdentity(matchupSegment.edgePlayer)
    || !hasCompletePlayerIdentity(matchupSegment.opponentPlayer)) {
    throw new Error("Player Radar matchup segment needs complete player identity.");
  }
  if (!segmentPlayersMatchRole(matchupSegment)) {
    throw new Error("Player Radar matchup segment player roles must match segment role.");
  }
  if (hasText(matchupSegment.edgeWinnerTeam) && String(matchupSegment.edgeWinnerTeam) !== String(matchupSegment.edgePlayer.team)) {
    throw new Error("Player Radar matchup segment edge winner team must match edge player team.");
  }
  if (displayedMatchupReasons.some((reason) => !metricField(reason.metric))) {
    throw new Error("Player Radar matchup segment contains unknown displayed metrics.");
  }
  if (!matchupReasonsMatchSourceStats(matchupSegment, displayedMatchupReasons)) {
    throw new Error("Player Radar matchup segment reasons must match source stats.");
  }

  const proofSegment = payload.proofSegment;
  if (!proofSegment || typeof proofSegment !== "object") {
    throw new Error("Player Radar proof segment needs a complete player proof.");
  }

  const displayedProofReasons = Array.isArray(proofSegment.proofReasons)
    ? proofSegment.proofReasons.slice(0, 3)
    : [];
  if (displayedProofReasons.length < 2) {
    throw new Error(`Player Radar proof segment needs at least 2 verifiable reasons for ${proofSegment.player?.name}.`);
  }
  if (!displayedProofReasons.every(isVerifiableProofReason)) {
    throw new Error(`Player Radar proof segment contains unverifiable displayed reasons for ${proofSegment.player?.name}.`);
  }
  if (!displayedProofReasons.every((reason) => isScoreInRange(reason.score))) {
    throw new Error("Player Radar proof segment scores must be between 0 and 100.");
  }
  if (!hasCompletePlayerIdentity(proofSegment.player)) {
    throw new Error("Player Radar proof segment needs complete player identity.");
  }
  const displayedRadarStats = Array.isArray(proofSegment.player?.radarStats)
    ? proofSegment.player.radarStats.slice(0, 5)
    : [];
  if (displayedRadarStats.length < 2) {
    throw new Error(`Player Radar proof segment needs at least 2 verifiable radar stats for ${proofSegment.player?.name}.`);
  }
  if (!displayedRadarStats.every(isVerifiableRadarStat)) {
    throw new Error(`Player Radar proof segment contains unverifiable displayed radar stats for ${proofSegment.player?.name}.`);
  }
  if (!displayedRadarStats.every((stat) => isScoreInRange(stat.normalizedScore))) {
    throw new Error("Player Radar proof segment scores must be between 0 and 100.");
  }
  if (!hasUniqueMetrics(displayedProofReasons) || !hasUniqueMetrics(displayedRadarStats, "label")) {
    throw new Error("Player Radar proof segment needs unique displayed metrics.");
  }
  if (!proofReasonsMatchRadarStats(displayedProofReasons, displayedRadarStats)) {
    throw new Error("Player Radar proof segment reasons must match displayed radar stats.");
  }
  if ([...displayedProofReasons, ...displayedRadarStats.map((stat) => ({ metric: stat.label }))].some((entry) => !metricField(entry.metric))) {
    throw new Error("Player Radar proof segment contains unknown displayed metrics.");
  }
  if (!proofEvidenceMatchesSourceStats(proofSegment, displayedProofReasons, displayedRadarStats)) {
    throw new Error("Player Radar proof segment evidence must match source stats.");
  }

  if (!hasCompleteMatchContext(payload.matchContext)) {
    throw new Error("Player Radar needs complete match context.");
  }
  if (![matchupSegment.focusPlayer, matchupSegment.edgePlayer, matchupSegment.opponentPlayer, proofSegment.player].every((player) => teamIsInMatch(player, payload.matchContext))) {
    throw new Error("Player Radar segment teams must belong to match context.");
  }
  if (!hasCompletePlayerIdentity(payload.player) || !samePlayer(payload.player, proofSegment.player)) {
    throw new Error("Player Radar top-level player must match proof player.");
  }

  return payload;
}

function assertPlayerRadarEvidence(payload = {}) {
  const shouldValidate = hasPlayerRadarPayload(payload);
  if (!shouldValidate) return payload;

  const localizedPayloads = localizedPayloadEntries(payload);
  if (isPlayerRadarPayload(payload)) {
    assertSinglePlayerRadarEvidence(payload);
  }
  localizedPayloads.forEach((localizedPayload) => {
    if (isPlayerRadarPayload(payload) || isPlayerRadarPayload(localizedPayload)) {
      assertSinglePlayerRadarEvidence({ ...localizedPayload, dataType: "PLAYER_RADAR" });
    }
  });

  return payload;
}

module.exports = {
  hasPlayerRadarPayload,
  assertPlayerRadarEvidence,
  isPlayerRadarPayload,
};
