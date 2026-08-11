const test = require("node:test");
const assert = require("node:assert/strict");

const {
  getPatchSectionLabel,
  inferVisualAssetSkillLetter,
  requiresNamedSectionRepair,
  splitPatchChangeSections,
} = require("../../utils/patchChangeSections");

test("splitPatchChangeSections preserves newline-delimited named weapon sections", () => {
  const sections = splitPatchChangeSections({
    ability: "Calibrum, Severum, Infernum, Crescendum",
    changeDesc: [
      "【Calibrum】",
      "Passive Mark Damage: 15 ⇒ 20",
      "",
      "【Severum】",
      "Q - Onslaught Damage: 19% ⇒ 20%",
      "",
      "【Infernum】",
      "Q - Duskwave Damage: 10% ⇒ 15%",
      "",
      "【Crescendum】",
      "Q - Sentry Damage: 30% ⇒ 34%",
    ].join("\n"),
  });

  assert.deepEqual(
    sections.map(({ ability, skillKey }) => ({ ability, skillKey })),
    [
      { ability: "Calibrum", skillKey: "BASE" },
      { ability: "Severum", skillKey: "BASE" },
      { ability: "Infernum", skillKey: "BASE" },
      { ability: "Crescendum", skillKey: "BASE" },
    ],
  );
  assert.equal(sections[0].changeDesc, "Passive Mark Damage: 15 ⇒ 20");
  assert.equal(sections[3].changeDesc, "Q - Sentry Damage: 30% ⇒ 34%");
});

test("getPatchSectionLabel displays a named weapon instead of Base Stats", () => {
  const section = { ability: "Calibrum", skillKey: "BASE" };

  assert.equal(getPatchSectionLabel(section, "zh"), "Calibrum");
  assert.equal(getPatchSectionLabel(section, "en"), "Calibrum");
});

test("inferVisualAssetSkillLetter does not read E from inside Aphelios weapon names", () => {
  assert.equal(
    inferVisualAssetSkillLetter("Calibrum, Severum, Infernum, Crescendum"),
    "Q",
  );
  assert.equal(inferVisualAssetSkillLetter("E - Gravitum"), "E");
});

test("requiresNamedSectionRepair forces official weapon labels over same-count AI scenes", () => {
  assert.equal(requiresNamedSectionRepair([
    { ability: "Calibrum", skillKey: "BASE" },
    { ability: "Severum", skillKey: "BASE" },
  ]), true);
  assert.equal(requiresNamedSectionRepair([{ ability: "Base Stats", skillKey: "BASE" }]), false);
  assert.equal(requiresNamedSectionRepair([{ ability: "Q", skillKey: "Q" }]), false);
});
