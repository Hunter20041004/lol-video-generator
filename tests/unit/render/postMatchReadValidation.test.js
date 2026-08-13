const test = require("node:test");
const assert = require("node:assert/strict");

const {
  inspectPostMatchReadMedia,
  validatePostMatchReadRender,
  validatePostMatchReadMediaReport,
} = require("../../../utils/render/postMatchReadValidation");

test("validatePostMatchReadMediaReport accepts only the approved 12-second vertical media contract", () => {
  const valid = validatePostMatchReadMediaReport({
    videoCodec: "h264",
    audioCodec: "aac",
    width: 1080,
    height: 1920,
    fps: 30,
    duration: 12,
    integratedLufs: -17,
    truePeakDbfs: -1.2,
  });
  const invalid = validatePostMatchReadMediaReport({
    videoCodec: "vp9",
    audioCodec: "opus",
    width: 1920,
    height: 1080,
    fps: 29.5,
    duration: 11.5,
    integratedLufs: -25,
    truePeakDbfs: 0,
  });

  assert.deepEqual(valid, { passed: true, reasons: [], media: valid.media });
  assert.equal(invalid.passed, false);
  assert.equal(invalid.reasons.length, 7);
  assert.match(invalid.reasons.join("; "), /H\.264|AAC|1080×1920|30fps|12\.0 seconds|-18 to -16 LUFS|true peak/);
});

test("validatePostMatchReadRender probes only a file under public renders without a shell", async () => {
  const calls = [];
  const execFileImpl = async (command, args) => {
    calls.push({ command, args });
    if (command === "ffprobe") {
      return {
        stdout: JSON.stringify({
          format: { duration: "12.000" },
          streams: [
            { codec_type: "video", codec_name: "h264", width: 1080, height: 1920, r_frame_rate: "30/1" },
            { codec_type: "audio", codec_name: "aac" },
          ],
        }),
        stderr: "",
      };
    }
    return { stdout: "", stderr: "Summary:\n  I: -17.0 LUFS\n  Peak: -1.2 dBFS\n" };
  };

  const report = await validatePostMatchReadRender({ videoUrl: "/renders/read.mp4" }, {
    cwd: "/tmp/post-match-read-validation",
    execFileImpl,
  });

  assert.equal(report.passed, true);
  assert.deepEqual(calls.map((call) => call.command), ["ffprobe", "ffmpeg"]);
  assert.equal(calls[0].args.at(-1), "/tmp/post-match-read-validation/public/renders/read.mp4");
  await assert.rejects(
    () => inspectPostMatchReadMedia({ fileName: "../../outside.mp4" }, { cwd: "/tmp/post-match-read-validation", execFileImpl }),
    /only under public\/renders/
  );
});
