const leaguepedia = require("../leaguepediaApi");
const { parseDateRange } = require("./dateRange");
const { buildTierOneTournamentWhere, classifyTierOneTournament } = require("./competitionRegistry");

async function fetchTierOneSchedule(options, deps = {}) {
  const range = parseDateRange(options.startDate, options.endDate);
  const nextDate = new Date(Date.parse(`${range.endDate}T00:00:00Z`) + 86400000).toISOString().slice(0, 10);
  const rows = await (deps.cargoQuery || leaguepedia.cargoQuery)({
    tables: "MatchSchedule,Tournaments",
    join_on: "MatchSchedule.OverviewPage=Tournaments.OverviewPage",
    fields: "MatchSchedule.MatchId,MatchSchedule.Team1,MatchSchedule.Team2,MatchSchedule.DateTime_UTC,MatchSchedule.HasTime,MatchSchedule.Winner,MatchSchedule.Team1Score,MatchSchedule.Team2Score,MatchSchedule.IsNullified,Tournaments.Name=Tournament",
    where: `${buildTierOneTournamentWhere("Tournaments.Name")} AND MatchSchedule.DateTime_UTC >= '${range.startDate} 00:00:00' AND MatchSchedule.DateTime_UTC < '${nextDate} 00:00:00'`,
    order_by: "MatchSchedule.DateTime_UTC ASC,MatchSchedule.MatchId ASC",
    limit: 50,
    requireComplete: true,
  });
  const now = new Date((deps.now || (() => new Date()))());
  const seen = new Set();
  return rows.filter((row) => {
    if (!classifyTierOneTournament(row.Tournament) || ["1", "true"].includes(String(row.IsNullified))) return false;
    const rawTime = String(row["DateTime UTC"] || row.DateTime_UTC || "");
    if (!row.MatchId || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(rawTime)
      || !Number.isFinite(Date.parse(`${rawTime.replace(" ", "T")}Z`))) {
      throw Object.assign(new Error("賽程來源缺少有效識別或日期，無法確認完整清單。"), { code: "LEAGUEPEDIA_UPSTREAM_ERROR" });
    }
    const day = rawTime.slice(0, 10);
    if (day < range.startDate || day > range.endDate || seen.has(row.MatchId)) return false;
    seen.add(row.MatchId);
    return true;
  }).map((row) => {
    const rawTime = row["DateTime UTC"] || row.DateTime_UTC;
    const dateUtc = new Date(`${String(rawTime).replace(" ", "T")}Z`).toISOString();
    const competition = classifyTierOneTournament(row.Tournament);
    return {
      seriesId: `schedule:${row.MatchId}`, scheduleId: row.MatchId,
      tournament: row.Tournament, league: competition?.label,
      date: dateUtc.slice(0, 10), dateUtc, hasTime: row.HasTime === "1",
      teamA: row.Team1 || "待定", teamB: row.Team2 || "待定",
      status: ["1", "2"].includes(String(row.Winner)) ? "completed" : (Date.parse(dateUtc) > now.getTime() ? "scheduled" : "awaiting_result"),
      canPreview: false,
      seriesScore: ["1", "2"].includes(String(row.Winner)) && /^\d+$/.test(String(row.Team1Score)) && /^\d+$/.test(String(row.Team2Score)) ? `${row.Team1Score}-${row.Team2Score}` : "",
    };
  });
}

module.exports = { fetchTierOneSchedule };
