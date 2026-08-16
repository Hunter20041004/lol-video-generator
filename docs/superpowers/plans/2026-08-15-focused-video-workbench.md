# Focused Video Workbench Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. The project owner explicitly requires inline execution only: do not use subagents.

**Goal:** Replace the four-workspace engineering dashboard with two preview-first daily workflows—esports and version updates—while keeping Meta, insights, queue, and engineering controls inside an advanced sheet.

**Architecture:** Keep `app/page.jsx` as the client entry and split workflow state into focused components under `app/components/studio/`. Reuse existing API routes, but make esports explicitly preview-only and persist version preview render metadata so confirmation publishes the exact reviewed artifact. Use a minimal Tailwind v4 + shadcn/ui component set and remove only legacy shell CSS proven unused after the new page lands.

**Tech Stack:** Next.js 16.3 App Router, React 19, Tailwind CSS v4, shadcn/ui primitives, Node test runner, Playwright, existing Remotion and publishing services.

## Global Constraints

- Inline execution only; no subagents.
- Preserve every backend route and runtime data source; do not delete Meta, Insights, publishing, content factory, or esports functionality.
- Primary navigation exposes only `賽事影片` and `版本更新`; `賽事影片` is default.
- Esports and version workflows are preview-first. No publish CTA may render before a validated preview exists.
- Version selection is single-select and confirmation reuses the reviewed `renderResult`.
- Desktop is 40/60 controls-preview; mobile is controls then preview with no horizontal overflow at 375px.
- Styling uses one muted-gold accent, repository Outfit/Cinzel fonts, no neon/glass/glitch, and reduced-motion support.
- Real Instagram/Threads publishing is outside verification; use isolated stores and preview-only canaries.
- Read the local Next.js 16 guides in `node_modules/next/dist/docs/01-app/01-getting-started/11-css.md`, `05-server-and-client-components.md`, and `02-guides/testing/playwright.md` before implementation.

---

## File Map

- Create `components.json`, `jsconfig.json`, `postcss.config.mjs`: minimal Tailwind/shadcn configuration and `@/*` alias.
- Create `app/lib/utils.js`: shadcn `cn()` utility.
- Create `app/components/ui/button.jsx`, `tabs.jsx`, `sheet.jsx`, `select.jsx`: only the primitives used by this page.
- Create `app/components/studio/studioModel.js`: response normalization and publish-gate helpers that can be unit-tested without a browser.
- Create `app/components/studio/StudioShell.jsx`: brand, tabs, mounted workflows, advanced sheet.
- Create `app/components/studio/EsportsWorkflow.jsx`: candidate scan, single series selection, preview, confirmation publish.
- Create `app/components/studio/VersionWorkflow.jsx`: library load/scan, category filter, single item selection, preview, confirmation publish.
- Create `app/components/studio/PreviewPanel.jsx`: stable video viewport, validation summary, platform status, publish CTA.
- Create `app/components/studio/WorkflowStatus.jsx`: loading, empty, recoverable error, success.
- Create `app/components/studio/AdvancedToolsSheet.jsx`: Meta, Insights, queue, raw engineering details using retained APIs.
- Modify `app/page.jsx`: reduce to portfolio demo setup plus `StudioShell`.
- Modify `app/globals.css`: Tailwind import, design tokens, font faces, reduced-motion and only non-Tailwind video/status styles.
- Modify `app/api/content-factory/preview/route.js`: persist successful preview render metadata.
- Modify `utils/contentFactory/store.js` only if an existing update boundary needs a narrow helper; do not add a new database format.
- Update existing portfolio/static tests to assert the new product contract rather than four-workspace markup.
- Create `tests/unit/studio/studioModel.test.js`, `tests/unit/studio/workbenchStatic.test.js`, `tests/unit/contentFactory/previewRoute.test.js`.
- Create `tests/e2e/focused-workbench.spec.js` and `playwright.config.js` for real interaction contracts.
- Update `HANDOFF.md` with final evidence.

---

### Task 1: Minimal shadcn/Tailwind foundation and focused shell

**Files:**
- Create: `components.json`
- Create: `jsconfig.json`
- Create: `postcss.config.mjs`
- Create: `app/lib/utils.js`
- Create: `app/components/ui/button.jsx`
- Create: `app/components/ui/tabs.jsx`
- Create: `app/components/ui/sheet.jsx`
- Create: `app/components/ui/select.jsx`
- Create: `app/components/studio/StudioShell.jsx`
- Create: `tests/unit/studio/workbenchStatic.test.js`
- Modify: `app/page.jsx`
- Modify: `app/globals.css`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Produces `StudioShell({ portfolioReadOnly, portfolioDemoState })` and two mounted tab panels with test IDs `esports-workflow` and `version-workflow`.
- Produces accessible `Button`, `Tabs`, `Sheet`, and `Select` primitives for later tasks.

- [ ] **Step 1: Write one failing focused-shell contract**

```js
test('primary workbench exposes only esports, version, and advanced tools', () => {
  const page = read('app/page.jsx');
  const shell = read('app/components/studio/StudioShell.jsx');
  assert.match(page, /<StudioShell/);
  assert.match(shell, /賽事影片/);
  assert.match(shell, /版本更新/);
  assert.match(shell, /進階工具/);
  assert.doesNotMatch(shell, /版本改動工廠|電競賽事工廠|發布與成效控制台|Meta 內容工廠/);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test --test-reporter=spec tests/unit/studio/workbenchStatic.test.js`  
Expected: FAIL because `StudioShell.jsx` does not exist.

- [ ] **Step 3: Install the minimal official UI foundation**

Run the current official shadcn CLI in JavaScript/Tailwind v4 mode, then add only `button tabs sheet select`; verify `package.json` contains no unused shadcn components. Configure `@/*` through `jsconfig.json`. Do not change the Remotion dependency set.

- [ ] **Step 4: Implement the smallest focused shell**

Replace `app/page.jsx` with the portfolio demo effect plus `StudioShell`. Keep both workflow panels mounted and hide the inactive one with semantic tab panels so later state is preserved.

- [ ] **Step 5: Run the focused test and verify GREEN**

Run: `node --test --test-reporter=spec tests/unit/studio/workbenchStatic.test.js`  
Expected: PASS.

- [ ] **Step 6: Refactor tokens and reduced motion, then rerun GREEN**

Add design tokens for deep navy, surface, line, foreground, muted, muted gold, success, and danger. Add repository font faces and a `prefers-reduced-motion` override. Keep the test passing.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json components.json jsconfig.json postcss.config.mjs app/page.jsx app/globals.css app/lib app/components/ui app/components/studio/StudioShell.jsx tests/unit/studio/workbenchStatic.test.js
git commit -m "refactor: focus the video workbench shell"
```

### Task 2: Pure workflow model and publish gate

**Files:**
- Create: `app/components/studio/studioModel.js`
- Create: `tests/unit/studio/studioModel.test.js`

**Interfaces:**
- Produces `normalizeEsportsPreview(payload)`, `normalizeVersionPreview(payload)`, `canPublishPreview(preview)`, `failedPublishJobs(payload)`, and `humanizeWorkflowError(payload)`.

- [ ] **Step 1: Write one failing validation-gate test**

```js
test('esports preview is publishable only when every requested video passed validation', () => {
  const good = normalizeEsportsPreview({ videos: [{ locale: 'zh', videoUrl: '/renders/a.mp4' }], validationReports: [{ passed: true }] });
  const bad = normalizeEsportsPreview({ videos: [{ locale: 'zh', videoUrl: '/renders/a.mp4' }], validationReports: [{ passed: false, reasons: ['duration'] }] });
  assert.equal(canPublishPreview(good), true);
  assert.equal(canPublishPreview(bad), false);
});
```

- [ ] **Step 2: Run and verify RED**

Run: `node --test --test-reporter=spec tests/unit/studio/studioModel.test.js`  
Expected: FAIL because the module is missing.

- [ ] **Step 3: Implement the minimal normalization and gate**

Require at least one local `videoUrl`, matching validation report count, and every report `passed === true`; expose failed validation reasons for the UI.

- [ ] **Step 4: Run and verify GREEN**

Run the same command. Expected: PASS.

- [ ] **Step 5: Add one RED→GREEN slice for partial publish retry**

Test that `failedPublishJobs()` returns only jobs whose status is neither `PUBLISHED` nor `QUEUED`, implement the minimal filter, and rerun the file.

- [ ] **Step 6: Add one RED→GREEN slice for actionable errors**

Test cooldown, auth, ordinary API error, and unknown fallback one at a time; implement mapping without exposing stack traces or tokens.

- [ ] **Step 7: Commit**

```bash
git add app/components/studio/studioModel.js tests/unit/studio/studioModel.test.js
git commit -m "feat: add preview and publish state model"
```

### Task 3: Esports single-series preview-first workflow

**Files:**
- Create: `app/components/studio/EsportsWorkflow.jsx`
- Create: `app/components/studio/PreviewPanel.jsx`
- Create: `app/components/studio/WorkflowStatus.jsx`
- Modify: `app/components/studio/StudioShell.jsx`
- Modify: `tests/unit/studio/workbenchStatic.test.js`
- Modify: `tests/unit/metaFactory/workbenchStatic.test.js`

**Interfaces:**
- `EsportsWorkflow({ portfolioReadOnly, active })` calls candidates, player-radar preview, and generic publish APIs.
- `PreviewPanel({ preview, busy, publishResult, onPublish, onRetryFailed, portfolioReadOnly })` hides publish until `canPublishPreview(preview)`.

- [ ] **Step 1: Write one failing request contract for preview mode**

Assert the component sends `mode: "preview"`, `languages: ["zh"]`, `scanId`, and `seriesId` to `/api/esports/player-radar`, and does not reference `/api/esports/daily-one-click`.

- [ ] **Step 2: Run and verify RED**

Run: `node --test --test-reporter=spec tests/unit/studio/workbenchStatic.test.js`  
Expected: FAIL because `EsportsWorkflow.jsx` is missing.

- [ ] **Step 3: Implement candidate scan and single selection**

Use the local previous-date helper, display team/score/league labels, default to the first candidate, retain date on error, and keep IDs inside a collapsed engineering detail.

- [ ] **Step 4: Implement preview and hidden-until-ready publish CTA**

Preview stores normalized videos, localized payloads, and reports. Confirm publish calls `/api/publish` with `action: "publish"`, both retained platforms, the exact preview videos, and a PLAYER_RADAR wrapper containing `localizedPayloads`.

- [ ] **Step 5: Run and verify GREEN**

Run focused static and player radar route tests. Expected: PASS.

- [ ] **Step 6: Add one RED→GREEN slice for stale preview invalidation**

Test that changing date or series clears preview state before a new render; extract a small reducer/helper if necessary rather than coupling the test to React internals.

- [ ] **Step 7: Commit**

```bash
git add app/components/studio/EsportsWorkflow.jsx app/components/studio/PreviewPanel.jsx app/components/studio/WorkflowStatus.jsx app/components/studio/StudioShell.jsx tests/unit/studio tests/unit/metaFactory/workbenchStatic.test.js
git commit -m "feat: add preview-first esports workflow"
```

### Task 4: Persist version preview artifacts without queue side effects

**Files:**
- Create: `tests/unit/contentFactory/previewRoute.test.js`
- Modify: `app/api/content-factory/preview/route.js`

**Interfaces:**
- Successful `render: true` updates the selected content item with `{ renderedAt, renderResult: { videos } }` while retaining `status: "READY"` and writing no publish queue.

- [ ] **Step 1: Write one failing isolated route test**

Create a temporary workdir and content store item, inject or patch route dependencies consistently with existing route tests, invoke POST with `render: true`, and assert the returned/stored item has `renderResult.videos` while queue files remain absent.

- [ ] **Step 2: Run and verify RED**

Run: `node --test --test-reporter=spec tests/unit/contentFactory/previewRoute.test.js`  
Expected: FAIL because preview does not persist render metadata.

- [ ] **Step 3: Implement minimal persistence**

After successful render, normalize only videos with `videoUrl`, call existing `updatePatchItem`, and return the updated item. Do not alter status and do not call publishing.

- [ ] **Step 4: Run and verify GREEN**

Run the same test. Expected: PASS.

- [ ] **Step 5: Add one RED→GREEN slice for failed render isolation**

Test that a thrown renderer leaves the previous item and queue unchanged; preserve the existing 500 response contract.

- [ ] **Step 6: Commit**

```bash
git add app/api/content-factory/preview/route.js tests/unit/contentFactory/previewRoute.test.js
git commit -m "fix: persist reviewed version preview artifacts"
```

### Task 5: Version single-select preview-first workflow

**Files:**
- Create: `app/components/studio/VersionWorkflow.jsx`
- Modify: `app/components/studio/StudioShell.jsx`
- Modify: `tests/unit/studio/workbenchStatic.test.js`
- Modify: `tests/unit/metaFactory/workbenchStatic.test.js`

**Interfaces:**
- `VersionWorkflow({ portfolioReadOnly, active })` loads the library on mount, filters categories, maintains one selected item, previews it, and publishes only `[selectedId]`.

- [ ] **Step 1: Write one failing single-selection contract**

Assert the component has no `selectedItemIds`, `選取全部`, `清除選取`, or batch publish copy, and sends `itemIds: [selectedItem.id]`.

- [ ] **Step 2: Run and verify RED**

Run the focused static test. Expected: FAIL because the component is missing.

- [ ] **Step 3: Implement library load, filters, and single selection**

Load `/api/content-factory/library` automatically, show one list with radio semantics, and retain the first valid item when changing category.

- [ ] **Step 4: Implement preview and confirmation publish**

Call `/api/content-factory/preview` with `{ itemId, render: true }`; normalize the returned render; after readiness call `/api/content-factory/publish` with one ID and refresh the updated item/status.

- [ ] **Step 5: Run and verify GREEN**

Run focused studio, content factory, portfolio read-only, and old workbench tests. Update obsolete assertions only when they contradict the approved product behavior; preserve security assertions.

- [ ] **Step 6: Add one RED→GREEN slice for category change invalidation**

Changing category or item must clear the previous preview and hide publish.

- [ ] **Step 7: Commit**

```bash
git add app/components/studio/VersionWorkflow.jsx app/components/studio/StudioShell.jsx tests/unit/studio tests/unit/metaFactory/workbenchStatic.test.js tests/unit/portfolioReadOnly.test.js
git commit -m "feat: add single-select version workflow"
```

### Task 6: Advanced tools sheet and accessible states

**Files:**
- Create: `app/components/studio/AdvancedToolsSheet.jsx`
- Modify: `app/components/studio/StudioShell.jsx`
- Modify: `app/components/studio/WorkflowStatus.jsx`
- Modify: `tests/unit/studio/workbenchStatic.test.js`

**Interfaces:**
- Advanced sheet exposes Meta scan/render, insights GET, queued jobs GET, and an engineering disclosure without restoring four primary workspaces.

- [ ] **Step 1: Write one failing advanced-navigation contract**

Assert Meta/insights/queue endpoints occur only in `AdvancedToolsSheet.jsx`, while `StudioShell` exposes one advanced trigger and two primary tabs.

- [ ] **Step 2: Run and verify RED**

Run the focused static test. Expected: FAIL because advanced tools are not implemented.

- [ ] **Step 3: Implement the minimal advanced sheet**

Move retained Meta controls or a focused wrapper into the sheet; expose Insights and Queue as secondary sections. Use progressive disclosure for raw JSON and engineering IDs.

- [ ] **Step 4: Run and verify GREEN**

Run studio, Meta route, insights, queue isolation, and portfolio tests. Expected: PASS.

- [ ] **Step 5: Add one RED→GREEN slice for portfolio read-only mutations**

Assert every mutation in the sheet receives `portfolioReadOnly` and is disabled with an explanation; GET-only refresh controls remain available.

- [ ] **Step 6: Commit**

```bash
git add app/components/studio/AdvancedToolsSheet.jsx app/components/studio/StudioShell.jsx app/components/studio/WorkflowStatus.jsx tests/unit/studio
git commit -m "refactor: move secondary tools behind disclosure"
```

### Task 7: Browser interaction contracts and visual polish

**Files:**
- Create: `playwright.config.js`
- Create: `tests/e2e/focused-workbench.spec.js`
- Modify: `app/globals.css`
- Modify: `.gitignore`

**Interfaces:**
- Browser tests mock only network boundaries while exercising real page state, selection, preview gating, tab preservation, advanced sheet, keyboard focus, and responsive overflow.

- [ ] **Step 1: Write one failing esports browser test**

Route candidates/player-radar/publish with contract-shaped responses. Assert publish is absent before preview, appears after passed validation, and the publish request contains the exact preview `videoUrl`.

- [ ] **Step 2: Run and verify RED**

Run: `npx playwright test tests/e2e/focused-workbench.spec.js --grep "esports preview gate" --reporter=line`  
Expected: FAIL on the first missing/incorrect interaction.

- [ ] **Step 3: Implement the minimum UI fixes and verify GREEN**

Fix only the behavior exposed by the test, rerun the one grep target, and require PASS.

- [ ] **Step 4: Add one RED→GREEN version browser slice**

Mock library/preview/publish. Assert one selected item, exact preview video, and one-item publish request.

- [ ] **Step 5: Add one RED→GREEN responsive/advanced slice**

At 375×812 assert `scrollWidth === clientWidth`, advanced sheet opens/closes by keyboard, and primary tab state survives switching.

- [ ] **Step 6: Run frontend visual round 1**

Start the local server and capture exactly `.screenshots/focused-workbench-round1-desktop.png` at 1280×800 and `.screenshots/focused-workbench-round1-mobile.png` at 375×812. Read both once and grade hierarchy, whitespace, typography, palette, alignment, responsive behavior, states, and motion. Record every failure before editing.

- [ ] **Step 7: Fix round 1 failures and run round 2**

Capture exactly `.screenshots/focused-workbench-round2-desktop.png` and `.screenshots/focused-workbench-round2-mobile.png`. Do not reread round 1. Require every checklist item pass, zero browser console errors, and no horizontal overflow.

- [ ] **Step 8: Review motion code**

Apply `review-animations`; require no repeated decorative animation, no `transition: all`, 160–220ms functional feedback, and reduced-motion behavior.

- [ ] **Step 9: Commit**

```bash
git add playwright.config.js tests/e2e/focused-workbench.spec.js app/globals.css .gitignore
git commit -m "test: verify focused workbench interactions"
```

### Task 8: Real preview-only canaries, full gates, docs, and integration

**Files:**
- Modify: `HANDOFF.md`
- Modify: plan checkboxes as tasks complete

**Interfaces:**
- Produces final screenshots, two preview artifacts, before/after runtime seals, full verification evidence, and merged/pushed `main` if every gate is green.

- [ ] **Step 1: Product understanding checkpoint**

Document product capability, user experience, technical components, data flow, design reason, alternatives, security/cost, current test evidence, and remaining limits before full gates.

- [ ] **Step 2: Run preview-only esports canary with side-effect seals**

Hash or record absence/count for content DB, queue, daily runs, and publish packages before and after. Produce one 25-second zh PLAYER_RADAR preview with `mode: "preview"`; validate media and require all publishing stores unchanged.

- [ ] **Step 3: Run preview-only version canary with side-effect seals**

Select one existing READY content item, render through preview, confirm persisted `renderResult`, do not invoke real publish, and require queue/daily/package seals unchanged.

- [ ] **Step 4: Run branch gates**

Run sequentially: `npm ci`, `npm run tdd:doctor`, `npm run test:coverage`, `npx next build`, `npm audit --audit-level=high`, `npm run qa:render`, and focused Playwright tests. Record exact counts and failures/skips.

- [ ] **Step 5: Review design/spec coverage and diff**

Map every spec requirement to code/tests, run `git diff main...HEAD --check`, inspect dependency additions and deleted CSS, confirm no runtime data is tracked, and verify only approved scope changed.

- [ ] **Step 6: Update HANDOFF and commit**

Record final screenshot paths, canary artifacts/hashes, runtime seals, test/build/audit evidence, known external skips, and absence/presence of deployment target.

- [ ] **Step 7: Merge to main and rerun full gates**

Only if the main worktree's user changes remain untouched and merge is conflict-free, fast-forward `main`, rerun full gates on main, push origin, verify remote SHA, then wait for CI and CodeQL. Do not create a new deployment target if none exists.

- [ ] **Step 8: Final verification**

Open the final local URL from the user perspective, run both core flows without real social publishing, check console/server errors, confirm GitHub checks, and report exact evidence and remaining limitations.
