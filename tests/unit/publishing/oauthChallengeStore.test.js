const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { createOAuthChallenge, consumeOAuthChallenge } = require("../../../utils/publishing/oauthChallengeStore");

test("OAuth challenge stores only a hash of a 256-bit random nonce", () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "hvs-oauth-"));
  const nonce = Buffer.alloc(32, 7);
  const challenge = createOAuthChallenge({
    platform: "instagram", locale: "zh", cwd,
    now: () => new Date("2026-09-05T00:00:00.000Z"),
    randomBytesImpl: () => nonce,
  });
  const storePath = path.join(cwd, ".data", "meta-oauth-challenges.json");
  const raw = fs.readFileSync(storePath, "utf8");
  const store = JSON.parse(raw);

  assert.match(challenge.state, /^instagram\.zh\.[A-Za-z0-9_-]{43}$/);
  assert.equal(raw.includes(nonce.toString("base64url")), false);
  assert.match(store.challenges[0].nonceHash, /^[a-f0-9]{64}$/);
  assert.equal(fs.statSync(storePath).mode & 0o777, 0o600);
  assert.equal(challenge.expiresAt, "2026-09-05T00:10:00.000Z");
});

test("OAuth challenge can be consumed once after a process-style reload", () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "hvs-oauth-"));
  const now = () => new Date("2026-09-05T00:01:00.000Z");
  const { state } = createOAuthChallenge({
    platform: "threads", locale: "zh", cwd, now,
    randomBytesImpl: () => Buffer.alloc(32, 11),
  });

  assert.deepEqual(consumeOAuthChallenge(state, { platform: "threads", cwd, now }), {
    platform: "threads", locale: "zh",
  });
  assert.throws(
    () => consumeOAuthChallenge(state, { platform: "threads", cwd, now }),
    (error) => error.code === "OAUTH_STATE_REPLAYED"
  );
});

test("OAuth challenge rejects malformed, cross-platform, and expired states", () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "hvs-oauth-"));
  const created = createOAuthChallenge({
    platform: "instagram", locale: "en", cwd,
    now: () => new Date("2026-09-05T00:00:00.000Z"),
    randomBytesImpl: () => Buffer.alloc(32, 13),
  });
  assert.throws(
    () => consumeOAuthChallenge("instagram.en.bad", { platform: "instagram", cwd }),
    (error) => error.code === "OAUTH_STATE_INVALID"
  );
  assert.throws(
    () => consumeOAuthChallenge(created.state, { platform: "threads", cwd }),
    (error) => error.code === "OAUTH_STATE_PLATFORM_INVALID"
  );
  assert.throws(
    () => consumeOAuthChallenge(created.state, {
      platform: "instagram", cwd, now: () => new Date("2026-09-05T00:10:00.000Z"),
    }),
    (error) => error.code === "OAUTH_STATE_EXPIRED"
  );
});
