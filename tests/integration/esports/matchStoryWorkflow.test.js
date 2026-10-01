const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { fork } = require("node:child_process");
const { once } = require("node:events");
const { researchPackage } = require("../../fixtures/match-story/research");

test("real HTTP and disk workflow imports, reads, confirms then invalidates after revision", { timeout: 15000 }, async (t) => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "lol-story-http-"));
  const child = fork(path.resolve(__dirname, "../../fixtures/match-story/httpServer.js"), [], { cwd, stdio: ["ignore", "pipe", "pipe", "ipc"] });
  let output = "";
  child.stderr.on("data", (chunk) => { output += chunk; });
  t.after(async () => {
    if (child.exitCode === null) { child.kill(); await once(child, "exit"); }
    fs.rmSync(cwd, { recursive: true, force: true });
  });
  const research = researchPackage();
  const identity = research.identity;
  const ready = Promise.race([once(child, "message"), once(child, "exit").then(() => { throw new Error(output || "HTTP fixture exited before readiness"); })]);
  child.send({ scanId: identity.scanId, createdAt: new Date().toISOString(), candidates: [{ ...identity,
    tournament: "LCK 2026 Season", status: "completed", completeness: { hasTenPlayers: true, hasFiveRoleMatchups: true },
    players: Array.from({ length: 10 }, () => ({})), roleMatchups: Array.from({ length: 5 }, () => ({ left: {}, right: {} })),
  }] });
  const [message] = await ready;
  const url = `http://127.0.0.1:${message.port}/api/esports/story`;
  async function post(body) {
    const response = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    return { status: response.status, ...(await response.json()) };
  }
  const imported = await post({ action: "import", scanId: identity.scanId, seriesId: identity.seriesId, research });
  assert.equal(imported.status, 200);
  const id = imported.draft.id;
  assert.deepEqual((await post({ action: "read", id, expectedRevision: 1 })).draft.identity, identity);
  const revised = await post({ action: "revise", id, expectedRevision: 1, patch: { selectedCandidateId: "candidate-1",
    segments: [{ narration: "依報導，合成隊伍贏下交戰。", factIds: ["fact-1"] }] } });
  assert.equal(revised.draft.revision, 2);
  assert.equal((await post({ action: "confirm", id, expectedRevision: 2 })).draft.confirmedRevision, 2);
  const changed = await post({ action: "revise", id, expectedRevision: 2, patch: {} });
  assert.equal(changed.draft.confirmedRevision, null);
  assert.equal((await post({ action: "confirm", id, expectedRevision: 2 })).status, 409);
  assert.equal((await post({ action: "research", scanId: identity.scanId, seriesId: identity.seriesId })).status, 503);
  assert.equal(fs.existsSync(path.join(cwd, ".data", "publish-queue.json")), false);
  const stored = JSON.parse(fs.readFileSync(path.join(cwd, ".data", "match-story-drafts.json"), "utf8"));
  assert.equal(stored.drafts[id].length, 3);
  const before = fs.readFileSync(path.join(cwd, ".data", "match-story-drafts.json"), "utf8");
  assert.equal((await post({ action: "read", id: "../../outside", expectedRevision: 1 })).code, "MATCH_STORY_INVALID_ID");
  assert.equal((await post({ action: "confirm", id, expectedRevision: 3, approved: true })).status, 400);
  assert.equal((await post({ action: "import", scanId: identity.scanId, seriesId: identity.seriesId,
    research: { ...research, identity: { ...identity, seriesId: "another-series" } } })).status, 409);
  assert.equal((await post({ action: "publish", id, expectedRevision: 3 })).status, 400);
  const originResponse = await fetch(url, { method: "POST", headers: { "content-type": "application/json", origin: "https://example.com" }, body: JSON.stringify({ action: "revise", id, expectedRevision: 3, patch: {} }) });
  assert.equal(originResponse.status, 403);
  assert.equal(fs.readFileSync(path.join(cwd, ".data", "match-story-drafts.json"), "utf8"), before);
  assert.deepEqual(fs.readdirSync(path.join(cwd, ".data")).sort(), ["esports-candidate-scans.json", "match-story-drafts.json"]);
});
