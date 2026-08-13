const test = require("node:test");
const assert = require("node:assert/strict");

const { fetchMatchTeamStats } = require("../../../utils/leaguepediaApi");

test("Leaguepedia ScoreboardTeams returns two team-final rows", {
  skip: !process.env.LEAGUEPEDIA_SCOREBOARD_GAME_ID,
}, async () => {
  const rows = await fetchMatchTeamStats(process.env.LEAGUEPEDIA_SCOREBOARD_GAME_ID);

  assert.equal(rows.length, 2);
  assert.equal(new Set(rows.map((row) => row.team)).size, 2);
  assert.equal(rows.every((row) => row.source === "ScoreboardTeams"), true);
  assert.equal(rows.every((row) => row.hasEventTimestamps === false), true);
  assert.equal(rows.some((row) => Number.isFinite(row.towers)), true);
  assert.equal(rows.some((row) => Number.isFinite(row.gold)), true);
});
