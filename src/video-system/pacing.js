export const buildTimeline = (storyboard, fps, narrationStart = 35) => {
  let cursor = narrationStart;
  return storyboard.map((scene) => {
    const duration = scene.durationInFrames || fps * 3;
    const item = { ...scene, start: cursor, duration };
    cursor += duration;
    return item;
  });
};

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
