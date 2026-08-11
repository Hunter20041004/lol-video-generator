function findNextPatchSection(value, startIndex) {
  let marker = value.indexOf("【", startIndex);
  while (marker >= 0) {
    let cursor = marker - 1;
    let newlineCount = 0;
    while (cursor >= 0 && value[cursor] === "\n") {
      newlineCount += 1;
      cursor -= 1;
    }
    if (newlineCount >= 2) return marker;
    marker = value.indexOf("【", marker + 1);
  }
  return -1;
}

function inferSkillKey(ability = "") {
  const text = String(ability || "").toUpperCase();
  if (text.includes("PASSIVE") || text.includes("被動")) return "P";
  const match = text.match(/\b([QWER])\b|(^|[^A-Z])([QWER])([^A-Z]|$)/);
  return match?.[1] || match?.[3] || "BASE";
}

function inferVisualAssetSkillLetter(ability = "") {
  const skillKey = inferSkillKey(ability);
  return skillKey === "BASE" ? "Q" : skillKey;
}

function getPatchSectionLabel(section = {}, locale = "zh") {
  const skillKey = section.skillKey || inferSkillKey(section.ability);
  const ability = String(section.ability || "").trim();
  if (skillKey === "BASE" && ability && ability.toUpperCase() !== "BASE") return ability;

  const labels = String(locale).toLowerCase().startsWith("en")
    ? { P: "Passive", Q: "Q Ability", W: "W Ability", E: "E Ability", R: "Ultimate", BASE: "Base Stats" }
    : { P: "被動", Q: "Q 技能", W: "W 技能", E: "E 技能", R: "R 大絕", BASE: "基礎數值" };
  return labels[skillKey] || (String(locale).toLowerCase().startsWith("en") ? `${skillKey} Ability` : `${skillKey} 技能`);
}

function requiresNamedSectionRepair(sections = []) {
  const genericBaseLabels = new Set(["BASE", "BASE STATS", "基礎數值", "基礎屬性"]);
  return sections.some((section) => (
    section?.skillKey === "BASE" &&
    !genericBaseLabels.has(String(section.ability || "").trim().toUpperCase())
  ));
}

function splitPatchChangeSections(input = {}) {
  const changeDesc = String(input.changeDesc || input.statChange || "").trim();
  if (!changeDesc) return [];

  const sections = [];
  let marker = changeDesc.indexOf("【");
  while (marker >= 0 && sections.length < 4) {
    const close = changeDesc.indexOf("】", marker + 1);
    if (close < 0) break;

    let separator = close + 1;
    while (changeDesc[separator] === " " || changeDesc[separator] === "\t") separator += 1;

    let descStart;
    if (changeDesc[separator] === ":" || changeDesc[separator] === "：") {
      descStart = separator + 1;
    } else if (changeDesc[separator] === "\n") {
      descStart = separator;
    } else {
      marker = changeDesc.indexOf("【", close + 1);
      continue;
    }

    const nextMarker = findNextPatchSection(changeDesc, descStart);
    const ability = changeDesc.slice(marker + 1, close).trim();
    const desc = changeDesc.slice(descStart, nextMarker < 0 ? changeDesc.length : nextMarker).trim();
    if (ability && desc) {
      sections.push({
        ability,
        skillKey: inferSkillKey(ability),
        changeDesc: desc,
      });
    }
    marker = nextMarker;
  }

  if (sections.length === 0 && changeDesc) {
    const ability = input.ability || input.skill || "BASE";
    sections.push({
      ability,
      skillKey: inferSkillKey(ability),
      changeDesc,
    });
  }

  return sections;
}

module.exports = {
  getPatchSectionLabel,
  inferSkillKey,
  inferVisualAssetSkillLetter,
  requiresNamedSectionRepair,
  splitPatchChangeSections,
};
