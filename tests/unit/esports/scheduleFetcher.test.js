const test = require("node:test");
const assert = require("node:assert/strict");

test("schedule fetch joins tier-one tournament identity and queries inclusive UTC boundaries", async () => {
  const { fetchTierOneSchedule } = require("../../../utils/esports/scheduleFetcher");
  let query;
  const schedule = await fetchTierOneSchedule({ startDate: "2026-09-01", endDate: "2026-09-02" }, {
    cargoQuery: async (value) => { query = value; return [{
      MatchId: "fixture", Tournament: "LCK 2026 Season", Team1: "T1", Team2: "GEN",
      "DateTime UTC": "2026-09-02 12:00:00", HasTime: "1", Winner: "", IsNullified: "0",
    }]; },
    now: () => new Date("2026-09-01T00:00:00Z"),
  });
  assert.equal(query.tables, "MatchSchedule,Tournaments");
  assert.match(query.join_on, /OverviewPage/);
  assert.match(query.where, />= '2026-09-01 00:00:00'/);
  assert.match(query.where, /< '2026-09-03 00:00:00'/);
  assert.equal(query.requireComplete, true);
  assert.equal(schedule[0].status, "scheduled");
  assert.equal(schedule[0].date, "2026-09-02");
  assert.equal(schedule[0].dateUtc, "2026-09-02T12:00:00.000Z");
  assert.equal(schedule[0].canPreview, false);
});

test("invalid source identity or timestamp fails rather than reporting a complete list", async () => {
  const { fetchTierOneSchedule } = require("../../../utils/esports/scheduleFetcher");
  for (const row of [
    { Tournament: "LCK 2026 Season", "DateTime UTC": "2026-09-02 12:00:00" },
    { MatchId: "bad", Tournament: "LCK 2026 Season", "DateTime UTC": "2026-09-02 invalid" },
  ]) {
    await assert.rejects(fetchTierOneSchedule({ startDate: "2026-09-01", endDate: "2026-09-02" }, {
      cargoQuery: async () => [row],
    }), { code: "LEAGUEPEDIA_UPSTREAM_ERROR" });
  }
});

test("schedule excludes cancelled, secondary and out-of-range rows and deduplicates identities", async () => {
  const { fetchTierOneSchedule } = require("../../../utils/esports/scheduleFetcher");
  const base = { MatchId: "ok", Tournament: "LCK 2026 Season", Team1: "T1", Team2: "GEN",
    "DateTime UTC": "2026-09-02 12:00:00", Winner: "1", Team1Score: "3", Team2Score: "2", IsNullified: "0" };
  const schedule = await fetchTierOneSchedule({ startDate: "2026-09-01", endDate: "2026-09-02" }, {
    cargoQuery: async () => [base, base, { ...base, MatchId: "nullified", IsNullified: "1" },
      { ...base, MatchId: "academy", Tournament: "LCK CL 2026" },
      { ...base, MatchId: "old", "DateTime UTC": "2026-08-31 12:00:00" }],
  });
  assert.equal(schedule.length, 1);
  assert.equal(schedule[0].status, "completed");
  assert.equal(schedule[0].seriesScore, "3-2");
});
