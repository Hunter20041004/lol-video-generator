const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const ROOT = path.resolve(__dirname, "../../..");
const { verifyEsportsAssetLibrary } = require("../../../utils/esports/assetImporter");

test("the approved 2026 regional library is complete except for the reviewed blockers", () => {
  const sources = require("../../../config/esports-asset-sources-2026.json");
  const portraits = require("../../../config/esports-player-portraits.json");
  const crests = require("../../../config/esports-team-crests.json");
  const unresolved = require("../../../config/esports-asset-unresolved-2026.json");
  const manifestByPath = new Map([...portraits.portraits, ...crests.crests].map((entry) => [entry.repositoryPath, entry]));

  assert.equal(sources.assets.filter(({ reviewedAt }) => reviewedAt === "2026-08-29T02:08:12.000Z").length, 425);
  for (const source of sources.assets) {
    const manifestEntry = manifestByPath.get(source.destination);
    assert.ok(manifestEntry, `Approved source was not imported: ${source.assetId}`);
    assert.equal(manifestEntry.sourcePage, source.sourcePage, source.assetId);
    assert.ok(fs.existsSync(path.join(ROOT, source.destination)), source.destination);
  }
  assert.equal(unresolved.asOf, "2026-08-28");
  assert.equal(unresolved.teams.length, 4);
  assert.equal(unresolved.players.length, 65);

  const report = verifyEsportsAssetLibrary({ rootDir: ROOT, asOf: unresolved.asOf });
  assert.equal(report.fileCount, 431);
  assert.equal(new Set(report.files.map(({ repositoryPath }) => repositoryPath)).size, 431);
});
