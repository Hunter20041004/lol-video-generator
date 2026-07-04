const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "../..");

test("pipeline registry exposes retained dataTypes and rejects removed ones", () => {
  const {
    ACTIVE_DATA_TYPES,
    REMOVED_DATA_TYPES,
    assertSupportedDataType,
    isRemovedDataType,
  } = require(path.join(ROOT, "utils/pipelineRegistry.js"));

  assert.deepEqual(ACTIVE_DATA_TYPES, [
    "PATCH",
    "SYSTEM_UPDATE",
    "ITEM_UPDATE",
    "RUNE_UPDATE",
    "ESPORTS_H2H_RADAR",
    "ESPORTS_MATCH_RECAP",
    "PLAYER_RADAR",
    "META_OFFMETA_PICK",
    "META_TIER_RANKING",
  ]);
  assert.deepEqual(REMOVED_DATA_TYPES, [
    "PRO_BUILD",
    "TIER_LIST",
    "TFT_INFO",
    "ESPORTS_DRAMA",
  ]);
  assert.equal(isRemovedDataType("TFT_INFO"), true);
  assert.equal(assertSupportedDataType("PATCH"), "PATCH");
  assert.equal(assertSupportedDataType(), "PATCH");
  assert.throws(() => assertSupportedDataType("PRO_BUILD"), /Unsupported dataType: PRO_BUILD/);
});

test("pipeline registry classifies factory scopes and unknown values", () => {
  const {
    normalizeDataType,
    isSupportedDataType,
    isRemovedDataType,
    isVersionFactoryDataType,
    assertVersionFactoryDataType,
    unsupportedDataTypeMessage,
  } = require(path.join(ROOT, "utils/pipelineRegistry.js"));

  assert.equal(normalizeDataType("player_radar"), "PLAYER_RADAR");
  assert.equal(normalizeDataType("unknown"), "PATCH");
  assert.equal(isSupportedDataType(""), false);
  assert.equal(isRemovedDataType(null), false);
  assert.equal(isVersionFactoryDataType("RUNE_UPDATE"), true);
  assert.equal(isVersionFactoryDataType("PLAYER_RADAR"), false);
  assert.equal(unsupportedDataTypeMessage(""), "Unsupported dataType: UNKNOWN");
  assert.equal(assertVersionFactoryDataType("item_update"), "ITEM_UPDATE");
  assert.throws(() => assertVersionFactoryDataType("PLAYER_RADAR"), /Unsupported version factory dataType: PLAYER_RADAR/);
});

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

test("pipeline schema and render mapping do not include removed dataTypes", () => {
  const { DATA_TYPES, normalizePipelinePayload } = require(path.join(ROOT, "src/schemas/pipelineSchemas.js"));
  const { DATA_TYPE_TO_COMPOSITION } = require(path.join(ROOT, "utils/render/renderService.js"));

  for (const removed of ["PRO_BUILD", "TIER_LIST", "TFT_INFO", "ESPORTS_DRAMA"]) {
    assert.equal(DATA_TYPES.includes(removed), false);
    assert.equal(Object.hasOwn(DATA_TYPE_TO_COMPOSITION, removed), false);
  }

  assert.equal(normalizePipelinePayload({ dataType: "PRO_BUILD" }).data.dataType, "PATCH");
});

test("publish platform policy only allows Instagram and Threads", () => {
  const {
    DEFAULT_PLATFORMS,
    assertSupportedPlatform,
    filterSupportedPlatforms,
  } = require(path.join(ROOT, "utils/publishing/index.js"));

  assert.deepEqual(DEFAULT_PLATFORMS, ["instagram", "threads"]);
  assert.deepEqual(filterSupportedPlatforms(["instagram", "youtube", "threads", "tiktok"]), ["instagram", "threads"]);
  assert.equal(assertSupportedPlatform("instagram"), "instagram");
  assert.throws(() => assertSupportedPlatform("youtube"), /Unsupported platform: youtube/);
  assert.throws(() => assertSupportedPlatform("tiktok"), /Unsupported platform: tiktok/);
});
