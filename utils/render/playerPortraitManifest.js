const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { resolveDatedEntry } = require("./esportsAssetIdentity");

function normalized(value) {
  return String(value || "").trim().toLowerCase();
}

function readWebpDimensions(bytes) {
  if (bytes.length < 30 || bytes.toString("ascii", 0, 4) !== "RIFF" || bytes.toString("ascii", 8, 12) !== "WEBP") {
    throw new Error("Player portrait must be a valid WebP file.");
  }
  const format = bytes.toString("ascii", 12, 16);
  if (format === "VP8X") {
    return {
      width: bytes.readUIntLE(24, 3) + 1,
      height: bytes.readUIntLE(27, 3) + 1,
    };
  }
  if (format === "VP8 " && bytes.length >= 30) {
    return {
      width: bytes.readUInt16LE(26) & 0x3fff,
      height: bytes.readUInt16LE(28) & 0x3fff,
    };
  }
  if (format === "VP8L" && bytes.length >= 25) {
    const bits = bytes.readUInt32LE(21);
    return {
      width: (bits & 0x3fff) + 1,
      height: ((bits >> 14) & 0x3fff) + 1,
    };
  }
  throw new Error(`Player portrait uses unsupported WebP encoding: ${format || "unknown"}.`);
}

function loadManifest(rootDir) {
  const manifestPath = path.resolve(rootDir, "config/esports-player-portraits.json");
  return JSON.parse(fs.readFileSync(manifestPath, "utf8"));
}

function resolvePlayerPortrait(identity = {}, options = {}) {
  const rootDir = path.resolve(options.rootDir || process.cwd());
  const manifest = options.manifest || loadManifest(rootDir);
  const entries = Array.isArray(manifest.portraits) ? manifest.portraits : [];
  const playerId = normalized(identity.playerId);
  const publicName = normalized(identity.publicName);
  const playerMatches = entries.filter((entry) =>
    (playerId && [entry.playerId, ...(entry.playerIdAliases || [])].map(normalized).includes(playerId))
    || (publicName && [entry.publicName, ...(entry.playerAliases || [])].map(normalized).includes(publicName))
  );
  if (playerMatches.length === 0) {
    throw new Error(`Player portrait not found for ${identity.publicName || identity.playerId || "unknown player"}.`);
  }
  const matchingTeam = playerMatches.some((entry) =>
    [entry.team, ...(entry.teamAliases || [])].map(normalized).includes(normalized(identity.team))
  );
  if (!matchingTeam) {
    throw new Error(`Player portrait team mismatch for ${playerMatches[0].publicName}: expected ${playerMatches.map(({ team }) => team).join(" or ")}, received ${identity.team || "missing"}.`);
  }
  const matchingSeason = playerMatches.some((entry) => normalized(entry.season) === normalized(identity.season));
  if (!matchingSeason) {
    throw new Error(`Player portrait season mismatch for ${playerMatches[0].publicName}: expected ${playerMatches.map(({ season }) => season).join(" or ")}, received ${identity.season || "missing"}.`);
  }
  const entry = resolveDatedEntry(entries, identity, { kind: "Player portrait" });

  const portraitRoot = path.resolve(rootDir, "public/player-portraits");
  const filePath = path.resolve(rootDir, String(entry.repositoryPath || ""));
  const relativePath = path.relative(portraitRoot, filePath);
  if (!relativePath || relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new Error(`Player portrait path escapes public/player-portraits for ${entry.publicName}.`);
  }
  const stat = fs.statSync(filePath);
  if (!stat.isFile()) {
    throw new Error(`Player portrait is not a regular file for ${entry.publicName}.`);
  }

  const bytes = fs.readFileSync(filePath);
  const sha256 = crypto.createHash("sha256").update(bytes).digest("hex");
  if (sha256 !== entry.sha256) {
    throw new Error(`Player portrait SHA-256 mismatch for ${entry.publicName}.`);
  }
  const dimensions = readWebpDimensions(bytes);
  if (dimensions.width !== Number(entry.width) || dimensions.height !== Number(entry.height)) {
    throw new Error(`Player portrait dimensions mismatch for ${entry.publicName}.`);
  }

  return {
    playerId: entry.playerId,
    publicName: entry.publicName,
    team: entry.team,
    season: entry.season,
    validFrom: entry.validFrom,
    validTo: entry.validTo,
    sourceUrl: entry.sourceUrl,
    licenseNote: entry.licenseNote,
    sha256,
    width: dimensions.width,
    height: dimensions.height,
    publicPath: `/${path.relative(path.resolve(rootDir, "public"), filePath).split(path.sep).join("/")}`,
  };
}

module.exports = {
  readWebpDimensions,
  resolvePlayerPortrait,
};
