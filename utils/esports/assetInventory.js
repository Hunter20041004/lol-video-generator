const leaguepedia = require("../leaguepediaApi");
const {
  buildTierOneTournamentWhere,
  classifyTierOneTournament,
} = require("./competitionRegistry");

function normalized(value) {
  return String(value || "").trim().toLowerCase();
}

function splitAlignedList(value = "") {
  if (Array.isArray(value)) return value.map((item) => String(item || "").trim()).filter(Boolean);
  const text = String(value || "").trim();
  if (!text) return [];
  const delimiter = text.includes(";;") ? /\s*;;\s*/ : text.includes("\n") ? /\s*\n\s*/ : /\s*,\s*/;
  return text.split(delimiter).map((item) => item.trim()).filter(Boolean);
}

function playerSlug(value = "") {
  return String(value || "")
    .replace(/^.*\//, "")
    .replace(/\s*\([^)]*\)\s*$/, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function normalizeRole(value = "") {
  const role = normalized(value);
  if (["bot", "bottom", "adc", "marksman"].includes(role)) return "Adc";
  if (["support", "sup", "supp"].includes(role)) return "Support";
  if (["jungle", "jungler", "jg"].includes(role)) return "Jungle";
  if (["mid", "middle"].includes(role)) return "Mid";
  if (["top", "toplane"].includes(role)) return "Top";
  return String(value || "").trim();
}

function isPlayerRole(value = "") {
  return ["Top", "Jungle", "Mid", "Adc", "Support", "Substitute"]
    .includes(normalizeRole(value));
}

function parseRosterRows(rows = [], options = {}) {
  const year = String(options.year || "2026");
  const teams = new Map();
  const players = new Map();

  for (const row of rows) {
    const tournament = String(row.Tournament || row.tournament || "").trim();
    const competition = classifyTierOneTournament(tournament);
    if (!competition || !tournament.includes(year)) continue;
    const team = String(row.Team || row.team || "").trim();
    if (!team) continue;
    if (!teams.has(normalized(team))) {
      teams.set(normalized(team), {
        team,
        short: String(row.Short || "").trim(),
        region: competition.region,
        competitionId: competition.id,
        tournaments: [],
      });
    }
    const teamRecord = teams.get(normalized(team));
    if (!teamRecord.tournaments.includes(tournament)) teamRecord.tournaments.push(tournament);

    const rosterLinks = splitAlignedList(row.RosterLinks);
    const roles = splitAlignedList(row.Roles);
    rosterLinks.forEach((link, index) => {
      if (!isPlayerRole(roles[index] || "")) return;
      const publicName = String(link).replace(/^.*\//, "").trim();
      const playerId = playerSlug(publicName);
      if (!playerId) return;
      const key = `${playerId}::${normalized(team)}`;
      if (!players.has(key)) {
        players.set(key, {
          playerId,
          publicName,
          team,
          role: normalizeRole(roles[index] || ""),
          region: competition.region,
          competitionId: competition.id,
          tournaments: [],
        });
      }
      const player = players.get(key);
      if (!player.tournaments.includes(tournament)) player.tournaments.push(tournament);
    });
  }

  return { teams: [...teams.values()], players: [...players.values()] };
}

function cargoValue(value) {
  return String(value).replaceAll("'", "''");
}

function leaguepediaFileSource(fileName) {
  const encoded = encodeURIComponent(String(fileName || "").trim());
  if (!encoded) return null;
  return {
    sourceKind: "leaguepedia",
    sourcePage: `https://lol.fandom.com/wiki/File:${encoded}`,
    sourceUrl: `https://lol.fandom.com/wiki/Special:Redirect/file/${encoded}`,
  };
}

function approvedWebsiteCandidate(value) {
  try {
    const url = new URL(String(value || "").trim());
    return url.protocol === "https:" ? { sourceKind: "team", sourcePage: url.toString() } : null;
  } catch {
    return null;
  }
}

async function fetchTierOneAssetInventory(options = {}, deps = {}) {
  const year = String(options.year || "2026");
  const asOf = String(options.asOf || new Date().toISOString().slice(0, 10));
  const cargoQuery = deps.cargoQuery || leaguepedia.cargoQuery;
  const tournaments = await cargoQuery({
    tables: "Tournaments",
    fields: "Name,Year,DateStart,Date,TournamentLevel,IsOfficial",
    where: `Tournaments.Year = '${cargoValue(year)}' AND ${buildTierOneTournamentWhere("Tournaments.Name")}`,
    order_by: "Tournaments.DateStart ASC",
    limit: 50,
  });
  const eligibleTournaments = new Set(tournaments
    .filter((row) => !row.DateStart || String(row.DateStart).slice(0, 10) <= asOf)
    .map((row) => String(row.Name || "").trim())
    .filter((name) => classifyTierOneTournament(name)));
  if (eligibleTournaments.size === 0) {
    throw new Error(`Leaguepedia returned no eligible tournaments for ${year} as of ${asOf}; coverage was not calculated.`);
  }
  const rosterRows = await cargoQuery({
    tables: "TournamentRosters",
    fields: "Team,OverviewPage,Region,RosterLinks,Roles,Tournament,Short,IsComplete",
    where: `${buildTierOneTournamentWhere("TournamentRosters.Tournament")} AND TournamentRosters.Tournament LIKE '%${cargoValue(year)}%'`,
    limit: 50,
  });
  const scopedRosters = rosterRows.filter((row) => eligibleTournaments.has(String(row.Tournament || "").trim()));
  const parsed = parseRosterRows(scopedRosters, { year });
  const playerImages = await cargoQuery({
    tables: "PlayerImages",
    fields: "FileName,Link,Team,Tournament,ImageType,IsProfileImage,SortDate",
    where: `${buildTierOneTournamentWhere("PlayerImages.Tournament")} AND PlayerImages.Tournament LIKE '%${cargoValue(year)}%'`,
    order_by: "PlayerImages.SortDate DESC",
    limit: 50,
  });
  const teamWhere = parsed.teams.length > 0
    ? `(${parsed.teams.map(({ team }) => `Teams.Name = '${cargoValue(team)}'`).join(" OR ")})`
    : "Teams.Name = '__NO_TIER_ONE_TEAMS__'";
  const teamRows = await cargoQuery({
    tables: "Teams",
    fields: "Name,OverviewPage,Short,Region,Image,Website",
    where: teamWhere,
    limit: 50,
  });

  const teamsByName = new Map(teamRows.map((row) => [normalized(row.Name), row]));
  const imagesByPlayer = new Map();
  for (const image of playerImages) {
    const key = `${playerSlug(image.Link)}::${normalized(image.Team)}`;
    if (!imagesByPlayer.has(key)) imagesByPlayer.set(key, image);
  }

  return {
    year,
    asOf,
    sourceTables: ["Tournaments", "TournamentRosters", "PlayerImages", "Teams"],
    queryScope: { competitionIds: [...new Set(parsed.teams.map(({ competitionId }) => competitionId))] },
    teams: parsed.teams.map((team) => {
      const sourceTeam = teamsByName.get(normalized(team.team)) || null;
      return {
        ...team,
        sourceTeam,
        candidateSources: [
          approvedWebsiteCandidate(sourceTeam?.Website),
          leaguepediaFileSource(sourceTeam?.Image),
        ].filter(Boolean),
      };
    }),
    players: parsed.players.map((player) => ({
      ...player,
      candidateImage: (() => {
        const row = imagesByPlayer.get(`${player.playerId}::${normalized(player.team)}`);
        return row ? {
          fileName: row.FileName,
          link: row.Link,
          team: row.Team,
          tournament: row.Tournament,
          sortDate: row.SortDate,
        } : null;
      })(),
      candidateSources: (() => {
        const row = imagesByPlayer.get(`${player.playerId}::${normalized(player.team)}`);
        const source = leaguepediaFileSource(row?.FileName);
        return source ? [source] : [];
      })(),
    })),
  };
}

function entryHasTeam(entry, team) {
  return [entry.team, ...(entry.teamAliases || [])].map(normalized).includes(normalized(team));
}

function entryHasPlayer(entry, player) {
  return [entry.playerId, ...(entry.playerIdAliases || [])].map(normalized).includes(normalized(player.playerId))
    || [entry.publicName, ...(entry.playerAliases || [])].map(normalized).includes(normalized(player.publicName));
}

function compareInventoryToManifests(inventory = {}, manifests = {}) {
  const portraits = Array.isArray(manifests.portraits) ? manifests.portraits : [];
  const crests = Array.isArray(manifests.crests) ? manifests.crests : [];
  const missingTeams = (inventory.teams || []).filter(({ team }) => !crests.some((entry) => entryHasTeam(entry, team)));
  const missingPlayers = (inventory.players || []).filter((player) => !portraits.some((entry) =>
    entryHasPlayer(entry, player) && entryHasTeam(entry, player.team)
  )).sort((left, right) => left.playerId.localeCompare(right.playerId));
  return {
    asOf: inventory.asOf || "",
    counts: {
      teams: (inventory.teams || []).length,
      coveredTeams: (inventory.teams || []).length - missingTeams.length,
      missingTeams: missingTeams.length,
      players: (inventory.players || []).length,
      coveredPlayers: (inventory.players || []).length - missingPlayers.length,
      missingPlayers: missingPlayers.length,
    },
    missingTeams,
    missingPlayers,
  };
}

module.exports = {
  compareInventoryToManifests,
  fetchTierOneAssetInventory,
  parseRosterRows,
  playerSlug,
  splitAlignedList,
};
