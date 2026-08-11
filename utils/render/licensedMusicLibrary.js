const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const TRACKED_LIBRARY = require("../../config/licensed-music-library.json");

const MUSIC_ROOT_RELATIVE_PATH = path.join(".data", "licensed-music");
const PUBLIC_AUDIO_ROOT_RELATIVE_PATH = path.join("public", "audio");
const STAGED_AUDIO_RELATIVE_PATH = path.join("render-assets", "audio");
const SUPPORTED_EXTENSIONS = new Set([".mp3", ".m4a", ".wav"]);

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

    eligibleTracks.push({ ...track, sourcePath, isPublicAsset });
  }

  return eligibleTracks;
}

function selectAndStageLicensedMusic({ rootDir = process.cwd(), random = Math.random, library = TRACKED_LIBRARY } = {}) {
  const eligibleTracks = readEligibleTracks(rootDir, library);
  if (eligibleTracks.length === 0) return null;

  const randomValue = Number(random());
  const boundedRandom = Number.isFinite(randomValue) ? Math.min(Math.max(randomValue, 0), 0.999999999) : 0;
  const track = eligibleTracks[Math.floor(boundedRandom * eligibleTracks.length)];
  const sourcePath = track.sourcePath;
  const extension = path.extname(sourcePath).toLowerCase();
  if (track.isPublicAsset) {
    return {
      trackId: String(track.id || path.basename(sourcePath)),
      title: String(track.title || track.id || path.basename(sourcePath)),
      bgmFile: path.relative(path.join(rootDir, "public"), sourcePath).split(path.sep).join(path.posix.sep),
    };
  }

  const stagedFileName = `${String(track.sha256).slice(0, 16).toLowerCase()}${extension}`;
  const stagedDir = path.join(rootDir, "public", STAGED_AUDIO_RELATIVE_PATH);
  const stagedPath = path.join(stagedDir, stagedFileName);
  fs.mkdirSync(stagedDir, { recursive: true });
  if (!fs.existsSync(stagedPath) || fileSha256(stagedPath) !== String(track.sha256).toLowerCase()) {
    fs.copyFileSync(sourcePath, stagedPath);
  }

  return {
    trackId: String(track.id || stagedFileName),
    title: String(track.title || track.id || stagedFileName),
    bgmFile: path.posix.join("render-assets", "audio", stagedFileName),
  };
}

module.exports = {
  selectAndStageLicensedMusic,
};
