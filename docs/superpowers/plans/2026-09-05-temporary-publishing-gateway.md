# Temporary Publishing Gateway Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: execute inline with `executing-plans`; subagents are prohibited by the active project workflow. Steps use checkbox syntax for tracking.

**Goal:** Safely reconnect Meta accounts and expose only OAuth callbacks plus verified MP4 files through a free temporary HTTPS tunnel.

**Architecture:** A filesystem-backed, hashed, single-use OAuth challenge protects both callbacks. A loopback-only reverse proxy enforces an exact public-path allowlist before cloudflared, so the Studio itself never becomes internet-accessible. One orchestrator starts both pieces, updates callback/media origins only after external health checks, and prints the exact operator instructions.

**Tech Stack:** Node.js `crypto`, `http`, `fs`, Next.js route handlers, existing cloudflared integration and Node test runner.

## Global Constraints

- Studio remains local at `http://localhost:49761/`.
- Public gateway permits only the two callback GET paths and safe single-file MP4 GET/HEAD paths; everything else ismailto 404.
- OAuth state uses at least 256-bit randomness, SHA-256 at rest, ten-minute expiry and one-time consumption.
- No token, code, app secret or raw provider error is logged or rendered.
- No real post is created until the user confirms exact artifact, platform, username and caption.
- No new package dependency or paid service.

---

### Task 1: OAuth challenge store

**Files:** Create `utils/publishing/oauthChallengeStore.js`; create `tests/unit/publishing/oauthChallengeStore.test.js`.

**Interfaces:** `createOAuthChallenge({platform, locale, now, randomBytesImpl, cwd}) -> {state, expiresAt}`; `consumeOAuthChallenge(state,{platform,now,cwd}) -> {platform,locale}` or throws a safe coded error.

- [ ] Write one real-temp-filesystem test for creation: state includes no stored plaintext nonce and persisted JSON contains only SHA-256 plus metadata; run and see RED.
- [ ] Implement minimal normalized platform/locale, 32 random bytes, SHA-256 and mode-0600 atomic JSON persistence; run GREEN.
- [ ] Add and implement one vertical slice at a time for valid consume, one-time replay rejection, expiry, wrong platform/locale/malformed state, cleanup and restart-safe consumption.
- [ ] Run `node --test --test-reporter=spec tests/unit/publishing/oauthChallengeStore.test.js`; expect all pass.

### Task 2: Route integration

**Files:** Modify `utils/publishing/metaAuth.js`, four `app/api/auth/meta/**/route.js` files; create/modify `tests/unit/publishing/metaAuth.test.js` and route tests.

**Interfaces:** auth URL builders require caller-provided opaque `state`; initiation route creates challenge; callback consumes it before any error display or token exchange.

- [ ] Add a failing URL-builder test that exact caller state is preserved and deterministic default state is forbidden; implement and pass.
- [ ] Add route-loader tests with injected challenge/token dependencies: initiation issues challenge; invalid callback never exchanges token; valid state consumes before exchange; provider error also requires valid state. Complete each RED→GREEN independently.
- [ ] Keep expected username assertion and token persistence after successful exchange only; sanitize public errors to stable codes/messages.
- [ ] Run focused publishing auth tests; expect all pass.

### Task 3: Loopback allowlist gateway

**Files:** Create `utils/publishing/publicGateway.js`; create `tests/unit/publishing/publicGateway.test.js`.

**Interfaces:** `startPublicGateway({studioOrigin,host,port}) -> {origin,close}`; request classifier accepts callbacks or safe `/renders/<name>.mp4`; proxy preserves safe media range headers.

- [ ] Real HTTP test: root, Studio APIs and unknown routes return indistinguishable 404 without reaching upstream; RED then minimal GREEN.
- [ ] Add callback GET forwarding, rejecting non-GET methods and stripping external forwarding/auth headers; RED→GREEN.
- [ ] Add MP4 HEAD, GET and Range forwarding with safe response headers; reject nested/traversal/encoded/non-MP4/query filename; each behavior vertical RED→GREEN.
- [ ] Verify loopback binding default and deterministic close; run focused test file.

### Task 4: Safe tunnel orchestration

**Files:** Modify `utils/publishing/tunnel.js`; create `scripts/prepareMetaConnection.js`; modify `package.json`; modify `tests/unit/publishing/tunnel.test.js`; create `tests/unit/publishing/prepareMetaConnection.test.js`; update `docs/publishing-setup.md`.

**Interfaces:** `prepareTemporaryPublishingGateway()` starts gateway then tunnels its origin; verifies root=404, invalid callbacks=400 and sample MP4 HEAD/Range; only then atomically updates both `META_REDIRECT_BASE_URL` and `PUBLIC_MEDIA_BASE_URL`.

- [ ] Test cloudflared receives gateway origin rather than Studio origin; RED→GREEN.
- [ ] Test no env write and all children close on any readiness failure; RED→GREEN.
- [ ] Test both origins update together after all checks and returned instructions contain exact callback URLs but no secrets; RED→GREEN.
- [ ] Add `npm run publishing:prepare`; document lifecycle, Meta redirect setup, and that terminal must remain running.
- [ ] Focused tests all pass.

### Task 5: Verification and operator handoff

**Files:** Update `HANDOFF.md` and this plan.

- [ ] Run doctor, full coverage, Next production build, high audit, Remotion still QA and Playwright workflows; stop on any failure.
- [ ] Start isolated Studio and temporary gateway; externally verify allowlist, media HEAD/Range, callback invalid-state rejection, and zero access to root/other APIs.
- [ ] Run two desktop/mobile screenshot rounds for any new human-visible readiness/instruction output; inspect layout checklist and correct deficiencies.
- [ ] Seal content DB hash and confirm queue/daily-runs/publish-packages unchanged; no real publication.
- [ ] Commit scoped changes, merge to main, rerun full gate, push, verify remote checks and restart original localhost only if every required gate passes.
- [ ] Guide user through one Meta Developer redirect update at a time; never request secrets in chat. After account verification, present exact publish confirmation package and wait.

## Self-review

Spec coverage: challenge, callback ordering, allowlisted gateway, range media, tunnel lifecycle, readiness, user operation and publication gate are each mapped. No placeholders, new dependency, inferred permanent URL or automatic post. The gateway and OAuth challenge can be rejected independently in review and have real boundary tests.

## Execution evidence

- Tasks 1–4 complete through vertical RED→GREEN. Public gateway module tests plus the complete publishing unit group pass; real HTTP boundaries cover callback header stripping, MP4 HEAD/Range, traversal and symlink rejection.
- Real Quick Tunnel canary passed externally: root 404; callback without valid state 400; MP4 HEAD 200 `video/mp4`; range request 206 with exactly two bytes. Canary tunnel was stopped and its temporary hostname is not reusable.
- Main final gates: doctor; 654 tests, 648 pass, 6 external skip, 0 fail; Next build; audit 0; six Remotion stills; five Playwright flows. Logs: `/tmp/lol-gateway-main-final-{verify,audit,render,e2e}.log`.
- Auth error page round 1 found a one-character mobile orphan; word-breaking RED→GREEN fixed it. Round 2 screenshots: `.screenshots/meta-auth-round2-desktop.png` and `.screenshots/meta-auth-round2-mobile.png`.
- Content DB hash remains `ff407d384b33d95c82ade5923f6ab174182cd08d4a7194e48d0e8e623130fef0`; publishing stores absent. `.env` and `.env.local` are ignored and chmod 600. No account reconnection or publication occurred.
- Task 5 user operations remain: collect the two expected public usernames, prepare a fresh temporary hostname, then guide one Meta callback update/login at a time. Final publication still requires an exact artifact/platform/account/caption confirmation.
