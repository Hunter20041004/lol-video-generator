const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "../../..");
const QUEUE_MODULE = path.join(ROOT, "utils/publishing/queueStore.js");
const PUBLISHING_MODULE = path.join(ROOT, "utils/publishing/index.js");

function clearPublishingModules() {
  ["utils/publishing/index.js", "utils/publishing/queueStore.js"].forEach((file) => {
    delete require.cache[path.join(ROOT, file)];
  });
}

test("queue storage follows the active project after the module was loaded elsewhere", () => {
  const originalCwd = process.cwd();
  const loadedFrom = fs.mkdtempSync(path.join(os.tmpdir(), "hvs-queue-loaded-"));
  const activeProject = fs.mkdtempSync(path.join(os.tmpdir(), "hvs-queue-active-"));

  try {
    process.chdir(loadedFrom);
    clearPublishingModules();
    const { writeQueue, readQueue } = require(QUEUE_MODULE);
    process.chdir(activeProject);

    writeQueue([{ id: "active-project-job", status: "QUEUED" }]);

    assert.equal(fs.existsSync(path.join(loadedFrom, ".data", "publish-queue.json")), false);
    assert.deepEqual(readQueue(), [{ id: "active-project-job", status: "QUEUED" }]);
    assert.deepEqual(
      JSON.parse(fs.readFileSync(path.join(activeProject, ".data", "publish-queue.json"), "utf8")),
      [{ id: "active-project-job", status: "QUEUED" }],
    );
  } finally {
    process.chdir(originalCwd);
    clearPublishingModules();
    fs.rmSync(loadedFrom, { recursive: true, force: true });
    fs.rmSync(activeProject, { recursive: true, force: true });
  }
});

test("publish packages follow the active project after the module was loaded elsewhere", async () => {
  const originalCwd = process.cwd();
  const loadedFrom = fs.mkdtempSync(path.join(os.tmpdir(), "hvs-package-loaded-"));
  const activeProject = fs.mkdtempSync(path.join(os.tmpdir(), "hvs-package-active-"));

  try {
    process.chdir(loadedFrom);
    clearPublishingModules();
    const { createPublishJobs } = require(PUBLISHING_MODULE);

    process.chdir(activeProject);
    fs.mkdirSync(path.join(activeProject, "public", "renders"), { recursive: true });
    fs.writeFileSync(path.join(activeProject, "public", "renders", "clip.mp4"), "video fixture");

    const result = await createPublishJobs({
      videoUrl: "/renders/clip.mp4",
      analysis: { title: "Isolation fixture" },
      platform: "threads",
      action: "queue",
    });

    const taskId = result.jobs[0].id;
    assert.equal(fs.existsSync(path.join(loadedFrom, "public", "publish-packages", taskId)), false);
    assert.equal(
      fs.existsSync(path.join(activeProject, "public", "publish-packages", taskId, "manifest.json")),
      true,
    );
  } finally {
    process.chdir(originalCwd);
    clearPublishingModules();
    fs.rmSync(loadedFrom, { recursive: true, force: true });
    fs.rmSync(activeProject, { recursive: true, force: true });
  }
});
