const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "../../..");

test("post-match read canary is preview-only by construction", () => {
  const { buildCanaryOptions, readFrozenCandidateSnapshot } = require(path.join(ROOT, "scripts/renderPostMatchReadCanary.js"));
  const options = buildCanaryOptions([]);

  assert.equal(options.scanId, "canary-gen-hle-2026");
  assert.equal(options.seriesId, "LCK-2026-GEN-HLE-2-0");
  assert.equal(options.matchupPlayerName, "Chovy");
  assert.equal(options.mvpPlayerName, "Ruler");
  assert.equal(options.mode, "preview");
  assert.deepEqual(options.languages, ["zh"]);
  assert.equal(Object.hasOwn(options, "scheduledAt"), false);
  const snapshot = readFrozenCandidateSnapshot(options.scanId);
  assert.equal(snapshot.candidates[0].gameTeamStats[0].teams.length, 2);
});

test("post-match read canary rejects publishing and production arguments", () => {
  const { buildCanaryOptions } = require(path.join(ROOT, "scripts/renderPostMatchReadCanary.js"));

  for (const args of [["--publish"], ["--queue"], ["--mode=production"], ["production"]]) {
    assert.throws(() => buildCanaryOptions(args), /preview-only canary/i);
  }
});

test("frozen canary reader never touches the production .data store", () => {
  const { readFrozenCandidateSnapshot } = require(path.join(ROOT, "scripts/renderPostMatchReadCanary.js"));
  const originalReadFileSync = fs.readFileSync;
  const reads = [];
  fs.readFileSync = (...args) => {
    reads.push(String(args[0]));
    return originalReadFileSync(...args);
  };
  try {
    const snapshot = readFrozenCandidateSnapshot("canary-gen-hle-2026");
    assert.equal(snapshot.scanId, "canary-gen-hle-2026");
  } finally {
    fs.readFileSync = originalReadFileSync;
  }
  assert.equal(reads.some((entry) => entry.includes(`${path.sep}.data${path.sep}`)), false);
});

test("frozen team-final evidence identifies the actual winning map team", () => {
  const { readFrozenCandidateSnapshot } = require(path.join(ROOT, "scripts/renderPostMatchReadCanary.js"));
  const game = readFrozenCandidateSnapshot("canary-gen-hle-2026").candidates[0].gameTeamStats[0];
  const winner = game.teams.find((team) => team.team === game.winningTeam);

  assert.equal(winner?.isWinner, true);
  assert.equal(game.teams.filter((team) => team.isWinner).length, 1);
});
