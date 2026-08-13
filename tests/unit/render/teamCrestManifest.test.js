const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("team crest manifest keeps Next tracing scoped to verified crest files", () => {
  const source = fs.readFileSync(path.resolve(__dirname, "../../../utils/render/teamCrestManifest.js"), "utf8");

  assert.match(source, /require\("\.\.\/\.\.\/config\/esports-team-crests\.json"\)/);
  assert.match(source, /turbopackIgnore: true/);
  assert.doesNotMatch(source, /fs\.readFileSync\(path\.join\(rootDir, "config\/esports-team-crests\.json"\)/);
});
