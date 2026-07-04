const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const {
  DEFAULT_CONTENT_PROJECT_ID,
  getContentProject,
  isKnownContentProjectId,
  listContentProjects,
  normalizeContentProjectId,
} = require("./projects");

const DATA_DIR = path.join(process.cwd(), ".data");
const DB_PATH = path.join(DATA_DIR, "patch-content-db.json");
const QUEUE_PATH = path.join(DATA_DIR, "publish-queue.json");

const CATEGORY_ORDER = {
  SYSTEM: 0,
  CHAMPION: 1,
  RUNE: 2,
  ITEM: 3,
};

const PUBLISHABLE_STATUSES = new Set(["READY", "FAILED"]);
const RESET_REASON_DEFAULT = "manual_republish_reset";

function ensureDataDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function normalizeProjectFields(item = {}) {
  const project = getContentProject(item.projectId || item.project?.id || DEFAULT_CONTENT_PROJECT_ID);
  return {
    ...item,
    projectId: project.id,
    projectName: item.projectName || project.name,
    projectDomain: item.projectDomain || project.domain,
    sourceType: item.sourceType || project.sourceType,
    sourceLabel: item.sourceLabel || project.sourceLabel,
  };
}

function readDatabase() {
  ensureDataDir();
  if (!fs.existsSync(DB_PATH)) return { version: 1, items: [] };
  try {
    const parsed = JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
    return {
      version: 1,
      items: Array.isArray(parsed.items) ? parsed.items.map(normalizeProjectFields) : [],
    };
  } catch (error) {
    console.warn(`[ContentFactory] Could not parse database: ${error.message}`);
    return { version: 1, items: [] };
  }
}

function writeDatabase(database) {
  ensureDataDir();
  fs.writeFileSync(DB_PATH, JSON.stringify({
    version: 1,
    items: Array.isArray(database.items) ? database.items.map(normalizeProjectFields) : [],
  }, null, 2), "utf8");
}

function stableHash(value) {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(value))
    .digest("hex");
}

function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizeSearchText(value = "") {
  return cleanText(value).toLowerCase();
}

function getPatchItemIdentityKey(item = {}) {
  const projectId = normalizeSearchText(normalizeContentProjectId(item.projectId || DEFAULT_CONTENT_PROJECT_ID));
  const patchVersion = normalizeSearchText(item.patchVersion || "latest");
  const category = normalizeSearchText(item.category || item.dataType || "unknown");
  const name = normalizeSearchText(
    item.targetName ||
    item.localizedName ||
    item.payload?.targetName ||
    item.payload?.championName ||
    item.raw?.championName ||
    item.raw?.targetName ||
    ""
  );
  return [projectId, patchVersion, category, name].join("::");
}

function getPatchItemHashKey(item = {}) {
  return [
    normalizeContentProjectId(item.projectId || DEFAULT_CONTENT_PROJECT_ID),
    item.sourceHash || "",
  ].join("::");
}

function inferPatchVersion(patchUrl = "") {
  const match = String(patchUrl || "").match(/patch[-/](\d+)[.-](\d+)/i);
  if (!match) return "latest";
  return `${match[1]}.${match[2]}`;
}

function comparePatchVersionsDesc(left = "", right = "") {
  const parse = (version) => {
    const match = String(version || "").match(/^(\d+)\.(\d+)$/);
    if (!match) return [-1, -1];
    return [Number(match[1]), Number(match[2])];
  };
  const [leftMajor, leftMinor] = parse(left);
  const [rightMajor, rightMinor] = parse(right);
  if (leftMajor !== rightMajor) return rightMajor - leftMajor;
  return rightMinor - leftMinor;
}

function inferChangeTypeFromText(text = "") {
  const value = String(text || "");
  const buffCount = (value.match(/buff|increase|increased|buffed|提升|增加|增強|上修/gi) || []).length;
  const nerfCount = (value.match(/nerf|decrease|decreased|reduced|削弱|降低|減少|下修/gi) || []).length;
  if (buffCount > 0 && nerfCount > 0) return "ADJUST";
  if (buffCount > nerfCount) return "BUFF";
  if (nerfCount > buffCount) return "NERF";
  return "ADJUST";
}

function inferItemChangeType(target = {}) {
  const valid = new Set(["BUFF", "NERF", "ADJUST", "REWORK"]);
  if (valid.has(target.changeType)) return target.changeType;
  if (valid.has(target.trend)) return target.trend;
  const stats = Array.isArray(target.statChanges) ? target.statChanges : [];
  const hasBuff = stats.some((stat) => stat.trend === "BUFF");
  const hasNerf = stats.some((stat) => stat.trend === "NERF");
  if (hasBuff && hasNerf) return "ADJUST";
  if (hasBuff) return "BUFF";
  if (hasNerf) return "NERF";
  return inferChangeTypeFromText(`${target.changeDesc || ""} ${target.ability || ""}`);
}

function scoreChampion(champion = {}) {
  const changes = Array.isArray(champion.changes) ? champion.changes : [];
  const text = changes.map((change) => `${change.ability || ""} ${change.changeDesc || ""}`).join(" ");
  const reworkBonus = /rework|重製|重做|機制|mechanic/i.test(text) ? 18 : 0;
  const ultimateBonus = /(^|\s|：|:)R(\s|：|:)|ultimate|大絕/i.test(text) ? 8 : 0;
  return Math.min(100, 58 + changes.length * 8 + reworkBonus + ultimateBonus);
}

function scoreItemRune(target = {}) {
  const stats = Array.isArray(target.statChanges) ? target.statChanges : [];
  const text = `${target.targetName || ""} ${target.localizedName || ""} ${target.changeDesc || ""}`;
  const coreBonus = /cost|價格|damage|傷害|attack|攻擊|speed|跑速|movement|吸血|omnivamp|cooldown|冷卻/i.test(text) ? 12 : 0;
  const mixedBonus = inferItemChangeType(target) === "ADJUST" ? 8 : 0;
  return Math.min(100, 45 + stats.length * 9 + coreBonus + mixedBonus);
}

function scoreSystem(target = {}) {
  const stats = Array.isArray(target.statChanges) ? target.statChanges : [];
  const text = `${target.targetName || ""} ${target.localizedName || ""} ${target.changeDesc || ""} ${target.systemType || ""}`;
  const metaBonus = /support|輔助|role quest|路線任務|objective|物件|jungle|野區|lane|路線|map|地圖/i.test(text) ? 18 : 0;
  const reworkBonus = /rework|重製|大改|holistic|全面|systemic|系統/i.test(text) ? 12 : 0;
  return Math.min(100, 58 + stats.length * 7 + metaBonus + reworkBonus);
}

function createChampionItem(champion = {}, patchVersion, patchUrl) {
  const changes = Array.isArray(champion.changes) ? champion.changes : [];
  const ability = changes.map((change) => change.ability).filter(Boolean).join(", ");
  const changeDesc = changes
    .map((change) => `【${change.ability || "改動"}】\n${change.changeDesc || ""}`)
    .join("\n\n");
  const sourceHash = stableHash({
    patchVersion,
    category: "CHAMPION",
    targetName: champion.championName,
    changes,
  });

  return {
    id: `patch_${sourceHash.slice(0, 16)}`,
    sourceHash,
    patchVersion,
    patchUrl,
    category: "CHAMPION",
    dataType: "PATCH",
    targetName: champion.championName,
    localizedName: champion.localizedChampionName || champion.championName,
    changeType: inferChangeTypeFromText(changeDesc),
    priorityScore: scoreChampion(champion),
    payload: {
      dataType: "PATCH",
      championName: champion.championName,
      ability,
      changeDesc,
    },
    raw: champion,
  };
}

function createItemRuneItem(target = {}, category, patchVersion, patchUrl) {
  const normalizedCategory = category === "RUNE" ? "RUNE" : "ITEM";
  const targetName = target.targetName || target.itemName || target.runeName || target.localizedName || "Unknown";
  const sourceHash = stableHash({
    patchVersion,
    category: normalizedCategory,
    targetName,
    statChanges: target.statChanges || [],
    changeDesc: target.changeDesc || "",
  });

  return {
    id: `patch_${sourceHash.slice(0, 16)}`,
    sourceHash,
    patchVersion,
    patchUrl,
    category: normalizedCategory,
    dataType: normalizedCategory === "RUNE" ? "RUNE_UPDATE" : "ITEM_UPDATE",
    targetName,
    localizedName: target.localizedName || targetName,
    changeType: inferItemChangeType(target),
    priorityScore: scoreItemRune(target),
    payload: {
      ...target,
      dataType: normalizedCategory === "RUNE" ? "RUNE_UPDATE" : "ITEM_UPDATE",
      targetType: normalizedCategory,
      targetName,
    },
    raw: target,
  };
}

function createSystemItem(target = {}, patchVersion, patchUrl) {
  const targetName = target.targetName || target.sectionTitle || target.localizedName || "System Update";
  const sourceHash = stableHash({
    patchVersion,
    category: "SYSTEM",
    targetName,
    changeDesc: target.changeDesc || "",
    statChanges: target.statChanges || [],
    subtopics: target.subtopics || [],
  });

  return {
    id: `patch_${sourceHash.slice(0, 16)}`,
    sourceHash,
    patchVersion,
    patchUrl,
    category: "SYSTEM",
    dataType: "SYSTEM_UPDATE",
    targetName,
    localizedName: target.localizedName || targetName,
    changeType: inferItemChangeType(target),
    priorityScore: scoreSystem(target),
    payload: {
      ...target,
      dataType: "SYSTEM_UPDATE",
      targetType: "SYSTEM",
      targetName,
    },
    raw: target,
  };
}

function buildPatchItemsFromScanResult(scanResult = {}, options = {}) {
  const project = getContentProject(options.projectId || scanResult.projectId || DEFAULT_CONTENT_PROJECT_ID);
  const patchVersion = options.patchVersion || inferPatchVersion(scanResult.patchUrl);
  const patchUrl = scanResult.patchUrl || "";
  const champions = Array.isArray(scanResult.list) ? scanResult.list : [];
  const itemChanges = Array.isArray(scanResult.itemChanges) ? scanResult.itemChanges : [];
  const runeChanges = Array.isArray(scanResult.runeChanges) ? scanResult.runeChanges : [];
  const systemChanges = Array.isArray(scanResult.systemChanges) ? scanResult.systemChanges : [];

  return [
    ...systemChanges
      .filter((system) => cleanText(system.targetName || system.sectionTitle || system.localizedName))
      .map((system) => createSystemItem(system, patchVersion, patchUrl)),
    ...champions
      .filter((champion) => cleanText(champion.championName) && Array.isArray(champion.changes) && champion.changes.length > 0)
      .map((champion) => createChampionItem(champion, patchVersion, patchUrl)),
    ...runeChanges
      .filter((rune) => cleanText(rune.targetName || rune.runeName || rune.localizedName))
      .map((rune) => createItemRuneItem(rune, "RUNE", patchVersion, patchUrl)),
    ...itemChanges
      .filter((item) => cleanText(item.targetName || item.itemName || item.localizedName))
      .map((item) => createItemRuneItem(item, "ITEM", patchVersion, patchUrl)),
  ].map((item) => normalizeProjectFields({
    ...item,
    projectId: project.id,
    projectName: project.name,
    projectDomain: project.domain,
    sourceType: project.sourceType,
    sourceLabel: project.sourceLabel,
    payload: {
      ...(item.payload || {}),
      projectId: project.id,
      projectName: project.name,
      projectDomain: project.domain,
    },
  }));
}

function upsertPatchItems(items = [], options = {}) {
  const now = options.now || new Date().toISOString();
  const database = readDatabase();
  const existingByHash = new Map(database.items.map((item) => [getPatchItemHashKey(item), item]));
  const existingByIdentity = new Map();
  for (const item of database.items) {
    const key = getPatchItemIdentityKey(item);
    if (key && !existingByIdentity.has(key)) existingByIdentity.set(key, item);
  }
  let inserted = 0;
  let updated = 0;

  for (const item of items) {
    const identityKey = getPatchItemIdentityKey(item);
    const hashKey = getPatchItemHashKey(item);
    const existing = existingByHash.get(hashKey) || existingByIdentity.get(identityKey);
    if (existing) {
      Object.assign(existing, {
        ...item,
        id: existing.id || item.id,
        status: existing.status || "READY",
        createdAt: existing.createdAt || now,
        updatedAt: now,
        renderedAt: existing.renderedAt || null,
        publishedAt: existing.publishedAt || null,
        renderResult: existing.renderResult || null,
        publishResult: existing.publishResult || null,
        error: existing.error || null,
      });
      existingByHash.set(getPatchItemHashKey(existing), existing);
      existingByIdentity.set(identityKey, existing);
      updated += 1;
    } else {
      const insertedItem = {
        ...item,
        status: "READY",
        createdAt: now,
        updatedAt: now,
        renderedAt: null,
        publishedAt: null,
        renderResult: null,
        publishResult: null,
        error: null,
      };
      database.items.push(insertedItem);
      existingByHash.set(getPatchItemHashKey(insertedItem), insertedItem);
      existingByIdentity.set(identityKey, insertedItem);
      inserted += 1;
    }
  }

  database.items = sortPatchItems(database.items);
  writeDatabase(database);
  return { database, inserted, updated };
}

function sortPatchItems(items = []) {
  return [...items].sort((a, b) => {
    const projectDelta = String(a.projectId || DEFAULT_CONTENT_PROJECT_ID).localeCompare(String(b.projectId || DEFAULT_CONTENT_PROJECT_ID));
    if (projectDelta !== 0) return projectDelta;
    const patchDelta = comparePatchVersionsDesc(a.patchVersion, b.patchVersion);
    if (patchDelta !== 0) return patchDelta;
    const categoryDelta = (CATEGORY_ORDER[a.category] ?? 99) - (CATEGORY_ORDER[b.category] ?? 99);
    if (categoryDelta !== 0) return categoryDelta;
    const scoreDelta = (b.priorityScore || 0) - (a.priorityScore || 0);
    if (scoreDelta !== 0) return scoreDelta;
    return String(a.targetName || "").localeCompare(String(b.targetName || ""));
  });
}

function summarizePatchItems(items = []) {
  return items.reduce((acc, item) => {
    const projectId = normalizeContentProjectId(item.projectId || DEFAULT_CONTENT_PROJECT_ID);
    acc.total += 1;
    acc.byProject[projectId] = (acc.byProject[projectId] || 0) + 1;
    acc.byCategory[item.category] = (acc.byCategory[item.category] || 0) + 1;
    acc.byStatus[item.status] = (acc.byStatus[item.status] || 0) + 1;
    return acc;
  }, { total: 0, byProject: {}, byCategory: {}, byStatus: {} });
}

function listPatchItems(filter = {}) {
  const database = readDatabase();
  let items = database.items;
  if (filter.projectId) {
    if (!isKnownContentProjectId(filter.projectId)) return [];
    const projectId = normalizeContentProjectId(filter.projectId);
    items = items.filter((item) => normalizeContentProjectId(item.projectId || DEFAULT_CONTENT_PROJECT_ID) === projectId);
  }
  if (filter.patchVersion) items = items.filter((item) => item.patchVersion === filter.patchVersion);
  if (filter.category) items = items.filter((item) => item.category === filter.category);
  if (filter.status) items = items.filter((item) => item.status === filter.status);
  return sortPatchItems(items);
}

function selectPublishCandidates({ count = 1, projectId = "", patchVersion = "", category = "" } = {}) {
  reconcilePublishedItemsFromQueue();
  const limit = Math.min(5, Math.max(1, Number(count) || 1));
  return listPatchItems({ projectId, patchVersion, category })
    .filter((item) => PUBLISHABLE_STATUSES.has(item.status))
    .slice(0, limit);
}

function readPublishedQueueTasks(queuePath = QUEUE_PATH) {
  if (!fs.existsSync(queuePath)) return [];
  try {
    const parsed = JSON.parse(fs.readFileSync(queuePath, "utf8"));
    const tasks = Array.isArray(parsed?.tasks) ? parsed.tasks : Array.isArray(parsed) ? parsed : [];
    return tasks.filter((task) => task?.status === "PUBLISHED");
  } catch (error) {
    console.warn(`[ContentFactory] Could not parse publish queue: ${error.message}`);
    return [];
  }
}

function taskMatchesPatchItem(task, item) {
  const haystack = normalizeSearchText(JSON.stringify({
    title: task?.copy?.title,
    description: task?.copy?.description,
    caption: task?.copy?.caption,
    tags: task?.copy?.tags,
    videoUrl: task?.videoUrl,
  }));
  const names = [
    item.targetName,
    item.localizedName,
    item.raw?.localizedChampionName,
    item.payload?.championName,
    item.payload?.sectionTitle,
  ].map(normalizeSearchText).filter(Boolean);
  if (!names.some((name) => haystack.includes(name))) return false;
  if (item.patchVersion && item.patchVersion !== "latest" && !haystack.includes(normalizeSearchText(item.patchVersion))) {
    return false;
  }
  return true;
}

function getTaskTimestamp(task = {}) {
  const raw = task.publishedAt || task.createdAt || task.updatedAt || "";
  const time = Date.parse(raw);
  return Number.isFinite(time) ? time : null;
}

function canReconcileTaskAfterReset(task, item) {
  const resetTime = Date.parse(item.publishResetAt || "");
  if (!Number.isFinite(resetTime)) return true;
  const taskTime = getTaskTimestamp(task);
  return taskTime !== null && taskTime > resetTime;
}

function reconcilePublishedItemsFromQueue({ queuePath = QUEUE_PATH, now = new Date().toISOString() } = {}) {
  const publishedTasks = readPublishedQueueTasks(queuePath);
  if (publishedTasks.length === 0) return { updated: 0, items: [] };

  const database = readDatabase();
  let updated = 0;
  const updatedItems = [];
  database.items = database.items.map((item) => {
    if (item.status === "PUBLISHED") return item;
    const matchedTasks = publishedTasks.filter((task) => taskMatchesPatchItem(task, item) && canReconcileTaskAfterReset(task, item));
    if (matchedTasks.length === 0) return item;
    updated += 1;
    const nextItem = {
      ...item,
      status: "PUBLISHED",
      publishedAt: item.publishedAt || now,
      error: null,
      publishResult: {
        ...(item.publishResult || {}),
        success: true,
        action: "publish",
        reconciledFromQueue: true,
        jobs: matchedTasks,
      },
    };
    updatedItems.push(nextItem);
    return nextItem;
  });

  if (updated > 0) {
    database.items = sortPatchItems(database.items);
    writeDatabase(database);
  }
  return { updated, items: updatedItems };
}

function buildRepublishResetPatch(now, reason) {
  return {
    status: "READY",
    renderedAt: null,
    publishedAt: null,
    renderResult: null,
    publishResult: null,
    error: null,
    publishResetAt: now,
    publishResetReason: reason || RESET_REASON_DEFAULT,
    updatedAt: now,
  };
}

function resetPatchItemForRepublish(id, options = {}) {
  const now = options.now || new Date().toISOString();
  const database = readDatabase();
  const index = database.items.findIndex((item) => item.id === id);
  if (index < 0) return null;
  database.items[index] = {
    ...database.items[index],
    ...buildRepublishResetPatch(now, options.reason),
  };
  database.items = sortPatchItems(database.items);
  writeDatabase(database);
  return database.items.find((item) => item.id === id);
}

function resetPatchItemsForRepublish(filter = {}, options = {}) {
  const now = options.now || new Date().toISOString();
  const projectId = cleanText(filter.projectId || "");
  const patchVersion = cleanText(filter.patchVersion || "");
  const category = cleanText(filter.category || "");
  const ids = new Set(Array.isArray(filter.ids) ? filter.ids.map((id) => String(id || "").trim()).filter(Boolean) : []);
  const database = readDatabase();
  const resetItems = [];

  database.items = database.items.map((item) => {
    const matchesId = ids.size > 0 && ids.has(item.id);
    const matchesProject = !projectId || normalizeContentProjectId(item.projectId || DEFAULT_CONTENT_PROJECT_ID) === normalizeContentProjectId(projectId);
    const matchesPatch = patchVersion && cleanText(item.patchVersion) === patchVersion;
    const matchesCategory = !category || item.category === category;
    if (!matchesProject || (!matchesId && !(matchesPatch && matchesCategory))) return item;
    const nextItem = {
      ...item,
      ...buildRepublishResetPatch(now, options.reason),
    };
    resetItems.push(nextItem);
    return nextItem;
  });

  if (resetItems.length > 0) {
    database.items = sortPatchItems(database.items);
    writeDatabase(database);
  }

  return { updated: resetItems.length, items: resetItems };
}

function updatePatchItem(id, patch = {}) {
  const database = readDatabase();
  const index = database.items.findIndex((item) => item.id === id);
  if (index < 0) return null;
  database.items[index] = {
    ...database.items[index],
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  database.items = sortPatchItems(database.items);
  writeDatabase(database);
  return database.items.find((item) => item.id === id);
}

module.exports = {
  DATA_DIR,
  DB_PATH,
  QUEUE_PATH,
  CATEGORY_ORDER,
  DEFAULT_CONTENT_PROJECT_ID,
  buildPatchItemsFromScanResult,
  inferPatchVersion,
  readDatabase,
  writeDatabase,
  getPatchItemIdentityKey,
  upsertPatchItems,
  listPatchItems,
  selectPublishCandidates,
  readPublishedQueueTasks,
  taskMatchesPatchItem,
  reconcilePublishedItemsFromQueue,
  resetPatchItemForRepublish,
  resetPatchItemsForRepublish,
  updatePatchItem,
  summarizePatchItems,
  listContentProjects,
};
