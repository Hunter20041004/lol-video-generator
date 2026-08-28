#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const { loadProjectEnv } = require("../utils/envLoader");
const {
  compareInventoryToManifests,
  fetchTierOneAssetInventory,
} = require("../utils/esports/assetInventory");

const HELP = `Usage: node scripts/esportsAssetInventory.js [options]

Options:
  --year=2026
  --as-of=YYYY-MM-DD
  --json=.data/esports-assets/report.json
  --markdown=.data/esports-assets/report.md
  --help
`;

function parseArgs(argv) {
  const options = {};
  for (const arg of argv) {
    if (arg === "--help") return { help: true };
    const match = arg.match(/^--(year|as-of|json|markdown)=(.+)$/);
    if (!match) throw new Error(`Unsupported argument: ${arg}`);
    options[match[1]] = match[2];
  }
  return options;
}

function safeOutputPath(value, extension) {
  const root = path.resolve(process.cwd(), ".data/esports-assets");
  const resolved = path.resolve(process.cwd(), value);
  const relative = path.relative(root, resolved);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative) || path.extname(resolved) !== extension) {
    throw new Error(`Output must be a ${extension} file under .data/esports-assets/.`);
  }
  return resolved;
}

function markdownReport(inventory, coverage) {
  return [
    `# Esports asset coverage — ${coverage.asOf}`,
    "",
    `- Source tables: ${inventory.sourceTables.join(", ")}`,
    `- Teams: ${coverage.counts.coveredTeams}/${coverage.counts.teams}`,
    `- Players: ${coverage.counts.coveredPlayers}/${coverage.counts.players}`,
    "",
    "## Missing teams",
    "",
    ...(coverage.missingTeams.length ? coverage.missingTeams.map(({ team }) => `- ${team}`) : ["- None"]),
    "",
    "## Missing players",
    "",
    ...(coverage.missingPlayers.length
      ? coverage.missingPlayers.map(({ publicName, team }) => `- ${publicName} — ${team}`)
      : ["- None"]),
    "",
  ].join("\n");
}

async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    process.stdout.write(HELP);
    return;
  }
  const year = args.year || "2026";
  const asOf = args["as-of"] || new Date().toISOString().slice(0, 10);
  if (!/^\d{4}$/.test(year) || !/^\d{4}-\d{2}-\d{2}$/.test(asOf)) throw new Error("Invalid year or as-of date.");
  const jsonPath = safeOutputPath(args.json || `.data/esports-assets/coverage-${asOf}.json`, ".json");
  const markdownPath = safeOutputPath(args.markdown || `.data/esports-assets/coverage-${asOf}.md`, ".md");
  loadProjectEnv();
  const inventory = await fetchTierOneAssetInventory({ year, asOf });
  const portraitManifest = require("../config/esports-player-portraits.json");
  const crestManifest = require("../config/esports-team-crests.json");
  const coverage = compareInventoryToManifests(inventory, {
    portraits: portraitManifest.portraits,
    crests: crestManifest.crests,
  });
  fs.mkdirSync(path.dirname(jsonPath), { recursive: true });
  fs.writeFileSync(jsonPath, `${JSON.stringify({ inventory, coverage }, null, 2)}\n`);
  fs.writeFileSync(markdownPath, markdownReport(inventory, coverage));
  process.stdout.write(`${JSON.stringify(coverage.counts)}\n`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = { main, markdownReport, parseArgs, safeOutputPath };
