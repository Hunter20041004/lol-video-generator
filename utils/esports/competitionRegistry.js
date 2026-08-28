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
  return name === normalizedCandidate || name.startsWith(`${normalizedCandidate} `);
}

function listTierOneCompetitions() {
  return [...(registry.competitions || [])]
    .sort((left, right) => Number(left.order) - Number(right.order))
    .map((competition) => ({ ...competition }));
}

function classifyTierOneTournament(value = "") {
  const name = normalizeTournament(value);
  if (!name) return null;
  const competitions = listTierOneCompetitions();
  const excluded = competitions.some((competition) =>
    (competition.excludedPrefixes || []).some((prefix) => matchesName(name, prefix))
  );
  if (excluded) return null;

  return competitions.find((competition) =>
    (competition.exactNames || []).some((exactName) => normalizeTournament(exactName) === name)
    || (competition.prefixes || []).some((prefix) => matchesName(name, prefix))
  ) || null;
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
    }
  }
  return `(${[...clauses].join(" OR ")})`;
}

module.exports = {
  buildTierOneTournamentWhere,
  classifyTierOneTournament,
  listTierOneCompetitions,
  normalizeTournament,
};
