const test = require("node:test");
const assert = require("node:assert/strict");
const { execFileSync, spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "../..");
const removedDataTypes = ["PRO_BUILD", "TIER_LIST", "TFT_INFO", "ESPORTS_DRAMA"];

const runtimeFiles = [
  "app/api/analyze/route.js",
  "app/api/content-factory/preview/route.js",
  "app/api/content-factory/publish/route.js",
  "app/page.jsx",
  "src/schemas/pipelineSchemas.js",
  "utils/jsonExtraction.js",
  "utils/pipelinePrompts.js",
  "utils/publishing/copy.js",
  "utils/render/renderService.js",
];

test("runtime files do not retain removed pipeline dataTypes", () => {
  for (const file of runtimeFiles) {
    const source = fs.readFileSync(path.join(ROOT, file), "utf8");
    for (const dataType of removedDataTypes) {
      assert.equal(source.includes(dataType), false, `${file} should not reference ${dataType}`);
    }
  }
});

test("removed pipeline API route directories are deleted", () => {
  assert.equal(fs.existsSync(path.join(ROOT, "app/api/tier-list")), false);
  assert.equal(fs.existsSync(path.join(ROOT, "app/api/auto-publish")), false);
  assert.equal(fs.existsSync(path.join(ROOT, "app/api/pro-builds")), false);
  assert.equal(fs.existsSync(path.join(ROOT, "app/api/auth/google")), false);
  assert.equal(fs.existsSync(path.join(ROOT, "app/api/cron/check-matches")), false);
  assert.equal(fs.existsSync(path.join(ROOT, "app/api/webhooks/match-end")), false);
});

test("removed publishing platforms are absent from runtime entrypoints", () => {
  const files = [
    "app/api/publish/route.js",
    "config/social_accounts.json",
    "scripts/publishQueue.js",
    "scripts/qaRender.js",
    "utils/publishing/copy.js",
  ];
  const removedPlatformPatterns = [/youtube/i, /tiktok/i];

  for (const file of files) {
    const source = fs.readFileSync(path.join(ROOT, file), "utf8");
    for (const pattern of removedPlatformPatterns) {
      assert.equal(pattern.test(source), false, `${file} should not reference ${pattern}`);
    }
  }
});

test("removed platform adapters and retired parser modules are deleted", () => {
  [
    "utils/publishing/adapters/youtube.js",
    "utils/publishing/adapters/tiktok.js",
    "src/parsers/ProBuildParser.js",
    "src/parsers/ProBuildsScanner.js",
    "src/parsers/MetaScanner.js",
    "src/components/tft",
    "utils/autoDispatcher.js",
  ].forEach((relativePath) => {
    assert.equal(fs.existsSync(path.join(ROOT, relativePath)), false, `${relativePath} should be removed`);
  });
});

test("package does not expose worker commands whose entrypoint cannot resolve", () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
  const workerScripts = ["worker", "worker:now", "worker:dry"]
    .filter((name) => Object.hasOwn(pkg.scripts, name));

  const failures = workerScripts.map((name) => {
    const result = spawnSync(process.execPath, [path.join(ROOT, "worker.js"), "--help"], {
      cwd: ROOT,
      encoding: "utf8",
    });
    assert.notEqual(result.status, 0, `${name} unexpectedly resolved`);
    assert.match(result.stderr, /Cannot find module ['"]\.\/utils\/autoDispatcher['"]/);
    return name;
  });

  assert.deepEqual(failures, [], `remove broken package scripts: ${failures.join(", ")}`);
  assert.equal(fs.existsSync(path.join(ROOT, "worker.js")), false, "delete the broken worker entrypoint");
});

test("orphan scheduler that depends on retired pipeline modules is deleted", () => {
  const schedulerPath = path.join(ROOT, "scheduler.js");
  const schedulerExists = fs.existsSync(schedulerPath);
  const scheduler = schedulerExists ? fs.readFileSync(schedulerPath, "utf8") : "";
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
  const runtimeFiles = execFileSync("git", ["ls-files", "-z", "*.js", "*.jsx"], { cwd: ROOT })
    .toString("utf8")
    .split("\0")
    .filter((file) => file && file !== "scheduler.js" && !file.startsWith("tests/"))
    .filter((file) => fs.existsSync(path.join(ROOT, file)));
  const runtimeConsumers = runtimeFiles.filter((file) => (
    /(?:require\(|from |import\()["'][^"']*scheduler(?:\.js)?["']/.test(
      fs.readFileSync(path.join(ROOT, file), "utf8"),
    )
  ));

  if (schedulerExists) {
    assert.match(scheduler, /src\/parsers\/MetaScanner/);
    assert.match(scheduler, /utils\/autoDispatcher/);
  }
  assert.equal(Object.values(pkg.scripts).some((command) => /(?:^|\s)scheduler\.js(?:\s|$)/.test(command)), false);
  assert.deepEqual(runtimeConsumers, []);
  assert.equal(schedulerExists, false, "delete scheduler.js instead of restoring retired modules");
});

test("package does not directly depend on a platform-specific Remotion compositor", () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
  const directDependencies = Object.keys({
    ...pkg.dependencies,
    ...pkg.devDependencies,
    ...pkg.optionalDependencies,
  });

  assert.deepEqual(
    directDependencies.filter((name) => name.startsWith("@remotion/compositor-")),
    [],
  );
});
