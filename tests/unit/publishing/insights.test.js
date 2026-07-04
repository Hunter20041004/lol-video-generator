const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "../../..");
const ORIGINAL_ENV = { ...process.env };
const ORIGINAL_FETCH = global.fetch;

function clearModules() {
  [
    "utils/publishing/insights.js",
    "utils/publishing/queueStore.js",
    "utils/publishing/postLinks.js",
    "utils/publishing/accounts.js",
  ].forEach((file) => {
    delete require.cache[path.join(ROOT, file)];
  });
}

async function withTempProject(fn) {
  const originalCwd = process.cwd();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hvs-insights-"));
  process.chdir(dir);
  clearModules();
  try {
    await fn(dir);
  } finally {
    process.chdir(originalCwd);
    process.env = { ...ORIGINAL_ENV };
    clearModules();
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function jsonResponse(body, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    json: async () => body,
  };
}

test.afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  global.fetch = ORIGINAL_FETCH;
});

test("normalizes Meta metrics and calculates platform engagement summaries", () => {
  const {
    normalizeGraphMetrics,
    buildInsightSnapshot,
  } = require("../../../utils/publishing/insights");
  const data = [
    { name: "views", values: [{ value: 100 }] },
    { name: "likes", total_value: { value: 7 } },
    { name: "comments", values: [{ value: 2 }] },
    { name: "saved", values: [{ value: 3 }] },
    { name: "shares", values: [{ value: 4 }] },
  ];

  assert.deepEqual(normalizeGraphMetrics(data), {
    views: 100,
    likes: 7,
    comments: 2,
    saved: 3,
    shares: 4,
  });
  assert.deepEqual(buildInsightSnapshot("instagram", data, "2026-06-04T10:00:00.000Z"), {
    capturedAt: "2026-06-04T10:00:00.000Z",
    metrics: {
      views: 100,
      likes: 7,
      comments: 2,
      saved: 3,
      shares: 4,
    },
    views: 100,
    engagements: 16,
    engagementRate: 0.16,
  });
});

test("handles empty, malformed, and Threads-specific metric values", () => {
  const {
    normalizeGraphMetrics,
    buildInsightSnapshot,
  } = require("../../../utils/publishing/insights");

  assert.deepEqual(normalizeGraphMetrics(null), {});
  assert.deepEqual(normalizeGraphMetrics([
    {},
    { name: "views", values: [] },
    { name: "likes", values: [{ value: "not-a-number" }] },
    { name: "replies", total_value: { value: "3" } },
    { name: "reposts", values: [{ value: 1 }, { value: 2 }] },
  ]), {
    views: 0,
    likes: 0,
    replies: 3,
    reposts: 2,
  });

  const snapshot = buildInsightSnapshot("threads", [
    { name: "likes", values: [{ value: 2 }] },
    { name: "replies", values: [{ value: 3 }] },
    { name: "reposts", values: [{ value: 4 }] },
    { name: "quotes", values: [{ value: 5 }] },
    { name: "shares", values: [{ value: 6 }] },
  ]);
  assert.equal(snapshot.views, 0);
  assert.equal(snapshot.engagements, 20);
  assert.equal(snapshot.engagementRate, 0);
});

test("fetches Instagram and Threads post insights with locale credentials", async () => {
  process.env.INSTAGRAM_ZH_ACCESS_TOKEN = "ig-token";
  process.env.THREADS_EN_ACCESS_TOKEN = "threads-token";
  const { fetchPostInsights } = require("../../../utils/publishing/insights");
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(new URL(url));
    return jsonResponse({
      data: [
        { name: "views", values: [{ value: 50 }] },
        { name: "likes", values: [{ value: 5 }] },
        { name: "shares", values: [{ value: 1 }] },
      ],
    });
  };

  const instagram = await fetchPostInsights(
    { platform: "instagram", locale: "zh", result: { mediaId: "ig-1" } },
    { fetchImpl, capturedAt: "2026-06-04T10:00:00.000Z" }
  );
  const threads = await fetchPostInsights(
    { platform: "threads", locale: "en", result: { postId: "threads-1" } },
    { fetchImpl, capturedAt: "2026-06-04T10:00:00.000Z" }
  );

  assert.equal(calls[0].origin, "https://graph.instagram.com");
  assert.equal(calls[0].pathname, "/v25.0/ig-1/insights");
  assert.equal(calls[0].searchParams.get("access_token"), "ig-token");
  assert.match(calls[0].searchParams.get("metric"), /ig_reels_avg_watch_time/);
  assert.equal(calls[1].origin, "https://graph.threads.net");
  assert.equal(calls[1].pathname, "/v1.0/threads-1/insights");
  assert.equal(calls[1].searchParams.get("access_token"), "threads-token");
  assert.equal(instagram.engagements, 6);
  assert.equal(threads.engagements, 6);
});

test("classifies missing tokens and Meta permission errors as authorization failures", async () => {
  delete process.env.INSTAGRAM_ZH_ACCESS_TOKEN;
  const { fetchPostInsights } = require("../../../utils/publishing/insights");

  await assert.rejects(
    () => fetchPostInsights({ platform: "instagram", locale: "zh", result: { mediaId: "ig-1" } }),
    (error) => error.needsAuth && /Missing instagram access token/.test(error.message)
  );

  process.env.INSTAGRAM_ZH_ACCESS_TOKEN = "ig-token";
  await assert.rejects(
    () => fetchPostInsights(
      { platform: "instagram", locale: "zh", result: { mediaId: "ig-1" } },
      {
        fetchImpl: async () => jsonResponse(
          { error: { code: 10, message: "Application does not have permission" } },
          { ok: false, status: 403 }
        ),
      }
    ),
    (error) => error.needsAuth && error.code === 10
  );
});

test("rejects unsupported jobs, missing post IDs, and ordinary provider failures", async () => {
  process.env.THREADS_ZH_ACCESS_TOKEN = "threads-token";
  const { fetchPostInsights } = require("../../../utils/publishing/insights");

  await assert.rejects(
    () => fetchPostInsights({ platform: "youtube", status: "PUBLISHED" }),
    /Unsupported insights platform/
  );
  await assert.rejects(
    () => fetchPostInsights({ platform: "threads", locale: "zh", result: {} }),
    /Missing published threads post ID/
  );
  await assert.rejects(
    () => fetchPostInsights(
      { platform: "threads", locale: "zh", result: { postId: "threads-1" } },
      {
        fetchImpl: async () => ({
          ok: false,
          status: 500,
          json: async () => {
            throw new Error("invalid json");
          },
        }),
      }
    ),
    (error) => !error.needsAuth && error.status === 500 && /request failed/.test(error.message)
  );
});

test("classifies token expiry error variants returned by Meta", async () => {
  process.env.THREADS_ZH_ACCESS_TOKEN = "threads-token";
  const { fetchPostInsights, InsightsError } = require("../../../utils/publishing/insights");
  const job = { platform: "threads", locale: "zh", result: { postId: "threads-1" } };

  const emptyError = new InsightsError("plain");
  assert.equal(emptyError.status, 0);
  assert.equal(emptyError.code, 0);
  assert.equal(emptyError.needsAuth, false);

  await assert.rejects(
    () => fetchPostInsights(job, {
      fetchImpl: async () => jsonResponse(
        { error: { code: 190, message: "expired token" } },
        { ok: false, status: 400 }
      ),
    }),
    (error) => error.needsAuth && error.code === 190
  );
  await assert.rejects(
    () => fetchPostInsights(job, {
      fetchImpl: async () => jsonResponse(
        { error: { message: "unauthorized" } },
        { ok: false, status: 401 }
      ),
    }),
    (error) => error.needsAuth && error.status === 401
  );
});

test("uses global fetch by default and handles provider errors in successful HTTP responses", async () => {
  process.env.THREADS_ZH_ACCESS_TOKEN = "threads-token";
  const { fetchPostInsights } = require("../../../utils/publishing/insights");
  const job = { platform: "threads", locale: "zh", result: { postId: "threads-1" } };

  global.fetch = async () => jsonResponse({
    data: [{ name: "views", values: [{ value: 4 }] }],
  });
  const snapshot = await fetchPostInsights(job);
  assert.equal(snapshot.views, 4);
  assert.match(snapshot.capturedAt, /^\d{4}-\d{2}-\d{2}T/);

  global.fetch = async () => jsonResponse({
    error: { code: 200, message: "permission error" },
  });
  await assert.rejects(
    () => fetchPostInsights(job),
    (error) => error.needsAuth && error.status === 200 && error.code === 200
  );
});

test("chooses sync intervals by post age and honors valid environment overrides", () => {
  const { getSyncIntervalMs, isInsightsSyncDue } = require("../../../utils/publishing/insights");
  const now = new Date("2026-06-10T12:00:00.000Z");
  const minute = 60 * 1000;

  process.env.INSIGHTS_FRESH_INTERVAL_MINUTES = "15";
  process.env.INSIGHTS_RECENT_INTERVAL_MINUTES = "120";
  process.env.INSIGHTS_ARCHIVE_INTERVAL_MINUTES = "invalid";

  assert.equal(getSyncIntervalMs({ createdAt: "2026-06-10T11:00:00.000Z" }, now), 15 * minute);
  assert.equal(getSyncIntervalMs({ createdAt: "2026-06-08T12:00:00.000Z" }, now), 120 * minute);
  assert.equal(getSyncIntervalMs({ createdAt: "2026-05-01T12:00:00.000Z" }, now), 1440 * minute);
  assert.equal(getSyncIntervalMs({ createdAt: "invalid" }, now), 15 * minute);
  assert.equal(getSyncIntervalMs({ publishedAt: "2026-06-08T12:00:00.000Z" }, now), 120 * minute);
  assert.equal(getSyncIntervalMs({ updatedAt: "2026-05-01T12:00:00.000Z" }, now), 1440 * minute);
  process.env.INSIGHTS_FRESH_INTERVAL_MINUTES = "-1";
  assert.equal(getSyncIntervalMs({ createdAt: "2026-06-11T12:00:00.000Z" }, now), 60 * minute);
  assert.equal(isInsightsSyncDue({}, now), true);
  assert.equal(isInsightsSyncDue({ insights: { status: "NEEDS_AUTH", nextSyncAt: "2026-06-11T12:00:00.000Z" } }, now), false);
  assert.equal(isInsightsSyncDue({ insights: { latest: {}, nextSyncAt: "invalid" } }, now), true);
});

test("syncs due published tasks, stores snapshots, and records permission failures", async () => {
  await withTempProject(async () => {
    process.env.THREADS_ZH_ACCESS_TOKEN = "threads-token";
    process.env.INSTAGRAM_ZH_ACCESS_TOKEN = "ig-token";
    const { writeQueue, readQueue } = require(path.join(ROOT, "utils/publishing/queueStore.js"));
    const { syncPublishedInsights } = require(path.join(ROOT, "utils/publishing/insights.js"));
    writeQueue([
      {
        id: "threads-job",
        platform: "threads",
        locale: "zh",
        status: "PUBLISHED",
        createdAt: "2026-06-04T09:00:00.000Z",
        result: { postId: "threads-1" },
      },
      {
        id: "ig-job",
        platform: "instagram",
        locale: "zh",
        status: "PUBLISHED",
        createdAt: "2026-06-04T09:00:00.000Z",
        result: { mediaId: "ig-1" },
      },
      { id: "queued-job", platform: "threads", locale: "zh", status: "QUEUED" },
    ]);

    const result = await syncPublishedInsights({
      force: true,
      now: "2026-06-04T10:00:00.000Z",
      fetchImpl: async (url) => {
        if (String(url).includes("graph.threads.net")) {
          return jsonResponse({
            data: [
              { name: "views", values: [{ value: 200 }] },
              { name: "likes", values: [{ value: 10 }] },
              { name: "replies", values: [{ value: 2 }] },
            ],
          });
        }
        return jsonResponse(
          { error: { code: 10, message: "permission denied" } },
          { ok: false, status: 403 }
        );
      },
    });

    assert.deepEqual(
      {
        considered: result.considered,
        synced: result.synced,
        skipped: result.skipped,
        failed: result.failed,
        needsAuth: result.needsAuth,
      },
      { considered: 2, synced: 1, skipped: 0, failed: 0, needsAuth: 1 }
    );
    const queue = readQueue();
    const threads = queue.find((task) => task.id === "threads-job");
    const instagram = queue.find((task) => task.id === "ig-job");
    assert.equal(threads.insights.status, "SYNCED");
    assert.equal(threads.insights.latest.views, 200);
    assert.equal(threads.insights.latest.engagements, 12);
    assert.equal(threads.insights.snapshots.length, 1);
    assert.equal(instagram.insights.status, "NEEDS_AUTH");
    assert.match(instagram.insights.error.message, /permission denied/);
  });
});

test("skips tasks before nextSyncAt unless forced and supports filters", async () => {
  await withTempProject(async () => {
    process.env.THREADS_ZH_ACCESS_TOKEN = "threads-token";
    const { writeQueue } = require(path.join(ROOT, "utils/publishing/queueStore.js"));
    const {
      isInsightsSyncDue,
      syncPublishedInsights,
      summarizeTrackedInsights,
    } = require(path.join(ROOT, "utils/publishing/insights.js"));
    const task = {
      id: "threads-job",
      platform: "threads",
      locale: "zh",
      status: "PUBLISHED",
      result: { postId: "threads-1" },
      insights: {
        status: "SYNCED",
        latest: { views: 1 },
        nextSyncAt: "2026-06-04T11:00:00.000Z",
      },
    };
    writeQueue([
      task,
      { id: "ig-job", platform: "instagram", locale: "en", status: "PUBLISHED", result: { mediaId: "ig-1" } },
      { id: "threads-en", platform: "threads", locale: "en", status: "PUBLISHED", result: { postId: "threads-en" } },
      { id: "youtube-job", platform: "youtube", locale: "zh", status: "PUBLISHED", result: { videoId: "yt-1" } },
    ]);

    assert.equal(isInsightsSyncDue(task, new Date("2026-06-04T10:00:00.000Z")), false);
    assert.equal(isInsightsSyncDue(task, new Date("2026-06-04T12:00:00.000Z")), true);

    const result = await syncPublishedInsights({
      platform: "threads",
      locale: "zh",
      now: "2026-06-04T10:00:00.000Z",
      fetchImpl: async () => {
        throw new Error("should not fetch");
      },
    });

    assert.equal(result.considered, 1);
    assert.equal(result.skipped, 1);
    assert.deepEqual(summarizeTrackedInsights(), {
      total: 3,
      byPlatform: { threads: 2, instagram: 1 },
      byStatus: { SYNCED: 1, PENDING: 2 },
    });
  });
});

test("limits sync work, records ordinary errors, and caps retained snapshots", async () => {
  await withTempProject(async () => {
    process.env.THREADS_ZH_ACCESS_TOKEN = "threads-token";
    process.env.INSIGHTS_MAX_SNAPSHOTS = "2";
    process.env.INSIGHTS_ERROR_RETRY_MINUTES = "5";
    const { writeQueue, readQueue } = require(path.join(ROOT, "utils/publishing/queueStore.js"));
    const { syncPublishedInsights } = require(path.join(ROOT, "utils/publishing/insights.js"));
    writeQueue([
      {
        id: "error-job",
        platform: "threads",
        locale: "zh",
        status: "PUBLISHED",
        result: { postId: "threads-error" },
      },
      {
        id: "snapshot-job",
        platform: "threads",
        locale: "zh",
        status: "PUBLISHED",
        result: { postId: "threads-ok" },
        insights: {
          snapshots: [{ capturedAt: "one" }, { capturedAt: "two" }],
        },
      },
    ]);

    const first = await syncPublishedInsights({
      force: true,
      limit: 1,
      now: "2026-06-04T10:00:00.000Z",
      fetchImpl: async () => jsonResponse(
        { error: { code: 1, message: "temporary provider failure" } },
        { ok: false, status: 500 }
      ),
    });
    assert.equal(first.considered, 1);
    assert.equal(first.failed, 1);
    assert.equal(readQueue().find((task) => task.id === "error-job").insights.status, "ERROR");

    const second = await syncPublishedInsights({
      force: true,
      platform: "threads",
      locale: "zh",
      now: "2026-06-04T10:10:00.000Z",
      fetchImpl: async (url) => {
        if (String(url).includes("threads-error")) {
          return jsonResponse({ data: [] });
        }
        return jsonResponse({ data: [{ name: "views", values: [{ value: 10 }] }] });
      },
    });
    assert.equal(second.synced, 2);
    const snapshotJob = readQueue().find((task) => task.id === "snapshot-job");
    assert.deepEqual(snapshotJob.insights.snapshots.map((snapshot) => snapshot.capturedAt), [
      "two",
      "2026-06-04T10:10:00.000Z",
    ]);
  });
});

test("merges queue insights into content library jobs without mutating unrelated jobs", () => {
  const { mergePatchItemInsightsFromQueue } = require("../../../utils/publishing/insights");
  const item = {
    id: "patch-1",
    publishResult: {
      jobs: [
        { id: "threads-job", platform: "threads" },
        { id: "youtube-job", platform: "youtube" },
      ],
    },
  };
  const merged = mergePatchItemInsightsFromQueue(item, new Map([
    ["threads-job", { id: "threads-job", insights: { status: "SYNCED", latest: { views: 99 } } }],
  ]));

  assert.equal(merged.publishResult.jobs[0].insights.latest.views, 99);
  assert.equal(merged.publishResult.jobs[1].insights, undefined);
  assert.equal(item.publishResult.jobs[0].insights, undefined);

  const mergedFromArray = mergePatchItemInsightsFromQueue(item, [
    { id: "threads-job", insights: { status: "SYNCED", latest: { views: 101 } } },
  ]);
  assert.equal(mergedFromArray.publishResult.jobs[0].insights.latest.views, 101);
});

test("leaves content items without publish jobs unchanged", () => {
  const { mergePatchItemInsightsFromQueue } = require("../../../utils/publishing/insights");
  const item = { id: "patch-empty" };
  assert.equal(mergePatchItemInsightsFromQueue(item), item);
});

test("builds a performance report with platform, locale, post, and snapshot deltas", () => {
  const { buildInsightsReport } = require("../../../utils/publishing/insights");
  const tasks = [
    {
      id: "ig-zh",
      platform: "instagram",
      locale: "zh",
      status: "PUBLISHED",
      createdAt: "2026-06-04T08:00:00.000Z",
      copy: { title: "IG post" },
      result: { url: "https://instagram.com/p/example" },
      insights: {
        status: "SYNCED",
        syncedAt: "2026-06-04T10:00:00.000Z",
        latest: {
          views: 120,
          engagements: 12,
          engagementRate: 0.1,
          metrics: { views: 120, reach: 90, likes: 8, saved: 4 },
        },
        snapshots: [
          { views: 100, engagements: 10 },
          { views: 120, engagements: 12 },
        ],
      },
    },
    {
      id: "threads-en",
      platform: "threads",
      locale: "en",
      status: "PUBLISHED",
      createdAt: "2026-06-04T09:00:00.000Z",
      copy: { title: "Threads post" },
      insights: {
        status: "SYNCED",
        syncedAt: "2026-06-04T11:00:00.000Z",
        latest: {
          views: 80,
          engagements: 8,
          engagementRate: 0.1,
          metrics: { views: 80, likes: 5, replies: 3 },
        },
        snapshots: [{ views: 80, engagements: 8 }],
      },
    },
    { id: "youtube", platform: "youtube", locale: "zh", status: "PUBLISHED" },
  ];

  const report = buildInsightsReport(tasks);

  assert.equal(report.totals.posts, 2);
  assert.equal(report.totals.views, 200);
  assert.equal(report.totals.engagements, 20);
  assert.equal(report.totals.engagementRate, 0.1);
  assert.equal(report.totals.lastSyncedAt, "2026-06-04T11:00:00.000Z");
  assert.equal(report.byPlatform.instagram.views, 120);
  assert.equal(report.byPlatform.threads.views, 80);
  assert.equal(report.byLocale.zh.posts, 1);
  assert.equal(report.byLocale.en.posts, 1);
  assert.equal(report.posts[0].title, "IG post");
  assert.equal(report.posts[0].delta.views, 20);
  assert.equal(report.posts[0].delta.engagements, 2);
  assert.equal(report.posts[1].delta.views, null);
});
