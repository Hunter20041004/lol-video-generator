const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const RENDER_ASSET_PUBLIC_DIR = "/render-assets";
const RENDER_ASSET_FALLBACK_FILE = "missing-image.svg";
const RENDER_ASSET_FALLBACK_PUBLIC_PATH = `${RENDER_ASSET_PUBLIC_DIR}/${RENDER_ASSET_FALLBACK_FILE}`;
const DDRAGON_RENDER_VERSION = process.env.DDRAGON_RENDER_VERSION || "16.9.1";
const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);

const CHAMPION_ID_MAP = {
  "Nunu & Willump": "Nunu",
  Wukong: "MonkeyKing",
  "Renata Glasc": "Renata",
  "Bel'Veth": "Belveth",
  "K'Sante": "KSante",
  "Kai'Sa": "Kaisa",
  "Kha'Zix": "Khazix",
  LeBlanc: "Leblanc",
  "Vel'Koz": "Velkoz",
  "Cho'Gath": "Chogath",
  "Kog'Maw": "KogMaw",
  "Rek'Sai": "RekSai",
  "Master Yi": "MasterYi",
  "Tahm Kench": "TahmKench",
};

const normalizeChampionId = (name) => {
  const raw = String(name || "").trim();
  return CHAMPION_ID_MAP[raw] || raw.replace(/[\s'.]/g, "");
};

const cloneJson = (value) => JSON.parse(JSON.stringify(value || {}));

const getRenderAssetDir = (cwd = process.cwd()) => path.join(cwd, "public", RENDER_ASSET_PUBLIC_DIR.slice(1));

const ensureFallbackAsset = (cwd = process.cwd()) => {
  const assetDir = getRenderAssetDir(cwd);
  fs.mkdirSync(assetDir, { recursive: true });

  const fallbackPath = path.join(assetDir, RENDER_ASSET_FALLBACK_FILE);
  if (!fs.existsSync(fallbackPath)) {
    fs.writeFileSync(fallbackPath, [
      '<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">',
      '<rect width="512" height="512" fill="#07111d"/>',
      '<path d="M80 96h352v320H80z" fill="#0b1f30" stroke="#c8aa6e" stroke-width="16"/>',
      '<path d="M120 350l92-112 64 72 52-56 64 96H120z" fill="#0ac8b9" opacity=".76"/>',
      '<circle cx="344" cy="170" r="34" fill="#f0e6d2"/>',
      '</svg>',
    ].join(""));
  }

  return fallbackPath;
};

const getImageExtension = (url) => {
  try {
    const ext = path.extname(new URL(url).pathname).toLowerCase();
    if (IMAGE_EXTENSIONS.has(ext)) return ext;
  } catch {}
  return "";
};

const isCacheableRemoteImageUrl = (value) => {
  if (typeof value !== "string" || !/^https?:\/\//i.test(value)) return false;
  return Boolean(getImageExtension(value));
};

const addExplicitChampionAssets = (props = {}) => {
  const next = cloneJson(props);
  const championName = next.dataType === "PATCH" ? next.championName : next.champion;
  if (!["PATCH", "META_OFFMETA_PICK"].includes(next.dataType) || !championName) return next;

  const championId = normalizeChampionId(championName);
  if (!championId) return next;

  if (!next.heroIconUrl) {
    next.heroIconUrl = `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_RENDER_VERSION}/img/champion/${championId}.png`;
  }

  if (!next.splashUrl && !next.heroImageUrl) {
    next.splashUrl = `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${championId}_0.jpg`;
  }

  return next;
};

const fetchToBuffer = async (url, fetchImpl) => {
  const response = await fetchImpl(url);
  if (!response || response.ok === false) {
    const status = response?.status ? ` HTTP ${response.status}` : "";
    throw new Error(`Fetch failed.${status}`);
  }
  return Buffer.from(await response.arrayBuffer());
};

const cacheRemoteImageUrl = async (url, {
  cwd = process.cwd(),
  fetchImpl = globalThis.fetch,
  cache = new Map(),
} = {}) => {
  if (cache.has(url)) return cache.get(url);
  if (typeof fetchImpl !== "function") return RENDER_ASSET_FALLBACK_PUBLIC_PATH;

  ensureFallbackAsset(cwd);

  const ext = getImageExtension(url);
  const hash = crypto.createHash("sha256").update(url).digest("hex").slice(0, 24);
  const fileName = `${hash}${ext}`;
  const assetPath = path.join(getRenderAssetDir(cwd), fileName);
  const publicPath = `${RENDER_ASSET_PUBLIC_DIR}/${fileName}`;

  try {
    if (!fs.existsSync(assetPath)) {
      const body = await fetchToBuffer(url, fetchImpl);
      fs.writeFileSync(assetPath, body);
    }
    cache.set(url, publicPath);
    return publicPath;
  } catch (error) {
    console.warn(`⚠️ [Render Assets] Remote image cache failed for ${url}: ${error.message}`);
    cache.set(url, RENDER_ASSET_FALLBACK_PUBLIC_PATH);
    return RENDER_ASSET_FALLBACK_PUBLIC_PATH;
  }
};

async function localizeRemoteImageAssets(value, options = {}) {
  const cwd = options.cwd || process.cwd();
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const cache = new Map();
  const props = addExplicitChampionAssets(value);
  ensureFallbackAsset(cwd);

  const visit = async (node) => {
    if (isCacheableRemoteImageUrl(node)) {
      return cacheRemoteImageUrl(node, { cwd, fetchImpl, cache });
    }

    if (Array.isArray(node)) {
      return Promise.all(node.map((item) => visit(item)));
    }

    if (node && typeof node === "object") {
      const entries = await Promise.all(
        Object.entries(node).map(async ([key, child]) => [key, await visit(child)])
      );
      return Object.fromEntries(entries);
    }

    return node;
  };

  return visit(props);
}

module.exports = {
  RENDER_ASSET_FALLBACK_PUBLIC_PATH,
  addExplicitChampionAssets,
  cacheRemoteImageUrl,
  isCacheableRemoteImageUrl,
  localizeRemoteImageAssets,
  normalizeChampionId,
};
