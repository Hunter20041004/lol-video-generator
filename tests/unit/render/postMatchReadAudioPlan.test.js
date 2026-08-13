const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "../../..");

const {
  buildPostMatchReadAudioPlan,
} = require("../../../utils/render/postMatchReadAudioPlan");

test("buildPostMatchReadAudioPlan snaps scene cuts only to downbeats within six frames", () => {
  const plan = buildPostMatchReadAudioPlan({
    startSeconds: 0,
    durationSeconds: 12,
    downbeats: [58 / 30, 158 / 30, 273 / 30],
    gain: 0.5,
  }, "synthetic");

  assert.deepEqual(plan.cutFrames, [0, 58, 150, 273, 360]);
  assert.equal(plan.cutFrames[0], 0);
  assert.equal(plan.cutFrames.at(-1), 360);
  assert.equal(360 - plan.cutFrames.at(-2) >= 30, true);
});

test("BgmLayer trims planned audio, fades both edges, and does not loop it", () => {
  const source = fs.readFileSync(path.join(ROOT, "src/video-system/BgmLayer.jsx"), "utf8");

  assert.match(source, /trimBefore/);
  assert.match(source, /trimAfter/);
  assert.match(source, /audioPlan\.fadeFrames/);
  assert.match(source, /Easing\.out\(Easing\.cubic\)/);
  assert.match(source, /Easing\.in\(Easing\.cubic\)/);
  assert.match(source, /audioPlan\.gain\s*\*\s*Math\.min/);
  const plannedAudioTag = source.match(/<Audio[^>]+trimBefore[^>]+>/)?.[0] || "";
  assert.match(plannedAudioTag, /trimAfter/);
  assert.doesNotMatch(plannedAudioTag, /loop/);
});
