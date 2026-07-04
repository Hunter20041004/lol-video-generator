const test = require("node:test");
const assert = require("node:assert/strict");

const { buildCandidateIds } = require("../../utils/metaImpactProvider");

test("buildCandidateIds falls back from map-prefixed item ids to canonical ids", () => {
  assert.deepEqual(buildCandidateIds("323050"), ["323050", "3050"]);
  assert.deepEqual(buildCandidateIds("223050"), ["223050", "3050"]);
  assert.deepEqual(buildCandidateIds("3050"), ["3050"]);
});
