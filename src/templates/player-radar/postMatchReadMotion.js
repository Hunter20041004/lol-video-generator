export const POST_MATCH_READ_FREEZE_FRAME = 705;

export const POST_MATCH_READ_MOTION_EVENTS = Object.freeze({
  RESULT_HOOK: Object.freeze(["score-reveal", "hero-identities"]),
  MATCHUP_EDGE: Object.freeze(["identity-focus", "evidence-reveal"]),
  GAME_FLOW: Object.freeze(["map-crossfade", "evidence-stagger"]),
  PLAYER_PROOF: Object.freeze(["portrait-clip", "stats-reveal"]),
  FINAL_READ: Object.freeze(["conclusion-reveal", "recap-reveal"]),
});

const clamp01 = (value) => Math.min(Math.max(value, 0), 1);

export const freezePostMatchReadFrame = (frame) =>
  Math.min(Math.max(Number(frame) || 0, 0), POST_MATCH_READ_FREEZE_FRAME);

export const motionProgress = ({ frame, start = 0, duration = 1, reducedMotion = false } = {}) => {
  const opacity = clamp01((Number(frame) - Number(start)) / Math.max(Number(duration), 1));
  if (reducedMotion) return { opacity, translateY: 0, scale: 1 };
  return {
    opacity,
    translateY: (1 - opacity) * 4,
    scale: 0.96 + opacity * 0.04,
  };
};
