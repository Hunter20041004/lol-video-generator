# Post Match Read LoL-native Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. The project owner requires inline execution only: do not use subagents.

**Goal:** Replace the current dashboard-like `PLAYER_RADAR` video with the approved 12-second `賽後判讀 / POST MATCH READ` experience while preserving the existing API/composition ID, making every public claim source-honest, and preventing preview/test work from touching production publishing state.

**Architecture:** Keep selection and compatibility fields at the existing runner boundary, then build one pure `postMatchRead` view model before Remotion. A dedicated asset planner resolves official Data Dragon imagery, a licensed-music planner selects a verified 12-second beat segment, Remotion renders only that resolved model, and a media validation gate must pass before production queue creation. Preview and dry-run modes render and validate but never write queue, daily-run, or publish-package stores.

**Tech Stack:** Node.js CommonJS services and `node:test`, React 19, Remotion 4.0.489, Riot Data Dragon, repository-hosted OFL fonts, FFmpeg/ffprobe, existing local licensed MP3 library, Git/GitHub Actions.

## Global Constraints

- Execute this plan in the current conversation without subagents.
- Preserve `PLAYER_RADAR`, `PlayerRadarVideo`, and `/api/esports/player-radar` as internal compatibility identifiers in v1. No observer-facing text may say `Player Radar`.
- Follow vertical TDD: add one failing behavior, run only that focused test and inspect the expected failure, add the minimum implementation, rerun green, then refactor under the same test.
- Never generate queue tasks, daily-run records, or publish packages from import, unit test, preview, canary, or dry-run modes.
- Never use raw-number magnitude to rank unlike units such as DPM, GPM, KDA, KP%, CSM, or VPM.
- Use only the three existing owner-approved tracks and their existing SHA-256 values. Do not add music.
- Use official Data Dragon assets with the existing local cache. Do not use generic people, AI portraits, grey silhouettes, or the existing `missing-image.svg` as a final Player Radar visual.
- Do not commit Riot Beaufort or Spiegel binaries. The only new font is an OFL Noto Serif TC subset built reproducibly from a pinned official source revision.
- Keep all canary media under ignored `public/renders/` and `public/render-assets/`. Do not publish the canary.
- Before each task commit, send a concise product-owner checkpoint covering capability, user experience, technical structure, data flow, design reason, fallback, safety/cost, focused test evidence, and remaining limitation. This is a report, not a new approval gate.
- Commit each completed task separately. Do not combine red/green work from later tasks into an earlier commit.

---

### Task 0: Establish the isolated, non-destructive execution baseline

**Files:**

- Read: `HANDOFF.md`
- Read: `docs/superpowers/specs/2026-08-13-post-match-read-lol-native-design.md`
- Read: this plan
- Do not modify runtime data in this task

- [ ] **Step 1: Confirm the accepted docs are the only local lead over GitHub**

Run:

```bash
git status --short --branch
git log --oneline --decorate -5
git diff --check origin/main...HEAD
```

Expected: clean worktree; `main` is ahead only by the accepted design/plan commits; no uncommitted runtime or source changes.

- [ ] **Step 2: Capture production-store fingerprints before implementation**

Run:

```bash
node - <<'NODE'
const crypto = require('node:crypto');
const fs = require('node:fs');
for (const file of [
  '.data/patch-content-db.json',
  '.data/publish-queue.json',
  '.data/esports-daily-runs.json',
]) {
  const value = fs.existsSync(file)
    ? crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
    : 'MISSING';
  console.log(`${file}\t${value}`);
}
NODE
find public/publish-packages -type f -print 2>/dev/null | sort
```

Save the output in the execution notes. Expected current queue/daily files and publish-package tree: absent or empty, matching `HANDOFF.md`.

- [ ] **Step 3: Create the implementation branch**

Run:

```bash
git switch -c codex/post-match-read-lol-native
```

Expected: current branch is `codex/post-match-read-lol-native`; no files changed.

---

### Task 1: Rank matchup evidence by normalized gap, never by raw units

**Files:**

- Create: `utils/esports/playerRadarEvidenceRanker.js`
- Create: `tests/unit/esports/playerRadarEvidenceRanker.test.js`
- Modify: `utils/esports/playerRadarRunner.js`
- Modify: `tests/unit/esports/playerRadarRunner.test.js`

- [ ] **Step 1: RED — reproduce DPM incorrectly outranking the stronger KDA signal**

Create the focused test with source values where DPM has the larger raw number but KDA has the larger normalized gap:

```js
const test = require("node:test");
const assert = require("node:assert/strict");
const { rankMatchupReasons } = require("../../../utils/esports/playerRadarEvidenceRanker");

test("rankMatchupReasons ranks unlike metrics by normalized gap instead of raw delta", () => {
  const reasons = rankMatchupReasons({
    role: "Jungle",
    winner: { rawStats: { role: "Jungle", kda: 13.67, dpm: 421, kp: 0.78, gpm: 410, csm: 7.38 } },
    loser: { rawStats: { role: "Jungle", kda: 0.64, dpm: 335, kp: 0.52, gpm: 350, csm: 6.42 } },
    winnerRadarStats: [
      { label: "KDA", normalizedScore: 98 },
      { label: "DPM", normalizedScore: 67 },
    ],
    loserRadarStats: [
      { label: "KDA", normalizedScore: 20 },
      { label: "DPM", normalizedScore: 55 },
    ],
  });

  assert.equal(reasons[0].metric, "KDA");
  assert.equal(reasons[0].delta, 13.03);
  assert.equal(reasons[0].normalizedGap, 78);
  assert.equal(reasons[1].metric, "DPM");
  assert.equal(reasons[1].delta, 86);
});
```

Run:

```bash
node --test tests/unit/esports/playerRadarEvidenceRanker.test.js
```

Expected: FAIL with module-not-found. This confirms the test is exercising a new isolated ranker, not the old raw-delta sort.

- [ ] **Step 2: GREEN — implement the pure ranker and role priorities**

Implement the following public contract:

```js
const METRIC_FIELDS = Object.freeze({
  KDA: "kda",
  DPM: "dpm",
  "KP%": "kp",
  GPM: "gpm",
  CSM: "csm",
  VPM: "vpm",
});

const ROLE_METRIC_PRIORITY = Object.freeze({
  Top: ["DPM", "KDA", "CSM", "GPM", "KP%"],
  Jungle: ["KDA", "KP%", "GPM", "DPM", "CSM", "VPM"],
  Mid: ["DPM", "KDA", "GPM", "CSM", "KP%"],
  Adc: ["DPM", "CSM", "KDA", "GPM", "KP%"],
  Support: ["KP%", "VPM", "KDA", "GPM", "DPM"],
});

function rankMatchupReasons({ role, winner = {}, loser = {}, winnerRadarStats = [], loserRadarStats = [] }) {
  const priority = ROLE_METRIC_PRIORITY[role] || ROLE_METRIC_PRIORITY.Mid;
  const winnerScores = new Map(winnerRadarStats.map((stat) => [stat.label, Number(stat.normalizedScore)]));
  const loserScores = new Map(loserRadarStats.map((stat) => [stat.label, Number(stat.normalizedScore)]));

  return priority
    .map((metric) => {
      const field = METRIC_FIELDS[metric];
      const winnerValue = Number(winner.rawStats?.[field]);
      const loserValue = Number(loser.rawStats?.[field]);
      const winnerScore = winnerScores.get(metric);
      const loserScore = loserScores.get(metric);
      if (![winnerValue, loserValue, winnerScore, loserScore].every(Number.isFinite)) return null;
      const rawDelta = winnerValue - loserValue;
      const normalizedGap = winnerScore - loserScore;
      if (rawDelta <= 0 || normalizedGap <= 0) return null;
      const digits = metric === "DPM" || metric === "GPM" ? 0 : 2;
      const multiplier = 10 ** digits;
      return {
        metric,
        winnerValue,
        loserValue,
        delta: Math.round(rawDelta * multiplier) / multiplier,
        normalizedGap: Math.round(normalizedGap * 100) / 100,
      };
    })
    .filter(Boolean)
    .sort((left, right) =>
      right.normalizedGap - left.normalizedGap ||
      priority.indexOf(left.metric) - priority.indexOf(right.metric)
    )
    .slice(0, 3);
}

module.exports = { METRIC_FIELDS, ROLE_METRIC_PRIORITY, rankMatchupReasons };
```

Run the focused file again. Expected: PASS.

- [ ] **Step 3: RED → GREEN — pin all five role tie-break orders**

Add one table-driven test that gives every metric the same normalized gap and asserts the first metric is `DPM`, `KDA`, `DPM`, `DPM`, `KP%` for Top/Jungle/Mid/Adc/Support respectively. Run it red before adding any missing field handling, then green after the minimum correction.

- [ ] **Step 4: Integrate the ranker into the runner without changing visible raw values**

In `playerRadarRunner.js`, replace `buildEdgeReasons()` with a call that passes:

```js
rankMatchupReasons({
  role: matchup.role,
  winner: edgePlayer,
  loser: metricOpponentPlayer,
  winnerRadarStats: sourceRadarStats(edgePlayer),
  loserRadarStats: sourceRadarStats(metricOpponentPlayer),
})
```

Add a runner regression assertion that the HLE-like `KDA 13.67 vs 0.64` reason appears before `DPM 421 vs 335`, while the displayed values remain the raw KDA and DPM numbers.

Run:

```bash
node --test tests/unit/esports/playerRadarEvidenceRanker.test.js tests/unit/esports/playerRadarRunner.test.js
```

Expected: all tests pass; no reason is sorted by `Math.abs(delta)`.

- [ ] **Step 5: Refactor and commit**

Run:

```bash
rg -n "sort\(.*delta|Math\.abs\(.*delta" utils/esports/playerRadarRunner.js utils/esports/playerRadarEvidenceRanker.js
git diff --check
git add utils/esports/playerRadarEvidenceRanker.js utils/esports/playerRadarRunner.js tests/unit/esports/playerRadarEvidenceRanker.test.js tests/unit/esports/playerRadarRunner.test.js
git commit -m "fix: rank player radar evidence by normalized gap"
```

Expected `rg`: no raw-delta evidence sort. Commit only Task 1 files.

---

### Task 2: Build the honest `postMatchRead` view model and public copy

**Files:**

- Create: `utils/esports/postMatchReadBuilder.js`
- Create: `tests/unit/esports/postMatchReadBuilder.test.js`
- Modify: `utils/esports/playerRadarRunner.js`
- Modify: `utils/esports/playerRadarEvidence.js`
- Modify: `tests/unit/esports/playerRadarRunner.test.js`
- Modify: `tests/unit/apiBoundaryContracts.test.js`

- [ ] **Step 1: RED — incomplete roles cannot claim a series maximum**

Add a test that removes Support from `roleMatchups`, passes a valid Jungle segment, and asserts:

```js
assert.equal(viewModel.matchup.hasAllFiveRoles, false);
assert.equal(viewModel.matchup.claimScope, "role-local");
assert.doesNotMatch(viewModel.matchup.claim, /最大|biggest/i);
```

Run:

```bash
node --test tests/unit/esports/postMatchReadBuilder.test.js
```

Expected: FAIL with module-not-found.

- [ ] **Step 2: GREEN — implement fixed timings, claim scope, ratio formatting, and labels**

Create `postMatchReadBuilder.js` with these constants and contracts:

```js
const REQUIRED_ROLES = Object.freeze(["Top", "Jungle", "Mid", "Adc", "Support"]);
const POST_MATCH_READ_STORYBOARD = Object.freeze([
  { tag: "HOOK", durationInFrames: 54 },
  { tag: "MATCHUP_EDGE", durationInFrames: 96 },
  { tag: "PLAYER_PROOF", durationInFrames: 120 },
  { tag: "CONCLUSION_CTA", durationInFrames: 90 },
]);

const PUBLIC_COPY = Object.freeze({
  zh: {
    publicTitle: "賽後判讀",
    publicTitleEn: "POST MATCH READ",
    hookQuestion: (role) => `這個系列賽，${role}差距有多誇張？`,
    localClaim: (role) => `${role}差距明顯`,
    maximumClaim: (role) => `五路之中，${role}差距最大`,
    matchupVerdict: "不是小贏，是整個系列賽的斷層。",
    twist: "但真正把優勢變成傷害的，在下路。",
    verdict: "打野拉開局勢，下路把優勢變成勝利。",
    cta: "下一場，你想看哪條路？",
    dataMvpCandidate: "數據 MVP 候選",
    keyPlayer: "關鍵人物",
    officialMvp: "官方 MVP",
  },
  en: {
    publicTitle: "POST MATCH READ",
    publicTitleEn: "POST MATCH READ",
    hookQuestion: (role) => `How wide was the ${role.toLowerCase()} gap?`,
    localClaim: (role) => `A clear ${role.toLowerCase()} gap`,
    maximumClaim: (role) => `The biggest gap across all five roles: ${role}`,
    matchupVerdict: "Not a small edge — a series-long break.",
    twist: "But bot lane turned the lead into damage.",
    verdict: "Jungle built the lead; bot lane turned it into the win.",
    cta: "Which role should we read next?",
    dataMvpCandidate: "DATA MVP CANDIDATE",
    keyPlayer: "KEY PLAYER",
    officialMvp: "OFFICIAL MVP",
  },
});
```

Implement:

```js
function hasAllFiveRoleMatchups(series = {}) {
  const complete = new Set(
    (series.roleMatchups || [])
      .filter((matchup) => matchup.left && matchup.right)
      .map((matchup) => matchup.role)
  );
  return REQUIRED_ROLES.every((role) => complete.has(role));
}

function proofLabelType(series = {}, proofPlayer = {}, requestedProofName = "") {
  if (series.officialMvp?.name === proofPlayer.name) return "official-mvp";
  if (requestedProofName && series.recommendedMvp?.name !== proofPlayer.name) return "key-player";
  return series.recommendedMvp?.name === proofPlayer.name ? "data-mvp-candidate" : "key-player";
}

function buildRatioHook(reason = {}, locale = "zh") {
  const left = Number(reason.winnerValue);
  const right = Number(reason.loserValue);
  if (Number.isFinite(left) && Number.isFinite(right) && right > 0 && left / right >= 2) {
    const ratio = Math.round(left / right);
    return {
      metric: reason.metric,
      leftRaw: left,
      rightRaw: right,
      comparisonType: "ratio",
      approximate: true,
      displayValue: locale === "en" ? `~${ratio}×` : `約 ${ratio}×`,
    };
  }
  return {
    metric: reason.metric,
    leftRaw: left,
    rightRaw: right,
    comparisonType: right === 0 ? "side-by-side" : "raw-delta",
    approximate: false,
    displayValue: `${left} vs ${right}`,
  };
}
```

`buildPostMatchReadViewModel()` must return exactly these top-level sections:

```js
{
  branding: { publicTitle, publicTitleEn },
  seriesContext: { league, seriesId, teamA, teamB, score, gameCount, scopeLabel },
  hook: { metric, leftRaw, rightRaw, displayValue, comparisonType, approximate, question },
  matchup: { ...matchupSegment, hasAllFiveRoles, claimScope, claim, scopeLabel },
  proof: { ...proofSegment, labelType, label, claim },
  assets: {},
  audioPlan: null,
  storyboard: [
    { tag: "HOOK", text: hookQuestion, durationInFrames: 54 },
    { tag: "MATCHUP_EDGE", text: matchupVerdict, durationInFrames: 96 },
    { tag: "PLAYER_PROOF", text: twist, durationInFrames: 120 },
    { tag: "CONCLUSION_CTA", text: `${verdict}\n${cta}`, durationInFrames: 90 },
  ],
}
```

Export `PUBLIC_COPY`, `REQUIRED_ROLES`, `POST_MATCH_READ_STORYBOARD`, `buildRatioHook`, `hasAllFiveRoleMatchups`, `proofLabelType`, and `buildPostMatchReadViewModel` for focused tests. Resolve the localized role label before calling the three copy functions, and exercise every role when deriving the required font glyph set.

Derive `gameCount` from `series.games.length`. Derive short team labels from explicit abbreviation fields when present; otherwise strip `Team`, `Esports`, and `Challengers` and use at most the first letters of the remaining words. Keep the full source team names in existing compatibility fields.

Run the focused test. Expected: PASS.

- [ ] **Step 3: RED → GREEN — recommended MVP is never presented as official MVP**

Add one test for `recommendedMvp: Pyeonsik` and assert:

```js
assert.equal(viewModel.proof.labelType, "data-mvp-candidate");
assert.equal(viewModel.proof.label, "數據 MVP 候選");
assert.doesNotMatch(viewModel.proof.claim, /官方/);
```

Run red, implement the minimum label routing, rerun green. Then add a separate vertical test proving only `series.officialMvp.name` produces `official-mvp`.

- [ ] **Step 4: RED → GREEN — zero denominator and low ratios never render infinity or fake multipliers**

Add two cases:

- `13.67 / 0.64` → `約 21×`, `comparisonType: ratio`, `approximate: true`.
- `5 / 0` → side-by-side, no `∞`, no `×`.

Run each red before its implementation adjustment.

- [ ] **Step 5: Integrate the view model while retaining the old payload boundary**

In `buildPlayerRadarPayload()`:

- keep `dataType`, `matchContext`, `matchupSegment`, `proofSegment`, `player`, `radarStats`, `highlight`, `weakness`, and `verdict`;
- set the public `title` to `賽後判讀` / `POST MATCH READ`, never `選手雷達` / `Player Radar`;
- attach `postMatchRead` from the new builder;
- set root `storyboard` to `postMatchRead.storyboard` for compatibility;
- pass `selection` into the builder so manual matchup selection is never described as the series maximum.

Keep legacy `proofSegment.proofType` only for API compatibility. Add `proofSegment.labelType` and ensure all visible copy comes from the safe label.

Extend `assertPlayerRadarEvidence()` to reject a `PLAYER_RADAR` payload if:

- `postMatchRead` is missing;
- storyboard tags are not the required four in order;
- durations do not total 360;
- ratio hooks have a zero denominator;
- `approximate: true` lacks `約` in Chinese;
- a non-`official-mvp` proof label contains `官方 MVP`.

Run:

```bash
node --test tests/unit/esports/postMatchReadBuilder.test.js tests/unit/esports/playerRadarRunner.test.js tests/unit/apiBoundaryContracts.test.js
```

Expected: all green; existing split/manual selection behavior remains supported.

- [ ] **Step 6: Refactor and commit**

Run:

```bash
rg -n 'Player Radar|選手雷達|MVP 證明|MVP proof' utils/esports/playerRadarRunner.js utils/esports/postMatchReadBuilder.js
git diff --check
git add utils/esports/postMatchReadBuilder.js utils/esports/playerRadarRunner.js utils/esports/playerRadarEvidence.js tests/unit/esports/postMatchReadBuilder.test.js tests/unit/esports/playerRadarRunner.test.js tests/unit/apiBoundaryContracts.test.js
git commit -m "feat: build honest post match read story model"
```

Expected `rg`: internal error identifiers may retain `Player Radar`; no value assigned to visible `title`, storyboard text, proof label, or verdict may retain it.

---

### Task 3: Resolve official champion assets and repository-hosted Chinese display type

**Files:**

- Create: `utils/render/playerRadarAssetPlanner.js`
- Create: `tests/unit/render/playerRadarAssetPlanner.test.js`
- Create: `tests/contract/render/dataDragonContract.test.js`
- Modify: `utils/render/renderService.js`
- Modify: `utils/render/remoteAssetCache.js`
- Modify: `tests/unit/render/renderService.test.js`
- Create: `scripts/buildPostMatchReadFont.sh`
- Create: `config/post-match-read-font-glyphs.txt`
- Create: `public/fonts/NotoSerifTC-PostMatchRead-700.woff2`
- Create: `public/fonts/OFL-NotoSerifTC.txt`
- Modify: `src/video-system/localFonts.css`
- Modify: `tests/unit/render/localFonts.test.js`
- Modify: `THIRD_PARTY_ASSETS.md`

- [ ] **Step 1: RED — splash failure falls back to the official square icon**

Add a focused planner test using injected cache results:

```js
test("resolvePlayerRadarAssets uses the official square icon when splash fetch fails", async () => {
  const resolved = await resolvePlayerRadarAssets(makeViewModel("Xin Zhao"), {
    cacheRemoteImageUrlImpl: async (url) => {
      if (url.includes("/splash/")) return RENDER_ASSET_FALLBACK_PUBLIC_PATH;
      return url.includes("/champion/") ? "/render-assets/xinzhao-square.png" : "/render-assets/supporting.png";
    },
  });

  assert.equal(resolved.matchup.edge.mode, "square-map");
  assert.equal(resolved.matchup.edge.src, "/render-assets/xinzhao-square.png");
  assert.doesNotMatch(resolved.matchup.edge.src, /missing-image/);
});
```

Run:

```bash
node --test tests/unit/render/playerRadarAssetPlanner.test.js
```

Expected: FAIL with module-not-found.

- [ ] **Step 2: GREEN — build and resolve the explicit Data Dragon request graph**

Create these URL builders using the same pinned `DDRAGON_RENDER_VERSION` as `remoteAssetCache.js`:

```js
const championSplashUrl = (id) =>
  `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${id}_0.jpg`;
const championSquareUrl = (version, id) =>
  `https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${id}.png`;
const smiteUrl = (version) =>
  `https://ddragon.leagueoflegends.com/cdn/${version}/img/spell/SummonerSmite.png`;
const mapUrl = (version) =>
  `https://ddragon.leagueoflegends.com/cdn/${version}/img/map/map11.png`;
```

The planner must request:

- matchup edge champion splash + square;
- matchup opponent champion splash + square;
- proof player’s first three champion square icons;
- Smite and Summoner’s Rift map.

After cache localization, expose only local `/render-assets/...` paths. Final per-hero state is:

```js
{ championName, mode: "splash", src, squareSrc }
// or
{ championName, mode: "square-map", src: squareSrc, mapSrc }
```

Run focused test. Expected: PASS.

- [ ] **Step 3: RED → GREEN — block rendering when both official hero sources fail**

Add a test where both splash and square resolve to `RENDER_ASSET_FALLBACK_PUBLIC_PATH`; assert rejection:

```text
Post Match Read official champion art unavailable for Xin Zhao: splash and square both failed.
```

Do not return the generic fallback. Run red, add the guard, rerun green.

When square fallback is used, require a valid map asset. If Smite fails, expose `smiteSrc: null` and keep the visible `JUNGLE` text; do not substitute the generic image.

- [ ] **Step 4: Integrate planning before Remotion props are written**

In `renderService.js`:

1. `prepareProps()` normalizes and validates the source-backed view model without fetching.
2. For `PLAYER_RADAR`, `resolvePlayerRadarAssets()` builds the official URLs, calls the injected `cacheRemoteImageUrl()` for each request, chooses splash/square fallback, and throws if the core pair is unusable.
3. Attach the resolver's local `/render-assets/...` paths under `postMatchRead.assets`.
4. `localizeRemoteImageAssets()` handles unrelated legacy remote fields without replacing the already-local Player Radar paths.
5. Only then may `renderOne()` write the temporary props JSON.

Add a render-service test that verifies an asset failure throws before `execRenderImpl` and before any `props_*.json` remains. Run:

```bash
node --test tests/unit/render/playerRadarAssetPlanner.test.js tests/unit/render/renderService.test.js
```

- [ ] **Step 5: Add a real Data Dragon contract test**

Create a test guarded exactly like the existing LoLalytics contract tests:

```js
test("Data Dragon exposes a champion square, splash, Smite, and map image", async (t) => {
  if (process.env.RUN_EXTERNAL_CONTRACTS !== "1") {
    return t.skip("Set RUN_EXTERNAL_CONTRACTS=1 to verify the live Data Dragon boundary.");
  }
  const urls = [
    "https://ddragon.leagueoflegends.com/cdn/16.9.1/img/champion/XinZhao.png",
    "https://ddragon.leagueoflegends.com/cdn/img/champion/splash/XinZhao_0.jpg",
    "https://ddragon.leagueoflegends.com/cdn/16.9.1/img/spell/SummonerSmite.png",
    "https://ddragon.leagueoflegends.com/cdn/16.9.1/img/map/map11.png",
  ];
  for (const url of urls) {
    const response = await fetch(url);
    assert.equal(response.ok, true, url);
    assert.match(response.headers.get("content-type") || "", /^image\//, url);
    assert.ok((await response.arrayBuffer()).byteLength > 1000, url);
  }
});
```

Run once with the flag. If the network is unavailable, report the contract as unavailable; do not replace it with a mock claim.

- [ ] **Step 6: RED — fixed Chinese copy must be covered by the declared font subset**

Extend `localFonts.test.js` to:

- collect every Han character in `PUBLIC_COPY` and the four storyboard strings;
- compare them against `config/post-match-read-font-glyphs.txt`;
- assert the WOFF2 SHA-256 is `22cfa6a3c60cb2b314d451958213a0a65ce9f0af4d4aa3c28796937be725c830`;
- assert `localFonts.css` registers `Noto Serif TC Post Match Read` at weight 700 with `font-display: block`.

Run the test before the files exist. Expected: FAIL.

- [ ] **Step 7: GREEN — add the reproducible OFL subset build**

`scripts/buildPostMatchReadFont.sh` must:

1. create a private `mktemp -d` directory and clean only that exact directory on exit;
2. create a venv in it;
3. install `fonttools[woff]==4.63.0` and `brotli==1.2.0`;
4. download the official font from pinned Google Fonts commit `73fc2ff52147e34a74804b500cf89ca219eac55d`;
5. verify source SHA-256 `0077e18f57c6908f4a000969880940bdb0dad057c0e8d98b49dc364c3d1b09c6`;
6. instantiate `wght=700`;
7. subset using the exact contents of `config/post-match-read-font-glyphs.txt` and the same `pyftsubset` flags used during plan calibration;
8. verify output SHA-256 `22cfa6a3c60cb2b314d451958213a0a65ce9f0af4d4aa3c28796937be725c830` before replacing `public/fonts/NotoSerifTC-PostMatchRead-700.woff2`.

The glyph file is one UTF-8 line plus a final newline, exactly:

```text
賽後判讀這個系列賽，打野差距有多誇張？明顯五路之中最大不是小贏是整個系列賽的斷層。但真正把優勢變成傷害的在下路拉開局勢勝利下一場你想看哪條路數據候選關鍵人物官方三局平均上路中路輔助紅方藍方對位來源英雄傷害每分鐘補刀 ／–ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789×~%./:+-
```

Use this source URL:

```text
https://raw.githubusercontent.com/google/fonts/73fc2ff52147e34a74804b500cf89ca219eac55d/ofl/notoseriftc/NotoSerifTC%5Bwght%5D.ttf
```

Use these subset flags:

```bash
--flavor=woff2 --layout-features='*' --glyph-names --symbol-cmap \
--legacy-cmap --notdef-glyph --notdef-outline --recommended-glyphs \
--name-IDs='*' --name-legacy --name-languages='*'
```

Keep Noto Serif TC’s separate OFL text in `public/fonts/OFL-NotoSerifTC.txt`. Add provenance and SHA to `THIRD_PARTY_ASSETS.md`.

Add to `localFonts.css`:

```css
@font-face {
  font-family: "Noto Serif TC Post Match Read";
  src: url("/public/fonts/NotoSerifTC-PostMatchRead-700.woff2") format("woff2");
  font-style: normal;
  font-weight: 700;
  font-display: block;
}
```

Run the build twice and verify the same hash both times. Then run:

```bash
node --test tests/unit/render/localFonts.test.js tests/unit/render/playerRadarAssetPlanner.test.js tests/unit/render/renderService.test.js
```

Expected: PASS.

- [ ] **Step 8: Refactor and commit**

Run:

```bash
git diff --check
git add utils/render/playerRadarAssetPlanner.js utils/render/renderService.js utils/render/remoteAssetCache.js tests/unit/render/playerRadarAssetPlanner.test.js tests/unit/render/renderService.test.js tests/contract/render/dataDragonContract.test.js scripts/buildPostMatchReadFont.sh config/post-match-read-font-glyphs.txt public/fonts/NotoSerifTC-PostMatchRead-700.woff2 public/fonts/OFL-NotoSerifTC.txt src/video-system/localFonts.css tests/unit/render/localFonts.test.js THIRD_PARTY_ASSETS.md
git commit -m "feat: resolve official post match read assets and typography"
```

---

### Task 4: Select verified 12-second music segments and render a non-silent opening

**Files:**

- Modify: `config/licensed-music-library.json`
- Modify: `utils/render/licensedMusicLibrary.js`
- Create: `utils/render/postMatchReadAudioPlan.js`
- Modify: `utils/render/renderService.js`
- Modify: `src/video-system/BgmLayer.jsx`
- Modify: `tests/unit/render/licensedMusicLibrary.test.js`
- Create: `tests/unit/render/postMatchReadAudioPlan.test.js`
- Create: `tests/integration/render/postMatchReadAudioSegments.test.js`

- [ ] **Step 1: RED — music without a valid 12-second beat segment is ineligible**

Add a test track that is enabled, verified, and SHA-valid but has no `safeSegments`; assert it is skipped. Add a second valid track and assert the valid track is selected with an `audioPlan`.

Run:

```bash
node --test tests/unit/render/licensedMusicLibrary.test.js
```

Expected: FAIL because today the selector ignores beat metadata.

- [ ] **Step 2: GREEN — add calibrated segment metadata for all three approved tracks**

Extend each existing track with one `post-match-read-12s` safe segment. Preserve the existing file hashes exactly.

Use the plan-calibrated measurements:

```json
{
  "licensed-bgm-1": {
    "startSeconds": 1.976,
    "durationSeconds": 12,
    "downbeats": [1.976, 4.628, 7.28, 9.932, 12.584],
    "measuredIntegratedLufs": -9.9,
    "measuredTruePeakDbfs": -0.1,
    "gain": 0.4417
  },
  "licensed-bgm-2": {
    "startSeconds": 3.833,
    "durationSeconds": 12,
    "downbeats": [3.833, 7.226, 10.618, 14.01],
    "measuredIntegratedLufs": -17.8,
    "measuredTruePeakDbfs": -2.1,
    "gain": 1.0715
  },
  "licensed-bgm-3": {
    "startSeconds": 1.228,
    "durationSeconds": 12,
    "downbeats": [1.228, 2.634, 4.039, 5.445, 6.851, 8.256, 9.662, 11.067, 12.473],
    "measuredIntegratedLufs": -12.1,
    "measuredTruePeakDbfs": 0.6,
    "gain": 0.568
  }
}
```

Each actual JSON segment also includes:

```json
{
  "id": "post-match-read-12s",
  "targetIntegratedLufs": -17,
  "fadeMilliseconds": 34,
  "maxLeadingSilenceMilliseconds": 50
}
```

The selector is eligible only when:

- track SHA matches;
- the track is enabled and verified;
- a safe segment duration is at least 12 seconds;
- `startSeconds`, `gain`, and every downbeat are finite;
- at least one downbeat falls inside the segment.

Return:

```js
{
  trackId,
  title,
  bgmFile,
  audioPlan: {
    trackId,
    sourceStartSeconds,
    durationInFrames: 360,
    cutFrames,
    gain,
    fadeFrames: 2,
  },
}
```

At 30fps, use two fade frames (66.7ms visual envelope; the source has audible energy inside 50ms) to avoid an audio click while still starting on frame zero.

- [ ] **Step 3: RED → GREEN — scene cuts may snap only within six frames**

Test `buildPostMatchReadAudioPlan()` with synthetic downbeats around target cuts `[54, 150, 270]`. Assert:

- a downbeat at frame 58 snaps 54 → 58;
- a downbeat at frame 158 does not snap 150 because it is eight frames away;
- frame 0 and frame 360 never move;
- the final scene remains at least 30 frames.

Run red, implement nearest-downbeat snapping with a six-frame maximum, rerun green.

- [ ] **Step 4: RED → GREEN — Remotion trims instead of looping and applies the fade envelope**

Update `BgmLayer` to accept `{ bgmFile, audioPlan }` and render:

```jsx
const { fps } = useVideoConfig();
const trimBefore = Math.round(audioPlan.sourceStartSeconds * fps);
const trimAfter = trimBefore + audioPlan.durationInFrames;
const volume = (frame) => {
  const fadeIn = interpolate(frame, [0, audioPlan.fadeFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const fadeOut = interpolate(
    frame,
    [audioPlan.durationInFrames - audioPlan.fadeFrames, audioPlan.durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.in(Easing.cubic) }
  );
  return audioPlan.gain * Math.min(fadeIn, fadeOut);
};

return <Audio src={staticFile(bgmFile)} trimBefore={trimBefore} trimAfter={trimAfter} volume={volume} />;
```

Remove `loop` for this planned segment. Keep the existing generic `volume` fallback only for non-Player-Radar templates.

In `renderService.js`, select music once before localized payload rendering and copy the same `audioPlan` into both root props and `postMatchRead.audioPlan` for bilingual renders.

Run:

```bash
node --test tests/unit/render/postMatchReadAudioPlan.test.js tests/unit/render/licensedMusicLibrary.test.js tests/unit/render/renderService.test.js
```

- [ ] **Step 5: Verify real source segments with FFmpeg**

Create an integration test that spawns FFmpeg without a shell for each of the three configured segments. It must:

- apply the configured gain and fades;
- confirm `silencedetect=noise=-45dB:d=0.05` does not report an opening silence longer than 50ms after the fade window;
- parse the final `ebur128=peak=true` summary;
- assert integrated loudness is from -18 to -16 LUFS;
- assert true peak is at most -1 dBFS.

Run:

```bash
node --test tests/integration/render/postMatchReadAudioSegments.test.js
```

Expected: all three real licensed files pass. If a measurement falls outside tolerance, update only that track’s measured gain based on the actual FFmpeg result and rerun; do not lower the product threshold.

- [ ] **Step 6: Block a silent Player Radar render when every track is invalid**

Add a render-service test where the music selector returns `null` for `PLAYER_RADAR`; assert rejection before `execRenderImpl`:

```text
Post Match Read requires a verified 12-second licensed music segment.
```

Keep explicit mute support for other composition types.

- [ ] **Step 7: Refactor and commit**

Run:

```bash
git diff --check
git add config/licensed-music-library.json utils/render/licensedMusicLibrary.js utils/render/postMatchReadAudioPlan.js utils/render/renderService.js src/video-system/BgmLayer.jsx tests/unit/render/licensedMusicLibrary.test.js tests/unit/render/postMatchReadAudioPlan.test.js tests/integration/render/postMatchReadAudioSegments.test.js
git commit -m "feat: align licensed music to post match read beats"
```

---

### Task 5: Isolate preview/test stores and gate queue creation on the rendered media

**Files:**

- Modify: `utils/esports/candidateStore.js`
- Modify: `utils/esports/dailyPipeline.js`
- Modify: `utils/esports/playerRadarRunner.js`
- Create: `utils/render/postMatchReadValidation.js`
- Create: `tests/unit/render/postMatchReadValidation.test.js`
- Modify: `tests/unit/esports/candidates.test.js`
- Modify: `tests/unit/esports/dailyPipeline.test.js`
- Modify: `tests/unit/esports/playerRadarRunner.test.js`
- Modify: `tests/unit/publishing/queueIsolation.test.js`
- Modify: `app/api/esports/player-radar/route.js`
- Modify: `tests/unit/esports/playerRadarRoute.test.js`

- [ ] **Step 1: RED — candidate storage must follow operation-time cwd**

Add the same two-directory regression pattern already used for queue and run stores:

1. load `candidateStore.js` in directory A;
2. change to directory B;
3. write and read a snapshot;
4. assert A has no `.data/esports-candidate-scans.json` and B contains the snapshot.

Run:

```bash
node --test tests/unit/esports/candidates.test.js
```

Expected: FAIL because `DATA_DIR` and `STORE_PATH` are currently fixed at module load.

- [ ] **Step 2: GREEN — resolve candidate paths per operation**

Match the safe `queueStore`/`runStore` pattern:

```js
function getDataDir(cwd = process.cwd()) {
  return path.join(cwd, ".data");
}
function getStorePath(cwd = process.cwd()) {
  return path.join(getDataDir(cwd), "esports-candidate-scans.json");
}
```

Every read/write calls these functions at operation time. Export backward-compatible getters via `Object.defineProperties`, not fixed constants.

Run focused test. Expected: PASS.

- [ ] **Step 3: RED → GREEN — dry-run daily pipeline does not write daily-run history**

In `dailyPipeline.test.js`, inject an `upsertRun` spy into a dry run and assert it has zero calls. Run red, then change the final write to:

```js
if (!dryRun) upsertRun(run);
```

The dry-run result object is still returned to the caller; only persistent history is suppressed.

- [ ] **Step 4: RED — preview Player Radar renders but never invokes publishing**

Add a runner test with `mode: "preview"`, an injected renderer, validator, and a `createPublishJobs` spy. Assert:

```js
assert.equal(renderCalls, 1);
assert.equal(validateCalls, 1);
assert.equal(publishCalls, 0);
assert.deepEqual(result.publish, {
  success: true,
  action: "none",
  jobs: [],
  reason: "preview",
});
```

Run red. Implement `resolvePlayerRadarRunMode()` with supported values `production`, `preview`, `dry-run`, and `test`; `dryRun: true` maps to `dry-run`; omitted mode remains `production` for API compatibility.

- [ ] **Step 5: RED — failed media validation preserves the render but blocks the queue**

Add a production-mode runner test whose renderer returns a video but validator returns `{ passed: false, reasons: ["audio loudness -25 LUFS"] }`. Assert rejection and zero publish calls.

Run red before implementing the validator boundary.

- [ ] **Step 6: GREEN — implement the read-only ffprobe/FFmpeg validation gate**

`postMatchReadValidation.js` exports:

```js
async function inspectPostMatchReadMedia(video, { cwd = process.cwd(), execFileImpl } = {})
function validatePostMatchReadMediaReport(report = {})
async function validatePostMatchReadRender(video, options = {})
```

Resolve the file only under `public/renders/`. Invoke binaries without a shell:

```js
await execFileImpl("ffprobe", [
  "-v", "error",
  "-show_entries", "format=duration:stream=index,codec_type,codec_name,width,height,r_frame_rate",
  "-of", "json",
  filePath,
]);

await execFileImpl("ffmpeg", [
  "-hide_banner", "-nostats", "-i", filePath,
  "-filter_complex", "ebur128=peak=true",
  "-f", "null", "-",
]);
```

The report passes only when:

- video codec is H.264;
- audio codec is AAC;
- size is 1080×1920;
- frame rate is 30fps within 0.01;
- duration is 12.0 seconds within 0.08;
- integrated loudness is -18 to -16 LUFS;
- true peak is at most -1 dBFS.

Return `{ passed, reasons, media }`; do not create or edit any store. The runner validates every localized video before `createPublishJobs`. On failure, throw `new Error("Post Match Read validation failed: " + report.reasons.join("; "))` after the MP4 remains on disk.

Run:

```bash
node --test tests/unit/render/postMatchReadValidation.test.js tests/unit/esports/playerRadarRunner.test.js
```

- [ ] **Step 7: Add filesystem integration coverage for all forbidden preview writes**

Extend `queueIsolation.test.js` with a temp root and real filesystem assertions after a preview run:

```js
for (const forbidden of [
  ".data/publish-queue.json",
  ".data/esports-daily-runs.json",
  "public/publish-packages",
]) {
  assert.equal(fs.existsSync(path.join(activeProject, forbidden)), false, forbidden);
}
```

Also require/import queue, run, and publishing modules without performing a production operation and assert the three forbidden targets remain absent.

- [ ] **Step 8: Route errors retain an actionable 400 response**

Update the Player Radar route’s public fallback message to `賽後判讀產生失敗。`. Ensure `Post Match Read validation failed`, asset fallback exhaustion, and missing beat-segment errors map to HTTP 400, not 500. Update route tests accordingly.

Run:

```bash
node --test tests/unit/esports/candidates.test.js tests/unit/esports/dailyPipeline.test.js tests/unit/esports/playerRadarRunner.test.js tests/unit/esports/playerRadarRoute.test.js tests/unit/publishing/queueIsolation.test.js tests/unit/render/postMatchReadValidation.test.js
```

- [ ] **Step 9: Refactor and commit**

Run:

```bash
git diff --check
git add utils/esports/candidateStore.js utils/esports/dailyPipeline.js utils/esports/playerRadarRunner.js utils/render/postMatchReadValidation.js tests/unit/render/postMatchReadValidation.test.js tests/unit/esports/candidates.test.js tests/unit/esports/dailyPipeline.test.js tests/unit/esports/playerRadarRunner.test.js tests/unit/publishing/queueIsolation.test.js app/api/esports/player-radar/route.js tests/unit/esports/playerRadarRoute.test.js
git commit -m "fix: isolate preview renders from publishing stores"
```

---

### Task 6: Replace the old dashboard template with the continuous four-scene hero story

**Files:**

- Rewrite: `src/templates/Template_PlayerRadar.jsx`
- Delete: `src/templates/playerRadarHelpers.js`
- Modify: `src/Composition.jsx`
- Modify: `src/Root.jsx`
- Modify: `src/video-system/BgmLayer.jsx`
- Modify: `tests/unit/render/compositionScope.test.js`
- Modify: `tests/unit/render/pacing.test.js`
- Modify: `tests/unit/render/localFonts.test.js`

- [ ] **Step 1: RED — Player Radar metadata must be exactly 360 frames**

Add a focused pacing/metadata test contract asserting:

- storyboard durations are `[54, 96, 120, 90]`;
- total is 360;
- Player Radar narration lead is 0;
- Player Radar final buffer is 0;
- the existing default lead/buffer for other templates remains unchanged.

Run:

```bash
node --test tests/unit/render/pacing.test.js
```

Expected: FAIL because `calculatePacing()` adds 35 frames and `calculateMetadata()` adds another 30.

- [ ] **Step 2: GREEN — make lead and buffer data-type aware**

Change the pacing API without altering default callers:

```js
export const calculatePacing = (storyboard, fps, { narrationStart = 35 } = {}) => {
  // existing duration calculation
};
```

In `Root.jsx`:

```js
const isPostMatchRead = props.data.dataType === "PLAYER_RADAR";
const narrationStart = isPostMatchRead ? 0 : 35;
const finalBuffer = isPostMatchRead ? 0 : 30;
const pacing = calculatePacing(storyboard, fps, { narrationStart });
```

Export a small pure metadata helper if needed for the Node test; do not make the test depend only on source regex.

Run focused test. Expected: PASS.

- [ ] **Step 3: RED — the template must render only the resolved view model and new public brand**

Replace the old Player Radar source assertions with contracts that require:

```text
POST MATCH READ
postMatchRead
SharedHextechThread
HeroField
HookScene
MatchupScene
ProofScene
VerdictScene
Noto Serif TC Post Match Read
```

and reject:

```text
PLAYER RADAR
MATCH DATA / PERFORMANCE
PipelineChrome
PipelineBadge
SubtitleCaption
HextechBackground
RadarChart
BroadcastPanel
```

Run:

```bash
node --test tests/unit/render/compositionScope.test.js
```

Expected: FAIL against the old 900-line dashboard template.

- [ ] **Step 4: GREEN — implement one persistent art field and four lightweight scene layers**

Rewrite `Template_PlayerRadar.jsx` around this structure:

```jsx
export const Template_PlayerRadar = ({ data }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const model = data.postMatchRead;
  const timeline = buildTimeline(model.storyboard, fps, 0);

  return (
    <AbsoluteFill style={{ background: "#010A13", color: "#F0E6D2", overflow: "hidden" }}>
      <HeroField model={model} frame={frame} timeline={timeline} />
      <SharedHextechThread frame={frame} timeline={timeline} />
      <BrandLine title="POST MATCH READ" context={model.seriesContext} />
      <SceneLayer timeline={timeline} frame={frame} tag="HOOK"><HookScene model={model} /></SceneLayer>
      <SceneLayer timeline={timeline} frame={frame} tag="MATCHUP_EDGE"><MatchupScene model={model} /></SceneLayer>
      <SceneLayer timeline={timeline} frame={frame} tag="PLAYER_PROOF"><ProofScene model={model} /></SceneLayer>
      <SceneLayer timeline={timeline} frame={frame} tag="CONCLUSION_CTA"><VerdictScene model={model} /></SceneLayer>
      <BgmLayer bgmFile={data.bgmFile} audioPlan={model.audioPlan || data.audioPlan} />
    </AbsoluteFill>
  );
};
```

Implementation rules:

- `HeroField` occupies roughly 60–70% of the frame and uses resolved official `Img` sources through `resolveRenderAssetSrc()`.
- Hero scale moves only from 1.00 to at most 1.03 over 360 frames.
- Hook shows the two matchup champions, central angular crack, score context, `約 21×`, then the question. The number is the only gold focal point.
- Matchup turns the same crack into a comparison axis. Show `JUNGLE`, Smite when available, the two names, `13.7 KDA` vs `0.64 KDA`, and `3-game series average`.
- Proof continues the same line into Pyeonsik’s first three actual champions. Show `806 DPM` as the single focal number, `9.77 CS/min`, and `數據 MVP 候選`.
- Verdict dims hero art and reveals `打野拉開局勢，下路把優勢變成勝利。` plus the CTA. Clamp all motion to local frame 60 so frames 330–359 are fully still.
- Use `Easing.out(Easing.cubic)` for entrances and `Easing.in(Easing.cubic)` for faster exits; do not use linear easing.
- Crossfade adjacent scenes for at most eight frames. Keep `SharedHextechThread` mounted across all scenes so the space does not hard-switch.
- Core numbers and English headings use Cinzel; compact labels use Outfit; Chinese display text uses `Noto Serif TC Post Match Read`.
- Use palette only from `#010A13`, `#0A1428`, `#C8AA6E`, `#785A28`, `#0AC8B9`, `#CDFAFA`, and `#F0E6D2`, plus alpha variants.
- Do not use rounded dashboard cards, full-page duplicate borders, decorative particle arrays, repeated lower thirds, or spring badges.

Once the replacement no longer imports `playerRadarHelpers.js`, verify no remaining consumer and delete it:

```bash
rg -n "playerRadarHelpers" src tests
```

Expected before deletion: only obsolete tests/import. Expected after test updates: no matches.

- [ ] **Step 5: Update the Remotion preview fixture to the approved HLE–BRO story**

In `Root.jsx`, keep `dataType: "PLAYER_RADAR"` but change public data to the accepted canary:

- HLE Challengers 2–1 HANJIN BRION Challengers;
- Jackal vs Dinai, Jungle, 13.67 vs 0.64 KDA;
- Pyeonsik, 806 DPM, 9.77 CSM, Lucian/Varus/Ezreal;
- resolved local fixture asset paths or official remote request paths that the existing cache localizes;
- exact four-scene `postMatchRead` model and audio plan.

Do not use `MVP` without `數據 MVP 候選`.

- [ ] **Step 6: Refactor, focused verify, and commit**

Run:

```bash
node --test tests/unit/render/pacing.test.js tests/unit/render/compositionScope.test.js tests/unit/render/localFonts.test.js
npm run qa:render
rg -n 'PLAYER RADAR|MATCH DATA / PERFORMANCE|PipelineChrome|PipelineBadge|SubtitleCaption|HextechBackground|Array\.from\(\{ length: 26' src/templates/Template_PlayerRadar.jsx
git diff --check
git add src/templates/Template_PlayerRadar.jsx src/Composition.jsx src/Root.jsx src/video-system/BgmLayer.jsx tests/unit/render/compositionScope.test.js tests/unit/render/pacing.test.js tests/unit/render/localFonts.test.js
git add -u src/templates/playerRadarHelpers.js
git commit -m "feat: rebuild post match read video"
```

Expected: focused tests and six QA stills pass; banned source patterns return no matches.

---

### Task 7: Render the real HLE–BRO canary, perform two visual/audio review rounds, and ship safely

**Files:**

- Create: `scripts/renderPostMatchReadCanary.js`
- Create: `tests/unit/render/postMatchReadCanary.test.js`
- Modify: `package.json`
- Modify: `HANDOFF.md`
- Runtime only, ignored: `public/renders/`, `public/render-assets/`, `.screenshots/`

- [ ] **Step 1: RED — canary command is preview-only by construction**

Create a unit test that loads the canary script’s exported option builder and asserts:

```js
assert.equal(options.mode, "preview");
assert.deepEqual(options.languages, ["zh"]);
assert.equal(Object.hasOwn(options, "scheduledAt"), false);
```

The script must reject any `--publish`, `--queue`, or production mode argument. Run red before the script exists.

- [ ] **Step 2: GREEN — add the explicit no-publish canary command**

Add:

```json
"canary:post-match-read": "node scripts/renderPostMatchReadCanary.js"
```

Default canary inputs:

```text
scanId: scan-2026-08-12-b509a93dc3
seriesId: LCK CL 2026 Rounds 3-4::2026-08-12::HANJIN BRION Challengers::Hanwha Life Esports Challengers
mode: preview
languages: zh
```

Inject snapshot reading with a large max age only in this preview command so the accepted frozen evidence remains reproducible; do not weaken the production API’s 24-hour snapshot rule. Print the final local video path, media validation report, selected track, and `publish.jobs.length`.

- [ ] **Step 3: Re-capture store fingerprints immediately before canary**

Use the exact Task 0 hash command and also record:

```bash
find public/publish-packages -type f -print 2>/dev/null | sort
```

Do not proceed if queue/daily/package state differs unexpectedly from the Task 0 baseline.

- [ ] **Step 4: Render and validate the first real canary**

Run:

```bash
canary_output=$(npm run canary:post-match-read)
printf '%s\n' "$canary_output"
canary_path=$(printf '%s\n' "$canary_output" | node -e '
let input = "";
process.stdin.on("data", (chunk) => { input += chunk; });
process.stdin.on("end", () => {
  const line = input.trim().split("\n").reverse().find((value) => value.startsWith("{"));
  if (!line) throw new Error("Canary JSON summary not found.");
  process.stdout.write(JSON.parse(line).videoPath);
});
')
test -f "$canary_path"
ffprobe -v error -show_entries format=duration:stream=codec_type,codec_name,width,height,r_frame_rate -of json "$canary_path"
ffmpeg -hide_banner -nostats -i "$canary_path" -filter_complex ebur128=peak=true -f null - 2>&1 | tail -n 18
```

Expected:

- H.264 + AAC;
- 1080×1920;
- 30fps;
- 12.0s within 0.08;
- -18 to -16 LUFS;
- true peak ≤ -1 dBFS;
- queue/daily/publish-package count unchanged;
- `publish.jobs.length === 0`.

- [ ] **Step 5: Visual/motion review round 1**

Apply `review-animations` inline. Extract frames at 0.0, 1.7, 1.9, 4.9, 5.1, 8.9, 9.1, and 11.0 seconds into `.screenshots/post-match-read-round1/`.

Inspect and explicitly report pass/fail for:

- first-second LoL recognition;
- one focal point per scene;
- hero face/body crop;
- Chinese wrapping and glyph consistency;
- raw units and 3-game scope;
- no official-MVP implication;
- gold/cyan thread continuity across both sides of every cut;
- no flash, layout jump, or hidden data;
- final frame fully still for at least one second;
- safe reading area when the 1080px frame is scaled to 375px width.

Also watch the full MP4 at 1× and listen for opening silence, cut pops, or a weak/over-loud bed. Record every failed item before editing.

- [ ] **Step 6: Fix only observed issues, rerun focused tests, and render round 2**

Use vertical TDD for any logic bug discovered during review. For purely visual constants, change one variable at a time and document the observed before/after result.

Render a fresh canary and extract the same timestamps to `.screenshots/post-match-read-round2/`. Do not reuse round-1 images for the final judgment. Repeat the full checklist and require every item to pass.

- [ ] **Step 7: Prove production stores are unchanged after the canary**

Rerun the Task 0 fingerprint and package commands. Expected: byte-identical content DB, queue, and daily-run states; no publish-package files; only ignored render/cache/screenshot files were created.

- [ ] **Step 8: Deliver the product-owner checkpoint before the full suite**

Explain, in plain Traditional Chinese:

1. capability: one source-backed 12-second match read;
2. user experience: hook → matchup proof → damage twist → verdict;
3. technical structure: story model → asset/audio planners → Remotion → validation gate;
4. data flow: Leaguepedia snapshot, Data Dragon cache, licensed audio, no queue in preview;
5. design reason: champions lead, one number per scene, continuous Hextech line;
6. fallback: square+map, blocked core asset, skipped invalid music;
7. safety/cost: no AI asset, no TTS, no publish side effect, local render cost only;
8. evidence: focused tests, ffprobe, loudness, two review rounds, hashes;
9. remaining limitations: no match footage, no production deployment target, Data Dragon can be temporarily unavailable.

Do not call the work complete before this checkpoint is delivered.

- [ ] **Step 9: Run the repository-wide acceptance suite**

Run once on the feature branch:

```bash
npm ci
npm run tdd:doctor
npm run test:coverage
npx next build
npm audit --audit-level=high
npm run qa:render
RUN_EXTERNAL_CONTRACTS=1 node --test tests/contract/render/dataDragonContract.test.js
```

Expected: all local tests/build/audit/render checks pass; external contract passes or is explicitly reported as network-unavailable with the unit/cache fallback evidence still green. Do not lower coverage or audit thresholds.

- [ ] **Step 10: Update handoff and commit final verification artifacts**

Update `HANDOFF.md` with:

- feature behavior and public name;
- final commit/test status;
- canary filename, SHA-256, media report, track ID;
- final round-2 screenshot paths only;
- before/after production-store hashes/counts;
- explicit statement that no queue/daily/publish package or social post was created;
- remaining limitations and no-deployment status.

Run:

```bash
git diff --check
git add scripts/renderPostMatchReadCanary.js tests/unit/render/postMatchReadCanary.test.js package.json HANDOFF.md
git commit -m "test: verify post match read canary"
```

- [ ] **Step 11: Merge to main, rerun full local verification, and push**

Run:

```bash
git switch main
git merge --ff-only codex/post-match-read-lol-native
npm run tdd:doctor
npm run test:coverage
npx next build
npm audit --audit-level=high
npm run qa:render
git push origin main
```

Then verify the remote contains the exact local SHA:

```bash
local_sha=$(git rev-parse HEAD)
remote_sha=$(git ls-remote origin refs/heads/main | awk '{print $1}')
test "$local_sha" = "$remote_sha"
gh run list --branch main --limit 5
```

Expected: local and remote SHA match; GitHub CI and CodeQL for the pushed commit complete successfully. The repository has no production deployment target, so do not create a new site or paid deployment.

## Final Acceptance Criteria

- `PLAYER_RADAR` compatibility identifiers remain, but the observer sees only `賽後判讀 / POST MATCH READ`.
- The real HLE–BRO canary is 360 frames / 12.0 seconds at 1080×1920 and 30fps.
- The first visual focal point is the official champion faceoff and `約 21×`; no generic esports dashboard dominates the frame.
- KDA/DPM/GPM/KP%/CSM/VPM are ranked by normalized gaps plus fixed role priority, never raw-unit magnitude.
- “最大差距” appears only with all five complete role matchups and automatic maximum selection.
- Pyeonsik is labeled `數據 MVP 候選`, not official MVP.
- Splash failure uses the official square+map fallback; splash+square failure blocks render.
- The selected existing licensed track starts on frame zero, meets -18 to -16 LUFS and ≤ -1 dBFS true peak, and uses no loop.
- Preview/test/dry-run/import leave queue, daily-run, and publish-package stores byte-identical or absent.
- Production queue creation occurs only after data, asset, video, and audio validation pass.
- Two fresh visual/motion review rounds pass; final screenshots are documented in `HANDOFF.md`.
- Full tests, coverage, Next build, audit, QA renders, GitHub CI, and CodeQL pass without lowered gates.
