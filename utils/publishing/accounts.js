const PLATFORM_PREFIX = {
  instagram: "INSTAGRAM",
  threads: "THREADS",
};

const normalizeLocale = (locale = "zh") =>
  String(locale || "zh").toLowerCase().startsWith("en") ? "en" : "zh";

const localeSuffix = (locale = "zh") => normalizeLocale(locale).toUpperCase();

const env = (name) => process.env[name] || "";

const firstEnv = (names) => {
  for (const name of names) {
    const value = env(name);
    if (value) return value;
  }
  return "";
};

function getPlatformEnv(platform, locale, key, fallbackNames = []) {
  const prefix = PLATFORM_PREFIX[platform];
  const suffix = localeSuffix(locale);
  const names = prefix
    ? [`${prefix}_${suffix}_${key}`, `${prefix}_${key}`, ...fallbackNames]
    : fallbackNames;
  return firstEnv(names);
}

function getThreadsConfig(locale = "zh") {
  return {
    userId: getPlatformEnv("threads", locale, "USER_ID"),
    accessToken: getPlatformEnv("threads", locale, "ACCESS_TOKEN"),
    allowTextOnly: getPlatformEnv("threads", locale, "ALLOW_TEXT_ONLY", ["THREADS_ALLOW_TEXT_ONLY"]) === "true",
  };
}

function getInstagramConfig(locale = "zh") {
  return {
    userId: getPlatformEnv("instagram", locale, "USER_ID"),
    accessToken: getPlatformEnv("instagram", locale, "ACCESS_TOKEN"),
  };
}

function getPublicVideoUrl(videoUrl = "") {
  if (/^https?:\/\//i.test(videoUrl)) return videoUrl;
  const base = process.env.PUBLIC_MEDIA_BASE_URL || process.env.NEXT_PUBLIC_MEDIA_BASE_URL || "";
  if (!base || !videoUrl) return "";
  return `${base.replace(/\/$/, "")}/${String(videoUrl).replace(/^\//, "")}`;
}

module.exports = {
  normalizeLocale,
  localeSuffix,
  getPlatformEnv,
  getThreadsConfig,
  getInstagramConfig,
  getPublicVideoUrl,
};
