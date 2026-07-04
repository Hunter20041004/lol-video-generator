const assert = require("node:assert/strict");
const test = require("node:test");

const { splitDenseSkillScenes } = require("../../utils/patchStoryboard");

const metric = (metricName, beforeValue, afterValue, trend = "ADJUST", summary = "") => ({
  metricName,
  beforeValue,
  afterValue,
  trend,
  summary,
});

test("splits one dense skill showcase into sequential two-metric segments", () => {
  const storyboard = [
    { tag: "HOOK", text: "史矛德版本改動\n先看 Q 技能" },
    {
      tag: "SKILL_SHOWCASE",
      skillKey: "Q",
      text: "Q 技能改了哪裡\n這段一定要看懂",
      impactText: "Q 技能混合調整，打法窗口要重測。",
      trend: "ADJUST",
      metrics: [
        metric("基礎攻擊力", 60, 58, "NERF", "基礎攻擊力下修，前期壓力會降低。"),
        metric("傷害", "60 / 75 / 90", "60 / 70 / 80", "NERF", "傷害曲線下修，清線和斬殺線會受影響。"),
        metric("暴擊收益", "50%", "75%", "BUFF", "暴擊收益上修，後期轉化更高。"),
        metric("物理傷害", "10 - 110", "10 - 110", "ADJUST", "物理傷害係數重配，出裝判斷要重看。"),
      ],
    },
    { tag: "CONCLUSION_CTA", text: "先測一場\n再進排位" },
  ];

  const result = splitDenseSkillScenes(storyboard, { locale: "zh" });
  const skillScenes = result.filter((scene) => scene.tag === "SKILL_SHOWCASE");

  assert.equal(skillScenes.length, 2);
  assert.deepEqual(skillScenes.map((scene) => scene.metrics.length), [2, 2]);
  assert.deepEqual(skillScenes.map((scene) => scene.skillKey), ["Q", "Q"]);
  assert.deepEqual(skillScenes.map((scene) => scene.partIndex), [1, 2]);
  assert.deepEqual(skillScenes.map((scene) => scene.partTotal), [2, 2]);
  assert.match(skillScenes[0].text, /Q 技能改動 1\/2/);
  assert.match(skillScenes[1].text, /Q 技能改動 2\/2/);
  assert.match(skillScenes[0].impactText, /基礎攻擊力下修/);
  assert.match(skillScenes[1].impactText, /暴擊收益上修/);
  assert.equal(result[0].tag, "HOOK");
  assert.equal(result.at(-1).tag, "CONCLUSION_CTA");
});

test("keeps one to three metric skill scenes unchanged", () => {
  const compact = {
    tag: "SKILL_SHOWCASE",
    skillKey: "W",
    text: "W 技能改動\n先看冷卻",
    metrics: [
      metric("冷卻時間", 12, 10, "BUFF"),
      metric("魔力消耗", 80, 70, "BUFF"),
      metric("護盾值", 100, 120, "BUFF"),
    ],
  };

  const result = splitDenseSkillScenes([compact], { locale: "zh" });

  assert.equal(result.length, 1);
  assert.equal(result[0], compact);
});

test("splits odd dense skills as three metrics first and pairs after that", () => {
  const result = splitDenseSkillScenes([
    {
      tag: "SKILL_SHOWCASE",
      skillKey: "R",
      text: "Ultimate changed\nCheck the evidence",
      metrics: [
        metric("Damage", 100, 90, "NERF", "Damage decreased, lowering kill pressure."),
        metric("Cooldown", 80, 70, "BUFF", "Cooldown improved, changing fight cadence."),
        metric("Range", 800, 750, "NERF", "Range decreased, forcing tighter spacing."),
        metric("Shield", 200, 220, "BUFF", "Shield increased, improving defensive value."),
        metric("Cast Time", "0.5s", "0.4s", "BUFF", "Cast time improved, making the combo cleaner."),
      ],
    },
  ], { locale: "en" });

  assert.equal(result.length, 2);
  assert.match(result[0].text, /Ultimate changes 1\/2/);
  assert.match(result[1].text, /Ultimate changes 2\/2/);
  assert.deepEqual(result.map((scene) => scene.metrics.length), [3, 2]);
});

test("keeps English three-metric scenes on one readable screen", () => {
  const scene = {
    tag: "SKILL_SHOWCASE",
    skillKey: "R",
    text: "Ultimate changed\nCheck the evidence",
    metrics: [
      metric("Damage", 100, 90, "NERF"),
      metric("Cooldown", 80, 70, "BUFF"),
      metric("Range", 800, 750, "NERF"),
    ],
  };

  const result = splitDenseSkillScenes([scene], { locale: "en" });

  assert.equal(result.length, 1);
  assert.equal(result[0], scene);
});

test("preserves explicit change bullets while splitting STAT_REVEAL scenes", () => {
  const result = splitDenseSkillScenes([
    {
      tag: "STAT_REVEAL",
      skillKey: "BASE",
      trend: "NERF",
      durationInFrames: 180,
      changeBullets: ["基礎血量下修", "基礎物防下修", "成長攻速不變", "基礎魔防下修"],
      metrics: [
        metric("生命值", 600, 580, "NERF"),
        metric("物理防禦", 32, 30, "NERF"),
        metric("攻擊速度", "1", "1", "ADJUST"),
        metric("魔法防禦", 30, 28, "NERF"),
      ],
    },
  ], { locale: "zh", maxMetricsPerScene: 2 });

  assert.equal(result.length, 2);
  assert.equal(result[0].tag, "SKILL_SHOWCASE");
  assert.deepEqual(result[0].changeBullets, ["基礎血量下修", "基礎物防下修"]);
  assert.deepEqual(result[1].changeBullets, ["成長攻速不變", "基礎魔防下修"]);
  assert.equal(result[0].trend, "NERF");
  assert.equal(result[1].trend, "NERF");
  assert.equal(result[0].durationInFrames, 180);
});

test("handles edge inputs and fallback labels without producing crowded scenes", () => {
  assert.deepEqual(splitDenseSkillScenes(null), []);

  const untouched = { tag: "HOOK", text: "版本改動\n先看重點" };
  assert.deepEqual(splitDenseSkillScenes([null, untouched], { locale: "zh" }), [null, untouched]);

  const result = splitDenseSkillScenes([
    {
      tag: "SKILL_SHOWCASE",
      skillKey: "X",
      text: "",
      trend: "",
      combatTranslation: "Unknown ability fallback impact text should still appear.",
      metrics: [
        { statLabel: "Unknown Stat" },
        { metricName: "" },
        { metricName: "Very Long Metric Name That Should Be Compacted For The Segment Header", beforeValue: 1, afterValue: 2, trend: "BUFF" },
        { metricName: "Follow-up Stat", beforeValue: 3, afterValue: 4, trend: "BUFF" },
        { metricName: "Final Stat", beforeValue: 5, afterValue: 6, trend: "BUFF" },
      ],
    },
  ], { locale: "en", maxMetricsPerScene: -4 });

  assert.equal(result.length, 2);
  assert.match(result[0].text, /X Ability changes 1\/2/);
  assert.equal(result[0].changeBullets[0], "Unknown Stat");
  assert.equal(result[0].changeBullets[1], "Change");
  assert.equal(result[1].trend, "BUFF");
  assert.match(result[1].impactText, /Unknown ability fallback impact text/);
});

test("splits seven metric skills as three plus two plus two", () => {
  const result = splitDenseSkillScenes([
    {
      tag: "SKILL_SHOWCASE",
      skillKey: "Q",
      trend: "ADJUST",
      metrics: ["A", "B", "C", "D", "E", "F", "G"].map((name, index) => (
        metric(name, index, index + 1, index % 2 === 0 ? "BUFF" : "NERF")
      )),
    },
  ], { locale: "zh" });

  assert.deepEqual(result.map((scene) => scene.metrics.length), [3, 2, 2]);
  assert.deepEqual(result.map((scene) => scene.partIndex), [1, 2, 3]);
  assert.deepEqual(result.map((scene) => scene.partTotal), [3, 3, 3]);
});
