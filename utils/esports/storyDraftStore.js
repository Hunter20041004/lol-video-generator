const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { z } = require("zod");
const { validateResearchPackage, validateStorySelection } = require("./matchStoryContract");

function fail(code, message) { throw Object.assign(new Error(message), { code }); }
const contentSchema = z.object({
  selectedCandidateId: z.string().min(1).max(2000).nullable(),
  segments: z.array(z.object({
    narration: z.string().max(2000), factIds: z.array(z.string().min(1).max(2000)).max(30),
  }).strict()).max(20),
  rights: z.array(z.record(z.string(), z.json())).max(30),
});
function checkContent(input) {
  if (!contentSchema.safeParse(input).success) fail("MATCH_STORY_INVALID_DRAFT", "草稿段落或素材資料格式無效。");
}
function checkFields(input) {
  const allowed = ["research", "selectedCandidateId", "segments", "rights"];
  if (!input || typeof input !== "object" || Array.isArray(input)
    || Object.keys(input).some((key) => !allowed.includes(key))) {
    fail("MATCH_STORY_INVALID_DRAFT", "草稿含有不允許的欄位。");
  }
}

// Synchronous transactions serialize writers in one Node process, not across processes or hosts.
function createStoryDraftStore({ cwd = process.cwd(), now = () => new Date().toISOString() } = {}) {
  const file = path.join(cwd, ".data", "match-story-drafts.json");
  function load() {
    if (!fs.existsSync(file)) return { schemaVersion: 1, drafts: {} };
    let data;
    try { data = JSON.parse(fs.readFileSync(file, "utf8")); }
    catch (error) {
      if (!(error instanceof SyntaxError)) throw error;
      fail("MATCH_STORY_STORE_CORRUPT", "草稿資料損毀，已停止寫入以保留原檔。");
    }
    if (data?.schemaVersion !== 1 || !data.drafts || typeof data.drafts !== "object" || Array.isArray(data.drafts)) {
      fail("MATCH_STORY_STORE_CORRUPT", "草稿資料格式無效，已停止寫入。");
    }
    for (const [id, history] of Object.entries(data.drafts)) {
      if (!Array.isArray(history) || !history.length || history.some((draft, index) =>
        draft?.id !== id || draft.revision !== index + 1
        || !(draft.confirmedRevision === null || draft.confirmedRevision === draft.revision)
        || draft.status !== (draft.confirmedRevision === null ? "draft" : "confirmed"))) {
        fail("MATCH_STORY_STORE_CORRUPT", "草稿版本紀錄無效，已停止寫入。");
      }
      try {
        for (const draft of history) {
          checkContent(draft);
          validateResearchPackage(draft.research, history[0].identity, { origin: "editor" });
          validateResearchPackage(draft.research, draft.identity, { origin: "editor" });
          if (draft.confirmedRevision !== null) validateStorySelection(draft.research, draft.selectedCandidateId, draft.segments);
        }
      } catch {
        fail("MATCH_STORY_STORE_CORRUPT", "草稿內容無效，已停止寫入以保留原檔。");
      }
    }
    return data;
  }
  function save(data) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const temporary = `${file}.${randomUUID()}.tmp`;
    try {
      fs.writeFileSync(temporary, JSON.stringify(data), { mode: 0o600 });
      fs.renameSync(temporary, file);
    } finally {
      if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
    }
  }
  function current(data, id) {
    if (typeof id !== "string" || !/^[a-zA-Z0-9-]{1,80}$/.test(id)) {
      fail("MATCH_STORY_INVALID_ID", "草稿識別碼無效。");
    }
    const draft = Object.hasOwn(data.drafts, id) ? data.drafts[id]?.at(-1) : null;
    if (!draft) fail("MATCH_STORY_NOT_FOUND", "找不到這份草稿。");
    return draft;
  }
  function checkRevision(draft, expectedRevision) {
    if (!Number.isSafeInteger(expectedRevision) || expectedRevision !== draft.revision) {
      fail("MATCH_STORY_VERSION_CONFLICT", "草稿已更新，請重新讀取後再操作。");
    }
  }
  return {
    create(input) {
      checkFields(input);
      input = { selectedCandidateId: null, segments: [], rights: [], ...input };
      checkContent(input);
      const research = validateResearchPackage(input.research, input.research?.identity, { origin: "editor" });
      const data = load();
      const timestamp = now();
      const draft = { ...structuredClone(input), research, identity: structuredClone(research.identity),
        id: randomUUID(), revision: 1, confirmedRevision: null, status: "draft", createdAt: timestamp, updatedAt: timestamp };
      data.drafts[draft.id] = [draft];
      save(data);
      return structuredClone(draft);
    },
    read(id, revision) {
      const data = load();
      let draft = current(data, id);
      if (revision !== undefined) draft = data.drafts[id].find((item) => item.revision === revision);
      if (!draft) fail("MATCH_STORY_NOT_FOUND", "找不到這個草稿版本。");
      return structuredClone(draft);
    },
    revise(id, expectedRevision, patch, expectedIdentity) {
      checkFields(patch);
      const data = load();
      const draft = current(data, id);
      checkRevision(draft, expectedRevision);
      validateResearchPackage(draft.research, expectedIdentity, { origin: "editor" });
      const next = { ...draft, ...structuredClone(patch), id, revision: draft.revision + 1,
        confirmedRevision: null, status: "draft", updatedAt: now() };
      checkContent(next);
      next.research = validateResearchPackage(next.research, expectedIdentity, { origin: "editor" });
      data.drafts[id].push(next);
      save(data);
      return structuredClone(next);
    },
    confirm(id, expectedRevision, expectedIdentity) {
      const data = load();
      const draft = current(data, id);
      checkRevision(draft, expectedRevision);
      validateResearchPackage(draft.research, expectedIdentity, { origin: "editor" });
      validateStorySelection(draft.research, draft.selectedCandidateId, draft.segments);
      draft.confirmedRevision = draft.revision;
      draft.status = "confirmed";
      draft.updatedAt = now();
      save(data);
      return structuredClone(draft);
    },
  };
}
module.exports = { createStoryDraftStore };
