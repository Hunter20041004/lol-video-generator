const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "../../..");

test("scoreOffmetaCandidates ranks non-primary roles with enough sample and positive win delta", () => {
  const { scoreOffmetaCandidates } = require(path.join(ROOT, "utils/metaFactory/scoring.js"));

  const candidates = scoreOffmetaCandidates([
    {
      champion: "Velkoz",
      role: "Support",
      primaryRole: "Mid",
      sampleSize: 18420,
      winRate: 52.8,
      baselineWinRate: 50.1,
      pickRate: 2.1,
      banRate: 0.8,
      builds: [],
      runes: [],
      summonerSpells: [],
      patch: "16.12",
      region: "global",
    },
  ], {
    "Velkoz::Support": { sourceAgreement: 1, status: "verified", notes: [] },
  });

  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].kind, "META_OFFMETA_PICK");
  assert.equal(candidates[0].offmetaType, "OFFROLE_PICK");
  assert.equal(candidates[0].champion, "Velkoz");
  assert.equal(candidates[0].role, "Support");
  assert.equal(candidates[0].hardBlock.blocked, false);
  assert.equal(candidates[0].riskLabels.includes("LOW_SAMPLE"), false);
  assert.equal(candidates[0].score > 70, true);
});

test("scoreOffmetaCandidates hard-blocks low-sample source mismatches", () => {
  const { scoreOffmetaCandidates } = require(path.join(ROOT, "utils/metaFactory/scoring.js"));

  const candidates = scoreOffmetaCandidates([
    {
      champion: "Yuumi",
      role: "Jungle",
      primaryRole: "Support",
      sampleSize: 260,
      winRate: 48.2,
      baselineWinRate: 50.3,
      pickRate: 0.1,
    },
  ], {
    "Yuumi::Jungle": { sourceAgreement: 0.25, status: "mismatch", notes: ["OP.GG does not confirm this trend."] },
  });

  assert.equal(candidates[0].hardBlock.blocked, true);
  assert.equal(candidates[0].riskLabels.includes("LOW_SAMPLE"), true);
  assert.equal(candidates[0].riskLabels.includes("SOURCE_MISMATCH"), true);
});

test("scoreOffmetaCandidates sorts multi-row input by score and returns the candidate contract", () => {
  const { scoreOffmetaCandidates } = require(path.join(ROOT, "utils/metaFactory/scoring.js"));

  const candidates = scoreOffmetaCandidates([
    {
      champion: "Sona",
      role: "Support",
      primaryRole: "Support",
      sampleSize: 32000,
      winRate: 55,
      baselineWinRate: 50,
      pickRate: 1.3,
    },
    {
      champion: "Velkoz",
      role: "Support",
      primaryRole: "Mid",
      sampleSize: 18420,
      winRate: 52.8,
      baselineWinRate: 50.1,
      pickRate: 2.1,
    },
    {
      champion: "Teemo",
      role: "Jungle",
      primaryRole: "Top",
      sampleSize: 2500,
      winRate: 51.2,
      baselineWinRate: 50,
      pickRate: 0.8,
    },
  ], {
    "Sona::Support": {
      sourceAgreement: 1,
      status: "verified",
      notes: ["OP.GG build data confirms support trend."],
    },
    "Velkoz::Support": {
      sourceAgreement: 1,
      status: "verified",
      notes: ["OP.GG confirms support trend."],
    },
    "Teemo::Jungle": {
      sourceAgreement: 0.5,
      status: "unavailable",
      notes: ["OP.GG verifier did not return usable data."],
    },
  });

  assert.deepEqual(candidates.map(({ champion, role }) => `${champion}::${role}`), [
    "Velkoz::Support",
    "Teemo::Jungle",
  ]);
  assert.equal(candidates[0].score >= candidates[1].score, true);
  assert.deepEqual(candidates[0], {
    candidateId: "offmeta-velkoz-support",
    kind: "META_OFFMETA_PICK",
    offmetaType: "OFFROLE_PICK",
    champion: "Velkoz",
    role: "Support",
    score: 86.71,
    confidence: 0.97,
    sourceAgreement: 1,
    sampleSize: 18420,
    riskLabels: [],
    evidence: [
      { label: "Win rate", value: 52.8 },
      { label: "Baseline", value: 50.1 },
      { label: "Pick rate", value: 2.1 },
    ],
    recommendedStoryAngle: "Velkoz Support looks off-meta, but the sample is worth checking.",
    hardBlock: { blocked: false, reasons: [] },
    sourceNotes: ["OP.GG confirms support trend."],
  });
});

test("scoreOffmetaCandidates omits main-role rows without build or rune details", () => {
  const { scoreOffmetaCandidates } = require(path.join(ROOT, "utils/metaFactory/scoring.js"));

  const candidates = scoreOffmetaCandidates([
    {
      champion: "Fizz",
      role: "Mid",
      primaryRole: "Mid",
      sampleSize: 138290,
      winRate: 50.1,
      baselineWinRate: 50,
      pickRate: 7.8,
      builds: [],
      runes: [],
    },
  ], {
    "Fizz::Mid": { sourceAgreement: 1, status: "verified", notes: [] },
  });

  assert.deepEqual(candidates, []);
});

test("scoreOffmetaCandidates allows main-role build tech only when core build or rune details exist", () => {
  const { scoreOffmetaCandidates } = require(path.join(ROOT, "utils/metaFactory/scoring.js"));

  const candidates = scoreOffmetaCandidates([
    {
      champion: "Sona",
      role: "Support",
      primaryRole: "Support",
      sampleSize: 32000,
      winRate: 55,
      baselineWinRate: 50,
      pickRate: 1.3,
      builds: [{ name: "Bloodsong", winRate: 56.4, sampleSize: 4200 }],
      runes: [{ name: "Summon Aery", winRate: 54.8, sampleSize: 6800 }],
    },
  ], {
    "Sona::Support": { sourceAgreement: 1, status: "verified", notes: [] },
  });

  assert.equal(candidates[0].offmetaType, "OFFMETA_BUILD");
  assert.equal(candidates[0].hardBlock.blocked, false);
  assert.deepEqual(candidates[0].coreItems, [{ name: "Bloodsong", winRate: 56.4, sampleSize: 4200 }]);
  assert.deepEqual(candidates[0].coreRunes, [{ name: "Summon Aery", winRate: 54.8, sampleSize: 6800 }]);
});

test("scoreOffmetaCandidates omits mainstream main-role rows even when normal build details exist", () => {
  const { scoreOffmetaCandidates } = require(path.join(ROOT, "utils/metaFactory/scoring.js"));

  const candidates = scoreOffmetaCandidates([
    {
      champion: "Fizz",
      role: "Mid",
      primaryRole: "Mid",
      sampleSize: 145811,
      winRate: 53.76,
      baselineWinRate: 51.61,
      pickRate: 5.81,
      builds: [{ name: "Lich Bane", winRate: 54.1, sampleSize: 64330 }],
      runes: [{ name: "Electrocute", winRate: 53.9, sampleSize: 126450 }],
    },
  ], {
    "Fizz::Mid": { sourceAgreement: 1, status: "verified", notes: [] },
  });

  assert.deepEqual(candidates, []);
});

test("scoreTierRanking returns requested-role Top 7 sorted by composite tier score", () => {
  const { scoreTierRanking } = require(path.join(ROOT, "utils/metaFactory/scoring.js"));

  const ranking = scoreTierRanking([
    ...makeTierRows("Mid", 9),
    {
      champion: "WrongRoleCarry",
      role: "Jungle",
      primaryRole: "Jungle",
      sampleSize: 90000,
      winRate: 69,
      pickRate: 30,
      banRate: 45,
      baselineWinRate: 50,
      patch: "16.12",
      region: "global",
    },
  ], {}, { role: "Mid" });

  assert.equal(ranking.kind, "META_TIER_RANKING");
  assert.equal(ranking.role, "Mid");
  assert.equal(ranking.rankingSize, 7);
  assert.equal(ranking.entries.length, 7);
  assert.deepEqual(ranking.entries.map((entry) => entry.rank), [1, 2, 3, 4, 5, 6, 7]);
  assert.deepEqual(ranking.entries.map((entry) => entry.role), Array(7).fill("Mid"));
  assert.equal(ranking.entries.some((entry) => entry.champion === "WrongRoleCarry"), false);
  const tierScores = ranking.entries.map((entry) => entry.tierScore);
  assert.deepEqual(tierScores, [...tierScores].sort((a, b) => b - a));
  assert.equal(["S", "A", "B"].includes(ranking.entries[0].tierBand), true);
});

test("scoreTierRanking downgrades to Top 5 and excludes user-blocked champions", () => {
  const { scoreTierRanking } = require(path.join(ROOT, "utils/metaFactory/scoring.js"));

  const ranking = scoreTierRanking(makeTierRows("Jungle", 6), {}, {
    role: "Jungle",
    excludedChampions: ["champion1"],
  });

  assert.equal(ranking.rankingSize, 5);
  assert.equal(ranking.entries.length, 5);
  assert.equal(ranking.entries.some((entry) => entry.champion === "Champion1"), false);
  assert.match(ranking.downgradeReason, /Top 7 confidence/);
});

test("scoreOffmetaCandidates protects sparse rows with defaults and hard-block reasons", () => {
  const { scoreOffmetaCandidates } = require(path.join(ROOT, "utils/metaFactory/scoring.js"));

  const candidates = scoreOffmetaCandidates([
    {
      champion: "",
      role: "",
      primaryRole: "Mid",
      rankPreset: "master_plus",
      sampleSize: 1200,
      winRate: 48,
      baselineWinRate: 50,
      pickRate: 0.2,
    },
  ]);

  assert.equal(candidates[0].candidateId, "offmeta--");
  assert.equal(candidates[0].offmetaType, "OFFMETA_BUILD");
  assert.deepEqual(candidates[0].riskLabels, ["LOW_PICK_RATE", "SOURCE_UNAVAILABLE", "HIGH_ELO_ONLY"]);
  assert.deepEqual(candidates[0].hardBlock, {
    blocked: true,
    reasons: ["Missing champion or role.", "Win rate is below baseline."],
  });
  assert.equal(candidates[0].sourceAgreement, 0.5);
  assert.deepEqual(candidates[0].sourceNotes, []);
});

test("scoreOffmetaCandidates labels high-sample source mismatches without blocking them", () => {
  const { scoreOffmetaCandidates } = require(path.join(ROOT, "utils/metaFactory/scoring.js"));

  const candidates = scoreOffmetaCandidates([
    {
      champion: "Brand",
      role: "ADC",
      primaryRole: "Support",
      sampleSize: 2200,
      winRate: 51.5,
      baselineWinRate: 50,
      pickRate: 0.4,
    },
  ], {
    "Brand::ADC": {
      sourceAgreement: 0,
      status: "mismatch",
      notes: "not-array",
    },
  });

  assert.equal(candidates[0].hardBlock.blocked, false);
  assert.deepEqual(candidates[0].riskLabels, ["LOW_PICK_RATE", "SOURCE_MISMATCH"]);
  assert.equal(candidates[0].sourceAgreement, 0);
  assert.deepEqual(candidates[0].sourceNotes, []);
});

test("scoreTierRanking hard-blocks empty role slices and marks low-sample caveats", () => {
  const { scoreTierRanking } = require(path.join(ROOT, "utils/metaFactory/scoring.js"));

  const noRows = scoreTierRanking();
  const empty = scoreTierRanking(makeTierRows("Top", 2), {}, { role: "Support" });
  const ranking = scoreTierRanking([
    {
      champion: "Fizz",
      role: "Mid",
      sampleSize: 999,
      winRate: 50,
      pickRate: 1,
      banRate: 0,
      baselineWinRate: 50,
    },
  ]);

  assert.equal(noRows.role, "Mid");
  assert.equal(noRows.rankingSize, 0);
  assert.equal(noRows.hardBlock.blocked, true);
  assert.equal(empty.role, "Support");
  assert.equal(empty.rankingSize, 0);
  assert.deepEqual(empty.entries, []);
  assert.deepEqual(empty.hardBlock, {
    blocked: true,
    reasons: ["Tier ranking has no entries."],
  });
  assert.equal(ranking.role, "Mid");
  assert.equal(ranking.entries.length, 1);
  assert.deepEqual(ranking.entries[0].caveats, ["Sample size is low."]);
  assert.equal(ranking.watchPick, null);
});

function makeTierRows(role, count) {
  return Array.from({ length: count }, (_, index) => ({
    champion: `Champion${index + 1}`,
    role,
    primaryRole: role,
    sampleSize: 20000 - index * 1000,
    winRate: 54 - index * 0.6,
    pickRate: 12 - index * 0.7,
    banRate: 8 - index * 0.3,
    baselineWinRate: 50,
    patch: "16.12",
    region: "global",
  }));
}
