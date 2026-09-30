const test = require("node:test");
const assert = require("node:assert/strict");

test("inclusive UTC date ranges retain both endpoints across month boundaries", () => {
  const { parseDateRange } = require("../../../utils/esports/dateRange");
  assert.deepEqual(parseDateRange("2026-08-31", "2026-09-02"), {
    startDate: "2026-08-31", endDate: "2026-09-02",
    dates: ["2026-08-31", "2026-09-01", "2026-09-02"],
  });
});

test("invalid, reversed and over-31-day ranges are rejected rather than truncated", () => {
  const { parseDateRange } = require("../../../utils/esports/dateRange");
  for (const [start, end] of [["2026-02-30", "2026-03-01"], ["2026-09-02", "2026-09-01"],
    ["2026-08-01", "2026-09-01"], ["x' OR 1=1", "2026-09-01"], [null, "2026-09-01"],
    ["2026-09-01", undefined], [[], "2026-09-01"]]) {
    assert.throws(() => parseDateRange(start, end), (error) => error.code === "ESPORTS_DATE_RANGE_INVALID");
  }
  assert.equal(parseDateRange("2026-08-01", "2026-08-31").dates.length, 31);
  assert.equal(parseDateRange("2026-09-01", "2026-09-01").dates.length, 1);
});
