const COPY = {
  "invalid-state": {
    eyebrow: "安全驗證未通過",
    title: (platform) => `${platform} 連線已失效`,
    body: "這次登入憑證可能已逾時、使用過，或不是由這台工作台發起。請回到工作台重新開始。",
    tone: "error",
  },
  "provider-error": {
    eyebrow: "平台未完成授權",
    title: (platform) => `${platform} 尚未連接`,
    body: "平台沒有完成這次授權。帳號資料與權限沒有更新。",
    tone: "error",
  },
  "connection-error": {
    eyebrow: "連線未完成",
    title: (platform) => `${platform} 連線失敗`,
    body: "系統沒有保存新的帳號權限。請回到工作台重新開始。",
    tone: "error",
  },
  success: {
    eyebrow: "帳號核實完成",
    title: (platform) => `${platform} 已連接`,
    body: "新的帳號權限已安全保存到這台電腦。",
    tone: "success",
  },
};

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[char]));
}

function renderMetaAuthPage({ platform, status, account = "" } = {}) {
  const name = String(platform || "Meta").toLowerCase() === "threads" ? "Threads" : "Instagram";
  const copy = COPY[status] || COPY["connection-error"];
  const accountRow = status === "success" && account
    ? `<p class="account" aria-label="已連接帳號">@${escapeHtml(String(account).replace(/^@/, ""))}</p>`
    : "";
  return `<!doctype html>
<html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(copy.title(name))} · Hextech Video Studio</title><style>
:root{--bg:#060b11;--panel:#101923;--line:#293745;--text:#eef1f3;--muted:#95a1ad;--gold:#dbb95d;--red:#e59aa4;--cyan:#74ced2}
*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;background:radial-gradient(circle at 50% 0,#132431 0,var(--bg) 55%);color:var(--text);font-family:Outfit,"Noto Sans TC",system-ui,sans-serif}
main{width:min(100%,620px);padding:48px;border:1px solid var(--line);border-radius:18px;background:rgba(16,25,35,.94);box-shadow:0 28px 80px rgba(0,0,0,.35);animation:enter 180ms cubic-bezier(.23,1,.32,1) both}
.brand{display:flex;align-items:center;gap:12px;margin-bottom:42px;color:var(--muted);font-size:13px;font-weight:750;letter-spacing:.14em}.mark{display:grid;place-items:center;width:38px;height:38px;border:1px solid var(--gold);color:var(--gold);font-size:11px;letter-spacing:.12em}
.eyebrow{margin:0 0 14px;color:${copy.tone === "success" ? "var(--cyan)" : "var(--red)"};font-size:12px;font-weight:800;letter-spacing:.14em}h1{margin:0;font-size:clamp(32px,7vw,52px);line-height:1.04;letter-spacing:-.035em;word-break:keep-all}p{margin:22px 0 0;color:var(--muted);font-size:17px;line-height:1.75}.account{display:inline-flex;padding:9px 14px;border:1px solid var(--line);border-radius:999px;color:var(--text);font-weight:700}
a{display:inline-flex;margin-top:34px;padding:13px 18px;border-radius:10px;background:var(--gold);color:#17130a;font-weight:800;text-decoration:none;transition:transform 150ms cubic-bezier(.23,1,.32,1),filter 150ms ease}a:active{transform:scale(.97)}a:focus-visible{outline:3px solid var(--cyan);outline-offset:4px}
@keyframes enter{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}@media(max-width:520px){main{padding:32px 24px}.brand{margin-bottom:34px}}@media(prefers-reduced-motion:reduce){main{animation:none}a{transition:none}}
</style></head><body><main><div class="brand"><span class="mark">HVS</span><span>HEXTECH VIDEO STUDIO</span></div><p class="eyebrow">${copy.eyebrow}</p><h1>${escapeHtml(copy.title(name))}</h1><p>${copy.body}</p>${accountRow}<a href="http://localhost:49761/">回到工作台重新開始</a></main></body></html>`;
}

module.exports = { renderMetaAuthPage };
