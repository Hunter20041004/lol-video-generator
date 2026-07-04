const RAW_ERROR_PATTERNS = [
  /GoogleGenerativeAI|Internal Server Error|generateContent|Data Parsing Failed/i,
  /Returned payload|Invalid Analysis Payload|Invalid .* Payload/i,
  /```|<thinking>|<\/?[a-z][^>]*>/i,
];

const RAW_DATA_KEYS = [
  "dataType",
  "storyboard",
  "statChanges",
  "metricName",
  "beforeValue",
  "afterValue",
  "championName",
  "targetName",
  "synergyImpact",
];

export const normalizeDisplayText = (value, { preserveNewlines = false } = {}) => {
  const text = Array.isArray(value) ? value.join(" / ") : String(value ?? "");
  const cleaned = text
    .replace(/\r/g, "\n")
    .replace(/\s*\n\s*([？。，！?!,.；：、）」』])/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();

  if (preserveNewlines) {
    return cleaned
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .join("\n");
  }

  return cleaned.replace(/\s*\n\s*/g, " ").trim();
};

export const isRawDataBlob = (value) => {
  if (value === null || value === undefined) return false;
  if (typeof value === "object") return true;

  const text = normalizeDisplayText(value, { preserveNewlines: true });
  if (!text) return false;
  if (RAW_ERROR_PATTERNS.some((pattern) => pattern.test(text))) return true;

  const compact = text.replace(/\s/g, "");
  if (/^[{\[]/.test(compact) && /["']?[a-zA-Z0-9_]+["']?:/.test(compact)) return true;

  const keyHits = RAW_DATA_KEYS.reduce((sum, key) => sum + (text.includes(key) ? 1 : 0), 0);
  const symbolHits = (text.match(/[{}[\]"`=<>]/g) || []).length;
  const arrowHits = (text.match(/=>|->|::/g) || []).length;

  return (
    (text.length > 180 && keyHits >= 2) ||
    (text.length > 140 && symbolHits >= 18) ||
    (text.length > 120 && arrowHits >= 3)
  );
};

export const safeDisplayText = (value, fallback = "", options = {}) => {
  const {
    maxChars = 40,
    preserveNewlines = false,
    maxLines = 2,
    ellipsis = "...",
  } = options;

  if (isRawDataBlob(value)) return fallback;

  let text = normalizeDisplayText(value, { preserveNewlines });
  if (!text) return fallback;

  if (preserveNewlines) {
    text = text
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, maxLines)
      .join("\n");
  }

  if (text.length > maxChars) {
    const suffix = ellipsis && maxChars > ellipsis.length ? ellipsis : "";
    text = `${text.slice(0, Math.max(1, maxChars - suffix.length)).trimEnd()}${suffix}`;
  }

  return text || fallback;
};

export const safeDisplayList = (items, fallback = [], options = {}) => {
  if (!Array.isArray(items)) return fallback;
  const { maxItems = 3, maxChars = 16 } = options;
  const list = items
    .map((item) => safeDisplayText(item, "", { maxChars }))
    .filter(Boolean)
    .slice(0, maxItems);
  return list.length > 0 ? list : fallback;
};
