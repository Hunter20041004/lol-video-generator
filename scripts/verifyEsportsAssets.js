#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const { verifyEsportsAssetLibrary } = require("../utils/esports/assetImporter");

const HELP = `Usage: node scripts/verifyEsportsAssets.js [options]

Options:
  --as-of=YYYY-MM-DD
  --inventory=.data/esports-assets/coverage-YYYY-MM-DD.json
  --json=.data/esports-assets/verification-YYYY-MM-DD.json
  --help
`;

function runtimePath(value) {
  const root = path.resolve(process.cwd(), ".data/esports-assets");
  const resolved = path.resolve(process.cwd(), value);
  const relative = path.relative(root, resolved);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative) || path.extname(resolved) !== ".json") {
    throw new Error("Report paths must be JSON files under .data/esports-assets/.");
  }
  return resolved;
}

function parseArgs(argv) {
  const parsed = {};
  for (const arg of argv) {
    if (arg === "--help") return { help: true };
    const match = arg.match(/^--(as-of|inventory|json)=(.+)$/);
    if (!match) throw new Error(`Unsupported argument: ${arg}`);
    parsed[match[1]] = match[2];
  }
  return parsed;
}

function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) return process.stdout.write(HELP);
  const asOf = args["as-of"] || new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(asOf)) throw new Error("--as-of must use YYYY-MM-DD.");
  const inventoryEnvelope = args.inventory
    ? JSON.parse(fs.readFileSync(runtimePath(args.inventory), "utf8"))
    : null;
  const report = verifyEsportsAssetLibrary({
    rootDir: process.cwd(),
    asOf,
    inventory: inventoryEnvelope?.inventory || null,
  });
  if (args.json) {
    const output = runtimePath(args.json);
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
  }
  process.stdout.write(`${JSON.stringify({
    asOf: report.asOf,
    fileCount: report.fileCount,
    totalBytes: report.totalBytes,
    largestFileBytes: report.largestFileBytes,
    coverage: report.coverage?.counts || null,
  })}\n`);
}

if (require.main === module) {
  try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}

module.exports = { main, parseArgs, runtimePath };
