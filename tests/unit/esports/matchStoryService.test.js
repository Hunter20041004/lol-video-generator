const test = require("node:test");
const assert = require("node:assert/strict");
const { createMatchStoryService } = require("../../../utils/esports/matchStoryService");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { researchPackage } = require("../../fixtures/match-story/research");
const { createStoryDraftStore } = require("../../../utils/esports/storyDraftStore");

function setup(t, options = {}) {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "lol-story-service-"));
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  const identity = researchPackage().identity;
  const series = { ...identity, tournament: "LCK 2026 Season", status: "completed", completeness: { hasTenPlayers: true, hasFiveRoleMatchups: true }, players: Array.from({ length: 10 }, () => ({})), roleMatchups: Array.from({ length: 5 }, () => ({ left: {}, right: {} })) };
  const snapshot = { scanId: identity.scanId, candidates: [series] };
  const store = createStoryDraftStore({ cwd });
  return { identity, series, snapshot, store, service: createMatchStoryService({ store, readSnapshot: () => snapshot, ...options }) };
}

test("research is disabled by default and never calls a provider", async () => {
  let calls = 0;
  const service = createMatchStoryService({ provider: async () => { calls += 1; } });
  await assert.rejects(service.execute({ action: "research", scanId: "scan", seriesId: "series" }), { code: "MATCH_STORY_SERVICE_DISABLED" });
  assert.equal(calls, 0);
});

test("manual research creates an unconfirmed draft using server match identity", async (t) => {
  const { service, identity } = setup(t);
  const draft = await service.execute({ action: "import", scanId: identity.scanId, seriesId: identity.seriesId, research: researchPackage() });
  assert.deepEqual(draft.identity, identity);
  assert.equal(draft.confirmedRevision, null);
  assert.deepEqual(draft.segments, []);
});

test("unfinished or incomplete matches cannot create story drafts", async (t) => {
  const { service, identity, series } = setup(t);
  series.status = "scheduled";
  await assert.rejects(service.execute({ action: "import", scanId: identity.scanId, seriesId: identity.seriesId, research: researchPackage() }), { code: "MATCH_STORY_MATCH_INELIGIBLE" });
});

test("identical concurrent research shares one provider execution and one draft", async (t) => {
  let calls = 0;
  let release;
  const waiting = new Promise((resolve) => { release = resolve; });
  const { service, identity } = setup(t, { researchEnabled: true, provider: async () => { calls += 1; await waiting; return researchPackage(); } });
  const request = { action: "research", scanId: identity.scanId, seriesId: identity.seriesId };
  const first = service.execute(request);
  const second = service.execute(request);
  release();
  const drafts = await Promise.all([first, second]);
  assert.equal(calls, 1);
  assert.equal(drafts[0].id, drafts[1].id);
});

test("provider failure returns a safe error and allows only explicit retry", async (t) => {
  let calls = 0;
  const { service, identity } = setup(t, { researchEnabled: true, provider: async () => {
    calls += 1;
    if (calls === 1) throw new Error("secret-provider-key-synthetic");
    return researchPackage();
  } });
  const request = { action: "research", scanId: identity.scanId, seriesId: identity.seriesId };
  await assert.rejects(service.execute(request), (error) => error.code === "MATCH_STORY_RESEARCH_FAILED" && !error.message.includes("secret"));
  assert.equal(calls, 1);
  assert.equal((await service.execute(request)).revision, 1);
  assert.equal(calls, 2);
});

test("service reads, revises, confirms and invalidates using current snapshot", async (t) => {
  const { service, identity } = setup(t);
  const draft = await service.execute({ action: "import", scanId: identity.scanId, seriesId: identity.seriesId, research: researchPackage() });
  assert.equal((await service.execute({ action: "read", id: draft.id, expectedRevision: 1 })).id, draft.id);
  const revised = await service.execute({ action: "revise", id: draft.id, expectedRevision: 1, patch: {
    selectedCandidateId: "candidate-1", segments: [{ narration: "依報導，合成隊伍贏下交戰。", factIds: ["fact-1"] }],
  } });
  const confirmed = await service.execute({ action: "confirm", id: draft.id, expectedRevision: revised.revision });
  assert.equal(confirmed.confirmedRevision, 2);
  const next = await service.execute({ action: "revise", id: draft.id, expectedRevision: 2, patch: {} });
  assert.equal(next.confirmedRevision, null);
});

test("unknown actions or client approval fields are rejected before any write", async (t) => {
  const { service, identity } = setup(t);
  await assert.rejects(service.execute({ action: "publish", scanId: identity.scanId }), { code: "MATCH_STORY_INVALID_REQUEST" });
  await assert.rejects(service.execute({ action: "import", scanId: identity.scanId, seriesId: identity.seriesId, research: researchPackage(), approved: true }), { code: "MATCH_STORY_INVALID_REQUEST" });
});

test("expired snapshot errors are stable and do not expose input or storage details", async (t) => {
  const { service, identity } = setup(t, { readSnapshot: () => { throw new Error("Candidate scan expired: /private/synthetic-secret"); } });
  await assert.rejects(service.execute({ action: "import", scanId: identity.scanId, seriesId: identity.seriesId, research: researchPackage() }), (error) => error.code === "MATCH_STORY_SNAPSHOT_UNAVAILABLE" && !error.message.includes("private"));
});

test("future-dated completed-looking data is still ineligible", async (t) => {
  const { service, identity, series } = setup(t);
  series.date = "2999-01-01";
  const research = researchPackage();
  research.identity.date = series.date;
  await assert.rejects(service.execute({ action: "import", scanId: identity.scanId, seriesId: identity.seriesId, research }), { code: "MATCH_STORY_MATCH_INELIGIBLE" });
});

test("snapshot changes during research are rechecked before saving results", async (t) => {
  let series;
  const context = setup(t, { researchEnabled: true, provider: async () => {
    series.seriesScore = "3-2";
    return researchPackage();
  } });
  series = context.series;
  const { service, identity } = context;
  await assert.rejects(service.execute({ action: "research", scanId: identity.scanId, seriesId: identity.seriesId }), { code: "MATCH_STORY_IDENTITY_MISMATCH" });
});
