const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const ROOT = path.resolve(__dirname, "../../..");

function clearPublishingModules() {
  [
    "utils/publishing/index.js",
    "utils/publishing/queueStore.js",
    "utils/publishing/schedule.js",
    "utils/publishing/adapters/instagram.js",
  ].forEach((file) => {
    delete require.cache[path.join(ROOT, file)];
  });
}

function withTempProject(fn) {
  const originalCwd = process.cwd();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hvs-publishing-"));
  process.chdir(dir);
  fs.mkdirSync(path.join(dir, "public", "renders"), { recursive: true });
  fs.writeFileSync(path.join(dir, "public", "renders", "clip.mp4"), "fake video");
  clearPublishingModules();

  return Promise.resolve()
    .then(() => fn(dir))
    .finally(() => {
      process.chdir(originalCwd);
      clearPublishingModules();
      fs.rmSync(dir, { recursive: true, force: true });
    });
}

test("createPublishJobs queues localized platform tasks with normalized scheduled time", async () => {
  await withTempProject(async () => {
    const { createPublishJobs } = require(path.join(ROOT, "utils/publishing/index.js"));

    const result = await createPublishJobs({
      videoUrl: "/renders/clip.mp4",
      analysis: { dataType: "PATCH", championName: "Quinn" },
      locale: "zh",
      platforms: ["instagram", "threads"],
      scheduledAt: "2026-05-22T10:00:00+08:00",
    });

    assert.equal(result.success, true);
    assert.equal(result.jobs.length, 2);
    assert.deepEqual(result.summary, { QUEUED: 2 });
    assert.deepEqual(result.jobs.map((job) => job.platform).sort(), ["instagram", "threads"]);
    assert.equal(result.jobs[0].scheduledAt, "2026-05-22T02:00:00.000Z");
    assert.ok(result.jobs[0].package.manifestPath.endsWith("manifest.json"));
  });
});

test("processQueuedTasks with dueOnly publishes due tasks and keeps future tasks queued", async () => {
  await withTempProject(async () => {
    const instagram = require(path.join(ROOT, "utils/publishing/adapters/instagram.js"));
    const originalPublish = instagram.publish;
    instagram.publish = async (task) => ({
      status: "PUBLISHED",
      platform: task.platform,
      taskId: task.id,
    });

    try {
      const { processQueuedTasks } = require(path.join(ROOT, "utils/publishing/index.js"));
      const { upsertTask, listTasks } = require(path.join(ROOT, "utils/publishing/queueStore.js"));

      [
        ["past", "2026-05-22T01:59:00.000Z"],
        ["now", "2026-05-22T02:00:00.000Z"],
        ["future", "2026-05-22T02:01:00.000Z"],
      ].forEach(([id, scheduledAt]) => {
        upsertTask({
          id,
          platform: "instagram",
          locale: "zh",
          status: "QUEUED",
          scheduledAt,
          copy: { caption: "test" },
        });
      });

      const result = await processQueuedTasks({
        dueOnly: true,
        now: "2026-05-22T02:00:00.000Z",
      });

      assert.equal(result.processed, 2);
      assert.deepEqual(result.summary, { PUBLISHED: 2 });

      const queue = listTasks();
      assert.equal(queue.find((task) => task.id === "past").status, "PUBLISHED");
      assert.equal(queue.find((task) => task.id === "now").status, "PUBLISHED");
      assert.equal(queue.find((task) => task.id === "future").status, "QUEUED");
    } finally {
      instagram.publish = originalPublish;
    }
  });
});

test("publishTask marks unsupported platforms as failed", async () => {
  await withTempProject(async () => {
    const { publishTask } = require(path.join(ROOT, "utils/publishing/index.js"));
    const { upsertTask } = require(path.join(ROOT, "utils/publishing/queueStore.js"));
    const task = upsertTask({ id: "unknown", platform: "unknown", status: "QUEUED" });

    const result = await publishTask(task);

    assert.equal(result.status, "FAILED");
    assert.match(result.error, /Unsupported platform/);
  });
});

test("resolveVideoEntries supports bilingual render payloads and skips empty entries", async () => {
  await withTempProject(async () => {
    const { resolveVideoEntries } = require(path.join(ROOT, "utils/publishing/index.js"));

    const entries = resolveVideoEntries({
      locale: "zh",
      videos: [
        { locale: "en", videoUrl: "/renders/en.mp4" },
        { locale: "zh", videoUrl: "/renders/zh.mp4", label: "中文測試", fileName: "custom.mp4" },
        { locale: "en" },
      ],
    });

    assert.deepEqual(entries, [
      { locale: "en", label: "English", videoUrl: "/renders/en.mp4", fileName: "en.mp4" },
      { locale: "zh", label: "中文測試", videoUrl: "/renders/zh.mp4", fileName: "custom.mp4" },
    ]);
  });
});

test("createPublishJobs validates missing and nonexistent render inputs", async () => {
  await withTempProject(async () => {
    const { createPublishJobs } = require(path.join(ROOT, "utils/publishing/index.js"));

    await assert.rejects(
      () => createPublishJobs({ platform: "instagram" }),
      /videoUrl or videos\[\] is required/
    );
    await assert.rejects(
      () => createPublishJobs({ videoUrl: "/renders/missing.mp4", platform: "instagram" }),
      /Video file not found/
    );
  });
});

test("createPublishJobs can publish immediately through all retained default platforms", async () => {
  await withTempProject(async () => {
    const instagram = require(path.join(ROOT, "utils/publishing/adapters/instagram.js"));
    const threads = require(path.join(ROOT, "utils/publishing/adapters/threads.js"));
    const originals = {
      instagram: instagram.publish,
      threads: threads.publish,
    };

    instagram.publish = async () => ({ platform: "instagram" });
    threads.publish = async () => ({ status: "FAILED", message: "threads rejected" });

    try {
      const { createPublishJobs } = require(path.join(ROOT, "utils/publishing/index.js"));
      const result = await createPublishJobs({
        videoUrl: "/renders/clip.mp4",
        analysis: { dataType: "PATCH", championName: "Quinn" },
        socialCopy: { caption: "manual caption" },
        locale: "en",
        platform: "all",
        action: "publish",
      });

      assert.equal(result.jobs.length, 2);
      assert.equal(result.jobs.find((job) => job.platform === "instagram").status, "PUBLISHED");
      assert.equal(result.jobs.find((job) => job.platform === "threads").status, "FAILED");
      assert.equal(result.jobs.find((job) => job.platform === "threads").error, "threads rejected");
      assert.equal(result.jobs.find((job) => job.platform === "instagram").accountSet, "EN_ACCOUNT_SET");
      assert.equal(result.jobs.some((job) => job.platform === "youtube"), false);
      assert.equal(result.jobs.some((job) => job.platform === "tiktok"), false);
    } finally {
      instagram.publish = originals.instagram;
      threads.publish = originals.threads;
    }
  });
});

test("processQueuedTasks without dueOnly runs every queued task and records adapter errors", async () => {
  await withTempProject(async () => {
    const instagram = require(path.join(ROOT, "utils/publishing/adapters/instagram.js"));
    const originalPublish = instagram.publish;
    instagram.publish = async (task) => {
      if (task.id === "bad") throw new Error("upload failed");
      return { status: "PUBLISHED", taskId: task.id };
    };

    try {
      const { processQueuedTasks } = require(path.join(ROOT, "utils/publishing/index.js"));
      const { upsertTask } = require(path.join(ROOT, "utils/publishing/queueStore.js"));
      upsertTask({ id: "good", platform: "instagram", locale: "zh", status: "QUEUED" });
      upsertTask({ id: "bad", platform: "instagram", locale: "zh", status: "QUEUED" });

      const result = await processQueuedTasks();

      assert.equal(result.processed, 2);
      assert.equal(result.summary.PUBLISHED, 1);
      assert.equal(result.summary.FAILED, 1);
      assert.equal(result.jobs.find((job) => job.id === "bad").error, "upload failed");
    } finally {
      instagram.publish = originalPublish;
    }
  });
});
