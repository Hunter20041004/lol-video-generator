function isLeaguepediaRateLimit(errorOrMessage = "") {
  if (errorOrMessage?.code === "LEAGUEPEDIA_RATE_LIMITED") return true;
  const message = typeof errorOrMessage === "string" ? errorOrMessage : errorOrMessage?.message || "";
  const normalizedMessage = message.toLowerCase();
  return (
    (normalizedMessage.includes("leaguepedia api returned error:") && normalizedMessage.includes("rate limit"))
    || normalizedMessage.includes("exceeded your rate limit")
    || normalizedMessage.includes("rate limited")
  );
}

function isLeaguepediaAuthError(errorOrMessage = "") {
  if (errorOrMessage?.code === "LEAGUEPEDIA_AUTH_FAILED") return true;
  const message = typeof errorOrMessage === "string" ? errorOrMessage : errorOrMessage?.message || "";
  return /Fandom bot authentication failed|Fandom bot credentials missing/i.test(message);
}

function formatRetryWindow(error) {
  const retryAfterSeconds = Number(error?.retryAfterSeconds || 0);
  if (!Number.isFinite(retryAfterSeconds) || retryAfterSeconds <= 0) return "約 15 分鐘";
  return `約 ${Math.max(1, Math.ceil(retryAfterSeconds / 60))} 分鐘`;
}

function formatRecoverySuggestion(error) {
  const retryWindow = formatRetryWindow(error);
  const spacer = retryWindow.startsWith("約") ? "" : " ";
  return `請先等${spacer}${retryWindow}再按一次。這段時間不要連續重刷，否則限流時間可能會延長。`;
}

function formatEsportsApiError(error, options = {}) {
  const message = error?.message || options.fallbackMessage || "Esports pipeline failed.";

  if (isLeaguepediaAuthError(error)) {
    return {
      success: false,
      code: "LEAGUEPEDIA_AUTH_FAILED",
      status: 401,
      recoverable: false,
      userMessage: "Leaguepedia Bot 登入失敗，暫時不能抓取完整賽事數據。",
      recoverySuggestion: "請重新產生 Fandom Bot Password，更新 FANDOM_BOT_USERNAME / FANDOM_BOT_PASSWORD，然後重啟 dev server。",
      error: message,
    };
  }

  if (isLeaguepediaRateLimit(error)) {
    const rawRetryAfterSeconds = Number(error?.retryAfterSeconds || 0);
    const retryAfterSeconds = rawRetryAfterSeconds > 0 ? rawRetryAfterSeconds : 15 * 60;
    return {
      success: false,
      code: "LEAGUEPEDIA_RATE_LIMITED",
      status: 429,
      recoverable: true,
      userMessage: "Leaguepedia 資料源目前限流，暫時不能抓取完整賽事數據。",
      recoverySuggestion: formatRecoverySuggestion(error),
      retryAfterSeconds,
      cooldownUntil: error?.cooldownUntil || undefined,
      error: message,
    };
  }

  if (error?.code === "ESPORTS_ASSETS_MISSING") {
    const missing = (Array.isArray(error.missing) ? error.missing : []).map((entry) => ({
      kind: String(entry.kind || "asset"),
      ...(entry.playerId ? { playerId: String(entry.playerId) } : {}),
      ...(entry.publicName ? { publicName: String(entry.publicName) } : {}),
      ...(entry.team ? { team: String(entry.team) } : {}),
      ...(entry.season ? { season: String(entry.season) } : {}),
      ...(entry.matchDate ? { matchDate: String(entry.matchDate) } : {}),
    }));
    return {
      success: false,
      code: "ESPORTS_ASSETS_MISSING",
      status: 422,
      recoverable: false,
      userMessage: `這場影片缺少 ${missing.length} 項正式素材，尚未開始算圖。`,
      recoverySuggestion: "請先把列出的選手照片與隊徽通過來源核准並匯入素材庫。",
      missing,
      error: message,
    };
  }

  return {
    success: false,
    code: options.code || "ESPORTS_PIPELINE_ERROR",
    status: options.status || 500,
    recoverable: false,
    userMessage: options.fallbackMessage || "Esports pipeline failed.",
    recoverySuggestion: options.recoverySuggestion || "",
    error: message,
  };
}

module.exports = {
  formatEsportsApiError,
  isLeaguepediaAuthError,
  isLeaguepediaRateLimit,
};
