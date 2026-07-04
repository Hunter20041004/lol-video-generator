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
  assert.match(page, /\/api\/meta-factory\/scan/);
  assert.match(page, /\/api\/meta-factory\/snapshot/);
  assert.match(page, /\/api\/meta-factory\/render/);
  assert.equal(page.includes("PRO_BUILD"), false);
  assert.equal(page.includes("TIER_LIST"), false);
});

test("workbench marks implemented Meta factory modes as supported", () => {
  const page = fs.readFileSync(path.join(ROOT, "app/page.jsx"), "utf8");

  assert.match(page, /id: "meta",[\s\S]{0,80}label: "Meta 內容工廠",[\s\S]{0,80}status: "已支援"/);
  assert.match(page, /id: "offmeta", label: "黑科技", status: "已支援"/);
  assert.match(page, /id: "tier", label: "梯度榜單", status: "已支援"/);
});

test("workbench shell styles are server-loaded for the full workbench canvas", () => {
  const page = fs.readFileSync(path.join(ROOT, "app/page.jsx"), "utf8");
  const globals = fs.readFileSync(path.join(ROOT, "app/globals.css"), "utf8");

  assert.match(page, /className="hvsShell"/);
  assert.equal(page.includes("<style jsx"), false);
  assert.match(globals, /\.hvsShell\s*\{/);
  assert.match(globals, /\.hvsShell \.navItem/);
  assert.match(globals, /\.hvsShell button/);
  assert.match(globals, /\.hvsShell input,\s*\.hvsShell select/);
  assert.equal(globals.includes("padding: 18px"), false);
});

test("root layout does not constrain the workbench canvas", () => {
  const layout = fs.readFileSync(path.join(ROOT, "app/layout.jsx"), "utf8");
  const globals = fs.readFileSync(path.join(ROOT, "app/globals.css"), "utf8");

  assert.equal(layout.includes("maxWidth: '1200px'"), false);
  assert.equal(layout.includes("padding: '40px'"), false);
  assert.match(layout, /<main className="appRoot">/);
  assert.match(globals, /body\s*\{[\s\S]*padding:\s*0;/);
  assert.match(globals, /\.appRoot\s*\{[\s\S]*min-height:\s*100vh;/);
});

test("root layout declares an existing favicon asset for browser smoke tests", () => {
  const layout = fs.readFileSync(path.join(ROOT, "app/layout.jsx"), "utf8");
  const favicon = fs.readFileSync(path.join(ROOT, "public/favicon.svg"), "utf8");

  assert.match(layout, /icons:\s*\{/);
  assert.match(layout, /icon:\s*["']\/favicon\.svg["']/);
  assert.match(favicon, /<svg\b/);
  assert.match(favicon, /HVS/);
});

test("esports workbench defaults date input from local calendar day instead of UTC", () => {
  const page = fs.readFileSync(path.join(ROOT, "app/page.jsx"), "utf8");

  assert.match(page, /function getLocalDateInputValue/);
  assert.equal(page.includes("new Date().toISOString().slice(0, 10)"), false);
  assert.match(page, /getFullYear\(\)/);
  assert.match(page, /getMonth\(\) \+ 1/);
  assert.match(page, /getDate\(\)/);
  assert.match(page, /useState\(\(\) => getLocalDateInputValue\(\)\)/);
});

test("workbench disables selected render when the selected candidate is hard-blocked", () => {
  const page = fs.readFileSync(path.join(ROOT, "app/page.jsx"), "utf8");

  assert.match(page, /selectedMetaCandidate\s*=/);
  assert.match(page, /selectedMetaCandidate\?\.hardBlock\?\.blocked/);
  assert.match(page, /disabled=\{[^}]*selectedMetaCandidate\?\.hardBlock\?\.blocked[^}]*\}>\s*2 生成選取影片/);
  assert.match(page, /選取題材被阻擋/);
});

test("workbench disables top render when the active Meta candidate pool has no renderable candidate", () => {
  const page = fs.readFileSync(path.join(ROOT, "app/page.jsx"), "utf8");

  assert.match(page, /function isRenderableMetaCandidate/);
  assert.match(page, /function hasMetaBuildDetails/);
  assert.match(page, /const hasRenderableMetaCandidate = metaRenderableCandidatePool\.length > 0/);
  assert.match(page, /disabled=\{[^}]*!hasRenderableMetaCandidate[^}]*\}>\s*2 生成推薦影片/);
});

test("workbench hides non-renderable Meta candidates from the primary candidate list", () => {
  const page = fs.readFileSync(path.join(ROOT, "app/page.jsx"), "utf8");
  const globals = fs.readFileSync(path.join(ROOT, "app/globals.css"), "utf8");

  assert.match(page, /const metaRenderableCandidatePool = metaCandidatePool\.filter\(isRenderableMetaCandidate\)/);
  assert.match(page, /const metaBlockedCandidatePool = metaCandidatePool\.filter\(\(candidate\) => !isRenderableMetaCandidate\(candidate\)\)/);
  assert.match(page, /metaRenderableCandidatePool\.slice\(0,\s*12\)\.map\(\(candidate\) =>/);
  assert.match(page, /目前沒有可生成的黑科技題材/);
  assert.match(page, /!hasRenderableMetaCandidate && metaCandidatePool\.length > 0/);
  assert.match(page, /<strong>目前沒有可生成題材<\/strong>/);
  assert.match(page, /已隱藏/);
  assert.match(globals, /\.hvsShell \.blockedCandidateDetails/);
  assert.match(globals, /\.hvsShell \.blockedCandidateList/);
  assert.equal(page.includes("metaCandidatePool.slice(0, 12).map((candidate) =>"), false);
});

test("workbench shows offmeta core gameplay instead of score and confidence in candidate rows", () => {
  const page = fs.readFileSync(path.join(ROOT, "app/page.jsx"), "utf8");

  assert.match(page, /function formatMetaCoreGameplay/);
  assert.match(page, /coreItems/);
  assert.match(page, /coreRunes/);
  assert.match(page, /缺少核心裝備\/符文，不能生成黑科技影片。/);
  assert.equal(page.includes("信心 ${candidate.confidence"), false);
  assert.equal(page.includes("<code>{candidate.score"), false);
});

test("workbench previews rendered videos from render result payloads", () => {
  const page = fs.readFileSync(path.join(ROOT, "app/page.jsx"), "utf8");
  const globals = fs.readFileSync(path.join(ROOT, "app/globals.css"), "utf8");

  assert.match(page, /function getPreviewVideos/);
  assert.match(page, /function VideoPreview/);
  assert.match(page, /function ResultPanel\(\{ title, payload, empty = "尚未執行", showPreview = true \}\)/);
  assert.match(page, /showPreview \? getPreviewVideos\(payload\) : \[\]/);
  assert.match(page, /payload\?\.videos/);
  assert.match(page, /<video\s+controls/);
  assert.match(page, /開新分頁/);
  assert.match(page, /download=\{video\.fileName \|\| true\}/);
  assert.match(globals, /\.hvsShell \.videoPreviewGrid/);
  assert.match(globals, /\.hvsShell \.videoPreviewItem video/);
});

test("workbench keeps Meta video preview beside the Meta render controls", () => {
  const page = fs.readFileSync(path.join(ROOT, "app/page.jsx"), "utf8");
  const globals = fs.readFileSync(path.join(ROOT, "app/globals.css"), "utf8");

  assert.match(page, /const metaPreviewVideos = getPreviewVideos\(metaResult\)/);
  assert.match(page, />\s*1 掃描候選\s*</);
  assert.match(page, />\s*載入舊掃描\s*</);
  assert.match(page, />\s*2 生成選取影片\s*</);
  assert.match(page, />\s*2 生成推薦影片\s*</);
  assert.match(page, /<VideoPreview videos=\{metaPreviewVideos\} empty="尚無影片" \/>/);
  assert.match(page, /<ResultPanel title="Render \/ Queue 紀錄"[\s\S]{0,180}showPreview=\{false\}/);
  assert.match(globals, /\.hvsShell \.actionPanel \.videoPreview/);
  assert.match(globals, /\.hvsShell \.videoPreviewEmpty/);
});

test("version factory exposes multi-select render and batch one-click publish controls", () => {
  const page = fs.readFileSync(path.join(ROOT, "app/page.jsx"), "utf8");

  assert.match(page, /const \[selectedItemIds,\s*setSelectedItemIds\] = useState/);
  assert.match(page, /function toggleVersionItemSelection/);
  assert.match(page, /function selectVisibleVersionItems/);
  assert.match(page, /function clearSelectedVersionItems/);
  assert.match(page, /async function renderSelectedVersionItem/);
  assert.match(page, /\/api\/content-factory\/preview/);
  assert.match(page, /render:\s*true/);
  assert.match(page, /async function publishSelectedVersionItem/);
  assert.match(page, /\/api\/content-factory\/publish/);
  assert.match(page, /itemIds:\s*selectedItemIds/);
  assert.match(page, /selectedItemIds\.length/);
  assert.match(page, />\s*選取全部\s*</);
  assert.match(page, />\s*清除選取\s*</);
  assert.match(page, />\s*生產影片\s*</);
  assert.match(page, />\s*一鍵發布選取影片\s*</);
  assert.match(page, /<VideoPreview videos=\{versionPreviewVideos\} empty="尚無影片" \/>/);
});

test("workbench exposes region queue rank preset and exclusion controls in scan payload", () => {
  const page = fs.readFileSync(path.join(ROOT, "app/page.jsx"), "utf8");

  assert.match(page, /const \[metaRegion,\s*setMetaRegion\] = useState/);
  assert.match(page, /const \[metaQueue,\s*setMetaQueue\] = useState/);
  assert.match(page, /const \[metaRankPreset,\s*setMetaRankPreset\] = useState/);
  assert.match(page, /const \[metaExcludedChampions,\s*setMetaExcludedChampions\] = useState/);
  assert.match(page, /Region[\s\S]{0,220}value=\{metaRegion\}[\s\S]{0,220}setMetaRegion/);
  assert.match(page, /Queue[\s\S]{0,220}value=\{metaQueue\}[\s\S]{0,220}setMetaQueue/);
  assert.match(page, /Rank preset[\s\S]{0,220}value=\{metaRankPreset\}[\s\S]{0,220}setMetaRankPreset/);
  assert.match(page, /排除英雄[\s\S]{0,220}value=\{metaExcludedChampions\}[\s\S]{0,220}setMetaExcludedChampions/);
  assert.match(page, /region:\s*metaRegion/);
  assert.match(page, /queue:\s*metaQueue/);
  assert.match(page, /rankPreset:\s*metaRankPreset/);
  assert.match(page, /excludedChampions:\s*parseMetaExcludedChampions\(metaExcludedChampions\)/);
});

test("workbench protects source snapshot candidate risk and render behavior contracts", () => {
  const page = fs.readFileSync(path.join(ROOT, "app/page.jsx"), "utf8");

  assert.match(page, /function formatMetaRiskLabel/);
  assert.match(page, /function formatMetaHardBlockReason/);
  assert.match(page, /metaSourceStatus/);
  assert.match(page, /primarySource\?\.provider/);
  assert.match(page, /verifierSource\?\.provider/);
  assert.match(page, /setMetaSnapshotId\(payload\.snapshotId \|\| ""\)/);
  assert.match(page, /\/api\/meta-factory\/snapshot\?snapshotId=\$\{encodeURIComponent\(metaSnapshotId\)\}/);

  assert.match(page, /const metaCandidatePool = getMetaCandidatePool\(metaCandidates,\s*metaMode\)/);
  assert.match(page, /metaRenderableCandidatePool\.slice\(0,\s*12\)\.map\(\(candidate\) =>/);
  assert.match(page, /metaBlockedCandidatePool\.slice\(0,\s*6\)\.map\(\(candidate\) =>/);
  assert.match(page, /candidate\.riskLabels \|\| \[\]/);
  assert.match(page, /candidate\.hardBlock\?\.reasons \|\| \[\]/);
  assert.match(page, /暫無主要風險/);
  assert.match(page, /可生成/);
  assert.equal(page.includes("NO_RISK_LABELS"), false);
  assert.equal(page.includes("Hard blocks:"), false);
  assert.equal(page.includes("hard-block"), false);

  assert.match(page, /async function renderMetaCandidate\(\{ useTopCandidate = false \} = \{\}\)/);
  assert.match(page, /candidateId:\s*metaSelectedCandidateId/);
  assert.match(page, /useTopCandidate/);
  assert.match(page, /disabled=\{busy \|\| !metaSnapshotId \|\| !hasRenderableMetaCandidate\}>\s*2 生成推薦影片/);
});
