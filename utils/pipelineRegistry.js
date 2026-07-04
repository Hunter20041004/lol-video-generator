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

const REMOVED_DATA_TYPES = [
  "PRO_BUILD",
  "TIER_LIST",
  "TFT_INFO",
  "ESPORTS_DRAMA",
];

const VERSION_FACTORY_DATA_TYPES = [
  "PATCH",
  "SYSTEM_UPDATE",
  "ITEM_UPDATE",
  "RUNE_UPDATE",
];

const ESPORTS_DATA_TYPES = [
  "ESPORTS_H2H_RADAR",
  "ESPORTS_MATCH_RECAP",
  "PLAYER_RADAR",
];

const ACTIVE_DATA_TYPE_SET = new Set(ACTIVE_DATA_TYPES);
const REMOVED_DATA_TYPE_SET = new Set(REMOVED_DATA_TYPES);
const VERSION_FACTORY_DATA_TYPE_SET = new Set(VERSION_FACTORY_DATA_TYPES);
const META_DATA_TYPE_SET = new Set(META_DATA_TYPES);

function normalizeDataType(dataType = "PATCH") {
  const value = String(dataType || "PATCH").toUpperCase();
  return ACTIVE_DATA_TYPE_SET.has(value) ? value : "PATCH";
}

function isSupportedDataType(dataType) {
  return ACTIVE_DATA_TYPE_SET.has(String(dataType || "").toUpperCase());
}

function isRemovedDataType(dataType) {
  return REMOVED_DATA_TYPE_SET.has(String(dataType || "").toUpperCase());
}

function isVersionFactoryDataType(dataType) {
  return VERSION_FACTORY_DATA_TYPE_SET.has(String(dataType || "").toUpperCase());
}

function isMetaFactoryDataType(dataType) {
  return META_DATA_TYPE_SET.has(String(dataType || "").toUpperCase());
}

function unsupportedDataTypeMessage(dataType) {
  return `Unsupported dataType: ${String(dataType || "").toUpperCase() || "UNKNOWN"}`;
}

function assertSupportedDataType(dataType) {
  const value = String(dataType || "PATCH").toUpperCase();
  if (!isSupportedDataType(value)) {
    throw new Error(unsupportedDataTypeMessage(value));
  }
  return value;
}

function assertVersionFactoryDataType(dataType) {
  const value = assertSupportedDataType(dataType);
  if (!isVersionFactoryDataType(value)) {
    throw new Error(`Unsupported version factory dataType: ${value}`);
  }
  return value;
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
