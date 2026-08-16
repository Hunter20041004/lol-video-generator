const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "../../..");

test("rendered preview is persisted on the selected content item", () => {
  const { persistPreviewArtifact } = require(path.join(ROOT, "utils/contentFactory/previewArtifact.js"));
  const patches = [];
  const item = { id: "patch-26.16", status: "READY" };
  const render = { videos: [{ locale: "zh", videoUrl: "/renders/patch-26.16.mp4" }] };

  const updated = persistPreviewArtifact(item, render, {
    now: () => new Date("2026-08-15T20:30:00.000Z"),
    updatePatchItem: (id, patch) => {
      patches.push({ id, patch });
      return { ...item, ...patch };
    },
  });

  assert.deepEqual(patches, [{
    id: "patch-26.16",
    patch: {
      renderedAt: "2026-08-15T20:30:00.000Z",
      renderResult: { videos: render.videos },
    },
  }]);
  assert.equal(updated.renderResult.videos[0].videoUrl, "/renders/patch-26.16.mp4");
});

test("persisted preview survives a fresh read from the real content store", () => {
  const originalCwd = process.cwd();
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "hvs-preview-artifact-"));
  const storePath = path.join(ROOT, "utils/contentFactory/store.js");
  const artifactPath = path.join(ROOT, "utils/contentFactory/previewArtifact.js");

  try {
    process.chdir(directory);
    delete require.cache[storePath];
    delete require.cache[artifactPath];
    const store = require(storePath);
    store.writeDatabase({ items: [{ id: "patch-real", category: "CHAMPION", status: "READY" }] });
    const { persistPreviewArtifact } = require(artifactPath);

    persistPreviewArtifact(
      { id: "patch-real" },
      { videos: [{ locale: "zh", videoUrl: "/renders/real.mp4" }] }
    );

    delete require.cache[storePath];
    const freshStore = require(storePath);
    assert.equal(freshStore.listPatchItems()[0].renderResult.videos[0].videoUrl, "/renders/real.mp4");
  } finally {
    process.chdir(originalCwd);
    delete require.cache[storePath];
    delete require.cache[artifactPath];
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
