const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { loadProjectEnv } = require("../../utils/envLoader");

const ORIGINAL_ENV = { ...process.env };

function tempProject() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "hextech-env-"));
}

function resetEnv() {
  process.env = { ...ORIGINAL_ENV };
}

test.afterEach(resetEnv);

test("loads .env.local before .env so local publishing credentials win", () => {
  const cwd = tempProject();
  delete process.env.THREADS_ZH_ACCESS_TOKEN;
  delete process.env.THREADS_EN_ACCESS_TOKEN;

  fs.writeFileSync(path.join(cwd, ".env"), "THREADS_ZH_ACCESS_TOKEN=base-token\nTHREADS_EN_ACCESS_TOKEN=en-token\n");
  fs.writeFileSync(path.join(cwd, ".env.local"), "THREADS_ZH_ACCESS_TOKEN=local-token\n");

  const loaded = loadProjectEnv({ cwd });

  assert.deepEqual(loaded, [".env.local", ".env"]);
  assert.equal(process.env.THREADS_ZH_ACCESS_TOKEN, "local-token");
  assert.equal(process.env.THREADS_EN_ACCESS_TOKEN, "en-token");
});

test("keeps explicit process env values unless override is requested", () => {
  const cwd = tempProject();
  process.env.INSTAGRAM_ZH_USER_ID = "shell-value";
  fs.writeFileSync(path.join(cwd, ".env.local"), "INSTAGRAM_ZH_USER_ID=file-value\n");

  loadProjectEnv({ cwd });

  assert.equal(process.env.INSTAGRAM_ZH_USER_ID, "shell-value");
});

test("can override existing process env values when explicitly requested", () => {
  const cwd = tempProject();
  process.env.INSTAGRAM_ZH_USER_ID = "shell-value";
  fs.writeFileSync(path.join(cwd, ".env.local"), "INSTAGRAM_ZH_USER_ID=file-value\n");

  loadProjectEnv({ cwd, override: true });

  assert.equal(process.env.INSTAGRAM_ZH_USER_ID, "file-value");
});
