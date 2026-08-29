#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const { loadProjectEnv } = require("../utils/envLoader");
const { importApprovedAsset } = require("../utils/esports/assetImporter");

const HELP = `Usage: node scripts/importEsportsAssets.js --ids=asset-id[,asset-id] [--concurrency=1-6]\n`;

async function mapWithConcurrency(items, concurrency, mapper) {
  const output = new Array(items.length);
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      output[index] = await mapper(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return output;
}

function writeJson(filePath, value) {
  const tempPath = `${filePath}.tmp`;
  fs.writeFileSync(tempPath, `${JSON.stringify(value, null, 2)}\n`);
  fs.renameSync(tempPath, filePath);
}

async function main(argv = process.argv.slice(2)) {
  if (argv.includes("--help")) return process.stdout.write(HELP);
  const idArgument = argv.find((arg) => arg.startsWith("--ids="));
  const concurrencyArgument = argv.find((arg) => arg.startsWith("--concurrency="));
  if (!idArgument || argv.some((arg) => arg !== idArgument && arg !== concurrencyArgument)) throw new Error(HELP.trim());
  const ids = [...new Set(idArgument.slice(6).split(",").map((id) => id.trim()).filter(Boolean))];
  if (ids.length === 0) throw new Error("At least one approved asset ID is required.");
  const concurrency = Number(concurrencyArgument?.slice(14) || 4);
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 6) throw new Error("--concurrency must be an integer from 1 to 6.");
  loadProjectEnv();
  const rootDir = process.cwd();
  const sources = JSON.parse(fs.readFileSync(path.join(rootDir, "config/esports-asset-sources-2026.json"), "utf8"));
  const portraitPath = path.join(rootDir, "config/esports-player-portraits.json");
  const crestPath = path.join(rootDir, "config/esports-team-crests.json");
  const portraitManifest = JSON.parse(fs.readFileSync(portraitPath, "utf8"));
  const crestManifest = JSON.parse(fs.readFileSync(crestPath, "utf8"));

  const imported = await mapWithConcurrency(ids, concurrency, async (id) => {
    const source = (sources.assets || []).find(({ assetId }) => assetId === id);
    if (!source) throw new Error(`Approved asset source not found: ${id}.`);
    const entry = await importApprovedAsset(source, { rootDir });
    process.stdout.write(`Imported ${id} -> ${entry.repositoryPath}\n`);
    return { source, entry };
  });
  for (const { source, entry } of imported) {
    const collection = source.kind === "portrait" ? portraitManifest.portraits : crestManifest.crests;
    const duplicate = collection.find(({ repositoryPath }) => repositoryPath === entry.repositoryPath);
    if (duplicate && duplicate.sha256 !== entry.sha256) throw new Error(`Manifest destination collision: ${entry.repositoryPath}.`);
    if (!duplicate) collection.push(entry);
  }
  writeJson(portraitPath, portraitManifest);
  writeJson(crestPath, crestManifest);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = { main, mapWithConcurrency, writeJson };
