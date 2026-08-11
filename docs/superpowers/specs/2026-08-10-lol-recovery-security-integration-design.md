# LoL Recovery, Queue Isolation, and Security Integration Design

## Context

The repository has three valuable but divergent lines of work:

1. GitHub `main` at `07bacdbdee98ee408b2c0d590f97db6c5ede28fd`, 25 commits ahead of the original local `main`.
2. The rescued local working tree at `8550fe8c0f9bdba116de46846a4b655a5f9a69c3`, containing 34 changed paths.
3. The Player Radar branch at `e9b2752a2502433224e25006534a7f47424c7a34`, containing 30 commits and 30 changed paths.

GitHub also reports 18 open Dependabot alerts across five npm packages and three red Dependabot pull requests. All three pull requests pass install, tests, coverage, and Next build; only the whole-lockfile `npm audit --audit-level=high` step fails.

## Goals

- Prevent tests and reused modules from writing queue jobs or publish packages to a previously active project directory.
- Preserve and integrate the 34-path rescued WIP without discarding GitHub's later security hardening.
- Preserve and integrate all 30 Player Radar commits without weakening evidence validation or remote parsing protections.
- Resolve all 18 Dependabot alerts with one coherent lockfile update.
- Keep the production queue, render assets, and rescued videos unchanged throughout development and testing.

## Non-goals

- Do not run queued social publishing jobs.
- Do not rewrite or delete the 379-job production queue.
- Do not recover the 44 non-published jobs whose source videos are missing.
- Do not merge the three individually red Dependabot pull requests.
- Do not add unrelated refactors or new product features.
- Do not use subagents.

## Approved Approach

Use `codex/lol-recovery-security`, based on GitHub `main`, as the isolated integration branch. Work proceeds through independently testable gates:

1. Fix queue and publish-package path isolation with vertical TDD.
2. Merge the rescued 34-path WIP and verify its focused tests.
3. Merge the Player Radar history and verify its evidence, API, publishing, and render tests.
4. Apply one combined dependency update and verify every vulnerable package instance.
5. Run full CI-equivalent verification plus a real Remotion render before integration.

The original `main`, rescue branch, Player Radar branch, runtime queue, and external rescue bundle remain available as rollback points.

## Queue Isolation Architecture

### Root cause

`utils/publishing/queueStore.js` and `utils/publishing/index.js` currently calculate storage roots when Node first loads the module:

```js
const DATA_DIR = path.join(process.cwd(), ".data");
const PACKAGE_ROOT = path.join(process.cwd(), "public", "publish-packages");
```

Node caches the module. A later test can change `process.cwd()` to a temporary project, but the cached constants still point to the directory that was active during the first import. A two-directory reproduction wrote both the queue and publish package to the first directory instead of the active second directory.

### Fix boundary

Resolve the data directory, queue path, and publish-package root at operation time:

```js
function getDataDir(cwd = process.cwd()) {
  return path.join(cwd, ".data");
}

function getQueuePath(cwd = process.cwd()) {
  return path.join(getDataDir(cwd), "publish-queue.json");
}

function getPublishPackageRoot(cwd = process.cwd()) {
  return path.join(cwd, "public", "publish-packages");
}
```

`readQueue`, `writeQueue`, and `writePublishPackage` use these functions for every operation. No global environment variable and no test-only production hook are added.

### Contract

- Requiring the modules in project A, changing to project B, and then creating a queued publish job writes only to project B.
- Project A receives no queue or package files.
- Existing callers do not need new arguments.
- Queue JSON shape and publish-package layout remain unchanged.

## Integration Policy

### GitHub protections that must survive

- Untrusted parsing hardening in `app/api/analyze/route.js` and related schemas.
- Protected production mutation APIs.
- Shell-free rendering and portable Remotion compositor behavior.
- Retired worker entrypoints and licensed-media defaults.
- CI security contracts and the high-severity audit gate.

### Rescued WIP that must survive

- Daily one-click pipeline and API route.
- Leaguepedia rate-limit cooldown persistence and actionable API errors.
- Candidate scanning, daily pipeline, publishing, copy, caption, and UI work represented by the 34-path rescue snapshot.
- The three audio deletions, which agree with GitHub's licensed-media cleanup.

### Player Radar work that must survive

- Dual-read payload construction, schema normalization, evidence gates, localized validation, creator controls, and mobile-short visuals.
- All Player Radar API, publishing, composition, evidence, and render tests.
- Remote parsing and render-security changes take precedence when resolving shared files; Player Radar-specific behavior is reapplied within those boundaries.

Ambiguous conflicts that would change visible product behavior are not resolved by choosing an entire side. They are reconstructed from both diffs and validated with the nearest existing tests.

## Dependency Security Design

GitHub's current patch floors are:

- Next.js: `>=16.2.11`
- Sharp: `>=0.35.0`
- PostCSS: `>=8.5.18` to cover both open advisories
- Undici: `>=7.29.0`
- fast-uri: `>=3.1.5` to cover both open advisories

The selected update is deliberately conservative:

- Set Next.js to `^16.3.0`; Next `16.3.0` officially accepts Sharp `^0.35.3`.
- Remove the stale root PostCSS `8.5.10` override and require every resolved instance to be at least `8.5.18`.
- Resolve Undici to `7.29.0` within Cheerio's compatible dependency range rather than adding it as a root dependency or jumping to major version 8.
- Resolve fast-uri to `3.1.5` within AJV's compatible dependency range rather than adding it as a root dependency or jumping to major version 4.
- Keep Remotion at `4.0.489` unless the post-update audit proves that its dependency graph still requires a Remotion patch.

The audit gate remains `npm audit --audit-level=high`; it is not weakened or baselined away.

## Data Safety

- All implementation and tests run in `.worktrees/lol-recovery-security`.
- Before and after each full-suite run, hash `/Users/cengweiting/Developer/lol-video-generator/.data/publish-queue.json` and require an identical digest.
- Do not copy ignored `.data`, `public/renders`, or `public/publish-packages` into the integration worktree.
- Do not run `publish:run`, `publish:due`, or `publish:scheduler`.
- Preserve the rescue refs and external bundle until remote integration and deployment verification are complete.

## Error Handling and Stop Conditions

- A regression test that does not fail for the expected path-capture reason is corrected before production code changes.
- A merge conflict with no existing test or clear product rule stops that merge for explicit product review.
- A dependency update that requires a new major parent dependency or a lower audit gate stops for review.
- Any production queue hash change stops all testing immediately.
- Any full-suite, build, audit, or render failure blocks merge and deployment.

## Verification

1. Queue isolation regression test: RED on the fixed-path implementation, GREEN after dynamic resolution.
2. Focused publishing tests and queue/package filesystem assertions.
3. Rescued WIP unit tests for cooldowns, API errors, daily one-click flow, candidates, copy, and captions.
4. Player Radar API, runner, evidence, schema, publishing, composition, and render tests.
5. `npm run tdd:doctor`.
6. `npm run test:coverage`.
7. `npx next build`.
8. `npm audit --audit-level=high` with zero high-severity findings.
9. Lockfile assertions for Next, Sharp, PostCSS, Undici, and fast-uri.
10. A real Remotion render that produces a non-empty MP4 in the isolated worktree.
11. GitHub Actions CI after push, followed by a fresh Dependabot alert count.

## Delivery

Changes are committed in reviewable gates: design/plan, queue isolation, rescued WIP merge, Player Radar merge, dependency security, and handoff evidence. Integration to `main`, push, and deployment happen only after every required verification passes and the root worktree can be transitioned without losing user data.
