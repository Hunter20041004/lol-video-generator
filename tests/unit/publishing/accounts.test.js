const test = require("node:test");
const assert = require("node:assert/strict");

const {
  normalizeLocale,
  localeSuffix,
  getInstagramConfig,
  getThreadsConfig,
  getPublicVideoUrl,
} = require("../../../utils/publishing/accounts");

const ORIGINAL_ENV = { ...process.env };

function resetEnv() {
  process.env = { ...ORIGINAL_ENV };
}

test.afterEach(resetEnv);

test("normalizes account locales into the two supported account sets", () => {
  assert.equal(normalizeLocale("zh"), "zh");
  assert.equal(normalizeLocale("zh-TW"), "zh");
  assert.equal(normalizeLocale("en"), "en");
  assert.equal(normalizeLocale("EN-US"), "en");
  assert.equal(localeSuffix("en-US"), "EN");
});

test("reads locale-specific Instagram and Threads credentials before global fallbacks", () => {
  process.env.INSTAGRAM_USER_ID = "ig-global";
  process.env.INSTAGRAM_ZH_USER_ID = "ig-zh";
  process.env.INSTAGRAM_EN_USER_ID = "ig-en";
  process.env.THREADS_ALLOW_TEXT_ONLY = "true";

  assert.equal(getInstagramConfig("zh").userId, "ig-zh");
  assert.equal(getInstagramConfig("en").userId, "ig-en");
  assert.equal(getThreadsConfig("zh").allowTextOnly, true);
});

test("publishing account module exposes only Instagram and Threads account readers", () => {
  const accounts = require("../../../utils/publishing/accounts");

  assert.equal(Object.hasOwn(accounts, "getInstagramConfig"), true);
  assert.equal(Object.hasOwn(accounts, "getThreadsConfig"), true);
  assert.equal(Object.hasOwn(accounts, "getYouTubeConfig"), false);
  assert.equal(Object.hasOwn(accounts, "getTikTokConfig"), false);
});

test("returns empty public video URL when no public base or video path is available", () => {
  delete process.env.PUBLIC_MEDIA_BASE_URL;
  delete process.env.NEXT_PUBLIC_MEDIA_BASE_URL;

  assert.equal(getPublicVideoUrl("/renders/video.mp4"), "");
  assert.equal(getPublicVideoUrl(""), "");
});

test("builds public video URLs from local render paths without double slashes", () => {
  process.env.PUBLIC_MEDIA_BASE_URL = "https://cdn.hextech.test/videos/";

  assert.equal(
    getPublicVideoUrl("/renders/video.mp4"),
    "https://cdn.hextech.test/videos/renders/video.mp4"
  );
  assert.equal(
    getPublicVideoUrl("https://already-public.test/video.mp4"),
    "https://already-public.test/video.mp4"
  );
});
