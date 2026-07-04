const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const metaAuth = require("../../../utils/publishing/metaAuth");

const ORIGINAL_ENV = { ...process.env };
const ORIGINAL_FETCH = global.fetch;

function resetEnv() {
  process.env = { ...ORIGINAL_ENV };
  global.fetch = ORIGINAL_FETCH;
}

function jsonResponse(body, ok = true, status = 200) {
  return {
    ok,
    status,
    async json() {
      return body;
    },
  };
}

test.afterEach(resetEnv);

test("builds Instagram Login URL with current business scopes", () => {
  process.env.META_APP_ID = "meta-app";
  process.env.INSTAGRAM_APP_ID = "instagram-app";
  process.env.META_REDIRECT_BASE_URL = "http://localhost:3000/";

  const url = new URL(metaAuth.buildInstagramAuthUrl("zh-TW"));
  const scopes = url.searchParams.get("scope").split(",");

  assert.equal(url.origin, "https://www.instagram.com");
  assert.equal(url.pathname, "/oauth/authorize");
  assert.equal(url.searchParams.get("client_id"), "instagram-app");
  assert.equal(url.searchParams.get("redirect_uri"), "http://localhost:3000/api/auth/meta/instagram/callback");
  assert.equal(url.searchParams.get("state"), "instagram:zh");
  assert.equal(url.searchParams.get("force_reauth"), "true");
  assert.deepEqual(scopes, [
    "instagram_business_basic",
    "instagram_business_content_publish",
    "instagram_business_manage_insights",
  ]);
  assert.equal(scopes.includes("pages_show_list"), false);
});

test("falls back to Meta app credentials when Instagram app credentials are not configured", () => {
  process.env.META_APP_ID = "meta-app";
  process.env.META_APP_SECRET = "meta-secret";

  assert.deepEqual(metaAuth.getInstagramAppConfig(), {
    appId: "meta-app",
    appSecret: "meta-secret",
  });
});

test("builds Threads OAuth URL with publishing scopes", () => {
  process.env.META_APP_ID = "meta-app";
  process.env.THREADS_APP_ID = "threads-app";
  process.env.META_REDIRECT_BASE_URL = "http://localhost:3000";

  const url = new URL(metaAuth.buildThreadsAuthUrl("en"));
  const scopes = url.searchParams.get("scope").split(",");

  assert.equal(url.origin, "https://threads.net");
  assert.equal(url.pathname, "/oauth/authorize");
  assert.equal(url.searchParams.get("client_id"), "threads-app");
  assert.equal(url.searchParams.get("app_id"), "threads-app");
  assert.equal(url.searchParams.get("platform_app_id"), "threads-app");
  assert.equal(url.searchParams.get("state"), "threads:en");
  assert.deepEqual(scopes, [
    "threads_basic",
    "threads_content_publish",
    "threads_manage_insights",
    "threads_delete",
  ]);
});

test("falls back to Meta app credentials when Threads app credentials are not configured", () => {
  process.env.META_APP_ID = "meta-app";
  process.env.META_APP_SECRET = "meta-secret";

  assert.deepEqual(metaAuth.getThreadsAppConfig(), {
    appId: "meta-app",
    appSecret: "meta-secret",
  });
});

test("exchanges Instagram auth code through Instagram endpoints", async () => {
  process.env.META_APP_ID = "meta-app";
  process.env.META_APP_SECRET = "meta-secret";
  process.env.INSTAGRAM_APP_ID = "instagram-app";
  process.env.INSTAGRAM_APP_SECRET = "instagram-secret";
  process.env.META_REDIRECT_BASE_URL = "http://localhost:3000";

  const calls = [];
  global.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    if (String(url).startsWith("https://api.instagram.com/oauth/access_token")) {
      assert.equal(options.method, "POST");
      assert.equal(options.body.get("client_id"), "instagram-app");
      assert.equal(options.body.get("client_secret"), "instagram-secret");
      assert.equal(options.body.get("redirect_uri"), "http://localhost:3000/api/auth/meta/instagram/callback");
      assert.equal(options.body.get("code"), "auth-code");
      return jsonResponse({ access_token: "short-ig-token", user_id: 12345 });
    }
    if (String(url).startsWith("https://graph.instagram.com/access_token")) {
      const requestUrl = new URL(url);
      assert.equal(requestUrl.searchParams.get("grant_type"), "ig_exchange_token");
      assert.equal(requestUrl.searchParams.get("client_secret"), "instagram-secret");
      assert.equal(requestUrl.searchParams.get("access_token"), "short-ig-token");
      return jsonResponse({ access_token: "long-ig-token" });
    }
    throw new Error(`Unexpected fetch URL: ${url}`);
  };

  const result = await metaAuth.exchangeInstagramCode("auth-code");

  assert.equal(result.accessToken, "long-ig-token");
  assert.equal(result.userId, "12345");
  assert.equal(calls.length, 2);
});

test("exchanges Threads auth code through Threads endpoints", async () => {
  process.env.META_APP_ID = "meta-app";
  process.env.META_APP_SECRET = "meta-secret";
  process.env.THREADS_APP_ID = "threads-app";
  process.env.THREADS_APP_SECRET = "threads-secret";
  process.env.META_REDIRECT_BASE_URL = "http://localhost:3000";

  const calls = [];
  global.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    if (String(url).startsWith("https://graph.threads.net/oauth/access_token")) {
      assert.equal(options.method, "POST");
      assert.equal(options.body.get("client_id"), "threads-app");
      assert.equal(options.body.get("client_secret"), "threads-secret");
      assert.equal(options.body.get("redirect_uri"), "http://localhost:3000/api/auth/meta/threads/callback");
      assert.equal(options.body.get("code"), "threads-code");
      return jsonResponse({ access_token: "short-threads-token" });
    }
    if (String(url).startsWith("https://graph.threads.net/access_token")) {
      const requestUrl = new URL(url);
      assert.equal(requestUrl.searchParams.get("grant_type"), "th_exchange_token");
      assert.equal(requestUrl.searchParams.get("access_token"), "short-threads-token");
      return jsonResponse({ access_token: "long-threads-token" });
    }
    throw new Error(`Unexpected fetch URL: ${url}`);
  };

  const token = await metaAuth.exchangeThreadsCode("threads-code");

  assert.equal(token, "long-threads-token");
  assert.equal(calls.length, 2);
});

test("falls back to short-lived tokens when exchange response has no long token", async () => {
  process.env.META_APP_ID = "meta-app";
  process.env.META_APP_SECRET = "meta-secret";

  global.fetch = async (url) => {
    if (String(url).startsWith("https://api.instagram.com/oauth/access_token")) {
      return jsonResponse({ access_token: "short-ig-token" });
    }
    if (String(url).startsWith("https://graph.instagram.com/access_token")) {
      return jsonResponse({});
    }
    throw new Error(`Unexpected fetch URL: ${url}`);
  };

  const result = await metaAuth.exchangeInstagramCode("auth-code");

  assert.equal(result.accessToken, "short-ig-token");
  assert.equal(result.userId, "");
});

test("throws provider error messages from failed Meta API responses", async () => {
  global.fetch = async () => jsonResponse({ error: { message: "Invalid OAuth redirect URI" } }, false, 400);

  await assert.rejects(
    () => metaAuth.getInstagramProfile("bad-token"),
    /Invalid OAuth redirect URI/
  );
});

test("fetches Instagram profile from graph.instagram.com", async () => {
  global.fetch = async (url) => {
    const requestUrl = new URL(url);
    assert.equal(requestUrl.origin, "https://graph.instagram.com");
    assert.equal(requestUrl.pathname, "/me");
    assert.equal(requestUrl.searchParams.get("fields"), "id,username,account_type");
    assert.equal(requestUrl.searchParams.get("access_token"), "ig-token");
    return jsonResponse({ id: "1789", username: "hextech.vs.cn", account_type: "BUSINESS" });
  };

  const profile = await metaAuth.getInstagramProfile("ig-token");

  assert.equal(profile.username, "hextech.vs.cn");
});

test("rejects Instagram profiles that do not match locale-specific expected usernames", () => {
  process.env.INSTAGRAM_ZH_EXPECTED_USERNAME = "hextech.vs.cn";
  process.env.INSTAGRAM_EN_EXPECTED_USERNAME = "hextech.vs";

  assert.doesNotThrow(() => {
    metaAuth.assertExpectedInstagramUsername("zh", "hextech.vs.cn");
    metaAuth.assertExpectedInstagramUsername("en", "hextech.vs");
  });

  assert.throws(
    () => metaAuth.assertExpectedInstagramUsername("zh", "hextech.vs"),
    /Expected Instagram zh account hextech\.vs\.cn, got hextech\.vs/
  );
});

test("rejects Threads profiles that do not match locale-specific expected usernames", () => {
  process.env.THREADS_ZH_EXPECTED_USERNAME = "hextech.vs.cn";
  process.env.THREADS_EN_EXPECTED_USERNAME = "hextech.vs";

  assert.doesNotThrow(() => {
    metaAuth.assertExpectedThreadsUsername("zh", "hextech.vs.cn");
    metaAuth.assertExpectedThreadsUsername("en", "@hextech.vs");
  });

  assert.throws(
    () => metaAuth.assertExpectedThreadsUsername("zh", "hextech.vs"),
    /Expected Threads zh account hextech\.vs\.cn, got hextech\.vs/
  );
});

test("fetches Threads profile from graph.threads.net", async () => {
  global.fetch = async (url) => {
    const requestUrl = new URL(url);
    assert.equal(requestUrl.origin, "https://graph.threads.net");
    assert.equal(requestUrl.pathname, "/v1.0/me");
    assert.equal(requestUrl.searchParams.get("fields"), "id,username");
    assert.equal(requestUrl.searchParams.get("access_token"), "threads-token");
    return jsonResponse({ id: "threads-1", username: "hextech.vs" });
  };

  const profile = await metaAuth.getThreadsProfile("threads-token");

  assert.equal(profile.id, "threads-1");
});

test("updates env files without duplicating keys", () => {
  const original = "A=1\nMETA_APP_SECRET=old\n";
  const next = metaAuth.upsertEnv(original, "META_APP_SECRET", "new");
  const appended = metaAuth.upsertEnv(next, "INSTAGRAM_ZH_USER_ID", "1789");

  assert.equal(next.match(/^META_APP_SECRET=/gm).length, 1);
  assert.match(next, /^META_APP_SECRET=new$/m);
  assert.match(appended, /^INSTAGRAM_ZH_USER_ID=1789$/m);
});

test("persists only non-empty env values to .env.local", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "hextech-tdd-"));
  const originalCwd = process.cwd();

  try {
    process.chdir(tempDir);
    metaAuth.persistEnv({
      INSTAGRAM_ZH_USER_ID: "1789",
      INSTAGRAM_ZH_ACCESS_TOKEN: "",
      THREADS_ZH_USER_ID: "threads-1",
    });

    const content = fs.readFileSync(path.join(tempDir, ".env.local"), "utf8");
    assert.match(content, /^INSTAGRAM_ZH_USER_ID=1789$/m);
    assert.match(content, /^THREADS_ZH_USER_ID=threads-1$/m);
    assert.doesNotMatch(content, /^INSTAGRAM_ZH_ACCESS_TOKEN=/m);
  } finally {
    process.chdir(originalCwd);
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
