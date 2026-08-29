# Global Tier-One Esports Assets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scan all Riot 2026 tier-one leagues and international events by date, then render only when the match-date player portrait and both team crests exist in a verified, repository-hosted asset library.

**Architecture:** A shared competition registry drives Cargo filtering, classification, labels, and tests. Versioned portrait/crest manifests resolve identities by `matchDate`; inventory and import scripts discover roster gaps, normalize only reviewed sources into local assets, and verify coverage before render. The render preflight aggregates every missing asset before any remote champion fetch or Remotion work.

**Tech Stack:** Node.js CommonJS utilities and `node:test`, Next.js 16 App Router, React 19, Leaguepedia Cargo API, Sharp 0.35.3, Remotion 4, Playwright CLI.

## Global Constraints

- Supported regional leagues: `LCK`, `LPL`, `LEC`, `LCS`, `CBLOL`, `LCP`.
- Supported international events: `First Stand`, `MSI`, `Worlds`.
- Scope is Riot tier one only; reject lower-tier, qualifier, academy, and substring lookalikes.
- Asset source order is Riot/LoL Esports/official league, then official team, then Leaguepedia.
- Never use generic image search, social reposts, unknown mirrors, AI portraits, or another player's photo.
- Store optimized assets in Git under `public/player-portraits/` and `public/team-crests/`; do not add Git LFS, object storage, a CDN, paid API, or database migration.
- Missing assets block render and must be returned as one complete list; there is no text or image fallback.
- Coverage claims include an explicit `asOf`; on 2026-08-28 Worlds can have fixture classification but no live completed-match claim.
- Use vertical Red → Green → Refactor: one failing test, one minimal implementation, then the next behavior.
- Preserve the existing 25-second video story and visual direction.
- Do not stage or modify the user's untracked root `AGENTS.md` and `CLAUDE.md`.

---

## File Structure

- Create `config/esports-tier-one-competitions.json`: canonical competition IDs, display labels, type, region, aliases, Cargo match prefixes, and stable order.
- Create `utils/esports/competitionRegistry.js`: classify tournament names and build escaped Cargo predicates from the registry.
- Modify `utils/leaguepediaApi.js`: fetch one exact-date supported tier-one scope with pagination.
- Modify `utils/esports/config.js`, `utils/esports/seriesFetcher.js`, `utils/esports/candidateScanner.js`, `utils/esports/matchScorer.js`: replace LCK/LPL mode coupling with registry-backed global scanning and stable classification.
- Upgrade `config/esports-player-portraits.json` and `config/esports-team-crests.json`: version 2 entries with aliases, region, `validFrom`, `validTo`, source provenance, hash, dimensions, and repository path.
- Create `utils/render/esportsAssetIdentity.js`: normalized aliases and inclusive date-range matching shared by portrait and crest resolvers.
- Modify `utils/render/playerPortraitManifest.js`, `utils/render/teamCrestManifest.js`, `utils/render/playerRadarAssetPlanner.js`: date-aware resolution and aggregated missing-asset preflight.
- Create `utils/esports/assetInventory.js` and `scripts/esportsAssetInventory.js`: roster/team discovery and reproducible gap/coverage report.
- Create `utils/esports/assetImporter.js`, `scripts/importEsportsAssets.js`, and `scripts/verifyEsportsAssets.js`: reviewed-source download, FFmpeg normalization, manifest generation, and full validation.
- Create `config/esports-asset-sources-2026.json`: reviewed source input for all approved 2026 assets.
- Add regional asset files under `public/player-portraits/` and `public/team-crests/`.
- Modify `app/components/studio/EsportsWorkflow.jsx` and `app/components/studio/studioModel.js`: global empty-state copy and localized aggregate asset error.
- Modify `THIRD_PARTY_ASSETS.md`, `HANDOFF.md`, and `.gitignore`: provenance, measured coverage/capacity, verification evidence, and report/screenshot paths.

---

### Task 1: Canonical tier-one competition registry

**Files:**
- Create: `config/esports-tier-one-competitions.json`
- Create: `utils/esports/competitionRegistry.js`
- Test: `tests/unit/esports/competitionRegistry.test.js`

**Interfaces:**
- Produces: `listTierOneCompetitions(): Competition[]`
- Produces: `classifyTierOneTournament(name: string): Competition | null`
- Produces: `buildTierOneTournamentWhere(field?: string): string`
- `Competition` contains `id`, `label`, `kind`, `region`, `order`, `exactNames`, and `prefixes`.

- [ ] **Step 1: RED — reject lookalikes while recognizing all nine competition IDs**

Create one table-driven test asserting canonical examples map to `LCK`, `LPL`, `LEC`, `LCS`, `CBLOL`, `LCP`, `FIRST_STAND`, `MSI`, and `WORLDS`; assert `LCK CL 2026`, `LPL Development League 2026`, `EMEA Masters 2026`, `NACL 2026`, `CBLOL Academy 2026`, `PCS 2026`, and `Worlds Qualifying Series 2026` return `null`.

Run: `node --test tests/unit/esports/competitionRegistry.test.js`
Expected: FAIL because `competitionRegistry.js` does not exist.

- [ ] **Step 2: GREEN — add data-backed classification**

Use explicit exact names and anchored prefixes. Sort candidates by the longest prefix before matching so `LCK CL` can never inherit `LCK`; exclusions remain explicit registry data, not scattered regexes.

```js
function classifyTierOneTournament(name = "") {
  const normalized = normalizeTournament(name);
  return competitions.find((competition) =>
    competition.exactNames.some((value) => normalizeTournament(value) === normalized)
    || competition.prefixes.some((value) => normalized.startsWith(`${normalizeTournament(value)} `))
  ) || null;
}
```

Run: `node --test tests/unit/esports/competitionRegistry.test.js`
Expected: PASS for nine supported competitions and every exclusion.

- [ ] **Step 3: RED/GREEN — build a SQL-safe registry predicate**

Add one test asserting the generated predicate uses only escaped exact/prefix clauses such as `Tournament = 'LCK' OR Tournament LIKE 'LCK %'`, contains all nine competition families, and contains no `LIKE '%LCK%'` clause. Implement `buildTierOneTournamentWhere()` with a fixed field allowlist and single-quote escaping, then rerun the same test file.

- [ ] **Step 4: Commit**

```bash
git add config/esports-tier-one-competitions.json utils/esports/competitionRegistry.js tests/unit/esports/competitionRegistry.test.js
git commit -m "feat: register global tier-one competitions"
```

### Task 2: One exact-date global match query and stable series classification

**Files:**
- Modify: `utils/leaguepediaApi.js`
- Modify: `utils/esports/seriesFetcher.js`
- Modify: `utils/esports/config.js`
- Modify: `utils/esports/candidateScanner.js`
- Modify: `utils/esports/matchScorer.js`
- Test: `tests/unit/esports/leaguepediaSecurity.test.js`
- Test: `tests/unit/esports/seriesFetcher.test.js`
- Test: `tests/unit/esports/config.test.js`
- Test: `tests/unit/esports/candidateScanner.test.js`
- Test: `tests/unit/esports/matchScorer.test.js`

**Interfaces:**
- Produces: `fetchTierOneMatchesForDate(date: string): Promise<Match[]>`
- Consumes: `classifyTierOneTournament(match.tournament)` from Task 1.
- `fetchCompletedSeriesForDate()` makes one tier-one date request when `tournamentScope === "configured"` and stores canonical `league` on every game/series.

- [ ] **Step 1: RED/GREEN — exact UTC date plus global predicate**

Add one boundary test that captures the Cargo URL for `fetchTierOneMatchesForDate("2026-08-27")`, then asserts the lower/upper UTC bounds and registry predicate are both present. Implement it by sharing the existing date validator and `SCOREBOARD_MATCH_FIELDS`, with `limit: 50` so `cargoQuery()` paginates.

Run after red and green: `node --test tests/unit/esports/leaguepediaSecurity.test.js`.

- [ ] **Step 2: RED/GREEN — query once and classify returned games**

Change the focused series test to inject `fetchTierOneMatchesForDate`, return one LEC and one CBLOL game, and assert one call for the chosen date plus canonical series leagues. Implement the configured global path while retaining the injected legacy path used by older unit tests.

```js
const competition = classifyTierOneTournament(game.tournament);
if (!competition) continue;
game.league = competition.label;
game.competitionId = competition.id;
```

Run: `node --test tests/unit/esports/seriesFetcher.test.js` after each red/green slice.

- [ ] **Step 3: RED/GREEN — global auto scope without date windows**

Add one config test asserting `resolveActiveMode({activeMode: "auto"}, any2026Date)` returns all nine registry IDs in its configured scope rather than swapping the whole scanner into MSI-only mode. Preserve mode metadata for legacy publishing/scoring, but the workbench `tournamentScope: "configured"` always scans the global registry.

Run: `node --test tests/unit/esports/config.test.js`.

- [ ] **Step 4: RED/GREEN — keep all supported leagues scoreable**

Add one scoring test containing a high-scoring LEC and LCP series and assert neither is discarded by a hard-coded `["LCK", "LPL"]` filter. Replace the filter with registry regional labels; keep the existing `maxDailySeries` behavior for automated daily selection.

Run: `node --test tests/unit/esports/matchScorer.test.js`.

- [ ] **Step 5: Focused regression and commit**

Run: `node --test tests/unit/esports/competitionRegistry.test.js tests/unit/esports/leaguepediaSecurity.test.js tests/unit/esports/seriesFetcher.test.js tests/unit/esports/config.test.js tests/unit/esports/candidateScanner.test.js tests/unit/esports/matchScorer.test.js`
Expected: all tests pass with one exact-date global query contract.

```bash
git add utils/leaguepediaApi.js utils/esports/config.js utils/esports/seriesFetcher.js utils/esports/candidateScanner.js utils/esports/matchScorer.js tests/unit/esports
git commit -m "feat: scan global tier-one series by date"
```

### Task 3: Versioned, match-date asset identity

**Files:**
- Create: `utils/render/esportsAssetIdentity.js`
- Modify: `config/esports-player-portraits.json`
- Modify: `config/esports-team-crests.json`
- Modify: `utils/render/playerPortraitManifest.js`
- Modify: `utils/render/teamCrestManifest.js`
- Modify: `utils/esports/postMatchReadBuilder.js`
- Test: `tests/unit/render/esportsAssetIdentity.test.js`
- Test: `tests/unit/render/playerPortraitManifest.test.js`
- Test: `tests/unit/render/teamCrestManifest.test.js`
- Test: `tests/unit/esports/postMatchReadBuilder.test.js`

**Interfaces:**
- Produces: `resolveDatedEntry(entries, identity, { kind }): object`
- Resolver identity includes `playerId/publicName/team/season/matchDate` for portraits and `team/season/matchDate` for crests.
- View model `seriesContext` gains `matchDate` sourced from the candidate series date.

- [ ] **Step 1: RED/GREEN — inclusive date range matching**

Test two entries for one player with adjacent non-overlapping team tenures. Assert a spring date returns the old team, a summer date returns the new team, and a gap date throws `ASSET_IDENTITY_NOT_FOUND`. Implement normalized aliases plus inclusive `validFrom`/`validTo` matching.

Run: `node --test tests/unit/render/esportsAssetIdentity.test.js`.

- [ ] **Step 2: RED/GREEN — reject ambiguous overlaps**

Add one failing test with two valid entries on the same date; implement `ASSET_IDENTITY_AMBIGUOUS` including the normalized identity and date without leaking filesystem contents.

Run: `node --test tests/unit/render/esportsAssetIdentity.test.js`.

- [ ] **Step 3: RED/GREEN — migrate Ruler, GEN, HLE without changing their bytes**

Upgrade both manifests to version 2 with `region`, `validFrom: "2026-01-01"`, and `validTo: "2026-12-31"`. Update portrait and crest resolver tests to pass `matchDate: "2026-08-13"`; assert the existing SHA-256, dimensions, and public paths remain unchanged.

Run: `node --test tests/unit/render/playerPortraitManifest.test.js tests/unit/render/teamCrestManifest.test.js`.

- [ ] **Step 4: RED/GREEN — carry series date into render asset identity**

Add a builder test asserting `seriesContext.matchDate === series.date`; minimally expose that field and pass it from `playerRadarAssetPlanner` in Task 4.

Run: `node --test tests/unit/esports/postMatchReadBuilder.test.js`.

- [ ] **Step 5: Commit**

```bash
git add config/esports-player-portraits.json config/esports-team-crests.json utils/render/esportsAssetIdentity.js utils/render/playerPortraitManifest.js utils/render/teamCrestManifest.js utils/esports/postMatchReadBuilder.js tests/unit/render tests/unit/esports/postMatchReadBuilder.test.js
git commit -m "feat: resolve esports assets by match date"
```

### Task 4: Aggregate every render asset gap before remote work

**Files:**
- Create: `utils/render/esportsAssetPreflight.js`
- Modify: `utils/render/playerRadarAssetPlanner.js`
- Modify: `utils/esports/apiErrors.js`
- Test: `tests/unit/render/esportsAssetPreflight.test.js`
- Test: `tests/unit/render/playerRadarAssetPlanner.test.js`
- Test: `tests/unit/esports/apiErrors.test.js`

**Interfaces:**
- Produces: `preflightEsportsIdentityAssets(viewModel, deps): { playerPortrait, teams }`
- Throws one error with `code: "ESPORTS_ASSETS_MISSING"` and `missing: Array<{kind, publicName?, team, season, matchDate}>`.
- Planner calls preflight before `cacheRemoteImageUrlImpl`.

- [ ] **Step 1: RED/GREEN — collect portrait and both crest gaps**

Use resolvers that throw not-found errors for Taeyoon, BNK FEARX, and Nongshim RedForce. Assert one error contains exactly three typed entries in stable `portrait`, `teamA`, `teamB` order. Implement independent resolver attempts and aggregate only not-found errors; integrity errors such as hash mismatch remain immediate hard failures.

Run: `node --test tests/unit/render/esportsAssetPreflight.test.js`.

- [ ] **Step 2: RED/GREEN — no champion network request on identity failure**

Add one planner test with a counter in `cacheRemoteImageUrlImpl`; assert the count remains zero when preflight throws. Move portrait and crest work above the existing `Promise.all()` and pass `seriesContext.matchDate` to every resolver.

Run: `node --test tests/unit/render/playerRadarAssetPlanner.test.js`.

- [ ] **Step 3: RED/GREEN — serialize a safe structured API error**

Add one API error test asserting status `422`, code `ESPORTS_ASSETS_MISSING`, a Chinese summary, and the structured `missing` list. Implement formatting without exposing local paths or stack traces.

Run: `node --test tests/unit/esports/apiErrors.test.js`.

- [ ] **Step 4: Commit**

```bash
git add utils/render/esportsAssetPreflight.js utils/render/playerRadarAssetPlanner.js utils/esports/apiErrors.js tests/unit/render/esportsAssetPreflight.test.js tests/unit/render/playerRadarAssetPlanner.test.js tests/unit/esports/apiErrors.test.js
git commit -m "fix: report complete esports asset gaps"
```

### Task 5: Reproducible 2026 roster and team inventory

**Files:**
- Create: `utils/esports/assetInventory.js`
- Create: `scripts/esportsAssetInventory.js`
- Create: `tests/fixtures/esports/asset-inventory-cargo.json`
- Create: `tests/unit/esports/assetInventory.test.js`
- Modify: `.gitignore`

**Interfaces:**
- Produces: `fetchTierOneAssetInventory({ year, asOf }, deps): Promise<Inventory>`
- Produces: `compareInventoryToManifests(inventory, manifests): CoverageReport`
- CLI: `node scripts/esportsAssetInventory.js --year=2026 --as-of=2026-08-28 --json=.data/esports-assets/coverage-2026-08-28.json --markdown=.data/esports-assets/coverage-2026-08-28.md`

- [ ] **Step 1: RED/GREEN — parse TournamentRosters lists**

Fixture rows use real Cargo fields `Team`, `OverviewPage`, `Region`, `RosterLinks`, `Roles`, `Tournament`, `Short`, and `IsComplete`. Test that aligned roster/role lists become stable `{playerId, publicName, team, role, tournament}` identities and duplicate split registrations collapse.

Run: `node --test tests/unit/esports/assetInventory.test.js`.

- [ ] **Step 2: RED/GREEN — keep only registered tier-one tournaments**

Add one fixture row each for LCK CL, EMEA Masters, NACL, and PCS and assert they are excluded through Task 1's registry, not hand-written filters. Implement Cargo fetches for `Tournaments`, `TournamentRosters`, `PlayerImages`, and `Teams` using the documented field names and injected `cargoQuery`.

Run: `node --test tests/unit/esports/assetInventory.test.js`.

- [ ] **Step 3: RED/GREEN — calibrated coverage counts**

Create a tiny known fixture with two teams, three registered players, one portrait, and one crest. Assert totals and exact missing identities before running the method against live data. Include `asOf`, source tables, and query predicates in the report.

Run: `node --test tests/unit/esports/assetInventory.test.js`.

- [ ] **Step 4: Add CLI and ignored runtime report directory**

Parse only strict `--year`, `--as-of`, `--json`, and `--markdown` arguments; reject paths outside `.data/esports-assets/`. Add that runtime directory to `.gitignore` while keeping test fixtures tracked.

Run: `node --test tests/unit/esports/assetInventory.test.js && node scripts/esportsAssetInventory.js --help`
Expected: tests pass and help prints exact supported arguments without a network call.

- [ ] **Step 5: Commit**

```bash
git add .gitignore utils/esports/assetInventory.js scripts/esportsAssetInventory.js tests/fixtures/esports/asset-inventory-cargo.json tests/unit/esports/assetInventory.test.js
git commit -m "feat: inventory tier-one esports assets"
```

### Task 6: Reviewed-source importer, normalization, and full verifier

**Files:**
- Create: `config/esports-asset-sources-2026.json`
- Create: `utils/esports/assetImporter.js`
- Create: `scripts/importEsportsAssets.js`
- Create: `scripts/verifyEsportsAssets.js`
- Create: `tests/fixtures/esports/assets/portrait-source.png`
- Create: `tests/fixtures/esports/assets/crest-source.png`
- Create: `tests/unit/esports/assetImporter.test.js`
- Modify: `package.json`

**Interfaces:**
- Produces: `validateApprovedSource(entry): void`
- Produces: `importApprovedAsset(entry, {fetchImpl, normalizeImage, rootDir}): Promise<ManifestEntry>`
- Produces: `verifyEsportsAssetLibrary({rootDir, inventory, asOf}): VerificationReport`
- Scripts: `assets:inventory`, `assets:import`, and `assets:verify`.

- [ ] **Step 1: RED/GREEN — reject incomplete or unsafe source records**

Test missing identity, non-HTTPS URL, unsupported `sourceKind`, path traversal, missing review timestamp, and destination collisions. Accept only `riot`, `league`, `team`, or `leaguepedia` source kinds and destinations under the two approved public asset roots.

Run: `node --test tests/unit/esports/assetImporter.test.js`.

- [ ] **Step 2: RED/GREEN — download and verify decoded image input**

Use an injected fetch response around the tracked PNG fixture. Assert HTML, SVG, empty bytes, and HTTP failures are rejected before invoking normalization. Keep redirects HTTPS-only and record the final HTTPS URL.

Run: `node --test tests/unit/esports/assetImporter.test.js`.

- [ ] **Step 3: RED/GREEN — deterministic Sharp output and manifest metadata**

Normalize portraits to WebP and crests to transparent PNG with pinned Sharp options, then derive the SHA and actual decoded dimensions from written bytes. Run the same fixture twice and assert byte-identical output. Import into a temporary directory only; tests never touch production manifests. Sharp replaces the planned FFmpeg encoder because the calibrated local FFmpeg build exposes a WebP muxer but no WebP encoder.

Run: `node --test tests/unit/esports/assetImporter.test.js`.

- [ ] **Step 4: RED/GREEN — library verifier and capacity report**

Test a known two-file library and assert `fileCount`, `totalBytes`, `largestFileBytes`, hash/dimension checks, manifest uniqueness, date overlap checks, and inventory gaps. Add quiet JSON output for CI and human Markdown output for review.

Run: `node --test tests/unit/esports/assetImporter.test.js`.

- [ ] **Step 5: Wire scripts and commit**

```json
{
  "assets:inventory": "node scripts/esportsAssetInventory.js",
  "assets:import": "node scripts/importEsportsAssets.js",
  "assets:verify": "node scripts/verifyEsportsAssets.js"
}
```

Run: `npm run assets:verify -- --help`
Expected: documents strict inputs and performs no mutation.

```bash
git add package.json config/esports-asset-sources-2026.json utils/esports/assetImporter.js scripts/importEsportsAssets.js scripts/verifyEsportsAssets.js tests/fixtures/esports/assets tests/unit/esports/assetImporter.test.js
git commit -m "feat: import and verify esports assets"
```

### Task 7: Import the current LCK blocker as the first real vertical asset slice

**Files:**
- Modify: `config/esports-asset-sources-2026.json`
- Modify: `config/esports-player-portraits.json`
- Modify: `config/esports-team-crests.json`
- Add: `public/player-portraits/bfx-taeyoon-2026.webp`
- Add: `public/team-crests/bnk-fearx-2026.png`
- Add: `public/team-crests/nongshim-redforce-2026.png`
- Modify: `THIRD_PARTY_ASSETS.md`
- Test: `tests/unit/render/currentSeriesAssetContract.test.js`

**Interfaces:**
- Consumes the importer/verifier from Task 6.
- Produces a real non-mock asset contract for `2026-08-27`, Taeyoon, BNK FEARX, and Nongshim RedForce.

- [ ] **Step 1: RED — reproduce all three current gaps**

Create one contract test using the real manifests and `matchDate: "2026-08-27"`. Assert preflight initially throws three missing identities; run it and observe the expected failure against the desired `missing.length === 0` behavior before importing.

Run: `node --test tests/unit/render/currentSeriesAssetContract.test.js`
Expected: FAIL listing Taeyoon portrait and both team crests.

- [ ] **Step 2: Review exact sources in priority order**

Resolve the official player/team identity against Leaguepedia roster/image data, open each final source page or asset, and record `sourceKind`, `sourcePage`, `sourceUrl`, `team`, `season`, validity dates, and `reviewedAt`. Do not approve a search-result URL or an image whose displayed identity cannot be matched to the roster.

- [ ] **Step 3: GREEN — import only the three reviewed assets**

Run the importer with explicit IDs for the three records, review the generated file count/byte deltas, and add the verified manifest entries. If any source cannot pass review, retain the exact gap and do not substitute; continue implementing the infrastructure and document the unresolved source.

Run: `node --test tests/unit/render/currentSeriesAssetContract.test.js tests/unit/render/playerPortraitManifest.test.js tests/unit/render/teamCrestManifest.test.js`
Expected when all three sources pass: current series preflight resolves three verified local paths.

- [ ] **Step 4: Document provenance and commit the real slice**

```bash
git add config/esports-asset-sources-2026.json config/esports-player-portraits.json config/esports-team-crests.json public/player-portraits public/team-crests THIRD_PARTY_ASSETS.md tests/unit/render/currentSeriesAssetContract.test.js
git commit -m "feat: add verified BNK versus Nongshim assets"
```

### Task 8: Fill the as-of-2026-08-28 regional asset library

**Files:**
- Modify: `config/esports-asset-sources-2026.json`
- Modify: `config/esports-player-portraits.json`
- Modify: `config/esports-team-crests.json`
- Add: `public/player-portraits/*.webp`
- Add: `public/team-crests/*.png`
- Modify: `THIRD_PARTY_ASSETS.md`
- Create: `tests/unit/render/globalAssetCoverage.test.js`

**Interfaces:**
- Consumes the calibrated inventory and importer.
- Produces a committed verified library and `asOf: "2026-08-28"` coverage assertion.

- [ ] **Step 1: Generate and review the live inventory**

Load local environment without printing credentials and run:

```bash
npm run assets:inventory -- --year=2026 --as-of=2026-08-28 --json=.data/esports-assets/coverage-2026-08-28.json --markdown=.data/esports-assets/coverage-2026-08-28.md
```

Before using totals, compare the live report shape against the known fixture from Task 5. Record source tables, total teams, registered players, and current gaps in the report; do not treat a rate-limited or empty result as zero.

- [ ] **Step 2: RED/GREEN — LCK coverage**

Add an LCK-only coverage assertion, observe the exact missing IDs, review sources, import the approved batch, rerun `assets:verify`, and make the LCK assertion pass. Commit only after the LCK region is internally complete or its unresolvable official-source gaps are explicitly recorded.

- [ ] **Step 3: RED/GREEN — LPL coverage**

Repeat the same single-region cycle for LPL; do not batch another region into the same red/green slice.

- [ ] **Step 4: RED/GREEN — LEC coverage**

Repeat the same single-region cycle for LEC.

- [ ] **Step 5: RED/GREEN — LCS coverage**

Repeat the same single-region cycle for LCS.

- [ ] **Step 6: RED/GREEN — CBLOL coverage**

Repeat the same single-region cycle for CBLOL.

- [ ] **Step 7: RED/GREEN — LCP coverage**

Repeat the same single-region cycle for LCP, including guest-team validity periods.

- [ ] **Step 8: International reuse and dated coverage**

Assert First Stand and MSI participants resolve through their regional identities with no duplicate files. Assert Worlds classification exists but the live coverage claim remains `pending-roster` as of 2026-08-28.

- [ ] **Step 9: Measure capacity and commit**

Run `npm run assets:verify -- --year=2026 --as-of=2026-08-28 --json=.data/esports-assets/verification-2026-08-28.json`. Report file count, `du -sk public/player-portraits public/team-crests`, and the largest file found with `find ... -type f -print0 | xargs -0 stat -f '%z %N' | sort -nr`. If capacity is unsuitable for normal Git, stop before staging the bulk files.

```bash
git add config/esports-asset-sources-2026.json config/esports-player-portraits.json config/esports-team-crests.json public/player-portraits public/team-crests THIRD_PARTY_ASSETS.md tests/unit/render/globalAssetCoverage.test.js
git commit -m "feat: fill 2026 tier-one esports asset library"
```

### Task 9: Global workbench copy and structured gap presentation

**Required Skills:** `frontend-design`, `emil-design-eng`, `ui-ux-pro-max`, `playwright-cli`

**Files:**
- Modify: `app/components/studio/EsportsWorkflow.jsx`
- Modify: `app/components/studio/studioModel.js`
- Modify only if required by measured overflow: `app/globals.css`
- Test: `tests/unit/studioModel.test.js`
- Test: `tests/e2e/studio-workflows.spec.js`

**Interfaces:**
- Consumes API `code: "ESPORTS_ASSETS_MISSING"` and structured `missing` entries.
- Produces concise Chinese alert copy and stable globally sorted series options.

- [ ] **Step 1: RED/GREEN — localize complete gap details**

Add a model test with Taeyoon plus two crests and assert one natural Chinese message names all three without exposing the raw English exception. Implement the formatter in `humanizeWorkflowError()`.

Run: `node --test tests/unit/studioModel.test.js`.

- [ ] **Step 2: RED/GREEN — global scan browser contract**

Mock an exact-date response containing LEC, LCS, LCK, and MSI series. Assert all options remain available, labels include canonical competition codes, and switching series clears an old preview.

Run: `npx playwright test tests/e2e/studio-workflows.spec.js --grep "global tier-one" --reporter=line`.

- [ ] **Step 3: Update global empty-state copy**

Change only the misleading scope text if present; retain the current visual system and shadcn primitives. Do not add a filter or redesign the control panel.

- [ ] **Step 4: Two-round screenshot self-check**

Use Playwright CLI at `http://localhost:49761/`. Each round captures exactly desktop 1280×800 and mobile 375×812. Inspect hierarchy, whitespace, fonts, colors, alignment, no horizontal overflow, loading/empty/error/focus states, and micro-motion. Fix every failed item, then repeat with new screenshot filenames. Store final paths under `.screenshots/global-tier-one-assets-round2/` and do not reread older screenshots.

- [ ] **Step 5: Commit**

```bash
git add app/components/studio/EsportsWorkflow.jsx app/components/studio/studioModel.js app/globals.css tests/unit/studioModel.test.js tests/e2e/studio-workflows.spec.js .gitignore HANDOFF.md
git commit -m "feat: present global esports asset gaps"
```

### Task 10: Live contracts, real previews, full verification, and delivery

**Required Skills:** `verification-before-completion`, `requesting-code-review`, `finishing-a-development-branch`

**Files:**
- Create: `tests/contract/esports/leaguepediaTierOneContract.test.js`
- Create: `scripts/verifyGlobalEsportsCanaries.js`
- Modify: `HANDOFF.md`
- Modify: `THIRD_PARTY_ASSETS.md`

**Interfaces:**
- Contract test records which competitions were actually live-verified and explicitly marks Worlds pending as of the report date.
- Canary script resolves one completed series per regional league plus First Stand and MSI without resolver mocks; representative full renders remain preview-only.

- [ ] **Step 1: Calibrate and run live Leaguepedia contracts**

Use known LCK 2026-08-27 as the calibration answer, then query one known completed date per supported regional league plus First Stand and MSI. Verify tournament classification, game count, ten players, five role matchups, and source response shape. A cooldown produces an explicit external contract skip/failure record, never a zero-match success.

- [ ] **Step 2: Run non-mock asset resolver canaries**

For each verified series, build the real view model and resolve the player portrait and both crests from repository manifests. Record exact series ID, match date, and resolved paths without printing credentials.

- [ ] **Step 3: Render representative preview-only videos**

Render at least the original BNK FEARX vs Nongshim RedForce blocker, one non-Asian regional series, and one completed international series. Validate H.264/AAC, 1080×1920, 30fps, 25-second timing, audio gates, and zero publish jobs. Extract approved review frames without publishing.

- [ ] **Step 4: Product-owner learning checkpoint before full tests**

Explain: product capability, user experience, technical components, data flow, design reason, rejected alternatives, security/cost, focused test evidence, and remaining future-roster/source limits. Continue automatically because the user pre-authorized execution unless a new paid/destructive/product decision appears.

- [ ] **Step 5: Full branch verification**

Run once on the implementation branch:

```bash
npm ci
npm run tdd:doctor
npm run test:coverage
npx next build
npm audit --audit-level=high
npm run qa:render
npx playwright test --reporter=line
npm run assets:verify -- --year=2026 --as-of=2026-08-28 --json=.data/esports-assets/final-verification.json
```

Expected: no test/build/audit/QA/UI regressions; asset report truthfully distinguishes verified coverage from unresolved reviewed-source gaps.

- [ ] **Step 6: Update durable evidence and request code review**

Write exact counts, measurement commands, screenshot/frame paths, canary media facts, runtime side-effect seal, unresolved gaps, and absence of a production deployment target to `HANDOFF.md` and `THIRD_PARTY_ASSETS.md`. Run `git diff --check`, inspect staged scope, and apply the code-review skill findings before completion.

- [ ] **Step 7: Merge, retest main, push, and verify remote**

Merge the implementation branch into `main` without overwriting user changes. Repeat `npm run tdd:doctor`, `npm run test:coverage`, `npx next build`, `npm audit --audit-level=high`, `npm run qa:render`, and `npm run assets:verify` on main. Push the existing remote, confirm the remote SHA, wait for CI and CodeQL, and verify `http://localhost:49761/` through the actual scan → selection → preview path. Do not create a duplicate hosted site because the repo has no production deployment target.
