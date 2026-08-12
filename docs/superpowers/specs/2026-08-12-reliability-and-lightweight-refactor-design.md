# LoL 產片可靠度與專案輕量化設計

## 背景

目前 `main` 已完成未提交內容救援、worktree 修復、歷史影片歸零、發布佇列隔離、18 個 Dependabot 警報修復，以及三首授權音樂的正式曲庫整合。現有 CI、CodeQL、Next build 與 `npm audit --audit-level=high` 均通過。

剩餘問題分成五類：Gemma 最差約等待 120 秒、Turbopack 追蹤兩個動態檔案路徑、GitHub Actions v4 使用即將淘汰的 Node 20 runtime、Outfit 字體依賴外部 Google Fonts，以及 Player Radar 的主要數據進場太晚。專案另有少量歷史相容檔、一次性遷移工具、測試 fixture 與重複 Remotion 頂層相依，可在不改變產品能力的前提下移除或搬遷。

## 目標

- 自動產片的 AI 等待總預算降至 30 秒；逾時後立即使用既有 deterministic fallback。
- 將不再維護的 `@google/generative-ai` 遷移到 Google 建議的 `@google/genai`，並真正取消逾時請求。
- 讓 `npx next build` 不再出現目前兩個 dynamic filesystem tracing warnings。
- 將 GitHub CI 的 `actions/checkout` 與 `actions/setup-node` 升到 v7，同時維持專案測試 Node 22。
- 將 Outfit 改為 repository 內的授權字體資產，網頁與 Remotion 不依賴執行時外部字體網址。
- Player Radar 在前 0.5 秒顯示選手與最強證據，Hook 最長 45 frames，主要比較資料不晚於 1.5 秒進場。
- 移除或搬遷能以引用圖、入口、測試與建置共同證明不再屬於產品 runtime 的內容。
- 保留作品集證據、授權音樂、救援資料與設計歷史。

## 非目標

- 不建立新的正式部署平台或付費雲端資源。
- 不變更 Instagram／Threads 發布產品行為、queue schema 或內容資料庫 schema。
- 不執行正式社群發布，不建立發布任務。
- 不刪除 `public/audio/`、`THIRD_PARTY_ASSETS.md`、作品集 MP4／PNG、`docs/superpowers/` 歷史文件、rescue refs、外部救援副本或 `.worktrees/`。
- 不以刪除測試或降低 coverage／audit 閘門換取表面上的輕量化。
- 不使用子代理。

## 核准方案

採用「可靠度優先、保守清理」：每項行為修改各自完成一個垂直 TDD 循環，再進入下一項。輕量化只處理已確認沒有產品入口的程式、只供測試使用的 fixture、已完成使命的一次性遷移工具，以及可由必要 Remotion 套件間接提供的重複頂層宣告。

不採用兩個備援方向：第一，不只加 `turbopackIgnore` 來隱藏 warning，因為那沒有縮小檔案路徑信任範圍；第二，不刪作品集與歷史設計文件，因為它們幾乎不影響執行重量，卻承擔 GitHub 展示與救援追溯價值。

## AI 可靠度

### 現況與根因

`reasoning.js` 使用舊版 `@google/generative-ai`，以 `Promise.race` 包裝 60 秒 timer，並最多嘗試兩次。這會造成最差約 120 秒等待；timer reject 也不保證底層 HTTP 請求中止。

### 設計

- 建立可測試的 GenAI client 邊界，使用 `@google/genai`。
- 自動產片預設只發出一次請求，timeout 預設 30,000ms。
- timeout 必須傳入 SDK／HTTP 層並取消實際請求，不留下背景中的第二個請求。
- AI 成功時沿用目前的 JSON extraction、schema normalization 與官方 patch repair。
- timeout、空回應、無效 JSON 或 schema failure 均沿用既有 deterministic fallback；fallback 不寫 queue。
- 日誌只記錄 model、attempt、duration、result kind 與錯誤分類，不記 API key 或完整 prompt。
- 保留環境變數覆寫 timeout 的能力，但合法範圍限制為 1,000–60,000ms；重試次數不再由 production 自動產片使用。

## 動態檔案路徑

### Gatekeeper

`videoExists` 不再對呼叫端提供的任意路徑直接執行 `existsSync`。本機影片必須解析到目前 worktree 的 `public/renders` 之內；路徑穿越、其他 worktree 絕對路徑與任意系統檔案都視為不存在。測試涵蓋有效 render、HTTP URL、`../`、同前綴旁路目錄及外部絕對路徑。

### Tunnel 環境持久化

正式程式只更新目前 worktree 固定的 `.env.local`。測試若需要隔離，傳入完整、已解析的測試 env path，而不是讓 production helper 接受任意 `cwd + fileName`。寫入仍保留既有 key replacement 行為，且不把 secret 印進 log。

成功標準是 `npx next build` 完成 26 routes 且沒有 dynamic filesystem tracing warning；不能只靠忽略註解達標。

## GitHub Actions

- `.github/workflows/ci.yml` 使用 `actions/checkout@v7` 與 `actions/setup-node@v7`。
- `node-version` 保持 `22`；Action 自己的 Node 24 runtime 與產品 Node 版本是兩件不同的事。
- 保留現有最小權限、concurrency、25 分鐘 timeout 及 CI parity 順序。
- 靜態契約測試先要求 v7，再修改 workflow。

## 字體

- 使用 Google Fonts 官方 repository 的 Outfit WOFF2 與 OFL 授權，將實際使用的 300、400、600 字重最小集合納入 `public/fonts/`。
- Cinzel 目前確實被工作台標題與模式切換使用，因此一併納入 400、700 字重，不保留外部字體請求。
- 網頁以 `app/globals.css` 的本機 `@font-face` 載入 Outfit／Cinzel，設定 `font-display: swap`；移除 Google Fonts `@import`。
- Remotion 以一個共用的 FontFace loader 從 `staticFile("fonts/...")` 載入 Outfit，並用 Remotion `delayRender`／`continueRender` 等待字體就緒，不在算圖期間請求 fonts.googleapis.com 或 fonts.gstatic.com。
- `THIRD_PARTY_ASSETS.md` 補上 Outfit、Cinzel 與 OFL 來源／範圍。

## Player Radar 節奏

- 保持現有暗色 Hextech broadcast 視覺、色彩、字體層級與四段敘事，不重新設計整支影片。
- Hook 的第一個可見畫面在 0.5 秒內同時顯示選手名稱與 strongest evidence（優先第一個 matchup reason；沒有時使用 proof pill）。
- 預設 Hook 從 86 frames 縮到 45 frames；其他 scene 只在維持字幕可讀性時做最小調整。
- 動效只使用 Remotion 的 transform／opacity；入口保持快速、無 `scale(0)`，數據不因裝飾動畫延後可讀。
- 驗收包含 frame 0、15、45 與第一個 matchup scene 的 still，以及完整 H.264/AAC 直式影片；中英文都要檢查文字 fit。

## 輕量化範圍

### 預計移除

- `scraper.js` 與 `package.json.main`：只有 2026-07-04 的相容 proxy，正式 route 已直接使用 `PatchDataParser`。
- `src/components/SocialComments.jsx`：沒有 runtime、測試或文件入口。
- `src/components/SubtitleOverlay.jsx`：未被 composition 引用，已由 `SubtitleCaption` 取代；同步更新只把它當靜態字串掃描對象的測試。
- `src/parsers/SocialScraper.js`：沒有入口且只回傳空陣列。
- `src/components/charts/RadarChart.jsx`：目前 Player Radar 明確不渲染它；移除只測試這個孤立 dead component 的測試段落。
- `utils/pipelinePruner.js` 與 `tests/unit/pipelinePruner.test.js`：一次性 retired-pipeline 清理已完成，沒有 script、route 或 runtime consumer；保留 `pipelineRegistry`、API guards 與防止退休 route 回歸的靜態契約。
- `scripts/manageCache.js` 與四個 `cache:*` package scripts：沒有 README／產品入口，現行 AI 呼叫也不使用 cached content；避免為一個孤立維護指令保留整套舊 SDK。

### 預計搬遷

- `utils/esports/sampleData.js` 搬到 `tests/fixtures/esports/sampleData.js`，更新測試引用與 coverage manifest。產品 runtime 不再包含測試 sample factory。

### 相依精簡

- 直接保留程式與命令實際需要的 `remotion` 與 `@remotion/cli`。
- 其他沒有任何直接 import 的 `@remotion/*` 僅在確認由保留套件的相同鎖定版本提供、`npm ci` 與所有 render 命令成功後，移除頂層宣告。
- `react`、`react-dom`、Next、Playwright、YAML 與實際 parser／scheduler 相依保持明確 direct dependency，不以偶然的 transitive dependency 取代直接使用。
- 將 `@google/generative-ai` 替換為 `@google/genai`，不為已移除的 cache manager 同時保留兩套 SDK。

### 明確保留

- 三首授權 MP3、正式曲庫 JSON 與第三方資產聲明。
- `public/demo/meta-tier-ranking.mp4`、工作台 PNG、avatar PNG／SVG 與 favicon；若 avatar 格式出現重複，只有在畫面與 README 引用驗證後才另列候選，本輪不預設刪除。
- PRD、`docs/superpowers/plans`、`docs/superpowers/specs`、發布說明及講稿。
- `.data`、`.env*`、`.worktrees`、rescue refs 與外部 rescue directory。

## 資料安全與錯誤處理

- 開工與收尾都確認 Git status；不 reset、clean、checkout 或覆寫未提交內容。
- 測試與 canary 前後記錄內容 DB SHA-256，並確認 publish queue／daily runs 未新增。
- 不執行 `publish:run`、`publish:due`、`publish:scheduler` 或任何社群 POST。
- 字體與 SDK 只從官方來源取得；授權與版本進版。
- 任一候選只要出現 runtime import、README／作品集契約或無法解釋的 build trace，就從刪除清單撤回。
- 依賴精簡若使 clean `npm ci`、Remotion CLI 或真實 render 失敗，立即恢復該 direct dependency，不以手動安裝補洞。

## TDD 與驗收

每個行為採垂直切片：一次只新增一個失敗測試，確認因預期行為缺失而紅，再寫最小實作、確認綠、重構並維持綠。刪除 dead code 前先以入口圖與現有測試建立基線；刪除後跑最接近的 composition／API／render 測試。

最終驗收順序：

1. AI timeout／abort／fallback focused tests。
2. Gatekeeper path confinement 與 tunnel env persistence focused tests。
3. CI workflow 靜態契約。
4. 字體本機載入測試，並確認頁面沒有 Google Fonts request／404。
5. Player Radar storyboard／composition tests、關鍵 frames stills 與完整中英文 render。
6. Dead-code 引用圖重跑、`package.json` direct dependency 檢查與 clean `npm ci`。
7. `npm run tdd:doctor`。
8. `npm run test:coverage`，不得低於 80% line／branch／function。
9. `npx next build`，26 routes 且 0 filesystem tracing warnings。
10. `npm audit --audit-level=high`，0 vulnerabilities。
11. 前端 dev server 兩輪 1280×800／375×812 截圖自檢，最終頁面沒有橫向捲動或字體錯位。
12. GitHub CI 與 CodeQL 成功；Dependabot 仍為 0 open。

## 完成定義

使用者能在 AI 無回應時於 30 秒左右繼續產片；Player Radar 第一秒已看得到人物與證據；網頁及算圖不依賴外部 Outfit 網址；本機 build 無現有兩個警告；GitHub 不再顯示 Action Node 20 淘汰提醒。專案移除的每個檔案與相依都有可重跑證據，作品集、授權音樂、救援歷史及發布安全邊界完整保留。
