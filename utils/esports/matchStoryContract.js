const { z } = require("zod");
const text = z.string().trim().min(1).max(2000);
const ids = z.array(text).min(1).max(30);
const timestamp = z.iso.datetime({ offset: true });
const identitySchema = z.object({
  scanId: text, seriesId: text, date: z.iso.date(), league: text,
  teamA: text, teamB: text, seriesScore: text,
}).strict();
const packageSchema = z.object({
  identity: identitySchema,
  sources: z.array(z.object({
    id: text, url: z.url({ protocol: /^https?$/ }), title: text,
    publishedAt: timestamp.nullable(), retrievedAt: timestamp,
    kind: z.enum(["article", "video", "stats"]),
    readStatus: z.enum(["search-lead", "report", "reviewed-video", "stats"]),
    matchExplanation: text,
  }).strict()).max(30),
  facts: z.array(z.object({
    id: text, statement: text, sourceIds: ids,
    evidenceType: z.enum(["stats", "report", "search-lead", "reviewed-video"]),
    scope: z.enum(["game", "series", "background"]),
    gameNumber: z.number().int().positive().optional(),
    limitations: z.array(text).max(30), conflicts: z.array(text).max(30),
    observation: z.object({
      sourceId: text, reviewer: text, reviewedAt: timestamp,
      playerStartSeconds: z.number().nonnegative(),
      playerEndSeconds: z.number().nonnegative(),
      gameStartSeconds: z.number().nonnegative(),
      gameEndSeconds: z.number().nonnegative(), observed: text,
    }).strict().optional(),
  }).strict()).max(100),
  candidates: z.array(z.object({
    id: text, kind: z.enum(["teamfight", "play", "draft", "tactic", "player", "stakes", "background", "recap"]),
    headline: text, whyInteresting: text, factIds: ids, unresolved: z.array(text).max(30),
  }).strict()).max(3),
}).strict();

function fail(code, message) {
  throw Object.assign(new Error(message), { code });
}

function validateResearchPackage(input, expectedIdentity, options = {}) {
  const parsed = packageSchema.safeParse(input);
  if (!parsed.success) fail("MATCH_STORY_INVALID_PACKAGE", "研究資料格式不完整或無效。");
  input = parsed.data;
  for (const field of ["scanId", "seriesId", "date", "league", "teamA", "teamB", "seriesScore"]) {
    if (!expectedIdentity?.[field] || input?.identity?.[field] !== expectedIdentity[field]) {
      throw Object.assign(new Error("研究資料與所選比賽不一致。"), { code: "MATCH_STORY_IDENTITY_MISMATCH" });
    }
  }
  const sourceIds = new Set(input.sources.map((source) => source.id));
  for (const records of [input.sources, input.facts, input.candidates]) {
    if (new Set(records.map((record) => record.id)).size !== records.length) {
      fail("MATCH_STORY_DUPLICATE_ID", "研究資料有重複識別碼。");
    }
  }
  for (const fact of input.facts) {
    if (fact.evidenceType === "reviewed-video" && (options.origin !== "editor" || !fact.observation)) {
      fail("MATCH_STORY_REVIEW_REQUIRED", "操作證據需要編輯回看紀錄，模型不能自行標記。");
    }
  }
  for (const fact of input.facts) {
    if (fact.sourceIds.some((id) => !sourceIds.has(id))) {
      throw Object.assign(new Error("事實引用的來源不存在。"), { code: "MATCH_STORY_INVALID_REFERENCE" });
    }
  }
  const factIds = new Set(input.facts.map((fact) => fact.id));
  const sources = new Map(input.sources.map((source) => [source.id, source]));
  for (const fact of input.facts) {
    const observation = fact.observation;
    if (fact.evidenceType === "reviewed-video" && (
      !fact.gameNumber || !fact.sourceIds.includes(observation.sourceId)
      || sources.get(observation.sourceId)?.kind !== "video"
      || observation.playerEndSeconds <= observation.playerStartSeconds
      || observation.gameEndSeconds < observation.gameStartSeconds
    )) fail("MATCH_STORY_REVIEW_REQUIRED", "回看紀錄的來源或時間範圍無效。");
  }
  for (const fact of input.facts) {
    if (fact.sourceIds.some((id) => sources.get(id).readStatus !== fact.evidenceType)) {
      fail("MATCH_STORY_UNVERIFIED_FACT", "事實類型與來源核對狀態不一致。");
    }
  }
  for (const candidate of input.candidates) {
    if (candidate.factIds.some((id) => !factIds.has(id))) {
      throw Object.assign(new Error("看點引用的事實不存在。"), { code: "MATCH_STORY_INVALID_REFERENCE" });
    }
  }
  return structuredClone(input);
}

function validateStorySelection(research, candidateId, segments) {
  research = validateResearchPackage(research, research?.identity, { origin: "editor" });
  const script = z.array(z.object({ narration: text, factIds: ids }).strict()).min(1).max(20).safeParse(segments);
  if (!script.success) fail("MATCH_STORY_INVALID_SCRIPT", "每段旁白需要文字與事實引用。");
  segments = script.data;
  const candidate = research.candidates.find((item) => item.id === candidateId);
  if (!candidate) fail("MATCH_STORY_INVALID_REFERENCE", "所選看點不存在。");
  if (candidate.unresolved.length) fail("MATCH_STORY_UNRESOLVED", "所選看點仍有待確認事項。");
  const facts = new Map(research.facts.map((fact) => [fact.id, fact]));
  for (const segment of [{ factIds: candidate.factIds }, ...segments]) {
    for (const id of segment.factIds) {
      if (!facts.has(id)) fail("MATCH_STORY_INVALID_REFERENCE", "旁白引用的事實不存在。");
      if (facts.get(id)?.conflicts.length) fail("MATCH_STORY_CONFLICT", "核心證據仍有衝突。");
      if (facts.get(id)?.evidenceType === "search-lead") {
        fail("MATCH_STORY_UNVERIFIED_FACT", "搜尋線索不能作為已確認旁白的證據。");
      }
    }
  }
  return true;
}

module.exports = { validateResearchPackage, validateStorySelection };
