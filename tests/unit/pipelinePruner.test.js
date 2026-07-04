const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "../..");

async function withTempProject(fn) {
  const originalCwd = process.cwd();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hvs-pruner-"));
  process.chdir(dir);
  delete require.cache[path.join(ROOT, "utils/pipelinePruner.js")];
  try {
    fs.mkdirSync(path.join(dir, ".data"), { recursive: true });
    fs.mkdirSync(path.join(dir, "public", "renders"), { recursive: true });
    fs.mkdirSync(path.join(dir, "public", "publish-packages", "old-job"), { recursive: true });
    await fn(dir);
  } finally {
    process.chdir(originalCwd);
    delete require.cache[path.join(ROOT, "utils/pipelinePruner.js")];
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test("pruneRemovedPipelineData removes deleted dataTypes, removed platforms, temp props, and old cache", async () => {
  await withTempProject(async (dir) => {
    fs.writeFileSync(path.join(dir, ".data", "patch-content-db.json"), JSON.stringify({
      version: 1,
      items: [
        { id: "keep", dataType: "PATCH", payload: { dataType: "PATCH" } },
        { id: "drop", dataType: "TIER_LIST", payload: { dataType: "TIER_LIST" } },
      ],
    }, null, 2));
    fs.writeFileSync(path.join(dir, ".data", "publish-queue.json"), JSON.stringify([
      { id: "keep-job", platform: "instagram", analysis: { dataType: "PATCH" } },
      { id: "drop-type", platform: "threads", analysis: { dataType: "PRO_BUILD" }, package: { dir: path.join(dir, "public", "publish-packages", "old-job") } },
      { id: "drop-platform", platform: "youtube", analysis: { dataType: "PATCH" } },
    ], null, 2));
    fs.writeFileSync(path.join(dir, "public", "renders", "props_1.json"), JSON.stringify({ data: { dataType: "PATCH" } }));
    fs.writeFileSync(path.join(dir, "public", "renders", "render_keep.mp4"), "video");
    fs.writeFileSync(path.join(dir, "cache_meta.json"), "{}");

    const { pruneRemovedPipelineData } = require(path.join(ROOT, "utils/pipelinePruner.js"));
    const result = pruneRemovedPipelineData({ cwd: dir });

    assert.equal(result.contentItemsRemoved, 1);
    assert.equal(result.publishJobsRemoved, 2);
    assert.equal(result.renderTempFilesRemoved, 1);
    assert.equal(result.cacheFilesRemoved, 1);
    assert.equal(fs.existsSync(path.join(dir, "public", "publish-packages", "old-job")), false);
    assert.equal(fs.existsSync(path.join(dir, "public", "renders", "props_1.json")), false);
    assert.equal(fs.existsSync(path.join(dir, "cache_meta.json")), false);

    const db = JSON.parse(fs.readFileSync(path.join(dir, ".data", "patch-content-db.json"), "utf8"));
    const queue = JSON.parse(fs.readFileSync(path.join(dir, ".data", "publish-queue.json"), "utf8"));
    assert.deepEqual(db.items.map((item) => item.id), ["keep"]);
    assert.deepEqual(queue.map((job) => job.id), ["keep-job"]);
  });
});

test("pruneRemovedPipelineData tolerates malformed stores and object queues", async () => {
  await withTempProject(async (dir) => {
    fs.rmSync(path.join(dir, "public", "renders"), { recursive: true, force: true });
    fs.writeFileSync(path.join(dir, ".data", "patch-content-db.json"), "{bad json");
    fs.writeFileSync(path.join(dir, ".data", "publish-queue.json"), JSON.stringify({
      tasks: [
        { id: "drop-copy-type", platform: "instagram", copy: { dataType: "TFT_INFO" } },
        { id: "drop-empty-platform", platform: "mastodon", dataType: "PATCH" },
        { id: "keep-thread", platform: "threads", dataType: "PATCH" },
        { id: "keep-unspecified-platform", dataType: "PATCH" },
      ],
    }, null, 2));

    const { pruneRemovedPipelineData, shouldRemoveJob } = require(path.join(ROOT, "utils/pipelinePruner.js"));
    const result = pruneRemovedPipelineData({ cwd: dir });

    assert.equal(result.contentItemsRemoved, 0);
    assert.equal(result.publishJobsRemoved, 2);
    assert.equal(result.renderTempFilesRemoved, 0);
    assert.equal(result.cacheFilesRemoved, 0);
    assert.equal(shouldRemoveJob({ platform: "", dataType: "PATCH" }), false);

    const queue = JSON.parse(fs.readFileSync(path.join(dir, ".data", "publish-queue.json"), "utf8"));
    assert.deepEqual(queue.tasks.map((job) => job.id), ["keep-thread", "keep-unspecified-platform"]);
  });
});
