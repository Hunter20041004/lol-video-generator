# Player Proof Layout Density Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. The product owner explicitly authorized immediate inline execution; do not stop for another execution choice and do not use subagents.

**Goal:** Make player identity, team crests, and the MVP evidence block readable for real global tier-one Leaguepedia data without overlap or invented fallback data.

**Architecture:** The post-match-read builder separates public handle, original name, and secondary evidence before render. The crest manifest carries an explicit presentation mode reviewed from the approved local asset, and the Remotion scene consumes those fields through fixed layout tokens rather than inferring semantics from image ratios.

**Tech Stack:** Node.js CommonJS, `node:test`, React 19, Remotion 4.0.489, Sharp-backed asset verification, FFmpeg/ffprobe, Playwright CLI.

## Global Constraints

- Execute inline in an isolated Git worktree; preserve the user's untracked root `AGENTS.md` and `CLAUDE.md`.
- One vertical TDD slice at a time: one failing test, observed RED, minimal implementation, observed GREEN, refactor under green.
- Public hierarchy is `handle → originalName → CSM/DPM → champion pool → verdict → KDA/KP%/GPM`.
- Missing numeric evidence is omitted, never rendered as zero or replaced by unrelated data.
- Team assets are never cropped, stretched, recolored, downloaded, or re-hashed in this task.
- No new animation; static layout values may move while existing transform/opacity and reduced-motion behavior remain unchanged.
- Preview/canary must not create publish queue, daily run, publish package, or remote social action.
- Complete two visual-review rounds using 1080×1920 and 375×667 video stills, plus the required 1280×800 and 375×812 workbench screenshots.

---

### Task 1: Public player identity contract

**Files:**
- Modify: `utils/esports/postMatchReadBuilder.js`
- Modify: `tests/unit/esports/postMatchReadBuilder.test.js`

**Interfaces:**
- Produces: `publicPlayer(player) -> {...player, name: string, originalName?: string}` inside the builder.
- Consumed by: both `matchup.*Player` and `proof.player` in `buildPostMatchReadViewModel()`.

- [ ] **Step 1: RED — proof identity separates the trailing parenthetical name**

Add one test whose proof player is `Taeyoon (Kim Tae-yoon)` and assert:

```js
assert.equal(model.proof.player.name, "Taeyoon");
assert.equal(model.proof.player.originalName, "Kim Tae-yoon");
assert.equal(model.proof.claim, "數據 MVP 候選: Taeyoon");
```

Run:

```bash
node --test tests/unit/esports/postMatchReadBuilder.test.js --test-name-pattern="proof identity separates"
```

Expected: FAIL because `proof.player.name` still contains the full source string.

- [ ] **Step 2: GREEN — parse once in the data builder**

Replace the destructive name-only cleanup with an anchored parser:

```js
function publicPlayer(player = {}) {
  const sourceName = String(player.name || "").trim();
  const match = sourceName.match(/^(.*?)\s*\(([^()]*)\)\s*$/);
  return {
    ...player,
    name: (match?.[1] || sourceName).trim(),
    ...(match?.[2]?.trim() ? { originalName: match[2].trim() } : {}),
  };
}
```

Build `const publicProofPlayer = publicPlayer(proofPlayer)`, store it at `proof.player`, and use `publicProofPlayer.name` in `proof.claim`.

- [ ] **Step 3: GREEN verification and refactor**

Run the focused test, then the entire builder test file. Expected: all pass with no new warnings.

- [ ] **Step 4: Commit**

```bash
git add utils/esports/postMatchReadBuilder.js tests/unit/esports/postMatchReadBuilder.test.js
git commit -m "fix: separate public player identity"
```

---

### Task 2: Source-backed secondary MVP evidence

**Files:**
- Modify: `utils/esports/postMatchReadBuilder.js`
- Modify: `tests/unit/esports/postMatchReadBuilder.test.js`

**Interfaces:**
- Produces: `proof.secondaryEvidence: Array<{metric: "KDA"|"KP%"|"GPM", displayValue: string}>`.
- Consumed by: `PlayerProofScene` only.

- [ ] **Step 1: RED — build ordered evidence from real raw stats**

Add one test with `{kda: 5.89, kp: 0.72, gpm: 488}` and assert exactly:

```js
assert.deepEqual(model.proof.secondaryEvidence, [
  { metric: "KDA", displayValue: "5.89" },
  { metric: "KP%", displayValue: "72%" },
  { metric: "GPM", displayValue: "488" },
]);
```

Run the single test and observe FAIL because the field is absent.

- [ ] **Step 2: GREEN — add a pure evidence builder**

Implement a small helper that accepts `rawStats`, includes only finite values, rounds KP to an integer percent, stringifies KDA/GPM, and preserves the approved order. Attach its result to `proof.secondaryEvidence`.

- [ ] **Step 3: RED → GREEN — incomplete evidence collapses without fake zero**

Add one test with `{kda: null, kp: undefined, gpm: 451}`. Observe RED if null is coerced to zero; minimally fix the finite-value guard and assert only GPM remains.

- [ ] **Step 4: Verify and commit**

Run `node --test tests/unit/esports/postMatchReadBuilder.test.js`, then commit builder and test changes as `feat: add player proof evidence strip`.

---

### Task 3: Explicit team crest presentation modes

**Files:**
- Modify: `config/esports-team-crests.json`
- Modify: `utils/render/teamCrestManifest.js`
- Modify: `utils/render/playerRadarAssetPlanner.js`
- Modify: `tests/unit/render/playerRadarAssetPlanner.test.js`
- Modify: `tests/unit/render/currentSeriesAssetContract.test.js`

**Interfaces:**
- Manifest input: optional `presentation.labelMode` with allowed values `external` and `embedded`.
- Render output: each team crest exposes `labelMode`, defaulting to `external`.

- [ ] **Step 1: RED — planner preserves a verified embedded label mode**

Extend a planner fixture so team B resolves with `labelMode: "embedded"`; assert `resolved.teams.teamB.labelMode === "embedded"`. Run the test and observe FAIL because the planner drops the field.

- [ ] **Step 2: GREEN — validate and propagate the presentation field**

In `teamCrestManifest`, read `entry.presentation?.labelMode || "external"`; throw for any other value. Return `labelMode`. In `playerRadarAssetPlanner`, include it in `renderTeamCrest()`.

- [ ] **Step 3: RED → GREEN — invalid label modes fail closed**

Add one resolver test with `labelMode: "guess"`, observe RED, then add the allowed-value guard and rerun green.

- [ ] **Step 4: Mark the audited local lockups**

Using `.screenshots/crest-audit/page-1.jpg` through `page-4.jpg` as the reviewed evidence, set `presentation.labelMode: "embedded"` only for these 51 assets that visibly contain a wordmark or team identifier:

`BNK FEARX`, `Nongshim RedForce`, `DN SOOPers`, `Dplus Kia`, `HANJIN BRION`, `Kiwoom DRX`, `KT Rolster`, `T1`, `Anyone's Legend`, `Bilibili Gaming`, `EDward Gaming`, `Invictus Gaming`, `JD Gaming`, `LGD Gaming`, `LNG Esports`, `Team WE`, `ThunderTalk Gaming`, `Top Esports`, `Ultra Prime`, `Weibo Gaming`, `Fnatic`, `G2 Esports`, `GIANTX`, `Karmine Corp`, `Karmine Corp Blue`, `Natus Vincere`, `Shifters`, `SK Gaming`, `Cloud9`, `Dignitas`, `Disguised`, `FlyQuest`, `Sentinels`, `Shopify Rebellion`, `Team Liquid`, `Fluxo W7M`, `FURIA`, `Leviatan`, `LOUD`, `LØS`, `paiN Gaming`, `RED Canids`, `Vivo Keyd Stars`, `CTBC Flying Oyster`, `Deep Cross Gaming`, `DetonatioN FocusMe`, `Fukuoka SoftBank HAWKS gaming`, `GAM Esports`, `Ground Zero Gaming`, `MVK Esports`, `Team Secret Whales`.

Keep `GEN`, `HLE`, `Oh My God`, `Los Ratones`, `Movistar KOI`, `Team Heretics`, and `Team Vitality` on the default external mode.

- [ ] **Step 5: Verify current screenshot case and commit**

Assert the real current-series contract reports HANJIN BRION as embedded and BNK FEARX as embedded. Run both render unit files, `npm run assets:verify`, then commit as `feat: add crest wordmark presentation modes`.

---

### Task 4: Collision-safe Remotion layout

**Files:**
- Modify: `src/templates/player-radar/PostMatchReadScenes.jsx`
- Modify: `tests/unit/render/compositionScope.test.js`

**Interfaces:**
- Consumes: `proof.player.originalName`, `proof.secondaryEvidence`, `teamAssets.*.labelMode`.
- Produces: static JSX layout with fixed safe areas and no new motion events.

- [ ] **Step 1: RED — component contract requires separate identity and evidence rows**

Add one composition-source test that requires `player.originalName`, `proof.secondaryEvidence`, and approved labels `KDA`, `KILL PART.`, `GOLD / MIN` while forbidding direct rendering of a parenthesized combined identity. Observe RED.

- [ ] **Step 2: GREEN — add deterministic type fitting**

Add pure local helpers that return bounded font sizes from visible character count. Render handle and original name as separate single-line nodes. Do not measure DOM or mutate frames.

- [ ] **Step 3: RED → GREEN — embedded crests suppress duplicate labels**

Add one composition contract for `asset.labelMode === "embedded"`. Update `TeamCrest` so embedded assets use the full media frame and reserve the label slot without rendering `<b>{team}</b>`; external assets retain a fitted one-line label.

- [ ] **Step 4: RED → GREEN — move the content block up and add A1 evidence**

Lock the approved layout tokens in the test: main data block moves up 96px relative to the previous layout, secondary evidence uses an equal-column grid, and no `top`/`margin` value is animated. Render the evidence values from the builder and map public metric names to display labels.

- [ ] **Step 5: Focused verification and motion review**

Run `node --test tests/unit/render/compositionScope.test.js`. Review the diff against `review-animations`: no new motion, no layout-property animation, existing opacity/transform and reduced-motion remain. Commit as `feat: refine post match player proof layout`.

---

### Task 5: Real visual canary, full verification, integration, and handoff

**Files:**
- Modify: `HANDOFF.md`
- Create ignored evidence under: `.screenshots/player-proof-layout-round1/`
- Create ignored evidence under: `.screenshots/player-proof-layout-round2/`

**Interfaces:**
- Consumes the 2026-08-27 Taeyoon snapshot and tracked approved assets.
- Produces preview-only MP4/stills and verification evidence; produces no publish job.

- [ ] **Step 1: Establish side-effect seals**

Record hashes or `MISSING` for `.data/patch-content-db.json`, `.data/publish-queue.json`, `.data/esports-daily-runs.json`, and count `public/publish-packages` before rendering.

- [ ] **Step 2: Render a real Taeyoon preview without publishing**

Use the existing preview API/runner with scan `scan-2026-08-27-bd7a8d7871`, the BNK FEARX series, and Taeyoon. Confirm H.264/AAC, 1080×1920, 30fps, approximately 25 seconds, and no queue write.

- [ ] **Step 3: Visual review round 1**

Extract result and MVP stills at their stable frames. Create 375×667 copies. Inspect hierarchy, whitespace, typography, color, alignment, responsiveness, state, and existing motion behavior. Record every failed item before changing layout.

- [ ] **Step 4: Correct findings and visual review round 2**

Apply only evidence-driven spacing/type changes under TDD protection. Re-render fresh stills to `round2`; do not reuse round1 images. Verify all identity, crest, main-data, verdict, and evidence bounds are disjoint and inside 1080×1920.

- [ ] **Step 5: Required workbench screenshot loop**

With the isolated dev server running, use Playwright CLI for exactly one desktop and one mobile screenshot per round at 1280×800 and 375×812. Verify 375px `scrollWidth === clientWidth`, no product console errors, and preview remains available.

- [ ] **Step 6: Product understanding checkpoint**

Record in `HANDOFF.md`: capability, visible experience, components, data flow, design rationale, fallback, safety/cost, focused evidence, and remaining limitations. Include final screenshot paths.

- [ ] **Step 7: Full branch gate**

Run:

```bash
npm run tdd:doctor
npm run test:coverage
npx next build
npm audit --audit-level=high
npm run qa:render
npx playwright test --reporter=line
```

Expected: zero failures; only documented external skips and existing tracing warnings are acceptable.

- [ ] **Step 8: Review and integrate**

Inspect `git diff --check`, request code review, fix all Critical/Important findings, commit handoff evidence, fast-forward merge into `main`, rerun the full gate on `main`, push `origin/main`, and confirm local/remote SHA match.

- [ ] **Step 9: Verify the user-visible endpoint**

Confirm the LaunchAgent is running, `http://localhost:49761/` returns HTTP 200, and execute the real preview flow from the permanent URL. Confirm browser console has no product errors and side-effect seals remain unchanged. Wait for GitHub CI and CodeQL success before reporting completion.
