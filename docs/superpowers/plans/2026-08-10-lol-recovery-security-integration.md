# LoL Recovery and Security Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. The user explicitly prohibited subagents, so execution is inline.

**Goal:** Integrate the rescued Daily/Leaguepedia WIP and all Player Radar commits onto current GitHub `main`, isolate queue writes from module-load working directories, and clear all 18 Dependabot alerts without touching the production queue.

**Architecture:** Work only on `codex/lol-recovery-security`, based on GitHub `main`. Fix path isolation before importing either local development line, merge the rescue snapshot and Player Radar history as separate gates, then make one coherent dependency update and run CI-equivalent plus real-render verification.

**Tech Stack:** Node.js 22 test runner, Next.js 16, Remotion 4, npm lockfile, Git worktrees, GitHub Actions.

## Global Constraints

- Do not use subagents.
- Do not run `publish:run`, `publish:due`, or `publish:scheduler`.
- Do not modify `/Users/cengweiting/Developer/lol-video-generator/.data/publish-queue.json`; hash it before and after every full verification batch.
- Preserve `rescue/2026-08-09-main-wip`, `codex/player-radar-dual-read`, and `/Users/cengweiting/Developer/lol-video-generator-rescue-20260809.PIixWe` until final deployment verification.
- Preserve GitHub parsing, mutation-API, shell-free rendering, compositor portability, CI, and licensed-media protections.
- Next.js must resolve to `16.3.0`; Sharp must be `>=0.35.0`; every PostCSS instance must be `>=8.5.18`; Undici must be `>=7.29.0` within major 7; fast-uri must be `>=3.1.5` within major 3.
- Keep the `npm audit --audit-level=high` CI gate unchanged.
- Every behavior fix follows one-test-at-a-time RED → GREEN → REFACTOR.

---

### Task 1: Isolate queue storage from module-load working directories

**Files:**
- Create: `tests/unit/publishing/queueIsolation.test.js`
- Modify: `utils/publishing/queueStore.js`

**Interfaces:**
- Consumes: existing `writeQueue()` and `readQueue()` APIs.
- Produces: `getDataDir(cwd?)` and `getQueuePath(cwd?)`; existing callers retain zero-argument behavior.

- [ ] **Step 1: Write one failing queue-path regression test**

```js
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "../../..");
const QUEUE_MODULE = path.join(ROOT, "utils/publishing/queueStore.js");

function clearPublishingModules() {
  ["utils/publishing/index.js", "utils/publishing/queueStore.js"].forEach((file) => {
    delete require.cache[path.join(ROOT, file)];
  });
}

test("queue storage follows the active project after the module was loaded elsewhere", () => {
  const originalCwd = process.cwd();
  const loadedFrom = fs.mkdtempSync(path.join(os.tmpdir(), "hvs-queue-loaded-"));
  const activeProject = fs.mkdtempSync(path.join(os.tmpdir(), "hvs-queue-active-"));

  try {
    process.chdir(loadedFrom);
    clearPublishingModules();
    const { writeQueue, readQueue } = require(QUEUE_MODULE);
    process.chdir(activeProject);

    writeQueue([{ id: "active-project-job", status: "QUEUED" }]);

    assert.equal(fs.existsSync(path.join(loadedFrom, ".data", "publish-queue.json")), false);
    assert.deepEqual(readQueue(), [{ id: "active-project-job", status: "QUEUED" }]);
    assert.deepEqual(
      JSON.parse(fs.readFileSync(path.join(activeProject, ".data", "publish-queue.json"), "utf8")),
      [{ id: "active-project-job", status: "QUEUED" }],
    );
  } finally {
    process.chdir(originalCwd);
    clearPublishingModules();
    fs.rmSync(loadedFrom, { recursive: true, force: true });
    fs.rmSync(activeProject, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: Run only the new test and verify RED**

Run:

```bash
node --test tests/unit/publishing/queueIsolation.test.js
```

Expected: FAIL because `loadedFrom/.data/publish-queue.json` exists and the active project's queue does not.

- [ ] **Step 3: Resolve queue paths at operation time**

Replace module-load constants in `utils/publishing/queueStore.js` with:

```js
function getDataDir(cwd = process.cwd()) {
  return path.join(cwd, ".data");
}

function getQueuePath(cwd = process.cwd()) {
  return path.join(getDataDir(cwd), "publish-queue.json");
}

function ensureDataDir() {
  fs.mkdirSync(getDataDir(), { recursive: true });
}
```

Use `const queuePath = getQueuePath()` inside each `readQueue()` and `writeQueue()` call. Export `getDataDir` and `getQueuePath`. Preserve the existing `DATA_DIR` and `QUEUE_PATH` names as enumerable getters on the exported API so existing consumers receive the current path when accessing them.

- [ ] **Step 4: Run the focused test and verify GREEN**

```bash
node --test tests/unit/publishing/queueIsolation.test.js
```

Expected: 1 pass, 0 failures.

- [ ] **Step 5: Refactor only naming and rerun the focused test**

Keep path resolution in the two helpers, keep queue JSON behavior unchanged, and rerun the same command with 1 pass.

### Task 2: Isolate publish-package storage from module-load directories

**Files:**
- Modify: `tests/unit/publishing/queueIsolation.test.js`
- Modify: `utils/publishing/index.js`

**Interfaces:**
- Consumes: Task 1 dynamic queue path.
- Produces: `getPublishPackageRoot(cwd?)`, used by `writePublishPackage()`.

- [ ] **Step 1: Add one failing publish-package regression test**

```js
test("publish packages follow the active project after the module was loaded elsewhere", async () => {
  const originalCwd = process.cwd();
  const loadedFrom = fs.mkdtempSync(path.join(os.tmpdir(), "hvs-package-loaded-"));
  const activeProject = fs.mkdtempSync(path.join(os.tmpdir(), "hvs-package-active-"));

  try {
    process.chdir(loadedFrom);
    clearPublishingModules();
    const { createPublishJobs } = require(path.join(ROOT, "utils/publishing/index.js"));
    process.chdir(activeProject);
    const videoPath = path.join(activeProject, "public", "renders", "clip.mp4");
    fs.mkdirSync(path.dirname(videoPath), { recursive: true });
    fs.writeFileSync(videoPath, "fake video");

    const result = await createPublishJobs({
      videoUrl: "/renders/clip.mp4",
      analysis: { dataType: "PATCH", championName: "Quinn" },
      platforms: ["instagram"],
      action: "queue",
    });

    assert.equal(fs.existsSync(path.join(loadedFrom, "public", "publish-packages")), false);
    assert.equal(result.jobs.length, 1);
    assert.equal(result.jobs[0].package.dir.startsWith(activeProject), true);
    assert.equal(fs.existsSync(path.join(activeProject, "public", "publish-packages", result.jobs[0].id, "manifest.json")), true);
  } finally {
    process.chdir(originalCwd);
    clearPublishingModules();
    fs.rmSync(loadedFrom, { recursive: true, force: true });
    fs.rmSync(activeProject, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: Run the test file and verify exactly one new RED**

```bash
node --test tests/unit/publishing/queueIsolation.test.js
```

Expected: queue test passes; package test fails because the package directory is created under `loadedFrom`.

- [ ] **Step 3: Resolve the package root at write time**

In `utils/publishing/index.js` replace `PACKAGE_ROOT` with:

```js
function getPublishPackageRoot(cwd = process.cwd()) {
  return path.join(cwd, "public", "publish-packages");
}
```

Inside `writePublishPackage(task)`, calculate `const packageRoot = getPublishPackageRoot()` and use it for `mkdirSync` and the task directory.

- [ ] **Step 4: Verify both focused tests GREEN**

```bash
node --test tests/unit/publishing/queueIsolation.test.js
```

Expected: 2 passes, 0 failures.

- [ ] **Step 5: Run the existing publishing test files**

```bash
node --test tests/unit/publishing/index.test.js tests/unit/publishing/insights.test.js tests/unit/apiBoundaryContracts.test.js
```

Expected: all tests pass and the integration worktree receives no `.data/publish-queue.json`.

- [ ] **Step 6: Commit the isolation fix**

```bash
git add tests/unit/publishing/queueIsolation.test.js utils/publishing/queueStore.js utils/publishing/index.js
git commit -m "fix: isolate publish queue storage per project"
```

### Task 3: Integrate the rescued 34-path WIP

**Files:**
- Merge source: `rescue/2026-08-09-main-wip`
- Expected overlapping paths: `app/page.jsx`, `tests/unit/publishing/copy.test.js`, `utils/leaguepediaApi.js`, `utils/publishing/copy.js`, and the already-agreed audio deletions.
- New WIP paths include: `app/api/esports/daily-one-click/route.js`, `utils/esports/apiErrors.js`, `utils/esports/dailyOneClick.js`, `utils/esports/sourceCooldown.js`, and their tests.

**Interfaces:**
- Consumes: GitHub security baseline and Tasks 1–2 isolation behavior.
- Produces: integrated Daily/Leaguepedia/copy/caption/UI behavior without losing remote protections.

- [ ] **Step 1: Record pre-merge evidence**

```bash
git status --short --branch
git rev-parse HEAD
git diff --name-only ff13c13c86b044d189f42076a162df713567922b..rescue/2026-08-09-main-wip
```

Expected: clean integration branch and 34 rescue paths.

- [ ] **Step 2: Start a no-commit merge**

```bash
git merge --no-ff --no-commit rescue/2026-08-09-main-wip
git diff --name-only --diff-filter=U
```

Keep GitHub's production mutation, portfolio, parsing, and licensing changes. Reapply the rescued UI and publishing behavior around those guards. Keep the three audio files deleted. If an unmerged path falls outside the listed overlap, inspect both complete file versions and document why before resolving it.

- [ ] **Step 3: Verify conflict markers and security contracts**

```bash
if rg -n '^(<<<<<<<|=======|>>>>>>>)' app src utils tests; then exit 1; else test "$?" = 1; fi
node --test \
  tests/unit/apiBoundaryContracts.test.js \
  tests/unit/pipelinePruningStatic.test.js \
  tests/unit/portfolioPresentation.test.js \
  tests/unit/publishing/copy.test.js \
  tests/unit/render/captionHighlight.test.js
```

Expected: no conflict markers and all selected tests pass.

- [ ] **Step 4: Verify rescued WIP behavior**

```bash
node --test \
  tests/unit/esports/api.test.js \
  tests/unit/esports/apiErrors.test.js \
  tests/unit/esports/candidates.test.js \
  tests/unit/esports/config.test.js \
  tests/unit/esports/dailyOneClick.test.js \
  tests/unit/esports/sourceCooldown.test.js \
  tests/unit/leaguepediaApiCooldown.test.js \
  tests/unit/metaFactory/workbenchStatic.test.js \
  tests/unit/publishing/copy.test.js \
  tests/unit/render/captionHighlight.test.js
```

Expected: all selected tests pass.

- [ ] **Step 5: Commit the rescue merge**

```bash
git add -A
git commit -m "merge: integrate rescued Daily and Leaguepedia work"
```

### Task 4: Integrate all Player Radar commits

**Files:**
- Merge source: `codex/player-radar-dual-read`
- Radar-specific paths: `utils/esports/playerRadarEvidence.js`, `utils/esports/playerRadarRunner.js`, `src/templates/playerRadarHelpers.js`, `src/templates/Template_PlayerRadar.jsx`, and their API/render/publishing tests.
- Shared security paths: `app/api/analyze/route.js`, `src/schemas/pipelineSchemas.js`, `utils/render/renderService.js`, `tests/unit/apiBoundaryContracts.test.js`, and `tests/unit/render/renderService.test.js`.
- Shared queue path: `utils/publishing/index.js` must retain Task 2's dynamic package root.

**Interfaces:**
- Consumes: integrated WIP plus queue isolation.
- Produces: full Player Radar dual-read behavior with GitHub security hardening retained.

- [ ] **Step 1: Start the Player Radar no-commit merge**

```bash
git merge --no-ff --no-commit codex/player-radar-dual-read
git diff --name-only --diff-filter=U
```

Resolve shared files by preserving remote security controls first, then adding Radar-specific schema, evidence, rendering, and UI behavior. Keep `getPublishPackageRoot()` and dynamic queue helpers. Do not choose an entire side for `app/page.jsx`, `utils/publishing/copy.js`, `utils/leaguepediaApi.js`, or `utils/render/renderService.js`.

- [ ] **Step 2: Verify no merge artifacts**

```bash
if rg -n '^(<<<<<<<|=======|>>>>>>>)' app src utils tests; then exit 1; fi
git diff --check
```

Expected: no conflict markers or whitespace errors.

- [ ] **Step 3: Run the Player Radar contract set**

```bash
node --test \
  tests/unit/apiBoundaryContracts.test.js \
  tests/unit/esports/playerRadarRoute.test.js \
  tests/unit/esports/playerRadarRunner.test.js \
  tests/unit/esports/seriesAggregator.test.js \
  tests/unit/pipelinePruningStatic.test.js \
  tests/unit/pipelineRegistry.test.js \
  tests/unit/publishing/copy.test.js \
  tests/unit/publishing/index.test.js \
  tests/unit/publishing/publishRoute.test.js \
  tests/unit/render/compositionScope.test.js \
  tests/unit/render/renderService.test.js
```

Expected: all selected tests pass and no publish queue appears in the integration worktree root.

- [ ] **Step 4: Commit the Player Radar merge**

```bash
git add -A
git commit -m "merge: integrate Player Radar dual-read history"
```

### Task 5: Clear all dependency security findings as one lockfile unit

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Consumes: GitHub alert patch floors and the integrated application.
- Produces: one coherent dependency graph that passes the unchanged high-severity audit gate.

- [ ] **Step 1: Verify the security gate is RED before changing dependencies**

```bash
npm audit --audit-level=high
```

Expected: non-zero exit with current high-severity findings involving Next/Sharp/PostCSS/Undici/fast-uri ancestry.

- [ ] **Step 2: Apply the minimum compatible graph update**

Remove this block from `package.json`:

```json
"overrides": {
  "postcss": "8.5.10"
}
```

Then run:

```bash
npm install 'next@^16.3.0' --save
npm update undici fast-uri
```

- [ ] **Step 3: Assert every patched version floor**

```bash
node - <<'NODE'
const lock = require('./package-lock.json');
const versions = Object.entries(lock.packages)
  .filter(([path]) => /node_modules\/(next|sharp|postcss|undici|fast-uri)$/.test(path))
  .map(([path, value]) => `${path} ${value.version}`);
console.log(versions.join('\n'));
if (!versions.some((line) => /node_modules\/next 16\.3\.0$/.test(line))) process.exit(1);
if (!versions.some((line) => /node_modules\/sharp 0\.35\.[3-9]/.test(line))) process.exit(1);
if (versions.some((line) => /node_modules\/postcss 8\.5\.(?:[0-9]|1[0-7])$/.test(line))) process.exit(1);
if (versions.some((line) => /node_modules\/undici 7\.(?:[0-9]|1[0-9]|2[0-8])\./.test(line))) process.exit(1);
if (versions.some((line) => /node_modules\/fast-uri 3\.1\.[0-4]$/.test(line))) process.exit(1);
NODE
```

Expected: Next `16.3.0`, Sharp `0.35.3`, PostCSS `>=8.5.18`, Undici `7.29.0`, and fast-uri `3.1.5` or later within major 3.

- [ ] **Step 4: Verify the unchanged security gate GREEN**

```bash
npm audit --audit-level=high
```

Expected: exit 0 with zero high-severity vulnerabilities.

- [ ] **Step 5: Verify framework and render-sensitive tests**

```bash
node --test tests/unit/apiBoundaryContracts.test.js tests/unit/render/compositionScope.test.js tests/unit/render/renderService.test.js
npx next build
```

Expected: tests and build pass.

- [ ] **Step 6: Commit the dependency graph**

```bash
git add package.json package-lock.json
git commit -m "fix: update vulnerable runtime dependencies"
```

### Task 6: Product checkpoint and complete local verification

**Files:**
- No source edits unless a new failure is first reproduced by a focused test.

**Interfaces:**
- Consumes: all previous tasks.
- Produces: evidence that the integrated product, queue boundary, build, audit, and render work together.

- [ ] **Step 1: Deliver the nine-field product-owner checkpoint**

Explain product capability, user experience, technical components, data flow, design reason, alternatives, security and cost, test evidence, and remaining limits before the full verification batch.

- [ ] **Step 2: Hash the production queue and run CI-equivalent checks**

```bash
PRODUCTION_QUEUE=/Users/cengweiting/Developer/lol-video-generator/.data/publish-queue.json
BEFORE=$(shasum -a 256 "$PRODUCTION_QUEUE")
npm run tdd:doctor
npm run test:coverage
npx next build
npm audit --audit-level=high
AFTER=$(shasum -a 256 "$PRODUCTION_QUEUE")
test "$BEFORE" = "$AFTER"
```

Expected: every command exits 0 and the queue hashes are identical.

- [ ] **Step 3: Run image and MP4 render verification**

```bash
npm run qa:render
npx remotion render src/index.jsx PlayerRadarVideo /tmp/lol-recovery-player-radar.mp4 --codec=h264 --frames=0-89 --timeout=90000
test "$(stat -f%z /tmp/lol-recovery-player-radar.mp4)" -gt 25000
```

Expected: six QA stills and a non-empty Player Radar H.264 MP4.

- [ ] **Step 4: Verify repository scope**

```bash
git diff --check origin/main...HEAD
git status --short --branch
git log --oneline --decorate origin/main..HEAD
```

Expected: only approved integration, queue-isolation, dependency, plan, and handoff changes.

### Task 7: Publish safely and verify GitHub

**Files:**
- Modify: `HANDOFF.md`
- Modify: `STATUS.md`

**Interfaces:**
- Consumes: fully verified branch.
- Produces: remote review evidence, green CI, updated Dependabot state, and a safe handoff without changing the dirty root worktree.

- [ ] **Step 1: Record final state in handoff documents**

Document the integration commits, queue-isolation contract, dependency versions, exact verification commands, production queue hash, remaining missing-video limitation, and the untouched root rescue branch.

- [ ] **Step 2: Commit handoff evidence**

```bash
git add HANDOFF.md STATUS.md
git commit -m "docs: record LoL recovery verification"
```

- [ ] **Step 3: Push the integration branch and open a ready PR**

```bash
git push -u origin codex/lol-recovery-security
gh pr create --base main --head codex/lol-recovery-security --title "fix: recover LoL work and clear security alerts" --body-file docs/superpowers/specs/2026-08-10-lol-recovery-security-integration-design.md
```

- [ ] **Step 4: Wait for and inspect GitHub Actions**

```bash
gh pr checks --watch
```

If a GitHub Actions check fails, inspect its run and logs with the bundled `gh-fix-ci` workflow; do not rerun blindly.

- [ ] **Step 5: Merge only after green CI**

Use the repository's permitted merge method, then verify GitHub `main` contains the integration head. Do not switch, reset, clean, or overwrite the original dirty root worktree.

- [ ] **Step 6: Recount Dependabot alerts with calibrated pagination**

Count open alerts once with `per_page=1` plus pagination and again with `per_page=100`. The two counts must agree. If alerts remain, list their package and detected lockfile version instead of claiming resolution.

- [ ] **Step 7: Verify the production deployment path**

If the repository has an existing production deployment, use its existing URL and verify it opens without critical console/server errors plus the protected core flow. If no production deployment exists, report that explicitly and stop after remote `main` verification.
