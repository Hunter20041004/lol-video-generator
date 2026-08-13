const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const {
  buildSegmentAudioArgs,
  selectAndStageLicensedMusic,
} = require("../../../utils/render/licensedMusicLibrary");

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

const SAFE_SEGMENT = {
  id: "post-match-read-12s",
  startSeconds: 2,
  durationSeconds: 12,
  downbeats: [2, 5, 8, 11],
  gain: 0.5,
  fadeMilliseconds: 34,
};

function stageFakeSegment({ outputPath }) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, "baked-segment");
  return outputPath;
}

test("licensed 12-second segment bakes gain and sample-accurate fades into PCM audio", () => {
  const args = buildSegmentAudioArgs({
    sourcePath: "/music/source.mp3",
    outputPath: "/render/segment.wav",
    segment: SAFE_SEGMENT,
  });

  assert.deepEqual(args.slice(0, 8), ["-y", "-loglevel", "error", "-ss", "2", "-t", "12", "-i"]);
  assert.equal(args.includes("/music/source.mp3"), true);
  assert.equal(args.includes("volume=0.5,afade=t=in:st=0:d=0.034,afade=t=out:st=11.966:d=0.034"), true);
  assert.deepEqual(args.slice(-3), ["-c:a", "pcm_s16le", "/render/segment.wav"]);
});

test("licensed segment applies its calibrated audible lead trim at the source boundary", () => {
  const args = buildSegmentAudioArgs({
    sourcePath: "/music/source.mp3",
    outputPath: "/render/segment.wav",
    segment: { ...SAFE_SEGMENT, audibleLeadTrimMilliseconds: 35 },
  });

  assert.deepEqual(args.slice(3, 7), ["-ss", "2.035", "-t", "12"]);
});

test("staged segment cache key changes when the calibrated segment changes", () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "hvs-segment-cache-"));
  try {
    const audio = Buffer.from("verified-audio");
    const sourcePath = path.join(rootDir, "public", "audio", "source.mp3");
    fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
    fs.writeFileSync(sourcePath, audio);
    const makeLibrary = (audibleLeadTrimMilliseconds) => ({
      version: 1,
      tracks: [{
        id: "cache-key",
        sourcePath: "public/audio/source.mp3",
        sha256: sha256(audio),
        enabled: true,
        rightsStatus: "verified",
        safeSegments: [{ ...SAFE_SEGMENT, audibleLeadTrimMilliseconds }],
      }],
    });
    const first = selectAndStageLicensedMusic({
      rootDir,
      library: makeLibrary(0),
      stageLicensedMusicSegmentImpl: stageFakeSegment,
    });
    const second = selectAndStageLicensedMusic({
      rootDir,
      library: makeLibrary(35),
      stageLicensedMusicSegmentImpl: stageFakeSegment,
    });

    assert.notEqual(first.bgmFile, second.bgmFile);
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});

test("selected music uses the baked 12-second WAV without a second frame fade", () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "hvs-baked-music-"));
  try {
    const sourcePath = path.join(rootDir, "public", "audio", "source.wav");
    fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
    execFileSync("ffmpeg", [
      "-y", "-loglevel", "error", "-f", "lavfi", "-i", "sine=frequency=440:duration=14",
      "-c:a", "pcm_s16le", sourcePath,
    ]);
    const library = {
      version: 1,
      tracks: [{
        id: "baked",
        sourcePath: "public/audio/source.wav",
        sha256: crypto.createHash("sha256").update(fs.readFileSync(sourcePath)).digest("hex"),
        enabled: true,
        rightsStatus: "verified",
        safeSegments: [{ ...SAFE_SEGMENT, startSeconds: 1 }],
      }],
    };

    const selected = selectAndStageLicensedMusic({ rootDir, library, random: () => 0 });

    assert.match(selected.bgmFile, /^render-assets\/audio\/[a-f0-9]{16}-[a-f0-9]{8}-post-match-read\.wav$/);
    assert.equal(fs.existsSync(path.join(rootDir, "public", selected.bgmFile)), true);
    assert.equal(selected.audioPlan.preprocessed, true);
    assert.equal(selected.audioPlan.sourceStartSeconds, 0);
    assert.equal(selected.audioPlan.gain, 1);
    assert.equal(selected.audioPlan.fadeFrames, 0);
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});

test("selectAndStageLicensedMusic stages only enabled verified tracks", () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "hvs-licensed-music-"));
  try {
    const musicDir = path.join(rootDir, ".data", "licensed-music");
    fs.mkdirSync(musicDir, { recursive: true });
    const verifiedAudio = Buffer.from("verified-audio");
    const pendingAudio = Buffer.from("pending-audio");
    fs.writeFileSync(path.join(musicDir, "verified.mp3"), verifiedAudio);
    fs.writeFileSync(path.join(musicDir, "pending.mp3"), pendingAudio);
    const library = {
      version: 1,
      tracks: [
        {
          id: "verified",
          sourcePath: ".data/licensed-music/verified.mp3",
          sha256: sha256(verifiedAudio),
          enabled: true,
          rightsStatus: "verified",
          safeSegments: [SAFE_SEGMENT],
        },
        {
          id: "pending",
          sourcePath: ".data/licensed-music/pending.mp3",
          sha256: sha256(pendingAudio),
          enabled: true,
          rightsStatus: "pending",
        },
      ],
    };

    const selected = selectAndStageLicensedMusic({
      rootDir,
      library,
      random: () => 0.99,
      stageLicensedMusicSegmentImpl: stageFakeSegment,
    });

    assert.equal(selected.trackId, "verified");
    assert.match(selected.bgmFile, /^render-assets\/audio\/[a-f0-9]{16}-[a-f0-9]{8}-post-match-read\.wav$/);
    assert.equal(fs.readFileSync(path.join(rootDir, "public", selected.bgmFile), "utf8"), "baked-segment");
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});

test("selectAndStageLicensedMusic selects a verified tracked public asset", () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "hvs-tracked-music-"));
  try {
    const audio = Buffer.from("tracked-verified-audio");
    fs.mkdirSync(path.join(rootDir, "config"), { recursive: true });
    fs.mkdirSync(path.join(rootDir, "public", "audio"), { recursive: true });
    fs.writeFileSync(path.join(rootDir, "public", "audio", "verified.mp3"), audio);
    const library = {
      version: 1,
      tracks: [{
        id: "tracked-verified",
        sourcePath: "public/audio/verified.mp3",
        sha256: sha256(audio),
        enabled: true,
        rightsStatus: "verified",
        safeSegments: [SAFE_SEGMENT],
      }],
    };

    const selected = selectAndStageLicensedMusic({
      rootDir,
      library,
      random: () => 0,
      stageLicensedMusicSegmentImpl: stageFakeSegment,
    });

    assert.equal(selected.trackId, "tracked-verified");
    assert.equal(selected.title, "tracked-verified");
    assert.match(selected.bgmFile, /^render-assets\/audio\/[a-f0-9]{16}-[a-f0-9]{8}-post-match-read\.wav$/);
    assert.equal(selected.audioPlan.sourceStartSeconds, 0);
    assert.equal(selected.audioPlan.preprocessed, true);
    assert.deepEqual(selected.audioPlan.cutFrames, [0, 54, 150, 270, 360]);
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});

test("selectAndStageLicensedMusic skips verified tracks without a valid 12-second segment", () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "hvs-segmented-music-"));
  try {
    const invalidAudio = Buffer.from("verified-but-unsegmented");
    const validAudio = Buffer.from("verified-and-segmented");
    fs.mkdirSync(path.join(rootDir, "public", "audio"), { recursive: true });
    fs.writeFileSync(path.join(rootDir, "public", "audio", "invalid.mp3"), invalidAudio);
    fs.writeFileSync(path.join(rootDir, "public", "audio", "valid.mp3"), validAudio);
    const library = {
      version: 1,
      tracks: [
        {
          id: "invalid",
          sourcePath: "public/audio/invalid.mp3",
          sha256: sha256(invalidAudio),
          enabled: true,
          rightsStatus: "verified",
        },
        {
          id: "valid",
          sourcePath: "public/audio/valid.mp3",
          sha256: sha256(validAudio),
          enabled: true,
          rightsStatus: "verified",
          safeSegments: [{
            id: "post-match-read-12s",
            startSeconds: 2,
            durationSeconds: 12,
            downbeats: [2, 5, 8, 11],
            gain: 0.5,
            fadeMilliseconds: 34,
          }],
        },
      ],
    };

    const selected = selectAndStageLicensedMusic({
      rootDir,
      library,
      random: () => 0,
      stageLicensedMusicSegmentImpl: stageFakeSegment,
    });

    assert.equal(selected.trackId, "valid");
    assert.equal(selected.audioPlan.sourceStartSeconds, 0);
    assert.equal(selected.audioPlan.durationInFrames, 360);
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});
