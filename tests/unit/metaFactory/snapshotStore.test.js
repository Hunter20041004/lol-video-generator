const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "../../..");

function clearStoreModule() {
  delete require.cache[path.join(ROOT, "utils/metaFactory/snapshotStore.js")];
}

test("meta snapshot store writes and reads snapshots by snapshotId", () => {
  const originalCwd = process.cwd();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hvs-meta-store-"));
  process.chdir(dir);
  clearStoreModule();
  try {
    const { writeMetaSnapshot, readMetaSnapshot } = require(path.join(ROOT, "utils/metaFactory/snapshotStore.js"));
    writeMetaSnapshot({
      snapshotId: "meta-scan-1",
      createdAt: "2026-06-21T08:00:00.000Z",
      patch: "16.12",
      candidates: { offmeta: [], tierRankings: [] },
    });

    const snapshot = readMetaSnapshot("meta-scan-1", {
      now: () => new Date("2026-06-21T08:05:00.000Z"),
    });

    assert.equal(snapshot.snapshotId, "meta-scan-1");
    assert.deepEqual(snapshot.candidates, { offmeta: [], tierRankings: [] });
  } finally {
    process.chdir(originalCwd);
    clearStoreModule();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("meta snapshot store rejects snapshots with invalid createdAt timestamps", () => {
  const originalCwd = process.cwd();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hvs-meta-store-invalid-time-"));
  process.chdir(dir);
  clearStoreModule();
  try {
    const { writeMetaSnapshot, readMetaSnapshot } = require(path.join(ROOT, "utils/metaFactory/snapshotStore.js"));
    writeMetaSnapshot({
      snapshotId: "meta-corrupt-time",
      createdAt: "not-a-date",
      patch: "16.12",
      candidates: { offmeta: [], tierRankings: [] },
    });

    assert.throws(() => readMetaSnapshot("meta-corrupt-time", {
      now: () => new Date("2026-06-21T08:05:00.000Z"),
    }), /Meta snapshot has invalid createdAt: meta-corrupt-time/);
  } finally {
    process.chdir(originalCwd);
    clearStoreModule();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("meta snapshot store replaces duplicate ids, trims reads, and expires stale snapshots", () => {
  const originalCwd = process.cwd();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hvs-meta-store-expiry-"));
  process.chdir(dir);
  clearStoreModule();
  try {
    const { readStore, writeMetaSnapshot, readMetaSnapshot, STORE_PATH } = require(path.join(ROOT, "utils/metaFactory/snapshotStore.js"));
    fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
    fs.writeFileSync(STORE_PATH, "{not valid json", "utf8");
    assert.deepEqual(readStore(), { version: 1, snapshots: [] });

    writeMetaSnapshot({
      snapshotId: "meta-replace-me",
      createdAt: "2026-06-20T08:00:00.000Z",
      patch: "16.12",
      candidates: { offmeta: [], tierRankings: [] },
    });
    writeMetaSnapshot({
      snapshotId: "meta-replace-me",
      createdAt: "2026-06-21T08:00:00.000Z",
      patch: "16.13",
      candidates: { offmeta: [{ candidateId: "new" }], tierRankings: [] },
    });

    assert.equal(readStore().snapshots.length, 1);
    assert.equal(readMetaSnapshot(" meta-replace-me ", {
      now: () => new Date("2026-06-21T08:05:00.000Z"),
    }).patch, "16.13");
    assert.throws(() => readMetaSnapshot("meta-replace-me", {
      now: () => new Date("2026-06-22T08:00:01.000Z"),
      maxAgeMs: 24 * 60 * 60 * 1000,
    }), /Meta snapshot expired: meta-replace-me/);
  } finally {
    process.chdir(originalCwd);
    clearStoreModule();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
