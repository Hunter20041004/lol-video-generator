# LoL Video Generator Security Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove command injection and make production mutations owner-only without breaking local authoring.

**Architecture:** Launch Remotion without a shell and derive composition IDs from a fixed map. A Next.js `proxy.js` boundary guards all production POST APIs; portfolio mode explains disabled actions while local development remains unchanged.

**Tech Stack:** Next.js 16, Node test runner, Remotion, React.

## Global Constraints

- Modify only the Codex GitHub clone/worktree; never touch the user's original project.
- Keep existing render response shapes, filenames, bilingual output, and local workflow.
- Follow one Red → Green → Refactor slice at a time.

---

### Task 1: Remove shell execution

**Files:**
- Modify: `tests/unit/render/renderService.test.js`
- Modify: `utils/render/renderService.js`

**Interfaces:**
- Produces: injected runner signature `(executable: string, args: string[], options: object) -> Promise<Error|null>`.

- [ ] **Step 1: Write failing injection regression**

Call `renderVideosFromRequest` with `compositionId: 'LeaguePatchVideo; touch /tmp/pwned'`. Capture executable and args. Assert executable is `npx`, args contain the fixed `LeaguePatchVideo`, no joined argument contains `touch /tmp/pwned`, and `shell` is false.

- [ ] **Step 2: Verify Red**

Run the focused test; expect failure because the current injection point receives one shell command string.

- [ ] **Step 3: Implement shell-free runner**

Replace `exec` with promisified `execFile`. Build an array:

```js
["remotion", "render", entryPoint, compositionId, outputPath,
 `--props=${propsFilePath}`, `--timeout=${getRenderTimeoutMs()}`,
 `--video-bitrate=${getRenderVideoBitrate()}`]
```

Invoke `execFile("npx", args, { cwd, maxBuffer, shell: false })`. Select `compositionId` only from `DATA_TYPE_TO_COMPOSITION[props.dataType]` after type validation.

- [ ] **Step 4: Update existing runner assertions and verify Green**

Convert existing command regex assertions to array membership assertions. Run all render and API-boundary tests.

- [ ] **Step 5: Commit**

Commit: `fix: render videos without a shell`

### Task 2: Guard production POST APIs

**Files:**
- Create: `utils/operatorAccess.js`
- Create: `proxy.js`
- Create: `tests/unit/operatorAccess.test.js`
- Create: `tests/unit/proxy.test.js`

**Interfaces:**
- Produces: `hasOperatorAccess(request, env): boolean` and Next `proxy(request)`.

- [ ] **Step 1: Write failing token tests**

Test non-production bypass, production missing configuration rejection, wrong-token rejection, and valid-token acceptance. Use `timingSafeEqual` through the real helper.

- [ ] **Step 2: Verify Red and implement helper**

Read `x-operator-token`; require non-empty `PORTFOLIO_OPERATOR_TOKEN` in production; compare equal-length buffers with `crypto.timingSafeEqual`.

- [ ] **Step 3: Write failing proxy contract**

POST `/api/render` in production without access and expect 401 JSON. GET `/api/publish` and non-API paths must continue. Valid token and non-production POST must continue with `NextResponse.next()`.

- [ ] **Step 4: Implement proxy and verify Green**

Export `proxy` and `config = { matcher: "/api/:path*" }`. Guard only POST; return generic 401 without reflecting credentials.

- [ ] **Step 5: Commit**

Commit: `fix: protect production mutation APIs`

### Task 3: Explain portfolio read-only mode

**Files:**
- Modify: `app/page.jsx`
- Modify: `app/globals.css`
- Modify: `README.md`
- Modify: appropriate static/component test under `tests/unit/`

- [ ] **Step 1: Write failing static UI contract**

Assert production portfolio mode exposes a visible security notice and disables controls that call protected POST routes rather than letting interviewers hit unexplained 401 errors.

- [ ] **Step 2: Verify Red, add minimal read-only state, verify Green**

Use `NEXT_PUBLIC_PORTFOLIO_READ_ONLY === "true"`; preserve all controls in local development. Add concise copy explaining that live render/publish is owner-only and link to demo output/docs.

- [ ] **Step 3: Document environment and security design**

Document `PORTFOLIO_OPERATOR_TOKEN`, shell-free execution, composition allowlisting, read-only portfolio mode, and verification commands. Never document a real value.

- [ ] **Step 4: Full verification and commit**

Run `npm test`, coverage/TDD doctor, `npm run verify`, `npm audit --audit-level=high`, and a render-service smoke test with an injected runner.

Commit: `docs: explain portfolio security controls`
