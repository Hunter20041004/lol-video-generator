# LoL Reliability and Lightweight Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. The project owner explicitly prohibited subagents for this work.

**Goal:** Reduce AI fallback latency, remove build and GitHub runtime warnings, self-host fonts, move Player Radar evidence into the opening second, and remove only proven dead runtime weight.

**Architecture:** Put Google GenAI behind a small injectable request boundary, confine filesystem operations before allowing runtime access, and share tracked font assets between Next.js and Remotion. Preserve all existing schemas and publishing boundaries. Treat cleanup as a reachability-driven refactor: move test-only data into tests, delete entrypoint-free modules one vertical slice at a time, and keep portfolio/history assets.

**Tech Stack:** Node.js 22, Next.js 16.3, React 19, Remotion 4.0.489, `@google/genai`, Node test runner, Playwright CLI, GitHub Actions.

## Global Constraints

- Do not use subagents.
- Do not run social publishing commands or create queue/daily-run records.
- Do not modify ignored `.data`, `.env*`, `.worktrees`, rescue refs, external rescue directories, or licensed MP3 files.
- Keep Node 22 for application CI and Remotion `4.0.489`.
- Keep `npm audit --audit-level=high`, line coverage, branch coverage, and function coverage at 80% or higher.
- Every behavior change uses one-test-at-a-time RED → GREEN → REFACTOR.
- Preserve portfolio MP4/PNG, PRDs, specs, plans, licensing records, and GitHub-facing evidence.

---

### Task 1: Isolated baseline and data-safety snapshot

**Files:**
- No production file changes.
- Read: `HANDOFF.md`, `.gitignore`, `.data/patch-content-db.json` when present.

**Interfaces:**
- Produces: isolated branch `codex/reliability-lightweight` at `.worktrees/reliability-lightweight`.
- Produces: baseline Git status, content DB SHA-256, queue count, daily-run count, test result, build-warning count.

- [ ] **Step 1: Verify the main checkout is clean and normal**

Run:

```bash
git status --short
git rev-parse --git-dir
git rev-parse --git-common-dir
git branch --show-current
git check-ignore -q .worktrees
```

Expected: no status output, normal main checkout, branch `main`, `.worktrees` ignored.

- [ ] **Step 2: Create the isolated worktree**

Run:

```bash
git worktree add .worktrees/reliability-lightweight -b codex/reliability-lightweight
```

Expected: branch created from the committed design and plan.

- [ ] **Step 3: Install the locked baseline**

Run from the new worktree:

```bash
npm ci
```

Expected: exit 0 and 0 vulnerabilities.

- [ ] **Step 4: Record data and warning baselines**

Run:

```bash
test -f .data/patch-content-db.json && shasum -a 256 .data/patch-content-db.json || true
test -f .data/publish-queue.json && node -e 'console.log(require("./.data/publish-queue.json").length)' || echo 0
test -f .data/esports-daily-runs.json && node -e 'console.log(require("./.data/esports-daily-runs.json").runs?.length || 0)' || echo 0
npm test -- --test-reporter=spec
npx next build 2>&1 | tee /tmp/lol-reliability-baseline-build.log
rg -c 'Dynamic filesystem access causes tracing' /tmp/lol-reliability-baseline-build.log
```

Expected: tests exit 0; build exits 0; warning count is exactly 2; isolated worktree runtime counts are 0.

---

### Task 2: Native GenAI timeout and single-attempt fallback

**Files:**
- Create: `utils/genaiClient.js`
- Create: `tests/unit/genaiClient.test.js`
- Modify: `reasoning.js`
- Modify: `package.json`
- Modify: `package-lock.json`
- Delete: `scripts/manageCache.js`
- Modify: `config/tdd-coverage.json`

**Interfaces:**
- Produces: `normalizeModelTimeoutMs(value): number` clamped to 1,000–60,000 with default 30,000.
- Produces: `generateModelText({ apiKey, model, prompt, timeoutMs, clientFactory }): Promise<string>`.
- Consumes: `clientFactory(options)` returning `{ models.generateContent(request) }`; production defaults to `new GoogleGenAI(options)`.

- [ ] **Step 1: RED — default timeout is 30 seconds and passed to the SDK request**

Add one test that calls the wished-for `generateModelText` with an injected client, captures the request, and asserts:

```js
assert.equal(request.config.httpOptions.timeout, 30_000);
assert.equal(request.model, "gemma-4-31b-it");
assert.equal(request.contents, "prompt");
assert.equal(result, "model text");
```

Run:

```bash
node --test tests/unit/genaiClient.test.js
```

Expected: FAIL because `utils/genaiClient.js` does not exist.

- [ ] **Step 2: GREEN — add the smallest injectable GenAI boundary**

Implement CommonJS with the current SDK response contract:

```js
const DEFAULT_TIMEOUT_MS = 30_000;
const MIN_TIMEOUT_MS = 1_000;
const MAX_TIMEOUT_MS = 60_000;

function normalizeModelTimeoutMs(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_TIMEOUT_MS;
  return Math.max(MIN_TIMEOUT_MS, Math.min(MAX_TIMEOUT_MS, Math.round(parsed)));
}

async function generateModelText({ apiKey, model, prompt, timeoutMs, clientFactory }) {
  const { GoogleGenAI } = require("@google/genai");
  const createClient = clientFactory || ((options) => new GoogleGenAI(options));
  const client = createClient({ apiKey });
  const response = await client.models.generateContent({
    model,
    contents: prompt,
    config: { httpOptions: { timeout: normalizeModelTimeoutMs(timeoutMs) } },
  });
  return String(response.text || "");
}
```

Install the replacement SDK:

```bash
npm install @google/genai@2.16.0 --save-exact
```

Run the focused test; expected PASS.

- [ ] **Step 3: RED — timeout overrides are clamped**

Add one table-driven test only for `normalizeModelTimeoutMs`: undefined → 30,000; 50 → 1,000; 120,000 → 60,000. Run focused file; expected FAIL before clamp export/behavior is complete.

- [ ] **Step 4: GREEN — export and satisfy timeout clamping**

Export `normalizeModelTimeoutMs`, run the focused file, expected PASS.

- [ ] **Step 5: RED — reasoning sends only one request**

Refactor-safe test: export a factory `createAnalyzeChange({ generateText })` from `reasoning.js`, inject a function that throws `MODEL_TIMEOUT`, call once, and assert call count is 1 and the same error escapes to the API fallback. Run only the new/nearest reasoning test; expected FAIL because the factory does not exist.

- [ ] **Step 6: GREEN — replace Promise.race and retry loop**

Move the existing parsing/normalization body behind the injected `generateText`; production `analyzeChange` calls `generateModelText` once with `GEMINI_MODEL_TIMEOUT_MS || 30000`. Remove `GEMMA_31B_MAX_RETRIES` handling and the two-attempt loop. Keep locked model, prompt, JSON repair, schema normalization, and route-level deterministic fallback unchanged.

Run focused AI and API boundary tests; expected PASS.

- [ ] **Step 7: Remove the orphan cache manager and legacy SDK**

Add a failing static assertion to `tests/unit/pipelinePruningStatic.test.js` that `scripts/manageCache.js` and `cache:*` scripts are absent. Run it RED, delete the file/scripts, remove `@google/generative-ai`, run `npm install`, then run the same test GREEN.

- [ ] **Step 8: Update TDD manifest and commit**

Add `utils/genaiClient.js` and its test to a focused slice. Run:

```bash
node --test tests/unit/genaiClient.test.js tests/unit/apiBoundaryContracts.test.js tests/unit/pipelinePruningStatic.test.js
npm run tdd:doctor
git add package.json package-lock.json reasoning.js utils/genaiClient.js tests/unit/genaiClient.test.js tests/unit/pipelinePruningStatic.test.js config/tdd-coverage.json scripts/manageCache.js
git commit -m "fix: bound AI latency with native GenAI timeout"
```

Expected: focused tests and doctor pass; old SDK absent from lockfile.

---

### Task 3: Confine runtime filesystem access and clear build warnings

**Files:**
- Modify: `utils/esports/gatekeeper.js`
- Modify: `tests/unit/esports/gatekeeper.test.js`
- Modify: `utils/publishing/tunnel.js`
- Modify: `tests/unit/publishing/tunnel.test.js`

**Interfaces:**
- Produces: `resolveRenderFilePath(video, cwd = process.cwd()): string` returning only paths inside `<cwd>/public/renders`.
- Changes: `updateEnvFileValue({ envPath, key, value })`; production caller passes the fixed current-worktree `.env.local` path.

- [ ] **Step 1: RED — reject render path traversal**

Add one test where a real file exists outside `public/renders` and `videoExists({ filePath: outside })` must be false. Run `tests/unit/esports/gatekeeper.test.js`; expected FAIL because current code accepts any existing path.

- [ ] **Step 2: GREEN — confine resolved files to `public/renders`**

Resolve the render root and candidate with `path.resolve`; accept only `candidate === root` or `candidate.startsWith(root + path.sep)`, and reject HTTP URLs. Put `/* turbopackIgnore: true */` on `existsSync` only after confinement. Run focused test; expected PASS.

- [ ] **Step 3: RED — same-prefix sibling does not bypass confinement**

Add one test for `<cwd>/public/renders-evil/clip.mp4`; run RED, then use the `root + path.sep` boundary and run GREEN.

- [ ] **Step 4: RED — tunnel persistence accepts one explicit env file path**

Update one tunnel test to call `updateEnvFileValue({ envPath, key, value })` and assert replacement. It must fail against the current `cwd + fileName` interface.

- [ ] **Step 5: GREEN — separate fixed production path from injected test path**

Use a helper that validates `path.basename(envPath) === ".env.local"` for production and marks the explicit runtime file operations with Turbopack ignore comments. `ensurePublicMediaBaseUrl` constructs `path.join(process.cwd(), ".env.local")`; tests pass a temp `<dir>/.env.local`. Preserve replacement/newline semantics.

- [ ] **Step 6: Verify zero warnings and commit**

Run:

```bash
node --test tests/unit/esports/gatekeeper.test.js tests/unit/publishing/tunnel.test.js
npx next build 2>&1 | tee /tmp/lol-reliability-build.log
test "$(rg -c 'Dynamic filesystem access causes tracing' /tmp/lol-reliability-build.log || true)" = "0"
git add utils/esports/gatekeeper.js tests/unit/esports/gatekeeper.test.js utils/publishing/tunnel.js tests/unit/publishing/tunnel.test.js
git commit -m "fix: confine runtime filesystem access"
```

Expected: focused tests pass and build contains zero dynamic filesystem warnings.

---

### Task 4: Move CI Actions to the Node 24 runtime

**Files:**
- Modify: `.github/workflows/ci.yml`
- Modify: `tests/unit/portfolioPresentation.test.js`

- [ ] **Step 1: RED — require Action v7 while preserving Node 22**

Change one static workflow test to assert `actions/checkout@v7`, `actions/setup-node@v7`, and `node-version: 22`. Run only `portfolioPresentation.test.js`; expected FAIL on v4.

- [ ] **Step 2: GREEN — update two Action references**

Change only the two `uses:` lines to v7. Run the focused test; expected PASS.

- [ ] **Step 3: Commit**

Run YAML parse/static tests, then commit `chore: update GitHub Actions runtime`.

---

### Task 5: Self-host Outfit and Cinzel for web and Remotion

**Files:**
- Create: `public/fonts/Outfit-Variable.woff2`
- Create: `public/fonts/Cinzel-Variable.woff2`
- Create: `public/fonts/OFL.txt`
- Create: `src/video-system/localFonts.js`
- Create: `tests/unit/render/localFonts.test.js`
- Modify: `app/globals.css`
- Modify: `src/index.jsx`
- Modify: `THIRD_PARTY_ASSETS.md`
- Modify: `tests/unit/portfolioPresentation.test.js`
- Modify: `config/tdd-coverage.json`

**Interfaces:**
- Produces: `ensureLocalVideoFonts(): Promise<void>` using `FontFace`, `staticFile`, `delayRender`, and `continueRender` once per Remotion browser context.

- [ ] **Step 1: RED — web CSS may not request Google Fonts**

Add one test asserting `app/globals.css` contains local `@font-face` definitions for Outfit and Cinzel and contains neither `fonts.googleapis.com` nor `fonts.gstatic.com`. Run focused test; expected FAIL.

- [ ] **Step 2: GREEN — add official local font files and CSS**

Download the current official Latin variable WOFF2 files, verify HTTP 200 and non-zero size, and save the OFL license:

```text
Outfit: https://fonts.gstatic.com/s/outfit/v15/QGYvz_MVcBeNP4NJtEtqUYLknw.woff2
Cinzel: https://fonts.gstatic.com/s/cinzel/v26/8vIJ7ww63mVu7gt79mT7PkRXMw.woff2
OFL: https://raw.githubusercontent.com/google/fonts/main/ofl/outfit/OFL.txt
```

Then add:

```css
@font-face { font-family: "Outfit"; src: url("/fonts/Outfit-Variable.woff2") format("woff2"); font-weight: 300 600; font-display: swap; }
@font-face { font-family: "Cinzel"; src: url("/fonts/Cinzel-Variable.woff2") format("woff2"); font-weight: 400 700; font-display: swap; }
```

Remove only the external `@import`. Run focused test; expected PASS.

- [ ] **Step 3: RED — Remotion registers local Outfit before render**

Add a test asserting `src/index.jsx` imports/calls `ensureLocalVideoFonts` and the helper uses `staticFile("fonts/Outfit-Variable.woff2")` with a render handle. Run focused file; expected FAIL.

- [ ] **Step 4: GREEN — add one idempotent FontFace loader**

Implement one module-level promise and render handle; load Outfit through the browser FontFace API, add it to `document.fonts`, continue render on success, cancel render with an actionable error on failure. Call it once before `registerRoot(RemotionRoot)`. Run focused test; expected PASS.

- [ ] **Step 5: Record font rights and verify network behavior**

Document Google Fonts/OFL provenance in `THIRD_PARTY_ASSETS.md`. Start the dev server and use Playwright requests/console to confirm no Google Fonts request and no font 404. Commit `fix: self-host web and video fonts` after focused tests and one Remotion still pass.

---

### Task 6: Put Player Radar evidence in the opening second

**Files:**
- Modify: `src/templates/playerRadarHelpers.js`
- Modify: `src/templates/Template_PlayerRadar.jsx`
- Modify: `tests/unit/render/compositionScope.test.js`

**Interfaces:**
- Produces: `getOpeningEvidence(data): { label: string, value: string }` preferring the first matchup reason, then proof pill.
- Changes default Player Radar HOOK duration from 86 to 45 frames in both locales.

- [ ] **Step 1: RED — opening evidence prefers the strongest matchup metric**

Add one helper test with a first reason `{ metric: "DPM", delta: 220 }`; expect label `DPM` and value `+220`. Run composition/helper test; expected FAIL because helper is absent.

- [ ] **Step 2: GREEN — add the smallest evidence selector**

Return the first reason's metric/formatted delta; when absent, return the existing proof type and proof pill. Run focused test; expected PASS.

- [ ] **Step 3: RED — default Hook lasts 45 frames**

Change one assertion for both localized storyboards from 86 to 45; run RED.

- [ ] **Step 4: GREEN — shorten only the Hook**

Update the two default storyboards to 45 frames; do not change later scene durations yet. Run focused test; expected PASS.

- [ ] **Step 5: RED — Hook renders evidence immediately**

Add a static/render assertion that `HookScene` consumes `getOpeningEvidence` and renders label/value without waiting beyond its existing local entrance frame. Run RED.

- [ ] **Step 6: GREEN — add a compact proof strip to Hook**

Reuse `BroadcastPanel` and existing tokens; show player plus one metric by frame 15. Keep animation to opacity/translateY, start from visible scale above 0.95, and do not delay the text itself. Run focused test GREEN.

- [ ] **Step 7: Motion review and visual evidence**

Render frame 0, 15, 45, and the first matchup frame for zh/en. Review the diff against `review-animations`; block scale(0), unexplained delay, layout-property animation, or data hidden by motion. Render one full H.264/AAC Player Radar canary without publishing. Commit `feat: lead Player Radar with evidence` after visual approval.

---

### Task 7: Remove proven dead runtime code and move test fixtures

**Files:**
- Delete: `scraper.js`
- Delete: `src/components/SocialComments.jsx`
- Delete: `src/components/SubtitleOverlay.jsx`
- Delete: `src/parsers/SocialScraper.js`
- Delete: `src/components/charts/RadarChart.jsx`
- Delete: `utils/pipelinePruner.js`
- Delete: `tests/unit/pipelinePruner.test.js`
- Move: `utils/esports/sampleData.js` → `tests/fixtures/esports/sampleData.js`
- Modify: `package.json`
- Modify: `tests/unit/render/compositionScope.test.js`
- Modify: `tests/unit/pipelinePruningStatic.test.js`
- Modify: `tests/unit/esports/api.test.js`
- Modify: `tests/unit/esports/dailyOneClick.test.js`
- Modify: `config/tdd-coverage.json`

- [ ] **Step 1: Establish reachability baseline**

Run the committed-file import graph and `rg` checks from the design audit. Save the seven entrypoint-free files and confirm no new runtime consumer appeared. If any candidate gains a consumer, remove it from this task.

- [ ] **Step 2: RED/GREEN — retire the compatibility scraper**

Add one static assertion that `scraper.js` and `package.json.main` are absent; run RED, delete/remove them, run GREEN.

- [ ] **Step 3: RED/GREEN — remove unused social modules**

One file per vertical slice: add an absence assertion for `SocialComments.jsx`, run RED, delete, run GREEN; repeat separately for `SubtitleOverlay.jsx` and `SocialScraper.js`. Remove `SubtitleOverlay` from tests that only scan retained runtime files.

- [ ] **Step 4: RED/GREEN — remove the orphan RadarChart**

Add an absence assertion, run RED, delete the component and its standalone-only test block, run GREEN. Keep Player Radar's product-level evidence and render tests.

- [ ] **Step 5: RED/GREEN — retire the completed pruner**

Add an absence assertion for `pipelinePruner.js`, run RED, delete it and its dedicated test, remove it from the coverage slice, run `pipelineRegistry`, API guards, and static retirement tests GREEN.

- [ ] **Step 6: RED/GREEN — move sample data into test fixtures**

Change only `dailyOneClick.test.js` to import `tests/fixtures/esports/sampleData.js`; run RED because the fixture is missing, move the file, update the remaining test imports/coverage manifest, run relevant esports tests GREEN.

- [ ] **Step 7: Commit**

Run composition, pruning-static, daily-one-click, and esports API tests. Commit `refactor: remove unreachable runtime modules`.

---

### Task 8: Reduce duplicate Remotion top-level dependencies

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `tests/unit/pipelinePruningStatic.test.js`

- [ ] **Step 1: RED — direct dependency contract contains only directly used Remotion packages**

Add one assertion that direct Remotion packages equal `@remotion/cli` plus `remotion`; run RED against the current 14-package list.

- [ ] **Step 2: GREEN — remove duplicate top-level declarations**

Remove `@remotion/bundler`, licensing, media-parser, media-utils, player, renderer, streaming, studio, studio-server, studio-shared, web-renderer, and zod-types from direct dependencies. Run `npm install` to regenerate the lock while retaining transitive versions required by CLI.

- [ ] **Step 3: Clean-install and render verification**

Run:

```bash
npm ci
npx remotion compositions src/index.jsx
npm run qa:render
node --test tests/unit/pipelinePruningStatic.test.js tests/unit/render/renderService.test.js tests/unit/render/compositionScope.test.js
```

If a command proves a removed package is directly required, restore only that package and update the contract with the evidence. Commit `chore: trim duplicate Remotion dependencies`.

---

### Task 9: Product understanding checkpoint and final local verification

**Files:**
- Modify: `STATUS.md`
- Modify: `HANDOFF.md`
- Modify: `.gitignore` only if screenshot paths are not already ignored.

- [ ] **Step 1: Update product status**

Replace stale queue warnings in `STATUS.md`; document AI budget, local fonts, Player Radar opening, removed modules, dependency delta, build-warning result, and remaining deployment limitation in `HANDOFF.md`.

- [ ] **Step 2: Verify user-visible web UI twice**

Use `ui-ux-pro-max` only to preserve the existing dark broadcast workbench direction; no redesign. Start `npm run dev`, then for each round capture exactly:

```bash
playwright-cli open http://127.0.0.1:3000
playwright-cli resize 1280 800
playwright-cli screenshot --filename=.screenshots/reliability-desktop.png
playwright-cli resize 375 812
playwright-cli screenshot --filename=.screenshots/reliability-mobile.png
```

Round 1: inspect hierarchy, whitespace, font distinction, palette, alignment, horizontal overflow, states, and motion; record failures and fix only regressions caused by local fonts. Round 2: recapture the same two logical sizes and require every item pass. Check Playwright requests and console for font 404s.

- [ ] **Step 3: Verify data safety**

Require content DB SHA unchanged and queue/daily-run counts still 0. Confirm no publish package was created.

- [ ] **Step 4: Run exact local CI parity**

Run fresh, in order:

```bash
npm ci
npm run tdd:doctor
npm run test:coverage
npx next build
npm audit --audit-level=high
```

Expected: all exit 0, coverage ≥80% for lines/branches/functions, 26 routes, zero dynamic filesystem warnings, zero vulnerabilities.

- [ ] **Step 5: Commit documentation**

Commit `docs: record reliability and lightweight refactor`.

---

### Task 10: Integrate to main, push, and verify GitHub

**Files:**
- No additional production changes expected.

- [ ] **Step 1: Review plan coverage and branch diff**

Map every design requirement to a completed task, run `git diff main...HEAD --check`, inspect deleted files and dependency diff, and require clean status.

- [ ] **Step 2: Merge into main under the project-owner default policy**

From the main checkout, verify it is clean, merge `codex/reliability-lightweight` without force/reset, then rerun the exact CI parity commands on main.

- [ ] **Step 3: Push main and verify remote identity**

Push `main`, compare local SHA, `git ls-remote origin refs/heads/main`, and GitHub commit API SHA.

- [ ] **Step 4: Verify remote product gates**

Wait for CI and CodeQL completion. Require success, no Node 20 deprecation annotation from checkout/setup-node, Dependabot open count 0 using `per_page=1` and `per_page=100`, and open PR count 0 using both page sizes.

- [ ] **Step 5: Deployment decision**

Reconfirm there is no existing production deployment workflow or target. Do not invent a new paid deployment. Report that the project remains a local-first production tool with GitHub-verified source.

- [ ] **Step 6: Preserve or clean the worktree safely**

Only after merge, main tests, push, and remote verification succeed, remove the owned `.worktrees/reliability-lightweight` worktree and delete the merged feature branch. Do not prune or touch `.worktrees/player-radar-dual-read`.
