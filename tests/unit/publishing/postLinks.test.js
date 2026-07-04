const test = require("node:test");
const assert = require("node:assert/strict");

const {
  getPublishedRemoteId,
  fetchPublishedPostUrl,
  hydratePublishedPostJob,
  hydratePatchItemPostLinks,
  summarizeJobs,
} = require("../../../utils/publishing/postLinks");

const ORIGINAL_ENV = { ...process.env };

function resetEnv() {
  process.env = { ...ORIGINAL_ENV };
}

test.afterEach(resetEnv);

function createFetch(jsonByUrl = {}) {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(String(url));
    const match = Object.entries(jsonByUrl).find(([pattern]) => String(url).includes(pattern));
    if (!match) {
      return {
        ok: false,
        status: 404,
        json: async () => ({ error: { message: "not found" } }),
      };
    }
    return {
      ok: true,
      status: 200,
      json: async () => match[1],
    };
  };
  fetchImpl.calls = calls;
  return fetchImpl;
}

test("getPublishedRemoteId reads current platform ids", () => {
  assert.equal(getPublishedRemoteId({ platform: "instagram", result: { mediaId: "ig-1" } }), "ig-1");
  assert.equal(getPublishedRemoteId({ platform: "instagram", mediaId: "ig-flat" }), "ig-flat");
  assert.equal(getPublishedRemoteId({ platform: "threads", result: { postId: "th-1" } }), "th-1");
  assert.equal(getPublishedRemoteId({ platform: "threads", postId: "th-flat" }), "th-flat");
  assert.equal(getPublishedRemoteId({ platform: "youtube", result: { id: "yt" } }), "");
});

test("fetchPublishedPostUrl resolves Instagram and Threads permalinks from Graph APIs", async () => {
  process.env.INSTAGRAM_ZH_ACCESS_TOKEN = "ig-token";
  process.env.THREADS_EN_ACCESS_TOKEN = "threads-token";
  const fetchImpl = createFetch({
    "graph.instagram.com/v25.0/ig-1": { permalink: "https://www.instagram.com/reel/abc/" },
    "graph.threads.net/v1.0/th-1": { permalink: "https://www.threads.com/@hextech.vs/post/def" },
  });

  const igUrl = await fetchPublishedPostUrl(
    { platform: "instagram", locale: "zh", result: { mediaId: "ig-1" } },
    { fetchImpl }
  );
  const threadsUrl = await fetchPublishedPostUrl(
    { platform: "threads", locale: "en", result: { postId: "th-1" } },
    { fetchImpl }
  );

  assert.equal(igUrl, "https://www.instagram.com/reel/abc/");
  assert.equal(threadsUrl, "https://www.threads.com/@hextech.vs/post/def");
  assert.match(fetchImpl.calls[0], /access_token=ig-token/);
  assert.match(fetchImpl.calls[1], /access_token=threads-token/);
});

test("fetchPublishedPostUrl returns existing URL without network access", async () => {
  const fetchImpl = createFetch();

  const url = await fetchPublishedPostUrl(
    { platform: "instagram", result: { url: "https://www.instagram.com/reel/existing/" } },
    { fetchImpl }
  );

  assert.equal(url, "https://www.instagram.com/reel/existing/");
  assert.deepEqual(fetchImpl.calls, []);
});

test("fetchPublishedPostUrl handles missing IDs, missing Threads tokens, and empty permalinks", async () => {
  delete process.env.THREADS_ZH_ACCESS_TOKEN;
  process.env.INSTAGRAM_ZH_ACCESS_TOKEN = "ig-token";
  const fetchImpl = createFetch({
    "graph.instagram.com/v25.0/ig-empty": {},
  });

  assert.equal(await fetchPublishedPostUrl({ platform: "instagram", locale: "zh", result: {} }, { fetchImpl }), "");
  assert.equal(await fetchPublishedPostUrl({ platform: "threads", locale: "zh", result: { postId: "threads-1" } }, { fetchImpl }), "");
  assert.equal(
    await fetchPublishedPostUrl(
      { platform: "instagram", locale: "zh", result: { mediaId: "ig-empty" } },
      { fetchImpl }
    ),
    ""
  );
});

test("hydratePublishedPostJob backfills missing URLs for published link records", async () => {
  process.env.INSTAGRAM_ZH_ACCESS_TOKEN = "ig-token";
  const fetchImpl = createFetch({
    "graph.instagram.com/v25.0/ig-published": { permalink: "https://www.instagram.com/reel/published/" },
  });

  const { job, changed } = await hydratePublishedPostJob(
    {
      id: "job-1",
      platform: "instagram",
      locale: "zh",
      status: "PUBLISHED",
      result: { mediaId: "ig-published", url: "" },
    },
    { fetchImpl }
  );

  assert.equal(changed, true);
  assert.equal(job.status, "PUBLISHED");
  assert.equal(job.error, null);
  assert.equal(job.result.url, "https://www.instagram.com/reel/published/");
});

test("hydratePatchItemPostLinks backfills published item links and summarizes jobs", async () => {
  process.env.INSTAGRAM_ZH_ACCESS_TOKEN = "ig-token";
  process.env.THREADS_ZH_ACCESS_TOKEN = "threads-token";
  const fetchImpl = createFetch({
    "graph.instagram.com/v25.0/ig-1": { permalink: "https://www.instagram.com/reel/one/" },
    "graph.threads.net/v1.0/th-1": { permalink: "https://www.threads.com/@hextech.vs.cn/post/one" },
  });

  const { item, changed } = await hydratePatchItemPostLinks(
    {
      id: "patch-1",
      status: "PUBLISHED",
      publishResult: {
        jobs: [
          {
            platform: "instagram",
            locale: "zh",
            status: "PUBLISHED",
            result: { mediaId: "ig-1", url: "" },
          },
          {
            platform: "threads",
            locale: "zh",
            status: "PUBLISHED",
            result: { postId: "th-1", url: "" },
          },
        ],
      },
    },
    { fetchImpl }
  );

  assert.equal(changed, true);
  assert.equal(item.status, "PUBLISHED");
  assert.deepEqual(item.publishResult.summary, { PUBLISHED: 2 });
  assert.deepEqual(
    item.publishResult.jobs.map((job) => job.result.url),
    ["https://www.instagram.com/reel/one/", "https://www.threads.com/@hextech.vs.cn/post/one"]
  );
});

test("hydratePublishedPostJob leaves unsupported or non-published jobs unchanged", async () => {
  const failed = { platform: "instagram", status: "FAILED", result: { mediaId: "ig-1" } };
  const youtube = { platform: "youtube", status: "PUBLISHED", result: { id: "yt-1" } };

  assert.deepEqual(await hydratePublishedPostJob(failed), { job: failed, changed: false });
  assert.deepEqual(await hydratePublishedPostJob(youtube), { job: youtube, changed: false });
  assert.deepEqual(summarizeJobs([failed, youtube]), { FAILED: 1, PUBLISHED: 1 });
});

test("fetchPublishedPostUrl surfaces Graph errors and handles missing credentials", async () => {
  delete process.env.INSTAGRAM_ZH_ACCESS_TOKEN;
  const noTokenUrl = await fetchPublishedPostUrl({
    platform: "instagram",
    locale: "zh",
    result: { mediaId: "ig-no-token" },
  });
  assert.equal(noTokenUrl, "");

  process.env.INSTAGRAM_ZH_ACCESS_TOKEN = "ig-token";
  const fetchImpl = async () => ({
    ok: false,
    status: 500,
    json: async () => ({}),
  });

  await assert.rejects(
    () => fetchPublishedPostUrl({
      platform: "instagram",
      locale: "zh",
      result: { mediaId: "ig-error" },
    }, { fetchImpl }),
    /Post link lookup failed \(500\)/
  );
});

test("hydratePublishedPostJob logs lookup failures without breaking published records", async () => {
  process.env.THREADS_ZH_ACCESS_TOKEN = "threads-token";
  const originalWarn = console.warn;
  const warnings = [];
  console.warn = (message) => warnings.push(message);

  try {
    const { job, changed } = await hydratePublishedPostJob(
      {
        platform: "threads",
        locale: "zh",
        status: "PUBLISHED",
        result: { postId: "threads-error", url: "" },
      },
      {
        fetchImpl: async () => ({
          ok: false,
          status: 403,
          json: async () => ({ error: { message: "permission denied" } }),
        }),
      }
    );

    assert.equal(changed, false);
    assert.equal(job.status, "PUBLISHED");
    assert.equal(job.result.url, "");
    assert.match(warnings[0], /Could not fetch threads permalink: permission denied/);
  } finally {
    console.warn = originalWarn;
  }
});

test("hydratePublishedPostJob clears stale errors and handles empty published records", async () => {
  delete process.env.INSTAGRAM_ZH_ACCESS_TOKEN;
  const stale = await hydratePublishedPostJob({
    platform: "instagram",
    locale: "zh",
    status: "PUBLISHED",
    result: { mediaId: "ig-1" },
    error: "old error",
  });
  assert.equal(stale.changed, true);
  assert.equal(stale.job.error, null);
  assert.equal(stale.job.result.mediaId, "ig-1");

  const empty = await hydratePublishedPostJob({
    platform: "instagram",
    locale: "zh",
    status: "PUBLISHED",
  });
  assert.equal(empty.changed, false);
  assert.equal(empty.job.result, null);
});

test("hydratePatchItemPostLinks leaves records unchanged when links are already present", async () => {
  const item = {
    id: "patch-ready",
    status: "PUBLISHED",
    publishResult: {
      jobs: [
        {
          platform: "instagram",
          locale: "zh",
          status: "PUBLISHED",
          result: {
            mediaId: "ig-existing",
            url: "https://www.instagram.com/reel/existing/",
          },
        },
      ],
    },
  };

  assert.deepEqual(await hydratePatchItemPostLinks(item), { item, changed: false });
  assert.deepEqual(await hydratePatchItemPostLinks({ id: "empty" }), { item: { id: "empty" }, changed: false });
});
