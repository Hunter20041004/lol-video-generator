const registry = require("../../config/esports-tier-one-competitions.json");

const ALLOWED_CARGO_FIELDS = new Set([
  "ScoreboardGames.Tournament",
  "TournamentRosters.Tournament",
  "PlayerImages.Tournament",
  "Tournaments.Name",
]);

function normalizeTournament(value = "") {
  return String(value || "").trim().replace(/\s+/g, " ").toLowerCase();
}

function matchesName(name, candidate) {
  const normalizedCandidate = normalizeTournament(candidate);
  return name === normalizedCandidate
    || name.startsWith(`${normalizedCandidate} `)
    || name.startsWith(`${normalizedCandidate}/`);
}

function listTierOneCompetitions() {
  return [...(registry.competitions || [])]
    .sort((left, right) => Number(left.order) - Number(right.order))
    .map((competition) => ({ ...competition }));
}

function classifyTierOneTournament(value = "") {
  const name = normalizeTournament(value);
  if (!name) return null;
  for (const competition of listTierOneCompetitions()) {
    const included = (competition.exactNames || []).some((exactName) => normalizeTournament(exactName) === name)
      || (competition.prefixes || []).some((prefix) => matchesName(name, prefix));
    if (!included) continue;
    const excluded = (competition.excludedPrefixes || []).some((prefix) => matchesName(name, prefix))
      || (competition.excludedContains || []).some((part) => name.includes(normalizeTournament(part)));
    if (!excluded) return competition;
  }
  return null;
}

function escapeCargoValue(value) {
  return String(value).replaceAll("'", "''");
}

function buildTierOneTournamentWhere(field = "ScoreboardGames.Tournament") {
  if (!ALLOWED_CARGO_FIELDS.has(field)) {
    throw new Error(`Unsupported Cargo field for tier-one tournament filter: ${field}`);
  }
  const clauses = new Set();
  for (const competition of listTierOneCompetitions()) {
    for (const exactName of competition.exactNames || []) {
      clauses.add(`${field} = '${escapeCargoValue(exactName)}'`);
    }
    for (const prefix of competition.prefixes || []) {
      clauses.add(`${field} LIKE '${escapeCargoValue(prefix)} %'`);
      clauses.add(`${field} LIKE '${escapeCargoValue(prefix)}/%'`);
    }
  }
  return `(${[...clauses].join(" OR ")})`;
}

function buildCompetitionTournamentWhere(id, field = "TournamentRosters.Tournament") {
  if (!ALLOWED_CARGO_FIELDS.has(field)) {
    throw new Error(`Unsupported Cargo field for tier-one tournament filter: ${field}`);
  }
  const competition = listTierOneCompetitions().find((entry) => entry.id === id);
  if (!competition) throw new Error(`Unknown tier-one competition: ${id}`);
  const included = new Set();
  for (const exactName of competition.exactNames || []) included.add(`${field} = '${escapeCargoValue(exactName)}'`);
  for (const prefix of competition.prefixes || []) {
    included.add(`${field} LIKE '${escapeCargoValue(prefix)} %'`);
    included.add(`${field} LIKE '${escapeCargoValue(prefix)}/%'`);
  }
  const excluded = (competition.excludedContains || [])
    .map((part) => `${field} NOT LIKE '%${escapeCargoValue(part)}%'`);
  return [`(${[...included].join(" OR ")})`, ...excluded].join(" AND ");
}

module.exports = {
  buildCompetitionTournamentWhere,
  buildTierOneTournamentWhere,
  classifyTierOneTournament,
  listTierOneCompetitions,
  normalizeTournament,
};
