export const buildTimeline = (storyboard, fps, narrationStart = 35) => {
  let cursor = narrationStart;
  return storyboard.map((scene) => {
    const duration = scene.durationInFrames || fps * 3;
    const item = { ...scene, start: cursor, duration };
    cursor += duration;
    return item;
  });
};

export const calculatePacing = (storyboard, fps, { narrationStart = 35 } = {}) => {
  const basePaddingDefault = fps * 1.5;
  const basePaddingFast = fps * 0.8;
  const charsPerSec = 5;
  const sceneDurations = storyboard.map((scene) => {
    if (scene.durationInFrames) return scene.durationInFrames;
    const chars = scene.text ? scene.text.length : 5;
    let duration =
      Math.floor((chars / charsPerSec) * fps) +
      (scene.tag === "SKILL_SHOWCASE" ? basePaddingFast : basePaddingDefault);
    if (scene.tag === "CONCLUSION_CTA") duration += fps * 2.5;
    return duration;
  });

  return {
    narrationStart,
    sceneDurations,
    totalFrames: narrationStart + sceneDurations.reduce((sum, duration) => sum + duration, 0),
  };
};

export const calculateMetadataFrames = (
  storyboards,
  fps,
  { narrationStart = 35, finalBuffer = 30 } = {},
) =>
  storyboards.reduce(
    (sum, storyboard) =>
      sum + calculatePacing(storyboard, fps, { narrationStart }).totalFrames + finalBuffer,
    0,
  );

export const getPostMatchReadStoryboard = (data = {}) =>
  data.dataType === "PLAYER_RADAR" && Array.isArray(data.postMatchRead?.storyboard)
    ? data.postMatchRead.storyboard
    : null;

export const getActiveTimelineScene = (timeline, frame) => {
  if (!Array.isArray(timeline) || timeline.length === 0) {
    return { scene: null, index: 0, start: 0, localFrame: frame };
  }

  if (frame < timeline[0].start) {
    return {
      scene: timeline[0],
      index: 0,
      start: timeline[0].start,
      localFrame: 0,
    };
  }

  const activeIndex = timeline.findIndex((scene) => frame >= scene.start && frame < scene.start + scene.duration);
  const index = activeIndex >= 0 ? activeIndex : timeline.length - 1;
  const scene = timeline[index];
  return {
    scene,
    index,
    start: scene.start,
    localFrame: Math.max(0, frame - scene.start),
  };
};

export const getTimelineTotalFrames = (storyboard, fps, narrationStart = 35, finalBuffer = 30) =>
  narrationStart + storyboard.reduce((sum, scene) => sum + (scene.durationInFrames || fps * 3), 0) + finalBuffer;
