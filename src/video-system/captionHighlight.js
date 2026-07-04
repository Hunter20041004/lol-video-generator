const TEAM_TAGS = ["T1", "TL", "KC", "GEN", "G2", "BLG", "JDG", "TES", "HLE", "DK", "KT", "CFO", "PSG"];
const KEYWORD_PATTERN = /^(增強|削弱|重塑|調整|核心|實戰|排位)/;
const TEAM_PATTERN = new RegExp(`^(${TEAM_TAGS.map((tag) => tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})(?![A-Za-z0-9])`, "i");
const STANDALONE_NUMBER_PATTERN = /^[0-9]+(?:\.[0-9]+)*(?:[KkMm%])?/;

const isNumberTokenBoundary = (value = "") => /^[A-Za-z0-9.]$/.test(value);

const shouldHighlightStandaloneNumber = (text, index, value) => {
  const previous = text[index - 1] || "";
  const next = text[index + value.length] || "";
  return !isNumberTokenBoundary(previous) && !isNumberTokenBoundary(next);
};

const pushSegment = (segments, text, highlighted) => {
  if (!text) return;
  const last = segments[segments.length - 1];
  if (last && last.highlighted === highlighted) {
    last.text += text;
    return;
  }
  segments.push({ text, highlighted });
};

export const splitCaptionHighlightSegments = (text = "") => {
  const source = String(text || "");
  const segments = [];
  let index = 0;

  while (index < source.length) {
    const rest = source.slice(index);
    const teamMatch = rest.match(TEAM_PATTERN);
    if (teamMatch) {
      pushSegment(segments, teamMatch[0], true);
      index += teamMatch[0].length;
      continue;
    }

    const keywordMatch = rest.match(KEYWORD_PATTERN);
    if (keywordMatch) {
      pushSegment(segments, keywordMatch[0], true);
      index += keywordMatch[0].length;
      continue;
    }

    const numberMatch = rest.match(STANDALONE_NUMBER_PATTERN);
    if (numberMatch && shouldHighlightStandaloneNumber(source, index, numberMatch[0])) {
      pushSegment(segments, numberMatch[0], true);
      index += numberMatch[0].length;
      continue;
    }

    pushSegment(segments, source[index], false);
    index += 1;
  }

  return segments;
};
