#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const rootDir = path.resolve(__dirname, "..");
const manifestPath = path.join(rootDir, "config", "tdd-coverage.json");

function readManifest() {
  return JSON.parse(fs.readFileSync(manifestPath, "utf8"));
}

function uniq(values) {
  return [...new Set(values)];
}

function main() {
  const manifest = readManifest();
  const thresholds = manifest.thresholds || {};
  const slices = Array.isArray(manifest.slices) ? manifest.slices : [];
  const testGlobs = Array.isArray(manifest.testGlobs) && manifest.testGlobs.length > 0
    ? manifest.testGlobs
    : ["tests/**/*.test.js"];

  const productionFiles = uniq(slices.flatMap((slice) => slice.productionFiles || []));
  if (productionFiles.length === 0) {
    console.error("No production files are registered in config/tdd-coverage.json.");
    process.exit(1);
  }

  const args = [
    "--test",
    "--experimental-test-coverage",
    `--test-coverage-lines=${thresholds.lines ?? 80}`,
    `--test-coverage-branches=${thresholds.branches ?? 80}`,
    `--test-coverage-functions=${thresholds.functions ?? 80}`,
    ...productionFiles.map((file) => `--test-coverage-include=${file}`),
    ...testGlobs,
  ];

  console.log(`TDD coverage gate: ${productionFiles.length} production file(s), ${slices.length} slice(s).`);

  const result = spawnSync(process.execPath, args, {
    cwd: rootDir,
    stdio: "inherit",
  });

  if (result.error) {
    console.error(result.error);
    process.exit(1);
  }

  process.exit(result.status ?? 1);
}

main();
