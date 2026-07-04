const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "../../..");

test("buildMetaRenderPayload creates zh/en offmeta payloads from one snapshot candidate", () => {
  const { buildMetaRenderPayload } = require(path.join(ROOT, "utils/metaFactory/candidatePlanner.js"));
  const candidate = {
    kind: "META_OFFMETA_PICK",
    champion: "Velkoz",
    role: "Support",
    offmetaType: "OFFROLE_PICK",
    score: 82,
    confidence: 0.78,
    sourceAgreement: 1,
    sampleSize: 18420,
    riskLabels: ["HIGH_ELO_ONLY"],
    evidence: [{ label: "Win rate", value: 52.8 }],
    recommendedStoryAngle: "Velkoz support has enough data to check.",
    hardBlock: { blocked: false, reasons: [] },
  };

  const zh = buildMetaRenderPayload(candidate, "zh");
  const en = buildMetaRenderPayload(candidate, "en");

  assert.equal(zh.dataType, "META_OFFMETA_PICK");
  assert.equal(en.dataType, "META_OFFMETA_PICK");
  assert.equal(zh.locale, "zh");
  assert.equal(en.locale, "en");
  assert.equal(zh.champion, "Velkoz");
  assert.equal(zh.storyboard.length >= 4, true);
  assert.equal(en.storyboard.some((scene) => scene.text.includes("Velkoz")), true);
});

test("buildMetaRenderPayload creates player-facing zh offmeta build payload with core gameplay details", () => {
  const { buildMetaRenderPayload } = require(path.join(ROOT, "utils/metaFactory/candidatePlanner.js"));
  const candidate = {
    kind: "META_OFFMETA_PICK",
    champion: "Sona",
    role: "Support",
    offmetaType: "OFFMETA_BUILD",
    patch: "16.12",
    region: "kr",
    rankPreset: "emerald_plus",
    score: 78.5,
    confidence: 1,
    sourceAgreement: 1,
    sampleSize: 32000,
    coreItems: [{ name: "Bloodsong", winRate: 56.4, sampleSize: 4200 }],
    coreRunes: [{ name: "Summon Aery", winRate: 54.8, sampleSize: 6800 }],
    riskLabels: ["LOW_PICK_RATE"],
    evidence: [{ label: "Win rate", value: 55 }, { label: "Pick rate", value: 1.3 }],
    hardBlock: { blocked: false, reasons: [] },
  };

  const zh = buildMetaRenderPayload(candidate, "zh");
  const serialized = JSON.stringify(zh);

  assert.equal(zh.roleLabel, "輔助");
  assert.equal(zh.offmetaTypeLabel, "出裝 / 符文黑科技");
  assert.equal(zh.topicFrame, "出裝 / 符文黑科技");
  assert.equal(zh.title, "Sona 輔助：Bloodsong / Summon Aery 黑科技能不能打？");
  assert.deepEqual(zh.versionOverview, {
    patch: "16.12",
    region: "韓服",
    rankPreset: "翡翠以上",
    role: "輔助",
    techType: "出裝 / 符文黑科技",
  });
  assert.deepEqual(zh.coreItems, [{ name: "Bloodsong", winRate: 56.4, sampleSize: 4200 }]);
  assert.deepEqual(zh.coreRunes, [{ name: "Summon Aery", winRate: 54.8, sampleSize: 6800 }]);
  assert.deepEqual(zh.playerStats, [
    { label: "勝率", value: "55%" },
    { label: "登場率", value: "1.3%" },
    { label: "樣本", value: "32,000" },
  ]);
  assert.match(zh.recommendedStoryAngle, /Bloodsong/);
  assert.match(zh.recommendedStoryAngle, /Summon Aery/);
  assert.deepEqual(zh.playerTakeaways.map((item) => item.label), ["打法節奏", "適合嘗試", "不要盲抄"]);
  assert.equal(zh.storyboard[0].tag, "VERSION_OVERVIEW");
  assert.match(zh.storyboard[0].text, /16\.12/);
  assert.match(zh.storyboard[0].text, /韓服/);
  assert.match(zh.storyboard[0].text, /翡翠以上/);
  assert.equal(zh.storyboard[0].text.includes("KR"), false);
  assert.equal(zh.storyboard[0].text.includes("Emerald+"), false);
  assert.match(zh.storyboard[1].text, /Bloodsong/);
  assert.equal(serialized.includes("題材分"), false);
  assert.equal(serialized.includes("來源一致度"), false);
  assert.equal(serialized.includes("資料可信度"), false);
  assert.equal(serialized.includes("還沒拿到完整裝備與符文清單"), false);
  assert.equal(serialized.includes("LOW_PICK_RATE"), false);
});

test("buildMetaRenderPayload creates English offmeta build tech copy without internal risk language", () => {
  const { buildMetaRenderPayload } = require(path.join(ROOT, "utils/metaFactory/candidatePlanner.js"));
  const candidate = {
    kind: "META_OFFMETA_PICK",
    champion: "Fizz",
    role: "Mid",
    offmetaType: "OFFMETA_BUILD",
    patch: "16.12",
    region: "kr",
    rankPreset: "diamond_plus",
    score: 66.38,
    confidence: 1,
    sourceAgreement: 0.5,
    sampleSize: 134466,
    coreItems: [{ name: "Lich Bane", winRate: 52.4, sampleSize: 12000 }],
    coreRunes: [{ name: "Electrocute", winRate: 51.8, sampleSize: 18000 }],
    evidence: [{ label: "Win rate", value: 51.2 }, { label: "Pick rate", value: 3.4 }],
    riskLabels: ["SOURCE_UNAVAILABLE"],
    hardBlock: { blocked: false, reasons: [] },
  };

  const en = buildMetaRenderPayload(candidate, "en");
  const serialized = JSON.stringify(en);

  assert.equal(en.locale, "en");
  assert.equal(en.topicFrame, "Build / rune tech");
  assert.equal(en.versionOverview.patch, "16.12");
  assert.equal(en.versionOverview.region, "KR");
  assert.equal(en.versionOverview.rankPreset, "Diamond+");
  assert.deepEqual(en.playerStats, [
    { label: "Win", value: "51.2%" },
    { label: "Pick", value: "3.4%" },
    { label: "Sample", value: "134,466" },
  ]);
  assert.equal(en.storyboard[0].tag, "VERSION_OVERVIEW");
  assert.equal(en.storyboard.some((scene) => scene.text.includes("Lich Bane")), true);
  assert.equal(en.storyboard.some((scene) => scene.text.includes("Watch source confidence")), false);
  assert.equal(serialized.includes("Source confidence"), false);
  assert.equal(serialized.includes("Source match"), false);
  assert.equal(serialized.includes("SOURCE_UNAVAILABLE"), false);
  assert.equal(serialized.includes("Blocked"), false);
});

test("buildMetaRenderPayload hides unknown region and rank codes in zh offmeta payloads", () => {
  const { buildMetaRenderPayload } = require(path.join(ROOT, "utils/metaFactory/candidatePlanner.js"));
  const candidate = {
    kind: "META_OFFMETA_PICK",
    champion: "Nunu",
    role: "Jungle",
    offmetaType: "OFFROLE_PICK",
    patch: "16.12",
    region: "pbe",
    rankPreset: "challenger_plus",
    sampleSize: 9000,
    hardBlock: { blocked: false, reasons: [] },
  };

  const zh = buildMetaRenderPayload(candidate, "zh");
  const en = buildMetaRenderPayload(candidate, "en");

  assert.equal(zh.versionOverview.region, "指定伺服器");
  assert.equal(zh.versionOverview.rankPreset, "指定分段");
  assert.equal(zh.storyboard[0].text.includes("pbe"), false);
  assert.equal(zh.storyboard[0].text.includes("challenger_plus"), false);
  assert.equal(en.versionOverview.region, "PBE");
  assert.equal(en.versionOverview.rankPreset, "challenger_plus");
});

test("buildMetaRenderPayload creates zh/en tier ranking payloads without legacy data types", () => {
  const { buildMetaRenderPayload } = require(path.join(ROOT, "utils/metaFactory/candidatePlanner.js"));
  const candidate = {
    kind: "META_TIER_RANKING",
    role: "Mid",
    rankingSize: 3,
    entries: [
      { champion: "Ahri", role: "Mid", tierScore: 92, winRate: 52.1, pickRate: 13.2, banRate: 18.1, sampleSize: 183420, sourceAgreement: 1, reasons: ["Win rate 52.1%", "Pick rate 13.2%"] },
      { champion: "Orianna", role: "Mid", tierScore: 88, winRate: 51.7, pickRate: 9.8, banRate: 7.4, sampleSize: 120311, sourceAgreement: 1, reasons: ["Win rate 51.7%", "Pick rate 9.8%"] },
      { champion: "Syndra", role: "Mid", tierScore: 84, winRate: 51.2, pickRate: 8.9, banRate: 11.3, sampleSize: 104502, sourceAgreement: 0.75, reasons: ["Win rate 51.2%", "Pick rate 8.9%"] },
    ],
    watchPick: { champion: "Ahri", reason: "stable blind pick" },
    downgradeReason: "Avoid low-sample picks.",
  };

  const zh = buildMetaRenderPayload(candidate, "zh");
  const en = buildMetaRenderPayload(candidate, "en");
  const serialized = JSON.stringify([zh, en]);

  assert.equal(zh.dataType, "META_TIER_RANKING");
  assert.equal(en.dataType, "META_TIER_RANKING");
  assert.equal(zh.locale, "zh");
  assert.equal(en.locale, "en");
  assert.equal(zh.role, "Mid");
  assert.equal(zh.roleLabel, "中路");
  assert.equal(zh.title, "中路 梯度榜前 3");
  assert.equal(en.role, "Mid");
  assert.equal(zh.entries.length, 3);
  assert.equal(en.entries.length, 3);
  assert.equal(zh.entries[0].statLine, "勝率 52.1% · 登場率 13.2% · 樣本 183,420");
  assert.deepEqual(zh.entries[0].reasons, ["勝率 52.1%", "登場率 13.2%"]);
  assert.deepEqual(zh.tierVerdict, {
    title: "榜單讀法",
    body: "這是綜合強度分，不是單看勝率；優先看穩定度、樣本與禁用壓力。",
    chips: ["綜合分", "樣本", "禁用壓力"],
  });
  assert.equal(zh.storyboard.some((scene) => scene.text.includes("Mid")), false);
  assert.equal(zh.storyboard.some((scene) => scene.text.includes("中路")), true);
  assert.equal(serialized.includes("PRO_BUILD"), false);
  assert.equal(serialized.includes("TIER_LIST"), false);
  assert.equal(JSON.stringify(zh).includes("Win rate"), false);
  assert.equal(JSON.stringify(zh).includes("Pick rate"), false);
});

test("buildMetaRenderPayload keeps defaults stable for sparse candidates", () => {
  const { buildMetaRenderPayload } = require(path.join(ROOT, "utils/metaFactory/candidatePlanner.js"));

  const offmeta = buildMetaRenderPayload({ champion: "Nunu", role: "Mid" }, "");
  const tier = buildMetaRenderPayload({ kind: "META_TIER_RANKING" }, "EN-us");

  assert.equal(offmeta.locale, "zh");
  assert.equal(offmeta.offmetaType, "OFFROLE_PICK");
  assert.equal(offmeta.score, 0);
  assert.deepEqual(offmeta.riskLabels, []);
  assert.deepEqual(offmeta.hardBlock, { blocked: false, reasons: [] });
  assert.equal(tier.locale, "en");
  assert.equal(tier.role, "Mid");
  assert.equal(tier.rankingSize, 7);
  assert.deepEqual(tier.entries, []);
  assert.equal(tier.watchPick, null);
});
