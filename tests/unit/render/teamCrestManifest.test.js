const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "../../..");

test("team crest manifest keeps Next tracing scoped to verified crest files", () => {
  const source = fs.readFileSync(path.resolve(__dirname, "../../../utils/render/teamCrestManifest.js"), "utf8");

  assert.match(source, /require\("\.\.\/\.\.\/config\/esports-team-crests\.json"\)/);
  assert.match(source, /turbopackIgnore: true/);
  assert.doesNotMatch(source, /fs\.readFileSync\(path\.join\(rootDir, "config\/esports-team-crests\.json"\)/);
});

test("team crest manifest rejects unknown presentation label modes", () => {
  const { resolveTeamCrest } = require(path.join(ROOT, "utils/render/teamCrestManifest.js"));
  const baseManifest = require(path.join(ROOT, "config/esports-team-crests.json"));
  const invalidManifest = {
    ...baseManifest,
    crests: baseManifest.crests.map((crest) => crest.team === "GEN"
      ? { ...crest, presentation: { labelMode: "guess" } }
      : crest),
  };

  assert.throws(
    () => resolveTeamCrest({ team: "GEN", season: "2026", matchDate: "2026-08-13" }, {
      rootDir: ROOT,
      manifest: invalidManifest,
    }),
    /label mode/i,
  );
});
