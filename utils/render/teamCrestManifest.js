const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const repositoryManifest = require("../../config/esports-team-crests.json");
const { resolveDatedEntry } = require("./esportsAssetIdentity");

function normalized(value) {
  return String(value || "").trim().toLowerCase();
}

function readPngDimensions(bytes) {
  const signature = "89504e470d0a1a0a";
  if (bytes.length < 24 || bytes.subarray(0, 8).toString("hex") !== signature || bytes.toString("ascii", 12, 16) !== "IHDR") {
    throw new Error("Team crest must be a valid PNG file.");
  }
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

function resolveTeamCrest(identity = {}, options = {}) {
  const rootDir = path.resolve(/* turbopackIgnore: true */ options.rootDir || process.cwd());
  const manifest = options.manifest || repositoryManifest;
  const entries = Array.isArray(manifest.crests) ? manifest.crests : [];
  const requestedTeam = normalized(identity.team);
  const teamMatches = entries.filter((candidate) =>
    [candidate.team, ...(candidate.teamAliases || [])].map(normalized).includes(requestedTeam)
  );
  if (teamMatches.length === 0) throw new Error(`Team crest not found for ${identity.team || "unknown team"}.`);
  if (!teamMatches.some((entry) => normalized(entry.season) === normalized(identity.season))) {
    throw new Error(`Team crest season mismatch for ${teamMatches[0].team}: expected ${teamMatches.map(({ season }) => season).join(" or ")}, received ${identity.season || "missing"}.`);
  }
  const entry = resolveDatedEntry(entries, identity, { kind: "Team crest" });
  const labelMode = entry.presentation?.labelMode || "external";
  if (!["external", "embedded"].includes(labelMode)) {
    throw new Error(`Team crest label mode is invalid for ${entry.team}: ${labelMode}.`);
  }

  const crestRoot = path.join(rootDir, "public/team-crests");
  const filePath = path.resolve(rootDir, entry.repositoryPath);
  const relativePath = path.relative(crestRoot, filePath);
  if (!relativePath || relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new Error(`Team crest path escapes public/team-crests for ${entry.team}.`);
  }
  const bytes = fs.readFileSync(/* turbopackIgnore: true */ filePath);
  const sha256 = crypto.createHash("sha256").update(bytes).digest("hex");
  if (sha256 !== entry.sha256) throw new Error(`Team crest SHA-256 mismatch for ${entry.team}.`);
  const dimensions = readPngDimensions(bytes);
  if (dimensions.width !== Number(entry.width) || dimensions.height !== Number(entry.height)) {
    throw new Error(`Team crest dimensions mismatch for ${entry.team}.`);
  }

  return {
    team: entry.team,
    season: entry.season,
    validFrom: entry.validFrom,
    validTo: entry.validTo,
    sourceUrl: entry.sourceUrl,
    sourcePage: entry.sourcePage,
    licenseNote: entry.licenseNote,
    sha256,
    width: dimensions.width,
    height: dimensions.height,
    labelMode,
    publicPath: `/${path.relative(path.join(rootDir, "public"), filePath).split(path.sep).join("/")}`,
  };
}

module.exports = { readPngDimensions, resolveTeamCrest };
