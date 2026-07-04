const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildChampionFallbackPayload,
  buildItemRunePayload,
  buildSystemPayload,
  filterStatChanges,
  localizeStatChange,
  buildVerdict,
  buildSynergy,
} = require("../../../utils/contentFactory/payloadBuilder");

test("filterStatChanges removes unchanged values and localizes core stat labels", () => {
  const stats = filterStatChanges([
    { metricName: "Move Speed", beforeValue: "40%", afterValue: "48%", trend: "BUFF" },
    { metricName: "Damage Per Tick", beforeValue: "12", afterValue: "12", trend: "ADJUST" },
  ]);

  assert.equal(stats.length, 1);
  assert.equal(stats[0].metricName, "跑速");
});

test("localizeStatChange keeps English payloads English", () => {
  const stat = localizeStatChange({
    metricName: "攻擊速度",
    beforeValue: "30%",
    afterValue: "36%",
    trend: "BUFF",
  }, "en");

  assert.equal(stat.metricName, "攻擊速度");
  assert.match(stat.summary, /Retest|Changes|value|priority/i);
});

test("localizeStatChange covers zh metric inference and missing-value fallbacks", () => {
  assert.equal(localizeStatChange({ metricName: "Melee Move Speed", beforeValue: 1, afterValue: 2 }).metricName, "跑速（近戰）");
  assert.equal(localizeStatChange({ metricName: "Ranged Move Speed", beforeValue: 1, afterValue: 2 }).metricName, "跑速（遠程）");
  assert.equal(localizeStatChange({ metricName: "Move Speed Duration", beforeValue: 1, afterValue: 2 }).metricName, "持續時間");
  assert.equal(localizeStatChange({ metricName: "Attack Speed", beforeValue: 1, afterValue: 2 }).metricName, "攻擊速度");
  assert.equal(localizeStatChange({ metricName: "Attack Damage", beforeValue: 1, afterValue: 2 }).metricName, "攻擊力");
  assert.equal(localizeStatChange({ metricName: "Total Cost", beforeValue: 1, afterValue: 2 }).metricName, "總價格");
  assert.equal(localizeStatChange({ metricName: "Ability Haste", beforeValue: 1, afterValue: 2 }).metricName, "技能加速");

  const missingBuff = localizeStatChange({ beforeValue: 1, afterValue: 2, trend: "BUFF" });
  const missingNerf = localizeStatChange({ beforeValue: 2, afterValue: 1, trend: "NERF" });
  assert.equal(missingBuff.metricName, "核心數值");
  assert.match(missingBuff.summary, /優先級/);
  assert.match(missingNerf.summary, /重估/);
});

test("localizeStatChange removes English mechanism text from zh item payloads", () => {
  const stat = localizeStatChange({
    metricName: "Frostfire Tempest",
    beforeValue: "Triggers on Ult cast",
    afterValue: "Readies on Ult cast for the next 5 seconds, triggering the moment an enemy champion gets within the range or after 5 seconds",
    trend: "ADJUST",
  }, "zh");

  assert.equal(stat.metricName, "霜火風暴");
  assert.equal(stat.beforeValue, "大絕施放觸發");
  assert.equal(stat.afterValue, "大絕後預備5秒");
});

test("filterStatChanges drops missing values and limits to the top three changed stats", () => {
  const stats = filterStatChanges([
    { metricName: "Missing Before", afterValue: "2", trend: "BUFF" },
    { metricName: "Missing After", beforeValue: "1", trend: "NERF" },
    { metricName: "Attack Damage", beforeValue: "1", afterValue: "2", trend: "BUFF" },
    { metricName: "Attack Speed", beforeValue: "3", afterValue: "4", trend: "BUFF" },
    { metricName: "Total Cost", beforeValue: "900", afterValue: "1000", trend: "NERF" },
    { metricName: "Move Speed", beforeValue: "10", afterValue: "12", trend: "BUFF" },
  ]);

  assert.deepEqual(stats.map((stat) => stat.metricName), ["攻擊力", "攻擊速度", "總價格"]);
});

test("buildItemRunePayload creates bilingual-ready rune payload with actionable verdict", () => {
  const item = {
    category: "RUNE",
    targetName: "Stormsurge",
    localizedName: "風暴浪湧",
    changeType: "BUFF",
    payload: {
      iconUrl: "https://example.com/rune.png",
      statChanges: [
        { metricName: "Move Speed", beforeValue: "40%", afterValue: "48%", trend: "BUFF" },
      ],
    },
  };

  const payload = buildItemRunePayload(item, "zh");

  assert.equal(payload.dataType, "RUNE_UPDATE");
  assert.equal(payload.targetType, "RUNE");
  assert.equal(payload.localizedName, "風暴浪湧");
  assert.equal(payload.statChanges[0].metricName, "跑速");
  assert.match(payload.actionableVerdict.body, /跑圖|支援|拉扯|節奏/);
  assert.equal(payload.storyboard.length, 4);
});

test("buildSystemPayload creates system update payloads with practical impact", () => {
  const item = {
    category: "SYSTEM",
    targetName: "Mid Role Quest",
    localizedName: "中路任務",
    changeType: "BUFF",
    payload: {
      targetName: "Mid Role Quest",
      localizedName: "中路任務",
      sectionTitle: "Role Quest Adjustments",
      statChanges: [
        { metricName: "Bonus AD and AP", beforeValue: "6%", afterValue: "8%", trend: "BUFF" },
      ],
      changeDesc: "Bonus AD and AP: 6% ⇒ 8%",
    },
  };

  const zh = buildSystemPayload(item, "zh");
  const en = buildSystemPayload(item, "en");

  assert.equal(zh.dataType, "SYSTEM_UPDATE");
  assert.equal(zh.targetType, "SYSTEM");
  assert.equal(zh.localizedName, "中路任務");
  assert.match(zh.actionableVerdict.body, /中路|任務|節奏/);
  assert.equal(zh.storyboard[1].skillKey, "SYS");
  assert.equal(en.localizedName, "Mid Role Quest");
  assert.match(en.actionableVerdict.body, /Mid lane|quest/i);
});

test("buildVerdict uses item language for item timing and rune language for rune priority", () => {
  const itemVerdict = buildVerdict("NERF", "ITEM", [{ metricName: "總價格", summary: "價格上修" }], "zh");
  const runeVerdict = buildVerdict("BUFF", "RUNE", [{ metricName: "跑速", summary: "跑速上修" }], "zh");

  assert.match(itemVerdict.body, /成裝|首件/);
  assert.match(runeVerdict.body, /符文|支援|拉扯/);
});

test("buildVerdict covers English cost, speed, damage, and default branches", () => {
  assert.match(
    buildVerdict("NERF", "ITEM", [{ metricName: "Total Cost", summary: "cost up" }], "en").body,
    /timing/
  );
  assert.match(
    buildVerdict("BUFF", "RUNE", [{ metricName: "Move Speed", summary: "speed up" }], "en").body,
    /Mobility/
  );
  assert.match(
    buildVerdict("BUFF", "ITEM", [{ metricName: "Attack Damage", summary: "damage up" }], "en").body,
    /Damage tempo/
  );
  assert.match(
    buildVerdict("NERF", "RUNE", [{ metricName: "Utility", summary: "utility down" }], "en").body,
    /autopilot|replacement/
  );
  assert.deepEqual(
    buildVerdict("BUFF", "RUNE", [{ metricName: "Cost", summary: "cost changed" }], "en").chips,
    ["Rune timing", "Retest setup", "Avoid autopilot"]
  );
});

test("buildVerdict covers zh damage and generic branches", () => {
  assert.match(
    buildVerdict("BUFF", "ITEM", [{ metricName: "攻擊力", summary: "傷害上修" }], "zh").body,
    /傷害曲線|all-in/
  );
  assert.match(
    buildVerdict("BUFF", "ITEM", [{ metricName: "視野", summary: "功能上修" }], "zh").body,
    /補強數值/
  );
  assert.match(
    buildVerdict("NERF", "ITEM", [{ metricName: "視野", summary: "功能下修" }], "zh").body,
    /核心數值/
  );
});

test("buildSynergy changes affected champion explanation based on stat category", () => {
  const synergy = buildSynergy({}, [{ metricName: "跑速", summary: "跑速上修" }], "zh");

  assert.deepEqual(synergy.champions, ["Hecarim", "Udyr", "Singed"]);
  assert.match(synergy.impactDescription, /跑圖|追擊|拉扯/);

  const englishSpeed = buildSynergy({}, [{ metricName: "Move Speed", summary: "buff" }], "en");
  assert.deepEqual(englishSpeed.champions, ["Hecarim", "Udyr", "Singed"]);
  assert.match(englishSpeed.impactDescription, /roam speed/);
});

test("buildSynergy respects provided payload and covers attack-speed and fallback logic", () => {
  const provided = buildSynergy({
    synergyImpact: {
      champions: ["Quinn"],
      impactDescription: "Provided impact.",
    },
  }, [], "zh");
  assert.deepEqual(provided.champions, ["Quinn"]);

  const attackSpeed = buildSynergy({}, [{ metricName: "Attack Speed", summary: "buff" }], "en");
  assert.deepEqual(attackSpeed.champions, ["Yasuo", "Yone", "Master Yi"]);
  assert.match(attackSpeed.impactDescription, /Auto-attack/);

  const fallback = buildSynergy({}, [{ metricName: "Utility", summary: "adjust" }], "en");
  assert.deepEqual(fallback.champions, []);
  assert.match(fallback.impactDescription, /avoid forcing/);
});

test("buildSynergy uses engage supports for Zeke's Convergence instead of marksman fallbacks", () => {
  const zeke = buildSynergy({
    targetName: "Zeke’s Convergence",
    localizedName: "錫柯的聚合之力",
  }, [
    {
      metricName: "霜火風暴",
      beforeValue: "大絕施放觸發",
      afterValue: "大絕後預備5秒",
      trend: "ADJUST",
    },
  ], "zh");

  assert.deepEqual(zeke.champions, ["Leona", "Nautilus", "Rell"]);
  assert.match(zeke.impactDescription, /坦輔/);
  assert.notDeepEqual(zeke.champions, ["Ezreal", "Vayne", "Kai'Sa"]);
});

test("buildItemRunePayload creates English item payloads without Chinese labels", () => {
  const item = {
    category: "ITEM",
    targetName: "海妖殺手",
    localizedName: "海妖殺手",
    changeType: "NERF",
    payload: {
      statChanges: [
        { metricName: "Attack Speed", beforeValue: "35%", afterValue: "30%", trend: "NERF" },
      ],
    },
  };

  const payload = buildItemRunePayload(item, "en");

  assert.equal(payload.dataType, "ITEM_UPDATE");
  assert.equal(payload.targetType, "ITEM");
  assert.equal(payload.targetName, "Kraken Slayer");
  assert.equal(payload.localizedName, "Kraken Slayer");
  assert.match(payload.storyboard[0].text, /Kraken Slayer patch update/);
});

test("buildItemRunePayload handles rework trends, icon passthrough, and fallback target names", () => {
  const payload = buildItemRunePayload({
    category: "MISC",
    localizedName: "未知裝備",
    changeType: "REWORK",
    payload: {
      iconUrl: "https://example.com/icon.png",
      statChanges: [
        { metricName: "Ability Haste", beforeValue: "10", afterValue: "15", trend: "BUFF" },
      ],
    },
  }, "zh");

  assert.equal(payload.dataType, "ITEM_UPDATE");
  assert.equal(payload.targetType, "ITEM");
  assert.equal(payload.targetName, undefined);
  assert.equal(payload.localizedName, "未知裝備");
  assert.equal(payload.iconUrl, "https://example.com/icon.png");
  assert.equal(payload.trend, "ADJUST");
});

test("buildChampionFallbackPayload creates deterministic zh and en patch payloads", async () => {
  const item = {
    category: "CHAMPION",
    targetName: "Quinn",
    changeType: "BUFF",
    payload: {
      championName: "Quinn",
      ability: "Q, R",
      changeDesc: "Q damage increased.",
    },
  };

  const en = await buildChampionFallbackPayload(item, "en");
  assert.equal(en.championName, "Quinn");
  assert.match(en.storyboard[0].text, /Quinn patch update/);

  const zh = await buildChampionFallbackPayload(item, "zh");
  assert.equal(zh.dataType, "PATCH");
  assert.equal(zh.changeType, "BUFF");
  assert.match(zh.storyboard[1].text, /改動數字/);
});
