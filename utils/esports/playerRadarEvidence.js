function hasValue(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === "number") return Number.isFinite(value);
  return String(value).trim().length > 0;
}

function hasFiniteNumber(value) {
  if (!hasValue(value)) return false;
  return Number.isFinite(Number(value));
}

function isVerifiableMatchupReason(reason = {}) {
  return hasValue(reason.metric)
    && hasFiniteNumber(reason.winnerValue)
    && hasFiniteNumber(reason.loserValue)
    && hasFiniteNumber(reason.delta);
}

function isVerifiableProofReason(reason = {}) {
  return hasValue(reason.metric)
    && hasValue(reason.rawValue)
    && hasFiniteNumber(reason.score);
}

function hasCompletePlayerIdentity(player = {}) {
  return hasValue(player.name)
    && hasValue(player.team)
    && hasValue(player.role);
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
  if (!hasCompletePlayerIdentity(matchupSegment.focusPlayer)
    || !hasCompletePlayerIdentity(matchupSegment.edgePlayer)
    || !hasCompletePlayerIdentity(matchupSegment.opponentPlayer)) {
    throw new Error("Player Radar matchup segment needs complete player identity.");
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
  if (!hasCompletePlayerIdentity(proofSegment.player)) {
    throw new Error("Player Radar proof segment needs complete player identity.");
  }

  return payload;
}

module.exports = {
  assertPlayerRadarEvidence,
};
