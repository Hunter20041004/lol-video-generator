const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "../../..");
const removedDataTypes = ["PRO_BUILD", "TIER_LIST", "TFT_INFO", "ESPORTS_DRAMA"];
const removedTemplateFiles = [
  "src/templates/Template_ProBuild.jsx",
  "src/templates/Template_TierList.jsx",
  "src/templates/Template_TFT.jsx",
  "src/templates/Template_EsportsDrama.jsx",
];

test("removed pipeline templates are deleted from the render tree", () => {
  for (const file of removedTemplateFiles) {
    assert.equal(fs.existsSync(path.join(ROOT, file)), false, `${file} should be removed`);
  }
});

test("Remotion router and root defaults contain only retained dataTypes", () => {
  const files = [
    "src/Composition.jsx",
    "src/Root.jsx",
    "src/video-system/VideoPrimitives.jsx",
    "src/components/SubtitleOverlay.jsx",
  ];

  for (const file of files) {
    const source = fs.readFileSync(path.join(ROOT, file), "utf8");
    for (const dataType of removedDataTypes) {
      assert.equal(source.includes(dataType), false, `${file} should not reference ${dataType}`);
    }
  }
});

test("Meta router and root defaults register only new META dataTypes", () => {
  const { DATA_TYPE_TO_COMPOSITION } = require(path.join(ROOT, "utils/render/renderService.js"));
  assert.equal(DATA_TYPE_TO_COMPOSITION.META_OFFMETA_PICK, "MetaOffmetaVideo");
  assert.equal(DATA_TYPE_TO_COMPOSITION.META_TIER_RANKING, "MetaTierRankingVideo");
  assert.equal(Object.hasOwn(DATA_TYPE_TO_COMPOSITION, "PRO_BUILD"), false);
  assert.equal(Object.hasOwn(DATA_TYPE_TO_COMPOSITION, "TIER_LIST"), false);

  const rootSource = fs.readFileSync(path.join(ROOT, "src/Root.jsx"), "utf8");
  assert.equal(rootSource.includes("MetaOffmetaVideo"), true);
  assert.equal(rootSource.includes("MetaTierRankingVideo"), true);
  assert.equal(rootSource.includes("META_OFFMETA_PICK"), true);
  assert.match(rootSource, /createPortfolioRenderProps\(\)\.data/);
  assert.equal(
    require(path.join(ROOT, "utils/portfolioDemo.js")).createPortfolioRenderProps().data.dataType,
    "META_TIER_RANKING",
  );

  const compositionSource = fs.readFileSync(path.join(ROOT, "src/Composition.jsx"), "utf8");
  assert.equal(compositionSource.includes("Template_MetaOffmeta"), true);
  assert.equal(compositionSource.includes("Template_MetaTierRanking"), true);
  assert.equal(compositionSource.includes("META_OFFMETA_PICK"), true);
  assert.equal(compositionSource.includes("META_TIER_RANKING"), true);
});

test("Meta offmeta template localizes visible chrome and avoids raw status labels", () => {
  const source = fs.readFileSync(path.join(ROOT, "src/templates/Template_MetaOffmeta.jsx"), "utf8");

  assert.match(source, /function getOffmetaTemplateCopy/);
  assert.match(source, /const copy = getOffmetaTemplateCopy\(data\)/);
  assert.match(source, /left=\{copy\.chromeLeft\}/);
  assert.match(source, /right=\{copy\.chromeRight\}/);
  assert.match(source, /<PipelineBadge[\s\S]{0,140}\{copy\.badge\}[\s\S]{0,40}<\/PipelineBadge>/);
  assert.match(source, /versionOverview/);
  assert.match(source, /coreItems/);
  assert.match(source, /coreRunes/);
  assert.equal(source.includes("left=\"META OFFMETA\""), false);
  assert.equal(source.includes("BLACK TECH CHECK</PipelineBadge>"), false);
  assert.equal(source.includes("title=\"RISK CHECK\""), false);
  assert.equal(source.includes("label=\"Score\""), false);
  assert.equal(source.includes("riskVerdict"), false);
  assert.equal(source.includes("SOURCE_UNAVAILABLE"), false);
  assert.equal(source.includes("NO_MAJOR_RISK"), false);
});

test("Meta offmeta template uses premium LOL-style cinematic scenes instead of dashboard sections", () => {
  const source = fs.readFileSync(path.join(ROOT, "src/templates/Template_MetaOffmeta.jsx"), "utf8");

  assert.match(source, /const CinematicBackdrop/);
  assert.match(source, /const VersionScanScene/);
  assert.match(source, /const HeroRevealScene/);
  assert.match(source, /const CoreLoadoutScene/);
  assert.match(source, /const TryOrSkipScene/);
  assert.match(source, /const localizeZhVisibleText/);
  assert.match(source, /const replaceZhChampionName/);
  assert.match(source, /const sanitizeStoryboardForLocale/);
  assert.match(source, /buildTimeline\(sanitizeStoryboardForLocale\(fallbackStoryboard\(data\), data\), fps, 0\)/);
  assert.match(source, /active\.scene\?\.tag === "VERSION_OVERVIEW"/);
  assert.match(source, /active\.scene\?\.tag === "CORE_TECH"/);
  assert.match(source, /active\.scene\?\.tag === "TEST_PLAN"/);
  assert.match(source, /const showSubtitle = !\["VERSION_OVERVIEW", "CORE_TECH", "CONCLUSION_CTA"\]\.includes\(active\.scene\?\.tag\)/);
  assert.match(source, /const playerTakeaways = data\.playerTakeaways/);
  assert.match(source, /const championArt = data\.splashUrl \|\| data\.heroImageUrl \|\| data\.heroIconUrl/);
  assert.match(source, /spring\(\{ frame: active\.localFrame \+ 18, fps/);
  assert.match(source, /<CinematicBackdrop/);
  assert.match(source, /<VersionScanScene/);
  assert.match(source, /<HeroRevealScene/);
  assert.match(source, /<CoreLoadoutScene/);
  assert.match(source, /<TryOrSkipScene/);
  assert.match(source, /const META_OFFMETA_SUBTITLE_BOTTOM = 300/);
  assert.match(source, /bottom=\{META_OFFMETA_SUBTITLE_BOTTOM\}[\s\S]{0,80}variant="lowerThird"/);
  assert.equal(source.includes("bottom={26}"), false);
  assert.equal(source.includes("const VersionOverview"), false);
  assert.equal(source.includes("<VersionOverview"), false);
  assert.equal(source.includes("<CoreTechPanel"), false);
  assert.equal(source.includes("<TakeawayGrid"), false);
  assert.equal(source.includes('gridTemplateColumns: "repeat(5, 1fr)"'), false);
  assert.equal(source.includes("metricCards.map"), false);
  assert.equal(source.includes("<RiskReadout"), false);
  assert.equal(source.includes("SOURCE_UNAVAILABLE"), false);
  assert.equal(source.includes("BLACK TECH CHECK"), false);
  assert.equal(source.includes("非主流出裝"), false);
  assert.equal(source.includes("Off-meta build"), false);
  assert.equal(source.includes("題材分"), false);
  assert.equal(source.includes("來源一致度"), false);
  assert.equal(source.includes('versionOverview.region || "Global"'), false);
  assert.equal(source.includes('overview.region || "Global"'), false);
  assert.equal(source.includes('overview.rankPreset || "分段"'), false);
});

test("Meta offmeta overview scene keeps a centered hierarchy and safe subtitle room", () => {
  const source = fs.readFileSync(path.join(ROOT, "src/templates/Template_MetaOffmeta.jsx"), "utf8");

  assert.match(source, /const META_OFFMETA_STAGE_INSET = "112px 90px 230px"/);
  assert.match(source, /const META_OFFMETA_INTRO_TITLE_SIZE = 72/);
  assert.match(source, /const META_OFFMETA_INTRO_BODY_SIZE = 30/);
  assert.match(source, /const META_OFFMETA_RAIL_VALUE_SIZE = 28/);
  assert.match(source, /<SafeStage inset=\{META_OFFMETA_STAGE_INSET\}>/);
  assert.match(source, /maxWidth: 860/);
  assert.match(source, /fontSize: META_OFFMETA_INTRO_TITLE_SIZE/);
  assert.match(source, /fontSize: META_OFFMETA_INTRO_BODY_SIZE/);
  assert.match(source, /fontSize: META_OFFMETA_RAIL_VALUE_SIZE/);
  assert.equal(source.includes('paddingBottom: 150'), false);
});

test("Meta offmeta overview scene uses champion atmosphere without angled frame weight", () => {
  const source = fs.readFileSync(path.join(ROOT, "src/templates/Template_MetaOffmeta.jsx"), "utf8");

  assert.match(source, /const showChampion = Boolean\(championArt\)/);
  assert.match(source, /const championFilter = activeTag === "VERSION_OVERVIEW"/);
  assert.match(source, /brightness\(0\.34\) saturate\(0\.95\) contrast\(1\.08\) blur\(1\.2px\)/);
  assert.match(source, /radial-gradient\(ellipse at 50% 38%, rgba\(22,101,52,0\.22\), transparent 44%\)/);
  assert.match(source, /clipPath: activeTag === "VERSION_OVERVIEW" \? undefined/);
  assert.equal(source.includes('activeTag !== "VERSION_OVERVIEW"'), false);
});

test("Meta offmeta loadout scene avoids top-heavy empty layouts", () => {
  const source = fs.readFileSync(path.join(ROOT, "src/templates/Template_MetaOffmeta.jsx"), "utf8");

  assert.match(source, /const EmptyLoadoutPanel/);
  assert.match(source, /justifyContent: "center"/);
  assert.match(source, /maxWidth: 900/);
  assert.match(source, /options\.length > 0 \? options\.map/);
  assert.match(source, /<EmptyLoadoutPanel body=\{plan\}/);
  assert.equal(source.includes('paddingTop: 152'), false);
  assert.equal(source.includes('gridTemplateRows: "auto 1fr"'), false);
});

test("Meta tier ranking template uses localized champion rows and verdict sections", () => {
  const source = fs.readFileSync(path.join(ROOT, "src/templates/Template_MetaTierRanking.jsx"), "utf8");

  assert.match(source, /function getTierTemplateCopy/);
  assert.match(source, /const copy = getTierTemplateCopy\(data\)/);
  assert.match(source, /left=\{copy\.chromeLeft\}/);
  assert.match(source, /right=\{copy\.chromeRight\}/);
  assert.match(source, /<TierRow/);
  assert.match(source, /entry\.localizedChampionName \|\| entry\.champion/);
  assert.match(source, /entry\.heroIconUrl/);
  assert.match(source, /tierVerdict\?\.body|verdict\.body/);
  assert.match(source, /const META_TIER_SUBTITLE_BOTTOM = 300/);
  assert.match(source, /bottom=\{META_TIER_SUBTITLE_BOTTOM\}[\s\S]{0,80}variant="lowerThird"/);
  assert.equal(source.includes("bottom={26}"), false);
  assert.equal(source.includes('left="META TIER BOARD"'), false);
  assert.equal(source.includes('right="COMPOSITE SCORE"'), false);
  assert.equal(source.includes('eyebrow={`${data.role || "Mid"} - Top'), false);
});

test("Lower-third subtitles use readable shorts styling instead of ornate title typography", () => {
  const source = fs.readFileSync(path.join(ROOT, "src/video-system/SubtitleCaption.jsx"), "utf8");

  assert.match(source, /const LOWER_THIRD_FONT_SIZE = 30/);
  assert.match(source, /const LOWER_THIRD_MAX_WIDTH = 700/);
  assert.match(source, /const LOWER_THIRD_WIDTH = "66%"/);
  assert.match(source, /const lowerThirdFont = "'Noto Sans TC', 'PingFang TC', 'Heiti TC', sans-serif"/);
  assert.match(source, /fontSize: isLowerThird \? LOWER_THIRD_FONT_SIZE : 46/);
  assert.equal(source.includes("'Cinzel', 'Trajan Pro'"), false);
});

test("Esports recap rows can use per-scene points and headings for deeper analysis", () => {
  const source = fs.readFileSync(path.join(ROOT, "src/templates/Template_EsportsDaily.jsx"), "utf8");

  assert.match(source, /const RecapRows = \(\{ data, theme, localFrame, scene \}\)/);
  assert.match(source, /const scenePoints = asArray\(scene\?\.points\)/);
  assert.match(source, /scenePoints\.length > 0 \? scenePoints : asArray\(data\.recapPoints\)/);
  assert.match(source, /scene\?\.kicker \|\| "CREATOR READ"/);
  assert.match(source, /scene\?\.title \|\| data\.recapTitle/);
  assert.match(source, /scene\?\.subtitle \|\| data\.recapSubtitle/);
  assert.match(source, /<RecapRows data=\{data\} theme=\{theme\} localFrame=\{active\.localFrame\} scene=\{active\.scene\} \/>/);
});
