const { readCandidateSnapshot } = require("./candidateStore");
const { createStoryDraftStore } = require("./storyDraftStore");
const { validateResearchPackage } = require("./matchStoryContract");
const { classifyTierOneTournament } = require("./competitionRegistry");
const { z } = require("zod");
const id = z.string().min(1).max(2000);
const versioned = { id, expectedRevision: z.number().int().positive() };
const selection = { scanId: id, seriesId: id };
const requestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("research"), ...selection }).strict(),
  z.object({ action: z.literal("import"), ...selection, research: z.unknown() }).strict(),
  z.object({ action: z.literal("read"), ...versioned }).strict(),
  z.object({ action: z.literal("confirm"), ...versioned }).strict(),
  z.object({ action: z.literal("revise"), ...versioned, patch: z.record(z.string(), z.unknown()) }).strict(),
]);
function fail(code, message) { throw Object.assign(new Error(message), { code }); }

function createMatchStoryService({ researchEnabled = false, provider, store = createStoryDraftStore(), readSnapshot = readCandidateSnapshot, now = () => new Date() } = {}) {
  const inFlight = new Map();
  function matchIdentity(scanId, seriesId) {
    let snapshot;
    try { snapshot = readSnapshot(scanId); }
    catch { fail("MATCH_STORY_SNAPSHOT_UNAVAILABLE", "基礎賽事資料不可用或已過期，請重新掃描。"); }
    const series = snapshot.candidates?.find((item) => item.seriesId === seriesId);
    if (!series) fail("MATCH_STORY_NOT_FOUND", "這次掃描沒有這場比賽，請重新選場。");
    if ((series.status !== undefined && series.status !== "completed") || series.canPreview === false
      || !z.iso.date().safeParse(series.date).success || series.date > new Date(now()).toISOString().slice(0, 10)
      || !classifyTierOneTournament(series.tournament)
      || series.completeness?.hasTenPlayers !== true || series.completeness?.hasFiveRoleMatchups !== true
      || series.players?.length !== 10 || series.roleMatchups?.length !== 5
      || !series.roleMatchups.every((item) => item.left && item.right)
      || !/^\d+-\d+$/.test(series.seriesScore || series.score || "")) {
      fail("MATCH_STORY_MATCH_INELIGIBLE", "只有資料完整的已完成一級賽事可建立故事稿。");
    }
    return { scanId: snapshot.scanId, seriesId: series.seriesId, date: series.date,
      league: series.league, teamA: series.teamA, teamB: series.teamB, seriesScore: series.seriesScore || series.score };
  }
  return {
    async execute(request) {
      const parsed = requestSchema.safeParse(request);
      if (!parsed.success) fail("MATCH_STORY_INVALID_REQUEST", "故事稿請求格式無效。");
      request = parsed.data;
      if (request.action === "research" && (!researchEnabled || !provider)) {
        fail("MATCH_STORY_SERVICE_DISABLED", "自動研究尚未啟用；可先匯入人工核對的研究資料。");
      }
      if (request.action === "import") {
        const identity = matchIdentity(request.scanId, request.seriesId);
        const research = validateResearchPackage(request.research, identity, { origin: "editor" });
        return store.create({ research });
      }
      if (request.action === "research") {
        const identity = matchIdentity(request.scanId, request.seriesId);
        const key = JSON.stringify(identity);
        if (!inFlight.has(key)) {
          const pending = Promise.resolve().then(async () => {
            let result;
            try { result = await provider(structuredClone(identity)); }
            catch { fail("MATCH_STORY_RESEARCH_FAILED", "研究服務失敗，未自動重試；請稍後再試。"); }
            const research = validateResearchPackage(result, matchIdentity(request.scanId, request.seriesId), { origin: "model" });
            return store.create({ research });
          }).finally(() => inFlight.delete(key));
          inFlight.set(key, pending);
        }
        return structuredClone(await inFlight.get(key));
      }
      if (["read", "revise", "confirm"].includes(request.action)) {
        const draft = store.read(request.id);
        const identity = matchIdentity(draft.identity.scanId, draft.identity.seriesId);
        validateResearchPackage(draft.research, identity, { origin: "editor" });
        if (request.expectedRevision !== draft.revision) fail("MATCH_STORY_VERSION_CONFLICT", "草稿已更新，請重新讀取後再操作。");
        if (request.action === "read") return draft;
        if (request.action === "confirm") return store.confirm(request.id, request.expectedRevision, identity);
        return store.revise(request.id, request.expectedRevision, request.patch, identity);
      }
    },
  };
}
module.exports = { createMatchStoryService };
