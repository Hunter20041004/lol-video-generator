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
    durationSeconds: 25,
    downbeats: [124 / 30, 278 / 30, 515 / 30, 668 / 30],
    gain: 0.5,
  }, "synthetic");

  assert.deepEqual(plan.cutFrames, [0, 124, 270, 515, 660, 750]);
  assert.equal(plan.cutFrames[0], 0);
  assert.equal(plan.cutFrames.at(-1), 750);
  assert.equal(plan.durationInFrames, 750);
});

test("34ms fades use one 30fps frame so the audible opening stays under 50ms", () => {
  const plan = buildPostMatchReadAudioPlan({
    startSeconds: 0,
    durationSeconds: 25,
    downbeats: [0, 3, 6, 9],
    gain: 0.5,
    fadeMilliseconds: 34,
  }, "synthetic");

  assert.equal(plan.fadeFrames, 1);
  assert.equal(plan.fadeFrames / 30 >= 0.03, true);
  assert.equal(plan.fadeFrames / 30 < 0.05, true);
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

test("BgmLayer plays preprocessed licensed segments without a second frame fade", () => {
  const source = fs.readFileSync(path.join(ROOT, "src/video-system/BgmLayer.jsx"), "utf8");

  assert.match(source, /if \(audioPlan\.preprocessed\)/);
  assert.match(source, /return <Audio src=\{staticFile\(bgmFile\)\} trimBefore=\{0\} trimAfter=\{audioPlan\.durationInFrames\} \/>/);
});
