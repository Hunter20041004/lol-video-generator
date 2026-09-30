const test = require("node:test");
const assert = require("node:assert/strict");
const { loadProjectEnv } = require("../../../utils/envLoader");
const { fetchTierOneSchedule } = require("../../../utils/esports/scheduleFetcher");
const { classifyTierOneTournament } = require("../../../utils/esports/competitionRegistry");

test("live schedule join retains both known UTC endpoint days and tier-one identity", async (t) => {
  if (process.env.RUN_EXTERNAL_RANGE_CONTRACT !== "1") return t.skip("Set RUN_EXTERNAL_RANGE_CONTRACT=1 for the live schedule boundary.");
  loadProjectEnv();
  const rows = await fetchTierOneSchedule({ startDate: "2026-08-27", endDate: "2026-08-28" });
  assert.ok(rows.some((row) => row.date === "2026-08-27" && row.league === "LCK"));
  assert.ok(rows.some((row) => row.date === "2026-08-28" && row.league === "LEC"));
  assert.equal(new Set(rows.map((row) => row.scheduleId)).size, rows.length);
  for (const row of rows) {
    assert.ok(classifyTierOneTournament(row.tournament));
    assert.ok(row.date >= "2026-08-27" && row.date <= "2026-08-28");
    assert.equal(row.canPreview, false);
  }
});
