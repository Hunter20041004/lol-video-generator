const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const ROOT = path.resolve(__dirname, "../../..");

function clearStoreModule() {
  delete require.cache[path.join(ROOT, "utils/esports/runStore.js")];
}

async function withTempProject(fn) {
  const originalCwd = process.cwd();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hvs-esports-store-"));
  process.chdir(dir);
  clearStoreModule();
  try {
    await fn(dir);
  } finally {
    process.chdir(originalCwd);
    clearStoreModule();
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test("runStore records daily runs and reports published series for automatic dedupe", async () => {
  await withTempProject(async () => {
    const { hasPublishedSeries, listRuns, upsertRun } = require(path.join(ROOT, "utils/esports/runStore.js"));

    upsertRun({
      runId: "daily-2026-06-20",
      date: "2026-06-20",
      dryRun: false,
      selected: [{ seriesId: "lck-t1-gen-2026-06-20" }],
      outputs: [{ seriesId: "lck-t1-gen-2026-06-20", gate: { passed: true } }],
      publishJobs: [{ id: "pub-1", status: "QUEUED" }],
      status: "PUBLISHED",
    });

    assert.equal(listRuns().length, 1);
    assert.equal(hasPublishedSeries("lck-t1-gen-2026-06-20"), true);
    assert.equal(hasPublishedSeries("lpl-blg-tes-2026-06-20"), false);
  });
});

test("runStore updates runs, filters lists, recovers malformed JSON, and records manual actions", async () => {
  await withTempProject(async (dir) => {
    const {
      STORE_PATH,
      appendManualAction,
      hasPublishedSeries,
      listRuns,
      readStore,
      upsertRun,
    } = require(path.join(ROOT, "utils/esports/runStore.js"));

    fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
    fs.writeFileSync(STORE_PATH, "{bad json", "utf8");
    assert.deepEqual(readStore(), { version: 1, runs: [] });

    upsertRun({
      date: "2026-06-20",
      dryRun: true,
      selected: [{ seriesId: "dry-series" }],
      outputs: [],
      publishJobs: [],
      status: "DRY_RUN_COMPLETE",
    });
    upsertRun({
      runId: "daily-2026-06-21",
      date: "2026-06-21",
      dryRun: false,
      selected: [{ seriesId: "published-series" }],
      outputs: [],
      publishJobs: [{ id: "pub-1" }],
      status: "QUEUED",
    });
    upsertRun({
      runId: "daily-2026-06-21",
      date: "2026-06-21",
      dryRun: false,
      selected: [{ seriesId: "published-series" }],
      outputs: [],
      publishJobs: [{ id: "pub-1" }],
      status: "PUBLISHED",
    });

    assert.equal(listRuns({ dryRun: true }).length, 1);
    assert.equal(listRuns({ date: "2026-06-21", status: "PUBLISHED" }).length, 1);
    assert.equal(hasPublishedSeries(""), false);
    assert.equal(hasPublishedSeries("dry-series"), false);
    assert.equal(hasPublishedSeries("published-series"), true);
    assert.equal(appendManualAction("missing-series", { type: "republish" }), null);
    const updated = appendManualAction("published-series", { type: "republish", createdAt: "2026-06-21T12:00:00.000Z" });
    assert.equal(updated.manualActions[0].type, "republish");
  });
});
