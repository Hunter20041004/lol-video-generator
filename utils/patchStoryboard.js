const SKILL_LABELS_ZH = {
  P: "被動",
  Q: "Q 技能",
  W: "W 技能",
  E: "E 技能",
  R: "R 大絕",
  BASE: "基礎數值",
};

const SKILL_LABELS_EN = {
  P: "Passive",
  Q: "Q Ability",
  W: "W Ability",
  E: "E Ability",
  R: "Ultimate",
  BASE: "Base Stats",
};

const SKILL_SCENE_TAGS = new Set(["SKILL_SHOWCASE", "STAT_REVEAL"]);

function isEnglishLocale(locale = "zh") {
  return String(locale || "zh").toLowerCase().startsWith("en");
}

function skillLabel(skillKey = "BASE", locale = "zh") {
  const normalized = String(skillKey || "BASE").toUpperCase();
  const labels = isEnglishLocale(locale) ? SKILL_LABELS_EN : SKILL_LABELS_ZH;
  return labels[normalized] || (isEnglishLocale(locale) ? `${normalized} Ability` : `${normalized} 技能`);
}

function compactText(value = "", maxLength = 36) {
  const cleaned = String(value || "").replace(/\s+/g, " ").trim();
  if (!cleaned) return "";
  return cleaned.length > maxLength ? `${cleaned.slice(0, maxLength)}…` : cleaned;
}

function chunkArray(items, size) {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function chunkDenseSkillMetrics(metrics = []) {
  if (!Array.isArray(metrics) || metrics.length <= 3) return [metrics];
  if (metrics.length % 2 === 1) {
    return [metrics.slice(0, 3), ...chunkArray(metrics.slice(3), 2)];
  }
  return chunkArray(metrics, 2);
}

function aggregateTrend(metrics = [], fallback = "ADJUST") {
  const buffCount = metrics.filter((metric) => metric?.trend === "BUFF").length;
  const nerfCount = metrics.filter((metric) => metric?.trend === "NERF").length;
  if (buffCount > 0 && nerfCount > 0) return "ADJUST";
  if (buffCount > nerfCount) return "BUFF";
  if (nerfCount > buffCount) return "NERF";
  return fallback || "ADJUST";
}

function metricNames(metrics = []) {
  return metrics
    .map((metric) => String(metric?.metricName || metric?.statLabel || "").trim())
    .filter(Boolean);
}

function metricBullet(metric = {}, locale = "zh") {
  const name = String(metric.metricName || metric.statLabel || (isEnglishLocale(locale) ? "Change" : "改動")).trim();
  const before = metric.beforeValue ?? "";
  const after = metric.afterValue ?? "";
  if (before !== "" || after !== "") return `${name}: ${before} → ${after}`;
  return name;
}

function buildSegmentText(scene = {}, metrics = [], index = 0, total = 1, locale = "zh") {
  const label = skillLabel(scene.skillKey, locale);
  const names = metricNames(metrics);
  if (isEnglishLocale(locale)) {
    const focus = compactText(names.join(" / ") || "Core stats", 30);
    const prefix = index === 0 ? "First" : "Next";
    return `${label} changes ${index + 1}/${total}\n${prefix}: ${focus}`;
  }

  const focus = compactText(names.join("、") || "核心數值", 18);
  const prefix = index === 0 ? "先看" : "再看";
  return `${label}改動 ${index + 1}/${total}\n${prefix}${focus}`;
}

function buildSegmentImpactText(scene = {}, metrics = [], locale = "zh") {
  const joinedSummary = metrics
    .map((metric) => compactText(metric?.summary || metric?.impactText || "", isEnglishLocale(locale) ? 44 : 24))
    .filter(Boolean)
    .join(isEnglishLocale(locale) ? " " : " ");

  return compactText(
    joinedSummary || scene.impactText || scene.combatTranslation || scene.summary || "",
    isEnglishLocale(locale) ? 82 : 46
  );
}

function splitDenseSkillScenes(storyboard = [], options = {}) {
  const locale = options.locale || "zh";
  if (!Array.isArray(storyboard)) return [];

  return storyboard.flatMap((scene) => {
    const metrics = Array.isArray(scene?.metrics) ? scene.metrics.filter(Boolean) : [];
    if (!scene || !SKILL_SCENE_TAGS.has(scene.tag)) return [scene];

    const chunks = chunkDenseSkillMetrics(metrics);
    if (chunks.length <= 1) return [scene];
    const originalBullets = Array.isArray(scene.changeBullets) ? scene.changeBullets : [];
    let offset = 0;

    return chunks.map((chunk, index) => {
      const changeBullets = originalBullets.length >= metrics.length
        ? originalBullets.slice(offset, offset + chunk.length)
        : chunk.map((metric) => metricBullet(metric, locale));
      offset += chunk.length;

      return {
        ...scene,
        tag: "SKILL_SHOWCASE",
        metrics: chunk,
        trend: aggregateTrend(chunk, scene.trend),
        text: buildSegmentText(scene, chunk, index, chunks.length, locale),
        impactText: buildSegmentImpactText(scene, chunk, locale),
        changeBullets,
        partIndex: index + 1,
        partTotal: chunks.length,
        metricSegmentIndex: index + 1,
        metricSegmentCount: chunks.length,
        durationInFrames: scene.durationInFrames || 152,
      };
    });
  });
}

module.exports = {
  splitDenseSkillScenes,
};
