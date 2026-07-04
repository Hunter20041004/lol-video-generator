#!/usr/bin/env node
const { loadProjectEnv } = require("../utils/envLoader");
loadProjectEnv();

const { listTasks } = require("../utils/publishing/queueStore");
const { processQueuedTasks } = require("../utils/publishing");

async function main() {
  const [command = "list", ...args] = process.argv.slice(2);
  const getArg = (name) => {
    const index = args.indexOf(name);
    return index >= 0 ? args[index + 1] : "";
  };

  if (command === "list") {
    const status = getArg("--status");
    const platform = getArg("--platform");
    const locale = getArg("--locale");
    const tasks = listTasks({ status, platform, locale });
    console.table(tasks.map((task) => ({
      id: task.id,
      status: task.status,
      platform: task.platform,
      locale: task.locale,
      scheduledAt: task.scheduledAt || "",
      video: task.fileName,
      title: task.copy?.title,
    })));
    return;
  }

  if (command === "run") {
    const platform = getArg("--platform");
    const locale = getArg("--locale");
    const dueOnly = args.includes("--due");
    const now = getArg("--now");
    const result = await processQueuedTasks({ platform, locale, dueOnly, now });
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log("Usage:");
  console.log("  node scripts/publishQueue.js list [--status QUEUED] [--platform instagram] [--locale zh]");
  console.log("  node scripts/publishQueue.js run  [--platform threads] [--locale zh] [--due] [--now ISO_DATE]");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
