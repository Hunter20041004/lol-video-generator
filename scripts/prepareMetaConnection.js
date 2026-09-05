#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const { loadProjectEnv } = require("../utils/envLoader");
const { prepareMetaConnection } = require("../utils/publishing/prepareMetaConnection");
const {
  getExpectedInstagramUsername,
  getExpectedThreadsUsername,
} = require("../utils/publishing/metaAuth");

function parseVideoArg(args = process.argv.slice(2)) {
  const index = args.indexOf("--video");
  const video = index >= 0 ? args[index + 1] : "";
  if (!/^\/renders\/[A-Za-z0-9][A-Za-z0-9._-]*\.mp4$/.test(video || "")) {
    throw new Error("Usage: npm run publishing:prepare -- --video /renders/<verified-file>.mp4");
  }
  const file = path.join(process.cwd(), "public", video.replace(/^\//, ""));
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) throw new Error("The selected MP4 does not exist.");
  return video;
}

async function main() {
  loadProjectEnv();
  const video = parseVideoArg();
  if (!getExpectedInstagramUsername("zh") || !getExpectedThreadsUsername("zh")) {
    throw new Error("Configure INSTAGRAM_ZH_EXPECTED_USERNAME and THREADS_ZH_EXPECTED_USERNAME before opening a public connection window.");
  }
  const result = await prepareMetaConnection({ sampleVideoUrl: video });
  console.log("Temporary publishing window is READY. Keep this terminal running.");
  console.log(`Instagram callback: ${result.callbacks.instagram}`);
  console.log(`Threads callback: ${result.callbacks.threads}`);
  console.log(`Instagram connect: http://localhost:49761/api/auth/meta/instagram?locale=zh`);
  console.log(`Threads connect: http://localhost:49761/api/auth/meta/threads?locale=zh`);
  console.log(`Verified media: ${result.mediaUrl}`);

  const stop = async () => {
    await result.stop().catch(() => {});
    process.exit(0);
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  await new Promise(() => {});
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`Publishing preparation failed: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = { parseVideoArg };
