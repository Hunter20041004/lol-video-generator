#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const { loadProjectEnv } = require("../utils/envLoader");
const { importApprovedAsset } = require("../utils/esports/assetImporter");

const HELP = `Usage: node scripts/importEsportsAssets.js --ids=asset-id[,asset-id]\n`;

function writeJson(filePath, value) {
  const tempPath = `${filePath}.tmp`;
  fs.writeFileSync(tempPath, `${JSON.stringify(value, null, 2)}\n`);
  fs.renameSync(tempPath, filePath);
}

async function main(argv = process.argv.slice(2)) {
  if (argv.includes("--help")) return process.stdout.write(HELP);
  const idArgument = argv.find((arg) => arg.startsWith("--ids="));
  if (!idArgument || argv.length !== 1) throw new Error("Pass only --ids=asset-id[,asset-id].");
  const ids = [...new Set(idArgument.slice(6).split(",").map((id) => id.trim()).filter(Boolean))];
  if (ids.length === 0) throw new Error("At least one approved asset ID is required.");
  loadProjectEnv();
  const rootDir = process.cwd();
  const sources = JSON.parse(fs.readFileSync(path.join(rootDir, "config/esports-asset-sources-2026.json"), "utf8"));
  const portraitPath = path.join(rootDir, "config/esports-player-portraits.json");
  const crestPath = path.join(rootDir, "config/esports-team-crests.json");
  const portraitManifest = JSON.parse(fs.readFileSync(portraitPath, "utf8"));
  const crestManifest = JSON.parse(fs.readFileSync(crestPath, "utf8"));

  for (const id of ids) {
    const source = (sources.assets || []).find(({ assetId }) => assetId === id);
    if (!source) throw new Error(`Approved asset source not found: ${id}.`);
    const entry = await importApprovedAsset(source, { rootDir });
    const collection = source.kind === "portrait" ? portraitManifest.portraits : crestManifest.crests;
    const duplicate = collection.find(({ repositoryPath }) => repositoryPath === entry.repositoryPath);
    if (duplicate && duplicate.sha256 !== entry.sha256) throw new Error(`Manifest destination collision: ${entry.repositoryPath}.`);
    if (!duplicate) collection.push(entry);
    process.stdout.write(`Imported ${id} -> ${entry.repositoryPath}\n`);
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

module.exports = { main, writeJson };
