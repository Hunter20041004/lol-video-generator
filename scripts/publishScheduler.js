#!/usr/bin/env node
const cron = require("node-cron");
const { loadProjectEnv } = require("../utils/envLoader");
loadProjectEnv();

const { processQueuedTasks } = require("../utils/publishing");
const { resolveSchedulerCron } = require("../utils/publishing/schedule");
const { syncPublishedInsights } = require("../utils/publishing/insights");

const cronExpression = resolveSchedulerCron();

async function runCycle() {
  const result = await processQueuedTasks({ dueOnly: true });
  if (result.processed > 0) {
    console.log(`[PublishScheduler] Published ${result.processed} due task(s).`);
    console.log(JSON.stringify(result.summary, null, 2));
  } else {
    console.log("[PublishScheduler] No due tasks.");
  }

  const insights = await syncPublishedInsights();
  if (insights.synced > 0 || insights.failed > 0 || insights.needsAuth > 0) {
    console.log(
      `[PublishScheduler] Insights synced=${insights.synced} failed=${insights.failed} needsAuth=${insights.needsAuth}.`
    );
  }
}

if (!cron.validate(cronExpression)) {
  console.error(`[PublishScheduler] Invalid cron expression: ${cronExpression}`);
  process.exit(1);
}

console.log(`[PublishScheduler] Running with cron: ${cronExpression}`);
cron.schedule(cronExpression, () => {
  runCycle().catch((error) => {
    console.error("[PublishScheduler] Cycle failed:", error);
  });
});

if (process.argv.includes("--now")) {
  runCycle().catch((error) => {
    console.error("[PublishScheduler] Initial cycle failed:", error);
  });
}
