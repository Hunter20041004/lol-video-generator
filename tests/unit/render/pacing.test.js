const test = require("node:test");
const assert = require("node:assert/strict");

test("getActiveTimelineScene returns the first scene before narration starts", async () => {
  const { buildTimeline, getActiveTimelineScene } = await import("../../../src/video-system/pacing.js");

  const timeline = buildTimeline([
    { tag: "HOOK", text: "Hook", durationInFrames: 90 },
    { tag: "BODY", text: "Body", durationInFrames: 120 },
    { tag: "CTA", text: "CTA", durationInFrames: 60 },
  ], 30);

  const active = getActiveTimelineScene(timeline, 0);

  assert.equal(active.scene.tag, "HOOK");
  assert.equal(active.index, 0);
  assert.equal(active.localFrame, 0);
});

test("post-match read pacing is exactly 750 frames without changing other templates", async () => {
  const { calculatePacing } = await import("../../../src/video-system/pacing.js");
  const storyboard = [120, 150, 240, 150, 90].map((durationInFrames, index) => ({
    tag: ["RESULT_HOOK", "MATCHUP_EDGE", "GAME_FLOW", "PLAYER_PROOF", "FINAL_READ"][index],
    text: "賽後判讀",
    durationInFrames,
  }));

  const postMatchRead = calculatePacing(storyboard, 30, { narrationStart: 0 });
  const defaultPacing = calculatePacing(storyboard, 30);

  assert.deepEqual(postMatchRead.sceneDurations, [120, 150, 240, 150, 90]);
  assert.equal(postMatchRead.narrationStart, 0);
  assert.equal(postMatchRead.totalFrames, 750);
  assert.equal(defaultPacing.narrationStart, 35);
  assert.equal(defaultPacing.totalFrames, 785);
});

test("post-match read metadata has no final buffer while other templates keep 30 frames", async () => {
  const { calculateMetadataFrames } = await import("../../../src/video-system/pacing.js");
  const storyboard = [120, 150, 240, 150, 90].map((durationInFrames) => ({ durationInFrames }));

  assert.equal(
    calculateMetadataFrames([storyboard], 30, { narrationStart: 0, finalBuffer: 0 }),
    750,
  );
  assert.equal(calculateMetadataFrames([storyboard], 30), 815);
});

test("post-match read metadata selects the resolved model storyboard", async () => {
  const { getPostMatchReadStoryboard } = await import("../../../src/video-system/pacing.js");
  const resolved = [{ tag: "RESULT_HOOK", durationInFrames: 120 }];

  assert.equal(
    getPostMatchReadStoryboard({
      dataType: "PLAYER_RADAR",
      storyboard: [{ tag: "OLD", durationInFrames: 10 }],
      postMatchRead: { storyboard: resolved },
    }),
    resolved,
  );
});
