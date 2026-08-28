# Esports Date Query Bug Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Execute inline; do not use subagents.

**Goal:** Make the esports candidate scan return completed matches for the date selected in the workbench instead of searching only the latest five games.

**Architecture:** Add an exact-date Leaguepedia fetcher that pushes a UTC day range into the Cargo query. Route `fetchCompletedSeriesForDate()` through that boundary while preserving its existing grouping, detail fetching, and completeness pipeline.

**Tech Stack:** Node.js 24, CommonJS utilities, Node test runner, Next.js 16.3 App Router.

## Global Constraints

- Follow vertical Red → Green → Refactor TDD.
- Do not change UI layout or publishing behavior.
- Do not use sample data to claim the live boundary works.
- Keep Leaguepedia credentials and cookies out of logs and tests.
- Run focused tests during each slice and the full suite only at task completion.

---

### Task 1: Pass the selected date to the source boundary

**Files:**
- Modify: `tests/unit/esports/seriesFetcher.test.js`
- Modify: `utils/esports/seriesFetcher.js`

**Interfaces:**
- Consumes: `fetchCompletedSeriesForDate({ date, activeMode }, deps)`.
- Produces: dependency boundary `fetchMatchesForDate(date, tournament)`.

- [x] **Step 1: Write the failing regression test**

Add a test that injects `fetchMatchesForDate`, records `date` and `tournament`, supplies one complete match, and injects a `fetchRecentMatches` function that throws if called.

- [x] **Step 2: Run the focused test and verify RED**

Run: `node --test --test-reporter=spec tests/unit/esports/seriesFetcher.test.js`

Expected: FAIL with `must query the selected date` because the implementation still calls `fetchRecentMatches(36, tournament)`.

- [x] **Step 3: Implement the smallest source-boundary change**

Resolve `fetchMatchesForDate` from dependencies or `leaguepedia.fetchMatchesForDate`, then call `fetchMatchesForDate(date, tournament)` inside the tournament loop. Preserve all detail and grouping logic.

- [x] **Step 4: Run the focused test and verify GREEN**

Run the same command. Expected: all `seriesFetcher.test.js` tests pass.

- [x] **Step 5: Commit the slice**

```bash
git add tests/unit/esports/seriesFetcher.test.js utils/esports/seriesFetcher.js
git commit -m "fix: pass selected esports date to source"
```

### Task 2: Query Leaguepedia by exact UTC date

**Files:**
- Modify: `tests/unit/esports/leaguepediaSecurity.test.js`
- Modify: `utils/leaguepediaApi.js`

**Interfaces:**
- Consumes: `fetchMatchesForDate(date, tournament)`.
- Produces: normalized, GameId-deduplicated matches whose Cargo query is bounded by `[date 00:00:00, next day 00:00:00)`.

- [x] **Step 1: Write the failing Cargo URL contract**

Mock `global.fetch`, call `fetchMatchesForDate("2026-08-27", "LCK")`, and assert the decoded Cargo `where` parameter contains both date bounds and the tournament filter.

- [x] **Step 2: Run the focused test and verify RED**

Run: `node --test --test-reporter=spec tests/unit/esports/leaguepediaSecurity.test.js`

Expected: FAIL because `fetchMatchesForDate` is not exported.

- [x] **Step 3: Implement the exact-date fetcher**

Validate `YYYY-MM-DD`, calculate the following UTC day, escape Cargo string literals, query `ScoreboardGames` with the same fields as the recent fetcher at limit 50, deduplicate by GameId, and normalize rows.

- [x] **Step 4: Run the focused test and verify GREEN**

Run the same command. Expected: all `leaguepediaSecurity.test.js` tests pass.

- [x] **Step 5: Refactor shared match fields and normalization**

Extract only the duplicated field list and deduplication helper shared by recent and exact-date fetchers, then rerun both focused test files.

- [x] **Step 6: Commit the slice**

```bash
git add tests/unit/esports/leaguepediaSecurity.test.js utils/leaguepediaApi.js
git commit -m "fix: query Leaguepedia matches by selected date"
```

- [x] **Review follow-up: keep league abbreviations from matching unrelated tournaments**

Added a Red → Green contract proving `LPL` matches only `LPL` or names beginning with `LPL `, excluding `LPLOL` and tournament names that merely contain `LPL` later in the string. Applied the same acronym rule to exact-date filters such as `LCK`.

### Task 3: Verify the real user flow and document evidence

**Files:**
- Modify: `HANDOFF.md`
- Modify: this plan checklist

**Interfaces:**
- Consumes: local `/api/esports/candidates` and the workbench scan button.
- Produces: a non-empty 2026-08-27 candidate list and regression evidence.

- [x] **Step 1: Run both focused test files**

Run: `node --test --test-reporter=spec tests/unit/esports/seriesFetcher.test.js tests/unit/esports/leaguepediaSecurity.test.js`

- [x] **Step 2: Run the live Leaguepedia boundary for 2026-08-27**

Call `fetchMatchesForDate("2026-08-27", "LCK")` with local environment loading and confirm it returns the four BNK FEARX vs Nongshim RedForce games without printing secrets.

- [x] **Step 3: Run the full verification suite**

Run: `npm run tdd:doctor`, `npm run test:coverage`, `npx next build`, and `npm audit --audit-level=high`.

- [x] **Step 4: Merge to main and verify the visible workflow**

Fast-forward `main`, rerun the focused tests, reload `http://localhost:49761`, scan `2026-08-27`, and confirm a series selector appears instead of the empty-state message.

- [x] **Step 5: Update handoff, push, and verify remote main**

Record the root cause, test counts, live match evidence, and browser result in `HANDOFF.md`; commit, push `main`, and confirm the remote SHA matches local.
