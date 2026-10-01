const MAX_BODY_BYTES = 1024 * 1024;
const errors = {
  MATCH_STORY_INVALID_REQUEST: [400, "故事稿請求格式無效。"],
  MATCH_STORY_INVALID_ID: [400, "草稿識別碼無效。"],
  MATCH_STORY_INVALID_DRAFT: [400, "草稿資料格式無效。"],
  MATCH_STORY_INVALID_PACKAGE: [400, "研究資料格式不完整或無效。"],
  MATCH_STORY_INVALID_SCRIPT: [400, "每段旁白需要文字與事實引用。"],
  MATCH_STORY_DUPLICATE_ID: [400, "研究資料有重複識別碼。"],
  MATCH_STORY_INVALID_REFERENCE: [400, "引用的來源或事實不存在。"],
  MATCH_STORY_NOT_FOUND: [404, "找不到這份草稿或所選比賽。"],
  MATCH_STORY_VERSION_CONFLICT: [409, "草稿已更新，請重新讀取。"],
  MATCH_STORY_IDENTITY_MISMATCH: [409, "研究資料與所選比賽不一致。"],
  MATCH_STORY_MATCH_INELIGIBLE: [409, "只有完整的已完成一級賽事可建立故事稿。"],
  MATCH_STORY_SNAPSHOT_UNAVAILABLE: [409, "基礎賽事資料不可用或已過期，請重新掃描。"],
  MATCH_STORY_UNRESOLVED: [409, "所選看點仍有待確認事項。"],
  MATCH_STORY_CONFLICT: [409, "核心證據仍有衝突。"],
  MATCH_STORY_UNVERIFIED_FACT: [409, "搜尋線索不能作為已確認的證據。"],
  MATCH_STORY_REVIEW_REQUIRED: [409, "操作證據需要編輯的回看紀錄。"],
  MATCH_STORY_STORE_CORRUPT: [500, "草稿資料損毀，已停止写入並保留原檔。"],
  MATCH_STORY_SERVICE_DISABLED: [503, "自動研究尚未啟用；可先匯入人工核對資料。"],
  MATCH_STORY_RESEARCH_FAILED: [502, "研究服務失敗，未自動重試；請稍後再試。"],
};
function errorResponse(code, message, status) {
  return Response.json({ success: false, code, message }, { status });
}
async function readBody(request) {
  if (!request.body) throw new SyntaxError("Missing body");
  const reader = request.body.getReader();
  const chunks = [];
  let bytes = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_BODY_BYTES) {
        await reader.cancel();
        throw Object.assign(new Error("Body too large"), { code: "MATCH_STORY_REQUEST_TOO_LARGE" });
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
function createMatchStoryPost(service) {
  return async function POST(request) {
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin) {
      return errorResponse("MATCH_STORY_ORIGIN_REJECTED", "不允許其他網站操作本機草稿。", 403);
    }
    if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
      return errorResponse("MATCH_STORY_INVALID_REQUEST", "請使用 JSON 傳送故事稿資料。", 400);
    }
    let body;
    try { body = await readBody(request); }
    catch (error) {
      if (error.code === "MATCH_STORY_REQUEST_TOO_LARGE") return errorResponse(error.code, "故事稿資料超過大小限制。", 400);
      return errorResponse("MATCH_STORY_INVALID_REQUEST", "請提供有效的故事稿資料。", 400);
    }
    try { return Response.json({ success: true, draft: await service.execute(body) }); }
    catch (error) {
      const code = Object.hasOwn(errors, error?.code) ? error.code : "MATCH_STORY_FAILED";
      const [status, message] = errors[code] || [500, "故事稿操作失敗，請稍後再試。"];
      return errorResponse(code, message, status);
    }
  };
}
module.exports = { createMatchStoryPost };
