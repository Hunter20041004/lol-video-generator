const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "../../..");

test("resolvePlayerPortrait verifies Ruler 2026 GEN identity and tracked bytes", () => {
  const { resolvePlayerPortrait } = require(path.join(ROOT, "utils/render/playerPortraitManifest.js"));
  const resolved = resolvePlayerPortrait({
    playerId: "ruler",
    publicName: "Ruler",
    team: "GEN",
    season: "2026",
  }, { rootDir: ROOT });

  assert.equal(resolved.publicPath, "/player-portraits/gen-ruler-2026.webp");
  assert.equal(resolved.width, 693);
  assert.equal(resolved.height, 549);
  assert.equal(resolved.sha256, "9b10b93cc8368c90c82dd1381151931e6f857a4beb6a34e46469ea6aee9d558d");
});

test("resolvePlayerPortrait rejects the wrong team for a known player", () => {
  const { resolvePlayerPortrait } = require(path.join(ROOT, "utils/render/playerPortraitManifest.js"));

  assert.throws(
    () => resolvePlayerPortrait({ publicName: "Ruler", team: "HLE", season: "2026" }, { rootDir: ROOT }),
    /team mismatch/i
  );
});

test("resolvePlayerPortrait rejects an unknown player instead of substituting another portrait", () => {
  const { resolvePlayerPortrait } = require(path.join(ROOT, "utils/render/playerPortraitManifest.js"));

  assert.throws(
    () => resolvePlayerPortrait({ publicName: "Unknown", team: "GEN", season: "2026" }, { rootDir: ROOT }),
    /not found/i
  );
});

test("resolvePlayerPortrait rejects manifest hashes that do not match the tracked file", () => {
  const { resolvePlayerPortrait } = require(path.join(ROOT, "utils/render/playerPortraitManifest.js"));
  const baseManifest = require(path.join(ROOT, "config/esports-player-portraits.json"));
  const tamperedHashManifest = {
    ...baseManifest,
    portraits: baseManifest.portraits.map((portrait) => ({ ...portrait, sha256: "0".repeat(64) })),
  };

  assert.throws(
    () => resolvePlayerPortrait({ publicName: "Ruler", team: "GEN", season: "2026" }, {
      rootDir: ROOT,
      manifest: tamperedHashManifest,
    }),
    /SHA-256 mismatch/i
  );
});
