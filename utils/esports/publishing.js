const { createPublishJobs: defaultCreatePublishJobs } = require("../publishing");

const ESPORTS_PLATFORMS = ["instagram", "threads"];

function normalizeVideo(video = {}) {
  return {
    locale: video.locale,
    label: video.label || `${video.type || "video"}-${video.locale}`,
    videoUrl: video.videoUrl,
    fileName: video.fileName,
    type: video.type,
  };
}

async function createEsportsPublishJobs(seriesRun = {}, deps = {}) {
  if (seriesRun.dryRun) {
    return { success: true, skipped: true, reason: "dry_run", jobs: [] };
  }
  if (seriesRun.gate && seriesRun.gate.passed === false) {
    return { success: true, skipped: true, reason: "gate_failed", jobs: [] };
  }

  const createPublishJobs = deps.createPublishJobs || defaultCreatePublishJobs;
  const platforms = Array.isArray(seriesRun.platforms) && seriesRun.platforms.length > 0
    ? seriesRun.platforms
    : ESPORTS_PLATFORMS;
  const action = seriesRun.publishAction || "queue";
  const videos = (seriesRun.videos || [])
    .filter((video) => video.videoUrl && ["zh", "en"].includes(video.locale))
    .map(normalizeVideo);

  if (videos.length === 0) {
    return { success: true, skipped: true, reason: "no_videos", jobs: [] };
  }

  const result = await createPublishJobs({
    videos,
    platforms,
    action,
    scheduledAt: seriesRun.scheduledAt,
    analysis: {
      dataType: "ESPORTS_MATCH_RECAP",
      seriesId: seriesRun.seriesId,
      match: seriesRun.semantic?.match || {},
      recapPoints: seriesRun.semantic?.recapPoints || [],
      matchupEdges: seriesRun.semantic?.matchupEdges || [],
    },
  });

  return {
    ...result,
    platforms,
    jobs: result.jobs || [],
  };
}

module.exports = {
  ESPORTS_PLATFORMS,
  createEsportsPublishJobs,
};
