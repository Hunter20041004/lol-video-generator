const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  buildSocialCopy,
  extractCopyBullets,
  inferTitle,
} = require("../../../utils/publishing/copy");

test("publishing copy localizes untrusted text without polynomial regular expressions", () => {
  const source = fs.readFileSync(path.resolve(__dirname, "../../../utils/publishing/copy.js"), "utf8");
  const unsafePatterns = [
    "/readies.*ult.*5\\s*seconds|ult.*readies.*5\\s*seconds/",
    "/triggers.*ult.*cast|ult.*cast.*triggers/",
    "/damage\\s+triggers.*next.*attack.*ability/",
    "/damage\\s+triggers.*hit|on-hit/",
    "/damage\\s+reduction.*cast\\s+source/",
    "/\\s*\\/\\s*[A-Za-z][A-Za-z0-9 '%:+().-]*$/g",
    "/(?:patch\\s*)?v?(\\d+(?:\\.\\d+){1,2})/i",
  ];

  for (const pattern of unsafePatterns) assert.equal(source.includes(pattern), false, pattern);
});

test("buildSocialCopy creates a zh Instagram caption with hook, bullets, CTA, and localized tags", () => {
  const copy = buildSocialCopy({
    locale: "zh",
    platform: "instagram",
    analysis: {
      dataType: "PATCH",
      championName: "Quinn",
      localizedChampionName: "葵恩",
      patchVersion: "26.10",
      changeType: "BUFF",
      actionableVerdict: {
        oneLineVerdict: "清野效率變高，前期轉線會更舒服。",
        chips: ["清野速度", "轉線節奏"],
      },
      statChanges: [
        { metricName: "基礎攻擊力", beforeValue: "60", afterValue: "58", summary: "前期換血稍降" },
        { metricName: "Q 傷害", beforeValue: "80", afterValue: "100", summary: "爆發窗口提高" },
      ],
    },
  });

  assert.equal(copy.locale, "zh");
  assert.equal(copy.platform, "instagram");
  assert.match(copy.title, /葵恩/);
  assert.match(copy.caption, /^葵恩 26\.10 英雄改版快速看懂/);
  assert.match(copy.caption, /這波重點/);
  assert.match(copy.caption, /• 基礎攻擊力：60 → 58/);
  assert.match(copy.caption, /• Q 傷害：80 → 100/);
  assert.match(copy.caption, /你會怎麼調整打法/);
  assert.match(copy.caption, /#英雄聯盟/);
  assert.doesNotMatch(copy.caption, /Quinn/);
});

test("buildSocialCopy creates an English Threads caption with discussion-first wording", () => {
  const copy = buildSocialCopy({
    locale: "en",
    platform: "threads",
    analysis: {
      dataType: "ITEM_UPDATE",
      targetName: "Kraken Slayer",
      localizedName: "Kraken Slayer",
      patchVersion: "26.10",
      changeType: "ADJUST",
      actionableVerdict: {
        body: "The first-item spike is less automatic; check whether your champion still wins the first trade.",
        chips: ["first item", "trade timing"],
      },
      statChanges: [
        { metricName: "Damage", beforeValue: "140", afterValue: "120", summary: "burst is lower" },
        { metricName: "Attack Speed", beforeValue: "35%", afterValue: "40%", summary: "tempo is higher" },
      ],
    },
  });

  assert.match(copy.caption, /^Kraken Slayer Item Update 26\.10 Explained/);
  assert.match(copy.caption, /My read:/);
  assert.match(copy.caption, /1\. Damage: 140 → 120/);
  assert.match(copy.caption, /2\. Attack Speed: 35% → 40%/);
  assert.match(copy.caption, /Buff, nerf, or bait/);
  assert.match(copy.caption, /#LeagueOfLegends/);
});

test("buildSocialCopy keeps English captions free of Chinese fallback text", () => {
  const copy = buildSocialCopy({
    locale: "en",
    platform: "instagram",
    analysis: {
      dataType: "PATCH",
      championName: "Ambessa",
      localizedChampionName: "安蓓薩",
      patchVersion: "26.10",
      changeType: "ADJUST",
      actionableVerdict: {
        oneLineVerdict: "先看實戰數據再決定。",
      },
      socialCopy: {
        description: "先看實戰數據再決定。",
      },
      statChanges: [
        {
          metricName: "Max HP Damage",
          beforeValue: "2-6%",
          afterValue: "4-6%",
          summary: "提升對坦度目標的壓制力",
        },
      ],
    },
  });

  assert.equal(copy.description, "A fast breakdown of what this patch change means in game.");
  assert.match(copy.caption, /^Ambessa Champion Patch 26\.10 Explained/);
  assert.match(copy.caption, /What changed:/);
  assert.match(copy.caption, /Max HP Damage: 2-6% → 4-6%/);
  assert.doesNotMatch(copy.caption, /[\u3400-\u9fff]/);
});

test("buildSocialCopy rejects removed publishing platforms", () => {
  assert.throws(() => buildSocialCopy({
    locale: "en",
    platform: "youtube",
    analysis: {
      dataType: "RUNE_UPDATE",
      targetName: "Stormsurge",
      localizedName: "Stormsurge",
      patchVersion: "26.10",
      actionableVerdict: { body: "Movement speed uptime got stronger, so roaming windows matter more." },
      statChanges: [{ metricName: "Move Speed", beforeValue: "40%", afterValue: "48%" }],
    },
  }), /Unsupported platform: youtube/);
});

test("buildSocialCopy supports new Meta Factory offmeta dataType without old labels", () => {
  const copy = buildSocialCopy({
    platform: "instagram",
    locale: "zh",
    analysis: {
      dataType: "META_OFFMETA_PICK",
      champion: "Velkoz",
      role: "Support",
      title: "Velkoz Support 黑科技",
      storyboard: [{ text: "Velkoz Support\n看起來很怪" }],
    },
  });

  assert.match(copy.caption, /Velkoz/);
  assert.match(copy.title, /Meta Factory|黑科技/);
  assert.equal(copy.tags.includes("MetaFactory"), true);
  assert.doesNotMatch(copy.caption, /Pro Build|Tier List/);
  assert.equal(copy.tags.some((tag) => /ProBuild|TierList/i.test(tag)), false);
});

test("buildSocialCopy supports Meta Factory tier ranking labels without old tier-list labels", () => {
  const copy = buildSocialCopy({
    platform: "threads",
    locale: "en",
    analysis: {
      dataType: "META_TIER_RANKING",
      role: "Jungle",
      rankingSize: 3,
      actionableVerdict: {
        body: "Jungle priority moved around first clear and early river fight timing.",
      },
      storyboard: [
        { text: "S tier: Nidalee\nWins early tempo" },
        { text: "A tier: Viego stays a stable fallback" },
      ],
    },
  });

  assert.equal(copy.title, "Jungle Meta Factory Tier Ranking Top 3");
  assert.match(copy.caption, /^Jungle Meta Factory Tier Ranking Top 3/);
  assert.match(copy.caption, /My read:/);
  assert.match(copy.caption, /1\. Jungle priority moved around first clear and early river fight timing\./);
  assert.equal(copy.tags.includes("MetaFactory"), true);
  assert.equal(copy.tags.includes("TierRanking"), true);
  assert.doesNotMatch(copy.caption, /Pro Build|Tier List|TIER_LIST|PRO_BUILD/);
  assert.equal(copy.tags.some((tag) => /ProBuild|TierList|TIER_LIST|PRO_BUILD/i.test(tag)), false);
});

test("buildSocialCopy localizes zh mechanism bullets instead of leaking English", () => {
  const copy = buildSocialCopy({
    analysis: {
      dataType: "ITEM_UPDATE",
      targetName: "Zeke’s Convergence",
      localizedName: "錫柯的聚合之力",
      patchVersion: "26.11",
      statChanges: [{
        metricName: "Frostfire Tempest",
        beforeValue: "Triggers on Ult cast",
        afterValue: "Readies on Ult cast for the next 5 seconds, triggering the moment an enemy champion gets within the range or after 5 seconds",
      }],
    },
    locale: "zh",
    platform: "instagram",
  });

  assert.match(copy.caption, /霜火風暴：大絕施放觸發 → 大絕後預備5秒/);
  assert.doesNotMatch(copy.caption, /Frostfire|Triggers|Readies|Ult cast/i);
});

test("extractCopyBullets falls back to storyboard and verdict text when stat changes are absent", () => {
  const bullets = extractCopyBullets({
    actionableVerdict: { body: "對線期要重新測，不要直接套舊版本。" },
    storyboard: [
      { text: "第一段\n這句會變成重點" },
      { text: "第二段也可以使用" },
    ],
  }, "zh");

  assert.deepEqual(bullets.slice(0, 3), [
    "對線期要重新測，不要直接套舊版本。",
    "第一段 這句會變成重點",
    "第二段也可以使用",
  ]);
});

test("inferTitle honors explicit social copy before generated titles", () => {
  assert.equal(
    inferTitle({ socialCopy: { title: "Manual Title" }, dataType: "PATCH", championName: "Quinn", patchVersion: "26.10" }, "en"),
    "Manual Title | Patch 26.10"
  );
});
