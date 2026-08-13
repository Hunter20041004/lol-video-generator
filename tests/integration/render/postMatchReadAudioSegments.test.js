const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const ROOT = path.resolve(__dirname, "../../..");
const library = require("../../../config/licensed-music-library.json");
const { buildSegmentAudioArgs } = require("../../../utils/render/licensedMusicLibrary");

function lastNumber(output, pattern) {
  const matches = [...output.matchAll(pattern)];
  return matches.length > 0 ? Number(matches.at(-1)[1]) : NaN;
}

function run(command, args) {
  const result = spawnSync(command, args, { encoding: "utf8", shell: false });
  const output = `${result.stdout || ""}\n${result.stderr || ""}`;
  assert.equal(result.status, 0, output);
  return output;
}

for (const track of library.tracks) {
  test(`licensed segment ${track.id} renders a verified 25-second production WAV`, () => {
    const sourcePath = path.join(ROOT, track.sourcePath);
    const sourceHash = crypto.createHash("sha256").update(fs.readFileSync(sourcePath)).digest("hex");
    assert.equal(sourceHash, track.sha256);
    const segment = track.safeSegments.find((candidate) => candidate.id === "post-match-read-25s");
    assert.ok(segment);
    assert.equal(segment.fadeMilliseconds >= 30, true);
    assert.equal(segment.maxLeadingSilenceMilliseconds <= 50, true);

    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "hvs-audio-segment-"));
    const outputPath = path.join(tempDir, `${track.id}.wav`);
    try {
      run("ffmpeg", buildSegmentAudioArgs({ sourcePath, outputPath, segment }));
      const probe = JSON.parse(run("ffprobe", [
        "-v", "error", "-show_entries", "format=duration:stream=sample_rate,channels",
        "-of", "json", outputPath,
      ]));
      assert.equal(Math.abs(Number(probe.format.duration) - 25) <= 0.01, true, probe.format.duration);
      assert.equal(Number(probe.streams[0].sample_rate), 48000);
      assert.equal(Number(probe.streams[0].channels), 2);

      const measured = run("ffmpeg", [
        "-hide_banner", "-nostats", "-i", outputPath,
        "-af", "silencedetect=noise=-45dB:d=0.001,ebur128=peak=true", "-f", "null", "-",
      ]);
      const openingSilenceEnd = lastNumber(measured, /silence_start:\s*0(?:\.0+)?[\s\S]*?silence_end:\s*([\d.]+)/g);
      if (Number.isFinite(openingSilenceEnd)) {
        assert.equal(openingSilenceEnd <= 0.05, true, `${track.id} opening silence ${openingSilenceEnd}s`);
      }
      const integratedLufs = lastNumber(measured, /I:\s+(-?[\d.]+)\s+LUFS/g);
      const truePeakDbfs = lastNumber(measured, /Peak:\s+(-?[\d.]+)\s+dBFS/g);
      assert.equal(integratedLufs >= -18 && integratedLufs <= -16, true, `${track.id} ${integratedLufs} LUFS`);
      assert.equal(truePeakDbfs <= -1, true, `${track.id} ${truePeakDbfs} dBFS`);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
}
