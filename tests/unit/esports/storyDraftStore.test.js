const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { researchPackage } = require("../../fixtures/match-story/research");
const { createStoryDraftStore } = require("../../../utils/esports/storyDraftStore");

function tempStore(t) {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "lol-story-store-"));
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  return { cwd, store: createStoryDraftStore({ cwd }) };
}
function draftInput() {
  return { research: researchPackage(), selectedCandidateId: "candidate-1", segments: [{ narration: "依報導，合成隊伍贏下交戰。", factIds: ["fact-1"] }], rights: [] };
}

test("draft survives a new store instance on real disk", async (t) => {
  const { cwd, store } = tempStore(t);
  const draft = await store.create(draftInput());
  assert.equal(draft.revision, 1);
  assert.equal(draft.confirmedRevision, null);
  assert.deepEqual(await createStoryDraftStore({ cwd }).read(draft.id), draft);
});

test("missing draft has a stable not-found error", (t) => {
  const { store } = tempStore(t);
  assert.throws(() => store.read("missing"), { code: "MATCH_STORY_NOT_FOUND" });
});

test("corrupt storage is reported and never overwritten as an empty store", (t) => {
  const { cwd, store } = tempStore(t);
  store.create(draftInput());
  const file = path.join(cwd, ".data", "match-story-drafts.json");
  fs.writeFileSync(file, "not json");
  assert.throws(() => store.create(draftInput()), { code: "MATCH_STORY_STORE_CORRUPT" });
  assert.equal(fs.readFileSync(file, "utf8"), "not json");
});

test("confirmation records only the expected server revision", (t) => {
  const { store } = tempStore(t);
  const draft = store.create(draftInput());
  const confirmed = store.confirm(draft.id, 1, draft.research.identity);
  assert.equal(confirmed.confirmedRevision, 1);
  assert.equal(store.read(draft.id).confirmedRevision, 1);
});

test("editing narration invalidates confirmation and preserves previous revision", (t) => {
  const { store } = tempStore(t);
  const draft = store.create(draftInput());
  store.confirm(draft.id, 1, draft.research.identity);
  const next = store.revise(draft.id, 1, { segments: [{ narration: "修改後的旁白。", factIds: ["fact-1"] }] }, draft.research.identity);
  assert.equal(next.revision, 2);
  assert.equal(next.confirmedRevision, null);
  assert.equal(store.read(draft.id, 1).confirmedRevision, 1);
  assert.equal(store.read(draft.id, 1).segments[0].narration, draft.segments[0].narration);
});

test("stale revision cannot update or confirm the current draft", (t) => {
  const { store } = tempStore(t);
  const draft = store.create(draftInput());
  store.revise(draft.id, 1, { rights: [] }, draft.research.identity);
  assert.throws(() => store.revise(draft.id, 1, {}, draft.research.identity), { code: "MATCH_STORY_VERSION_CONFLICT" });
  assert.throws(() => store.confirm(draft.id, 1, draft.research.identity), { code: "MATCH_STORY_VERSION_CONFLICT" });
  assert.equal(store.read(draft.id).confirmedRevision, null);
});

test("path-like identifiers are rejected without touching external files", (t) => {
  const { store } = tempStore(t);
  assert.throws(() => store.read("../../outside"), { code: "MATCH_STORY_INVALID_ID" });
});

test("client metadata cannot set confirmation or replace the draft id", (t) => {
  const { store } = tempStore(t);
  assert.throws(() => store.create({ ...draftInput(), confirmedRevision: 1 }), { code: "MATCH_STORY_INVALID_DRAFT" });
  const draft = store.create(draftInput());
  assert.throws(() => store.revise(draft.id, 1, { id: "another", approved: true }, draft.research.identity), { code: "MATCH_STORY_INVALID_DRAFT" });
});

test("malformed initial research cannot enter storage", (t) => {
  const { store } = tempStore(t);
  assert.throws(() => store.create({ ...draftInput(), research: {} }), { code: "MATCH_STORY_INVALID_PACKAGE" });
});

test("valid JSON with corrupt draft history is preserved rather than treated as missing", (t) => {
  const { cwd, store } = tempStore(t);
  const draft = store.create(draftInput());
  const file = path.join(cwd, ".data", "match-story-drafts.json");
  const corrupt = JSON.stringify({ schemaVersion: 1, drafts: { [draft.id]: [] } });
  fs.writeFileSync(file, corrupt);
  assert.throws(() => store.read(draft.id), { code: "MATCH_STORY_STORE_CORRUPT" });
  assert.throws(() => store.create(draftInput()), { code: "MATCH_STORY_STORE_CORRUPT" });
  assert.equal(fs.readFileSync(file, "utf8"), corrupt);
});

test("revision cannot rewrite the match identity by changing both payload and expected identity", (t) => {
  const { store } = tempStore(t);
  const draft = store.create(draftInput());
  const otherResearch = researchPackage();
  otherResearch.identity.seriesId = "another-series";
  assert.throws(() => store.revise(draft.id, 1, { research: otherResearch }, otherResearch.identity), { code: "MATCH_STORY_IDENTITY_MISMATCH" });
  assert.deepEqual(store.read(draft.id).research.identity, draft.research.identity);
});

test("two in-process store instances competing for one revision produce one winner", async (t) => {
  const { cwd, store } = tempStore(t);
  const draft = store.create(draftInput());
  const other = createStoryDraftStore({ cwd });
  const results = await Promise.allSettled([store, other].map((instance) => Promise.resolve().then(() =>
    instance.revise(draft.id, 1, { rights: [] }, draft.research.identity))));
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(results.find((result) => result.status === "rejected").reason.code, "MATCH_STORY_VERSION_CONFLICT");
  assert.equal(createStoryDraftStore({ cwd }).read(draft.id).revision, 2);
});

test("research and material edits both invalidate an existing confirmation", (t) => {
  const { store } = tempStore(t);
  for (const patch of [{ research: researchPackage() }, { rights: [{ sourceId: "source-1", status: "unknown" }] }]) {
    const draft = store.create(draftInput());
    store.confirm(draft.id, 1, draft.research.identity);
    assert.equal(store.revise(draft.id, 1, patch, draft.research.identity).confirmedRevision, null);
  }
});

test("cross-match confirmation and unsupported evidence leave confirmation empty", (t) => {
  const { store } = tempStore(t);
  const draft = store.create(draftInput());
  assert.throws(() => store.confirm(draft.id, 1, { ...draft.research.identity, seriesId: "different-series" }), { code: "MATCH_STORY_IDENTITY_MISMATCH" });
  const research = researchPackage();
  research.sources[0].readStatus = "search-lead";
  research.facts[0].evidenceType = "search-lead";
  const next = store.revise(draft.id, 1, { research }, draft.research.identity);
  assert.throws(() => store.confirm(next.id, 2, next.research.identity), { code: "MATCH_STORY_UNVERIFIED_FACT" });
  assert.equal(store.read(draft.id).confirmedRevision, null);
});

test("draft content arrays cannot be replaced with malformed values", (t) => {
  const { store } = tempStore(t);
  assert.throws(() => store.create({ ...draftInput(), segments: "not an array" }), { code: "MATCH_STORY_INVALID_DRAFT" });
  const draft = store.create(draftInput());
  assert.throws(() => store.revise(draft.id, 1, { rights: true }, draft.research.identity), { code: "MATCH_STORY_INVALID_DRAFT" });
});

test("server records identity, draft status and timestamps without trusting client metadata", (t) => {
  const { cwd } = tempStore(t);
  let timestamp = "2026-10-01T00:00:00.000Z";
  const store = createStoryDraftStore({ cwd, now: () => timestamp });
  const draft = store.create(draftInput());
  assert.deepEqual(draft.identity, draft.research.identity);
  assert.equal(draft.status, "draft");
  assert.equal(draft.createdAt, timestamp);
  timestamp = "2026-10-01T00:01:00.000Z";
  const confirmed = store.confirm(draft.id, 1, draft.identity);
  assert.equal(confirmed.status, "confirmed");
  const next = store.revise(draft.id, 1, {}, draft.identity);
  assert.equal(next.status, "draft");
  assert.equal(next.createdAt, draft.createdAt);
  assert.equal(next.updatedAt, timestamp);
});

test("damaged persisted research is rejected before unrelated drafts can overwrite storage", (t) => {
  const { cwd, store } = tempStore(t);
  const draft = store.create(draftInput());
  const file = path.join(cwd, ".data", "match-story-drafts.json");
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  data.drafts[draft.id][0].research = {};
  fs.writeFileSync(file, JSON.stringify(data));
  assert.throws(() => store.create(draftInput()), { code: "MATCH_STORY_STORE_CORRUPT" });
});

test("whitespace in valid revised research is normalized before persistence and confirmation", (t) => {
  const { cwd, store } = tempStore(t);
  const draft = store.create(draftInput());
  const research = researchPackage();
  research.identity.teamA = ` ${research.identity.teamA} `;
  const next = store.revise(draft.id, 1, { research }, draft.identity);
  assert.deepEqual(next.research.identity, next.identity);
  assert.equal(createStoryDraftStore({ cwd }).confirm(next.id, 2, draft.identity).confirmedRevision, 2);
});

test("each persisted revision must retain the original match identity", (t) => {
  const { cwd, store } = tempStore(t);
  const draft = store.create(draftInput());
  store.revise(draft.id, 1, {}, draft.identity);
  const file = path.join(cwd, ".data", "match-story-drafts.json");
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  data.drafts[draft.id][1].identity.seriesId = "wrong-series";
  fs.writeFileSync(file, JSON.stringify(data));
  assert.throws(() => store.read(draft.id), { code: "MATCH_STORY_STORE_CORRUPT" });
});

test("persisted status cannot claim confirmation without a confirmed revision", (t) => {
  const { cwd, store } = tempStore(t);
  const draft = store.create(draftInput());
  const file = path.join(cwd, ".data", "match-story-drafts.json");
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  data.drafts[draft.id][0].status = "confirmed";
  fs.writeFileSync(file, JSON.stringify(data));
  assert.throws(() => store.read(draft.id), { code: "MATCH_STORY_STORE_CORRUPT" });
});
