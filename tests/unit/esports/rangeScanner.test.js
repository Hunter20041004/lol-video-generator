const test = require("node:test");
const assert = require("node:assert/strict");

function candidate(date) {
  return { seriesId: `series-${date}`, date, tournament: "LCK 2026 Season", teamA: "T1", teamB: "GEN",
    seriesScore: "3-2", completeness: { hasTenPlayers: true, hasFiveRoleMatchups: true },
    players: Array.from({ length: 10 }, () => ({})), roleMatchups: Array.from({ length: 5 }, () => ({ left: {}, right: {} })) };
}

test("range scan preserves both days and lists future schedule without fetching future scores", async () => {
  const { scanEsportsDateRange } = require("../../../utils/esports/rangeScanner");
  const dates = [];
  let saved;
  const result = await scanEsportsDateRange({ startDate: "2026-09-01", endDate: "2026-09-03" }, {
    now: () => new Date("2026-09-02T20:00:00Z"),
    fetchSchedule: async () => ["2026-09-01", "2026-09-02", "2026-09-03"].map((date) => ({
      ...candidate(date), seriesId: `schedule-${date}`, status: date === "2026-09-03" ? "scheduled" : "completed", canPreview: false,
    })),
    scanDate: async ({ date }) => { dates.push(date); return { createdAt: "2026-09-02T20:00:00Z", candidates: [candidate(date)], sourceStatus: { status: "ready" } }; },
    writeSnapshot: (value) => { saved = value; return value; },
  });
  assert.deepEqual(dates, ["2026-09-01", "2026-09-02"]);
  assert.equal(result.entries.length, 3);
  assert.deepEqual(result.candidates.map((value) => value.date), dates);
  assert.equal(result.entries[2].canPreview, false);
  assert.equal(saved.candidates.length, 2);
  assert.deepEqual(result.range, { startDate: "2026-09-01", endDate: "2026-09-03" });
});

test("mixing today's scores with an older fallback fails before persisting an immediately expired preview", async () => {
  const { scanEsportsDateRange } = require("../../../utils/esports/rangeScanner");
  await assert.rejects(scanEsportsDateRange({ startDate: "2026-09-01", endDate: "2026-09-03" }, {
    now: () => new Date("2026-09-03T20:00:00Z"),
    fetchSchedule: async () => [{ ...candidate("2026-09-03"), status: "completed" }],
    scanDate: async ({ date }) => ({ createdAt: date === "2026-09-03" ? "2026-09-03T20:00:00Z" : "2026-09-01T20:00:00Z",
      candidates: date === "2026-09-03" ? [candidate(date)] : [], sourceStatus: { status: "cached", cacheReason: "rate_limit" } }),
    writeSnapshot: () => assert.fail("Must not persist unusable range"),
  }), { code: "ESPORTS_RANGE_CACHE_EXPIRED" });
});

test("a range ending in the future retains the historical preview date for seven-day fallback eligibility", async () => {
  const { scanEsportsDateRange } = require("../../../utils/esports/rangeScanner");
  const result = await scanEsportsDateRange({ startDate: "2026-09-01", endDate: "2026-09-04" }, {
    now: () => new Date("2026-09-03T20:00:00Z"),
    fetchSchedule: async () => [{ ...candidate("2026-09-01"), status: "completed" }],
    scanDate: async ({ date }) => ({ createdAt: "2026-09-02T10:00:00Z", candidates: date === "2026-09-01" ? [candidate(date)] : [], sourceStatus: { status: "cached", cacheReason: "rate_limit" } }),
    writeSnapshot: (value) => value,
  });
  assert.equal(result.date, "2026-09-01");
  assert.equal(result.range.endDate, "2026-09-04");
});

test("unmatched or ambiguous scoreboard rows cannot add phantom schedule entries", async () => {
  const { scanEsportsDateRange } = require("../../../utils/esports/rangeScanner");
  const result = await scanEsportsDateRange({ startDate: "2026-09-01", endDate: "2026-09-01" }, {
    now: () => new Date("2026-09-02T20:00:00Z"),
    fetchSchedule: async () => [{ ...candidate("2026-09-01"), seriesId: "schedule", status: "completed" }],
    scanDate: async () => ({ createdAt: "2026-09-02T20:00:00Z", candidates: [candidate("2026-09-01"), candidate("2026-09-01"), { ...candidate("2026-09-01"), teamA: "Cancelled" }] }),
    writeSnapshot: (value) => value,
  });
  assert.equal(result.entries.length, 1);
  assert.equal(result.candidates.length, 0);
});

test("opposite schedule team ordering preserves the stats team's score orientation", async () => {
  const { scanEsportsDateRange } = require("../../../utils/esports/rangeScanner");
  const result = await scanEsportsDateRange({ startDate: "2026-09-01", endDate: "2026-09-01" }, {
    now: () => new Date("2026-09-02T20:00:00Z"),
    fetchSchedule: async () => [{ ...candidate("2026-09-01"), teamA: "GEN", teamB: "T1", seriesId: "scheduled", status: "completed", seriesScore: "2-3" }],
    scanDate: async () => ({ createdAt: "2026-09-02T20:00:00Z", candidates: [{ ...candidate("2026-09-01"), score: "3-2", games: 5 }] }),
    writeSnapshot: (value) => value,
  });
  assert.equal(result.candidates[0].teamA, "T1");
  assert.equal(result.candidates[0].seriesScore, "3-2");
});

test("invalid range and failed source never persist a partial range", async () => {
  const { scanEsportsDateRange } = require("../../../utils/esports/rangeScanner");
  let queries = 0;
  let writes = 0;
  const deps = { now: () => new Date("2026-09-03T20:00:00Z"), fetchSchedule: async () => { queries++; return []; },
    scanDate: async ({ date }) => { if (date === "2026-09-02") throw new Error("source failure"); return { createdAt: "2026-09-03T20:00:00Z", candidates: [] }; },
    writeSnapshot: () => { writes++; } };
  await assert.rejects(scanEsportsDateRange({ startDate: "2026-09-01' OR 1=1", endDate: "2026-09-02" }, deps), { code: "ESPORTS_DATE_RANGE_INVALID" });
  assert.equal(queries, 0);
  await assert.rejects(scanEsportsDateRange({ startDate: "2026-09-01", endDate: "2026-09-02" }, deps), /source failure/);
  assert.equal(writes, 0);
});

test("cache provenance keeps the oldest data timestamp and original candidate identity per date", async () => {
  const { scanEsportsDateRange } = require("../../../utils/esports/rangeScanner");
  const result = await scanEsportsDateRange({ startDate: "2026-09-01", endDate: "2026-09-02" }, {
    now: () => new Date("2026-09-03T20:00:00Z"),
    fetchSchedule: async () => ["2026-09-01", "2026-09-02"].map((date) => ({ ...candidate(date), seriesId: `schedule-${date}`, status: "completed" })),
    scanDate: async ({ date }) => ({ createdAt: "2026-09-03T10:00:00Z", candidates: [{ ...candidate(date), seriesId: "same-id" }], sourceStatus: { status: "cached", cacheReason: "rate_limit" } }),
    writeSnapshot: (value) => value,
  });
  assert.equal(result.sourceStatus.status, "cached");
  assert.equal(result.createdAt, "2026-09-03T10:00:00.000Z");
  assert.equal(result.sourceStatus.cachedAt, result.createdAt);
  assert.equal(new Set(result.candidates.map((value) => value.seriesId)).size, 2);
});

test("completed schedule with partial series scores is not previewable", async () => {
  const { scanEsportsDateRange } = require("../../../utils/esports/rangeScanner");
  const result = await scanEsportsDateRange({ startDate: "2026-09-01", endDate: "2026-09-01" }, {
    now: () => new Date("2026-09-02T20:00:00Z"),
    fetchSchedule: async () => [{ ...candidate("2026-09-01"), seriesId: "scheduled", status: "completed", seriesScore: "3-2" }],
    scanDate: async () => ({ createdAt: "2026-09-02T20:00:00Z", candidates: [{ ...candidate("2026-09-01"), seriesScore: "1-0", games: 1 }] }),
    writeSnapshot: (value) => value,
  });
  assert.equal(result.candidates.length, 0);
  assert.equal(result.entries[0].canPreview, false);
});
