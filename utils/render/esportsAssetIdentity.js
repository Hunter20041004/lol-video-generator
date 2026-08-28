function normalized(value) {
  return String(value || "").trim().toLowerCase();
}

function aliases(entry, field, aliasField) {
  return [entry?.[field], ...(entry?.[aliasField] || [])].map(normalized).filter(Boolean);
}

function validDate(value) {
  const normalizedDate = String(value || "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(normalizedDate) ? normalizedDate : "";
}

function isActiveOn(entry, matchDate) {
  if (!matchDate) return true;
  const from = validDate(entry.validFrom);
  const to = validDate(entry.validTo);
  return (!from || from <= matchDate) && (!to || matchDate <= to);
}

function identityLabel(identity = {}) {
  return identity.publicName || identity.playerId || identity.team || "unknown identity";
}

function codedError(code, message, details = {}) {
  return Object.assign(new Error(message), { code, ...details });
}

function resolveDatedEntry(entries = [], identity = {}, options = {}) {
  const kind = options.kind || "esports asset";
  const playerId = normalized(identity.playerId);
  const publicName = normalized(identity.publicName);
  const team = normalized(identity.team);
  const season = normalized(identity.season);
  const matchDate = validDate(identity.matchDate);
  const hasPlayerIdentity = Boolean(playerId || publicName);

  const matches = entries.filter((entry) => {
    const playerMatches = !hasPlayerIdentity || (
      (playerId && aliases(entry, "playerId", "playerIdAliases").includes(playerId))
      || (publicName && aliases(entry, "publicName", "playerAliases").includes(publicName))
    );
    const teamMatches = !team || aliases(entry, "team", "teamAliases").includes(team);
    const seasonMatches = !season || normalized(entry.season) === season;
    return playerMatches && teamMatches && seasonMatches && isActiveOn(entry, matchDate);
  });

  if (matches.length === 0) {
    throw codedError(
      "ASSET_IDENTITY_NOT_FOUND",
      `${kind} not found for ${identityLabel(identity)}${matchDate ? ` on ${matchDate}` : ""}.`,
      { kind, identity, matchDate }
    );
  }
  if (matches.length !== 1) {
    throw codedError(
      "ASSET_IDENTITY_AMBIGUOUS",
      `${kind} identity is ambiguous for ${identityLabel(identity)}${matchDate ? ` on ${matchDate}` : ""}.`,
      { kind, identity, matchDate }
    );
  }
  return matches[0];
}

module.exports = {
  isActiveOn,
  normalized,
  resolveDatedEntry,
  validDate,
};
