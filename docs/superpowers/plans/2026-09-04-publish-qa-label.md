# Actual game count label Implementation Plan

> Execute inline with executing-plans; no subagents, per existing user workflow.

**Goal:** Display the approved `賽後判讀 · LCK · 共 5 局` instead of guessed BO3.
**Architecture:** PostMatchReadFrame consumes the existing numeric seriesContext.gameCount. No source fetch, schema, style or publish changes. Invalid/missing counts omit the count rather than inventing one.
**Tech Stack:** Existing React/Remotion, Node test runner, Next bundled SWC for real JSX component tests.

## Constraints
- Preserve GAME_FLOW label and score; keep all existing styling.
- No additional dependency, platform posting or secret output.
- Existing main user lockfile changes remain untouched.

## Task 1: Correct frame label
- [ ] Load actual JSX through `require('next/dist/build/swc').transform` with JSX parser and CommonJS module output; evaluate via Node Module and render with ReactDOMServer.
- [ ] Baseline: GAME_FLOW model gameNumber=2 must contain `遊戲過程 · GAME 2`.
- [ ] RED: render FINAL_READ model `{seriesContext:{league:'LCK',gameCount:5,score:'2-3'}}`; assert HTML includes `賽後判讀 · LCK · 共 5 局` and excludes `BO3`.
- [ ] GREEN: in PostMatchReadFrame.jsx, use `Number.isInteger(context.gameCount) && context.gameCount > 0 ? ` · 共 ${context.gameCount} 局` : ''` as count suffix.
- [ ] Check actual counts 1, 2, 3, 4, 5 and omitted/invalid counts; preserve GAME_FLOW and score. Run this test file after each slice.
- [ ] Refactor only if necessary, then run full tests, doctor, build, audit and real rendered frame/browser layout verification before integration.
- [ ] Commit only scoped files, merge main, rerun full gate and push only if safety gates pass. Record evidence in HANDOFF.

## Task 2: Publishing readiness (separate operational work)
- [ ] Read existing auth callback configuration and tunnel routing without exposing tokens.
- [ ] Diagnose existing public URL with bounded read-only health checks. Do not expose the whole app as a workaround without assessing routes.
- [ ] If login or public exposure choice needed, stop with one user operation/decision. Never post before exact video/platform/account/caption confirmation.

Self-review: Approved actual-count wording covered; no inferred best-of, extra Leaguepedia calls, or unrelated UI redesign. Existing prepared main tests/audit blockage is separate; no claim of deployment until gate passes.

## Execution evidence
- Task 1 implemented: existing GAME_FLOW baseline green; actual count red→green; invalid count red→green. Real JSX rendered through ReactDOMServer, 3 tests pass.
- `npm run verify`: doctor, 641 tests (635 pass, 6 external skip, zero fail), production build pass. `/tmp/lol-label-verify.log`.
- Playwright 5/5 pass; `/tmp/lol-label-e2e.log`. Website screenshots (root `.screenshots/label-round{1,2}-{desktop,mobile}.png`) inspected at 1280×800 and 375×812. Hierarchy, spacing, typography, color, alignment, responsive layout unchanged; existing states exercised by E2E; motion unchanged.
- Real stored HLE snapshot preview: `public/renders/render_1788502413340.mp4`; H.264/AAC 1080×1920, 30fps, 25.045333 sec, media validation passed, SHA-256 `262c640b6ac52764287a4c694ba0a735c9ee0b9feae6f959e3d3ae929a7cffb8`. Final frame `/tmp/lol-label-final.png` verified actual `共 5 局`, crest and score. No publish jobs.
- Task 1 integration blocked: npm audit endpoint timeout, `/tmp/lol-label-audit.log`; preserve isolated branch until safety gate available. No dependency modifications or main merge/push.
- Task 2 diagnosis: IG and Threads read-only account requests return HTTP 400/code 190 with explicit expired message (raw secrets/messages not logged). Both configured callback and media temporary hostnames fail DNS ENOTFOUND. No token change or new tunnel. Fixed domain availability must be confirmed before restoring callback; real publishing still requires exact artifact/account confirmation.
