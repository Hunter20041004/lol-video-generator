# Leaguepedia Scan Cache Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reuse a compatible completed-series snapshot before querying Leaguepedia, and fall back to that snapshot when Leaguepedia rate-limits a refresh.

**Architecture:** `candidateStore` owns compatibility and age checks for stored scan snapshots. `candidateScanner` resolves the requested scan identity once, serves a fresh compatible snapshot without network traffic, and catches only Leaguepedia rate-limit failures to serve an older compatible snapshot. `EsportsWorkflow` displays the returned source metadata so the user knows when local data was used.

**Tech Stack:** Node.js test runner, CommonJS filesystem store, Next.js 16 App Router route handlers, React, existing shadcn-based workflow components.

## Execution status — 2026-09-03

- [x] Compatible complete snapshot lookup, fresh historical reuse, narrow rate-limit fallback.
- [x] Persisted fallback provenance and default preview reader tested across a real process boundary; invalid/future timestamps rejected.
- [x] Browser status and original scanId preview flow; two desktop/mobile screenshot rounds; real 25-second preview using the original August 29 saved data.
- [x] TDD doctor, coverage (630 total / 624 pass / 6 external skip), Next build, Remotion QA 6/6, Playwright 5/5.
- [x] Security gate: user approved targeted updates; fast-uri 3.1.7 and browserslist 4.28.8 now pass audit with zero vulnerabilities. Full branch gates rerun: 632 tests / 626 pass / 6 external skip, build, render 6/6, browser 5/5.
- [x] Commits, main integration, main gates, push/CI and permanent URL rollout. Source 2798c03 is on remote main; main gates passed (632 total / 626 pass / 6 external skip), CI 33806297632 and CodeQL 33806296183 succeeded. Permanent URL fresh reuse and real preview passed; final evidence is in HANDOFF.md.

The detailed steps below describe the original sequence; the execution checklist above is authoritative for completion. Task commits were consolidated into 2798c03 after resolving the audit blocker, preserving one verified deliverable. Browser interaction testing replaced the originally planned static-string assertion; seven-day preview persistence was added after the user's explicit approval.

## Global Constraints

- 2026-09-03 security follow-up approved: in `tests/unit/runtime/dependencySecurity.test.js`, first reproduce fast-uri's scheme-relative IDN host mismatch, update only fast-uri within v3 via `npm update fast-uri --package-lock-only --ignore-scripts`, install and run green. Then add a browserslist patched-version guard and real query smoke test, update only browserslist within v4 plus its required data dependencies, install and run green. Re-run all existing gates. Preserve the original main lockfile-only changes in a named stash before integration and restore them afterwards, verifying their semantic diff is unchanged; never stage them with the security fix.

- 2026-09-03 clarification approved: reuse only historical UTC dates (the existing source-query day boundary), never today's ongoing schedule. Require complete candidates. On rate-limit fallback persist only source-status metadata, retaining the original scanId and createdAt. Only these validated historical fallback snapshots can be read for preview up to seven days; all other snapshot reads keep the one-day default. This survives server restart without a new service or store version.
- Execute inline as previously selected; no subagents.

- Use vertical TDD: one failing test, minimal implementation, green, then the next behavior.
- Never bypass Leaguepedia cooldowns or retry during an active cooldown.
- Cache identity must include date, active mode, normalized languages, and tournament scope.
- Only ready snapshots or previously validated rate-limit fallback snapshots with complete candidates are reusable. Compare resolved tournament filters as well as the four identity fields when provided.
- A fresh snapshot is reusable for 24 hours; a rate-limit fallback may be up to 7 days old.
- Keep the original `scanId` so preview rendering reads the exact stored candidate snapshot.
- Return `sourceStatus.status: "cached"`, `cacheReason`, and `cachedAt` when serving local data.
- Do not add dependencies, schemas, external services, or publishing behavior.
- Preserve user-owned untracked `AGENTS.md` and `CLAUDE.md`.

---

### Task 1: Find the latest compatible candidate snapshot

**Files:**
- Modify: `tests/unit/esports/candidates.test.js`
- Modify: `utils/esports/candidateStore.js`

**Interfaces:**
- Consumes: `findLatestCompatibleSnapshot(criteria, { now, maxAgeMs })`, where criteria contains `date`, `activeMode`, `languages`, and `tournamentScope`.
- Produces: the newest matching ready snapshot, or `null`.

- [x] **Step 1: Write one failing compatibility test**

Create snapshots that differ by date and languages, then require the helper to return only the newest exact match and reject empty snapshots.

- [x] **Step 2: Run the focused test red**

Run:

```bash
node --test --test-name-pattern="latest compatible candidate snapshot" tests/unit/esports/candidates.test.js
```

Expected: FAIL because `findLatestCompatibleSnapshot` is not exported.

- [x] **Step 3: Implement the minimal store query**

Normalize languages by sorting unique lowercase values, compare all four identity fields, require ready non-empty data, enforce `maxAgeMs`, sort by `createdAt` descending, and return the first match without rewriting the store.

- [x] **Step 4: Run the focused test and full candidates test file green**

```bash
node --test --test-name-pattern="latest compatible candidate snapshot" tests/unit/esports/candidates.test.js
node --test tests/unit/esports/candidates.test.js
```

- [x] **Step 5: Commit Task 1** (consolidated into 2798c03)

```bash
git add utils/esports/candidateStore.js tests/unit/esports/candidates.test.js
git commit -m "feat: find compatible esports scan snapshots"
```

---

### Task 2: Reuse fresh scans and fall back on rate limits

**Files:**
- Modify: `tests/unit/esports/candidates.test.js`
- Modify: `utils/esports/candidateScanner.js`

**Interfaces:**
- Consumes: `findLatestCompatibleSnapshot`, resolved active mode, and existing Leaguepedia errors.
- Produces: a normal scan payload or cached payload with `{ sourceStatus: { provider, status: "cached", candidateCount, cacheReason, cachedAt } }`.

- [x] **Step 1: Write and run a failing fresh-cache test**

Store a matching snapshot younger than 24 hours, provide a fetch dependency that throws if called, then require `scanEsportsCandidates` to return the original `scanId` with `cacheReason: "fresh"`.

- [x] **Step 2: Implement fresh snapshot reuse and run green**

Resolve the full criteria before fetching, query the 24-hour cache, and decorate a cloned response without mutating the stored snapshot.

- [x] **Step 3: Write and run a failing rate-limit fallback test**

Store a two-day-old compatible snapshot, make the fetch dependency throw `code = "LEAGUEPEDIA_RATE_LIMITED"`, and require the stored scan with `cacheReason: "rate_limit"`.

- [x] **Step 4: Implement the narrow rate-limit catch and run green**

Catch only `LEAGUEPEDIA_RATE_LIMITED`; search the 7-day fallback window; rethrow every other error and rate-limit errors without a compatible snapshot.

- [x] **Step 5: Run the full candidates test file and commit** (consolidated into 2798c03)

```bash
node --test tests/unit/esports/candidates.test.js
git add utils/esports/candidateScanner.js tests/unit/esports/candidates.test.js
git commit -m "fix: reuse cached esports scans during rate limits"
```

---

### Task 3: Tell the user when cached data is shown

Before UI work, add a vertical TDD slice in `tests/unit/esports/candidates.test.js`: scan a two-day-old completed snapshot during rate limit, then use the real filesystem reader as the preview runner does; assert the exact original snapshot is readable, but ordinary expired, incomplete, today/future, and older-than-seven-day snapshots are rejected. Persist `sourceStatus.status = "cached"`, `cacheReason = "rate_limit"`, and `cachedAt = createdAt` only in the successful fallback path. The reader grants the seven-day default only for those historical complete fallback snapshots and honors explicit stricter maxAgeMs. Do not change createdAt or bypass asset/publish gates.

**Files:**
- Modify: `tests/e2e/studio-workbench.spec.js` (browser fixture verifies visible status and selection, not static source text).
- Modify: `app/components/studio/EsportsWorkflow.jsx`
- Modify: `HANDOFF.md`

**Interfaces:**
- Consumes: `scan.sourceStatus.status`, `cacheReason`, and `cachedAt`.
- Produces: a non-error `WorkflowStatus` stating that saved completed-series data is being used and showing its local timestamp.

- [x] **Step 1: Write and run one failing browser UI contract**

Require the real browser to show `使用已保存的賽事資料` plus a formatted `cachedAt` value, distinguish rate-limit from fresh reuse, clear the notice on date changes, and preview the original scanId.

- [x] **Step 2: Implement the minimal status message and run green**

Render the status immediately above the series selection. Do not add a refresh control or new visual component.

- [x] **Step 3: Run two visual QA rounds**

Start the isolated dev server, copy the ignored candidate snapshot store, and trigger the same historical date twice. Capture 1280×800 and 375×812 in each round with `playwright-cli`; require the second scan to return quickly, display the cached status, have no horizontal overflow, and produce zero product console errors.

- [x] **Step 4: Verify the real boundary and safety seal**

During the active cooldown, confirm a compatible stored date returns HTTP 200 without adding Cargo queries to the server log. Confirm content DB hash is unchanged and publish queue, daily runs, and publish packages remain 0.

- [x] **Step 5: Run full quality gates and update HANDOFF**

```bash
npm run tdd:doctor
npm run test:coverage
npx next build
npm audit --audit-level=high
npm run qa:render
npx playwright test --reporter=line
```

- [x] **Step 6: Commit, fast-forward main, rerun gates, push, and verify the permanent URL**

Restart `com.cengweiting.lol-video-generator.dev`, repeat the historical-date scan at `http://localhost:49761/`, require cached status, HTTP 200, console error 0, and no new Leaguepedia Cargo query. Push `main`, verify remote SHA, then require CI and CodeQL success for the final SHA.
