const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "../..");
const removedDataTypes = ["PRO_BUILD", "TIER_LIST", "TFT_INFO", "ESPORTS_DRAMA"];

const runtimeFiles = [
  "app/api/analyze/route.js",
  "app/api/content-factory/preview/route.js",
  "app/api/content-factory/publish/route.js",
  "app/page.jsx",
  "src/schemas/pipelineSchemas.js",
  "utils/jsonExtraction.js",
  "utils/pipelinePrompts.js",
  "utils/publishing/copy.js",
  "utils/render/renderService.js",
];

test("runtime files do not retain removed pipeline dataTypes", () => {
  for (const file of runtimeFiles) {
    const source = fs.readFileSync(path.join(ROOT, file), "utf8");
    for (const dataType of removedDataTypes) {
      assert.equal(source.includes(dataType), false, `${file} should not reference ${dataType}`);
    }
  }
});

test("removed pipeline API route directories are deleted", () => {
  assert.equal(fs.existsSync(path.join(ROOT, "app/api/tier-list")), false);
  assert.equal(fs.existsSync(path.join(ROOT, "app/api/auto-publish")), false);
  assert.equal(fs.existsSync(path.join(ROOT, "app/api/pro-builds")), false);
  assert.equal(fs.existsSync(path.join(ROOT, "app/api/auth/google")), false);
  assert.equal(fs.existsSync(path.join(ROOT, "app/api/cron/check-matches")), false);
  assert.equal(fs.existsSync(path.join(ROOT, "app/api/webhooks/match-end")), false);
});

test("removed publishing platforms are absent from runtime entrypoints", () => {
  const files = [
    "app/api/publish/route.js",
    "config/social_accounts.json",
    "scripts/publishQueue.js",
    "scripts/qaRender.js",
    "utils/publishing/copy.js",
  ];
  const removedPlatformPatterns = [/youtube/i, /tiktok/i];

  for (const file of files) {
    const source = fs.readFileSync(path.join(ROOT, file), "utf8");
    for (const pattern of removedPlatformPatterns) {
      assert.equal(pattern.test(source), false, `${file} should not reference ${pattern}`);
    }
  }
});

test("removed platform adapters and retired parser modules are deleted", () => {
  [
    "utils/publishing/adapters/youtube.js",
    "utils/publishing/adapters/tiktok.js",
    "src/parsers/ProBuildParser.js",
    "src/parsers/ProBuildsScanner.js",
    "src/parsers/MetaScanner.js",
    "src/components/tft",
    "utils/autoDispatcher.js",
  ].forEach((relativePath) => {
    assert.equal(fs.existsSync(path.join(ROOT, relativePath)), false, `${relativePath} should be removed`);
  });
});
