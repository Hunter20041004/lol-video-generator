const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const ROOT = path.resolve(__dirname, "../../..");
const library = require("../../../config/licensed-music-library.json");

function lastNumber(output, pattern) {
  const matches = [...output.matchAll(pattern)];
  return matches.length > 0 ? Number(matches.at(-1)[1]) : NaN;
}

for (const track of library.tracks) {
  test(`licensed segment ${track.id} starts promptly and meets loudness limits`, () => {
    const segment = track.safeSegments.find((candidate) => candidate.id === "post-match-read-12s");
    const fadeSeconds = 2 / 30;
    const filter = [
      `volume=${segment.gain}`,
      `afade=t=in:st=0:d=${fadeSeconds}`,
      `afade=t=out:st=${12 - fadeSeconds}:d=${fadeSeconds}`,
      "silencedetect=noise=-45dB:d=0.05",
      "ebur128=peak=true",
    ].join(",");
    const result = spawnSync("ffmpeg", [
      "-hide_banner",
      "-nostats",
      "-ss", String(segment.startSeconds),
      "-t", "12",
      "-i", path.join(ROOT, track.sourcePath),
      "-af", filter,
      "-f", "null",
      "-",
    ], { encoding: "utf8", shell: false });
    const output = `${result.stdout || ""}\n${result.stderr || ""}`;

    assert.equal(result.status, 0, output);
    const openingSilenceEnd = lastNumber(output, /silence_start:\s*0(?:\.0+)?[\s\S]*?silence_end:\s*([\d.]+)/g);
    if (Number.isFinite(openingSilenceEnd)) {
      assert.equal(openingSilenceEnd <= fadeSeconds + 0.05, true, `${track.id} opening silence ended at ${openingSilenceEnd}s`);
    }
    const integratedLufs = lastNumber(output, /I:\s+(-?[\d.]+)\s+LUFS/g);
    const truePeakDbfs = lastNumber(output, /Peak:\s+(-?[\d.]+)\s+dBFS/g);
    assert.equal(Number.isFinite(integratedLufs), true, output);
    assert.equal(integratedLufs >= -18 && integratedLufs <= -16, true, `${track.id} measured ${integratedLufs} LUFS`);
    assert.equal(Number.isFinite(truePeakDbfs), true, output);
    assert.equal(truePeakDbfs <= -1, true, `${track.id} measured ${truePeakDbfs} dBFS`);
  });
}
