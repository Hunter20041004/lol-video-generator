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

function buildTestRadarStats(rawStats = {}) {
  const { buildRadarStats } = require(path.join(ROOT, "utils/esports/seriesAggregator.js"));
  return buildRadarStats(rawStats);
}

function statByLabel(stats = [], label = "") {
  return stats.find((stat) => stat.label === label);
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

function makePlayerRadarAnalysis() {
  const proofRawStats = { role: "Jungle", kp: 0.84, dpm: 720 };
  const proofRadarStats = buildTestRadarStats(proofRawStats);
  const edgeRawStats = { role: "Mid", dpm: 720, kp: 0.86 };
  const loserRawStats = { role: "Mid", dpm: 360, kp: 0.48 };
  const edgeRadarStats = buildTestRadarStats(edgeRawStats);
  const loserRadarStats = buildTestRadarStats(loserRawStats);
  const edgeScore = ((statByLabel(edgeRadarStats, "DPM").normalizedScore + statByLabel(edgeRadarStats, "KP%").normalizedScore) / 2)
    - ((statByLabel(loserRadarStats, "DPM").normalizedScore + statByLabel(loserRadarStats, "KP%").normalizedScore) / 2);
  const storyboard = [
    { text: "這個系列賽，中路差距有多誇張？", tag: "HOOK", durationInFrames: 54 },
    { text: "不是小贏，是整個系列賽的斷層。", tag: "MATCHUP_EDGE", durationInFrames: 96 },
    { text: "但真正把優勢變成傷害的，在下路。", tag: "PLAYER_PROOF", durationInFrames: 120 },
    { text: "打野拉開局勢，下路把優勢變成勝利。", tag: "CONCLUSION_CTA", durationInFrames: 90 },
  ];
  return {
    dataType: "PLAYER_RADAR",
    locale: "zh",
    title: "賽後判讀",
    matchContext: { league: "LCK", teamA: "T1", teamB: "GEN", winningTeam: "T1", seriesScore: "Game 3" },
    player: {
      name: "Oner",
      team: "T1",
      role: "Jungle",
      rawStats: proofRawStats,
      radarStats: proofRadarStats,
    },
    matchupSegment: {
      role: "Mid",
      edgeType: "winner-breakpoint",
      edgeScore,
      focusPlayer: { name: "Faker", team: "T1", role: "Mid", rawStats: edgeRawStats, radarStats: edgeRadarStats },
      edgePlayer: { name: "Faker", team: "T1", role: "Mid", rawStats: edgeRawStats, radarStats: edgeRadarStats },
      opponentPlayer: { name: "Chovy", team: "GEN", role: "Mid", rawStats: loserRawStats, radarStats: loserRadarStats },
      edgeWinnerTeam: "T1",
      reasons: [
        { metric: "DPM", winnerValue: 720, loserValue: 360, delta: 360 },
        { metric: "KP%", winnerValue: 0.86, loserValue: 0.48, delta: 0.38 },
      ],
    },
    proofSegment: {
      player: {
        name: "Oner",
        team: "T1",
        role: "Jungle",
        rawStats: proofRawStats,
        radarStats: proofRadarStats,
      },
      proofReasons: [
        { metric: "KP%", rawValue: statByLabel(proofRadarStats, "KP%").rawValue, score: statByLabel(proofRadarStats, "KP%").normalizedScore },
        { metric: "DPM", rawValue: statByLabel(proofRadarStats, "DPM").rawValue, score: statByLabel(proofRadarStats, "DPM").normalizedScore },
      ],
      verdict: "Oner 有這場最清楚的 MVP 理由。",
    },
    postMatchRead: {
      branding: { publicTitle: "賽後判讀", publicTitleEn: "POST MATCH READ" },
      seriesContext: { league: "LCK", seriesId: "series-1", teamA: "T1", teamB: "GEN", score: "Game 3", gameCount: 3, scopeLabel: "LCK · Game 3" },
      hook: { metric: "DPM", leftRaw: 720, rightRaw: 360, displayValue: "約 2×", comparisonType: "ratio", approximate: true, question: storyboard[0].text },
      matchup: { claimScope: "role-local", claim: "中路差距明顯", scopeLabel: "LCK · Game 3" },
      proof: { labelType: "data-mvp-candidate", label: "數據 MVP 候選", claim: "數據 MVP 候選: Oner" },
      assets: {},
      audioPlan: null,
      storyboard,
    },
    storyboard,
  };
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

test("createPublishJobs queues player radar with esports social copy", async () => {
  await withTempProject(async () => {
    const { createPublishJobs } = require(path.join(ROOT, "utils/publishing/index.js"));

    const result = await createPublishJobs({
      videoUrl: "/renders/clip.mp4",
      analysis: makePlayerRadarAnalysis(),
      locale: "zh",
      platforms: ["instagram"],
    });

    assert.equal(result.success, true);
    assert.equal(result.jobs.length, 1);
    const [job] = result.jobs;
    assert.equal(job.copy.title, "賽後判讀");
    assert.match(job.copy.caption, /賽事重點：/);
    assert.match(job.copy.caption, /你覺得這場關鍵人物是誰/);
    assert.equal(job.copy.tags.includes("LoLEsports"), true);
    assert.equal(job.copy.tags.includes("賽後判讀"), true);
    assert.equal(job.copy.tags.includes("選手雷達"), false);
    assert.equal(job.copy.tags.includes("版本更新"), false);
    assert.doesNotMatch(job.copy.caption, /這波重點|版本更新|調整打法|lolpatch/i);

    const manifest = JSON.parse(fs.readFileSync(job.package.manifestPath, "utf8"));
    assert.match(manifest.copy.caption, /賽後判讀/);
    assert.doesNotMatch(manifest.copy.caption, /選手雷達|Player Radar/i);
    assert.doesNotMatch(manifest.copy.caption, /版本更新|lolpatch/i);
  });
});

test("createPublishJobs preflights all localized player radar videos before queue writes", async () => {
  await withTempProject(async (dir) => {
    fs.writeFileSync(path.join(dir, "public", "renders", "clip-zh.mp4"), "fake zh video");
    fs.writeFileSync(path.join(dir, "public", "renders", "clip-en.mp4"), "fake en video");
    const { createPublishJobs } = require(path.join(ROOT, "utils/publishing/index.js"));

    await assert.rejects(
      () => createPublishJobs({
        videos: [
          { locale: "zh", videoUrl: "/renders/clip-zh.mp4" },
          { locale: "en", videoUrl: "/renders/clip-en.mp4" },
        ],
        analysis: makePlayerRadarAnalysis(),
        platforms: ["instagram"],
      }),
      /Player Radar localized payload missing for locale: en/
    );

    const queuePath = path.join(dir, ".data", "publish-queue.json");
    const packagesDir = path.join(dir, "public", "publish-packages");
    assert.deepEqual(fs.existsSync(queuePath) ? JSON.parse(fs.readFileSync(queuePath, "utf8")) : [], []);
    assert.deepEqual(fs.existsSync(packagesDir) ? fs.readdirSync(packagesDir) : [], []);
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
