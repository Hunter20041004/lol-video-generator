const FPS = 30;
const DURATION_IN_FRAMES = 750;
const DEFAULT_CUT_FRAMES = Object.freeze([0, 120, 270, 510, 660, 750]);
const MAX_SNAP_FRAMES = 6;

function buildPostMatchReadAudioPlan(segment = {}, trackId = "") {
  const startSeconds = Number(segment.startSeconds);
  const fadeMilliseconds = Number.isFinite(Number(segment.fadeMilliseconds))
    ? Number(segment.fadeMilliseconds)
    : 34;
  const downbeatFrames = (segment.downbeats || [])
    .map((beat) => Math.round((Number(beat) - startSeconds) * FPS))
    .filter((frame) => Number.isFinite(frame) && frame > 0 && frame < DURATION_IN_FRAMES);
  const cutFrames = DEFAULT_CUT_FRAMES.map((target, index) => {
    if (index === 0 || index === DEFAULT_CUT_FRAMES.length - 1) return target;
    const nearest = downbeatFrames.reduce((best, frame) =>
      Math.abs(frame - target) < Math.abs(best - target) ? frame : best,
    Number.POSITIVE_INFINITY);
    if (!Number.isFinite(nearest) || Math.abs(nearest - target) > MAX_SNAP_FRAMES) return target;
    return nearest;
  });
  return {
    trackId,
    sourceStartSeconds: startSeconds,
    durationInFrames: DURATION_IN_FRAMES,
    cutFrames,
    gain: Number(segment.gain),
    fadeFrames: Math.max(1, Math.round((fadeMilliseconds / 1000) * FPS)),
  };
}

module.exports = {
  FPS,
  DURATION_IN_FRAMES,
  DEFAULT_CUT_FRAMES,
  MAX_SNAP_FRAMES,
  buildPostMatchReadAudioPlan,
};
