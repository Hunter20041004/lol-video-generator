# Final Read Winner Crest Background Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the final post-match scene use the actual winner, players, evidence, crest, and score while adding the approved low-contrast winner-crest poster background.

**Architecture:** `postMatchReadBuilder` remains the only source of public final-read copy and evidence labels. `playerRadarAssetPlanner` maps the already-preflighted team crests to the declared winner without a second manifest lookup. `FinalReadScene` consumes only those model and asset contracts, adding a static-safe crest halo and score echo behind the existing conclusion hierarchy.

**Tech Stack:** Node.js test runner, CommonJS data builders, React/Remotion JSX, local verified team-crest manifest, FFmpeg/ffprobe, Playwright CLI, Next.js 16.3.0.

## Global Constraints

- Use vertical TDD: one failing test, minimal implementation, green test, refactor, then the next behavior.
- Do not add remote assets, packages, schemas, or publishing behavior.
- The final scene must contain no fixed team or player names.
- Winner crest identity must come from the selected series date/season and the existing verified local manifest.
- Missing winner identity, evidence, or crest remains a hard render blocker; never substitute another team or season.
- Preserve the 750-frame storyboard and freeze every frame from 705 through 749 at frame 705.
- Keep the last 1.5 seconds completely static and respect reduced motion.
- Keep the conclusion above evidence, score, crest background, and champion atmosphere in visual hierarchy.
- Canary runs are preview-only and must leave publish jobs at 0.
- Preserve user-owned untracked `AGENTS.md` and `CLAUDE.md`.

---

### Task 1: Build a truthful dynamic final-read contract

**Files:**
- Modify: `tests/unit/esports/postMatchReadBuilder.test.js`
- Modify: `utils/esports/postMatchReadBuilder.js:220-332`

**Interfaces:**
- Consumes: `series.winningTeam`, canonical `series.teamA`/`teamB`, `resultHook.scoreParts`, `matchupSegment.edgePlayer`, `proofSegment.player`, and the two existing displayed evidence builders.
- Produces: `finalRead.winnerTeam: { name: string, identity: string }`, `finalRead.conclusion: string`, `finalRead.conclusionParts: { lead: string, emphasis: string }`, and `finalRead.recapReferences: Array<{ source, playerName, metric, displayValue, label }>`.

- [ ] **Step 1: Write a failing non-GEN final-read test**

Add one test using T1 versus BNK FEARX, including parenthetical original names, and require the exact public contract:

```js
test("final read derives winner, copy, and evidence labels from the selected series", () => {
  const input = makeInput();
  input.series.teamA = "T1";
  input.series.teamB = "BNK FEARX";
  input.series.winningTeam = "T1";
  input.series.score = "3-2";
  input.matchupSegment.edgePlayer = {
    ...input.matchupSegment.edgePlayer,
    name: "Oner (Mun Hyeon-jun)",
    team: "T1",
  };
  input.proofSegment.player = {
    ...input.proofSegment.player,
    name: "Gumayusi (Lee Min-hyeong)",
    team: "T1",
    rawStats: { csm: 10.65 },
  };

  const model = buildPostMatchReadViewModel(input);

  assert.deepEqual(model.finalRead.winnerTeam, { name: "T1", identity: "T1" });
  assert.equal(model.finalRead.conclusion, "T1 的勝點不是搶得多，而是把每次領先換成塔與輸出。");
  assert.deepEqual(model.finalRead.conclusionParts, {
    lead: "T1 的勝點不是搶得多，而是把每次領先",
    emphasis: "換成塔與輸出。",
  });
  assert.deepEqual(model.finalRead.recapReferences, [
    { source: "matchup", playerName: "Oner", metric: "KDA", displayValue: "+13.03 KDA", label: "ONER · KDA" },
    { source: "proof", playerName: "Gumayusi", metric: "CSM", displayValue: "10.65 CSM", label: "GUMAYUSI · CSM" },
  ]);
  assert.doesNotMatch(JSON.stringify(model.finalRead), /GEN|Chovy|Ruler/i);
});
```

- [ ] **Step 2: Run the test and verify the existing contract fails**

Run:

```bash
node --test --test-name-pattern="final read derives winner" tests/unit/esports/postMatchReadBuilder.test.js
```

Expected: FAIL because `winnerTeam`, `conclusionParts`, `playerName`, and `label` do not exist.

- [ ] **Step 3: Implement the minimal public final-read builder**

Add focused helpers and replace the current literal reference construction:

```js
function finalReadReference(source, player = {}, evidence = {}) {
  const playerName = publicPlayer(player).name;
  const metric = String(evidence.metric || "").trim();
  return {
    source,
    playerName,
    metric,
    displayValue: String(evidence.displayValue || "").trim(),
    label: `${playerName} · ${metric}`.toUpperCase(),
  };
}

function finalReadCopy(winningTeam, locale) {
  if (locale === "en") {
    const lead = `${winningTeam} did not win by taking more. Every lead became `;
    const emphasis = "towers and damage.";
    return { conclusion: `${lead}${emphasis}`, conclusionParts: { lead, emphasis } };
  }
  const lead = `${winningTeam} 的勝點不是搶得多，而是把每次領先`;
  const emphasis = "換成塔與輸出。";
  return { conclusion: `${lead}${emphasis}`, conclusionParts: { lead, emphasis } };
}
```

Build the final model from the same winner and displayed evidence:

```js
const winningTeamIdentity = String(series.winningTeam || sourceTeamA).trim();
const winningTeam = shortTeamLabel(winningTeamIdentity);
const proofRecap = buildProofRecap(proofSegment);
const finalCopy = finalReadCopy(winningTeam, locale);
const finalRead = {
  winnerTeam: { name: winningTeam, identity: winningTeamIdentity },
  ...finalCopy,
  recapReferences: [
    finalReadReference("matchup", matchupSegment.edgePlayer, primaryEvidence),
    finalReadReference("proof", proofPlayer, proofRecap),
  ],
};
```

- [ ] **Step 4: Run the focused test and the full builder test file**

Run:

```bash
node --test --test-name-pattern="final read derives winner" tests/unit/esports/postMatchReadBuilder.test.js
node --test tests/unit/esports/postMatchReadBuilder.test.js
```

Expected: the focused test passes, then every builder test passes.

- [ ] **Step 5: Refactor without changing the public contract**

Remove the duplicate inline conclusion construction and ensure `winningTeamIdentity` is declared once before both `resultHook` and `finalRead`. Run the builder file again and keep it green.

- [ ] **Step 6: Commit Task 1**

```bash
git add utils/esports/postMatchReadBuilder.js tests/unit/esports/postMatchReadBuilder.test.js
git commit -m "fix: derive final read from series evidence"
```

---

### Task 2: Map the verified winner crest into render assets

**Files:**
- Modify: `tests/unit/render/playerRadarAssetPlanner.test.js`
- Modify: `utils/render/playerRadarAssetPlanner.js:20-117`

**Interfaces:**
- Consumes: `viewModel.finalRead.winnerTeam.identity` from Task 1 and `preflight.teams.teamA`/`teamB` from the existing identity preflight.
- Produces: `assets.finalRead.winnerCrest`, using the existing render-safe crest shape `{ team, season, sha256, width, height, publicPath, labelMode }`.

- [ ] **Step 1: Write a failing winner-side asset test**

Extend `makeViewModel()` with canonical team identities and add one test where team B wins:

```js
test("resolvePlayerRadarAssets exposes the verified winning-team crest", async () => {
  const viewModel = makeViewModel();
  viewModel.seriesContext.teamAIdentity = "GEN";
  viewModel.seriesContext.teamBIdentity = "HLE";
  viewModel.finalRead = { winnerTeam: { name: "HLE", identity: "HLE" } };

  const resolved = await resolvePlayerRadarAssets(viewModel, {
    cacheRemoteImageUrlImpl: async () => "/render-assets/official.png",
    resolvePlayerPortraitImpl: makePortrait,
    resolveTeamCrestImpl: (identity) => ({
      team: identity.team,
      publicPath: `/team-crests/${identity.team.toLowerCase()}.png`,
      labelMode: identity.team === "HLE" ? "embedded" : "external",
    }),
  });

  assert.equal(resolved.finalRead.winnerCrest.team, "HLE");
  assert.equal(resolved.finalRead.winnerCrest.publicPath, "/team-crests/hle.png");
  assert.equal(resolved.finalRead.winnerCrest.labelMode, "embedded");
});
```

- [ ] **Step 2: Run the test and verify it fails**

```bash
node --test --test-name-pattern="verified winning-team crest" tests/unit/render/playerRadarAssetPlanner.test.js
```

Expected: FAIL because `resolved.finalRead` is undefined.

- [ ] **Step 3: Implement winner matching without another manifest lookup**

After building `teams`, select from the two already-verified crests:

```js
const normalizeIdentity = (value) => String(value || "").trim().toLowerCase();
const winnerIdentity = viewModel.finalRead?.winnerTeam?.identity;
const winnerCrest = [preflight.teams.teamA, preflight.teams.teamB]
  .find((crest) => normalizeIdentity(crest.team) === normalizeIdentity(winnerIdentity));
if (!winnerCrest) {
  throw new Error(`Post Match Read winner crest unavailable for ${winnerIdentity || "missing"}.`);
}
```

Add this to the returned asset model:

```js
finalRead: { winnerCrest: renderTeamCrest(winnerCrest) },
```

- [ ] **Step 4: Run the focused test and planner test file**

```bash
node --test --test-name-pattern="verified winning-team crest" tests/unit/render/playerRadarAssetPlanner.test.js
node --test tests/unit/render/playerRadarAssetPlanner.test.js
```

Expected: all planner tests pass.

- [ ] **Step 5: Add and satisfy a mismatched-winner blocker test**

Add one test with `winnerTeam.identity = "Unknown Team"` and require rejection matching `/winner crest unavailable/i`. Run that single test red, keep the explicit throw above, then run it green. This verifies the planner never guesses or substitutes a crest.

- [ ] **Step 6: Commit Task 2**

```bash
git add utils/render/playerRadarAssetPlanner.js tests/unit/render/playerRadarAssetPlanner.test.js
git commit -m "feat: expose verified winner crest"
```

---

### Task 3: Render the approved winner-crest poster background

**Files:**
- Modify: `tests/unit/render/compositionScope.test.js`
- Modify: `src/templates/player-radar/PostMatchReadScenes.jsx:189-205`

**Interfaces:**
- Consumes: `model.finalRead.winnerTeam`, `conclusionParts`, `recapReferences`, `model.resultHook.scoreParts`, and `model.assets.finalRead.winnerCrest`.
- Produces: a final scene with dynamic copy, a low-contrast crest halo, a score echo, dimmed champion atmosphere, and no persistent motion.

- [ ] **Step 1: Write a failing static scene contract test**

Extract only the `FinalReadScene` source and require dynamic content while forbidding the current literals:

```js
test("final read scene uses dynamic winner copy and evidence labels", () => {
  const scenes = fs.readFileSync(path.join(ROOT, "src/templates/player-radar/PostMatchReadScenes.jsx"), "utf8");
  const finalScene = scenes.match(/export const FinalReadScene[\s\S]*?\n};/)?.[0] || "";

  assert.match(finalScene, /model\.finalRead\?\.conclusionParts/);
  assert.match(finalScene, /reference\.label/);
  assert.doesNotMatch(finalScene, /GEN 的勝點|CHOVY|RULER/);
});
```

- [ ] **Step 2: Run the test and verify it fails on the hardcoded copy**

```bash
node --test --test-name-pattern="dynamic winner copy" tests/unit/render/compositionScope.test.js
```

Expected: FAIL because the scene still contains GEN, CHOVY, and RULER literals.

- [ ] **Step 3: Replace fixed copy with the model contract**

Read the dynamic fields at the top of the scene:

```jsx
const conclusionParts = model.finalRead?.conclusionParts || { lead: "", emphasis: "" };
const winnerCrest = model.assets?.finalRead?.winnerCrest;
```

Render the conclusion and evidence labels directly:

```jsx
<h2 style={finalHeadlineStyle}>
  {conclusionParts.lead}<br />
  <b style={{ color: COLORS.gold }}>{conclusionParts.emphasis}</b>
</h2>
```

```jsx
<span style={referenceLabelStyle}>{reference.label}</span>
```

- [ ] **Step 4: Run the focused test green**

```bash
node --test --test-name-pattern="dynamic winner copy" tests/unit/render/compositionScope.test.js
```

Expected: PASS.

- [ ] **Step 5: Write a failing winner-background contract test**

```js
test("final read scene renders a contained winner crest halo and shared score echo", () => {
  const scenes = fs.readFileSync(path.join(ROOT, "src/templates/player-radar/PostMatchReadScenes.jsx"), "utf8");
  const finalScene = scenes.match(/export const FinalReadScene[\s\S]*?\n};/)?.[0] || "";

  assert.match(scenes, /const WinnerCrestBackdrop/);
  assert.match(finalScene, /winnerCrest/);
  assert.match(finalScene, /<WinnerCrestBackdrop/);
  assert.match(finalScene, /score=\{score\}/);
  assert.doesNotMatch(finalScene, /animationIterationCount|rotate\(|particle/i);
});
```

- [ ] **Step 6: Run the new test red**

```bash
node --test --test-name-pattern="contained winner crest halo" tests/unit/render/compositionScope.test.js
```

Expected: FAIL because `WinnerCrestBackdrop` does not exist.

- [ ] **Step 7: Implement the static-safe background component**

Add a focused component above `FinalReadScene`:

```jsx
const WinnerCrestBackdrop = ({ asset, score, localFrame, reducedMotion }) => asset?.publicPath ? (
  <div style={{ ...enterStyle(localFrame, 5, 14, reducedMotion), position: "absolute", right: -72, top: 156, width: 650, height: 650, display: "grid", placeItems: "center", opacity: .9 }}>
    <div style={{ position: "absolute", inset: 34, border: "2px solid rgba(207,173,103,.14)", borderRadius: "50%", boxShadow: "inset 0 0 0 28px rgba(207,173,103,.025), inset 0 0 0 88px rgba(53,209,207,.018)" }} />
    <div style={{ position: "absolute", right: 12, top: 166, color: "rgba(207,173,103,.055)", font: `900 210px/.8 ${NUMBER_FONT}`, letterSpacing: -10 }}>
      {score.left}{score.separator}{score.right}
    </div>
    <Img src={assetSrc(asset.publicPath)} style={{ width: asset.labelMode === "embedded" ? "72%" : "82%", height: asset.labelMode === "embedded" ? "72%" : "82%", objectFit: "contain", opacity: .13, filter: "saturate(.6) brightness(.8)" }} />
  </div>
) : null;
```

Place it after the dimmed atmosphere and before the foreground score/content. Reduce the champion atmosphere from `.28` to `.20`, then render:

```jsx
<WinnerCrestBackdrop asset={winnerCrest} score={score} localFrame={localFrame} reducedMotion={reducedMotion} />
```

- [ ] **Step 8: Run the scene test and full composition contracts**

```bash
node --test --test-name-pattern="contained winner crest halo" tests/unit/render/compositionScope.test.js
node --test tests/unit/render/compositionScope.test.js
```

Expected: every composition-scope test passes.

- [ ] **Step 9: Review motion code before committing**

Use `review-animations` on the Task 3 diff. Confirm the background has one finite entrance, only transform/opacity motion through `enterStyle`, reduced-motion support, and no movement after global frame freeze at 705.

- [ ] **Step 10: Commit Task 3**

```bash
git add src/templates/player-radar/PostMatchReadScenes.jsx tests/unit/render/compositionScope.test.js
git commit -m "feat: add winner crest final scene"
```

---

### Task 4: Prove the non-GEN final scene with a preview-only canary

**Files:**
- Modify: `HANDOFF.md`
- Runtime only, ignored: `.screenshots/final-read-winner-crest-round1/`, `.screenshots/final-read-winner-crest-round2/`, `public/renders/render_*.mp4`

**Interfaces:**
- Consumes: the permanent UI scan for a completed non-GEN series with all approved assets.
- Produces: a validated 25-second preview, four final round screenshots, media metadata, static-tail evidence, and a zero-publish side-effect report.

- [ ] **Step 1: Record the pre-canary safety seal**

Run explicit checks for `.data/patch-content-db.json`, `.data/publish-queue.json`, `.data/esports-daily-runs.json`, and `public/publish-packages/`. Record whether each file exists, its SHA-256 when present, and publish-job/package counts. Do not treat empty output as absence; use `test -e` branches.

- [ ] **Step 2: Start the isolated dev server and run the real preview flow**

Start the worktree on an unused port, scan `2026-08-27`, choose `LCK · BNK FEARX vs Nongshim RedForce · 3-1`, and generate a Chinese preview without clicking publish. If that source snapshot is unavailable, use another completed non-GEN series whose portraits and both crests pass the existing asset gate; record the exact replacement.

- [ ] **Step 3: Validate the media file**

Use `ffprobe` and the existing media validator to confirm H.264/AAC, 1080×1920, 30fps, approximately 25.05 seconds, valid audio, and `publish jobs: 0`.

- [ ] **Step 4: Capture visual round 1**

Extract exactly these two final-scene frames from the generated MP4:

```bash
final_video=$(ls -t public/renders/*.mp4 | head -n 1)
ffmpeg -loglevel error -ss 23.5 -i "$final_video" -frames:v 1 -y .screenshots/final-read-winner-crest-round1/final-1080x1920.png
sips -Z 667 .screenshots/final-read-winner-crest-round1/final-1080x1920.png --out .screenshots/final-read-winner-crest-round1/final-375x667.png
```

Inspect hierarchy, whitespace, typography, color count, alignment, 375px legibility, crest clear space, score consistency, dynamic names, and background competition. Write down every failed item before changing code.

- [ ] **Step 5: Fix only observed failures through new vertical TDD slices**

For each observed defect, add one focused failing unit/static contract test, run it red, make the minimum code change, and run it green. Do not adjust values without a visual defect and a testable contract.

- [ ] **Step 6: Capture visual round 2**

Render a fresh preview and save only the new final screenshots under `.screenshots/final-read-winner-crest-round2/`. Inspect the same checklist without reopening round-1 images. Repeat only if an item remains failed.

- [ ] **Step 7: Verify the 1.5-second static tail**

Compare decoded frames 705 and 749 with SSIM/PSNR, not byte hashes. Require visually identical frames (SSIM `1.000000` or the repository's established equivalent threshold) while acknowledging H.264 byte differences.

- [ ] **Step 8: Run the webpage screenshot loop twice**

Using `playwright-cli`, capture exactly 1280×800 and 375×812 screenshots per round. Confirm 375px `scrollWidth === clientWidth`, zero product console errors, and that the preview remains at `媒體驗證已通過` with video readyState 4.

- [ ] **Step 9: Verify the post-canary safety seal**

Repeat Step 1. The content DB hash and runtime publication records must be unchanged; publish jobs and packages must remain 0.

- [ ] **Step 10: Add the final evidence to `HANDOFF.md` and commit**

Record the chosen series, MP4 path/hash/media report, final screenshot paths, visual checklist result, static-tail measurement, browser console/width state, and safety-seal result.

```bash
git add HANDOFF.md
git commit -m "docs: record winner crest visual verification"
```

---

### Task 5: Full verification, integration, and permanent URL rollout

**Files:**
- Modify: `HANDOFF.md`

**Interfaces:**
- Consumes: Tasks 1–4 as a clean feature branch.
- Produces: verified `main`, matching remote SHA, successful CI/CodeQL, and a real permanent-URL preview flow.

- [ ] **Step 1: Self-review the branch diff**

Run `git diff --check` and inspect `git diff origin/main...HEAD`. Verify there are no fixed team/player names inside `FinalReadScene`, no unrelated refactors, no new external dependencies, and no writes to user-owned untracked files.

- [ ] **Step 2: Run the complete branch quality gate**

```bash
npm run tdd:doctor
npm run test:coverage
npx next build
npm audit --audit-level=high
npm run qa:render
npx playwright test --reporter=line
```

Expected: 0 test failures, coverage gate pass, 26-route build pass, 0 vulnerabilities, Remotion QA 6/6, Playwright 4/4. Preserve and report the three known `playerPortraitManifest.js` tracing warnings if unchanged.

- [ ] **Step 3: Update `HANDOFF.md` with exact branch evidence and commit**

```bash
git add HANDOFF.md
git commit -m "docs: record winner crest quality gates"
```

- [ ] **Step 4: Fast-forward merge into `main`**

Confirm the root worktree contains only the known user-owned untracked `AGENTS.md` and `CLAUDE.md`, then:

```bash
git merge --ff-only codex/final-read-winner-crest-background
```

Stop rather than overwrite if any additional user change overlaps the feature.

- [ ] **Step 5: Rerun the complete quality gate on `main`**

Run the same six commands from Step 2. Do not infer success from the branch run.

- [ ] **Step 6: Push and verify remote source**

```bash
git push origin main
test "$(git rev-parse HEAD)" = "$(git ls-remote origin refs/heads/main | cut -f1)"
```

- [ ] **Step 7: Restart and verify the permanent local service**

Restart `com.cengweiting.lol-video-generator.dev`, verify `http://localhost:49761/` returns HTTP 200, then repeat the non-GEN scan/preview. Require the correct winner crest, dynamic names, `媒體驗證已通過`, video readyState 4, console error 0, and publish jobs 0.

- [ ] **Step 8: Wait for remote CI and CodeQL**

Resolve the pushed SHA and its workflow IDs without hand-entered placeholders:

```bash
source_sha=$(git rev-parse HEAD)
gh run list --commit "$source_sha" --json databaseId,workflowName,status,conclusion,url --limit 10
gh run watch "$(gh run list --commit "$source_sha" --workflow CI --json databaseId --jq '.[0].databaseId')" --exit-status
gh run watch "$(gh run list --commit "$source_sha" --workflow CodeQL --json databaseId --jq '.[0].databaseId')" --exit-status
```

Both workflows must complete successfully. Record the final URLs and source SHA in `HANDOFF.md`; if this final evidence requires a docs-only commit, push it and wait for the new SHA's checks as well.
