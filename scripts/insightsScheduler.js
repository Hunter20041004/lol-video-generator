#!/usr/bin/env node
const cron = require("node-cron");
const { loadProjectEnv } = require("../utils/envLoader");
loadProjectEnv();

const { syncPublishedInsights } = require("../utils/publishing/insights");

const cronExpression = process.env.INSIGHTS_SCHEDULER_CRON || "15 * * * *";

async function runCycle() {
  const result = await syncPublishedInsights();
  console.log(
    `[InsightsScheduler] synced=${result.synced} skipped=${result.skipped} failed=${result.failed} needsAuth=${result.needsAuth}`
  );
}

if (!cron.validate(cronExpression)) {
  console.error(`[InsightsScheduler] Invalid cron expression: ${cronExpression}`);
  process.exit(1);
}

console.log(`[InsightsScheduler] Running with cron: ${cronExpression}`);
cron.schedule(cronExpression, () => {
  runCycle().catch((error) => {
    console.error("[InsightsScheduler] Cycle failed:", error);
  });
});

if (process.argv.includes("--now")) {
  runCycle().catch((error) => {
    console.error("[InsightsScheduler] Initial cycle failed:", error);
  });
}
