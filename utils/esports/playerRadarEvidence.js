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
