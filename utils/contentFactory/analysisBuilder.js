const {
  buildChampionFallbackPayload,
  buildItemRunePayload,
  buildSystemPayload,
} = require("./payloadBuilder");

async function defaultAnalyzeFn(origin, payload, locale) {
  const response = await fetch(`${origin}/api/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, locale }),
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok || json.success === false || !json.data) {
    throw new Error(json.error || `Analyze failed for ${locale}`);
  }
  return json.data;
}

async function analyzeChampionItem(origin, item, locale, analyzeFn = defaultAnalyzeFn) {
  try {
    const data = await analyzeFn(origin, item.payload || {}, locale);
    return { ...data, locale, outputLanguage: locale };
  } catch (error) {
    console.warn(`[ContentFactory] Champion analyze failed for ${item.targetName} (${locale}); using fallback: ${error.message}`);
    return buildChampionFallbackPayload(item, locale);
  }
}

function enrichWithItemMetadata(item, payload = {}) {
  return {
    ...payload,
    patchVersion: payload.patchVersion || item.patchVersion || "latest",
    patchUrl: payload.patchUrl || item.patchUrl || "",
    projectId: payload.projectId || item.projectId || "lol",
    projectName: payload.projectName || item.projectName || "英雄聯盟",
    projectDomain: payload.projectDomain || item.projectDomain || "game",
    contentFactoryItemId: payload.contentFactoryItemId || item.id,
  };
}

async function buildLocalizedAnalysis(origin, item, options = {}) {
  const analyzeFn = options.analyzeFn || defaultAnalyzeFn;
  if (!item || !item.id) throw new Error("Valid content factory item is required.");

  if (item.category === "CHAMPION") {
    const [rawZh, rawEn] = await Promise.all([
      analyzeChampionItem(origin, item, "zh", analyzeFn),
      analyzeChampionItem(origin, item, "en", analyzeFn),
    ]);
    const zh = enrichWithItemMetadata(item, rawZh);
    const en = enrichWithItemMetadata(item, rawEn);
    return {
      ...zh,
      localizedPayloads: { zh, en },
    };
  }

  if (item.category === "SYSTEM") {
    const zh = enrichWithItemMetadata(item, buildSystemPayload(item, "zh"));
    const en = enrichWithItemMetadata(item, buildSystemPayload(item, "en"));
    return {
      ...zh,
      localizedPayloads: { zh, en },
    };
  }

  const zh = enrichWithItemMetadata(item, buildItemRunePayload(item, "zh"));
  const en = enrichWithItemMetadata(item, buildItemRunePayload(item, "en"));
  return {
    ...zh,
    localizedPayloads: { zh, en },
  };
}

module.exports = {
  buildLocalizedAnalysis,
  analyzeChampionItem,
  defaultAnalyzeFn,
  enrichWithItemMetadata,
};
