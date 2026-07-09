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

function hasCompletePlayerIdentity(player = {}) {
  return hasText(player.name)
    && hasText(player.team)
    && hasText(player.role);
}

function assertSinglePlayerRadarEvidence(payload = {}) {
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

function assertPlayerRadarEvidence(payload = {}) {
  if (String(payload?.dataType || "").toUpperCase() !== "PLAYER_RADAR") return payload;

  assertSinglePlayerRadarEvidence(payload);
  if (payload.localizedPayloads && typeof payload.localizedPayloads === "object") {
    Object.values(payload.localizedPayloads)
      .filter((localizedPayload) => localizedPayload && typeof localizedPayload === "object")
      .forEach((localizedPayload) => {
        assertSinglePlayerRadarEvidence({ ...localizedPayload, dataType: "PLAYER_RADAR" });
      });
  }

  return payload;
}

module.exports = {
  assertPlayerRadarEvidence,
};
