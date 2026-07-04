const fs = require("fs");
const path = require("path");

const REQUIRED_ROLES = ["Top", "Jungle", "Mid", "Adc", "Support"];
const REQUIRED_VIDEO_KEYS = [
  "radar:zh",
  "radar:en",
  "recap:zh",
  "recap:en",
];

function normalizeLanguages(languages = ["zh", "en"]) {
  const values = Array.isArray(languages) && languages.length > 0 ? languages : ["zh", "en"];
  return [...new Set(values.map((language) => String(language || "zh").toLowerCase().startsWith("en") ? "en" : "zh"))];
}

function requiredVideoKeysForLanguages(languages = ["zh", "en"]) {
  return normalizeLanguages(languages).flatMap((locale) => [`radar:${locale}`, `recap:${locale}`]);
}

function localVideoPath(videoUrl = "") {
  if (!videoUrl || /^https?:\/\//i.test(videoUrl)) return "";
  const relative = String(videoUrl).startsWith("/") ? String(videoUrl).slice(1) : String(videoUrl);
  return path.join(/*turbopackIgnore: true*/ process.cwd(), "public", relative);
}

function videoExists(video = {}) {
  if (video.exists === true) return true;
  const filePath = video.filePath || localVideoPath(video.videoUrl);
  return Boolean(filePath && fs.existsSync(filePath));
}

function evaluateSeriesGate(run = {}) {
  const reasons = [];
  const players = run.series?.players || run.players || [];
  const matchupEdges = run.semantic?.matchupEdges || run.matchupEdges || [];
  const recapPoints = run.semantic?.recapPoints || run.recapPoints || [];
  const videos = run.videos || [];
  const requiredVideoKeys = requiredVideoKeysForLanguages(run.languages);

  if (run.status && !["RENDERED", "READY", "TEST_RENDERED"].includes(run.status)) {
    reasons.push(`render status is not complete: ${run.status}`);
  }

  if (players.length !== 10) {
    reasons.push(`expected 10 players, got ${players.length}`);
  }

  const edgeRoles = new Set(matchupEdges.filter((edge) => edge.edgeWinner && edge.edgePlayer !== "").map((edge) => edge.role));
  const missingRoles = REQUIRED_ROLES.filter((role) => !edgeRoles.has(role));
  if (missingRoles.length > 0) {
    reasons.push(`missing matchup edge roles: ${missingRoles.join(", ")}`);
  }

  if (recapPoints.length < 3) {
    reasons.push(`recap requires at least 3 points, got ${recapPoints.length}`);
  }

  const videoKeys = new Set(videos.map((video) => `${video.type}:${video.locale}`));
  const missingVideos = requiredVideoKeys.filter((key) => !videoKeys.has(key));
  if (missingVideos.length > 0) {
    reasons.push(`missing localized videos: ${missingVideos.join(", ")}`);
  }

  const missingFiles = videos.filter((video) => !videoExists(video));
  if (missingFiles.length > 0) {
    reasons.push(`missing video files: ${missingFiles.map((video) => video.videoUrl || video.filePath || `${video.type}:${video.locale}`).join(", ")}`);
  }

  if (run.publishReady === false) {
    reasons.push("publish jobs are not ready");
  }

  return {
    passed: reasons.length === 0,
    reasons,
  };
}

module.exports = {
  REQUIRED_ROLES,
  REQUIRED_VIDEO_KEYS,
  requiredVideoKeysForLanguages,
  evaluateSeriesGate,
  videoExists,
};
