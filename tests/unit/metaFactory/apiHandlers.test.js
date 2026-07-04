const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "../../..");

function clearModules() {
  ["utils/metaFactory/apiHandlers.js", "utils/metaFactory/snapshotStore.js", "utils/metaFactory/candidatePlanner.js"].forEach((file) => {
    delete require.cache[path.join(ROOT, file)];
  });
}

async function withTempMetaFactory(prefix, callback) {
  const originalCwd = process.cwd();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  process.chdir(dir);
  clearModules();
  try {
    return await callback();
  } finally {
    process.chdir(originalCwd);
    clearModules();
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

async function withRenderSnapshot(snapshot, callback) {
  return withTempMetaFactory("hvs-meta-render-branch-", async () => {
    const { writeMetaSnapshot } = require(path.join(ROOT, "utils/metaFactory/snapshotStore.js"));
    writeMetaSnapshot({
      createdAt: "2026-06-21T08:00:00.000Z",
      candidates: {
        offmeta: [],
        tierRankings: [],
      },
      ...snapshot,
    });
    const { handleMetaRenderRequest } = require(path.join(ROOT, "utils/metaFactory/apiHandlers.js"));
    return callback(handleMetaRenderRequest);
  });
}

function makeRenderDeps(overrides = {}) {
  const payloads = [];
  return {
    payloads,
    deps: {
      now: () => new Date("2026-06-21T08:05:00.000Z"),
      renderVideosFromRequest: async (payload) => {
        payloads.push(payload);
        return {
          videos: [{ locale: payload.locale, videoUrl: `/renders/${payload.locale}.mp4`, fileName: `${payload.locale}.mp4` }],
        };
      },
      createPublishJobs: async (request) => ({
        success: true,
        platforms: request.platforms,
        jobs: request.videos.map((video) => ({ locale: video.locale })),
      }),
      ...overrides,
    },
  };
}

function makeOffmetaCandidate(overrides = {}) {
  return {
    candidateId: "offmeta-velkoz-support",
    kind: "META_OFFMETA_PICK",
    champion: "Velkoz",
    role: "Support",
    score: 82,
    confidence: 0.78,
    sourceAgreement: 1,
    sampleSize: 18420,
    riskLabels: [],
    evidence: [],
    hardBlock: { blocked: false, reasons: [] },
    ...overrides,
  };
}

function makeTierRanking(overrides = {}) {
  return {
    kind: "META_TIER_RANKING",
    role: "Mid",
    rankingSize: 3,
    entries: [
      { champion: "Ahri", role: "Mid", tierScore: 92 },
      { champion: "Orianna", role: "Mid", tierScore: 88 },
      { champion: "Syndra", role: "Mid", tierScore: 84 },
    ],
    hardBlock: { blocked: false, reasons: [] },
    ...overrides,
  };
}

test("handleMetaScanRequest writes snapshot with offmeta and tier candidates", async () => {
  const originalCwd = process.cwd();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hvs-meta-api-"));
  process.chdir(dir);
  clearModules();
  try {
    const { handleMetaScanRequest } = require(path.join(ROOT, "utils/metaFactory/apiHandlers.js"));
    const result = await handleMetaScanRequest({
      patch: "16.12",
      region: "global",
      position: "Mid",
    }, {
      fetchLolalyticsRows: async () => ({
        sourceStatus: { provider: "LoLalytics", status: "ready", rowCount: 8 },
        rows: makeRows(),
      }),
      verifyCandidate: async () => ({ provider: "OP.GG", status: "verified", sourceAgreement: 1, notes: [] }),
      now: () => new Date("2026-06-21T08:00:00.000Z"),
    });

    assert.equal(result.success, true);
    assert.match(result.snapshotId, /^meta-16\.12-/);
    assert.equal(result.candidates.offmeta.length > 0, true);
    assert.equal(result.candidates.tierRankings.length, 1);
  } finally {
    process.chdir(originalCwd);
    clearModules();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("meta scans with same timestamp keep distinct snapshots for different filters", async () => {
  const originalCwd = process.cwd();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hvs-meta-api-filter-ids-"));
  process.chdir(dir);
  clearModules();
  try {
    const { handleMetaScanRequest, handleMetaSnapshotRequest } = require(path.join(ROOT, "utils/metaFactory/apiHandlers.js"));
    const deps = {
      fetchLolalyticsRows: async () => ({
        sourceStatus: { provider: "LoLalytics", status: "ready", rowCount: 8 },
        rows: makeRows(),
      }),
      verifyCandidate: async () => ({ provider: "OP.GG", status: "verified", sourceAgreement: 1, notes: [] }),
      now: () => new Date("2026-06-21T08:00:00.000Z"),
    };

    const first = await handleMetaScanRequest({
      patch: "16.12",
      region: "global",
      position: "Mid",
      rankPreset: "emerald_plus",
      excludedChampions: ["Velkoz"],
    }, deps);
    const second = await handleMetaScanRequest({
      patch: "16.12",
      region: "global",
      position: "Mid",
      rankPreset: "emerald_plus",
      excludedChampions: ["Champion1"],
    }, deps);

    assert.notEqual(first.snapshotId, second.snapshotId);

    const firstSnapshot = handleMetaSnapshotRequest(first.snapshotId, {
      now: () => new Date("2026-06-21T08:05:00.000Z"),
    });
    const secondSnapshot = handleMetaSnapshotRequest(second.snapshotId, {
      now: () => new Date("2026-06-21T08:05:00.000Z"),
    });

    assert.equal(
      firstSnapshot.candidates.tierRankings[0].entries.some((entry) => entry.champion === "Velkoz"),
      false
    );
    assert.equal(
      secondSnapshot.candidates.tierRankings[0].entries.some((entry) => entry.champion === "Champion1"),
      false
    );
  } finally {
    process.chdir(originalCwd);
    clearModules();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("meta scan rejects runtime sample mode and snapshot read reports missing ids", async () => {
  const originalCwd = process.cwd();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hvs-meta-api-errors-"));
  process.chdir(dir);
  clearModules();
  try {
    const { handleMetaScanRequest, handleMetaSnapshotRequest } = require(path.join(ROOT, "utils/metaFactory/apiHandlers.js"));
    await assert.rejects(() => handleMetaScanRequest({ useSample: true }), /useSample is not supported/);
    assert.throws(() => handleMetaSnapshotRequest("missing"), /Meta snapshot not found/);
  } finally {
    process.chdir(originalCwd);
    clearModules();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("handleMetaRenderRequest renders zh/en from snapshot and queues IG/Threads only", async () => {
  const originalCwd = process.cwd();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hvs-meta-render-"));
  process.chdir(dir);
  clearModules();
  try {
    const { writeMetaSnapshot } = require(path.join(ROOT, "utils/metaFactory/snapshotStore.js"));
    writeMetaSnapshot({
      snapshotId: "meta-render-1",
      createdAt: "2026-06-21T08:00:00.000Z",
      candidates: {
        offmeta: [{
          candidateId: "offmeta-velkoz-support",
          kind: "META_OFFMETA_PICK",
          champion: "Velkoz",
          role: "Support",
          score: 82,
          confidence: 0.78,
          sourceAgreement: 1,
          sampleSize: 18420,
          riskLabels: [],
          evidence: [],
          hardBlock: { blocked: false, reasons: [] },
        }],
        tierRankings: [],
      },
    });
    const { handleMetaRenderRequest } = require(path.join(ROOT, "utils/metaFactory/apiHandlers.js"));
    const result = await handleMetaRenderRequest({
      snapshotId: "meta-render-1",
      mode: "offmeta",
      candidateId: "offmeta-velkoz-support",
    }, {
      now: () => new Date("2026-06-21T08:05:00.000Z"),
      renderVideosFromRequest: async (payload) => ({
        videos: [{ locale: payload.locale, videoUrl: `/renders/${payload.locale}.mp4`, fileName: `${payload.locale}.mp4` }],
      }),
      createPublishJobs: async (request) => ({
        success: true,
        platforms: request.platforms,
        jobs: request.videos.map((video) => ({ locale: video.locale })),
      }),
    });

    assert.equal(result.success, true);
    assert.deepEqual(result.videos.map((video) => video.locale), ["zh", "en"]);
    assert.deepEqual(result.publish.platforms, ["instagram", "threads"]);
  } finally {
    process.chdir(originalCwd);
    clearModules();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("handleMetaRenderRequest honors requested renderLanguages for zh-only meta renders", async () => {
  const { payloads, deps } = makeRenderDeps();

  await withRenderSnapshot({
    snapshotId: "meta-render-zh-only",
    candidates: {
      offmeta: [makeOffmetaCandidate()],
      tierRankings: [],
    },
  }, async (handleMetaRenderRequest) => {
    const result = await handleMetaRenderRequest({
      snapshotId: "meta-render-zh-only",
      mode: "offmeta",
      candidateId: "offmeta-velkoz-support",
      renderLanguages: ["zh"],
    }, deps);

    assert.deepEqual(payloads.map((payload) => payload.locale), ["zh"]);
    assert.deepEqual(result.videos.map((video) => video.locale), ["zh"]);
    assert.deepEqual(result.publish.jobs.map((job) => job.locale), ["zh"]);
  });
});

test("handleMetaRenderRequest keeps rendered videos when publish queue creation fails", async () => {
  const originalCwd = process.cwd();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hvs-meta-render-queue-fail-"));
  process.chdir(dir);
  clearModules();
  try {
    const { writeMetaSnapshot } = require(path.join(ROOT, "utils/metaFactory/snapshotStore.js"));
    writeMetaSnapshot({
      snapshotId: "meta-render-queue-fail",
      createdAt: "2026-06-21T08:00:00.000Z",
      candidates: {
        offmeta: [{
          candidateId: "offmeta-velkoz-support",
          kind: "META_OFFMETA_PICK",
          champion: "Velkoz",
          role: "Support",
          score: 82,
          confidence: 0.78,
          sourceAgreement: 1,
          sampleSize: 18420,
          riskLabels: [],
          evidence: [],
          hardBlock: { blocked: false, reasons: [] },
        }],
        tierRankings: [],
      },
    });
    const { handleMetaRenderRequest } = require(path.join(ROOT, "utils/metaFactory/apiHandlers.js"));

    const result = await handleMetaRenderRequest({
      snapshotId: "meta-render-queue-fail",
      mode: "offmeta",
      candidateId: "offmeta-velkoz-support",
    }, {
      now: () => new Date("2026-06-21T08:05:00.000Z"),
      renderVideosFromRequest: async (payload) => ({
        videos: [{ locale: payload.locale, videoUrl: `/renders/${payload.locale}.mp4`, fileName: `${payload.locale}.mp4` }],
      }),
      createPublishJobs: async () => {
        throw new Error("queue storage unavailable");
      },
    });

    assert.equal(result.success, true);
    assert.deepEqual(result.videos.map((video) => video.locale), ["zh", "en"]);
    assert.equal(result.publish.success, false);
    assert.equal(result.publish.error, "queue storage unavailable");
    assert.equal(result.publish.message, "queue storage unavailable");
    assert.deepEqual(result.publish.platforms, ["instagram", "threads"]);
  } finally {
    process.chdir(originalCwd);
    clearModules();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("handleMetaRenderRequest useTopCandidate skips hard-blocked candidates", async () => {
  await withRenderSnapshot({
    snapshotId: "meta-render-top-skips-blocked",
    candidates: {
      offmeta: [
        makeOffmetaCandidate({
          candidateId: "blocked-high-score",
          champion: "Zed",
          score: 99,
          hardBlock: { blocked: true, reasons: ["insufficient cross-source agreement"] },
        }),
        makeOffmetaCandidate({
          candidateId: "open-lower-score",
          champion: "Velkoz",
          score: 81,
        }),
      ],
      tierRankings: [],
    },
  }, async (handleMetaRenderRequest) => {
    const { deps, payloads } = makeRenderDeps();

    const result = await handleMetaRenderRequest({
      snapshotId: "meta-render-top-skips-blocked",
      mode: "offmeta",
      useTopCandidate: true,
    }, deps);

    assert.equal(result.candidate.candidateId, "open-lower-score");
    assert.deepEqual(payloads.map((payload) => payload.champion), ["Velkoz", "Velkoz"]);
    assert.deepEqual(result.videos.map((video) => video.locale), ["zh", "en"]);
  });
});

test("handleMetaRenderRequest uses tier rankings pool in tier mode", async () => {
  await withRenderSnapshot({
    snapshotId: "meta-render-tier-mode",
    candidates: {
      offmeta: [
        makeOffmetaCandidate({
          candidateId: "Mid",
          champion: "Teemo",
          role: "Top",
          score: 100,
        }),
      ],
      tierRankings: [
        makeTierRanking({ role: "Mid" }),
      ],
    },
  }, async (handleMetaRenderRequest) => {
    const { deps, payloads } = makeRenderDeps();

    const result = await handleMetaRenderRequest({
      snapshotId: "meta-render-tier-mode",
      mode: "tier",
      candidateId: "Mid",
    }, deps);

    assert.equal(result.candidate.kind, "META_TIER_RANKING");
    assert.equal(result.candidate.role, "Mid");
    assert.deepEqual(payloads.map((payload) => payload.dataType), ["META_TIER_RANKING", "META_TIER_RANKING"]);
    assert.deepEqual(result.videos.map((video) => video.type), ["meta-tier-ranking", "meta-tier-ranking"]);
  });
});

test("handleMetaRenderRequest rejects missing candidates before rendering", async () => {
  await withRenderSnapshot({
    snapshotId: "meta-render-missing-candidate",
    candidates: {
      offmeta: [makeOffmetaCandidate()],
      tierRankings: [],
    },
  }, async (handleMetaRenderRequest) => {
    const { deps, payloads } = makeRenderDeps();

    await assert.rejects(
      () => handleMetaRenderRequest({
        snapshotId: "meta-render-missing-candidate",
        mode: "offmeta",
        candidateId: "missing-candidate",
      }, deps),
      /Meta candidate not found: missing-candidate/
    );
    assert.equal(payloads.length, 0);
  });
});

test("handleMetaRenderRequest rejects explicitly selected hard-blocked candidates", async () => {
  await withRenderSnapshot({
    snapshotId: "meta-render-explicit-blocked",
    candidates: {
      offmeta: [
        makeOffmetaCandidate({
          candidateId: "blocked-explicit",
          hardBlock: { blocked: true, reasons: ["low sample size"] },
        }),
      ],
      tierRankings: [],
    },
  }, async (handleMetaRenderRequest) => {
    const { deps, payloads } = makeRenderDeps();

    await assert.rejects(
      () => handleMetaRenderRequest({
        snapshotId: "meta-render-explicit-blocked",
        mode: "offmeta",
        candidateId: "blocked-explicit",
      }, deps),
      /Meta candidate is hard-blocked: low sample size/
    );
    assert.equal(payloads.length, 0);
  });
});

test("handleMetaRenderRequest rejects offmeta build candidates without core item or rune details", async () => {
  await withRenderSnapshot({
    snapshotId: "meta-render-build-missing-details",
    candidates: {
      offmeta: [
        makeOffmetaCandidate({
          candidateId: "offmeta-fizz-mid",
          champion: "Fizz",
          role: "Mid",
          offmetaType: "OFFMETA_BUILD",
          hardBlock: { blocked: false, reasons: [] },
        }),
      ],
      tierRankings: [],
    },
  }, async (handleMetaRenderRequest) => {
    const { deps, payloads } = makeRenderDeps();

    await assert.rejects(
      () => handleMetaRenderRequest({
        snapshotId: "meta-render-build-missing-details",
        mode: "offmeta",
        candidateId: "offmeta-fizz-mid",
      }, deps),
      /缺少核心裝備\/符文，不能生成黑科技影片。/
    );
    assert.equal(payloads.length, 0);
  });
});

test("handleMetaScanRequest surfaces LoLalytics source failure as a non-renderable empty snapshot", async () => {
  await withTempMetaFactory("hvs-meta-api-source-fail-", async () => {
    const { handleMetaScanRequest } = require(path.join(ROOT, "utils/metaFactory/apiHandlers.js"));

    const result = await handleMetaScanRequest({ patch: "16.12", position: "Mid" }, {
      fetchLolalyticsRows: async () => ({
        sourceStatus: { provider: "LoLalytics", status: "unavailable", error: "upstream changed", rowCount: 0 },
        rows: [],
      }),
      verifyCandidate: async () => ({ provider: "OP.GG", status: "unavailable", sourceAgreement: 0.5, notes: [] }),
      now: () => new Date("2026-06-21T08:00:00.000Z"),
    });

    assert.equal(result.success, true);
    assert.equal(result.sourceStatus.primary.status, "unavailable");
    assert.deepEqual(result.candidates.offmeta, []);
    assert.equal(result.candidates.tierRankings[0].entries.length, 0);
  });
});

test("handleMetaScanRequest marks verifier unavailable and labels degraded candidates", async () => {
  await withTempMetaFactory("hvs-meta-api-verifier-unavailable-", async () => {
    const { handleMetaScanRequest } = require(path.join(ROOT, "utils/metaFactory/apiHandlers.js"));

    const result = await handleMetaScanRequest({ patch: "16.12", position: "Support" }, {
      fetchLolalyticsRows: async () => ({
        sourceStatus: { provider: "LoLalytics", status: "ready", rowCount: 1 },
        rows: [{
          champion: "Velkoz",
          role: "Support",
          primaryRole: "Mid",
          sampleSize: 3200,
          winRate: 52,
          baselineWinRate: 50,
          pickRate: 1.2,
          rankPreset: "diamond_plus",
        }],
      }),
      verifyCandidate: async () => ({
        provider: "OP.GG",
        status: "unavailable",
        sourceAgreement: 0.5,
        notes: ["OP.GG verifier dependency is not configured."],
      }),
      now: () => new Date("2026-06-21T08:00:00.000Z"),
    });

    assert.equal(result.sourceStatus.verifier.status, "unavailable");
    assert.equal(result.sourceStatus.verifier.checkedRows, 1);
    assert.equal(result.sourceStatus.verifier.unavailableRows, 1);
    assert.equal(result.candidates.offmeta[0].sourceAgreement, 0.5);
    assert.equal(result.candidates.offmeta[0].riskLabels.includes("SOURCE_UNAVAILABLE"), true);
  });
});

test("handleMetaRenderRequest rejects empty-source tier rankings before rendering", async () => {
  await withTempMetaFactory("hvs-meta-render-empty-source-", async () => {
    const { handleMetaScanRequest, handleMetaRenderRequest } = require(path.join(ROOT, "utils/metaFactory/apiHandlers.js"));

    const scan = await handleMetaScanRequest({ patch: "16.12", position: "Mid" }, {
      fetchLolalyticsRows: async () => ({
        sourceStatus: { provider: "LoLalytics", status: "unavailable", error: "upstream changed", rowCount: 0 },
        rows: [],
      }),
      verifyCandidate: async () => ({ provider: "OP.GG", status: "unavailable", sourceAgreement: 0.5, notes: [] }),
      now: () => new Date("2026-06-21T08:00:00.000Z"),
    });
    const { deps, payloads } = makeRenderDeps();

    assert.equal(scan.sourceStatus.primary.status, "unavailable");
    assert.deepEqual(scan.candidates.offmeta, []);
    assert.equal(scan.candidates.tierRankings[0].entries.length, 0);

    await assert.rejects(
      () => handleMetaRenderRequest({
        snapshotId: scan.snapshotId,
        mode: "tier",
        useTopCandidate: true,
      }, deps),
      /Meta candidate (not found|is hard-blocked)/
    );
    assert.equal(payloads.length, 0);
  });
});

test("handleMetaRenderRequest supports renderer fallback shape and tier top selection", async () => {
  await withRenderSnapshot({
    snapshotId: "meta-render-tier-top-fallback-video",
    candidates: {
      offmeta: [],
      tierRankings: [
        makeTierRanking({
          role: "Mid",
          rankingSize: 2,
          entries: [
            { champion: "Ahri", role: "Mid", tierScore: 80 },
            { champion: "Orianna", role: "Mid", tierScore: 78 },
          ],
        }),
        makeTierRanking({
          role: "Jungle",
          rankingSize: 2,
          entries: [
            { champion: "LeeSin", role: "Jungle", tierScore: 91 },
            { champion: "Vi", role: "Jungle", tierScore: 82 },
          ],
        }),
        makeTierRanking({
          role: "Top",
          rankingSize: 1,
          entries: [
            { champion: "Malphite", role: "Top" },
          ],
        }),
      ],
    },
  }, async (handleMetaRenderRequest) => {
    const calls = [];

    const result = await handleMetaRenderRequest({
      snapshotId: "meta-render-tier-top-fallback-video",
      mode: "tier",
      useTopCandidate: true,
      scheduledAt: "2026-06-21T09:00:00.000Z",
    }, {
      now: () => new Date("2026-06-21T08:05:00.000Z"),
      renderVideosFromRequest: async (payload) => {
        calls.push(payload);
        return { videoUrl: `/renders/${payload.locale}.mp4`, fileName: `${payload.locale}.mp4` };
      },
      createPublishJobs: async (request) => ({
        success: true,
        scheduledAt: request.scheduledAt,
        jobs: request.videos.map((video) => ({ type: video.type, locale: video.locale })),
      }),
    });

    assert.equal(result.candidate.kind, "META_TIER_RANKING");
    assert.equal(result.candidate.role, "Jungle");
    assert.deepEqual(calls.map((payload) => payload.locale), ["zh", "en"]);
    assert.deepEqual(result.videos, [
      { locale: "zh", videoUrl: "/renders/zh.mp4", fileName: "zh.mp4", type: "meta-tier-ranking" },
      { locale: "en", videoUrl: "/renders/en.mp4", fileName: "en.mp4", type: "meta-tier-ranking" },
    ]);
    assert.equal(result.publish.scheduledAt, "2026-06-21T09:00:00.000Z");
  });
});

test("handleMetaRenderRequest rejects explicitly selected empty tier rankings", async () => {
  await withRenderSnapshot({
    snapshotId: "meta-render-empty-tier-selected",
    candidates: {
      offmeta: [],
      tierRankings: [
        makeTierRanking({
          role: "Support",
          rankingSize: 0,
          entries: [],
          hardBlock: { blocked: false, reasons: [] },
        }),
      ],
    },
  }, async (handleMetaRenderRequest) => {
    const { deps, payloads } = makeRenderDeps();

    await assert.rejects(
      () => handleMetaRenderRequest({
        snapshotId: "meta-render-empty-tier-selected",
        mode: "tier",
        candidateId: "Support",
      }, deps),
      /Meta candidate is hard-blocked: Tier ranking has no entries/
    );
    assert.equal(payloads.length, 0);
  });
});

function makeRows() {
  return Array.from({ length: 8 }, (_, index) => ({
    champion: index === 0 ? "Velkoz" : `Champion${index}`,
    role: "Mid",
    primaryRole: index === 0 ? "Support" : "Mid",
    sampleSize: 15000 - index * 1000,
    winRate: 54 - index * 0.4,
    pickRate: 10 - index * 0.5,
    banRate: 4,
    baselineWinRate: 50,
    patch: "16.12",
    region: "global",
  }));
}
