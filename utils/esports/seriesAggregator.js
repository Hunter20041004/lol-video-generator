const ROLE_ORDER = ["Top", "Jungle", "Mid", "Adc", "Support"];

const ROLE_ALIASES = {
  top: "Top",
  toplane: "Top",
  jungle: "Jungle",
  jungler: "Jungle",
  jg: "Jungle",
  mid: "Mid",
  middle: "Mid",
  midlane: "Mid",
  adc: "Adc",
  bot: "Adc",
  bottom: "Adc",
  botlane: "Adc",
  marksman: "Adc",
  support: "Support",
  sup: "Support",
  supp: "Support",
};

const RADAR_BOUNDS = {
  KDA: { min: 0, max: 10 },
  DPM: { min: 200, max: 900 },
  "KP%": { min: 0.35, max: 0.95 },
  GPM: { min: 220, max: 520 },
  CSM: { min: 0, max: 10 },
  VPM: { min: 0, max: 3 },
};

function normalizeRole(role = "") {
  const key = String(role || "").trim().toLowerCase();
  return ROLE_ALIASES[key] || role || "Mid";
}

function parseNumber(value) {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const parsed = Number(String(value).replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function number(value, fallback = 0) {
  const parsed = parseNumber(value);
  return parsed === null ? fallback : parsed;
}

function round(value, digits = 2) {
  const multiplier = 10 ** digits;
  return Math.round((Number(value) || 0) * multiplier) / multiplier;
}

function getDurationSeconds(game = {}) {
  if (Number.isFinite(Number(game.durationSeconds))) return Number(game.durationSeconds);
  if (Number.isFinite(Number(game.durationMinutes))) return Number(game.durationMinutes) * 60;
  if (Number.isFinite(Number(game.gamelengthMin))) return Number(game.gamelengthMin) * 60;
  const raw = String(game.gamelengthStr || game.Gamelength || "");
  const match = raw.match(/(\d+)\s*[:m]\s*(\d+)?/i);
  if (match) return Number(match[1]) * 60 + Number(match[2] || 0);
  return 0;
}

function getTeams(game = {}) {
  const teamA = game.teamA || game.team1 || game.Team1 || game.matchContext?.teamA || "";
  const teamB = game.teamB || game.team2 || game.Team2 || game.matchContext?.teamB || "";
  return [teamA, teamB].filter(Boolean);
}

function getTeamKills(players = [], team) {
  let total = 0;
  let hasMissingKills = false;
  for (const player of players.filter((candidate) => candidate.team === team || candidate.Team === team)) {
    const kills = readPlayerStat(player, ["kills", "Kills"]);
    if (kills === null) {
      hasMissingKills = true;
    } else {
      total += kills;
    }
  }
  return hasMissingKills ? null : total;
}

function readPlayerStat(player = {}, names = []) {
  for (const name of names) {
    if (player[name] !== undefined) return parseNumber(player[name]);
    if (player.stats?.[name] !== undefined) return parseNumber(player.stats[name]);
  }
  return null;
}

function normalizePlayer(player = {}) {
  return {
    name: player.name || player.Name || player.Link || "Unknown",
    team: player.team || player.Team || "",
    role: normalizeRole(player.role || player.Role || ""),
    champion: player.champion || player.Champion || "",
    kills: readPlayerStat(player, ["kills", "Kills"]),
    deaths: readPlayerStat(player, ["deaths", "Deaths"]),
    assists: readPlayerStat(player, ["assists", "Assists"]),
    damageToChampions: readPlayerStat(player, ["damageToChampions", "DamageToChampions", "DamageToChamps"]),
    gold: readPlayerStat(player, ["gold", "Gold"]),
    cs: readPlayerStat(player, ["cs", "CS"]),
    visionScore: readPlayerStat(player, ["visionScore", "VisionScore", "vision"]),
  };
}

function normalizeScore(value, bounds) {
  const clamped = Math.max(bounds.min, Math.min(bounds.max, value));
  return Math.round(((clamped - bounds.min) / (bounds.max - bounds.min)) * 100);
}

function buildRadarStats(rawStats = {}) {
  return [
    ["KDA", rawStats.kda],
    ["DPM", rawStats.dpm],
    ["KP%", rawStats.kp],
    ["GPM", rawStats.gpm],
    [rawStats.role === "Support" ? "VPM" : "CSM", rawStats.role === "Support" ? rawStats.vpm : rawStats.csm],
  ]
    .map(([label, value]) => [label, parseNumber(value)])
    .filter(([, value]) => value !== null)
    .map(([label, value]) => ({
      label,
      rawValue: label === "KP%" ? `${Math.round(value * 100)}%` : String(value),
      normalizedScore: normalizeScore(value, RADAR_BOUNDS[label] || RADAR_BOUNDS.CSM),
    }));
}

function comparePlayers(a, b) {
  const teamCompare = String(a.team).localeCompare(String(b.team));
  if (teamCompare !== 0) return teamCompare;
  return ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role);
}

function addKnownStat(target, field, value) {
  if (Number.isFinite(value)) {
    target[field] += value;
  } else if (target.missingStats) {
    target.missingStats.add(field);
  }
}

function markMissingStat(target, field) {
  if (target.missingStats) target.missingStats.add(field);
}

function statIsComplete(total, field) {
  return !total.missingStats?.has(field);
}

function aggregateSeries(gamesInput = []) {
  const games = Array.isArray(gamesInput) ? gamesInput : [];
  if (games.length === 0) {
    throw new Error("aggregateSeries requires at least one game.");
  }

  const first = games[0];
  const teams = getTeams(first);
  const seriesId = first.seriesId || first.matchId || first.MatchId || [first.date, ...teams].filter(Boolean).join("::");
  const playerMap = new Map();
  const teamStats = {};
  const score = {};

  for (const team of teams) {
    teamStats[team] = {
      kills: 0,
      deaths: 0,
      assists: 0,
      damageToChampions: 0,
      gold: 0,
      cs: 0,
      visionScore: 0,
    };
    score[team] = 0;
  }

  for (const game of games) {
    const durationSeconds = getDurationSeconds(game);
    const gamePlayers = (Array.isArray(game.players) ? game.players : []).map(normalizePlayer);
    const perTeamKills = Object.fromEntries(teams.map((team) => [team, getTeamKills(gamePlayers, team)]));
    if (game.winTeam && score[game.winTeam] !== undefined) score[game.winTeam] += 1;

    for (const player of gamePlayers) {
      const key = [player.team, player.role, player.name].join("::");
      if (!playerMap.has(key)) {
        playerMap.set(key, {
          name: player.name,
          team: player.team,
          role: player.role,
          champions: [],
          totals: {
            kills: 0,
            deaths: 0,
            assists: 0,
            damageToChampions: 0,
            gold: 0,
            cs: 0,
            visionScore: 0,
            durationSeconds: 0,
            teamKills: 0,
            missingStats: new Set(),
          },
        });
      }

      const aggregate = playerMap.get(key);
      if (player.champion) aggregate.champions.push(player.champion);
      addKnownStat(aggregate.totals, "kills", player.kills);
      addKnownStat(aggregate.totals, "deaths", player.deaths);
      addKnownStat(aggregate.totals, "assists", player.assists);
      addKnownStat(aggregate.totals, "damageToChampions", player.damageToChampions);
      addKnownStat(aggregate.totals, "gold", player.gold);
      addKnownStat(aggregate.totals, "cs", player.cs);
      addKnownStat(aggregate.totals, "visionScore", player.visionScore);
      aggregate.totals.durationSeconds += durationSeconds;
      if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
        markMissingStat(aggregate.totals, "durationSeconds");
      }
      addKnownStat(aggregate.totals, "teamKills", perTeamKills[player.team]);

      if (teamStats[player.team]) {
        addKnownStat(teamStats[player.team], "kills", player.kills);
        addKnownStat(teamStats[player.team], "deaths", player.deaths);
        addKnownStat(teamStats[player.team], "assists", player.assists);
        addKnownStat(teamStats[player.team], "damageToChampions", player.damageToChampions);
        addKnownStat(teamStats[player.team], "gold", player.gold);
        addKnownStat(teamStats[player.team], "cs", player.cs);
        addKnownStat(teamStats[player.team], "visionScore", player.visionScore);
      }
    }
  }

  const players = [...playerMap.values()].map((player) => {
    const totals = player.totals;
    const minutes = totals.durationSeconds > 0 ? totals.durationSeconds / 60 : null;
    const hasKda = statIsComplete(totals, "kills") && statIsComplete(totals, "deaths") && statIsComplete(totals, "assists");
    const hasPerMinuteDenominator = Number.isFinite(minutes)
      && minutes > 0
      && statIsComplete(totals, "durationSeconds");
    const rawStats = {
      role: player.role,
      kills: statIsComplete(totals, "kills") ? totals.kills : null,
      deaths: statIsComplete(totals, "deaths") ? totals.deaths : null,
      assists: statIsComplete(totals, "assists") ? totals.assists : null,
      damageToChampions: statIsComplete(totals, "damageToChampions") ? totals.damageToChampions : null,
      gold: statIsComplete(totals, "gold") ? totals.gold : null,
      cs: statIsComplete(totals, "cs") ? totals.cs : null,
      visionScore: statIsComplete(totals, "visionScore") ? totals.visionScore : null,
      kda: hasKda
        ? (totals.deaths === 0 ? totals.kills + totals.assists : round((totals.kills + totals.assists) / totals.deaths, 2))
        : null,
      dpm: hasPerMinuteDenominator && statIsComplete(totals, "damageToChampions") ? Math.round(totals.damageToChampions / minutes) : null,
      gpm: hasPerMinuteDenominator && statIsComplete(totals, "gold") ? Math.round(totals.gold / minutes) : null,
      csm: hasPerMinuteDenominator && statIsComplete(totals, "cs") ? round(totals.cs / minutes, 2) : null,
      vpm: hasPerMinuteDenominator && statIsComplete(totals, "visionScore") ? round(totals.visionScore / minutes, 2) : null,
      kp: hasKda && statIsComplete(totals, "teamKills") && totals.teamKills > 0
        ? round((totals.kills + totals.assists) / totals.teamKills, 2)
        : null,
    };
    return {
      name: player.name,
      team: player.team,
      role: player.role,
      champions: [...new Set(player.champions)],
      rawStats,
      radarStats: buildRadarStats(rawStats),
    };
  }).sort(comparePlayers);

  const roleMatchups = ROLE_ORDER.map((role) => {
    const left = players.find((player) => player.team === teams[0] && player.role === role) || null;
    const right = players.find((player) => player.team === teams[1] && player.role === role) || null;
    return { role, left, right };
  });

  const missingRoles = roleMatchups
    .filter((matchup) => !matchup.left || !matchup.right)
    .map((matchup) => matchup.role);

  const gameTeamStats = games.map((game, index) => ({
    gameNumber: index + 1,
    gameId: game.gameId || game.GameId || "",
    winningTeam: game.winTeam || game.WinTeam || "",
    hasEventTimestamps: false,
    teams: Array.isArray(game.teamFinalStats)
      ? game.teamFinalStats.map((team) => ({ ...team }))
      : [],
  }));

  return {
    seriesId,
    date: first.date || first.dateUtc || first.DateTime_UTC || "",
    league: first.league || first.matchContext?.league || "",
    tournament: first.tournament || first.Tournament || "",
    teams,
    teamA: teams[0] || "",
    teamB: teams[1] || "",
    winningTeam: Object.entries(score).sort((a, b) => b[1] - a[1])[0]?.[0] || first.winTeam || "",
    score: teams.length >= 2 ? `${score[teams[0]] || 0}-${score[teams[1]] || 0}` : "",
    games: games.length,
    gameTeamStats,
    players,
    roleMatchups,
    teamStats,
    completeness: {
      hasTenPlayers: players.length === 10,
      hasFiveRoleMatchups: missingRoles.length === 0,
      missingRoles,
    },
  };
}

module.exports = {
  RADAR_BOUNDS,
  ROLE_ORDER,
  aggregateSeries,
  buildRadarStats,
  normalizeRole,
};
