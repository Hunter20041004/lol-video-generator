function parseScheduleTime(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeScheduledAt(value) {
  const date = parseScheduleTime(value);
  return date ? date.toISOString() : null;
}

function isTaskDue(task, now = new Date()) {
  const scheduledAt = parseScheduleTime(task?.scheduledAt);
  if (!scheduledAt) return true;
  return scheduledAt.getTime() <= now.getTime();
}

function filterDueTasks(tasks = [], now = new Date()) {
  return tasks.filter((task) => isTaskDue(task, now));
}

function resolveSchedulerCron(value = process.env.PUBLISH_SCHEDULER_CRON) {
  return value || "* * * * *";
}

module.exports = {
  parseScheduleTime,
  normalizeScheduledAt,
  isTaskDue,
  filterDueTasks,
  resolveSchedulerCron,
};
