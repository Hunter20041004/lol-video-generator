# Meta Content Factory Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the new data-driven Meta 內容工廠 with two pipelines：黑科技 (`META_OFFMETA_PICK`) and 梯度榜單 (`META_TIER_RANKING`), backed by LoLalytics snapshots, OP.GG verification, TDD coverage, bilingual rendering, and IG/Threads queue handoff.

**Architecture:** Add focused CommonJS modules under `utils/metaFactory/` for source adapters, verification, scoring, snapshot persistence, planning, and API orchestration. Register new `META_*` data types in the existing pipeline registry/schema/render path without reviving old `PRO_BUILD` or `TIER_LIST`. The workbench UI calls Meta Factory APIs; render reads only stored snapshots and never re-fetches third-party data.

**Tech Stack:** Node.js `node:test`, CommonJS utility modules, Next.js App Router API routes, local JSON snapshot store in `.data`, existing Remotion render service, existing publishing queue, Chrome plugin verification.

## Global Constraints

- TDD is mandatory：every task uses one failing behavior test, minimal implementation, then refactor.
- Use vertical TDD only：do not write several tests first and implement several modules later.
- New runtime data types are exactly `META_OFFMETA_PICK` and `META_TIER_RANKING`.
- Old `PRO_BUILD` and `TIER_LIST` must not be revived in runtime schema, prompt, render mapping, composition registration, or UI.
- LoLalytics is the primary source.
- OP.GG or OP.GG MCP is verifier/cross-check only and must not own ranking.
- Scan is manual; no scheduler, background scan, or unattended auto-render.
- Scan may fetch third-party data; render must only read snapshot data.
- No runtime sample mode. Tests use fixture or injected adapter dependencies.
- Output is fixed bilingual zh/en.
- Publishing creates Instagram and Threads queue jobs only; no immediate publish.
- UI implementation must use frontend-design during execution.
- This workspace is not a git repo, so commit steps are replaced by evidence checkpoints.

---

## File Structure

Create:

- `utils/metaFactory/sourceAdapters/lolalyticsAdapter.js`：fetch and normalize LoLalytics-like source payloads into internal champion/role/build rows.
- `utils/metaFactory/sourceAdapters/opggVerifier.js`：cross-check candidates and return agreement/unavailable signals.
- `utils/metaFactory/scoring.js`：calculate offmeta scores, tier scores, bands, risk labels, and hard blocks.
- `utils/metaFactory/snapshotStore.js`：persist and read Meta snapshots from `.data/meta-factory-snapshots.json`.
- `utils/metaFactory/candidatePlanner.js`：turn selected candidates into bilingual render payloads.
- `utils/metaFactory/apiHandlers.js`：scan, snapshot read, and render orchestration with injected dependencies.
- `app/api/meta-factory/scan/route.js`：POST scan endpoint.
- `app/api/meta-factory/snapshot/route.js`：GET snapshot endpoint.
- `app/api/meta-factory/render/route.js`：POST render endpoint.
- `src/templates/Template_MetaOffmeta.jsx`：Remotion composition for black-tech videos.
- `src/templates/Template_MetaTierRanking.jsx`：Remotion composition for single-role tier videos.
- `tests/unit/metaFactory/sourceAdapters.test.js`
- `tests/unit/metaFactory/opggVerifier.test.js`
- `tests/unit/metaFactory/scoring.test.js`
- `tests/unit/metaFactory/snapshotStore.test.js`
- `tests/unit/metaFactory/apiHandlers.test.js`
- `tests/unit/metaFactory/renderPlanner.test.js`
- `tests/unit/metaFactory/workbenchStatic.test.js`
- `tests/contract/metaFactory/lolalyticsContract.test.js`

Modify:

- `utils/pipelineRegistry.js`：add `META_*` active data types and a Meta factory scope helper.
- `src/schemas/pipelineSchemas.js`：add schemas for `META_OFFMETA_PICK` and `META_TIER_RANKING`.
- `utils/render/renderService.js`：map new data types to new Remotion compositions.
- `src/Composition.jsx`：route new payloads to new templates.
- `src/Root.jsx`：register new Remotion compositions.
- `utils/publishing/copy.js`：add social-copy labels and captions for new data types.
- `utils/apiGuards.js`：allow new data types while still rejecting old ones.
- `app/page.jsx`：add Meta 內容工廠 workbench.
- `config/tdd-coverage.json`：add Meta Factory production/test slices.
- Existing pruning/static tests：keep old data type rejection while allowing new `META_*` types.

---

### Task 1: Registry And Schema Admit New Meta Data Types

**Files:**
- Modify: `utils/pipelineRegistry.js`
- Modify: `src/schemas/pipelineSchemas.js`
- Modify: `utils/apiGuards.js`
- Modify: `tests/unit/pipelineRegistry.test.js`
- Modify: `tests/unit/apiBoundaryContracts.test.js`
- Modify: `tests/unit/render/compositionScope.test.js`

**Interfaces:**
- Produces: `META_DATA_TYPES = ["META_OFFMETA_PICK", "META_TIER_RANKING"]`
- Produces: `isMetaFactoryDataType(dataType): boolean`
- Existing `assertSupportedDataType(dataType)` returns uppercase `META_*` values.
- Existing `validateAnalyzeRequest(body)` and `validatePublishRequest(body)` accept `META_*`.

- [ ] **Step 1: Write one failing registry test**

Add this test to `tests/unit/pipelineRegistry.test.js`:

```js
test("pipeline registry exposes new meta factory dataTypes without reviving old ones", () => {
  const {
    ACTIVE_DATA_TYPES,
    META_DATA_TYPES,
    assertSupportedDataType,
    isMetaFactoryDataType,
    isRemovedDataType,
  } = require(path.join(ROOT, "utils/pipelineRegistry.js"));

  assert.deepEqual(META_DATA_TYPES, ["META_OFFMETA_PICK", "META_TIER_RANKING"]);
  assert.equal(ACTIVE_DATA_TYPES.includes("META_OFFMETA_PICK"), true);
  assert.equal(ACTIVE_DATA_TYPES.includes("META_TIER_RANKING"), true);
  assert.equal(isMetaFactoryDataType("meta_offmeta_pick"), true);
  assert.equal(isMetaFactoryDataType("META_TIER_RANKING"), true);
  assert.equal(isRemovedDataType("PRO_BUILD"), true);
  assert.equal(isRemovedDataType("TIER_LIST"), true);
  assert.equal(assertSupportedDataType("meta_offmeta_pick"), "META_OFFMETA_PICK");
});
```

- [ ] **Step 2: Run the focused test and verify Red**

Run: `node --test tests/unit/pipelineRegistry.test.js`

Expected: FAIL with `META_DATA_TYPES` or `isMetaFactoryDataType` missing.

- [ ] **Step 3: Implement the minimal registry change**

Modify `utils/pipelineRegistry.js`:

```js
const META_DATA_TYPES = [
  "META_OFFMETA_PICK",
  "META_TIER_RANKING",
];

const ACTIVE_DATA_TYPES = [
  "PATCH",
  "SYSTEM_UPDATE",
  "ITEM_UPDATE",
  "RUNE_UPDATE",
  "ESPORTS_H2H_RADAR",
  "ESPORTS_MATCH_RECAP",
  "PLAYER_RADAR",
  ...META_DATA_TYPES,
];

const META_DATA_TYPE_SET = new Set(META_DATA_TYPES);

function isMetaFactoryDataType(dataType) {
  return META_DATA_TYPE_SET.has(String(dataType || "").toUpperCase());
}

module.exports = {
  ACTIVE_DATA_TYPES,
  REMOVED_DATA_TYPES,
  VERSION_FACTORY_DATA_TYPES,
  ESPORTS_DATA_TYPES,
  META_DATA_TYPES,
  normalizeDataType,
  isSupportedDataType,
  isRemovedDataType,
  isVersionFactoryDataType,
  isMetaFactoryDataType,
  unsupportedDataTypeMessage,
  assertSupportedDataType,
  assertVersionFactoryDataType,
};
```

Keep the existing removed list unchanged.

- [ ] **Step 4: Verify Green**

Run: `node --test tests/unit/pipelineRegistry.test.js`

Expected: PASS.

- [ ] **Step 5: Add one failing schema normalization test**

Add to `tests/unit/apiBoundaryContracts.test.js`:

```js
test("schema normalization accepts new meta payloads while API guards reject retired ones", () => {
  const { validateAnalyzeRequest, validatePublishRequest } = require(path.join(ROOT, "utils/apiGuards.js"));
  const { normalizePipelinePayload } = require(path.join(ROOT, "src/schemas/pipelineSchemas.js"));

  assert.deepEqual(validateAnalyzeRequest({ dataType: "META_OFFMETA_PICK" }), {
    dataType: "META_OFFMETA_PICK",
  });
  assert.deepEqual(validatePublishRequest({
    analysis: { dataType: "META_TIER_RANKING" },
    platforms: ["instagram", "threads"],
  }), {
    dataType: "META_TIER_RANKING",
    platforms: ["instagram", "threads"],
  });
  assert.throws(() => validateAnalyzeRequest({ dataType: "PRO_BUILD" }), /Unsupported dataType: PRO_BUILD/);
  assert.throws(() => validateAnalyzeRequest({ dataType: "TIER_LIST" }), /Unsupported dataType: TIER_LIST/);

  const offmeta = normalizePipelinePayload({
    dataType: "META_OFFMETA_PICK",
    champion: "Velkoz",
    role: "Support",
    score: "82",
    sampleSize: "18420",
  });
  assert.equal(offmeta.data.dataType, "META_OFFMETA_PICK");
  assert.equal(offmeta.data.score, 82);
  assert.equal(offmeta.data.sampleSize, 18420);

  const tier = normalizePipelinePayload({
    dataType: "META_TIER_RANKING",
    role: "Mid",
    entries: [{ champion: "Azir", rank: 1, tierScore: "88" }],
  });
  assert.equal(tier.data.dataType, "META_TIER_RANKING");
  assert.equal(tier.data.entries[0].tierScore, 88);
});
```

- [ ] **Step 6: Run and verify Red**

Run: `node --test tests/unit/apiBoundaryContracts.test.js`

Expected: FAIL because schemas do not yet include `META_*` or normalize payloads correctly.

- [ ] **Step 7: Add minimal schemas**

Modify `src/schemas/pipelineSchemas.js` with these schema shapes:

```js
const MetaEvidenceSchema = z.object({
  label: z.coerce.string().default("Evidence"),
  value: z.union([z.string(), z.number(), z.null()]).optional(),
  detail: z.coerce.string().optional(),
}).passthrough();

const MetaOffmetaSchema = BasePipelineSchema.extend({
  dataType: z.literal("META_OFFMETA_PICK").default("META_OFFMETA_PICK"),
  title: z.coerce.string().default("Off-meta pick"),
  champion: z.coerce.string().default("Unknown Champion"),
  role: z.coerce.string().default("Mid"),
  offmetaType: z.enum(["OFFROLE_PICK", "OFFMETA_BUILD"]).default("OFFROLE_PICK"),
  score: z.coerce.number().default(0),
  confidence: z.coerce.number().default(0),
  sourceAgreement: z.coerce.number().default(0),
  sampleSize: z.coerce.number().default(0),
  riskLabels: z.array(z.coerce.string()).default([]),
  evidence: z.array(MetaEvidenceSchema).default([]),
  recommendedStoryAngle: z.coerce.string().default("這個玩法看起來很怪，但數據值得檢查。"),
  hardBlock: z.object({
    blocked: z.boolean().default(false),
    reasons: z.array(z.coerce.string()).default([]),
  }).partial().passthrough().default({ blocked: false, reasons: [] }),
});

const MetaTierRankingSchema = BasePipelineSchema.extend({
  dataType: z.literal("META_TIER_RANKING").default("META_TIER_RANKING"),
  title: z.coerce.string().default("Role tier ranking"),
  role: z.coerce.string().default("Mid"),
  rankingSize: z.coerce.number().int().default(7),
  downgradeReason: z.coerce.string().optional(),
  entries: z.array(z.object({
    champion: z.coerce.string().default("Unknown Champion"),
    role: z.coerce.string().default("Mid"),
    rank: z.coerce.number().int().default(1),
    tierBand: z.enum(["S", "A", "B", "WATCH"]).default("A"),
    tierScore: z.coerce.number().default(0),
    winRate: z.coerce.number().default(0),
    pickRate: z.coerce.number().default(0),
    banRate: z.coerce.number().default(0),
    sampleSize: z.coerce.number().default(0),
    sourceAgreement: z.coerce.number().default(0),
    reasons: z.array(z.coerce.string()).default([]),
    caveats: z.array(z.coerce.string()).default([]),
  }).passthrough()).default([]),
  watchPick: z.any().optional(),
});
```

Add both schemas to `schemaByDataType`.

- [ ] **Step 8: Verify Green**

Run: `node --test tests/unit/apiBoundaryContracts.test.js tests/unit/pipelineRegistry.test.js`

Expected: PASS.

- [ ] **Step 9: Refactor and run current pruning/static safety tests**

Run: `node --test tests/unit/render/compositionScope.test.js tests/unit/pipelinePruningStatic.test.js`

Expected: PASS. Old `PRO_BUILD` and `TIER_LIST` remain rejected/deleted; only new `META_*` types are valid.

---

### Task 2: LoLalytics Adapter Normalizes Source Data Into Meta Snapshot Inputs

**Files:**
- Create: `utils/metaFactory/sourceAdapters/lolalyticsAdapter.js`
- Create: `tests/unit/metaFactory/sourceAdapters.test.js`
- Create: `tests/contract/metaFactory/lolalyticsContract.test.js`
- Modify: `config/tdd-coverage.json`

**Interfaces:**
- Produces: `normalizeLolalyticsRows(rawRows, options): { sourceStatus, rows }`
- Produces: `fetchLolalyticsRows(options, deps): Promise<{ sourceStatus, rows }>`
- `rows[]` has `{ champion, role, rankPreset, sampleSize, winRate, pickRate, banRate, baselineWinRate, primaryRole, builds, runes, summonerSpells, patch, region }`.

- [ ] **Step 1: Write one failing unit test for normalization**

Create `tests/unit/metaFactory/sourceAdapters.test.js`:

```js
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "../../..");

test("normalizeLolalyticsRows converts champion role stats into internal meta rows", () => {
  const { normalizeLolalyticsRows } = require(path.join(ROOT, "utils/metaFactory/sourceAdapters/lolalyticsAdapter.js"));

  const result = normalizeLolalyticsRows([
    {
      champion: "Velkoz",
      lane: "support",
      tier: "diamond_plus",
      games: "18420",
      winrate: "52.8",
      pickrate: "2.1",
      banrate: "0.8",
      baselineWinrate: "50.1",
      primaryLane: "middle",
      patch: "16.12",
      region: "global",
      builds: [{ name: "Seraphs Embrace", winrate: "55.1", games: "1220" }],
      runes: [{ name: "First Strike", winrate: "54.2", games: "980" }],
      summoners: [{ name: "Barrier", winrate: "53.9", games: "760" }],
    },
  ], { rankPreset: "diamond_plus", patch: "16.12", region: "global" });

  assert.equal(result.sourceStatus.status, "ready");
  assert.equal(result.rows.length, 1);
  assert.deepEqual(result.rows[0], {
    champion: "Velkoz",
    role: "Support",
    rankPreset: "diamond_plus",
    sampleSize: 18420,
    winRate: 52.8,
    pickRate: 2.1,
    banRate: 0.8,
    baselineWinRate: 50.1,
    primaryRole: "Mid",
    patch: "16.12",
    region: "global",
    builds: [{ name: "Seraphs Embrace", winRate: 55.1, sampleSize: 1220 }],
    runes: [{ name: "First Strike", winRate: 54.2, sampleSize: 980 }],
    summonerSpells: [{ name: "Barrier", winRate: 53.9, sampleSize: 760 }],
  });
});
```

- [ ] **Step 2: Run and verify Red**

Run: `node --test tests/unit/metaFactory/sourceAdapters.test.js`

Expected: FAIL because the adapter module does not exist.

- [ ] **Step 3: Implement minimal normalization**

Create `utils/metaFactory/sourceAdapters/lolalyticsAdapter.js` with:

```js
const ROLE_ALIASES = {
  top: "Top",
  jungle: "Jungle",
  mid: "Mid",
  middle: "Mid",
  support: "Support",
  adc: "ADC",
  bottom: "ADC",
  bot: "ADC",
};

function number(value, fallback = 0) {
  const parsed = Number(String(value ?? "").replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeRole(value = "") {
  return ROLE_ALIASES[String(value || "").trim().toLowerCase()] || String(value || "Mid");
}

function normalizeOptionList(values = []) {
  return (Array.isArray(values) ? values : []).map((entry) => ({
    name: String(entry.name || entry.item || entry.rune || entry.spell || "Unknown"),
    winRate: number(entry.winrate ?? entry.winRate),
    sampleSize: number(entry.games ?? entry.sampleSize),
  }));
}

function normalizeLolalyticsRows(rawRows = [], options = {}) {
  const rows = (Array.isArray(rawRows) ? rawRows : []).map((row) => ({
    champion: String(row.champion || row.name || "Unknown Champion"),
    role: normalizeRole(row.lane || row.role),
    rankPreset: String(row.tier || row.rankPreset || options.rankPreset || "emerald_plus"),
    sampleSize: number(row.games ?? row.sampleSize),
    winRate: number(row.winrate ?? row.winRate),
    pickRate: number(row.pickrate ?? row.pickRate),
    banRate: number(row.banrate ?? row.banRate),
    baselineWinRate: number(row.baselineWinrate ?? row.baselineWinRate ?? row.averageWinRate, 50),
    primaryRole: normalizeRole(row.primaryLane || row.primaryRole || row.lane || row.role),
    patch: String(row.patch || options.patch || ""),
    region: String(row.region || options.region || "global").toLowerCase(),
    builds: normalizeOptionList(row.builds),
    runes: normalizeOptionList(row.runes),
    summonerSpells: normalizeOptionList(row.summoners || row.summonerSpells),
  }));

  return {
    sourceStatus: {
      provider: "LoLalytics",
      status: rows.length > 0 ? "ready" : "empty",
      rowCount: rows.length,
    },
    rows,
  };
}

async function fetchLolalyticsRows(options = {}, deps = {}) {
  if (deps.rawRows) return normalizeLolalyticsRows(deps.rawRows, options);
  if (typeof deps.fetchSource !== "function") {
    return {
      sourceStatus: {
        provider: "LoLalytics",
        status: "unavailable",
        error: "fetchSource dependency is required.",
        rowCount: 0,
      },
      rows: [],
    };
  }
  const rawRows = await deps.fetchSource(options);
  return normalizeLolalyticsRows(rawRows, options);
}

module.exports = {
  normalizeLolalyticsRows,
  fetchLolalyticsRows,
  normalizeRole,
};
```

- [ ] **Step 4: Verify Green**

Run: `node --test tests/unit/metaFactory/sourceAdapters.test.js`

Expected: PASS.

- [ ] **Step 5: Add one failing unit test for missing/empty data**

Append:

```js
test("fetchLolalyticsRows reports unavailable source instead of producing bad candidates", async () => {
  const { fetchLolalyticsRows } = require(path.join(ROOT, "utils/metaFactory/sourceAdapters/lolalyticsAdapter.js"));

  const result = await fetchLolalyticsRows({ patch: "16.12" });

  assert.equal(result.sourceStatus.status, "unavailable");
  assert.equal(result.sourceStatus.provider, "LoLalytics");
  assert.deepEqual(result.rows, []);
});
```

- [ ] **Step 6: Run and verify Green after minimal code is already present**

Run: `node --test tests/unit/metaFactory/sourceAdapters.test.js`

Expected: PASS. If it fails, fix only `fetchLolalyticsRows`.

- [ ] **Step 7: Add external contract smoke test with explicit opt-in**

Create `tests/contract/metaFactory/lolalyticsContract.test.js`:

```js
const test = require("node:test");
const assert = require("node:assert/strict");

test("LoLalytics current page remains reachable for manual contract checks", async (t) => {
  if (process.env.RUN_EXTERNAL_CONTRACTS !== "1") {
    t.skip("Set RUN_EXTERNAL_CONTRACTS=1 to verify the live LoLalytics boundary.");
  }

  const response = await fetch("https://lolalytics.com/lol/tierlist/");
  assert.equal(response.ok, true);
  const html = await response.text();
  assert.match(html, /LoLalytics|tier/i);
});
```

- [ ] **Step 8: Run contract test in skipped and live modes**

Run: `node --test tests/contract/metaFactory/lolalyticsContract.test.js`

Expected: PASS with skip.

Run when network verification is desired: `RUN_EXTERNAL_CONTRACTS=1 node --test tests/contract/metaFactory/lolalyticsContract.test.js`

Expected: PASS if LoLalytics boundary is reachable. If FAIL due network or upstream markup, record the failure and keep unit tests fixture-based.

- [ ] **Step 9: Add TDD manifest slice**

Modify `config/tdd-coverage.json` with a new slice:

```json
{
  "id": "meta-factory-source-adapters",
  "description": "LoLalytics source normalization and external boundary smoke coverage for Meta Content Factory",
  "productionFiles": [
    "utils/metaFactory/sourceAdapters/lolalyticsAdapter.js"
  ],
  "testFiles": [
    "tests/unit/metaFactory/sourceAdapters.test.js"
  ]
}
```

Run: `npm run tdd:doctor`

Expected: PASS.

---

### Task 3: OP.GG Verifier And Offmeta Scoring

**Files:**
- Create: `utils/metaFactory/sourceAdapters/opggVerifier.js`
- Create: `utils/metaFactory/scoring.js`
- Create: `tests/unit/metaFactory/opggVerifier.test.js`
- Create/modify: `tests/unit/metaFactory/scoring.test.js`
- Modify: `config/tdd-coverage.json`

**Interfaces:**
- Produces: `verifyCandidate(candidate, deps): Promise<{ provider, status, sourceAgreement, notes }>`
- Produces: `scoreOffmetaCandidates(rows, verificationByKey, options): Array<OffmetaCandidate>`
- `OffmetaCandidate` has `{ candidateId, kind, offmetaType, champion, role, score, confidence, sourceAgreement, sampleSize, riskLabels, evidence, recommendedStoryAngle, hardBlock }`.

- [ ] **Step 1: Write one failing OP.GG unavailable test**

Create `tests/unit/metaFactory/opggVerifier.test.js`:

```js
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "../../..");

test("verifyCandidate returns unavailable when no OP.GG dependency is configured", async () => {
  const { verifyCandidate } = require(path.join(ROOT, "utils/metaFactory/sourceAdapters/opggVerifier.js"));

  const result = await verifyCandidate({ champion: "Velkoz", role: "Support" });

  assert.deepEqual(result, {
    provider: "OP.GG",
    status: "unavailable",
    sourceAgreement: 0.5,
    notes: ["OP.GG verifier dependency is not configured."],
  });
});
```

- [ ] **Step 2: Run and verify Red**

Run: `node --test tests/unit/metaFactory/opggVerifier.test.js`

Expected: FAIL because verifier module does not exist.

- [ ] **Step 3: Implement minimal verifier**

Create `utils/metaFactory/sourceAdapters/opggVerifier.js`:

```js
async function verifyCandidate(candidate = {}, deps = {}) {
  if (typeof deps.lookup !== "function") {
    return {
      provider: "OP.GG",
      status: "unavailable",
      sourceAgreement: 0.5,
      notes: ["OP.GG verifier dependency is not configured."],
    };
  }

  const result = await deps.lookup(candidate);
  if (!result || result.status === "unavailable") {
    return {
      provider: "OP.GG",
      status: "unavailable",
      sourceAgreement: 0.5,
      notes: [result?.reason || "OP.GG verifier did not return usable data."],
    };
  }

  return {
    provider: "OP.GG",
    status: result.agrees === false ? "mismatch" : "verified",
    sourceAgreement: result.agrees === false ? 0.25 : 1,
    notes: Array.isArray(result.notes) ? result.notes : [],
  };
}

module.exports = { verifyCandidate };
```

- [ ] **Step 4: Verify Green**

Run: `node --test tests/unit/metaFactory/opggVerifier.test.js`

Expected: PASS.

- [ ] **Step 5: Add one failing off-role scoring test**

Create `tests/unit/metaFactory/scoring.test.js`:

```js
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "../../..");

test("scoreOffmetaCandidates ranks non-primary roles with enough sample and positive win delta", () => {
  const { scoreOffmetaCandidates } = require(path.join(ROOT, "utils/metaFactory/scoring.js"));

  const candidates = scoreOffmetaCandidates([
    {
      champion: "Velkoz",
      role: "Support",
      primaryRole: "Mid",
      sampleSize: 18420,
      winRate: 52.8,
      baselineWinRate: 50.1,
      pickRate: 2.1,
      banRate: 0.8,
      builds: [],
      runes: [],
      summonerSpells: [],
      patch: "16.12",
      region: "global",
    },
  ], {
    "Velkoz::Support": { sourceAgreement: 1, status: "verified", notes: [] },
  });

  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].kind, "META_OFFMETA_PICK");
  assert.equal(candidates[0].offmetaType, "OFFROLE_PICK");
  assert.equal(candidates[0].champion, "Velkoz");
  assert.equal(candidates[0].role, "Support");
  assert.equal(candidates[0].hardBlock.blocked, false);
  assert.equal(candidates[0].riskLabels.includes("LOW_SAMPLE"), false);
  assert.equal(candidates[0].score > 70, true);
});
```

- [ ] **Step 6: Run and verify Red**

Run: `node --test tests/unit/metaFactory/scoring.test.js`

Expected: FAIL because scoring module does not exist.

- [ ] **Step 7: Implement minimal offmeta scoring**

Create `utils/metaFactory/scoring.js` with:

```js
function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

function round(value, digits = 2) {
  const multiplier = 10 ** digits;
  return Math.round((Number(value) || 0) * multiplier) / multiplier;
}

function candidateKey(row = {}) {
  return `${row.champion}::${row.role}`;
}

function riskLabelsForOffmeta(row = {}, verification = {}) {
  const labels = [];
  if ((row.sampleSize || 0) < 1000) labels.push("LOW_SAMPLE");
  if ((row.pickRate || 0) < 0.5) labels.push("LOW_PICK_RATE");
  if (verification.status === "mismatch") labels.push("SOURCE_MISMATCH");
  if (String(row.rankPreset || "").includes("master")) labels.push("HIGH_ELO_ONLY");
  return labels;
}

function hardBlockForOffmeta(row = {}, verification = {}) {
  const reasons = [];
  if (!row.champion || !row.role) reasons.push("Missing champion or role.");
  if ((row.sampleSize || 0) < 300) reasons.push("Sample size is below minimum threshold.");
  if ((row.winRate || 0) + 1 < (row.baselineWinRate || 50)) reasons.push("Win rate is below baseline.");
  if (verification.status === "mismatch" && (row.sampleSize || 0) < 2000) reasons.push("Source mismatch with low sample.");
  return { blocked: reasons.length > 0, reasons };
}

function scoreOffmetaCandidates(rows = [], verificationByKey = {}) {
  return rows
    .map((row) => {
      const verification = verificationByKey[candidateKey(row)] || { sourceAgreement: 0.5, status: "unavailable" };
      const winDelta = (row.winRate || 0) - (row.baselineWinRate || 50);
      const isOffRole = row.primaryRole && row.role && row.primaryRole !== row.role;
      const anomalyScore = isOffRole ? 90 : 45;
      const performanceScore = clamp(50 + winDelta * 10);
      const evidenceScore = clamp(Math.log10(Math.max(row.sampleSize || 1, 1)) * 18 + (verification.sourceAgreement || 0.5) * 20);
      const contentScore = isOffRole ? 85 : 60;
      const score = round(anomalyScore * 0.35 + performanceScore * 0.30 + evidenceScore * 0.20 + contentScore * 0.15);
      const riskLabels = riskLabelsForOffmeta(row, verification);
      const hardBlock = hardBlockForOffmeta(row, verification);

      return {
        candidateId: `offmeta-${String(row.champion).toLowerCase()}-${String(row.role).toLowerCase()}`,
        kind: "META_OFFMETA_PICK",
        offmetaType: isOffRole ? "OFFROLE_PICK" : "OFFMETA_BUILD",
        champion: row.champion,
        role: row.role,
        score,
        confidence: round(clamp(evidenceScore) / 100),
        sourceAgreement: round(verification.sourceAgreement ?? 0.5),
        sampleSize: row.sampleSize || 0,
        riskLabels,
        evidence: [
          { label: "Win rate", value: row.winRate },
          { label: "Baseline", value: row.baselineWinRate },
          { label: "Pick rate", value: row.pickRate },
        ],
        recommendedStoryAngle: `${row.champion} ${row.role} looks off-meta, but the sample is worth checking.`,
        hardBlock,
        sourceNotes: verification.notes || [],
      };
    })
    .sort((a, b) => b.score - a.score);
}

module.exports = {
  scoreOffmetaCandidates,
  candidateKey,
};
```

- [ ] **Step 8: Verify Green**

Run: `node --test tests/unit/metaFactory/scoring.test.js tests/unit/metaFactory/opggVerifier.test.js`

Expected: PASS.

- [ ] **Step 9: Add one failing hard-block test**

Append:

```js
test("scoreOffmetaCandidates hard-blocks low-sample source mismatches", () => {
  const { scoreOffmetaCandidates } = require(path.join(ROOT, "utils/metaFactory/scoring.js"));

  const candidates = scoreOffmetaCandidates([
    {
      champion: "Yuumi",
      role: "Jungle",
      primaryRole: "Support",
      sampleSize: 260,
      winRate: 48.2,
      baselineWinRate: 50.3,
      pickRate: 0.1,
    },
  ], {
    "Yuumi::Jungle": { sourceAgreement: 0.25, status: "mismatch", notes: ["OP.GG does not confirm this trend."] },
  });

  assert.equal(candidates[0].hardBlock.blocked, true);
  assert.equal(candidates[0].riskLabels.includes("LOW_SAMPLE"), true);
  assert.equal(candidates[0].riskLabels.includes("SOURCE_MISMATCH"), true);
});
```

- [ ] **Step 10: Run and verify Green**

Run: `node --test tests/unit/metaFactory/scoring.test.js`

Expected: PASS. If it fails, only adjust hard-block/risk label logic.

- [ ] **Step 11: Add TDD manifest slice**

Add a slice containing:

```json
{
  "id": "meta-factory-offmeta-scoring",
  "description": "OP.GG verification and offmeta candidate scoring for Meta Content Factory",
  "productionFiles": [
    "utils/metaFactory/sourceAdapters/opggVerifier.js",
    "utils/metaFactory/scoring.js"
  ],
  "testFiles": [
    "tests/unit/metaFactory/opggVerifier.test.js",
    "tests/unit/metaFactory/scoring.test.js"
  ]
}
```

Run: `npm run tdd:doctor`

Expected: PASS.

---

### Task 4: Tier Ranking Scoring

**Files:**
- Modify: `utils/metaFactory/scoring.js`
- Modify: `tests/unit/metaFactory/scoring.test.js`

**Interfaces:**
- Produces: `scoreTierRanking(rows, verificationByKey, options): { kind, role, rankingSize, entries, watchPick, downgradeReason }`
- `entries[]` has `{ champion, role, rank, tierBand, tierScore, winRate, pickRate, banRate, sampleSize, sourceAgreement, reasons, caveats }`.

- [ ] **Step 1: Write one failing Top 7 test**

Append to `tests/unit/metaFactory/scoring.test.js`:

```js
test("scoreTierRanking returns single-role Top 7 sorted by composite tier score", () => {
  const { scoreTierRanking } = require(path.join(ROOT, "utils/metaFactory/scoring.js"));

  const ranking = scoreTierRanking(makeTierRows("Mid", 9), {}, { role: "Mid" });

  assert.equal(ranking.kind, "META_TIER_RANKING");
  assert.equal(ranking.role, "Mid");
  assert.equal(ranking.rankingSize, 7);
  assert.equal(ranking.entries.length, 7);
  assert.deepEqual(ranking.entries.map((entry) => entry.rank), [1, 2, 3, 4, 5, 6, 7]);
  assert.equal(ranking.entries[0].tierScore >= ranking.entries[1].tierScore, true);
  assert.equal(["S", "A", "B"].includes(ranking.entries[0].tierBand), true);
});

function makeTierRows(role, count) {
  return Array.from({ length: count }, (_, index) => ({
    champion: `Champion${index + 1}`,
    role,
    primaryRole: role,
    sampleSize: 20000 - index * 1000,
    winRate: 54 - index * 0.6,
    pickRate: 12 - index * 0.7,
    banRate: 8 - index * 0.3,
    baselineWinRate: 50,
    patch: "16.12",
    region: "global",
  }));
}
```

- [ ] **Step 2: Run and verify Red**

Run: `node --test tests/unit/metaFactory/scoring.test.js`

Expected: FAIL because `scoreTierRanking` is missing.

- [ ] **Step 3: Implement minimal tier scoring**

Add to `utils/metaFactory/scoring.js`:

```js
function bandForScore(score) {
  if (score >= 82) return "S";
  if (score >= 68) return "A";
  return "B";
}

function tierScoreForRow(row = {}, verification = {}) {
  const winRateScore = clamp((row.winRate || 0) * 1.5);
  const pickRateScore = clamp((row.pickRate || 0) * 6);
  const banPressureScore = clamp((row.banRate || 0) * 5);
  const sampleConfidence = clamp(Math.log10(Math.max(row.sampleSize || 1, 1)) * 18);
  const sourceAgreement = clamp((verification.sourceAgreement ?? 0.75) * 100);
  const patchMomentum = clamp(((row.winRate || 0) - (row.baselineWinRate || 50)) * 12 + 50);
  return round(
    winRateScore * 0.35 +
    pickRateScore * 0.20 +
    banPressureScore * 0.15 +
    sampleConfidence * 0.15 +
    sourceAgreement * 0.10 +
    patchMomentum * 0.05
  );
}

function scoreTierRanking(rows = [], verificationByKey = {}, options = {}) {
  const role = options.role || rows[0]?.role || "Mid";
  const eligible = rows
    .filter((row) => row.role === role)
    .map((row) => {
      const verification = verificationByKey[candidateKey(row)] || { sourceAgreement: 0.75 };
      const tierScore = tierScoreForRow(row, verification);
      return {
        champion: row.champion,
        role,
        tierScore,
        winRate: row.winRate || 0,
        pickRate: row.pickRate || 0,
        banRate: row.banRate || 0,
        sampleSize: row.sampleSize || 0,
        sourceAgreement: round(verification.sourceAgreement ?? 0.75),
        reasons: [
          `Win rate ${row.winRate || 0}%`,
          `Pick rate ${row.pickRate || 0}%`,
        ],
        caveats: row.sampleSize < 1000 ? ["Sample size is low."] : [],
      };
    })
    .sort((a, b) => b.tierScore - a.tierScore);

  const rankingSize = eligible.length >= 7 ? 7 : Math.min(5, eligible.length);
  const entries = eligible.slice(0, rankingSize).map((entry, index) => ({
    ...entry,
    rank: index + 1,
    tierBand: bandForScore(entry.tierScore),
  }));

  return {
    kind: "META_TIER_RANKING",
    role,
    rankingSize,
    entries,
    watchPick: eligible[rankingSize] || null,
    downgradeReason: rankingSize < 7 ? "Available candidates did not meet Top 7 confidence." : "",
  };
}

module.exports = {
  scoreOffmetaCandidates,
  scoreTierRanking,
  candidateKey,
};
```

- [ ] **Step 4: Verify Green**

Run: `node --test tests/unit/metaFactory/scoring.test.js`

Expected: PASS.

- [ ] **Step 5: Add one failing Top 5 downgrade and exclude test**

Append:

```js
test("scoreTierRanking downgrades to Top 5 and excludes user-blocked champions", () => {
  const { scoreTierRanking } = require(path.join(ROOT, "utils/metaFactory/scoring.js"));

  const ranking = scoreTierRanking(makeTierRows("Jungle", 6), {}, {
    role: "Jungle",
    excludedChampions: ["Champion1"],
  });

  assert.equal(ranking.rankingSize, 5);
  assert.equal(ranking.entries.length, 5);
  assert.equal(ranking.entries.some((entry) => entry.champion === "Champion1"), false);
  assert.match(ranking.downgradeReason, /Top 7 confidence/);
});
```

- [ ] **Step 6: Run and verify Red**

Run: `node --test tests/unit/metaFactory/scoring.test.js`

Expected: FAIL because `excludedChampions` is not applied.

- [ ] **Step 7: Implement minimal exclusion support**

Update `scoreTierRanking`:

```js
const excluded = new Set((options.excludedChampions || []).map((name) => String(name).toLowerCase()));
const eligible = rows
  .filter((row) => row.role === role)
  .filter((row) => !excluded.has(String(row.champion || "").toLowerCase()))
  .map((row) => {
    // keep existing map body
  })
```

- [ ] **Step 8: Verify Green**

Run: `node --test tests/unit/metaFactory/scoring.test.js`

Expected: PASS.

- [ ] **Step 9: Refactor scoring constants**

Move magic numbers into constants at the top of `scoring.js`:

```js
const OFFMETA_WEIGHTS = {
  anomaly: 0.35,
  performance: 0.30,
  evidence: 0.20,
  content: 0.15,
};

const TIER_WEIGHTS = {
  winRate: 0.35,
  pickRate: 0.20,
  banPressure: 0.15,
  sampleConfidence: 0.15,
  sourceAgreement: 0.10,
  patchMomentum: 0.05,
};
```

Run: `node --test tests/unit/metaFactory/scoring.test.js`

Expected: PASS.

---

### Task 5: Snapshot Store And Scan API Handler

**Files:**
- Create: `utils/metaFactory/snapshotStore.js`
- Create: `utils/metaFactory/apiHandlers.js`
- Create: `tests/unit/metaFactory/snapshotStore.test.js`
- Create/modify: `tests/unit/metaFactory/apiHandlers.test.js`
- Modify: `config/tdd-coverage.json`

**Interfaces:**
- Produces: `writeMetaSnapshot(snapshot): object`
- Produces: `readMetaSnapshot(snapshotId, options): object`
- Produces: `handleMetaScanRequest(body, deps): Promise<{ success, snapshotId, candidates, sourceStatus }>`
- Snapshot shape contains `{ snapshotId, createdAt, patch, filters, sourceStatus, candidates: { offmeta, tierRankings } }`.

- [ ] **Step 1: Write one failing snapshot store test**

Create `tests/unit/metaFactory/snapshotStore.test.js`:

```js
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "../../..");

function clearStoreModule() {
  delete require.cache[path.join(ROOT, "utils/metaFactory/snapshotStore.js")];
}

test("meta snapshot store writes and reads snapshots by snapshotId", () => {
  const originalCwd = process.cwd();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hvs-meta-store-"));
  process.chdir(dir);
  clearStoreModule();
  try {
    const { writeMetaSnapshot, readMetaSnapshot } = require(path.join(ROOT, "utils/metaFactory/snapshotStore.js"));
    writeMetaSnapshot({
      snapshotId: "meta-scan-1",
      createdAt: "2026-06-21T08:00:00.000Z",
      patch: "16.12",
      candidates: { offmeta: [], tierRankings: [] },
    });

    const snapshot = readMetaSnapshot("meta-scan-1", {
      now: () => new Date("2026-06-21T08:05:00.000Z"),
    });

    assert.equal(snapshot.snapshotId, "meta-scan-1");
    assert.deepEqual(snapshot.candidates, { offmeta: [], tierRankings: [] });
  } finally {
    process.chdir(originalCwd);
    clearStoreModule();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: Run and verify Red**

Run: `node --test tests/unit/metaFactory/snapshotStore.test.js`

Expected: FAIL because store module does not exist.

- [ ] **Step 3: Implement minimal snapshot store**

Create `utils/metaFactory/snapshotStore.js`:

```js
const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(process.cwd(), ".data");
const STORE_PATH = path.join(DATA_DIR, "meta-factory-snapshots.json");
const DEFAULT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

function nowDate(now = () => new Date()) {
  const value = now();
  return value instanceof Date ? value : new Date(value);
}

function ensureDataDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readStore() {
  ensureDataDir();
  if (!fs.existsSync(STORE_PATH)) return { version: 1, snapshots: [] };
  try {
    const parsed = JSON.parse(fs.readFileSync(STORE_PATH, "utf8"));
    return { version: 1, snapshots: Array.isArray(parsed.snapshots) ? parsed.snapshots : [] };
  } catch {
    return { version: 1, snapshots: [] };
  }
}

function writeStore(store) {
  ensureDataDir();
  fs.writeFileSync(STORE_PATH, JSON.stringify({
    version: 1,
    snapshots: Array.isArray(store.snapshots) ? store.snapshots : [],
  }, null, 2), "utf8");
}

function writeMetaSnapshot(snapshot = {}) {
  if (!snapshot.snapshotId) throw new Error("snapshotId is required.");
  const store = readStore();
  const next = { ...snapshot, createdAt: snapshot.createdAt || new Date().toISOString() };
  const index = store.snapshots.findIndex((entry) => entry.snapshotId === snapshot.snapshotId);
  if (index >= 0) store.snapshots[index] = next;
  else store.snapshots.unshift(next);
  writeStore(store);
  return next;
}

function readMetaSnapshot(snapshotId, options = {}) {
  const id = String(snapshotId || "").trim();
  const snapshot = readStore().snapshots.find((entry) => entry.snapshotId === id);
  if (!snapshot) throw new Error(`Meta snapshot not found: ${id || "UNKNOWN"}`);
  const maxAgeMs = Number.isFinite(Number(options.maxAgeMs)) ? Number(options.maxAgeMs) : DEFAULT_MAX_AGE_MS;
  const ageMs = nowDate(options.now).getTime() - new Date(snapshot.createdAt || 0).getTime();
  if (Number.isFinite(ageMs) && ageMs > maxAgeMs) throw new Error(`Meta snapshot expired: ${id}`);
  return snapshot;
}

module.exports = {
  STORE_PATH,
  DEFAULT_MAX_AGE_MS,
  readStore,
  writeMetaSnapshot,
  readMetaSnapshot,
};
```

- [ ] **Step 4: Verify Green**

Run: `node --test tests/unit/metaFactory/snapshotStore.test.js`

Expected: PASS.

- [ ] **Step 5: Write one failing scan handler test**

Create `tests/unit/metaFactory/apiHandlers.test.js`:

```js
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "../../..");

function clearModules() {
  ["utils/metaFactory/apiHandlers.js", "utils/metaFactory/snapshotStore.js"].forEach((file) => {
    delete require.cache[path.join(ROOT, file)];
  });
}

test("handleMetaScanRequest writes snapshot with offmeta and tier candidates", async () => {
  const originalCwd = process.cwd();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hvs-meta-api-"));
  process.chdir(dir);
  clearModules();
  try {
    const { handleMetaScanRequest } = require(path.join(ROOT, "utils/metaFactory/apiHandlers.js"));
    const result = await handleMetaScanRequest({
      patch: "16.12",
      region: "global",
      position: "Mid",
    }, {
      fetchLolalyticsRows: async () => ({
        sourceStatus: { provider: "LoLalytics", status: "ready", rowCount: 8 },
        rows: makeRows(),
      }),
      verifyCandidate: async () => ({ provider: "OP.GG", status: "verified", sourceAgreement: 1, notes: [] }),
      now: () => new Date("2026-06-21T08:00:00.000Z"),
    });

    assert.equal(result.success, true);
    assert.match(result.snapshotId, /^meta-16\.12-/);
    assert.equal(result.candidates.offmeta.length > 0, true);
    assert.equal(result.candidates.tierRankings.length, 1);
  } finally {
    process.chdir(originalCwd);
    clearModules();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function makeRows() {
  return Array.from({ length: 8 }, (_, index) => ({
    champion: index === 0 ? "Velkoz" : `Champion${index}`,
    role: "Mid",
    primaryRole: index === 0 ? "Support" : "Mid",
    sampleSize: 15000 - index * 1000,
    winRate: 54 - index * 0.4,
    pickRate: 10 - index * 0.5,
    banRate: 4,
    baselineWinRate: 50,
    patch: "16.12",
    region: "global",
  }));
}
```

- [ ] **Step 6: Run and verify Red**

Run: `node --test tests/unit/metaFactory/apiHandlers.test.js`

Expected: FAIL because API handler module does not exist.

- [ ] **Step 7: Implement minimal scan handler**

Create `utils/metaFactory/apiHandlers.js`:

```js
const crypto = require("crypto");
const { fetchLolalyticsRows: defaultFetchLolalyticsRows } = require("./sourceAdapters/lolalyticsAdapter");
const { verifyCandidate: defaultVerifyCandidate } = require("./sourceAdapters/opggVerifier");
const { candidateKey, scoreOffmetaCandidates, scoreTierRanking } = require("./scoring");
const { writeMetaSnapshot, readMetaSnapshot } = require("./snapshotStore");

function normalizePosition(value = "Mid") {
  const key = String(value || "Mid").toLowerCase();
  if (key === "jungle") return "Jungle";
  if (key === "top") return "Top";
  if (key === "adc" || key === "bottom" || key === "bot") return "ADC";
  if (key === "support") return "Support";
  return "Mid";
}

function createSnapshotId({ patch = "unknown", position = "Mid" }, createdAt) {
  const hash = crypto.createHash("sha1").update(`${patch}:${position}:${createdAt}`).digest("hex").slice(0, 10);
  return `meta-${patch}-${hash}`;
}

async function buildVerificationMap(rows, verifyCandidate) {
  const entries = [];
  for (const row of rows) {
    entries.push([candidateKey(row), await verifyCandidate(row)]);
  }
  return Object.fromEntries(entries);
}

async function handleMetaScanRequest(body = {}, deps = {}) {
  if (body.useSample) throw new Error("useSample is not supported for meta factory scans.");
  const now = deps.now || (() => new Date());
  const createdAtValue = now();
  const createdAt = (createdAtValue instanceof Date ? createdAtValue : new Date(createdAtValue)).toISOString();
  const position = normalizePosition(body.position);
  const fetchLolalyticsRows = deps.fetchLolalyticsRows || defaultFetchLolalyticsRows;
  const verifyCandidate = deps.verifyCandidate || defaultVerifyCandidate;
  const source = await fetchLolalyticsRows({
    patch: body.patch,
    region: body.region || "global",
    position,
    rankPreset: body.rankPreset || "emerald_plus",
  });
  const verificationByKey = await buildVerificationMap(source.rows || [], verifyCandidate);
  const offmeta = scoreOffmetaCandidates(source.rows || [], verificationByKey);
  const tierRanking = scoreTierRanking(source.rows || [], verificationByKey, {
    role: position,
    excludedChampions: body.excludedChampions || [],
  });
  const snapshot = writeMetaSnapshot({
    snapshotId: createSnapshotId({ patch: body.patch, position }, createdAt),
    createdAt,
    patch: body.patch || "",
    filters: {
      region: body.region || "global",
      queue: body.queue || "ranked_solo_duo",
      position,
      rankPreset: body.rankPreset || "emerald_plus",
    },
    sourceStatus: {
      primary: source.sourceStatus,
      verifier: { provider: "OP.GG", status: "checked", checkedRows: Object.keys(verificationByKey).length },
    },
    candidates: {
      offmeta,
      tierRankings: [tierRanking],
    },
  });
  return { success: true, ...snapshot };
}

function handleMetaSnapshotRequest(snapshotId, options = {}) {
  return { success: true, ...readMetaSnapshot(snapshotId, options) };
}

module.exports = {
  handleMetaScanRequest,
  handleMetaSnapshotRequest,
  normalizePosition,
};
```

- [ ] **Step 8: Verify Green**

Run: `node --test tests/unit/metaFactory/apiHandlers.test.js tests/unit/metaFactory/snapshotStore.test.js`

Expected: PASS.

- [ ] **Step 9: Add one failing no-sample and missing snapshot test**

Append to `tests/unit/metaFactory/apiHandlers.test.js`:

```js
test("meta scan rejects runtime sample mode and snapshot read reports missing ids", async () => {
  const originalCwd = process.cwd();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hvs-meta-api-errors-"));
  process.chdir(dir);
  clearModules();
  try {
    const { handleMetaScanRequest, handleMetaSnapshotRequest } = require(path.join(ROOT, "utils/metaFactory/apiHandlers.js"));
    await assert.rejects(() => handleMetaScanRequest({ useSample: true }), /useSample is not supported/);
    assert.throws(() => handleMetaSnapshotRequest("missing"), /Meta snapshot not found/);
  } finally {
    process.chdir(originalCwd);
    clearModules();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
```

- [ ] **Step 10: Run and verify Green**

Run: `node --test tests/unit/metaFactory/apiHandlers.test.js`

Expected: PASS.

- [ ] **Step 11: Add TDD manifest slice**

Add a slice containing:

```json
{
  "id": "meta-factory-snapshot-api",
  "description": "Meta Factory scan snapshots and API boundary orchestration",
  "productionFiles": [
    "utils/metaFactory/snapshotStore.js",
    "utils/metaFactory/apiHandlers.js"
  ],
  "testFiles": [
    "tests/unit/metaFactory/snapshotStore.test.js",
    "tests/unit/metaFactory/apiHandlers.test.js"
  ]
}
```

Run: `npm run tdd:doctor`

Expected: PASS.

---

### Task 6: Render Planner, Remotion Templates, And Queue Handoff

**Files:**
- Create: `utils/metaFactory/candidatePlanner.js`
- Create: `tests/unit/metaFactory/renderPlanner.test.js`
- Create: `src/templates/Template_MetaOffmeta.jsx`
- Create: `src/templates/Template_MetaTierRanking.jsx`
- Modify: `utils/metaFactory/apiHandlers.js`
- Modify: `utils/render/renderService.js`
- Modify: `src/Composition.jsx`
- Modify: `src/Root.jsx`
- Modify: `utils/publishing/copy.js`
- Modify: `config/tdd-coverage.json`

**Interfaces:**
- Produces: `buildMetaRenderPayload(candidate, locale): object`
- Produces: `handleMetaRenderRequest(body, deps): Promise<{ success, videos, publish, candidate }>`
- Render request supports `{ snapshotId, mode, candidateId, useTopCandidate, scheduledAt }`.

- [ ] **Step 1: Write one failing planner test for offmeta bilingual payloads**

Create `tests/unit/metaFactory/renderPlanner.test.js`:

```js
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "../../..");

test("buildMetaRenderPayload creates zh/en offmeta payloads from one snapshot candidate", () => {
  const { buildMetaRenderPayload } = require(path.join(ROOT, "utils/metaFactory/candidatePlanner.js"));
  const candidate = {
    kind: "META_OFFMETA_PICK",
    champion: "Velkoz",
    role: "Support",
    offmetaType: "OFFROLE_PICK",
    score: 82,
    confidence: 0.78,
    sourceAgreement: 1,
    sampleSize: 18420,
    riskLabels: ["HIGH_ELO_ONLY"],
    evidence: [{ label: "Win rate", value: 52.8 }],
    recommendedStoryAngle: "Velkoz support has enough data to check.",
    hardBlock: { blocked: false, reasons: [] },
  };

  const zh = buildMetaRenderPayload(candidate, "zh");
  const en = buildMetaRenderPayload(candidate, "en");

  assert.equal(zh.dataType, "META_OFFMETA_PICK");
  assert.equal(en.dataType, "META_OFFMETA_PICK");
  assert.equal(zh.locale, "zh");
  assert.equal(en.locale, "en");
  assert.equal(zh.champion, "Velkoz");
  assert.equal(zh.storyboard.length >= 4, true);
  assert.equal(en.storyboard.some((scene) => scene.text.includes("Velkoz")), true);
});
```

- [ ] **Step 2: Run and verify Red**

Run: `node --test tests/unit/metaFactory/renderPlanner.test.js`

Expected: FAIL because planner module does not exist.

- [ ] **Step 3: Implement minimal planner**

Create `utils/metaFactory/candidatePlanner.js`:

```js
function isEnglish(locale = "zh") {
  return String(locale || "zh").toLowerCase().startsWith("en");
}

function buildOffmetaPayload(candidate = {}, locale = "zh") {
  const en = isEnglish(locale);
  const title = en
    ? `${candidate.champion} ${candidate.role}: real off-meta or bait?`
    : `${candidate.champion} ${candidate.role}：黑科技還是陷阱？`;
  return {
    dataType: "META_OFFMETA_PICK",
    locale: en ? "en" : "zh",
    title,
    champion: candidate.champion,
    role: candidate.role,
    offmetaType: candidate.offmetaType || "OFFROLE_PICK",
    score: candidate.score || 0,
    confidence: candidate.confidence || 0,
    sourceAgreement: candidate.sourceAgreement || 0,
    sampleSize: candidate.sampleSize || 0,
    riskLabels: candidate.riskLabels || [],
    evidence: candidate.evidence || [],
    recommendedStoryAngle: candidate.recommendedStoryAngle || "",
    hardBlock: candidate.hardBlock || { blocked: false, reasons: [] },
    storyboard: en ? [
      { tag: "HOOK", text: `${candidate.champion} ${candidate.role}\nlooks wrong`, durationInFrames: 90 },
      { tag: "STAT_REVEAL", text: `Score ${candidate.score || 0}\nSample ${candidate.sampleSize || 0}`, durationInFrames: 120 },
      { tag: "STAT_REVEAL", text: "Check the risks\nbefore copying it", durationInFrames: 120 },
      { tag: "CONCLUSION_CTA", text: "Real tech or bait?\nComment your read", durationInFrames: 90 },
    ] : [
      { tag: "HOOK", text: `${candidate.champion} ${candidate.role}\n看起來很怪`, durationInFrames: 90 },
      { tag: "STAT_REVEAL", text: `分數 ${candidate.score || 0}\n樣本 ${candidate.sampleSize || 0}`, durationInFrames: 120 },
      { tag: "STAT_REVEAL", text: "先看風險\n不要無腦抄", durationInFrames: 120 },
      { tag: "CONCLUSION_CTA", text: "這是真貨還是陷阱\n留言告訴我", durationInFrames: 90 },
    ],
  };
}

function buildTierPayload(candidate = {}, locale = "zh") {
  const en = isEnglish(locale);
  return {
    dataType: "META_TIER_RANKING",
    locale: en ? "en" : "zh",
    title: en ? `${candidate.role} Top ${candidate.rankingSize}` : `${candidate.role} 梯度榜 Top ${candidate.rankingSize}`,
    role: candidate.role || "Mid",
    rankingSize: candidate.rankingSize || 7,
    entries: candidate.entries || [],
    watchPick: candidate.watchPick || null,
    downgradeReason: candidate.downgradeReason || "",
    storyboard: [
      { tag: "HOOK", text: en ? `${candidate.role} meta\nTop picks` : `${candidate.role} 版本答案\n先看這幾隻`, durationInFrames: 90 },
      { tag: "STAT_REVEAL", text: en ? "Composite score\nnot pure win rate" : "綜合強度分\n不是只看勝率", durationInFrames: 120 },
      { tag: "CONCLUSION_CTA", text: en ? "Which role next?\nComment below" : "下一路想看哪裡\n留言告訴我", durationInFrames: 90 },
    ],
  };
}

function buildMetaRenderPayload(candidate = {}, locale = "zh") {
  if (candidate.kind === "META_TIER_RANKING") return buildTierPayload(candidate, locale);
  return buildOffmetaPayload(candidate, locale);
}

module.exports = {
  buildMetaRenderPayload,
};
```

- [ ] **Step 4: Verify Green**

Run: `node --test tests/unit/metaFactory/renderPlanner.test.js`

Expected: PASS.

- [ ] **Step 5: Write one failing render handler test**

Append to `tests/unit/metaFactory/apiHandlers.test.js`:

```js
test("handleMetaRenderRequest renders zh/en from snapshot and queues IG/Threads only", async () => {
  const originalCwd = process.cwd();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hvs-meta-render-"));
  process.chdir(dir);
  clearModules();
  try {
    const { writeMetaSnapshot } = require(path.join(ROOT, "utils/metaFactory/snapshotStore.js"));
    writeMetaSnapshot({
      snapshotId: "meta-render-1",
      createdAt: "2026-06-21T08:00:00.000Z",
      candidates: {
        offmeta: [{
          candidateId: "offmeta-velkoz-support",
          kind: "META_OFFMETA_PICK",
          champion: "Velkoz",
          role: "Support",
          score: 82,
          confidence: 0.78,
          sourceAgreement: 1,
          sampleSize: 18420,
          riskLabels: [],
          evidence: [],
          hardBlock: { blocked: false, reasons: [] },
        }],
        tierRankings: [],
      },
    });
    const { handleMetaRenderRequest } = require(path.join(ROOT, "utils/metaFactory/apiHandlers.js"));
    const result = await handleMetaRenderRequest({
      snapshotId: "meta-render-1",
      mode: "offmeta",
      candidateId: "offmeta-velkoz-support",
    }, {
      renderVideosFromRequest: async (payload) => ({ videos: [{ locale: payload.locale, videoUrl: `/renders/${payload.locale}.mp4`, fileName: `${payload.locale}.mp4` }] }),
      createPublishJobs: async (request) => ({ success: true, platforms: request.platforms, jobs: request.videos.map((video) => ({ locale: video.locale })) }),
    });

    assert.equal(result.success, true);
    assert.deepEqual(result.videos.map((video) => video.locale), ["zh", "en"]);
    assert.deepEqual(result.publish.platforms, ["instagram", "threads"]);
  } finally {
    process.chdir(originalCwd);
    clearModules();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
```

- [ ] **Step 6: Run and verify Red**

Run: `node --test tests/unit/metaFactory/apiHandlers.test.js`

Expected: FAIL because `handleMetaRenderRequest` is missing.

- [ ] **Step 7: Implement minimal render handler**

Add to `utils/metaFactory/apiHandlers.js`:

```js
const { createPublishJobs: defaultCreatePublishJobs } = require("../publishing");
const { renderVideosFromRequest: defaultRenderVideosFromRequest } = require("../render/renderService");
const { buildMetaRenderPayload } = require("./candidatePlanner");

function selectMetaCandidate(snapshot = {}, { mode = "offmeta", candidateId, useTopCandidate } = {}) {
  const pool = mode === "tier" ? snapshot.candidates?.tierRankings || [] : snapshot.candidates?.offmeta || [];
  const candidate = useTopCandidate
    ? [...pool].filter((item) => !item.hardBlock?.blocked).sort((a, b) => (b.score || b.entries?.[0]?.tierScore || 0) - (a.score || a.entries?.[0]?.tierScore || 0))[0]
    : pool.find((item) => item.candidateId === candidateId || item.kind === "META_TIER_RANKING" && candidateId === item.role);
  if (!candidate) throw new Error(`Meta candidate not found: ${candidateId || "TOP"}`);
  if (candidate.hardBlock?.blocked) {
    throw new Error(`Meta candidate is hard-blocked: ${(candidate.hardBlock.reasons || []).join("; ")}`);
  }
  return candidate;
}

async function handleMetaRenderRequest(body = {}, deps = {}) {
  const snapshot = readMetaSnapshot(body.snapshotId);
  const candidate = selectMetaCandidate(snapshot, body);
  const renderVideosFromRequest = deps.renderVideosFromRequest || defaultRenderVideosFromRequest;
  const createPublishJobs = deps.createPublishJobs || defaultCreatePublishJobs;
  const videos = [];
  const payloads = [];
  for (const locale of ["zh", "en"]) {
    const payload = buildMetaRenderPayload(candidate, locale);
    payloads.push(payload);
    const render = await renderVideosFromRequest({ ...payload, renderLanguages: [locale] });
    const video = Array.isArray(render.videos) ? render.videos[0] : { locale, videoUrl: render.videoUrl, fileName: render.fileName };
    videos.push({ ...video, type: body.mode === "tier" ? "meta-tier-ranking" : "meta-offmeta-pick", locale });
  }
  const publish = await createPublishJobs({
    videos,
    platforms: ["instagram", "threads"],
    action: "queue",
    analysis: payloads[0],
    scheduledAt: body.scheduledAt,
  });
  return { success: true, snapshotId: snapshot.snapshotId, candidate, payloads, videos, publish };
}

module.exports = {
  handleMetaScanRequest,
  handleMetaSnapshotRequest,
  handleMetaRenderRequest,
  normalizePosition,
};
```

- [ ] **Step 8: Verify Green**

Run: `node --test tests/unit/metaFactory/apiHandlers.test.js tests/unit/metaFactory/renderPlanner.test.js`

Expected: PASS.

- [ ] **Step 9: Add render mapping and composition tests one at a time**

Add to `tests/unit/render/compositionScope.test.js`:

```js
test("Meta router and root defaults register only new META dataTypes", () => {
  const { DATA_TYPE_TO_COMPOSITION } = require(path.join(ROOT, "utils/render/renderService.js"));
  assert.equal(DATA_TYPE_TO_COMPOSITION.META_OFFMETA_PICK, "MetaOffmetaVideo");
  assert.equal(DATA_TYPE_TO_COMPOSITION.META_TIER_RANKING, "MetaTierRankingVideo");
  assert.equal(Object.hasOwn(DATA_TYPE_TO_COMPOSITION, "PRO_BUILD"), false);
  assert.equal(Object.hasOwn(DATA_TYPE_TO_COMPOSITION, "TIER_LIST"), false);
});
```

Run: `node --test tests/unit/render/compositionScope.test.js`

Expected: FAIL until render mapping is added.

- [ ] **Step 10: Implement minimal render mapping and templates**

Modify `utils/render/renderService.js`:

```js
META_OFFMETA_PICK: "MetaOffmetaVideo",
META_TIER_RANKING: "MetaTierRankingVideo",
```

Create `src/templates/Template_MetaOffmeta.jsx`:

```jsx
import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { BgmLayer } from "../video-system/BgmLayer";
import { HextechBackground } from "../video-system/HextechBackground";
import { SubtitleCaption } from "../video-system/SubtitleCaption";
import { buildTimeline, getActiveTimelineScene } from "../video-system/pacing";
import {
  DataPill,
  KineticTitle,
  PipelineBadge,
  PipelineChrome,
  RevealList,
  SafeStage,
  VerdictCard,
  getPipelineTheme,
} from "../video-system/VideoPrimitives";

const fallbackStoryboard = (data = {}) => data.storyboard?.length ? data.storyboard : [
  { tag: "HOOK", text: `${data.champion || "Champion"} ${data.role || "Role"}\n看起來很怪`, durationInFrames: 90 },
  { tag: "STAT_REVEAL", text: `分數 ${data.score || 0}\n樣本 ${data.sampleSize || 0}`, durationInFrames: 120 },
  { tag: "RISK", text: "先看風險\n不要無腦抄", durationInFrames: 120 },
  { tag: "CONCLUSION_CTA", text: "這是真貨還是陷阱\n留言告訴我", durationInFrames: 90 },
];

export const Template_MetaOffmeta = ({ data = {} }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const theme = getPipelineTheme("META_OFFMETA_PICK");
  const timeline = buildTimeline(fallbackStoryboard(data), fps);
  const active = getActiveTimelineScene(timeline, frame);
  const risks = (data.riskLabels || []).slice(0, 3);

  return (
    <AbsoluteFill style={{ backgroundColor: "#07111f", color: "#fff", fontFamily: "'Outfit', 'Noto Sans TC', sans-serif", overflow: "hidden" }}>
      <HextechBackground tactical />
      <PipelineChrome theme={theme} left="META OFFMETA" right="LOLALYTICS / OP.GG" />
      <BgmLayer bgmFile={data.bgmFile || "audio/bgm1.mp3"} />
      <SafeStage>
        <div style={{ height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", gap: 34 }}>
          <PipelineBadge theme={theme} localFrame={active.localFrame}>BLACK TECH CHECK</PipelineBadge>
          <KineticTitle
            eyebrow={`${data.role || "Role"} · ${data.offmetaType || "OFFMETA"}`}
            title={`${data.champion || "Champion"} ${data.role || ""}`}
            subtitle={data.recommendedStoryAngle || "非主流玩法，先看數據再抄。"}
            theme={theme}
            localFrame={active.localFrame}
            size={78}
          />
          <div style={{ display: "flex", gap: 14, justifyContent: "center" }}>
            <DataPill label="Score" value={data.score || 0} color={theme.accent} />
            <DataPill label="Sample" value={data.sampleSize || 0} color={theme.secondary} />
            <DataPill label="Agree" value={data.sourceAgreement ?? 0} color="#f0c674" />
          </div>
          <RevealList
            items={risks.length ? risks : ["NO_MAJOR_RISK"]}
            localFrame={active.localFrame - 10}
            accent={theme.accent}
            renderItem={(risk) => <VerdictCard title="RISK CHECK" body={String(risk)} chips={["Review", "Meta", "Evidence"]} theme={theme} localFrame={active.localFrame} />}
          />
        </div>
      </SafeStage>
      <SubtitleCaption scene={active.scene} activeStart={active.start} accent={theme.accent} />
    </AbsoluteFill>
  );
};
```

Create `src/templates/Template_MetaTierRanking.jsx`:

```jsx
import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { BgmLayer } from "../video-system/BgmLayer";
import { HextechBackground } from "../video-system/HextechBackground";
import { SubtitleCaption } from "../video-system/SubtitleCaption";
import { buildTimeline, getActiveTimelineScene } from "../video-system/pacing";
import {
  DataPill,
  GlassPanel,
  KineticTitle,
  PipelineChrome,
  RevealList,
  SafeStage,
  getPipelineTheme,
} from "../video-system/VideoPrimitives";

const fallbackStoryboard = (data = {}) => data.storyboard?.length ? data.storyboard : [
  { tag: "HOOK", text: `${data.role || "Mid"} 梯度榜\n先看版本答案`, durationInFrames: 90 },
  { tag: "RANKING", text: "綜合強度分\n不是只看勝率", durationInFrames: 210 },
  { tag: "CONCLUSION_CTA", text: "下一路想看哪裡\n留言告訴我", durationInFrames: 90 },
];

export const Template_MetaTierRanking = ({ data = {} }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const theme = getPipelineTheme("META_TIER_RANKING");
  const timeline = buildTimeline(fallbackStoryboard(data), fps);
  const active = getActiveTimelineScene(timeline, frame);
  const entries = (data.entries || []).slice(0, data.rankingSize || 7);

  return (
    <AbsoluteFill style={{ backgroundColor: "#07111f", color: "#fff", fontFamily: "'Outfit', 'Noto Sans TC', sans-serif", overflow: "hidden" }}>
      <HextechBackground tactical />
      <PipelineChrome theme={theme} left="META TIER LIST" right="COMPOSITE SCORE" />
      <BgmLayer bgmFile={data.bgmFile || "audio/bgm2.mp3"} />
      <SafeStage inset="92px 62px 190px">
        <div style={{ height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", gap: 30 }}>
          <KineticTitle
            eyebrow={`${data.role || "Mid"} · Top ${data.rankingSize || entries.length || 5}`}
            title={data.title || "梯度榜"}
            subtitle={data.downgradeReason || "勝率、登場率、禁用率與樣本一起看。"}
            theme={theme}
            localFrame={active.localFrame}
            size={72}
          />
          <RevealList
            items={entries}
            localFrame={active.localFrame - 8}
            accent={theme.accent}
            renderItem={(entry) => (
              <GlassPanel accent={theme.accent} style={{ display: "grid", gridTemplateColumns: "90px 1fr 150px", alignItems: "center", minHeight: 96 }}>
                <DataPill label={`#${entry.rank}`} value={entry.tierBand || "A"} color={theme.accent} />
                <div>
                  <div style={{ fontSize: 38, fontWeight: 950 }}>{entry.champion}</div>
                  <div style={{ color: "rgba(219,234,254,0.72)", fontSize: 22, fontWeight: 800 }}>{(entry.reasons || []).slice(0, 2).join(" · ")}</div>
                </div>
                <div style={{ color: theme.secondary, fontSize: 46, fontWeight: 950, textAlign: "right" }}>{entry.tierScore}</div>
              </GlassPanel>
            )}
          />
        </div>
      </SafeStage>
      <SubtitleCaption scene={active.scene} activeStart={active.start} accent={theme.accent} />
    </AbsoluteFill>
  );
};
```

Modify `src/video-system/VideoPrimitives.jsx` to add themes:

```js
META_OFFMETA_PICK: { label: "BLACK TECH CHECK", accent: "#34d399", secondary: HEXTECH_COLORS.gold },
META_TIER_RANKING: { label: "META TIER BOARD", accent: HEXTECH_COLORS.cyan, secondary: "#8855FF" },
```

Modify `src/Composition.jsx` to route:

```jsx
if (dataType === "META_OFFMETA_PICK") return <Template_MetaOffmeta {...props} />;
if (dataType === "META_TIER_RANKING") return <Template_MetaTierRanking {...props} />;
```

Modify `src/Root.jsx` to register:

```jsx
<Composition id="MetaOffmetaVideo" component={CompositionRouter} durationInFrames={420} fps={30} width={1080} height={1920} defaultProps={{ data: { dataType: "META_OFFMETA_PICK", champion: "Velkoz", role: "Support" } }} />
<Composition id="MetaTierRankingVideo" component={CompositionRouter} durationInFrames={450} fps={30} width={1080} height={1920} defaultProps={{ data: { dataType: "META_TIER_RANKING", role: "Mid", entries: [] } }} />
```

Use the exact local component names already used in `Root.jsx` when adding the compositions.

- [ ] **Step 11: Verify Green**

Run: `node --test tests/unit/render/compositionScope.test.js tests/unit/metaFactory/renderPlanner.test.js`

Expected: PASS.

- [ ] **Step 12: Add publishing copy support**

Add one failing test to `tests/unit/publishing/copy.test.js`:

```js
test("buildSocialCopy supports new Meta Factory dataTypes without old labels", () => {
  const { buildSocialCopy } = require(path.join(ROOT, "utils/publishing/copy.js"));
  const copy = buildSocialCopy({
    platform: "instagram",
    locale: "zh",
    analysis: {
      dataType: "META_OFFMETA_PICK",
      champion: "Velkoz",
      role: "Support",
      title: "Velkoz Support 黑科技",
      storyboard: [{ text: "Velkoz Support\n看起來很怪" }],
    },
  });

  assert.match(copy.caption, /Velkoz/);
  assert.doesNotMatch(copy.caption, /Pro Build|Tier List/);
});
```

Run: `node --test tests/unit/publishing/copy.test.js`

Expected: FAIL until copy labels include `META_*`.

Implement by adding `META_OFFMETA_PICK` and `META_TIER_RANKING` labels/tags in `utils/publishing/copy.js`, without adding old labels.

Run: `node --test tests/unit/publishing/copy.test.js`

Expected: PASS.

- [ ] **Step 13: Add TDD manifest slice**

Add a slice containing:

```json
{
  "id": "meta-factory-render-queue",
  "description": "Meta Factory render payload planning, Remotion routing, and IG/Threads queue handoff",
  "productionFiles": [
    "utils/metaFactory/candidatePlanner.js"
  ],
  "testFiles": [
    "tests/unit/metaFactory/renderPlanner.test.js"
  ]
}
```

Do not add `utils/render/renderService.js` or `utils/publishing/copy.js` to this slice if they are already owned by another slice in `config/tdd-coverage.json`.

Run: `npm run tdd:doctor`

Expected: PASS.

---

### Task 7: Next API Routes

**Files:**
- Create: `app/api/meta-factory/scan/route.js`
- Create: `app/api/meta-factory/snapshot/route.js`
- Create: `app/api/meta-factory/render/route.js`
- Modify: `tests/unit/metaFactory/apiHandlers.test.js`

**Interfaces:**
- API `POST /api/meta-factory/scan` accepts `{ patch, region, queue, position, rankPreset, excludedChampions }`.
- API `GET /api/meta-factory/snapshot?snapshotId=...` returns snapshot.
- API `POST /api/meta-factory/render` accepts `{ snapshotId, mode, candidateId, useTopCandidate, scheduledAt }`.

- [ ] **Step 1: Add one failing handler-level status test**

Append to `tests/unit/metaFactory/apiHandlers.test.js`:

```js
test("handleMetaScanRequest surfaces LoLalytics source failure as a non-renderable empty snapshot", async () => {
  const { handleMetaScanRequest } = require(path.join(ROOT, "utils/metaFactory/apiHandlers.js"));

  const result = await handleMetaScanRequest({ patch: "16.12", position: "Mid" }, {
    fetchLolalyticsRows: async () => ({
      sourceStatus: { provider: "LoLalytics", status: "unavailable", error: "upstream changed", rowCount: 0 },
      rows: [],
    }),
    verifyCandidate: async () => ({ provider: "OP.GG", status: "unavailable", sourceAgreement: 0.5, notes: [] }),
    now: () => new Date("2026-06-21T08:00:00.000Z"),
  });

  assert.equal(result.success, true);
  assert.equal(result.sourceStatus.primary.status, "unavailable");
  assert.deepEqual(result.candidates.offmeta, []);
  assert.equal(result.candidates.tierRankings[0].entries.length, 0);
});
```

- [ ] **Step 2: Run and verify Red or Green**

Run: `node --test tests/unit/metaFactory/apiHandlers.test.js`

Expected: PASS if Task 5 logic already handles empty rows; otherwise FAIL and fix only empty-row handling in `handleMetaScanRequest`.

- [ ] **Step 3: Create route handlers**

Create `app/api/meta-factory/scan/route.js`:

```js
import { NextResponse } from "next/server";
const { handleMetaScanRequest } = require("../../../../utils/metaFactory/apiHandlers");

export async function POST(request) {
  try {
    const body = await request.json();
    const result = await handleMetaScanRequest(body);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode || 500 });
  }
}
```

Create `app/api/meta-factory/snapshot/route.js`:

```js
import { NextResponse } from "next/server";
const { handleMetaSnapshotRequest } = require("../../../../utils/metaFactory/apiHandlers");

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const result = handleMetaSnapshotRequest(searchParams.get("snapshotId") || "");
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: error.message.includes("not found") ? 404 : 500 });
  }
}
```

Create `app/api/meta-factory/render/route.js`:

```js
import { NextResponse } from "next/server";
const { handleMetaRenderRequest } = require("../../../../utils/metaFactory/apiHandlers");

export async function POST(request) {
  try {
    const body = await request.json();
    const result = await handleMetaRenderRequest(body);
    return NextResponse.json(result);
  } catch (error) {
    const message = error.message || "Meta render failed.";
    const status = message.includes("not found") || message.includes("hard-blocked") ? 400 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
```

- [ ] **Step 4: Verify routes compile**

Run: `npx next build`

Expected: PASS. If route import style conflicts with existing project conventions, adjust to match nearby `app/api/esports/*/route.js`.

---

### Task 8: Meta Content Factory Workbench UI

**Files:**
- Modify: `app/page.jsx`
- Create: `tests/unit/metaFactory/workbenchStatic.test.js`
- Modify: `config/tdd-coverage.json`

**Interfaces:**
- UI exposes left-nav workspace `Meta 內容工廠`.
- UI has modes `黑科技` and `梯度榜單`.
- UI calls `/api/meta-factory/scan`, `/api/meta-factory/snapshot`, `/api/meta-factory/render`.
- UI displays source status, snapshot ID, candidates, risk labels, hard blocks, and render/queue result.

- [ ] **Step 1: Invoke frontend-design before editing UI**

Before changing `app/page.jsx`, read and use `/Users/cengweiting/.codex/skills/frontend-design/SKILL.md`.

Expected design direction: dense workbench, no landing page, no nested cards, no old `PRO_BUILD` or `TIER_LIST` runtime labels.

- [ ] **Step 2: Write one failing static UI contract test**

Create `tests/unit/metaFactory/workbenchStatic.test.js`:

```js
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "../../..");

test("workbench exposes Meta factory without reviving old runtime pipeline names", () => {
  const page = fs.readFileSync(path.join(ROOT, "app/page.jsx"), "utf8");

  assert.match(page, /Meta 內容工廠/);
  assert.match(page, /黑科技/);
  assert.match(page, /梯度榜單/);
  assert.match(page, /\\/api\\/meta-factory\\/scan/);
  assert.match(page, /\\/api\\/meta-factory\\/snapshot/);
  assert.match(page, /\\/api\\/meta-factory\\/render/);
  assert.equal(page.includes("PRO_BUILD"), false);
  assert.equal(page.includes("TIER_LIST"), false);
});
```

- [ ] **Step 3: Run and verify Red**

Run: `node --test tests/unit/metaFactory/workbenchStatic.test.js`

Expected: FAIL because UI does not yet include Meta 內容工廠.

- [ ] **Step 4: Implement minimal UI**

Modify `app/page.jsx`:

- Add a main workspace with id `meta`, label `Meta 內容工廠`, status `需補後端` until the API is connected.
- Add modes `{ id: "offmeta", label: "黑科技" }` and `{ id: "tier", label: "梯度榜單" }`.
- Add state for `metaMode`, `metaSnapshotId`, `metaCandidates`, `metaSelectedCandidateId`, `metaResult`, `metaPosition`.
- Add functions:

```js
async function scanMetaFactory() {
  setBusy(true);
  setResult(null);
  try {
    const response = await fetch("/api/meta-factory/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        patch: metaPatch,
        region: "global",
        queue: "ranked_solo_duo",
        position: metaPosition,
        mode: metaMode,
      }),
    });
    const payload = await response.json();
    if (!response.ok || payload.success === false) throw new Error(payload.error || "Meta scan failed.");
    setMetaSnapshotId(payload.snapshotId);
    setMetaCandidates(payload.candidates || { offmeta: [], tierRankings: [] });
    setMetaResult(payload);
  } catch (error) {
    setMetaResult({ success: false, error: error.message });
  } finally {
    setBusy(false);
  }
}
```

Add `loadMetaSnapshot()`:

```js
async function loadMetaSnapshot() {
  if (!metaSnapshotId) {
    setMetaResult({ success: false, error: "請先輸入或產生 snapshotId。" });
    return;
  }
  setBusy(true);
  try {
    const response = await fetch(`/api/meta-factory/snapshot?snapshotId=${encodeURIComponent(metaSnapshotId)}`);
    const payload = await response.json();
    if (!response.ok || payload.success === false) throw new Error(payload.error || "Meta snapshot load failed.");
    setMetaCandidates(payload.candidates || { offmeta: [], tierRankings: [] });
    setMetaResult(payload);
  } catch (error) {
    setMetaResult({ success: false, error: error.message });
  } finally {
    setBusy(false);
  }
}
```

Add `renderMetaCandidate()`:

```js
async function renderMetaCandidate({ useTopCandidate = false } = {}) {
  if (!metaSnapshotId) {
    setMetaResult({ success: false, error: "請先完成 Meta 掃描。" });
    return;
  }
  if (!useTopCandidate && !metaSelectedCandidateId) {
    setMetaResult({ success: false, error: "請先選擇候選題材。" });
    return;
  }
  setBusy(true);
  try {
    const response = await fetch("/api/meta-factory/render", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        snapshotId: metaSnapshotId,
        mode: metaMode,
        candidateId: metaSelectedCandidateId,
        useTopCandidate,
      }),
    });
    const payload = await response.json();
    if (!response.ok || payload.success === false) throw new Error(payload.error || "Meta render failed.");
    setMetaResult(payload);
  } catch (error) {
    setMetaResult({ success: false, error: error.message });
  } finally {
    setBusy(false);
  }
}
```

Use existing `ResultPanel` for raw response until richer visual panels are added.

- [ ] **Step 5: Verify Green**

Run: `node --test tests/unit/metaFactory/workbenchStatic.test.js`

Expected: PASS.

- [ ] **Step 6: Add one failing UI no-old-strings regression to static pruning test**

Modify `tests/unit/pipelinePruningStatic.test.js` by adding `app/page.jsx` to the static runtime scan if it is not already included, and assert old data types still appear only in tests/registry removed lists.

Run: `node --test tests/unit/pipelinePruningStatic.test.js`

Expected: PASS after UI avoids old runtime names.

- [ ] **Step 7: Add TDD manifest slice**

Add a slice containing:

```json
{
  "id": "meta-factory-workbench-static-contracts",
  "description": "Meta Content Factory workbench routing and static runtime label contract",
  "productionFiles": [
    "app/page.jsx"
  ],
  "testFiles": [
    "tests/unit/metaFactory/workbenchStatic.test.js"
  ]
}
```

Run: `npm run tdd:doctor`

Expected: PASS.

---

### Task 9: Full Verification And Chrome Acceptance

**Files:**
- No production changes unless verification finds a defect.

**Interfaces:**
- Final deliverable is a working app with tests, build, and Chrome verification evidence.

- [ ] **Step 1: Run focused Meta Factory tests**

Run:

```bash
node --test tests/unit/metaFactory/*.test.js
```

Expected: PASS.

- [ ] **Step 2: Run full unit test suite**

Run:

```bash
npm run test:unit
```

Expected: PASS.

- [ ] **Step 3: Run TDD manifest doctor**

Run:

```bash
npm run tdd:doctor
```

Expected: PASS.

- [ ] **Step 4: Run coverage gate**

Run:

```bash
npm run test:coverage
```

Expected: PASS. If branch coverage drops below threshold, add behavior-focused tests for uncovered branches; do not delete production files from manifest to hide coverage.

- [ ] **Step 5: Run static old-pipeline scan**

Run:

```bash
rg -n "PRO_BUILD|TIER_LIST|Template_ProBuild|Template_TierList|pro-builds|tier-list" app src utils scripts config package.json
```

Expected: only registry removed-list or tests that explicitly assert retired types are rejected.

- [ ] **Step 6: Build**

Run:

```bash
npx next build
```

Expected: PASS. Existing Turbopack trace warnings may be recorded if unchanged and non-blocking.

- [ ] **Step 7: Start or reuse dev server**

If no server is running:

```bash
npm run dev
```

If port 3000 is already serving this workspace, reuse it.

- [ ] **Step 8: Use Chrome plugin for UI verification**

Open `http://localhost:3000`.

Verify:

- Left nav includes `Meta 內容工廠`.
- Meta 內容工廠 has `黑科技` and `梯度榜單`.
- Old runtime labels `PRO_BUILD` and `TIER_LIST` do not appear.
- Scan button calls the Meta scan endpoint and displays either candidates or a clear source error.
- Snapshot ID displays after successful fixture-backed or live scan.
- Hard-blocked candidate cannot render.
- Render result shows zh/en outputs and IG/Threads queue handoff.

- [ ] **Step 9: Final report**

Report:

- PRD path.
- Plan path.
- Test commands and results.
- Build result.
- Chrome verification result.
- Any external contract smoke result or upstream-source caveat.

---

## Self-Review Checklist

- Spec coverage：Tasks cover registry/schema, data sources, OP.GG verification, offmeta scoring, tier scoring, snapshot store, scan/read/render APIs, rendering, publishing queue, UI, TDD manifest, and Chrome acceptance.
- Old pipeline protection：Tasks explicitly keep `PRO_BUILD` and `TIER_LIST` rejected and absent from runtime UI/render mapping.
- TDD sequence：Every task starts with a single failing test, then minimal implementation, then verification/refactor.
- External boundary：Task 2 includes an opt-in LoLalytics live contract smoke test; normal unit tests remain fixture-based.
- UI requirement：Task 8 explicitly requires frontend-design before UI edits.
- Workspace reality：Plan uses evidence checkpoints instead of commits because this directory is not a git repo.
