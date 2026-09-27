export const POST_MATCH_READ_FREEZE_FRAME = 1140;

export const POST_MATCH_READ_MOTION_EVENTS = Object.freeze({
  RESULT_HOOK: Object.freeze(["score-lock", "winner-lock"]),
  MATCHUP_EDGE: Object.freeze(["matchup-rail", "evidence-lock"]),
  EARLY_CONTROL: Object.freeze(["rift-reveal", "objective-lock"]),
  MAP_CONVERSION: Object.freeze(["conversion-rail", "evidence-swap"]),
  PLAYER_PROOF: Object.freeze(["player-reveal", "stats-lock"]),
  FINAL_READ: Object.freeze(["victory-lock", "recap-lock"]),
});

const clamp01 = (value) => Math.min(Math.max(value, 0), 1);

export const freezePostMatchReadFrame = (frame) =>
  Math.min(Math.max(Number(frame) || 0, 0), POST_MATCH_READ_FREEZE_FRAME);

export const broadcastLockProgress = ({ frame, start = 0, duration = 1, reducedMotion = false } = {}) => {
  if (reducedMotion) return 1;
  const progress = clamp01((Number(frame) - Number(start)) / Math.max(Number(duration), 1));
  return 1 - ((1 - progress) ** 3);
};

export const motionProgress = ({ frame, start = 0, duration = 1, reducedMotion = false } = {}) => {
  const linearProgress = clamp01((Number(frame) - Number(start)) / Math.max(Number(duration), 1));
  const opacity = 1 - ((1 - linearProgress) ** 3);
  if (reducedMotion) return { opacity, translateY: 0, scale: 1 };
  return {
    opacity,
    translateY: (1 - opacity) * 4,
    scale: 0.96 + opacity * 0.04,
  };
};
