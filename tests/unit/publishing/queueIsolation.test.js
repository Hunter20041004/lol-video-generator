const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "../../..");
const QUEUE_MODULE = path.join(ROOT, "utils/publishing/queueStore.js");
const PUBLISHING_MODULE = path.join(ROOT, "utils/publishing/index.js");
const RUN_STORE_MODULE = path.join(ROOT, "utils/esports/runStore.js");
const CANDIDATE_STORE_MODULE = path.join(ROOT, "utils/esports/candidateStore.js");
const PLAYER_RADAR_RUNNER_MODULE = path.join(ROOT, "utils/esports/playerRadarRunner.js");

function clearPublishingModules() {
  [
    "utils/publishing/index.js",
    "utils/publishing/queueStore.js",
    "utils/esports/runStore.js",
    "utils/esports/candidateStore.js",
    "utils/esports/playerRadarRunner.js",
  ].forEach((file) => {
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

test("preview player radar leaves every publishing store absent", async () => {
  const originalCwd = process.cwd();
  const activeProject = fs.mkdtempSync(path.join(os.tmpdir(), "hvs-preview-isolation-"));
  try {
    process.chdir(activeProject);
    clearPublishingModules();
    require(QUEUE_MODULE);
    require(RUN_STORE_MODULE);
    require(PUBLISHING_MODULE);
    for (const forbidden of [
      ".data/publish-queue.json",
      ".data/esports-daily-runs.json",
      "public/publish-packages",
    ]) {
      assert.equal(fs.existsSync(path.join(activeProject, forbidden)), false, `module load: ${forbidden}`);
    }

    const edge = {
      name: "Faker", team: "T1", role: "Mid", champions: ["Azir"],
      rawStats: { role: "Mid", kda: 8, dpm: 720, kp: 0.82, gpm: 480, csm: 9.2 },
    };
    const opponent = {
      name: "Chovy", team: "GEN", role: "Mid", champions: ["Orianna"],
      rawStats: { role: "Mid", kda: 2, dpm: 380, kp: 0.48, gpm: 340, csm: 7.1 },
    };
    const { writeCandidateSnapshot } = require(CANDIDATE_STORE_MODULE);
    writeCandidateSnapshot({
      scanId: "preview-scan",
      candidates: [{
        seriesId: "preview-series",
        league: "LCK",
        teamA: "T1",
        teamB: "GEN",
        teams: ["T1", "GEN"],
        winningTeam: "T1",
        seriesScore: "2-0",
        players: [edge, opponent],
        roleMatchups: [{ role: "Mid", left: edge, right: opponent }],
        recommendedMvp: { name: "Faker" },
      }],
    });
    const { runPlayerRadarFromSnapshot } = require(PLAYER_RADAR_RUNNER_MODULE);
    await runPlayerRadarFromSnapshot({
      scanId: "preview-scan",
      seriesId: "preview-series",
      mode: "preview",
      languages: ["zh"],
    }, {
      renderVideosFromRequest: async () => ({ videoUrl: "/renders/preview.mp4", fileName: "preview.mp4" }),
      validatePostMatchReadRender: async () => ({ passed: true, reasons: [], media: {} }),
      createPublishJobs: async () => {
        throw new Error("preview must not publish");
      },
    });

    for (const forbidden of [
      ".data/publish-queue.json",
      ".data/esports-daily-runs.json",
      "public/publish-packages",
    ]) {
      assert.equal(fs.existsSync(path.join(activeProject, forbidden)), false, forbidden);
    }
  } finally {
    process.chdir(originalCwd);
    clearPublishingModules();
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
