const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const ROOT = path.resolve(__dirname, "../..");
const {
  cleanupRenderMedia,
  normalizeRenderPath,
} = require(path.join(ROOT, "scripts/cleanupMedia.js"));

function makeTempProject() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hvs-media-cleanup-"));
  fs.mkdirSync(path.join(dir, "public", "renders"), { recursive: true });
  fs.mkdirSync(path.join(dir, ".data"), { recursive: true });
  return dir;
}

function writeRenderFile(cwd, fileName, mtime) {
  const filePath = path.join(cwd, "public", "renders", fileName);
  fs.writeFileSync(filePath, Buffer.alloc(1024));
  fs.utimesSync(filePath, mtime, mtime);
  return filePath;
}

test("cleanupRenderMedia keeps recent videos and active publish-task videos", () => {
  const cwd = makeTempProject();
  try {
    const now = new Date("2026-06-09T12:00:00.000Z");
    const oldTime = new Date("2026-06-07T12:00:00.000Z");
    const recentTime = new Date("2026-06-09T06:00:00.000Z");
    writeRenderFile(cwd, "old-published.mp4", oldTime);
    writeRenderFile(cwd, "old-failed.mp4", oldTime);
    writeRenderFile(cwd, "recent.mp4", recentTime);
    fs.writeFileSync(path.join(cwd, ".data", "publish-queue.json"), JSON.stringify({
      tasks: [
        { status: "PUBLISHED", videoUrl: "/renders/old-published.mp4", updatedAt: "2026-06-07T12:30:00.000Z" },
        { status: "FAILED", videoUrl: "/renders/old-failed.mp4", updatedAt: "2026-06-07T12:30:00.000Z" },
      ],
    }, null, 2));

    const summary = cleanupRenderMedia({ cwd, retentionHours: 24, now });

    assert.deepEqual(summary.candidates.map((file) => file.relativePath), ["public/renders/old-published.mp4"]);
    assert.deepEqual(summary.keptProtected.map((file) => file.relativePath), ["public/renders/old-failed.mp4"]);
    assert.deepEqual(summary.keptRecent.map((file) => file.relativePath), ["public/renders/recent.mp4"]);
    assert.equal(fs.existsSync(path.join(cwd, "public", "renders", "old-published.mp4")), true);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test("cleanupRenderMedia deletes only candidates when deleteFiles is true", () => {
  const cwd = makeTempProject();
  try {
    const now = new Date("2026-06-09T12:00:00.000Z");
    const oldTime = new Date("2026-06-07T12:00:00.000Z");
    writeRenderFile(cwd, "old-published.mp4", oldTime);
    writeRenderFile(cwd, "old-failed.mp4", oldTime);
    fs.writeFileSync(path.join(cwd, ".data", "publish-queue.json"), JSON.stringify([
      { status: "PUBLISHED", videoUrl: "/renders/old-published.mp4", updatedAt: "2026-06-07T12:30:00.000Z" },
      { status: "FAILED", videoUrl: "/renders/old-failed.mp4", updatedAt: "2026-06-07T12:30:00.000Z" },
    ], null, 2));

    const summary = cleanupRenderMedia({ cwd, retentionHours: 24, now, deleteFiles: true });

    assert.deepEqual(summary.deleted.map((file) => file.relativePath), ["public/renders/old-published.mp4"]);
    assert.equal(fs.existsSync(path.join(cwd, "public", "renders", "old-published.mp4")), false);
    assert.equal(fs.existsSync(path.join(cwd, "public", "renders", "old-failed.mp4")), true);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test("cleanupRenderMedia keeps old files that have a recent published reference", () => {
  const cwd = makeTempProject();
  try {
    const now = new Date("2026-06-09T12:00:00.000Z");
    const oldTime = new Date("2026-06-07T12:00:00.000Z");
    writeRenderFile(cwd, "recently-published-old-render.mp4", oldTime);
    fs.writeFileSync(path.join(cwd, ".data", "publish-queue.json"), JSON.stringify({
      tasks: [
        {
          status: "PUBLISHED",
          videoUrl: "/renders/recently-published-old-render.mp4",
          updatedAt: "2026-06-09T11:30:00.000Z",
        },
      ],
    }, null, 2));

    const summary = cleanupRenderMedia({ cwd, retentionHours: 24, now });

    assert.equal(summary.candidates.length, 0);
    assert.deepEqual(summary.keptRecentReference.map((file) => file.relativePath), [
      "public/renders/recently-published-old-render.mp4",
    ]);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test("normalizeRenderPath maps copied absolute public paths into the current project", () => {
  const cwd = "/tmp/project-copy";
  assert.equal(
    normalizeRenderPath(cwd, "/Users/me/lol-video-generator/public/renders/render.mp4"),
    path.resolve(cwd, "public", "renders", "render.mp4"),
  );
});
