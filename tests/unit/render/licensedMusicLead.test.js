const test = require("node:test");
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { buildSegmentAudioArgs } = require("../../../utils/render/licensedMusicLibrary");

test("second verified track leaves room for the measured two AAC frames of encoder delay", () => {
  const track = require("../../../config/licensed-music-library.json").tracks.find((value) => value.id === "licensed-bgm-2");
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "lol-music-lead-"));
  try {
    const outputPath = path.join(root, "segment.wav");
    execFileSync("ffmpeg", buildSegmentAudioArgs({ sourcePath: path.resolve(track.sourcePath), outputPath, segment: track.safeSegments[0] }));
    const { spawnSync } = require("node:child_process");
    const inspected = spawnSync("ffmpeg", ["-hide_banner", "-nostats", "-i", outputPath,
      "-af", "silencedetect=noise=-45dB:d=0.005", "-f", "null", "-"], { encoding: "utf8" });
    assert.equal(inspected.status, 0);
    const match = inspected.stderr.match(/silence_start:\s*0\s[\s\S]*?silence_end:\s*([\d.]+)/);
    const leadMs = match ? Number(match[1]) * 1000 : 0;
    assert.ok(leadMs + (2048 / 48000) * 1000 <= 50, `PCM ${leadMs}ms plus measured AAC delay exceeds 50ms`);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
