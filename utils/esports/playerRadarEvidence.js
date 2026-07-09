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

function isVerifiableRadarStat(stat = {}) {
  return hasText(stat.label)
    && hasEvidenceDisplayValue(stat.rawValue)
    && hasFiniteNumber(stat.normalizedScore);
}

const VALID_EDGE_TYPES = new Set(["winner-breakpoint", "loser-highlight"]);

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
  if (!hasUniqueMetrics(displayedProofReasons) || !hasUniqueMetrics(displayedRadarStats, "label")) {
    throw new Error("Player Radar proof segment needs unique displayed metrics.");
  }
  if (!proofReasonsMatchRadarStats(displayedProofReasons, displayedRadarStats)) {
    throw new Error("Player Radar proof segment reasons must match displayed radar stats.");
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
