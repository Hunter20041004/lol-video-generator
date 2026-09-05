# 免費臨時發布通道安全設計

日期：2026-09-05  
狀態：待使用者書面規格確認  
範圍：在沒有自有網域的前提下，安全完成 Instagram／Threads 重新授權、平台取片與真實發布前 QA

## 1. 產品結果

使用者仍只從 `http://localhost:49761/` 操作 Hextech Video Studio。系統建立一個免費、臨時的 HTTPS 網址供 Meta 回傳授權結果與下載已選定的 MP4；網際網路訪客不能打開工作台、掃描資料或其他 API。臨時網址失效時，系統清楚回報必須重開通道並更新 Meta callback，不把 DNS 失效誤認成帳號或影片錯誤。

真實發布維持既有雙重閘門：先產生並驗證影片，再列出影片、平台、已核實帳號與貼文內容；使用者明確確認前不得建立或送出平台貼文。

## 2. 白話架構

臨時通道像大樓外的一扇訪客小窗：不是把整棟工作室門打開。小窗前增加一個本機 gateway，只轉送兩類請求：Meta 的 OAuth callback，以及對單支 `/renders/*.mp4` 的 `GET`／`HEAD`。其他方法與路徑一律回 404，不透露內部是否存在。

```text
本機使用者 ── localhost:49761 ──> Studio / 授權起點
                                      │ 建立一次性 challenge
                                      ▼
Instagram / Threads ── HTTPS ──> Quick Tunnel
                                      │
                                      ▼
                              path allowlist gateway
                                ├─ OAuth callback ──> Studio
                                ├─ selected MP4 ────> renders
                                └─ everything else ─> 404
```

## 3. OAuth 防偽與帳號保護

- 每次從本機開始 Instagram 或 Threads 授權時，用系統密碼學亂數建立至少 256-bit nonce。
- `state` 只包含平台、語言及不可猜 nonce；伺服器保存 nonce 的 SHA-256、建立時間、到期時間與是否使用，不保存 authorization code 或 token。
- challenge 十分鐘到期且只能使用一次。callback 缺少、錯平台、錯語言、過期或重播時，在交換 token 前以 400 拒絕。
- 錯誤 callback 也必須先驗證 state，避免攻擊者偽造看似可信的 Meta 錯誤頁。
- challenge store 位於 ignored `.data/`，以最小權限寫入，定期移除過期紀錄；不得寫入 git、console、HTML 或發布套件。
- 既有「預期帳號名稱」檢查保留。新 token 只有在 state 有效、token exchange 成功、profile 讀取成功且帳號名稱符合時，才原子更新 `.env.local`。
- 成功畫面只顯示平台、語言與帳號 username；不顯示 access token、authorization code、app secret 或完整錯誤回應。

## 4. 臨時公開 Gateway

- gateway 綁定 `127.0.0.1` 的獨立埠，不接受區網連線；Quick Tunnel 只指向 gateway，不直接指向 Studio。
- 公開 allowlist：
  - `GET /api/auth/meta/instagram/callback`
  - `GET /api/auth/meta/threads/callback`
  - `GET|HEAD /renders/<單層安全檔名>.mp4`
- 拒絕 `..`、編碼後 traversal、子目錄、非 MP4、query 指定檔案、其他 HTTP 方法、其他 API 與工作台頁面。
- 影片轉送保留 Range、Content-Type、Content-Length 與必要快取標頭，供 Meta 以 HEAD、分段或完整 GET 取片；不列目錄。
- callback 轉送只帶必要 request URL 與安全 headers；不將外部 `Host`、轉送鏈或任意認證 header 當可信輸入。
- 啟動成功後，同一個臨時 HTTPS origin 同步成 `META_REDIRECT_BASE_URL` 與 `PUBLIC_MEDIA_BASE_URL`。先驗證公開 root 為 404、callback 無有效 state 為 400、測試 MP4 HEAD/Range 正常，才標記 READY。
- 停止時關閉 gateway 與 cloudflared child；舊網址視為失效。Quick Tunnel 不承諾永久網址或 SLA。

## 5. 使用者操作與資料流

1. 系統啟動安全 gateway 與免費 Quick Tunnel，完成 allowlist 自測。
2. 【使用者操作】在 Meta Developer 後台把 Instagram 與 Threads 的合法 redirect URI 更新成系統列出的兩條精確 callback URL。一次只引導一個平台；不得把 app secret 或 token 貼進聊天。
3. 使用者從本機授權入口開始；伺服器建立一次性 state，Meta 登入後只回到公開 callback 小窗。
4. 系統驗證 state、交換 token、核實 username、保存本機憑證；再以平台 `/me` 唯讀查詢確認帳號。
5. 系統用已驗證 MP4 的公開 URL 執行 HEAD、Range GET 與完整可讀性檢查。
6. 系統重新跑發布 preflight，列出確切影片 SHA-256／預覽、Instagram username、Threads username、兩份貼文文案與公開／可見性結果。
7. 只有使用者確認後才呼叫真實 publish；發布後讀回平台 ID／permalink，並驗證各平台結果。單一平台失敗時不重發已成功平台。

## 6. 錯誤與恢復

- `AUTH_STATE_INVALID`／`AUTH_STATE_EXPIRED`／`AUTH_STATE_REPLAYED`：不交換 token，要求從本機重新開始。
- `ACCOUNT_MISMATCH`：不覆寫舊憑證，顯示預期與實際 username（不顯示 ID/token）。
- `TEMPORARY_GATEWAY_OFFLINE`：不建立發布工作，重新啟動通道並更新 Meta callback。
- `PUBLIC_MEDIA_UNREACHABLE`：不送平台容器；保留本機影片與文案供重試。
- Cloudflare、Meta 或 npm 安全服務不可用：採明確阻擋，不降級成公開整個 Studio，也不跳過驗證。

## 7. 測試與驗收

每項依垂直 TDD 執行，一次一個 red→green：

- OAuth challenge：有效、到期、平台／語言錯誤、重播、錯誤 callback、程序重啟讀回、敏感資料不落盤。
- callback contract：未驗證 state 時 token exchange 呼叫數為 0；有效 state 才交換並只保存核實帳號。
- gateway 真實本機 HTTP contract：所有 allowlist 路徑／方法、traversal、Range、HEAD、404、header 清理及關閉。
- tunnel orchestration：只將 gateway URL交給 cloudflared；雙 base URL 同步更新；健康檢查未通過不寫 env。
- 真實瀏覽器：本機 Studio 正常、公開 root/API 被擋、OAuth 成功與錯誤頁可讀。
- 真實平台唯讀帳號核實與 MP4 公開取檔通過後，才進入「待使用者確認發布」。
- 完整測試、Next build、npm high audit、兩輪桌機／手機截圖與核心流程驗收；任何閘門失敗都不合併、不 push、不部署。

## 8. 非目標與限制

- 不購買或設定自有網域，不承諾永久公開網址。
- 不把 Studio、候選資料、queue、內容資料庫或管理 API 公開。
- 不新增付費服務，不修改影片分析內容與素材決策。
- 不自動操作 Meta Developer 後台、不要求使用者分享密碼／secret／token。
- 本輪只支援既有中文 Instagram 與 Threads 帳號；英文帳號不自動連接或發布。
