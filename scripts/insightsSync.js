#!/usr/bin/env node
const { loadProjectEnv } = require("../utils/envLoader");
loadProjectEnv();

const { syncPublishedInsights } = require("../utils/publishing/insights");

async function main() {
  const args = process.argv.slice(2);
  const getArg = (name) => {
    const index = args.indexOf(name);
    return index >= 0 ? args[index + 1] : "";
  };

  const result = await syncPublishedInsights({
    platform: getArg("--platform"),
    locale: getArg("--locale"),
    limit: getArg("--limit"),
    force: args.includes("--force"),
  });

  console.log(JSON.stringify({
    success: result.success,
    considered: result.considered,
    synced: result.synced,
    skipped: result.skipped,
    failed: result.failed,
    needsAuth: result.needsAuth,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
