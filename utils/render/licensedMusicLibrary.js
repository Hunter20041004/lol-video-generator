const crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const TRACKED_LIBRARY = require("../../config/licensed-music-library.json");
const { buildPostMatchReadAudioPlan } = require("./postMatchReadAudioPlan");

const MUSIC_ROOT_RELATIVE_PATH = path.join(".data", "licensed-music");
const PUBLIC_AUDIO_ROOT_RELATIVE_PATH = path.join("public", "audio");
const STAGED_AUDIO_RELATIVE_PATH = path.join("render-assets", "audio");
const SUPPORTED_EXTENSIONS = new Set([".mp3", ".m4a", ".wav"]);

function buildSegmentAudioArgs({ sourcePath, outputPath, segment }) {
  const leadTrimSeconds = Number(segment.audibleLeadTrimMilliseconds || 0) / 1000;
  const start = Number(segment.startSeconds) + leadTrimSeconds;
  const duration = Number(segment.durationSeconds);
  const gain = Number(segment.gain);
  const fadeSeconds = Number(segment.fadeMilliseconds) / 1000;
  const fadeOutStart = duration - fadeSeconds;
  return [
    "-y", "-loglevel", "error",
    "-ss", String(start),
    "-t", String(duration),
    "-i", sourcePath,
    "-af", `volume=${gain},afade=t=in:st=0:d=${fadeSeconds},afade=t=out:st=${fadeOutStart}:d=${fadeSeconds}`,
    "-c:a", "pcm_s16le",
    outputPath,
  ];
}

function stageLicensedMusicSegment({ sourcePath, outputPath, segment, execFileSyncImpl = execFileSync }) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  if (!fs.existsSync(outputPath)) {
    execFileSyncImpl("ffmpeg", buildSegmentAudioArgs({ sourcePath, outputPath, segment }), {
      stdio: "pipe",
    });
  }
  return outputPath;
}

function fileSha256(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function isInside(parentPath, childPath) {
  const relative = path.relative(parentPath, childPath);
  return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative);
}

function readEligibleTracks(rootDir, library) {
  const musicRoot = path.resolve(rootDir, MUSIC_ROOT_RELATIVE_PATH);
  const publicAudioRoot = path.resolve(rootDir, PUBLIC_AUDIO_ROOT_RELATIVE_PATH);
  const eligibleTracks = [];

  for (const track of Array.isArray(library?.tracks) ? library.tracks : []) {
    if (!track || track.enabled !== true || track.rightsStatus !== "verified") continue;
    if (!/^[a-f0-9]{64}$/i.test(String(track.sha256 || ""))) continue;

    const sourcePath = path.resolve(rootDir, String(track.sourcePath || ""));
    const extension = path.extname(sourcePath).toLowerCase();
    const isPublicAsset = isInside(publicAudioRoot, sourcePath);
    if ((!isInside(musicRoot, sourcePath) && !isPublicAsset) || !SUPPORTED_EXTENSIONS.has(extension)) continue;
    if (!fs.existsSync(sourcePath) || !fs.statSync(sourcePath).isFile()) continue;
    if (fileSha256(sourcePath) !== String(track.sha256).toLowerCase()) continue;

    const safeSegment = (track.safeSegments || []).find((segment) => {
      const start = Number(segment?.startSeconds);
      const duration = Number(segment?.durationSeconds);
      const gain = Number(segment?.gain);
      const downbeats = Array.isArray(segment?.downbeats) ? segment.downbeats.map(Number) : [];
      return segment?.id === "post-match-read-12s"
        && Number.isFinite(start)
        && Number.isFinite(duration)
        && duration >= 12
        && Number.isFinite(gain)
        && downbeats.length > 0
        && downbeats.every(Number.isFinite)
        && downbeats.some((beat) => beat >= start && beat <= start + duration);
    });
    if (!safeSegment) continue;

    eligibleTracks.push({ ...track, sourcePath, isPublicAsset, safeSegment });
  }

  return eligibleTracks;
}

function selectAndStageLicensedMusic({
  rootDir = process.cwd(),
  random = Math.random,
  library = TRACKED_LIBRARY,
  stageLicensedMusicSegmentImpl = stageLicensedMusicSegment,
} = {}) {
  const eligibleTracks = readEligibleTracks(rootDir, library);
  if (eligibleTracks.length === 0) return null;

  const randomValue = Number(random());
  const boundedRandom = Number.isFinite(randomValue) ? Math.min(Math.max(randomValue, 0), 0.999999999) : 0;
  const track = eligibleTracks[Math.floor(boundedRandom * eligibleTracks.length)];
  const sourcePath = track.sourcePath;
  const audioPlan = buildPostMatchReadAudioPlan(track.safeSegment, track.id);
  const segmentHash = crypto
    .createHash("sha256")
    .update(JSON.stringify(track.safeSegment))
    .digest("hex")
    .slice(0, 8);
  const stagedFileName = `${String(track.sha256).slice(0, 16).toLowerCase()}-${segmentHash}-post-match-read.wav`;
  const stagedDir = path.join(rootDir, "public", STAGED_AUDIO_RELATIVE_PATH);
  const stagedPath = path.join(stagedDir, stagedFileName);
  stageLicensedMusicSegmentImpl({
    sourcePath,
    outputPath: stagedPath,
    segment: track.safeSegment,
  });

  return {
    trackId: String(track.id || stagedFileName),
    title: String(track.title || track.id || stagedFileName),
    bgmFile: path.posix.join("render-assets", "audio", stagedFileName),
    audioPlan: {
      ...audioPlan,
      preprocessed: true,
      sourceStartSeconds: 0,
      gain: 1,
      fadeFrames: 0,
    },
  };
}

module.exports = {
  buildSegmentAudioArgs,
  stageLicensedMusicSegment,
  selectAndStageLicensedMusic,
};
