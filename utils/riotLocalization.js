/**
 * Riot Data Dragon localization helpers.
 *
 * Purpose:
 * - Keep item/rune zh_TW names grounded in official Riot data.
 * - Provide official icon URLs for item/rune balance templates.
 */

const DDRAGON = 'https://ddragon.leagueoflegends.com';

let latestVersionPromise = null;
let itemIndexPromise = null;
let runeIndexPromise = null;
let championIndexPromise = null;

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'HextechVideoStudio/1.0',
      'Accept': 'application/json',
    },
  });
  if (!res.ok) throw new Error(`Riot Data Dragon fetch failed: HTTP ${res.status} for ${url}`);
  return res.json();
}

async function getLatestVersion() {
  if (!latestVersionPromise) {
    latestVersionPromise = fetchJson(`${DDRAGON}/api/versions.json`).then((versions) => versions[0]);
  }
  return latestVersionPromise;
}

function normalizeKey(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/['’`]/g, '')
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, ' ')
    .trim();
}

async function buildItemIndex() {
  const version = await getLatestVersion();
  const [en, zh] = await Promise.all([
    fetchJson(`${DDRAGON}/cdn/${version}/data/en_US/item.json`),
    fetchJson(`${DDRAGON}/cdn/${version}/data/zh_TW/item.json`),
  ]);

  const index = new Map();
  for (const [id, item] of Object.entries(en.data || {})) {
    const zhItem = zh.data?.[id] || {};
    const entry = {
      id,
      englishName: item.name,
      twName: zhItem.name || item.name,
      iconUrl: `${DDRAGON}/cdn/${version}/img/item/${id}.png`,
    };
    index.set(normalizeKey(item.name), entry);
    index.set(normalizeKey(zhItem.name), entry);
  }
  return index;
}

function flattenRunes(tree) {
  const out = [];
  for (const style of tree || []) {
    if (style?.name) out.push(style);
    for (const slot of style?.slots || []) {
      for (const rune of slot?.runes || []) out.push(rune);
    }
  }
  return out;
}

async function buildRuneIndex() {
  const version = await getLatestVersion();
  const [en, zh] = await Promise.all([
    fetchJson(`${DDRAGON}/cdn/${version}/data/en_US/runesReforged.json`),
    fetchJson(`${DDRAGON}/cdn/${version}/data/zh_TW/runesReforged.json`),
  ]);

  const zhById = new Map(flattenRunes(zh).map((r) => [String(r.id), r]));
  const index = new Map();
  for (const rune of flattenRunes(en)) {
    const zhRune = zhById.get(String(rune.id)) || {};
    const icon = rune.icon || zhRune.icon || '';
    const entry = {
      id: rune.id,
      englishName: rune.name,
      twName: zhRune.name || rune.name,
      iconUrl: icon ? `${DDRAGON}/cdn/img/${icon}` : '',
    };
    index.set(normalizeKey(rune.name), entry);
    index.set(normalizeKey(zhRune.name), entry);
  }
  return index;
}

async function buildChampionIndex() {
  const version = await getLatestVersion();
  const [en, zh] = await Promise.all([
    fetchJson(`${DDRAGON}/cdn/${version}/data/en_US/champion.json`),
    fetchJson(`${DDRAGON}/cdn/${version}/data/zh_TW/champion.json`),
  ]);

  const zhById = new Map(Object.values(zh.data || {}).map((champion) => [String(champion.id), champion]));
  const index = new Map();
  for (const champion of Object.values(en.data || {})) {
    const zhChampion = zhById.get(String(champion.id)) || {};
    const entry = {
      id: champion.id,
      englishName: champion.name,
      twName: zhChampion.name || champion.name,
      iconUrl: `${DDRAGON}/cdn/${version}/img/champion/${champion.image?.full || `${champion.id}.png`}`,
    };
    index.set(normalizeKey(champion.name), entry);
    index.set(normalizeKey(champion.id), entry);
    index.set(normalizeKey(zhChampion.name), entry);
  }
  return index;
}

async function getItemEntry(name) {
  if (!itemIndexPromise) itemIndexPromise = buildItemIndex();
  const index = await itemIndexPromise;
  return index.get(normalizeKey(name)) || null;
}

async function getRuneEntry(name) {
  if (!runeIndexPromise) runeIndexPromise = buildRuneIndex();
  const index = await runeIndexPromise;
  return index.get(normalizeKey(name)) || null;
}

async function getChampionEntry(name) {
  if (!championIndexPromise) championIndexPromise = buildChampionIndex();
  const index = await championIndexPromise;
  return index.get(normalizeKey(name)) || null;
}

async function getItemTWName(englishName) {
  const entry = await getItemEntry(englishName);
  return entry?.twName || englishName;
}

async function getRuneTWName(englishName) {
  const entry = await getRuneEntry(englishName);
  return entry?.twName || englishName;
}

async function getItemIconUrl(englishName) {
  const entry = await getItemEntry(englishName);
  return entry?.iconUrl || '';
}

async function getRuneIconUrl(englishName) {
  const entry = await getRuneEntry(englishName);
  return entry?.iconUrl || '';
}

async function getChampionTWName(englishName) {
  const entry = await getChampionEntry(englishName);
  return entry?.twName || englishName;
}

async function getChampionIconUrl(englishName) {
  const entry = await getChampionEntry(englishName);
  return entry?.iconUrl || '';
}

module.exports = {
  getLatestVersion,
  getItemEntry,
  getRuneEntry,
  getChampionEntry,
  getItemTWName,
  getRuneTWName,
  getItemIconUrl,
  getRuneIconUrl,
  getChampionTWName,
  getChampionIconUrl,
};
