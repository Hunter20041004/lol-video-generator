# Player Radar Dual-Read Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `PLAYER_RADAR` so one rendered video contains a maximum matchup edge segment plus an MVP or key-player proof segment.

**Architecture:** Keep `/api/esports/player-radar` and the existing render/publish flow. Move the content contract from a single-player radar payload to a dual-read payload built inside `utils/esports/playerRadarRunner.js`, then update schema fallback, Remotion template scenes, and the workbench inputs that control the selectors.

**Tech Stack:** Node.js `node:test`, Next.js 16 App Router, React 19, Remotion 4.0.450, Zod 4.

## Global Constraints

- TDD is mandatory: one failing test, verify red, minimal implementation, verify green, refactor while green.
- `PLAYER_RADAR` still produces one render output per locale, not two separate videos.
- Do not merge Player Radar into Daily Esports, H2H Radar, or Match Recap.
- Use only scan snapshot data: series, players, role matchups, raw stats, radar stats, and recommended MVP.
- Do not invent in-game events, timing, dragon fights, Baron fights, voice comms, or player mindset.
- If a user specifies a player that is not in the snapshot, fail clearly instead of choosing a fallback player.
- If a matchup segment or proof segment has fewer than two verifiable reasons, block render and do not queue publish jobs.
- Preserve existing IG and Threads publish behavior.
- Before each commit, run `git status --short` and stage only files changed by that task.

---

## File Structure

- Modify `tests/unit/esports/playerRadarRunner.test.js`
  - Owns runner behavior tests for automatic selection, overrides, errors, render count, and payload shape.
- Modify `utils/esports/playerRadarRunner.js`
  - Owns Player Radar selector logic and payload construction.
  - Produces `matchupSegment`, `proofSegment`, and the four-scene storyboard.
- Modify `src/schemas/pipelineSchemas.js`
  - Owns normalized payload defaults and fallback storyboard when render requests omit storyboard data.
- Modify `tests/unit/pipelineRegistry.test.js`
  - Adds schema normalization assertions for new Player Radar segment fields.
- Modify `tests/unit/render/compositionScope.test.js`
  - Owns source-level render/template contract tests.
- Modify `src/templates/Template_PlayerRadar.jsx`
  - Owns the final Remotion visual scenes.
- Modify `tests/unit/metaFactory/workbenchStatic.test.js`
  - Owns static workbench contract tests.
- Modify `app/page.jsx`
  - Owns workbench input state and `/api/esports/player-radar` request body.

Shared interfaces introduced by this plan:

```js
buildPlayerRadarPayload(series, selection, locale)

// selection
{
  playerName?: string,
  mvpPlayerName?: string,
  matchupPlayerName?: string
}

// payload additions
{
  matchupSegment: {
    role: string,
    focusPlayer: PlayerSummary,
    edgePlayer: PlayerSummary,
    opponentPlayer: PlayerSummary,
    edgeWinnerTeam: string,
    edgeScore: number,
    edgeType: "winner-breakpoint" | "loser-highlight",
    reasons: MatchupReason[]
  },
  proofSegment: {
    player: PlayerSummary,
    proofType: "mvp" | "key-player",
    isRecommendedMvp: boolean,
    proofStats: ProofReason[],
    proofReasons: ProofReason[],
    verdict: string
  }
}
```

`focusPlayer` is the player the user or automatic selector is focusing the matchup segment on. `edgePlayer` remains the data winner of the matchup, so manual selection still works when the specified player is the lower-scored side.

---

### Task 1: Dual-Read Selectors and Automatic Payload

**Files:**
- Modify: `tests/unit/esports/playerRadarRunner.test.js`
- Modify: `utils/esports/playerRadarRunner.js`

**Interfaces:**
- Consumes: existing `buildPlayerRadarPayload(series, player, locale)` export.
- Produces: `buildPlayerRadarPayload(series, selection, locale)` with `matchupSegment`, `proofSegment`, and legacy `player` compatibility.

- [ ] **Step 1: Write the failing test**

Replace the current `makeSnapshot()` helper in `tests/unit/esports/playerRadarRunner.test.js` with this helper so every new test has ten players and five role matchups:

```js
const ROLES = ["Top", "Jungle", "Mid", "Adc", "Support"];

function makePlayer(team, role, name, values = {}) {
  const isSupport = role === "Support";
  const rawStats = {
    role,
    kills: values.kills ?? 4,
    deaths: values.deaths ?? 2,
    assists: values.assists ?? 8,
    kda: values.kda ?? 6,
    dpm: values.dpm ?? 520,
    kp: values.kp ?? 0.7,
    gpm: values.gpm ?? 420,
    csm: isSupport ? 0.8 : values.csm ?? 8.1,
    vpm: isSupport ? values.vpm ?? 2.4 : values.vpm ?? 1.1,
  };
  const roleMetric = isSupport
    ? { label: "VPM", rawValue: String(rawStats.vpm), normalizedScore: values.roleScore ?? 70 }
    : { label: "CSM", rawValue: String(rawStats.csm), normalizedScore: values.roleScore ?? 70 };

  return {
    name,
    team,
    role,
    champions: [`${role} Champ`],
    rawStats,
    radarStats: [
      { label: "KDA", rawValue: String(rawStats.kda), normalizedScore: values.kdaScore ?? 70 },
      { label: "DPM", rawValue: String(rawStats.dpm), normalizedScore: values.dpmScore ?? 70 },
      { label: "KP%", rawValue: `${Math.round(rawStats.kp * 100)}%`, normalizedScore: values.kpScore ?? 70 },
      { label: "GPM", rawValue: String(rawStats.gpm), normalizedScore: values.gpmScore ?? 70 },
      roleMetric,
    ],
  };
}

function makeSnapshot() {
  const left = {
    Top: makePlayer("T1", "Top", "T1 Top", { kdaScore: 62, dpmScore: 60, kpScore: 61, gpmScore: 62, roleScore: 63, dpm: 470, kp: 0.58, gpm: 380, csm: 7.8 }),
    Jungle: makePlayer("T1", "Jungle", "T1 Jungle", { kdaScore: 88, dpmScore: 82, kpScore: 90, gpmScore: 84, roleScore: 77, dpm: 610, kp: 0.84, gpm: 430, csm: 6.4 }),
    Mid: makePlayer("T1", "Mid", "T1 Mid", { kdaScore: 96, dpmScore: 94, kpScore: 95, gpmScore: 92, roleScore: 91, kda: 9, dpm: 720, kp: 0.86, gpm: 470, csm: 9.3 }),
    Adc: makePlayer("T1", "Adc", "T1 Adc", { kdaScore: 72, dpmScore: 74, kpScore: 70, gpmScore: 75, roleScore: 74, dpm: 590, kp: 0.66, gpm: 440, csm: 8.9 }),
    Support: makePlayer("T1", "Support", "T1 Support", { kdaScore: 76, dpmScore: 45, kpScore: 82, gpmScore: 42, roleScore: 84, dpm: 210, kp: 0.78, gpm: 270, vpm: 2.8 }),
  };
  const right = {
    Top: makePlayer("GEN", "Top", "GEN Top", { kdaScore: 58, dpmScore: 57, kpScore: 59, gpmScore: 58, roleScore: 57, dpm: 440, kp: 0.55, gpm: 365, csm: 7.4 }),
    Jungle: makePlayer("GEN", "Jungle", "GEN Jungle", { kdaScore: 70, dpmScore: 68, kpScore: 69, gpmScore: 67, roleScore: 66, dpm: 500, kp: 0.66, gpm: 390, csm: 5.7 }),
    Mid: makePlayer("GEN", "Mid", "GEN Mid", { kdaScore: 35, dpmScore: 38, kpScore: 40, gpmScore: 37, roleScore: 36, kda: 2.1, dpm: 360, kp: 0.48, gpm: 330, csm: 6.7 }),
    Adc: makePlayer("GEN", "Adc", "GEN Adc", { kdaScore: 68, dpmScore: 70, kpScore: 66, gpmScore: 69, roleScore: 68, dpm: 560, kp: 0.62, gpm: 420, csm: 8.5 }),
    Support: makePlayer("GEN", "Support", "GEN Support", { kdaScore: 72, dpmScore: 48, kpScore: 76, gpmScore: 44, roleScore: 78, dpm: 230, kp: 0.72, gpm: 265, vpm: 2.5 }),
  };
  const roleMatchups = ROLES.map((role) => ({ role, left: left[role], right: right[role] }));
  const players = roleMatchups.flatMap((matchup) => [matchup.left, matchup.right]);

  return {
    scanId: "scan-radar",
    createdAt: new Date().toISOString(),
    candidates: [{
      seriesId: "series-1",
      league: "LCK",
      teamA: "T1",
      teamB: "GEN",
      teams: ["T1", "GEN"],
      winningTeam: "T1",
      seriesScore: "2-0",
      score: "2-0",
      players,
      roleMatchups,
      recommendedMvp: { name: "T1 Jungle", team: "T1", role: "Jungle", score: 84 },
    }],
  };
}
```

Add this test below the helper:

```js
test("buildPlayerRadarPayload auto-selects max matchup edge and MVP proof segment", async () => {
  await withTempProject(async () => {
    const { buildPlayerRadarPayload } = require(path.join(ROOT, "utils/esports/playerRadarRunner.js"));
    const series = makeSnapshot().candidates[0];

    const payload = buildPlayerRadarPayload(series, {}, "zh");

    assert.equal(payload.dataType, "PLAYER_RADAR");
    assert.equal(payload.matchupSegment.role, "Mid");
    assert.equal(payload.matchupSegment.focusPlayer.name, "T1 Mid");
    assert.equal(payload.matchupSegment.edgePlayer.name, "T1 Mid");
    assert.equal(payload.matchupSegment.opponentPlayer.name, "GEN Mid");
    assert.equal(payload.matchupSegment.edgeWinnerTeam, "T1");
    assert.equal(payload.matchupSegment.edgeType, "winner-breakpoint");
    assert.equal(payload.matchupSegment.reasons.length >= 2, true);
    assert.equal(payload.proofSegment.player.name, "T1 Jungle");
    assert.equal(payload.proofSegment.proofType, "mvp");
    assert.equal(payload.proofSegment.isRecommendedMvp, true);
    assert.equal(payload.proofSegment.proofReasons.length >= 2, true);
    assert.equal(payload.player.name, "T1 Jungle");
  });
});
```

Update legacy assertions in the same file so they match the new fixture and approved behavior:

```js
// In the existing auto-selection render test, change:
assert.equal(result.player.name, "T1 Mid");
// to:
assert.equal(result.player.name, "T1 Jungle");

// In the existing fallback/team array payload test, replace:
assert.match(englishPayload.verdict, /is the data lead/);
// with:
assert.equal(englishPayload.proofSegment.player.name, "T1 Top");
assert.equal(englishPayload.proofSegment.proofType, "key-player");
assert.match(englishPayload.verdict, /key-player case/);

// In the existing empty stats/stale MVP test, replace the sparsePayload assertions with:
assert.throws(
  () => buildPlayerRadarPayload(snapshot.candidates[0], { playerName: "No Stats" }, "zh"),
  /proof segment needs at least 2 verifiable reasons/
);
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node --test tests/unit/esports/playerRadarRunner.test.js
```

Expected: FAIL because `payload.matchupSegment` is `undefined`.

- [ ] **Step 3: Write minimal implementation**

In `utils/esports/playerRadarRunner.js`, keep existing imports and `PLAYER_RADAR_PLATFORMS`. Replace the old `selectPlayer` and `buildPlayerRadarPayload` implementation with these helpers and exports:

```js
const METRIC_FIELDS = {
  KDA: "kda",
  DPM: "dpm",
  "KP%": "kp",
  GPM: "gpm",
  CSM: "csm",
  VPM: "vpm",
};

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function round(value, digits = 2) {
  const multiplier = 10 ** digits;
  return Math.round((Number(value) || 0) * multiplier) / multiplier;
}

function normalizePlayerName(name = "") {
  return String(name || "").trim().toLowerCase();
}

function summarizePlayer(player = {}) {
  return {
    name: player.name || "",
    team: player.team || "",
    role: player.role || "",
    championPlayed: player.champions?.[0] || player.champion || "",
    champions: Array.isArray(player.champions) ? player.champions : [],
    rawStats: player.rawStats || {},
    radarStats: Array.isArray(player.radarStats) ? player.radarStats : [],
  };
}

function findPlayer(series = {}, playerName = "") {
  const requested = normalizePlayerName(playerName);
  const players = Array.isArray(series.players) ? series.players : [];
  const player = players.find((candidate) => normalizePlayerName(candidate.name) === requested);
  if (!player) throw new Error(`Player not found in snapshot: ${playerName}`);
  return player;
}

function averageRadarScore(player = {}) {
  const stats = Array.isArray(player.radarStats) ? player.radarStats : [];
  if (stats.length === 0) return 0;
  return stats.reduce((sum, stat) => sum + Number(stat.normalizedScore || 0), 0) / stats.length;
}

function selectPlayer(series = {}, playerName = "") {
  if (String(playerName || "").trim()) return findPlayer(series, playerName);

  const mvpName = series.recommendedMvp?.name;
  if (mvpName) {
    const player = (series.players || []).find((candidate) => candidate.name === mvpName);
    if (player) return player;
  }
  const player = [...(series.players || [])].sort((a, b) => averageRadarScore(b) - averageRadarScore(a))[0];
  if (!player) throw new Error(`Player not found in snapshot: ${playerName || "MVP"}`);
  return player;
}

function getRoleMatchups(series = {}) {
  if (Array.isArray(series.roleMatchups) && series.roleMatchups.length > 0) {
    return series.roleMatchups;
  }
  const teams = series.teams || [series.teamA, series.teamB].filter(Boolean);
  const players = Array.isArray(series.players) ? series.players : [];
  const roles = [...new Set(players.map((player) => player.role).filter(Boolean))];
  return roles.map((role) => ({
    role,
    left: players.find((player) => player.role === role && player.team === teams[0]) || null,
    right: players.find((player) => player.role === role && player.team === teams[1]) || null,
  }));
}

function getMetricValue(player = {}, label = "") {
  const field = METRIC_FIELDS[label];
  return field ? number(player.rawStats?.[field]) : 0;
}

function buildEdgeReasons(winner = {}, loser = {}) {
  const labels = ["KDA", "DPM", "KP%", "GPM", winner.role === "Support" ? "VPM" : "CSM"];
  return labels
    .map((label) => {
      const winnerValue = getMetricValue(winner, label);
      const loserValue = getMetricValue(loser, label);
      return {
        metric: label,
        winnerValue,
        loserValue,
        delta: round(winnerValue - loserValue, label === "KP%" || label === "CSM" || label === "VPM" ? 2 : 0),
      };
    })
    .filter((reason) => reason.delta > 0)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 3);
}

function buildMatchupCandidate(series = {}, matchup = {}, focusPlayer = null) {
  if (!matchup.left || !matchup.right) return null;
  const leftScore = averageRadarScore(matchup.left);
  const rightScore = averageRadarScore(matchup.right);
  const edgePlayer = leftScore >= rightScore ? matchup.left : matchup.right;
  const opponentPlayer = edgePlayer === matchup.left ? matchup.right : matchup.left;
  const reasons = buildEdgeReasons(edgePlayer, opponentPlayer);
  if (reasons.length < 2) {
    throw new Error(`Player Radar matchup segment needs at least 2 verifiable reasons for ${matchup.role}.`);
  }

  const winningTeam = series.winningTeam || "";
  return {
    role: matchup.role,
    focusPlayer: summarizePlayer(focusPlayer || edgePlayer),
    edgePlayer: summarizePlayer(edgePlayer),
    opponentPlayer: summarizePlayer(opponentPlayer),
    edgeWinnerTeam: edgePlayer.team || "",
    edgeScore: round(Math.abs(leftScore - rightScore), 2),
    edgeType: winningTeam && edgePlayer.team !== winningTeam ? "loser-highlight" : "winner-breakpoint",
    reasons,
  };
}

function selectMatchupSegment(series = {}, matchupPlayerName = "") {
  const matchups = getRoleMatchups(series);
  if (matchups.length === 0) throw new Error("Player Radar matchup segment needs at least one role matchup.");

  if (String(matchupPlayerName || "").trim()) {
    const focus = findPlayer(series, matchupPlayerName);
    const matchup = matchups.find((candidate) =>
      candidate.role === focus.role &&
      [candidate.left?.name, candidate.right?.name].includes(focus.name)
    );
    if (!matchup || !matchup.left || !matchup.right) {
      throw new Error(`Opponent not found in snapshot for player: ${matchupPlayerName}`);
    }
    return buildMatchupCandidate(series, matchup, focus);
  }

  const candidates = matchups
    .map((matchup) => buildMatchupCandidate(series, matchup))
    .filter(Boolean)
    .sort((a, b) => Number(b.edgeScore || 0) - Number(a.edgeScore || 0));
  if (!candidates[0]) throw new Error("Player Radar matchup segment needs a complete role matchup.");
  return candidates[0];
}

function isRecommendedMvp(series = {}, player = {}) {
  return Boolean(series.recommendedMvp?.name && normalizePlayerName(series.recommendedMvp.name) === normalizePlayerName(player.name));
}

function buildProofReasons(player = {}) {
  return [...(player.radarStats || [])]
    .filter((stat) => stat?.label)
    .sort((a, b) => Number(b.normalizedScore || 0) - Number(a.normalizedScore || 0))
    .slice(0, 3)
    .map((stat) => ({
      metric: stat.label,
      rawValue: stat.rawValue,
      score: Number(stat.normalizedScore || 0),
    }));
}

function selectProofSegment(series = {}, proofPlayerName = "", locale = "zh") {
  const requested = String(proofPlayerName || "").trim();
  const player = requested ? findPlayer(series, requested) : selectPlayer(series);
  const proofReasons = buildProofReasons(player);
  if (proofReasons.length < 2) {
    throw new Error(`Player Radar proof segment needs at least 2 verifiable reasons for ${player.name}.`);
  }

  const recommended = isRecommendedMvp(series, player);
  const proofType = requested && !recommended ? "key-player" : "mvp";
  return {
    player: summarizePlayer(player),
    proofType,
    isRecommendedMvp: recommended,
    proofStats: proofReasons,
    proofReasons,
    verdict: locale === "en"
      ? `${player.name} has the strongest ${proofType === "mvp" ? "MVP" : "key-player"} case.`
      : `${player.name} 有這場最清楚的${proofType === "mvp" ? "MVP" : "關鍵人物"}理由。`,
  };
}

function buildPlayerRadarStoryboard(payload = {}, locale = "zh") {
  const matchupName = payload.matchupSegment?.edgePlayer?.name || "對位焦點";
  const proofName = payload.proofSegment?.player?.name || "關鍵人物";
  const samePlayer = normalizePlayerName(matchupName) === normalizePlayerName(proofName);
  if (locale === "en") {
    return [
      { tag: "HOOK", text: "Biggest lane gap\nsame as MVP?", durationInFrames: 90 },
      { tag: "MATCHUP_EDGE", text: `${matchupName}\ncreated the matchup gap`, durationInFrames: 126 },
      { tag: "PLAYER_PROOF", text: `${proofName}\ncheck the player case`, durationInFrames: 126 },
      { tag: "CONCLUSION_CTA", text: samePlayer ? "One player, two cases\ncomment your read" : "Gap and MVP split\ncomment your read", durationInFrames: 90 },
    ];
  }
  return [
    { tag: "HOOK", text: "最大差距和 MVP\n是同一個人嗎", durationInFrames: 90 },
    { tag: "MATCHUP_EDGE", text: `${matchupName}\n打出最大對位差`, durationInFrames: 126 },
    { tag: "PLAYER_PROOF", text: `${proofName}\n關鍵人物證明`, durationInFrames: 126 },
    { tag: "CONCLUSION_CTA", text: samePlayer ? "同一人雙重證明\n你同意嗎" : "對位差和關鍵人物\n你怎麼看", durationInFrames: 90 },
  ];
}

function normalizePayloadSelection(selectionOrPlayer = {}) {
  if (selectionOrPlayer?.name) return { playerName: selectionOrPlayer.name };
  return selectionOrPlayer || {};
}

function buildPlayerRadarPayload(series = {}, selectionOrPlayer = {}, locale = "zh") {
  const selection = normalizePayloadSelection(selectionOrPlayer);
  const matchupName = selection.matchupPlayerName || selection.playerName || "";
  const proofName = selection.mvpPlayerName || selection.playerName || "";
  const matchupSegment = selectMatchupSegment(series, matchupName);
  const proofSegment = selectProofSegment(series, proofName, locale);
  const teams = `${series.teamA || series.teams?.[0] || ""} vs ${series.teamB || series.teams?.[1] || ""}`;
  const payload = {
    dataType: "PLAYER_RADAR",
    locale,
    seriesId: series.seriesId,
    matchContext: {
      league: series.league,
      teamA: series.teamA || series.teams?.[0] || "",
      teamB: series.teamB || series.teams?.[1] || "",
      seriesScore: series.seriesScore || series.score || "",
    },
    title: locale === "en" ? `${teams} Player Radar` : `${teams} 選手雷達`,
    matchupSegment,
    proofSegment,
    player: proofSegment.player,
    radarStats: proofSegment.player.radarStats || [],
    highlight: proofSegment.proofReasons[0]?.metric || "",
    weakness: matchupSegment.reasons.at(-1)?.metric || "",
    verdict: proofSegment.verdict,
  };
  return {
    ...payload,
    storyboard: buildPlayerRadarStoryboard(payload, locale),
  };
}
```

Ensure `module.exports` includes these names:

```js
module.exports = {
  PLAYER_RADAR_PLATFORMS,
  normalizeLanguages,
  selectPlayer,
  selectMatchupSegment,
  selectProofSegment,
  buildPlayerRadarPayload,
  runPlayerRadarFromSnapshot,
};
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
node --test tests/unit/esports/playerRadarRunner.test.js
```

Expected: PASS for every test in `tests/unit/esports/playerRadarRunner.test.js`.

- [ ] **Step 5: Commit**

Run:

```bash
git status --short
git add tests/unit/esports/playerRadarRunner.test.js utils/esports/playerRadarRunner.js
git commit -m "feat: build player radar dual-read payload"
```

---

### Task 2: Render Flow Uses One Dual-Read Video Per Locale

**Files:**
- Modify: `tests/unit/esports/playerRadarRunner.test.js`
- Modify: `utils/esports/playerRadarRunner.js`

**Interfaces:**
- Consumes: `buildPlayerRadarPayload(series, selection, locale)`.
- Produces: `runPlayerRadarFromSnapshot(options, deps)` that passes dual-read payloads to render and still queues one video per locale.

- [ ] **Step 1: Write the failing test**

Replace the old `"runPlayerRadarFromSnapshot auto-selects MVP and queues IG/Threads jobs"` test body with:

```js
test("runPlayerRadarFromSnapshot renders one dual-read video per locale and queues IG/Threads jobs", async () => {
  await withTempProject(async () => {
    const { writeCandidateSnapshot } = require(path.join(ROOT, "utils/esports/candidateStore.js"));
    writeCandidateSnapshot(makeSnapshot());
    const { runPlayerRadarFromSnapshot } = require(path.join(ROOT, "utils/esports/playerRadarRunner.js"));
    const renderedPayloads = [];
    const queued = [];

    const result = await runPlayerRadarFromSnapshot({
      scanId: "scan-radar",
      seriesId: "series-1",
      languages: ["zh", "en"],
    }, {
      renderVideosFromRequest: async (payload) => {
        renderedPayloads.push(payload);
        return { videoUrl: `/renders/${payload.locale}-player-radar.mp4`, fileName: `${payload.locale}.mp4` };
      },
      createPublishJobs: async (payload) => {
        queued.push(payload);
        return { success: true, jobs: payload.videos.flatMap((video) => ["instagram", "threads"].map((platform) => ({ platform, locale: video.locale }))) };
      },
    });

    assert.equal(result.success, true);
    assert.equal(result.player.name, "T1 Jungle");
    assert.equal(result.matchupSegment.edgePlayer.name, "T1 Mid");
    assert.equal(result.proofSegment.player.name, "T1 Jungle");
    assert.deepEqual(renderedPayloads.map((payload) => payload.locale), ["zh", "en"]);
    assert.deepEqual(renderedPayloads[0].storyboard.map((scene) => scene.tag), [
      "HOOK",
      "MATCHUP_EDGE",
      "PLAYER_PROOF",
      "CONCLUSION_CTA",
    ]);
    assert.equal(renderedPayloads[0].renderLanguages[0], "zh");
    assert.equal(renderedPayloads[1].renderLanguages[0], "en");
    assert.equal(result.videos.length, 2);
    assert.deepEqual(queued[0].platforms, ["instagram", "threads"]);
    assert.equal(result.publish.jobs.length, 4);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node --test tests/unit/esports/playerRadarRunner.test.js
```

Expected: FAIL because `result.matchupSegment` and `result.proofSegment` are not returned by `runPlayerRadarFromSnapshot`.

- [ ] **Step 3: Write minimal implementation**

In `utils/esports/playerRadarRunner.js`, replace the body of `runPlayerRadarFromSnapshot` with:

```js
async function runPlayerRadarFromSnapshot(options = {}, deps = {}) {
  const snapshot = readCandidateSnapshot(options.scanId);
  const series = (snapshot.candidates || []).find((candidate) => candidate.seriesId === options.seriesId);
  if (!series) throw new Error(`Series not found in snapshot: ${options.seriesId || "UNKNOWN"}`);

  const selection = {
    playerName: options.playerName,
    mvpPlayerName: options.mvpPlayerName,
    matchupPlayerName: options.matchupPlayerName,
  };
  const languages = normalizeLanguages(options.languages);
  const renderVideosFromRequest = deps.renderVideosFromRequest || defaultRenderVideosFromRequest;
  const createPublishJobs = deps.createPublishJobs || defaultCreatePublishJobs;
  const videos = [];
  const payloads = [];

  for (const locale of languages) {
    const payload = buildPlayerRadarPayload(series, selection, locale);
    payloads.push(payload);
    const render = await renderVideosFromRequest({
      ...payload,
      renderLanguages: [locale],
    });
    const video = Array.isArray(render.videos) ? render.videos[0] : {
      locale,
      videoUrl: render.videoUrl,
      fileName: render.fileName,
    };
    videos.push({ ...video, type: "player-radar", locale });
  }

  const publish = await createPublishJobs({
    videos,
    platforms: PLAYER_RADAR_PLATFORMS,
    action: "queue",
    analysis: payloads[0] || { dataType: "PLAYER_RADAR" },
    scheduledAt: options.scheduledAt,
  });

  return {
    success: true,
    scanId: snapshot.scanId,
    seriesId: series.seriesId,
    player: payloads[0]?.proofSegment?.player || null,
    matchupSegment: payloads[0]?.matchupSegment || null,
    proofSegment: payloads[0]?.proofSegment || null,
    languages,
    payloads,
    videos,
    publish,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
node --test tests/unit/esports/playerRadarRunner.test.js
```

Expected: PASS for render flow and payload tests.

- [ ] **Step 5: Commit**

Run:

```bash
git status --short
git add tests/unit/esports/playerRadarRunner.test.js utils/esports/playerRadarRunner.js
git commit -m "feat: render player radar dual-read videos"
```

---

### Task 3: Manual Overrides and Hard Errors

**Files:**
- Modify: `tests/unit/esports/playerRadarRunner.test.js`
- Modify: `utils/esports/playerRadarRunner.js`

**Interfaces:**
- Consumes: `selectMatchupSegment`, `selectProofSegment`, `buildPlayerRadarPayload`.
- Produces: clear override behavior for `playerName`, `mvpPlayerName`, and `matchupPlayerName`.

- [ ] **Step 1: Write the failing tests**

Add these tests to `tests/unit/esports/playerRadarRunner.test.js`:

```js
test("playerName overrides both matchup focus and proof player", async () => {
  await withTempProject(async () => {
    const { buildPlayerRadarPayload } = require(path.join(ROOT, "utils/esports/playerRadarRunner.js"));
    const series = makeSnapshot().candidates[0];

    const payload = buildPlayerRadarPayload(series, { playerName: "GEN Mid" }, "zh");

    assert.equal(payload.matchupSegment.role, "Mid");
    assert.equal(payload.matchupSegment.focusPlayer.name, "GEN Mid");
    assert.equal(payload.matchupSegment.edgePlayer.name, "T1 Mid");
    assert.equal(payload.matchupSegment.opponentPlayer.name, "GEN Mid");
    assert.equal(payload.proofSegment.player.name, "GEN Mid");
    assert.equal(payload.proofSegment.proofType, "key-player");
    assert.equal(payload.proofSegment.isRecommendedMvp, false);
  });
});

test("mvpPlayerName and matchupPlayerName can override separate segments", async () => {
  await withTempProject(async () => {
    const { buildPlayerRadarPayload } = require(path.join(ROOT, "utils/esports/playerRadarRunner.js"));
    const series = makeSnapshot().candidates[0];

    const payload = buildPlayerRadarPayload(series, {
      mvpPlayerName: "T1 Top",
      matchupPlayerName: "GEN Mid",
    }, "zh");

    assert.equal(payload.matchupSegment.focusPlayer.name, "GEN Mid");
    assert.equal(payload.matchupSegment.edgePlayer.name, "T1 Mid");
    assert.equal(payload.proofSegment.player.name, "T1 Top");
    assert.equal(payload.proofSegment.proofType, "key-player");
  });
});

test("player radar fails clearly for unknown players, missing opponents, and weak reasons", async () => {
  await withTempProject(async () => {
    const { buildPlayerRadarPayload } = require(path.join(ROOT, "utils/esports/playerRadarRunner.js"));
    const snapshot = makeSnapshot();
    const series = snapshot.candidates[0];

    assert.throws(
      () => buildPlayerRadarPayload(series, { playerName: "Unknown Player" }, "zh"),
      /Player not found in snapshot: Unknown Player/
    );

    const missingOpponentSeries = {
      ...series,
      players: series.players.filter((player) => player.name !== "GEN Mid"),
      roleMatchups: series.roleMatchups.map((matchup) =>
        matchup.role === "Mid" ? { ...matchup, right: null } : matchup
      ),
    };
    assert.throws(
      () => buildPlayerRadarPayload(missingOpponentSeries, { matchupPlayerName: "T1 Mid" }, "zh"),
      /Opponent not found in snapshot for player: T1 Mid/
    );

    const weakSeries = {
      ...series,
      roleMatchups: [{
        role: "Mid",
        left: {
          ...series.roleMatchups[2].left,
          rawStats: { role: "Mid", kda: 3, dpm: 400, kp: 0.5, gpm: 350, csm: 7 },
        },
        right: {
          ...series.roleMatchups[2].right,
          rawStats: { role: "Mid", kda: 3, dpm: 400, kp: 0.5, gpm: 350, csm: 7 },
        },
      }],
    };
    assert.throws(
      () => buildPlayerRadarPayload(weakSeries, {}, "zh"),
      /needs at least 2 verifiable reasons/
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
node --test tests/unit/esports/playerRadarRunner.test.js
```

Expected: FAIL if `focusPlayer` or the hard error cases are not implemented correctly.

- [ ] **Step 3: Write minimal implementation**

If Task 1 implementation already matches the test, only adjust the opponent mapping so a manually focused loser still appears as the `opponentPlayer` when the winner is the other side. Replace `buildMatchupCandidate` with:

```js
function buildMatchupCandidate(series = {}, matchup = {}, focusPlayer = null) {
  if (!matchup.left || !matchup.right) return null;
  const leftScore = averageRadarScore(matchup.left);
  const rightScore = averageRadarScore(matchup.right);
  const edgePlayer = leftScore >= rightScore ? matchup.left : matchup.right;
  const metricOpponent = edgePlayer === matchup.left ? matchup.right : matchup.left;
  const focus = focusPlayer || edgePlayer;
  const displayOpponent = focus.name === matchup.left.name ? matchup.right : matchup.left;
  const reasons = buildEdgeReasons(edgePlayer, metricOpponent);
  if (reasons.length < 2) {
    throw new Error(`Player Radar matchup segment needs at least 2 verifiable reasons for ${matchup.role}.`);
  }

  const winningTeam = series.winningTeam || "";
  return {
    role: matchup.role,
    focusPlayer: summarizePlayer(focus),
    edgePlayer: summarizePlayer(edgePlayer),
    opponentPlayer: summarizePlayer(displayOpponent),
    edgeWinnerTeam: edgePlayer.team || "",
    edgeScore: round(Math.abs(leftScore - rightScore), 2),
    edgeType: winningTeam && edgePlayer.team !== winningTeam ? "loser-highlight" : "winner-breakpoint",
    reasons,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run:

```bash
node --test tests/unit/esports/playerRadarRunner.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git status --short
git add tests/unit/esports/playerRadarRunner.test.js utils/esports/playerRadarRunner.js
git commit -m "feat: support player radar segment overrides"
```

---

### Task 4: Schema Normalization and Fallback Storyboard

**Files:**
- Modify: `tests/unit/pipelineRegistry.test.js`
- Modify: `src/schemas/pipelineSchemas.js`

**Interfaces:**
- Consumes: dual-read payload fields from `playerRadarRunner`.
- Produces: normalized `PLAYER_RADAR` payloads that preserve `matchupSegment`, `proofSegment`, and four-scene fallback storyboard tags.

- [ ] **Step 1: Write the failing test**

Add this test to `tests/unit/pipelineRegistry.test.js`:

```js
test("player radar schema preserves dual-read segments and uses dual-read fallback storyboard", () => {
  const { normalizePipelinePayload } = require(path.join(ROOT, "src/schemas/pipelineSchemas.js"));

  const normalized = normalizePipelinePayload({
    dataType: "PLAYER_RADAR",
    matchupSegment: {
      role: "Mid",
      focusPlayer: { name: "GEN Mid", team: "GEN", role: "Mid" },
      edgePlayer: { name: "T1 Mid", team: "T1", role: "Mid" },
      opponentPlayer: { name: "GEN Mid", team: "GEN", role: "Mid" },
      edgeWinnerTeam: "T1",
      edgeScore: 56,
      edgeType: "winner-breakpoint",
      reasons: [{ metric: "DPM", winnerValue: 720, loserValue: 360, delta: 360 }],
    },
    proofSegment: {
      player: { name: "T1 Jungle", team: "T1", role: "Jungle" },
      proofType: "mvp",
      isRecommendedMvp: true,
      proofStats: [{ metric: "KP%", rawValue: "84%", score: 90 }],
      proofReasons: [{ metric: "KP%", rawValue: "84%", score: 90 }],
      verdict: "T1 Jungle 有這場最清楚的 MVP 理由。",
    },
  });

  assert.equal(normalized.data.dataType, "PLAYER_RADAR");
  assert.equal(normalized.data.matchupSegment.edgePlayer.name, "T1 Mid");
  assert.equal(normalized.data.proofSegment.player.name, "T1 Jungle");
  assert.deepEqual(normalized.data.storyboard.map((scene) => scene.tag), [
    "HOOK",
    "MATCHUP_EDGE",
    "PLAYER_PROOF",
    "CONCLUSION_CTA",
  ]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node --test tests/unit/pipelineRegistry.test.js
```

Expected: FAIL because `PlayerRadarSchema` does not default segment fields and fallback storyboard still uses `STAT_REVEAL`.

- [ ] **Step 3: Write minimal implementation**

In `src/schemas/pipelineSchemas.js`, add segment fields to `PlayerRadarSchema`:

```js
  matchupSegment: z.any().optional(),
  proofSegment: z.any().optional(),
  title: z.coerce.string().optional(),
```

In the same file, replace the `PLAYER_RADAR` branch inside `fallbackStoryboardFor` with:

```js
  if (dataType === "PLAYER_RADAR") {
    return [
      { tag: "HOOK", text: "最大差距和 MVP\n是同一個人嗎", durationInFrames: 90 },
      { tag: "MATCHUP_EDGE", text: "先看最大對位差\n誰壓過誰", durationInFrames: 126 },
      { tag: "PLAYER_PROOF", text: "再看關鍵人物\n理由是否成立", durationInFrames: 126 },
      { tag: "CONCLUSION_CTA", text: "這場你怎麼判讀\n留言告訴我", durationInFrames: 90 },
    ];
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
node --test tests/unit/pipelineRegistry.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git status --short
git add tests/unit/pipelineRegistry.test.js src/schemas/pipelineSchemas.js
git commit -m "feat: normalize player radar dual-read schema"
```

---

### Task 5: Remotion Player Radar Template

**Files:**
- Modify: `tests/unit/render/compositionScope.test.js`
- Modify: `src/templates/Template_PlayerRadar.jsx`

**Interfaces:**
- Consumes: `matchupSegment`, `proofSegment`, four-scene storyboard.
- Produces: Remotion scenes `MatchupEdgeScene` and `PlayerProofScene` with old single-radar copy removed from the main route.

- [ ] **Step 1: Write the failing test**

Add this test to `tests/unit/render/compositionScope.test.js`:

```js
test("Player radar template renders dual-read matchup and proof scenes", () => {
  const source = fs.readFileSync(path.join(ROOT, "src/templates/Template_PlayerRadar.jsx"), "utf8");

  assert.match(source, /const MatchupEdgeScene/);
  assert.match(source, /const PlayerProofScene/);
  assert.match(source, /matchupSegment/);
  assert.match(source, /proofSegment/);
  assert.match(source, /active\.scene\?\.tag === "MATCHUP_EDGE"/);
  assert.match(source, /active\.scene\?\.tag === "PLAYER_PROOF"/);
  assert.match(source, /focusPlayer/);
  assert.match(source, /opponentPlayer/);
  assert.match(source, /proofReasons/);
  assert.equal(source.includes("FIVE-AXIS PROFILE"), false);
  assert.equal(source.includes("的真實形狀"), false);
  assert.equal(source.includes("強項與弱點會自己浮出來"), false);
  assert.equal(source.includes("不是只有 KDA"), false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node --test tests/unit/render/compositionScope.test.js
```

Expected: FAIL because `MatchupEdgeScene` and `PlayerProofScene` do not exist.

- [ ] **Step 3: Write minimal implementation**

In `src/templates/Template_PlayerRadar.jsx`:

1. Keep imports and shared primitives.
2. Keep `RadarChart` import only if it is used as a small supporting element in `PlayerProofScene`.
3. Replace `RadarScene`, `BreakdownScene`, and their routing with these scene components:

```jsx
const MetricRow = ({ reason, accent }) => (
  <div style={{ display: "grid", gridTemplateColumns: "120px 1fr 116px", gap: 18, alignItems: "center" }}>
    <div style={{ color: accent, fontSize: 26, fontWeight: 950 }}>{reason.metric}</div>
    <div style={{ color: "rgba(219,234,254,0.78)", fontSize: 23, fontWeight: 800 }}>
      {reason.winnerValue} vs {reason.loserValue}
    </div>
    <div style={{ color: HEXTECH_COLORS.gold, fontSize: 30, fontWeight: 950, textAlign: "right" }}>
      +{reason.delta}
    </div>
  </div>
);

const MatchupEdgeScene = ({ data, theme, localFrame }) => {
  const segment = data.matchupSegment || {};
  const focusPlayer = segment.focusPlayer || {};
  const edgePlayer = segment.edgePlayer || {};
  const opponentPlayer = segment.opponentPlayer || {};
  const reasons = Array.isArray(segment.reasons) ? segment.reasons.slice(0, 3) : [];
  const label = segment.edgeType === "loser-highlight" ? "敗方亮點" : "勝負突破口";

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", gap: 34 }}>
      <KineticTitle
        eyebrow={`${segment.role || focusPlayer.role || "ROLE"} MATCHUP EDGE`}
        title="最大對位差距"
        subtitle={`${focusPlayer.name || edgePlayer.name || "Focus"} vs ${opponentPlayer.name || "Opponent"} · ${label}`}
        theme={theme}
        localFrame={localFrame}
        size={64}
      />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 120px 1fr", gap: 20, alignItems: "stretch" }}>
        <GlassPanel accent={theme.accent} style={{ minHeight: 250 }}>
          <div style={{ color: theme.accent, fontSize: 20, fontWeight: 950, letterSpacing: 4 }}>FOCUS</div>
          <div style={{ marginTop: 16, color: "#fff", fontSize: 48, fontWeight: 950 }}>{focusPlayer.name || edgePlayer.name}</div>
          <div style={{ marginTop: 10, color: "rgba(219,234,254,0.78)", fontSize: 28, fontWeight: 850 }}>
            {focusPlayer.team || edgePlayer.team} · {focusPlayer.role || edgePlayer.role}
          </div>
        </GlassPanel>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", color: HEXTECH_COLORS.gold, fontSize: 36, fontWeight: 950 }}>
          VS
        </div>
        <GlassPanel accent={theme.secondary} style={{ minHeight: 250 }}>
          <div style={{ color: theme.secondary, fontSize: 20, fontWeight: 950, letterSpacing: 4 }}>OPPONENT</div>
          <div style={{ marginTop: 16, color: "#fff", fontSize: 48, fontWeight: 950 }}>{opponentPlayer.name || "Opponent"}</div>
          <div style={{ marginTop: 10, color: "rgba(219,234,254,0.78)", fontSize: 28, fontWeight: 850 }}>
            {opponentPlayer.team || ""} · {opponentPlayer.role || segment.role || ""}
          </div>
        </GlassPanel>
      </div>
      <GlassPanel accent={HEXTECH_COLORS.gold} style={{ display: "grid", gap: 18 }}>
        <div style={{ color: "#fff", fontSize: 34, fontWeight: 950 }}>
          數據領先：{edgePlayer.name || "Edge player"} · {Math.round(segment.edgeScore || 0)}
        </div>
        {reasons.map((reason) => <MetricRow key={reason.metric} reason={reason} accent={theme.accent} />)}
      </GlassPanel>
    </div>
  );
};

const PlayerProofScene = ({ data, theme, localFrame }) => {
  const segment = data.proofSegment || {};
  const player = segment.player || getPlayer(data);
  const reasons = Array.isArray(segment.proofReasons) ? segment.proofReasons.slice(0, 3) : [];
  const proofLabel = segment.proofType === "mvp" ? "MVP CASE" : "KEY PLAYER CASE";

  return (
    <div style={{ height: "100%", display: "grid", gridTemplateColumns: "1.05fr 0.95fr", gap: 34, alignItems: "center" }}>
      <div>
        <PipelineBadge theme={theme} localFrame={localFrame}>{proofLabel}</PipelineBadge>
        <KineticTitle
          eyebrow={`${player.team || ""} · ${ROLE_LABELS[player.role] || player.role || ""}`}
          title={player.name || "Player"}
          subtitle={segment.verdict || data.verdict || "用數據建立關鍵人物理由"}
          theme={theme}
          localFrame={localFrame}
          size={76}
        />
      </div>
      <GlassPanel accent={theme.accent} style={{ display: "grid", gap: 20 }}>
        {reasons.map((reason, index) => (
          <div key={reason.metric || index} style={{ display: "grid", gridTemplateColumns: "74px 1fr 92px", gap: 18, alignItems: "center" }}>
            <div style={{ color: HEXTECH_COLORS.gold, fontSize: 42, fontWeight: 950 }}>{index + 1}</div>
            <div>
              <div style={{ color: "#fff", fontSize: 34, fontWeight: 950 }}>{reason.metric}</div>
              <div style={{ color: "rgba(219,234,254,0.72)", fontSize: 22, fontWeight: 800 }}>{reason.rawValue}</div>
            </div>
            <div style={{ color: theme.accent, fontSize: 44, fontWeight: 950, textAlign: "right" }}>{reason.score}</div>
          </div>
        ))}
      </GlassPanel>
    </div>
  );
};
```

4. Replace `ConclusionScene` with a version that references both segments:

```jsx
const ConclusionScene = ({ data, theme, localFrame }) => {
  const matchupName = data.matchupSegment?.edgePlayer?.name || "最大對位差選手";
  const proofName = data.proofSegment?.player?.name || "關鍵人物";
  const samePlayer = String(matchupName).toLowerCase() === String(proofName).toLowerCase();
  return (
    <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <VerdictCard
        theme={theme}
        localFrame={localFrame}
        title="RADAR VERDICT"
        body={samePlayer
          ? `${proofName} 同時拿到最大對位差和關鍵人物理由。`
          : `最大對位差在 ${matchupName}，關鍵人物理由在 ${proofName}。`}
        chips={samePlayer ? ["最大對位差", "MVP case", "同一人"] : ["對位差距", "關鍵人物", "雙判讀"]}
      />
    </div>
  );
};
```

5. Replace render routing with:

```jsx
  const renderScene = () => {
    if (tag === "MATCHUP_EDGE") return <MatchupEdgeScene data={data} theme={theme} localFrame={active.localFrame} />;
    if (tag === "PLAYER_PROOF") return <PlayerProofScene data={data} theme={theme} localFrame={active.localFrame} />;
    if (tag === "CONCLUSION_CTA" || tag === "OUTRO") return <ConclusionScene data={data} theme={theme} localFrame={active.localFrame} />;
    return <HookScene data={data} theme={theme} localFrame={active.localFrame} />;
  };
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
node --test tests/unit/render/compositionScope.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git status --short
git add tests/unit/render/compositionScope.test.js src/templates/Template_PlayerRadar.jsx
git commit -m "feat: render player radar dual-read scenes"
```

---

### Task 6: Workbench Controls and Final Verification

**Files:**
- Modify: `tests/unit/metaFactory/workbenchStatic.test.js`
- Modify: `app/page.jsx`
- Verify: `tests/unit/esports/playerRadarRunner.test.js`
- Verify: `tests/unit/pipelineRegistry.test.js`
- Verify: `tests/unit/render/compositionScope.test.js`

**Interfaces:**
- Consumes: API support for `playerName`, `mvpPlayerName`, and `matchupPlayerName`.
- Produces: workbench inputs that let operators use common or split overrides.

- [ ] **Step 1: Write the failing test**

Add this test to `tests/unit/metaFactory/workbenchStatic.test.js`:

```js
test("esports workbench can send common and split player radar overrides", () => {
  const page = fs.readFileSync(path.join(ROOT, "app/page.jsx"), "utf8");

  assert.match(page, /const \[playerName, setPlayerName\] = useState\(""\)/);
  assert.match(page, /const \[mvpPlayerName, setMvpPlayerName\] = useState\(""\)/);
  assert.match(page, /const \[matchupPlayerName, setMatchupPlayerName\] = useState\(""\)/);
  assert.match(page, /mvpPlayerName: mvpPlayerName \|\| undefined/);
  assert.match(page, /matchupPlayerName: matchupPlayerName \|\| undefined/);
  assert.match(page, /placeholder="空白則使用推薦 MVP"/);
  assert.match(page, /placeholder="空白則使用最大對位差距"/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node --test tests/unit/metaFactory/workbenchStatic.test.js
```

Expected: FAIL because `mvpPlayerName` and `matchupPlayerName` states do not exist.

- [ ] **Step 3: Write minimal implementation**

In `app/page.jsx`, inside `EsportsFactory`, add state next to the existing `playerName` state:

```jsx
  const [mvpPlayerName, setMvpPlayerName] = useState("");
  const [matchupPlayerName, setMatchupPlayerName] = useState("");
```

In `runPlayerRadar`, replace the request body with:

```jsx
      const response = await fetch("/api/esports/player-radar", {
        method: "POST",
        body: JSON.stringify({
          scanId,
          seriesId,
          playerName: playerName || undefined,
          mvpPlayerName: mvpPlayerName || undefined,
          matchupPlayerName: matchupPlayerName || undefined,
          languages: ["zh", "en"],
        }),
      });
```

In the `fieldGrid`, keep the existing `playerName` field and add these two labels after it:

```jsx
            <label>
              mvpPlayerName
              <input value={mvpPlayerName} onChange={(event) => setMvpPlayerName(event.target.value)} placeholder="空白則使用推薦 MVP" />
            </label>
            <label>
              matchupPlayerName
              <input value={matchupPlayerName} onChange={(event) => setMatchupPlayerName(event.target.value)} placeholder="空白則使用最大對位差距" />
            </label>
```

Keep the controls visually plain and aligned with the existing dense operational workbench. Do not introduce a new card, modal, animation, or marketing copy.

- [ ] **Step 4: Run focused tests to verify they pass**

Run:

```bash
node --test tests/unit/metaFactory/workbenchStatic.test.js
```

Expected: PASS.

- [ ] **Step 5: Run full verification**

Run:

```bash
node --test tests/unit/esports/playerRadarRunner.test.js
node --test tests/unit/pipelineRegistry.test.js
node --test tests/unit/render/compositionScope.test.js
node --test tests/unit/metaFactory/workbenchStatic.test.js
npm run test:unit
```

Expected: all commands PASS. If unrelated tests fail, record the failing test names and do not modify unrelated code.

- [ ] **Step 6: Commit**

Run:

```bash
git status --short
git add tests/unit/metaFactory/workbenchStatic.test.js app/page.jsx
git commit -m "feat: add player radar override controls"
```

---

## Final Verification Before Merge

Run these commands after all tasks are committed:

```bash
npm run tdd:doctor
npm run test:unit
npx next build
```

Expected: all commands exit 0. If `npx next build` fails because of pre-existing unrelated dirty worktree changes, capture the exact failing files and error messages before asking for direction.

Inspect final git state:

```bash
git status --short
git log --oneline -6
```

Expected: only intentional task commits are present. No unrelated files are staged.
