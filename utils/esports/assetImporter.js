const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const sharp = require("sharp");
const { readWebpDimensions } = require("../render/playerPortraitManifest");
const { readPngDimensions } = require("../render/teamCrestManifest");
const { resolvePlayerPortrait } = require("../render/playerPortraitManifest");
const { resolveTeamCrest } = require("../render/teamCrestManifest");
const { compareInventoryToManifests } = require("./assetInventory");

const SOURCE_KINDS = new Set(["riot", "league", "team", "leaguepedia"]);

function assetSlug(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function approvedFileCandidate(entry = {}) {
  return (entry.candidateSources || []).find((source) =>
    SOURCE_KINDS.has(source.sourceKind) && source.sourcePage && source.sourceUrl
  ) || null;
}

function buildApprovedSourcesFromCoverage(coverage = {}, options = {}) {
  const year = String(options.year || "2026");
  const reviewedAt = String(options.reviewedAt || "");
  const validFrom = `${year}-01-01`;
  const validTo = `${year}-12-31`;
  const records = [];

  for (const team of coverage.missingTeams || []) {
    const source = approvedFileCandidate(team);
    if (!source) continue;
    const stem = `${assetSlug(team.competitionId)}-${assetSlug(team.team)}-crest-${year}`;
    records.push({
      assetId: stem,
      kind: "crest",
      ...source,
      reviewedAt,
      team: team.team,
      teamAliases: [],
      region: team.region,
      season: year,
      validFrom,
      validTo,
      destination: `public/team-crests/${stem}.png`,
      licenseNote: `Human-approved ${year} ${team.competitionId} team identity candidate hosted by Leaguepedia for editorial identification; trademarks remain with ${team.team}.`,
    });
  }

  for (const player of coverage.missingPlayers || []) {
    const source = approvedFileCandidate(player);
    if (!source) continue;
    const stem = `${assetSlug(player.competitionId)}-${assetSlug(player.team)}-${assetSlug(player.playerId)}-portrait-${year}`;
    records.push({
      assetId: stem,
      kind: "portrait",
      ...source,
      reviewedAt,
      playerId: player.playerId,
      publicName: player.publicName,
      playerAliases: [],
      team: player.team,
      teamAliases: [],
      region: player.region,
      season: year,
      validFrom,
      validTo,
      destination: `public/player-portraits/${stem}.webp`,
      licenseNote: `Human-approved ${year} ${player.competitionId} player portrait candidate hosted by Leaguepedia for editorial identification in the project owner's authorized video context.`,
    });
  }
  return records;
}

function requireText(entry, field) {
  if (!String(entry?.[field] || "").trim()) throw new Error(`Approved asset source requires ${field}.`);
}

function validateApprovedSource(entry = {}) {
  for (const field of [
    "assetId", "kind", "sourceKind", "sourcePage", "sourceUrl", "reviewedAt",
    "team", "region", "season", "validFrom", "validTo", "destination", "licenseNote",
  ]) requireText(entry, field);
  if (!SOURCE_KINDS.has(entry.sourceKind)) throw new Error(`Unsupported sourceKind: ${entry.sourceKind}.`);
  for (const field of ["sourcePage", "sourceUrl"]) {
    let url;
    try { url = new URL(entry[field]); } catch { throw new Error(`${field} must be a valid HTTPS URL.`); }
    if (url.protocol !== "https:") throw new Error(`${field} must be a valid HTTPS URL.`);
  }
  if (!/^\d{4}-\d{2}-\d{2}T/.test(entry.reviewedAt)) throw new Error("reviewedAt must be an ISO timestamp.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.validFrom) || !/^\d{4}-\d{2}-\d{2}$/.test(entry.validTo)) {
    throw new Error("validFrom and validTo must use YYYY-MM-DD.");
  }
  const normalizedDestination = path.posix.normalize(String(entry.destination));
  if (normalizedDestination !== entry.destination || normalizedDestination.includes("..")) {
    throw new Error("Approved asset destination must not escape its asset directory.");
  }
  if (entry.kind === "portrait") {
    requireText(entry, "playerId");
    requireText(entry, "publicName");
    if (!normalizedDestination.startsWith("public/player-portraits/") || !normalizedDestination.endsWith(".webp")) {
      throw new Error("Portrait destination must be a WebP file under public/player-portraits/.");
    }
  } else if (entry.kind === "crest") {
    if (!normalizedDestination.startsWith("public/team-crests/") || !normalizedDestination.endsWith(".png")) {
      throw new Error("Crest destination must be a PNG file under public/team-crests/.");
    }
  } else {
    throw new Error(`Unsupported asset kind: ${entry.kind}.`);
  }
  return true;
}

function isRasterImage(bytes, contentType = "") {
  const type = String(contentType || "").split(";")[0].trim().toLowerCase();
  const png = bytes.length >= 8 && bytes.subarray(0, 8).toString("hex") === "89504e470d0a1a0a";
  const jpeg = bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const webp = bytes.length >= 12 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
  return ["image/png", "image/jpeg", "image/webp"].includes(type) && (png || jpeg || webp);
}

function leaguepediaFileName(entry = {}) {
  for (const value of [entry.sourcePage, entry.sourceUrl]) {
    try {
      const url = new URL(String(value || ""));
      const decodedPath = decodeURIComponent(url.pathname);
      const marker = decodedPath.includes("/wiki/File:") ? "/wiki/File:" : "/wiki/Special:Redirect/file/";
      if (decodedPath.includes(marker)) return decodedPath.split(marker)[1];
    } catch {}
  }
  return "";
}

async function resolveLeaguepediaFileUrl(entry, fetchImpl = fetch) {
  const fileName = leaguepediaFileName(entry);
  if (!fileName) throw new Error("Approved Leaguepedia source must identify a File page.");
  const url = new URL("https://lol.fandom.com/api.php");
  for (const [key, value] of Object.entries({
    action: "query",
    format: "json",
    prop: "imageinfo",
    iiprop: "url",
    titles: `File:${fileName}`,
  })) url.searchParams.set(key, value);
  const response = await fetchImpl(url.toString(), {
    headers: {
      Accept: "application/json",
      Referer: "https://lol.fandom.com/",
      "User-Agent": "Mozilla/5.0 (compatible; LoLVideoGenerator/1.0; editorial asset importer)",
    },
  });
  if (!response?.ok) throw new Error(`Leaguepedia file resolution failed with HTTP ${response?.status || "unknown"}.`);
  const json = await response.json();
  const page = Object.values(json?.query?.pages || {})[0];
  const resolved = page?.imageinfo?.[0]?.url;
  let resolvedUrl;
  try { resolvedUrl = new URL(String(resolved || "")); } catch { throw new Error(`Leaguepedia file URL was not found for ${fileName}.`); }
  if (resolvedUrl.protocol !== "https:") throw new Error("Leaguepedia file URL must remain HTTPS.");
  return resolvedUrl.toString();
}

async function importApprovedAsset(entry, options = {}) {
  validateApprovedSource(entry);
  const fetchImpl = options.fetchImpl || fetch;
  const sourceUrl = entry.sourceKind === "leaguepedia" && leaguepediaFileName(entry)
    ? await (options.resolveSourceUrl || resolveLeaguepediaFileUrl)(entry, fetchImpl)
    : entry.sourceUrl;
  const response = await fetchImpl(sourceUrl, {
    redirect: "follow",
    headers: {
      Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
      Referer: entry.sourcePage,
      "User-Agent": "Mozilla/5.0 (compatible; LoLVideoGenerator/1.0; editorial asset importer)",
    },
  });
  if (!response?.ok) throw new Error(`Asset download failed with HTTP ${response?.status || "unknown"}.`);
  if (response.url && new URL(response.url).protocol !== "https:") throw new Error("Asset redirect must remain HTTPS.");
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!isRasterImage(bytes, response.headers?.get?.("content-type"))) {
    throw new Error("Approved source did not return a supported raster image.");
  }
  const rootDir = path.resolve(options.rootDir || process.cwd());
  const destination = path.resolve(rootDir, entry.destination);
  const pipeline = sharp(bytes, { animated: false, failOn: "warning" })
    .rotate()
    .resize({ width: entry.kind === "portrait" ? 900 : 1000, withoutEnlargement: true });
  const output = typeof options.normalizeImage === "function"
    ? await options.normalizeImage({ entry, bytes })
    : entry.kind === "portrait"
      ? await pipeline.webp({ quality: 88, effort: 6, alphaQuality: 100 }).toBuffer()
      : await pipeline.png({ compressionLevel: 9, adaptiveFiltering: true }).toBuffer();
    const dimensions = entry.kind === "portrait" ? readWebpDimensions(output) : readPngDimensions(output);
    if (fs.existsSync(destination)) {
      const existing = fs.readFileSync(destination);
      if (!existing.equals(output)) throw new Error(`Approved asset destination already exists with different bytes: ${entry.destination}.`);
    } else {
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.writeFileSync(destination, output);
    }
  return {
      ...(entry.kind === "portrait" ? {
        playerId: entry.playerId,
        publicName: entry.publicName,
        playerAliases: entry.playerAliases || [],
      } : {}),
      team: entry.team,
      teamAliases: entry.teamAliases || [],
      region: entry.region,
      season: entry.season,
      validFrom: entry.validFrom,
      validTo: entry.validTo,
      sourceUrl: response.url || sourceUrl,
      sourcePage: entry.sourcePage,
      sourceKind: entry.sourceKind,
      licenseNote: entry.licenseNote,
      reviewedAt: entry.reviewedAt,
      sha256: crypto.createHash("sha256").update(output).digest("hex"),
      width: dimensions.width,
      height: dimensions.height,
      repositoryPath: entry.destination,
  };
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function verifyEsportsAssetLibrary(options = {}) {
  const rootDir = path.resolve(options.rootDir || process.cwd());
  const portraitManifest = options.portraitManifest
    || readJson(path.join(rootDir, "config/esports-player-portraits.json"));
  const crestManifest = options.crestManifest
    || readJson(path.join(rootDir, "config/esports-team-crests.json"));
  const portraits = Array.isArray(portraitManifest.portraits) ? portraitManifest.portraits : [];
  const crests = Array.isArray(crestManifest.crests) ? crestManifest.crests : [];

  for (const entry of portraits) {
    resolvePlayerPortrait({
      playerId: entry.playerId,
      publicName: entry.publicName,
      team: entry.team,
      season: entry.season,
      matchDate: entry.validFrom,
    }, { rootDir, manifest: portraitManifest });
  }
  for (const entry of crests) {
    resolveTeamCrest({
      team: entry.team,
      season: entry.season,
      matchDate: entry.validFrom,
    }, { rootDir, manifest: crestManifest });
  }

  const files = [...new Set([...portraits, ...crests].map(({ repositoryPath }) => repositoryPath))]
    .map((repositoryPath) => {
      const filePath = path.resolve(rootDir, repositoryPath);
      const size = fs.statSync(filePath).size;
      return { repositoryPath, size };
    });
  const coverage = options.inventory
    ? compareInventoryToManifests(options.inventory, { portraits, crests })
    : null;
  return {
    asOf: options.asOf || options.inventory?.asOf || new Date().toISOString().slice(0, 10),
    fileCount: files.length,
    totalBytes: files.reduce((sum, { size }) => sum + size, 0),
    largestFileBytes: files.reduce((largest, { size }) => Math.max(largest, size), 0),
    files,
    coverage,
  };
}

module.exports = {
  buildApprovedSourcesFromCoverage,
  importApprovedAsset,
  isRasterImage,
  resolveLeaguepediaFileUrl,
  validateApprovedSource,
  verifyEsportsAssetLibrary,
};
