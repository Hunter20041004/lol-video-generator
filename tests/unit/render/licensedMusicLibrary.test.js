const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const {
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

    const selected = selectAndStageLicensedMusic({ rootDir, library, random: () => 0.99 });

    assert.equal(selected.trackId, "verified");
    assert.match(selected.bgmFile, /^render-assets\/audio\/[a-f0-9]{16}\.mp3$/);
    assert.deepEqual(
      fs.readFileSync(path.join(rootDir, "public", selected.bgmFile)),
      verifiedAudio,
    );
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

    const selected = selectAndStageLicensedMusic({ rootDir, library, random: () => 0 });

    assert.equal(selected.trackId, "tracked-verified");
    assert.equal(selected.title, "tracked-verified");
    assert.equal(selected.bgmFile, "audio/verified.mp3");
    assert.equal(selected.audioPlan.sourceStartSeconds, 2);
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

    const selected = selectAndStageLicensedMusic({ rootDir, library, random: () => 0 });

    assert.equal(selected.trackId, "valid");
    assert.equal(selected.audioPlan.sourceStartSeconds, 2);
    assert.equal(selected.audioPlan.durationInFrames, 360);
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});
