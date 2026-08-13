const path = require("node:path");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");

const execFileAsync = promisify(execFile);

function parseRate(value = "") {
  const [numerator, denominator = "1"] = String(value).split("/").map(Number);
  return Number.isFinite(numerator) && Number.isFinite(denominator) && denominator !== 0
    ? numerator / denominator
    : NaN;
}

function lastNumber(text = "", pattern) {
  const matches = [...String(text).matchAll(pattern)];
  return matches.length > 0 ? Number(matches.at(-1)[1]) : NaN;
}

function resolveRenderPath(video = {}, cwd = process.cwd()) {
  const rendersDir = path.resolve(cwd, "public", "renders");
  const requested = String(video.fileName || video.videoUrl || "").replace(/^\/renders\//, "");
  const filePath = path.resolve(rendersDir, requested);
  const relative = path.relative(rendersDir, filePath);
  if (!requested || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Post Match Read validation accepts files only under public/renders/.");
  }
  return filePath;
}

async function inspectPostMatchReadMedia(video, {
  cwd = process.cwd(),
  execFileImpl = execFileAsync,
} = {}) {
  const filePath = resolveRenderPath(video, cwd);
  const probe = await execFileImpl("ffprobe", [
    "-v", "error",
    "-show_entries", "format=duration:stream=index,codec_type,codec_name,width,height,r_frame_rate",
    "-of", "json",
    filePath,
  ]);
  const probeJson = JSON.parse(probe.stdout || "{}");
  const streams = Array.isArray(probeJson.streams) ? probeJson.streams : [];
  const videoStream = streams.find((stream) => stream.codec_type === "video") || {};
  const audioStream = streams.find((stream) => stream.codec_type === "audio") || {};
  const loudness = await execFileImpl("ffmpeg", [
    "-hide_banner", "-nostats", "-i", filePath,
    "-filter_complex", "ebur128=peak=true",
    "-f", "null", "-",
  ]);
  const loudnessOutput = `${loudness.stdout || ""}\n${loudness.stderr || ""}`;

  return {
    filePath,
    videoCodec: videoStream.codec_name || "",
    audioCodec: audioStream.codec_name || "",
    width: Number(videoStream.width),
    height: Number(videoStream.height),
    fps: parseRate(videoStream.r_frame_rate),
    duration: Number(probeJson.format?.duration),
    integratedLufs: lastNumber(loudnessOutput, /I:\s+(-?[\d.]+)\s+LUFS/g),
    truePeakDbfs: lastNumber(loudnessOutput, /Peak:\s+(-?[\d.]+)\s+dBFS/g),
  };
}

function validatePostMatchReadMediaReport(media = {}) {
  const reasons = [];
  if (media.videoCodec !== "h264") reasons.push("video codec must be H.264");
  if (media.audioCodec !== "aac") reasons.push("audio codec must be AAC");
  if (Number(media.width) !== 1080 || Number(media.height) !== 1920) reasons.push("video size must be 1080×1920");
  if (!Number.isFinite(Number(media.fps)) || Math.abs(Number(media.fps) - 30) > 0.01) reasons.push("frame rate must be 30fps");
  if (!Number.isFinite(Number(media.duration)) || Math.abs(Number(media.duration) - 12) > 0.08) reasons.push("duration must be 12.0 seconds");
  if (!Number.isFinite(Number(media.integratedLufs)) || Number(media.integratedLufs) < -18 || Number(media.integratedLufs) > -16) {
    reasons.push("integrated loudness must be -18 to -16 LUFS");
  }
  if (!Number.isFinite(Number(media.truePeakDbfs)) || Number(media.truePeakDbfs) > -1) reasons.push("true peak must be at most -1 dBFS");
  return { passed: reasons.length === 0, reasons, media };
}

async function validatePostMatchReadRender(video, options = {}) {
  return validatePostMatchReadMediaReport(await inspectPostMatchReadMedia(video, options));
}

module.exports = {
  inspectPostMatchReadMedia,
  validatePostMatchReadMediaReport,
  validatePostMatchReadRender,
};
