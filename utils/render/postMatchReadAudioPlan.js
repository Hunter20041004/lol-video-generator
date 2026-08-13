const FPS = 30;
const DURATION_IN_FRAMES = 360;
const DEFAULT_CUT_FRAMES = Object.freeze([0, 54, 150, 270, 360]);

function buildPostMatchReadAudioPlan(segment = {}, trackId = "") {
  const startSeconds = Number(segment.startSeconds);
  const downbeatFrames = (segment.downbeats || [])
    .map((beat) => Math.round((Number(beat) - startSeconds) * FPS))
    .filter((frame) => Number.isFinite(frame) && frame > 0 && frame < DURATION_IN_FRAMES);
  const cutFrames = DEFAULT_CUT_FRAMES.map((target, index) => {
    if (index === 0 || index === DEFAULT_CUT_FRAMES.length - 1) return target;
    const nearest = downbeatFrames.reduce((best, frame) =>
      Math.abs(frame - target) < Math.abs(best - target) ? frame : best,
    Number.POSITIVE_INFINITY);
    if (!Number.isFinite(nearest) || Math.abs(nearest - target) > 6) return target;
    if (index === DEFAULT_CUT_FRAMES.length - 2 && DURATION_IN_FRAMES - nearest < 30) return target;
    return nearest;
  });
  return {
    trackId,
    sourceStartSeconds: startSeconds,
    durationInFrames: DURATION_IN_FRAMES,
    cutFrames,
    gain: Number(segment.gain),
    fadeFrames: 2,
  };
}

module.exports = {
  FPS,
  DURATION_IN_FRAMES,
  DEFAULT_CUT_FRAMES,
  buildPostMatchReadAudioPlan,
};
