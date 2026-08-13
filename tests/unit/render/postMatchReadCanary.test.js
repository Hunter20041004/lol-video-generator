const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "../../..");

test("post-match read canary is preview-only by construction", () => {
  const { buildCanaryOptions } = require(path.join(ROOT, "scripts/renderPostMatchReadCanary.js"));
  const options = buildCanaryOptions([]);

  assert.equal(options.mode, "preview");
  assert.deepEqual(options.languages, ["zh"]);
  assert.equal(Object.hasOwn(options, "scheduledAt"), false);
});

test("post-match read canary rejects publishing and production arguments", () => {
  const { buildCanaryOptions } = require(path.join(ROOT, "scripts/renderPostMatchReadCanary.js"));

  for (const args of [["--publish"], ["--queue"], ["--mode=production"], ["production"]]) {
    assert.throws(() => buildCanaryOptions(args), /preview-only canary/i);
  }
});
