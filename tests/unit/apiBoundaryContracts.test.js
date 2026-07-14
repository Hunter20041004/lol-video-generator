const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "../..");

test("analyze API parses untrusted patch text without polynomial regular expressions", () => {
  const source = fs.readFileSync(path.join(ROOT, "app/api/analyze/route.js"), "utf8");
  const unsafePatterns = [
    "/\\(([^)]*)\\)/g",
    "/\\s*([＋+\\-−]\\d)/g",
    "/\\s+(?:and|與)\\s+$/i",
    "/^(.+?)\\s*(?:⇒|→|->|>>>|=>|\\bto\\b)\\s*(.+)$/i",
    "/^(.*?)(-?\\d+(?:\\.\\d+)?%?(?:\\s*\\([^)]*\\))?)$/",
    "/【([^】]+)】[：:]\\s*([\\s\\S]*?)(?=\\n{2,}【|$)/g",
    "/([A-Za-z\\u4e00-\\u9fff%/()（）\\s+\\-]{1,40}?)[:：]?\\s*(-?\\d+(?:\\.\\d+)?%?)\\s*(?:⇒|→|->|>>>|=>| to )\\s*(-?\\d+(?:\\.\\d+)?%?)/gi",
  ];

  for (const pattern of unsafePatterns) assert.equal(source.includes(pattern), false, pattern);
});

test("analyze API guard rejects removed dataTypes before invoking analysis dependencies", () => {
  const { validateAnalyzeRequest } = require(path.join(ROOT, "utils/apiGuards.js"));

  assert.throws(
    () => validateAnalyzeRequest({ dataType: "TIER_LIST", role: "MID" }),
    /Unsupported dataType: TIER_LIST/
  );
  assert.deepEqual(validateAnalyzeRequest({ dataType: "PATCH", championName: "Quinn" }), {
    dataType: "PATCH",
  });
});

test("render service rejects removed dataTypes without producing render files", async () => {
  const originalCwd = process.cwd();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hvs-render-boundary-"));
  process.chdir(dir);
  try {
    const { renderVideosFromRequest } = require(path.join(ROOT, "utils/render/renderService.js"));
    await assert.rejects(
      () => renderVideosFromRequest({
        dataType: "ESPORTS_DRAMA",
        title: "removed",
      }, {
        execRenderImpl: async () => {
          throw new Error("render should not be called");
        },
      }),
      /Unsupported dataType: ESPORTS_DRAMA/
    );
    assert.equal(fs.existsSync(path.join(dir, "public", "renders")), true);
    assert.deepEqual(fs.readdirSync(path.join(dir, "public", "renders")), []);
  } finally {
    process.chdir(originalCwd);
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("publish API guard rejects removed dataTypes and unsupported platforms", () => {
  const { validatePublishRequest } = require(path.join(ROOT, "utils/apiGuards.js"));

  assert.throws(
    () => validatePublishRequest({
      videoUrl: "/renders/clip.mp4",
      analysis: { dataType: "PRO_BUILD" },
      platforms: ["instagram"],
    }),
    /Unsupported dataType: PRO_BUILD/
  );
  assert.throws(
    () => validatePublishRequest({
      videoUrl: "/renders/clip.mp4",
      analysis: { dataType: "PATCH" },
      platforms: ["youtube"],
    }),
    /Unsupported platform: youtube/
  );
  assert.deepEqual(
    validatePublishRequest({ analysis: { dataType: "PATCH" }, platform: "all" }),
    { dataType: "PATCH", platforms: ["instagram", "threads"] }
  );
  assert.deepEqual(validatePublishRequest({ dataType: "SYSTEM_UPDATE" }), {
    dataType: "SYSTEM_UPDATE",
    platforms: ["instagram"],
  });
  assert.deepEqual(validatePublishRequest({
    analysis: { dataType: "RUNE_UPDATE" },
    platforms: ["threads"],
  }), {
    dataType: "RUNE_UPDATE",
    platforms: ["threads"],
  });
});

test("schema normalization accepts new meta payloads while API guards reject retired ones", () => {
  const { validateAnalyzeRequest, validatePublishRequest } = require(path.join(ROOT, "utils/apiGuards.js"));
  const { normalizePipelinePayload } = require(path.join(ROOT, "src/schemas/pipelineSchemas.js"));

  assert.deepEqual(validateAnalyzeRequest({ dataType: "META_OFFMETA_PICK" }), {
    dataType: "META_OFFMETA_PICK",
  });
  assert.deepEqual(validatePublishRequest({
    analysis: { dataType: "META_TIER_RANKING" },
    platforms: ["instagram", "threads"],
  }), {
    dataType: "META_TIER_RANKING",
    platforms: ["instagram", "threads"],
  });
  assert.throws(() => validateAnalyzeRequest({ dataType: "PRO_BUILD" }), /Unsupported dataType: PRO_BUILD/);
  assert.throws(() => validateAnalyzeRequest({ dataType: "TIER_LIST" }), /Unsupported dataType: TIER_LIST/);

  const offmeta = normalizePipelinePayload({
    dataType: "META_OFFMETA_PICK",
    champion: "Velkoz",
    role: "Support",
    score: "82",
    sampleSize: "18420",
  });
  assert.equal(offmeta.data.dataType, "META_OFFMETA_PICK");
  assert.equal(offmeta.data.score, 82);
  assert.equal(offmeta.data.sampleSize, 18420);

  const tier = normalizePipelinePayload({
    dataType: "META_TIER_RANKING",
    role: "Mid",
    entries: [{ champion: "Azir", rank: 1, tierScore: "88" }],
  });
  assert.equal(tier.data.dataType, "META_TIER_RANKING");
  assert.equal(tier.data.entries[0].tierScore, 88);
});

test("pipeline schema preserves muted and user-supplied audio", () => {
  const { normalizePipelinePayload } = require(path.join(ROOT, "src/schemas/pipelineSchemas.js"));

  assert.equal(normalizePipelinePayload({ dataType: "PATCH" }).data.bgmFile, null);
  assert.equal(normalizePipelinePayload({ dataType: "PATCH", bgmFile: null }).data.bgmFile, null);
  assert.equal(
    normalizePipelinePayload({ dataType: "PATCH", bgmFile: "audio/licensed-by-user.mp3" }).data.bgmFile,
    "audio/licensed-by-user.mp3",
  );
});
