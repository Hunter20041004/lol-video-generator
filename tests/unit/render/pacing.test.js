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
