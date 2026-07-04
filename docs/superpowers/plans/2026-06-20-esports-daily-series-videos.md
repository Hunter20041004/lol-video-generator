# Esports Daily Series Videos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first shippable daily esports series pipeline from the PRD: resolve active mode, aggregate series stats, score/select candidates, plan bilingual payloads, gate outputs, persist runs, queue IG/Threads jobs, and expose dry-run/test APIs.

**Architecture:** Keep the esports workflow behind small CommonJS modules under `utils/esports/`. Each module accepts plain objects and injected dependencies so tests can exercise real behavior without external services. Next API routes call the orchestrator, and UI testing uses the dry-run API rather than real Leaguepedia or platform publishing.

**Tech Stack:** Node.js `node:test`, Next API routes, local JSON store in `.data`, existing `utils/publishing/index.js`, existing Remotion render service contracts.

## Global Constraints

- TDD is mandatory: one failing behavior test, minimal implementation, then refactor.
- Leaguepedia Cargo is the only first-stage esports data source.
- Daily automatic selection caps at 2 series.
- Regular mode defaults to one LCK and one LPL slot, with an override threshold for much higher cross-league scores.
- MSI/Worlds mode only selects matching international series.
- Bilingual outputs must share one semantic structure; zh/en may only localize text.
- Gatekeeper blocks incomplete videos, missing players, missing five role edges, missing language output, and recap points under 3.
- Publishing targets only Instagram and Threads.
- Single-series tests and daily dry runs must not create official publish jobs.
- This workspace is not a git repo, so commit steps are replaced by test evidence.

---

### Task 1: Active Mode Resolver

**Files:**
- Create: `utils/esports/config.js`
- Test: `tests/unit/esports/config.test.js`

**Interfaces:**
- Produces: `resolveActiveMode(config, now)` returns `{ mode, leagues, tournaments, source }`.

- [ ] **Step 1: Write the failing test**

```js
test("resolveActiveMode honors manual MSI mode and excludes regional leagues", () => {
  const { resolveActiveMode } = require("../../../utils/esports/config");
  const result = resolveActiveMode({ activeMode: "msi" }, new Date("2026-06-20T15:30:00.000Z"));
  assert.equal(result.mode, "msi");
  assert.deepEqual(result.leagues, ["MSI"]);
  assert.equal(result.source, "manual");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/unit/esports/config.test.js`
Expected: FAIL because `utils/esports/config.js` does not exist.

- [ ] **Step 3: Write minimal implementation**

Implement `resolveActiveMode` with manual modes `regular`, `msi`, `worlds`, and `auto`; `auto` uses configured tournament windows and falls back to regular.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/unit/esports/config.test.js`
Expected: PASS.

### Task 2: Series Aggregator

**Files:**
- Create: `utils/esports/seriesAggregator.js`
- Test: `tests/unit/esports/seriesAggregator.test.js`

**Interfaces:**
- Produces: `aggregateSeries(games)` returns series metadata, ten aggregated players, role matchups, and completeness.

- [ ] **Step 1: Write the failing test**

```js
test("aggregateSeries computes BO3 player KDA, per-minute stats, and weighted KP", () => {
  const { aggregateSeries } = require("../../../utils/esports/seriesAggregator");
  const series = aggregateSeries(makeTwoGameSeries());
  const mid = series.players.find((player) => player.name === "Blue Mid");
  assert.equal(mid.rawStats.kills, 7);
  assert.equal(mid.rawStats.kda, 5.5);
  assert.equal(mid.rawStats.dpm, 600);
  assert.equal(mid.rawStats.kp, 0.61);
  assert.equal(series.roleMatchups.length, 5);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/unit/esports/seriesAggregator.test.js`
Expected: FAIL because the aggregator module does not exist.

- [ ] **Step 3: Write minimal implementation**

Group games by player/team/role; sum K/A/D, damage, gold, CS, vision, duration, and team kills; derive KDA, DPM, GPM, CSM, VPM, KP, normalized radar stats, and five role matchups.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/unit/esports/seriesAggregator.test.js`
Expected: PASS.

### Task 3: Match Scoring And Selection

**Files:**
- Create: `utils/esports/matchScorer.js`
- Test: `tests/unit/esports/matchScorer.test.js`

**Interfaces:**
- Produces: `scoreSeries(series, config)` and `selectDailySeries(candidates, config)`.

- [ ] **Step 1: Write the failing test**

```js
test("selectDailySeries keeps LCK and LPL in regular mode unless override gap is reached", () => {
  const { selectDailySeries } = require("../../../utils/esports/matchScorer");
  const result = selectDailySeries(makeCandidates(), { activeMode: "regular", maxDailySeries: 2, regularOverrideThreshold: 15 });
  assert.deepEqual(result.map((item) => item.seriesId), ["lck-best", "lpl-best"]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/unit/esports/matchScorer.test.js`
Expected: FAIL because the scorer module does not exist.

- [ ] **Step 3: Write minimal implementation**

Calculate `0.4 * importance + 0.35 * traffic + 0.25 * anomaly`, add configured team/player bonuses, then select up to two candidates with regular quota and override threshold.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/unit/esports/matchScorer.test.js`
Expected: PASS.

### Task 4: Semantic Content Planner

**Files:**
- Create: `utils/esports/contentPlanner.js`
- Test: `tests/unit/esports/contentPlanner.test.js`

**Interfaces:**
- Produces: `planSeriesContent(series, options)` returns semantic content plus zh/en render payloads for `ESPORTS_H2H_RADAR` and `ESPORTS_MATCH_RECAP`.

- [ ] **Step 1: Write the failing test**

```js
test("planSeriesContent derives zh and en payloads from the same matchup edges and recap points", () => {
  const { planSeriesContent } = require("../../../utils/esports/contentPlanner");
  const plan = planSeriesContent(makeAggregatedSeries());
  assert.equal(plan.semantic.matchupEdges.length, 5);
  assert.equal(plan.semantic.recapPoints.length >= 3, true);
  assert.deepEqual(plan.localized.zh.radar.matchupEdges, plan.localized.en.radar.matchupEdges);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/unit/esports/contentPlanner.test.js`
Expected: FAIL because planner module does not exist.

- [ ] **Step 3: Write minimal implementation**

Select edge winner per role from normalized stats, produce data-backed reasons, generate at least three recap points from team/player deltas, and localize only text fields.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/unit/esports/contentPlanner.test.js`
Expected: PASS.

### Task 5: Gatekeeper, Store, Publishing

**Files:**
- Create: `utils/esports/gatekeeper.js`
- Create: `utils/esports/runStore.js`
- Create: `utils/esports/publishing.js`
- Test: `tests/unit/esports/gatekeeper.test.js`
- Test: `tests/unit/esports/runStore.test.js`
- Test: `tests/unit/esports/publishing.test.js`
- Modify: `config/tdd-coverage.json`

**Interfaces:**
- Produces: `evaluateSeriesGate(seriesRun)`, `upsertRun(run)`, `hasPublishedSeries(seriesId)`, `createEsportsPublishJobs(seriesRun, deps)`.

- [ ] **Step 1: Write the failing gatekeeper test**

```js
test("evaluateSeriesGate blocks publishing when recap has fewer than three points", () => {
  const { evaluateSeriesGate } = require("../../../utils/esports/gatekeeper");
  const result = evaluateSeriesGate(makeCompleteRun({ recapPoints: ["mid pressure", "bot gold"] }));
  assert.equal(result.passed, false);
  assert.match(result.reasons.join(" "), /recap/i);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/unit/esports/gatekeeper.test.js`
Expected: FAIL because gatekeeper module does not exist.

- [ ] **Step 3: Write minimal implementation**

Check video existence, render status, both locales, ten players, five edges, three recap points, and publish job readiness.

- [ ] **Step 4: Add store and publishing tests one at a time**

Run each new test file immediately after adding its first test. Expected first failure is missing module, followed by PASS after minimal implementation.

### Task 6: Orchestrator API And Testing Area

**Files:**
- Create: `utils/esports/dailyPipeline.js`
- Create: `app/api/esports/daily/route.js`
- Create: `app/api/esports/test-series/route.js`
- Test: `tests/unit/esports/dailyPipeline.test.js`
- Test: `tests/unit/esports/api.test.js`
- Modify: `app/page.jsx`

**Interfaces:**
- Produces: `runDailyEsportsPipeline(options, deps)` and `runSingleSeriesTest(options, deps)`.

- [ ] **Step 1: Write the failing orchestrator test**

```js
test("runDailyEsportsPipeline dry run renders four test videos per selected series without queueing official publish jobs", async () => {
  const { runDailyEsportsPipeline } = require("../../../utils/esports/dailyPipeline");
  const result = await runDailyEsportsPipeline({ dryRun: true, date: "2026-06-20" }, makeFakeDeps());
  assert.equal(result.selected.length, 1);
  assert.equal(result.outputs[0].videos.length, 4);
  assert.equal(result.publishJobs.length, 0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/unit/esports/dailyPipeline.test.js`
Expected: FAIL because pipeline module does not exist.

- [ ] **Step 3: Write minimal implementation**

Fetch candidates, aggregate, score/select, plan content, render four outputs through injected renderer, evaluate gate, persist run, and only queue publishing when not dry-run and gate passes.

- [ ] **Step 4: Add API/UI test surface**

Expose dry run and single-series routes, then add an Esports Daily panel to the existing Esports Desk tab that triggers dry run/test run and shows selected series, gate status, four output slots, and publish count.

### Task 7: Chrome Self-Test

**Files:**
- No code changes unless visual defects are found.

- [ ] **Step 1: Run verification commands**

Run: `npm run test:unit`, `npm run tdd:doctor`, and `npx next build`.

- [ ] **Step 2: Start dev server**

Run: `npm run dev`.

- [ ] **Step 3: Use Chrome plugin**

Open `http://localhost:3000`, switch to Esports Desk, run daily dry run, inspect that the result shows selected series, four video outputs, gate status, and no official publish jobs for dry run.
