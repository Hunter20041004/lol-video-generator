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

async function importApprovedAsset(entry, options = {}) {
  validateApprovedSource(entry);
  const fetchImpl = options.fetchImpl || fetch;
  const response = await fetchImpl(entry.sourceUrl, { redirect: "follow" });
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
      sourceUrl: response.url || entry.sourceUrl,
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
  importApprovedAsset,
  isRasterImage,
  validateApprovedSource,
  verifyEsportsAssetLibrary,
};
