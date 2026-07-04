const test = require("node:test");
const assert = require("node:assert/strict");

const {
  normalizeScheduledAt,
  isTaskDue,
  filterDueTasks,
  resolveSchedulerCron,
} = require("../../../utils/publishing/schedule");

test("normalizes valid scheduledAt values to ISO and rejects invalid values", () => {
  assert.equal(
    normalizeScheduledAt("2026-05-22T10:00:00+08:00"),
    "2026-05-22T02:00:00.000Z"
  );
  assert.equal(normalizeScheduledAt("not-a-date"), null);
  assert.equal(normalizeScheduledAt(""), null);
});

test("treats unscheduled tasks as due for manual and catch-up publishing", () => {
  assert.equal(isTaskDue({}, new Date("2026-05-22T02:00:00.000Z")), true);
});

test("filters future tasks out of due publishing cycles", () => {
  const now = new Date("2026-05-22T02:00:00.000Z");
  const tasks = [
    { id: "past", scheduledAt: "2026-05-22T01:59:00.000Z" },
    { id: "now", scheduledAt: "2026-05-22T02:00:00.000Z" },
    { id: "future", scheduledAt: "2026-05-22T02:01:00.000Z" },
    { id: "none" },
  ];

  assert.deepEqual(filterDueTasks(tasks, now).map((task) => task.id), ["past", "now", "none"]);
});

test("uses every minute as the safe scheduler default", () => {
  assert.equal(resolveSchedulerCron(""), "* * * * *");
  assert.equal(resolveSchedulerCron("*/5 * * * *"), "*/5 * * * *");
});
