function hasValue(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === "number") return Number.isFinite(value);
  return String(value).trim().length > 0;
}

function isVerifiableMatchupReason(reason = {}) {
  return hasValue(reason.metric)
    && hasValue(reason.winnerValue)
    && hasValue(reason.loserValue)
    && hasValue(reason.delta);
}

function isVerifiableProofReason(reason = {}) {
  return hasValue(reason.metric)
    && hasValue(reason.rawValue)
    && hasValue(reason.score);
}

function assertPlayerRadarEvidence(payload = {}) {
  if (String(payload?.dataType || "").toUpperCase() !== "PLAYER_RADAR") return payload;

  const matchupSegment = payload.matchupSegment;
  if (!matchupSegment || typeof matchupSegment !== "object") {
    throw new Error("Player Radar matchup segment needs a complete role matchup.");
  }

  const matchupReasons = Array.isArray(matchupSegment.reasons)
    ? matchupSegment.reasons.filter(isVerifiableMatchupReason)
    : [];
  if (matchupReasons.length < 2) {
    throw new Error(`Player Radar matchup segment needs at least 2 verifiable reasons for ${matchupSegment.role}.`);
  }

  const proofSegment = payload.proofSegment;
  if (!proofSegment || typeof proofSegment !== "object") {
    throw new Error("Player Radar proof segment needs a complete player proof.");
  }

  const proofReasons = Array.isArray(proofSegment.proofReasons)
    ? proofSegment.proofReasons.filter(isVerifiableProofReason)
    : [];
  if (proofReasons.length < 2) {
    throw new Error(`Player Radar proof segment needs at least 2 verifiable reasons for ${proofSegment.player?.name}.`);
  }

  return payload;
}

module.exports = {
  assertPlayerRadarEvidence,
};
