const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  buildApprovedSourcesFromCoverage,
  importApprovedAsset,
  validateApprovedSource,
  verifyEsportsAssetLibrary,
} = require("../../../utils/esports/assetImporter");

function approved(overrides = {}) {
  return {
    assetId: "ruler-2026",
    kind: "portrait",
    sourceKind: "leaguepedia",
    sourcePage: "https://lol.fandom.com/wiki/Ruler",
    sourceUrl: "https://static.wikia.nocookie.net/example/ruler.png",
    reviewedAt: "2026-08-28T17:00:00.000Z",
    playerId: "ruler",
    publicName: "Ruler",
    playerAliases: ["Ruler (Park Jae-hyuk)"],
    team: "GEN",
    teamAliases: ["Gen.G"],
    region: "Korea",
    season: "2026",
    validFrom: "2026-01-01",
    validTo: "2026-12-31",
    destination: "public/player-portraits/gen-ruler-test.webp",
    licenseNote: "Editorial player identification in the authorized project context.",
    ...overrides,
  };
}

test("validateApprovedSource rejects incomplete and unsafe source records", () => {
  assert.doesNotThrow(() => validateApprovedSource(approved()));
  assert.throws(() => validateApprovedSource(approved({ playerId: "" })), /playerId/);
  assert.throws(() => validateApprovedSource(approved({ sourceUrl: "http://example.com/ruler.png" })), /HTTPS/);
  assert.throws(() => validateApprovedSource(approved({ sourceKind: "search" })), /sourceKind/);
  assert.throws(() => validateApprovedSource(approved({ reviewedAt: "" })), /reviewedAt/);
  assert.throws(() => validateApprovedSource(approved({ destination: "public/player-portraits/../team-crests/wrong.webp" })), /destination/);
  assert.throws(() => validateApprovedSource(approved({ destination: "public/player-portraits/ruler.png" })), /WebP/);
});

test("buildApprovedSourcesFromCoverage promotes only the human-approved file candidates", () => {
  const source = {
    sourceKind: "leaguepedia",
    sourcePage: "https://lol.fandom.com/wiki/File:Example.png",
    sourceUrl: "https://lol.fandom.com/wiki/Special:Redirect/file/Example.png",
  };
  const assets = buildApprovedSourcesFromCoverage({
    missingTeams: [
      { team: "Team Example", region: "Europe", competitionId: "LEC", candidateSources: [source] },
      { team: "No Source", region: "Europe", competitionId: "LEC", candidateSources: [] },
    ],
    missingPlayers: [
      { playerId: "player-one", publicName: "Player One", team: "Team Example", region: "Europe", competitionId: "LEC", candidateSources: [source] },
      { playerId: "blocked", publicName: "Blocked", team: "No Source", region: "Europe", competitionId: "LEC", candidateSources: [] },
    ],
  }, { year: "2026", reviewedAt: "2026-08-28T18:30:00.000Z" });

  assert.equal(assets.length, 2);
  assert.deepEqual(assets.map(({ assetId }) => assetId), [
    "lec-team-example-crest-2026",
    "lec-team-example-player-one-portrait-2026",
  ]);
  assert.equal(assets[0].destination, "public/team-crests/lec-team-example-crest-2026.png");
  assert.equal(assets[1].destination, "public/player-portraits/lec-team-example-player-one-portrait-2026.webp");
  assert.ok(assets.every((entry) => validateApprovedSource(entry)));
});

test("importApprovedAsset rejects non-image responses before normalization", async () => {
  let normalizationCalls = 0;
  await assert.rejects(
    () => importApprovedAsset(approved(), {
      rootDir: fs.mkdtempSync(path.join(os.tmpdir(), "asset-import-invalid-")),
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        url: "https://example.com/not-image",
        headers: { get: () => "text/html" },
        arrayBuffer: async () => Buffer.from("<html>not an image</html>"),
      }),
      normalizeImage: () => { normalizationCalls += 1; },
    }),
    /supported raster image/
  );
  assert.equal(normalizationCalls, 0);
});

test("importApprovedAsset resolves an approved Leaguepedia file page before downloading bytes", async () => {
  const source = fs.readFileSync(path.resolve(__dirname, "../../../public/team-crests/gen.png"));
  const requested = [];
  const entry = approved({
    sourcePage: "https://lol.fandom.com/wiki/File:GZ%201Jiang%202026%20Split%201.png",
    sourceUrl: "https://lol.fandom.com/wiki/Special:Redirect/file/GZ%201Jiang%202026%20Split%201.png",
  });

  const result = await importApprovedAsset(entry, {
    rootDir: fs.mkdtempSync(path.join(os.tmpdir(), "asset-import-resolved-")),
    fetchImpl: async (url) => {
      requested.push(String(url));
      if (String(url).startsWith("https://lol.fandom.com/api.php?")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            query: { pages: { 1: { imageinfo: [{ url: "https://static.wikia.nocookie.net/example/1jiang.png" }] } } },
          }),
        };
      }
      return {
        ok: true,
        status: 200,
        url: String(url),
        headers: { get: () => "image/png" },
        arrayBuffer: async () => source,
      };
    },
  });

  assert.match(requested[0], /action=query/);
  assert.match(requested[0], /titles=File%3AGZ\+1Jiang\+2026\+Split\+1\.png/);
  assert.equal(requested[1], "https://static.wikia.nocookie.net/example/1jiang.png");
  assert.equal(result.sourceUrl, "https://static.wikia.nocookie.net/example/1jiang.png");
});

test("importApprovedAsset creates deterministic verified portrait metadata", async () => {
  const source = fs.readFileSync(path.resolve(__dirname, "../../../public/team-crests/gen.png"));
  async function runOnce() {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "asset-import-valid-"));
    const result = await importApprovedAsset(approved(), {
      rootDir,
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        url: "https://static.wikia.nocookie.net/example/ruler.png",
        headers: { get: () => "image/png" },
        arrayBuffer: async () => source,
      }),
    });
    return { result, bytes: fs.readFileSync(path.join(rootDir, approved().destination)) };
  }

  const first = await runOnce();
  const second = await runOnce();
  assert.deepEqual(first.bytes, second.bytes);
  assert.match(first.result.sha256, /^[a-f0-9]{64}$/);
  assert.ok(first.result.width > 0 && first.result.height > 0);
  assert.equal(first.result.repositoryPath, approved().destination);
});

test("verifyEsportsAssetLibrary reports capacity and calibrated coverage", () => {
  const portraitManifest = require("../../../config/esports-player-portraits.json");
  const crestManifest = require("../../../config/esports-team-crests.json");
  const expectedFiles = new Set([
    ...portraitManifest.portraits,
    ...crestManifest.crests,
  ].map(({ repositoryPath }) => repositoryPath)).size;
  const report = verifyEsportsAssetLibrary({
    rootDir: path.resolve(__dirname, "../../.."),
    asOf: "2026-08-28",
    inventory: {
      asOf: "2026-08-28",
      teams: [{ team: "GEN" }, { team: "Missing Team" }],
      players: [
        { playerId: "ruler", publicName: "Ruler", team: "GEN" },
        { playerId: "missing", publicName: "Missing", team: "Missing Team" },
      ],
    },
  });

  assert.equal(report.asOf, "2026-08-28");
  assert.equal(report.fileCount, expectedFiles);
  assert.ok(report.totalBytes > 0);
  assert.ok(report.largestFileBytes > 0);
  assert.equal(report.coverage.counts.missingTeams, 1);
  assert.equal(report.coverage.counts.missingPlayers, 1);
});
