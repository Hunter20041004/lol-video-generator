const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "../..");

test("public setup documents only retained social publishers", () => {
  const env = fs.readFileSync(path.join(ROOT, ".env.example"), "utf8");
  const readme = fs.readFileSync(path.join(ROOT, "README.md"), "utf8");
  const publishingGuide = fs.readFileSync(
    path.join(ROOT, "docs/publishing-setup.md"),
    "utf8",
  );
  for (const stale of ["YOUTUBE_", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "TIKTOK_"]) {
    assert.equal(env.includes(stale), false, stale);
    assert.equal(publishingGuide.includes(stale), false, stale);
  }
  assert.equal(/YouTube API|TikTok Content Posting API/.test(readme), false);
  assert.equal(/YouTube|TikTok/.test(publishingGuide), false);
  assert.match(env, /^GEMINI_API_KEY=/m);
  assert.match(readme, /Google Generative AI/);
  assert.match(readme, /Instagram \/ Threads/);
  assert.match(readme, /Executive Summary/);
});
