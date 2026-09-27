const test = require("node:test");
const assert = require("node:assert/strict");

test("post-match read freezes every visual clock at frame 1140", async () => {
  const { freezePostMatchReadFrame } = await import("../../../src/templates/player-radar/postMatchReadMotion.js");

  assert.equal(freezePostMatchReadFrame(1139), 1139);
  assert.equal(freezePostMatchReadFrame(1140), 1140);
  assert.equal(freezePostMatchReadFrame(1199), 1140);
  assert.equal(freezePostMatchReadFrame(-1), 0);
});

test("post-match read limits each beat to two calm motion events", async () => {
  const { POST_MATCH_READ_MOTION_EVENTS } = await import("../../../src/templates/player-radar/postMatchReadMotion.js");

  assert.deepEqual(Object.keys(POST_MATCH_READ_MOTION_EVENTS), [
    "RESULT_HOOK", "MATCHUP_EDGE", "EARLY_CONTROL", "MAP_CONVERSION", "PLAYER_PROOF", "FINAL_READ",
  ]);
  for (const events of Object.values(POST_MATCH_READ_MOTION_EVENTS)) {
    assert.equal(events.length <= 2, true);
  }
  assert.deepEqual(POST_MATCH_READ_MOTION_EVENTS.RESULT_HOOK, ["score-lock", "winner-lock"]);
  assert.deepEqual(POST_MATCH_READ_MOTION_EVENTS.MATCHUP_EDGE, ["matchup-rail", "evidence-lock"]);
  assert.deepEqual(POST_MATCH_READ_MOTION_EVENTS.EARLY_CONTROL, ["rift-reveal", "objective-lock"]);
  assert.deepEqual(POST_MATCH_READ_MOTION_EVENTS.MAP_CONVERSION, ["conversion-rail", "evidence-swap"]);
  assert.deepEqual(POST_MATCH_READ_MOTION_EVENTS.PLAYER_PROOF, ["player-reveal", "stats-lock"]);
  assert.deepEqual(POST_MATCH_READ_MOTION_EVENTS.FINAL_READ, ["victory-lock", "recap-lock"]);
});

test("motion uses a calm ease-out while reduced motion removes translation and scaling", async () => {
  const { motionProgress } = await import("../../../src/templates/player-radar/postMatchReadMotion.js");
  const normal = motionProgress({ frame: 5, start: 0, duration: 10, reducedMotion: false });
  const reduced = motionProgress({ frame: 5, start: 0, duration: 10, reducedMotion: true });

  assert.equal(normal.opacity > 0.5 && normal.opacity < 1, true);
  assert.equal(normal.translateY > 0 && normal.translateY <= 4, true);
  assert.equal(normal.scale >= 0.96 && normal.scale <= 1, true);
  assert.deepEqual(reduced, { opacity: normal.opacity, translateY: 0, scale: 1 });
});

test("broadcast lock progress completes once and reduced motion renders the final state", async () => {
  const { broadcastLockProgress } = await import("../../../src/templates/player-radar/postMatchReadMotion.js");

  assert.equal(typeof broadcastLockProgress, "function");
  assert.equal(broadcastLockProgress({ frame: 2, start: 4, duration: 6 }), 0);
  const middle = broadcastLockProgress({ frame: 7, start: 4, duration: 6 });
  assert.equal(middle > 0 && middle < 1, true);
  assert.equal(broadcastLockProgress({ frame: 30, start: 4, duration: 6 }), 1);
  assert.equal(broadcastLockProgress({ frame: 2, start: 4, duration: 6, reducedMotion: true }), 1);
});
