#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const { buildApprovedSourcesFromCoverage } = require("../utils/esports/assetImporter");

const HELP = "Usage: node scripts/approveEsportsAssetCandidates.js --coverage=<report.json> --reviewed-at=<ISO timestamp>\n";

function argumentValue(argv, name) {
  return argv.find((arg) => arg.startsWith(`${name}=`))?.slice(name.length + 1) || "";
}

function writeJson(filePath, value) {
  const tempPath = `${filePath}.tmp`;
  fs.writeFileSync(tempPath, `${JSON.stringify(value, null, 2)}\n`);
  fs.renameSync(tempPath, filePath);
}

function main(argv = process.argv.slice(2)) {
  if (argv.includes("--help")) return process.stdout.write(HELP);
  const coverageArgument = argumentValue(argv, "--coverage");
  const reviewedAt = argumentValue(argv, "--reviewed-at");
  if (!coverageArgument || !/^\d{4}-\d{2}-\d{2}T/.test(reviewedAt)) throw new Error(HELP.trim());
  const rootDir = process.cwd();
  const coverageReport = JSON.parse(fs.readFileSync(path.resolve(rootDir, coverageArgument), "utf8"));
  const sourcePath = path.join(rootDir, "config/esports-asset-sources-2026.json");
  const config = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
  const promoted = buildApprovedSourcesFromCoverage(coverageReport.coverage, {
    year: coverageReport.inventory.year,
    reviewedAt,
  });
  const existingIds = new Set((config.assets || []).map(({ assetId }) => assetId));
  const additions = promoted.filter(({ assetId }) => !existingIds.has(assetId));
  config.assets.push(...additions);
  writeJson(sourcePath, config);
  process.stdout.write(`${JSON.stringify({ approvedCandidates: promoted.length, added: additions.length })}\n`);
}

if (require.main === module) {
  try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}

module.exports = { argumentValue, main, writeJson };
