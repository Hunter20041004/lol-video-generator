const test = require("node:test");
const assert = require("node:assert/strict");
const { researchPackage } = require("../../fixtures/match-story/research");

test("selection revalidates source evidence rather than trusting raw input", () => {
  const input = researchPackage(); input.sources[0].url = "javascript:alert(1)";
  assert.throws(() => validateStorySelection(input, "candidate-1", [{ narration: "合成旁白", factIds: ["fact-1"] }]), { code: "MATCH_STORY_INVALID_PACKAGE" });
});

test("same teams on another date do not match this research", () => {
  const input = researchPackage();
  assert.throws(() => validateResearchPackage(input, { ...input.identity, date: "2026-08-28" }), { code: "MATCH_STORY_IDENTITY_MISMATCH" });
});

test("no candidate remains empty instead of inventing a story", () => {
  const input = researchPackage(); input.candidates = [];
  assert.deepEqual(validateResearchPackage(input, input.identity).candidates, []);
});

test("editor observations preserve player and game clocks separately", () => {
  const input = researchPackage();
  input.sources[0].kind = "video"; input.sources[0].readStatus = "reviewed-video";
  input.facts[0].evidenceType = "reviewed-video";
  input.facts[0].observation = { sourceId: "source-1", reviewer: "editor", reviewedAt: "2026-10-01T00:00:00Z", playerStartSeconds: 262, playerEndSeconds: 284, gameStartSeconds: 965, gameEndSeconds: 987, observed: "Synthetic observation" };
  const result = validateResearchPackage(input, input.identity, { origin: "editor" });
  assert.equal(result.facts[0].observation.playerStartSeconds, 262);
  assert.equal(result.facts[0].observation.gameStartSeconds, 965);
});

test("a tactic with no former-team background is valid", () => {
  const input = researchPackage(); input.candidates[0].kind = "tactic";
  assert.equal(validateResearchPackage(input, input.identity).candidates[0].kind, "tactic");
});

test("a statistics-only recap retains the series scope", () => {
  const input = researchPackage();
  input.sources[0].kind = "stats"; input.sources[0].readStatus = "stats";
  input.facts[0].evidenceType = "stats"; input.facts[0].scope = "series"; delete input.facts[0].gameNumber;
  input.candidates[0].kind = "recap";
  assert.equal(validateResearchPackage(input, input.identity).facts[0].scope, "series");
});

test("an unverified selected story cannot hide its evidence behind unrelated narration", () => {
  const input = researchPackage();
  input.facts[0].evidenceType = "search-lead"; input.sources[0].readStatus = "search-lead";
  input.facts.push({ ...input.facts[0], id: "fact-2", evidenceType: "report", sourceIds: ["source-2"] });
  input.sources.push({ ...input.sources[0], id: "source-2", readStatus: "report" });
  assert.throws(() => validateStorySelection(input, "candidate-1", [{ narration: "另一個事實", factIds: ["fact-2"] }]), { code: "MATCH_STORY_UNVERIFIED_FACT" });
});
test("review records must use an existing video source and ordered clocks", () => {
  const input = researchPackage();
  input.sources[0].kind = "video"; input.sources[0].readStatus = "reviewed-video";
  input.facts[0].evidenceType = "reviewed-video";
  input.facts[0].observation = { sourceId: "source-1", reviewer: "editor", reviewedAt: "2026-10-01T00:00:00Z", playerStartSeconds: 300, playerEndSeconds: 200, gameStartSeconds: 965, gameEndSeconds: 987, observed: "合成觀察" };
  assert.throws(() => validateResearchPackage(input, input.identity, { origin: "editor" }), { code: "MATCH_STORY_REVIEW_REQUIRED" });
});
test("unresolved candidates cannot bypass confirmation through another fact", () => {
  const input = researchPackage(); input.candidates[0].unresolved = ["待核對"];
  assert.throws(() => validateStorySelection(input, "candidate-1", [{ narration: "合成旁白", factIds: ["fact-1"] }]), { code: "MATCH_STORY_UNRESOLVED" });
});
test("empty narration cannot be confirmed", () => {
  const input = researchPackage();
  assert.throws(() => validateStorySelection(input, "candidate-1", []), { code: "MATCH_STORY_INVALID_SCRIPT" });
});
test("a missing candidate cannot be selected", () => {
  const input = researchPackage();
  assert.throws(() => validateStorySelection(input, "missing", [{ narration: "合成旁白", factIds: ["fact-1"] }]), { code: "MATCH_STORY_INVALID_REFERENCE" });
});
test("report facts cannot cite an unread search snippet", () => {
  const input = researchPackage(); input.sources[0].readStatus = "search-lead";
  assert.throws(() => validateResearchPackage(input, input.identity), { code: "MATCH_STORY_UNVERIFIED_FACT" });
});
test("duplicate fact identifiers cannot hide conflicting records", () => {
  const input = researchPackage();
  input.facts.push({ ...input.facts[0], conflicts: ["另一說法"] });
  assert.throws(() => validateResearchPackage(input, input.identity), { code: "MATCH_STORY_DUPLICATE_ID" });
});
test("missing narrative evidence cannot be confirmed", () => {
  const input = researchPackage();
  assert.throws(() => validateStorySelection(input, "candidate-1", [{ narration: "合成旁白", factIds: ["missing"] }]), { code: "MATCH_STORY_INVALID_REFERENCE" });
});
test("conflicting evidence cannot support selected narration", () => {
  const input = researchPackage();
  input.facts[0].conflicts = ["來源對交戰結果不一致"];
  assert.throws(() => validateStorySelection(input, "candidate-1", [{ narration: "合成旁白", factIds: ["fact-1"] }]), { code: "MATCH_STORY_CONFLICT" });
});
test("model cannot promote a fact to reviewed-video", () => {
  const input = researchPackage();
  input.facts[0].evidenceType = "reviewed-video";
  assert.throws(() => validateResearchPackage(input, input.identity), { code: "MATCH_STORY_REVIEW_REQUIRED" });
});
const { validateResearchPackage, validateStorySelection } = require("../../../utils/esports/matchStoryContract");

test("search-only evidence cannot support confirmed narration", () => {
  const input = researchPackage();
  input.facts[0].evidenceType = "search-lead";
  input.sources[0].readStatus = "search-lead";
  assert.throws(() => validateStorySelection(input, "candidate-1", [{ narration: "合成旁白", factIds: ["fact-1"] }]), { code: "MATCH_STORY_UNVERIFIED_FACT" });
});

test("a report-supported story can be selected without pretending footage was reviewed", () => {
  const input = researchPackage();
  assert.equal(validateStorySelection(input, "candidate-1", [{ narration: "依報導，合成隊伍贏下交戰。", factIds: ["fact-1"] }]), true);
});

test("rejects malformed source evidence with a stable error", () => {
  const input = researchPackage();
  input.sources[0].retrievedAt = "not-a-date";
  assert.throws(() => validateResearchPackage(input, input.identity), { code: "MATCH_STORY_INVALID_PACKAGE" });
});

test("rejects facts referencing a missing source", () => {
  const input = researchPackage();
  input.facts[0].sourceIds = ["missing-source"];
  assert.throws(() => validateResearchPackage(input, input.identity), { code: "MATCH_STORY_INVALID_REFERENCE" });
});

test("valid research preserves an unknown publication date without mutating input", () => {
  const input = researchPackage();
  const before = structuredClone(input);
  const result = validateResearchPackage(input, input.identity);
  assert.equal(result.sources[0].publishedAt, null);
  assert.deepEqual(input, before);
  assert.notEqual(result, input);
});

test("rejects research for a different series", () => {
  const input = researchPackage();
  assert.throws(() => validateResearchPackage(input, { ...input.identity, seriesId: "other-series" }), { code: "MATCH_STORY_IDENTITY_MISMATCH" });
});

test("rejects candidates referencing a missing fact", () => {
  const input = researchPackage();
  input.candidates[0].factIds = ["missing-fact"];
  assert.throws(() => validateResearchPackage(input, input.identity), { code: "MATCH_STORY_INVALID_REFERENCE" });
});
