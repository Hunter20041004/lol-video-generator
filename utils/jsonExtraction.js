function extractBalancedJSON(text = "", priorityKeys = []) {
  const blocks = [];
  let i = 0;
  const source = String(text || "");

  while (i < source.length) {
    if (source[i] !== "{") {
      i += 1;
      continue;
    }

    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let j = i; j < source.length; j += 1) {
      const ch = source[j];

      if (inString) {
        if (escaped) escaped = false;
        else if (ch === "\\") escaped = true;
        else if (ch === "\"") inString = false;
      } else if (ch === "\"") {
        inString = true;
      } else if (ch === "{") {
        depth += 1;
      } else if (ch === "}") {
        depth -= 1;
        if (depth === 0) {
          blocks.push(source.substring(i, j + 1));
          i = j + 1;
          break;
        }
      }

      if (j === source.length - 1) i = source.length;
    }

    if (depth !== 0) break;
  }

  if (blocks.length === 0) return null;

  const keys = priorityKeys.length > 0
    ? priorityKeys
    : ["championName", "storyboard", "dataType", "players", "headline", "targetName", "localizedName"];
  const withKeys = blocks.filter((block) => keys.some((key) => block.includes(`"${key}"`)));
  const candidates = withKeys.length > 0 ? withKeys : blocks;

  return candidates.reduce((longest, block) => (block.length > longest.length ? block : longest));
}

function cleanJSONCandidate(jsonText = "") {
  return String(jsonText || "").replace(/[\u0000-\u001F\u007F-\u009F]/g, "").trim();
}

module.exports = {
  cleanJSONCandidate,
  extractBalancedJSON,
};
