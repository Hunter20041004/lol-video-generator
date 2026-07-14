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

const LANE_QUERY = {
  Top: "top",
  Jungle: "jungle",
  Mid: "middle",
  ADC: "bottom",
  Support: "support",
};

const TIER_QUERY = {
  all_ranks: "all",
};

const CHAMPION_SLUG_OVERRIDES = {
  "aurelion sol": "aurelionsol",
  "bel'veth": "belveth",
  "cho'gath": "chogath",
  "dr. mundo": "drmundo",
  "jarvan iv": "jarvaniv",
  "kai'sa": "kaisa",
  "kha'zix": "khazix",
  "kog'maw": "kogmaw",
  "k'sante": "ksante",
  "lee sin": "leesin",
  "master yi": "masteryi",
  "miss fortune": "missfortune",
  "nunu & willump": "nunu",
  "rek'sai": "reksai",
  "renata glasc": "renata",
  "tahm kench": "tahmkench",
  "twisted fate": "twistedfate",
  "vel'koz": "velkoz",
  "wukong": "monkeyking",
  "xin zhao": "xinzhao",
};

const EXCLUDED_CORE_ITEM_NAMES = new Set([
  "control ward",
  "cull",
  "doran's blade",
  "doran's ring",
  "doran's shield",
  "elixir of iron",
  "elixir of sorcery",
  "elixir of wrath",
  "health potion",
  "oracle lens",
  "refillable potion",
  "stealth ward",
]);

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

function sourceUnavailable(error) {
  return {
    sourceStatus: {
      provider: "LoLalytics",
      status: "unavailable",
      error: String(error || "LoLalytics source is unavailable."),
      rowCount: 0,
    },
    rows: [],
  };
}

function buildLolalyticsTierUrl(options = {}) {
  const role = normalizeRole(options.position || options.role || "Mid");
  const rankPreset = String(options.rankPreset || options.tier || "emerald_plus");
  const url = new URL("https://lolalytics.com/lol/tierlist/");
  url.searchParams.set("lane", LANE_QUERY[role] || "middle");
  url.searchParams.set("tier", TIER_QUERY[rankPreset] || rankPreset);

  if (options.patch) {
    url.searchParams.set("patch", String(options.patch));
  }

  const region = String(options.region || "global").toLowerCase();
  if (region && region !== "global") {
    url.searchParams.set("region", region);
  }

  return url.toString();
}

function championSlugForLolalytics(champion = "") {
  const normalized = String(champion || "").trim().toLowerCase();
  return CHAMPION_SLUG_OVERRIDES[normalized] ||
    normalized
      .replace(/&/g, "and")
      .replace(/[^a-z0-9]/g, "");
}

function buildLolalyticsBuildUrl(row = {}, options = {}) {
  const role = normalizeRole(row.lane || row.role || options.position || options.role || "Mid");
  const rankPreset = String(row.tier || row.rankPreset || options.rankPreset || options.tier || "emerald_plus");
  const rawPath = String(row.detailPath || "");
  const path = rawPath.startsWith("/lol/")
    ? rawPath.split("?")[0]
    : `/lol/${championSlugForLolalytics(row.champion || row.name)}/build/`;
  const url = new URL(path, "https://lolalytics.com");
  url.searchParams.set("lane", LANE_QUERY[role] || "middle");
  url.searchParams.set("tier", TIER_QUERY[rankPreset] || rankPreset);

  if (row.patch || options.patch) {
    url.searchParams.set("patch", String(row.patch || options.patch));
  }

  const region = String(row.region || options.region || "global").toLowerCase();
  if (region && region !== "global") {
    url.searchParams.set("region", region);
  }

  return url.toString();
}

function decodeHtmlText(value = "") {
  return String(value)
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function textFromHtml(html = "") {
  return decodeHtmlText(String(html)
    .replace(/<!--[\s\S]*?(?:-->|$)/g, " ")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim());
}

function numbersFromText(text = "") {
  return (String(text).match(/[+-]?\s*\d[\d,]*(?:\.\d+)?/g) || []).map((token) => token.replace(/\s+/g, ""));
}

function sampleSizeFromTokens(tokens = []) {
  return Math.max(number(tokens[5]), number(tokens[6]));
}

function attrValue(tag = "", attr = "") {
  const match = String(tag).match(new RegExp(`\\b${attr}=["']([^"']*)["']`, "i"));
  return match ? decodeHtmlText(match[1]).trim() : "";
}

function statsFromTrailingHtml(html = "") {
  const values = numbersFromText(textFromHtml(html)).map((token) => number(token));
  const winRate = values.find((value) => value > 0 && value <= 100) || 0;
  const sampleSize = Math.max(...values.filter((value) => value >= 100), 0);
  return { winrate: winRate, games: sampleSize };
}

function collectImageOptions(html = "", assetPattern, limit = 6, options = {}) {
  const source = String(html || "");
  const imageMatches = Array.from(source.matchAll(/<img\b[^>]*>/gi));
  const seen = new Set();
  const entries = [];

  for (let index = 0; index < imageMatches.length && entries.length < limit; index += 1) {
    const match = imageMatches[index];
    const tag = match[0];
    const name = attrValue(tag, "alt");
    const normalizedName = name.toLowerCase();
    if (
      !assetPattern.test(tag) ||
      !name ||
      (options.selectedOnly === true && /\bgrayscale\b/i.test(tag)) ||
      /^statmod$/i.test(name) ||
      EXCLUDED_CORE_ITEM_NAMES.has(normalizedName) ||
      seen.has(normalizedName)
    ) {
      continue;
    }

    const nextImageIndex = imageMatches[index + 1]?.index ?? source.length;
    const trailingHtml = source.slice(match.index + tag.length, Math.min(nextImageIndex, match.index + tag.length + 900));
    seen.add(normalizedName);
    entries.push({
      name,
      ...statsFromTrailingHtml(trailingHtml),
    });
  }

  return entries;
}

function extractLolalyticsBuildDetailsFromHtml(html = "") {
  const source = String(html || "");
  return {
    builds: collectImageOptions(source, /(?:\/|%2F)item(?:64|\/|[0-9])/i, 6),
    runes: collectImageOptions(source, /(?:runes?|perk-images|perk)/i, 6, { selectedOnly: true }),
  };
}

function extractLolalyticsRowsFromHtml(html = "", options = {}) {
  const source = String(html || "");
  const rowStarts = Array.from(source.matchAll(/<a\s+href=["'](\/lol\/([^"'\/]+)\/build\/(?:\?[^"']*)?)["'][^>]*>[\s\S]*?<\/a>/gi))
    .map((match) => {
      const altMatch = match[0].match(/<img[^>]+alt=["']([^"']+)["']/i);
      return {
        index: match.index,
        detailPath: decodeHtmlText(match[1]),
        champion: altMatch ? decodeHtmlText(altMatch[1]).trim() : "",
      };
    })
    .filter((match) => match.champion && !/\blane\b/i.test(match.champion));

  return rowStarts.map((match, index) => {
    const next = rowStarts[index + 1];
    const chunk = source.slice(match.index, next ? next.index : undefined);
    const text = textFromHtml(chunk);
    const numericValues = numbersFromText(text);
    const laneMatch = chunk.match(/alt=["'](top|jungle|middle|mid|bottom|bot|adc|support)\s+lane["']/i);
    const winRate = number(numericValues[1]);
    const delta = number(numericValues[2]);

    return {
      champion: match.champion,
      lane: normalizeRole(laneMatch?.[1] || options.position || options.role),
      tier: options.rankPreset || options.tier || "emerald_plus",
      games: sampleSizeFromTokens(numericValues),
      winrate: winRate,
      pickrate: number(numericValues[3]),
      banrate: number(numericValues[4]),
      baselineWinrate: Number((winRate - delta).toFixed(2)),
      primaryLane: normalizeRole(laneMatch?.[1] || options.position || options.role),
      patch: options.patch || "",
      region: options.region || "global",
      detailPath: match.detailPath,
      builds: [],
      runes: [],
      summoners: [],
    };
  }).filter((row) => row.champion && number(row.games) > 0);
}

async function enrichRowsWithLolalyticsBuildDetails(rows = [], options = {}, deps = {}) {
  const fetchImpl = deps.fetchImpl;
  if (deps.fetchDetails === false || typeof fetchImpl !== "function" || rows.length === 0) {
    return rows;
  }

  const detailLimit = Object.hasOwn(deps, "detailLimit")
    ? Math.max(0, number(deps.detailLimit))
    : 12;
  const rowsToFetch = rows.slice(0, detailLimit);
  const enrichedRows = await Promise.all(rowsToFetch.map(async (row) => {
    if ((Array.isArray(row.builds) && row.builds.length > 0) || (Array.isArray(row.runes) && row.runes.length > 0)) {
      return row;
    }

    try {
      const response = await fetchImpl(buildLolalyticsBuildUrl(row, options), {
        headers: {
          accept: "text/html,application/xhtml+xml",
          "user-agent": "lol-video-generator-meta-factory/1.0",
        },
      });

      if (!response?.ok) {
        return row;
      }

      const detailHtml = await response.text();
      const details = extractLolalyticsBuildDetailsFromHtml(detailHtml);
      return {
        ...row,
        builds: details.builds.length > 0 ? details.builds : row.builds,
        runes: details.runes.length > 0 ? details.runes : row.runes,
      };
    } catch {
      return row;
    }
  }));

  return rows.map((row, index) => enrichedRows[index] || row);
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
  if (Object.hasOwn(deps, "rawRows")) {
    return normalizeLolalyticsRows(deps.rawRows, options);
  }

  if (typeof deps.fetchSource === "function") {
    const rawRows = await deps.fetchSource(options);
    return normalizeLolalyticsRows(rawRows, options);
  }

  const fetchImpl = Object.hasOwn(deps, "fetchImpl") ? deps.fetchImpl : globalThis.fetch;
  if (typeof fetchImpl !== "function") {
    return sourceUnavailable("fetch implementation is required.");
  }

  try {
    const response = await fetchImpl(buildLolalyticsTierUrl(options), {
      headers: {
        accept: "text/html,application/xhtml+xml",
        "user-agent": "lol-video-generator-meta-factory/1.0",
      },
    });

    if (!response?.ok) {
      return sourceUnavailable(`LoLalytics responded with HTTP ${response?.status || "unknown"}.`);
    }

    const html = await response.text();
    const rows = extractLolalyticsRowsFromHtml(html, options);
    const enrichedRows = await enrichRowsWithLolalyticsBuildDetails(rows, options, { ...deps, fetchImpl });
    return normalizeLolalyticsRows(enrichedRows, options);
  } catch (error) {
    return sourceUnavailable(error?.message || error);
  }
}

module.exports = {
  normalizeLolalyticsRows,
  fetchLolalyticsRows,
  normalizeRole,
  buildLolalyticsTierUrl,
  buildLolalyticsBuildUrl,
  extractLolalyticsRowsFromHtml,
  extractLolalyticsBuildDetailsFromHtml,
};
