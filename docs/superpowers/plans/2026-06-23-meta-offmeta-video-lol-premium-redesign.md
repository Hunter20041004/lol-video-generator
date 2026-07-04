# Meta Offmeta Video LOL Premium Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign `META_OFFMETA_PICK` black-tech videos from dashboard-like layouts into a premium LOL-style short-video composition.

**Architecture:** Keep the existing render payload contract and rewrite only `src/templates/Template_MetaOffmeta.jsx` into four scene components selected by storyboard tag. Tests protect source-level structure, payload contract, and rendered still quality.

**Tech Stack:** Remotion, React JSX templates, Node `node:test`, existing render planner and render service.

## Global Constraints

- TDD is mandatory：every task uses one failing behavior test, minimal implementation, then refactor.
- Use vertical TDD only：do not write several tests first and implement several modules later.
- Do not change data fetching, candidate scoring, or tier-ranking templates.
- Do not show `題材分`, `來源一致度`, `confidence`, or `score` as visible black-tech video content.
- Use a LOL-like visual direction: deep blue/black, gold, hero splash, restrained cyan magic light.
- This workspace is not a git repo, so commit steps are replaced by evidence checkpoints.

---

## File Structure

- Modify `src/templates/Template_MetaOffmeta.jsx`: replace dashboard-style sections with four cinematic scene components.
- Modify `tests/unit/render/compositionScope.test.js`: protect template structure and banned visible internal indicators.
- Keep `tests/unit/metaFactory/renderPlanner.test.js`: payload contract should remain green.
- Use `/tmp/hvs-blacktech-valid-props.json` or regenerate equivalent props for Remotion still/video QA.

### Task 1: Scene Structure Contract

**Files:**
- Modify: `tests/unit/render/compositionScope.test.js`
- Modify: `src/templates/Template_MetaOffmeta.jsx`

**Interfaces:**
- Consumes: existing `Template_MetaOffmeta` export.
- Produces: `CinematicBackdrop`, `VersionScanScene`, `HeroRevealScene`, `CoreLoadoutScene`, `TryOrSkipScene`.

- [ ] **Step 1: Write the failing test**

Add assertions that `Template_MetaOffmeta.jsx` contains the five named components and no dashboard `VersionOverview`.

- [ ] **Step 2: Run test to verify Red**

Run: `node --test tests/unit/render/compositionScope.test.js`

Expected: FAIL because the current template still uses `VersionOverview`, `ChampionFeature`, `CoreTechPanel`, and `TakeawayGrid`.

- [ ] **Step 3: Implement minimal scene component rewrite**

Rewrite `Template_MetaOffmeta.jsx` so storyboard tags route to four cinematic scenes.

- [ ] **Step 4: Run test to verify Green**

Run: `node --test tests/unit/render/compositionScope.test.js`

Expected: PASS.

### Task 2: Payload Contract Stays Player-Facing

**Files:**
- Modify if needed: `tests/unit/metaFactory/renderPlanner.test.js`
- Modify if needed: `utils/metaFactory/candidatePlanner.js`

**Interfaces:**
- Consumes: `buildMetaRenderPayload(candidate, "zh")`.
- Produces: unchanged render payload fields: `versionOverview`, `coreItems`, `coreRunes`, `playerStats`, `playerTakeaways`.

- [ ] **Step 1: Run existing payload tests**

Run: `node --test tests/unit/metaFactory/renderPlanner.test.js`

Expected: PASS. If it fails, restore the existing player-facing contract without adding new internal fields.

### Task 3: Render QA

**Files:**
- No source files unless still QA finds visual breakage.

**Interfaces:**
- Consumes: Remotion composition `MetaOffmetaVideo`.
- Produces: stills at frame 0, 120, 240 and one MP4.

- [ ] **Step 1: Render stills**

Run:

```bash
npx remotion still src/index.jsx MetaOffmetaVideo /tmp/hvs-blacktech-frame-0-premium.png --props=/tmp/hvs-blacktech-valid-props.json --frame=0
npx remotion still src/index.jsx MetaOffmetaVideo /tmp/hvs-blacktech-frame-120-premium.png --props=/tmp/hvs-blacktech-valid-props.json --frame=120
npx remotion still src/index.jsx MetaOffmetaVideo /tmp/hvs-blacktech-frame-240-premium.png --props=/tmp/hvs-blacktech-valid-props.json --frame=240
```

Expected: frame 0 is version scan, frame 120 is hero reveal, frame 240 is core loadout.

- [ ] **Step 2: Render final MP4**

Run:

```bash
npx remotion render src/index.jsx MetaOffmetaVideo /tmp/hvs-blacktech-premium.mp4 --props=/tmp/hvs-blacktech-valid-props.json --timeout=120000 --video-bitrate=8M
```

Expected: MP4 renders successfully and visually matches the spec.

### Task 4: Full Verification

**Files:**
- No source files unless verification fails.

- [ ] **Step 1: Run focused tests**

Run:

```bash
node --test tests/unit/render/compositionScope.test.js
node --test tests/unit/metaFactory/renderPlanner.test.js
```

Expected: PASS.

- [ ] **Step 2: Run full verification**

Run: `npm run verify`

Expected: PASS. Existing Turbopack NFT warning is acceptable if build succeeds.

