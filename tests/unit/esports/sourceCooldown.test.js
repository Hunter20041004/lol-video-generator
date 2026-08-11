const fs = require("fs");
const os = require("os");
const path = require("path");
const test = require("node:test");
const assert = require("node:assert/strict");

const modulePath = path.join(__dirname, "../../../utils/esports/sourceCooldown.js");

function loadWithCwd(cwd) {
  delete require.cache[require.resolve(modulePath)];
  const originalCwd = process.cwd();
  process.chdir(cwd);
  return {
    cooldown: require(modulePath),
    restore() {
      process.chdir(originalCwd);
      delete require.cache[require.resolve(modulePath)];
    },
  };
}

test("source cooldown persists active records across module reloads", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hvs-source-cooldown-"));
  const nowMs = Date.parse("2026-07-07T18:00:00.000Z");
  const laterMs = Date.parse("2026-07-07T18:01:00.000Z");
  const firstLoad = loadWithCwd(dir);

  try {
    firstLoad.cooldown.recordSourceCooldown("leaguepedia", {
      cooldownMs: 15 * 60 * 1000,
      nowMs,
      reason: "rate_limit",
    });
  } finally {
    firstLoad.restore();
  }

  const secondLoad = loadWithCwd(dir);
  try {
    const cooldown = secondLoad.cooldown.readSourceCooldown("leaguepedia", { nowMs: laterMs });
    assert.equal(cooldown.active, true);
    assert.equal(cooldown.reason, "rate_limit");
    assert.equal(cooldown.retryAfterSeconds, 14 * 60);
    assert.equal(
      fs.existsSync(path.join(dir, ".data", "esports-source-cooldowns.json")),
      true
    );
  } finally {
    secondLoad.restore();
  }
});

test("source cooldown escalates default wait after repeated rate-limit hits", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hvs-source-cooldown-"));
  const firstHitMs = Date.parse("2026-07-07T18:00:00.000Z");
  const secondHitMs = Date.parse("2026-07-07T18:16:00.000Z");
  const loaded = loadWithCwd(dir);

  try {
    const first = loaded.cooldown.recordSourceCooldown("leaguepedia", {
      nowMs: firstHitMs,
      reason: "rate_limit",
    });
    const afterFirstExpiry = loaded.cooldown.readSourceCooldown("leaguepedia", {
      nowMs: secondHitMs,
    });
    const second = loaded.cooldown.recordSourceCooldown("leaguepedia", {
      nowMs: secondHitMs,
      reason: "rate_limit",
    });

    assert.equal(first.retryAfterSeconds, 15 * 60);
    assert.equal(afterFirstExpiry.active, false);
    assert.equal(second.retryAfterSeconds, 60 * 60);
    assert.equal(second.attempts, 2);
  } finally {
    loaded.restore();
  }
});
