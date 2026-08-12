# HANDOFF — LoL 影片生成器

> 2026-08-12 由 Codex 更新。本輪在隔離的 `codex/reliability-lightweight` worktree 完成；沒有 reset、clean、覆蓋 runtime 資料或執行任何社群發布。

## 本輪狀態

- 本輪 9 個實作提交已完成 AI latency、filesystem confinement、Actions runtime、本機字型、Player Radar 開場、死碼清理、Remotion 依賴瘦身與發布錯誤邊界測試。
- AI 模型透過 `utils/genaiClient.js` 單次呼叫，預設 timeout 30,000ms，可設定範圍 1,000–60,000ms；逾時仍交給既有 deterministic fallback。
- repository-hosted Outfit／Cinzel 已同時供 Next 與 Remotion 使用；Remotion 改用 CSS `@font-face`，避免長片持有未清除的 `delayRender` handle。
- Player Radar 預設 Hook 86→45 幀，timeline 從 frame 0 開始；開場優先顯示第一個 matchup evidence，缺少時才回退到 proof pill。
- runtime 清理只處理 Git 可回復且無入口的程式碼；歷史 runtime 影片已依 2026-08-10 的產品決策歸零，本輪未再刪除媒體或內容資料。
- Remotion 直接依賴 14→2（`@remotion/cli`、`remotion`）；CLI 所需 renderer 等仍由 lockfile 正常帶入。
- 目前待完成：合併 `main`、在 `main` 重跑全套、push，等待 GitHub CI／CodeQL，再重算 Dependabot 與 open PR。

- GitHub `main`：PR #5 已於 `d91c5a2f7cf374c8c739999b3cd5dc305b5394ea` 合併；原始整合 head 為 `22f8a1fd449e5409aaeee16f68ec18e7dde6d311`。
- 永久救援：`rescue/2026-08-09-main-wip` 指向 `8550fe8c0f9bdba116de46846a4b655a5f9a69c3`；外部救援副本在 `/Users/cengweiting/Developer/lol-video-generator-rescue-20260809.PIixWe`。
- 原本 34 個未提交路徑已整合成 rescue commit；Player Radar 的 30 個原始 commits 已完整搬入。
- 壞掉的 Player Radar worktree 已修復連結，實體仍在 `.worktrees/player-radar-dual-read/`，沒有 prune。
- 2026-08-10 依產品決策將本機與外部 runtime 救援副本的歷史影片資料歸零；Git、原始內容資料與 tracked 示範素材未刪除。
- 歸零後第一組 canary dry run 已用 26.13 Aphelios 產生中英文影片；未建立 queue、daily run 或遠端貼文。
- Aphelios 內容錯標已用 TDD 修正；正式 canary 的四段畫面依序顯示 Calibrum、Severum、Infernum、Crescendum，中英皆沒有 `E 技能`／`Base Stats`。
- 專案擁有者於 2026-08-11 確認三支 BGM 可用於成品並可隨 GitHub repository 再散布；正式曲庫、SHA-256 與第三方權利聲明已納入 tracked source。

## 這輪完成的能力

1. 發佈佇列、每日執行紀錄與 `public/publish-packages/` 改為每次操作時解析目前 worktree，不再把測試 clip 或 dry-run 寫進另一個專案。
2. 保留 Daily one-click、Leaguepedia cooldown／BotPassword 登入、標準化 API 錯誤與 Player Radar 雙讀證據鏈。
3. 保留 GitHub 線的唯讀展示、無 shell 渲染及帳號識別資訊不進 log；本機算圖會從已驗證正式曲庫自動選歌，呼叫者仍可覆蓋或以 `null` 靜音。
4. 合併更新 Next／Sharp／PostCSS／nanoid／Undici／fast-uri，沒有降低 `npm audit --audit-level=high` 閘門。
5. Daily one-click 的預設發布日曆固定為 `America/Los_Angeles`，避免 GitHub UTC runner 把「昨天」算成不同日期；呼叫端仍可明確覆寫時區。
6. Leaguepedia 限流判斷改成線性片語搜尋，並移除 Player Radar 無效的數字自我替換，處理 PR #5 的兩個 CodeQL 警報。
7. PATCH 解析器接受 `【段落】\n內容`，具名武器不再從單字內誤判 Q/W/E/R；同數量的 AI 場景也會被官方 patch 具名段落強制修復。
8. AI 回傳字串型 `metrics` 時，只保留可安全拆成名稱／before／after 的項目；無法解析的字串會丟棄，再由官方 patch 原文補齊。
9. 正式曲庫 `config/licensed-music-library.json` 只選 `enabled + verified + SHA-256 相符` 的曲目；中英雙語每次只選一次並共用同一首。

## 依賴版本

- Next `16.3.0`
- Sharp `0.35.3`
- PostCSS `8.5.23`
- nanoid `3.3.18`
- Undici `7.29.0`
- fast-uri `3.1.5`

## 驗證證據

- 2026-08-12 CI parity：`npm ci`、`npm run tdd:doctor`、`npm run test:coverage`、`npx next build`、`npm audit --audit-level=high` 全通過。
- 覆蓋率：500 tests、498 pass、2 個外部 LoLalytics contract skip、0 fail；line 94.28%、branch 80.02%、function 96.37%。
- Production build：26 routes；`Dynamic filesystem access causes tracing` 計數 0。
- Remotion dependency canary：乾淨安裝後辨識 8 種 composition；`npm run qa:render` 的 6 種 still 全成功。
- Player Radar 完整 canary：`/tmp/player-radar-canary.mp4`，H.264／AAC、1080×1920、48kHz stereo、14.72 秒、1,189,093 bytes；使用已授權 `audio/bgm1.mp3`，沒有發布。
- Player Radar 動效審查：移除 35 幀 lead-in 與會遮資料的 stage spring；保留不改 layout 的背景光束與 badge 回饋，第一幀即可讀證據。
- 網站兩輪最終截圖：`.screenshots/reliability-round2-desktop.png`、`.screenshots/reliability-round2-mobile.png`；Outfit 200、Cinzel 200、375px scrollWidth=375、console 0 error／0 warning。
- 資料安全：隔離 worktree content DB absent、queue 0、daily runs 0、publish packages 0；主內容 DB SHA-256 仍為 `ff407d384b33d95c82ade5923f6ab174182cd08d4a7194e48d0e8e623130fef0`。

- `npm ci`：通過，`found 0 vulnerabilities`
- `npm run tdd:doctor`：通過
- `npm run test:coverage`：453 tests；451 pass、2 個外部 LoLalytics contract tests skipped、0 fail；line 96.84%、branch 80.31%、function 96.23%
- 惡意重複 Leaguepedia 前綴的限流判斷：修正前約 169ms，修正後約 2.5ms
- `TZ=UTC node --test tests/unit/esports/dailyOneClick.test.js`：2/2 通過，涵蓋 GitHub runner 與本機時區差異
- `npx next build`：通過；26 個頁面／API route 建置完成
- `npm audit --audit-level=high`：通過，0 vulnerabilities
- 2026-08-11 完整 CI parity：`npm ci`、`npm run tdd:doctor`、`npm run test:coverage`、`npx next build`、`npm audit --audit-level=high` 全通過；463 tests、461 pass、2 個外部 contract skip、0 fail；line 96.85%、branch 80.32%、function 96.24%。
- 歷史影片歸零後驗收：queue 0、daily runs 0、78/78 內容題目為 `READY`、舊影片／社群引用 0、既定刪除路徑殘留 0。
- 歸零後重跑 queue isolation 與 content store：20/20 通過；新增 daily-run worktree 隔離回歸測試後，全套為 454 tests、452 pass、2 個外部 contract tests skipped、0 fail。
- Aphelios canary：中英文皆為 H.264、1080×1920、30fps；中文 35.56 秒／19,544,129 bytes，英文 25.28 秒／14,369,308 bytes；內容 DB SHA-256 產片前後皆為 `ff407d384b33d95c82ade5923f6ab174182cd08d4a7194e48d0e8e623130fef0`。
- Canary runtime：`public/renders/render_1786426536139_zh.mp4`、`public/renders/render_1786426536139_en.mp4`；兩支音軌約 -91 dB，等同靜音；queue 與 daily runs 仍不存在。
- 修正版 Aphelios canary：`public/renders/render_1786459693643_zh.mp4` 與 `public/renders/render_1786459693643_en.mp4`；兩支皆 H.264／AAC、1080×1920、30fps，時長 35.41／35.56 秒。
- 修正版音訊驗收：兩支影片前 10 秒 PCM SHA-256 同為 `f28d8a1908e53533e4f92772e83ce46cc0617c1ed7c4773f7a2a92719ccf7d21`；平均音量約 -34 dB、峰值 -18.2 dB，確定是同一首非靜音 BGM。
- 修正版資料副作用：內容 DB SHA-256 仍為 `ff407d384b33d95c82ade5923f6ab174182cd08d4a7194e48d0e8e623130fef0`；publish queue 與 daily runs 仍不存在。
- `npm run qa:render`：6/6 個 1080×1920 stills 均大於 25 KB
- Player Radar H.264 曾通過 1080×1920、30fps 驗收；該暫存影片已隨歷史影片歸零刪除。
- 最終桌面／手機截圖：`.screenshots/round2-desktop.png`、`.screenshots/round2-mobile.png`
- 整合 worktree 沒有產生 `.data/publish-queue.json`。
- 合併後 detached `main` 再跑同一套 CI：453 tests、451 pass、2 skip、0 fail；build 與 audit 均通過。
- GitHub PR #5：CI、CodeQL actions、CodeQL JavaScript 與 PR security gate 全部通過。

## Runtime 資料限制

- 主專案、兩個 worktree 與外部 runtime 救援副本共刪除 2,040 個歷史檔案（87,819,029 bytes），包含 queue、daily runs、renders、publish packages、render assets 與舊內容資料庫快照。
- 主程式目前讀到 publish queue 0 筆、daily runs 0 筆；內容資料庫保留 78 個題目，78 筆全為 `READY`，舊 render／publish 結果與社群貼文 ID／網址引用為 0。
- `public/demo/meta-tier-ranking.mp4` 是 Git tracked 的產品示範素材，刻意保留；其餘 runtime 影片均已移除。
- Instagram／Threads 上既有公開貼文未做遠端刪除；本機已不再保留其貼文 ID，因此後續發布會視為全新任務。

## GitHub 與部署結果

- Dependabot 以 `per_page=1` 與 `per_page=100` 兩種分頁重算均為 0 open；18 筆全數為 `fixed`。
- PR #2／#3／#4 已各附上由 #5 取代的原因並關閉；沒有合併或刪除其分支。
- Repo 沒有 deployment workflow、Vercel／Netlify／Pages／Sites 設定；GitHub Deployments 為 0，因此這輪沒有可沿用的正式站可部署。

## 剩餘限制

- 這台 macOS 舊於 15，Remotion 會顯示相容性提醒；完整 H.264／AAC canary 與 QA still 均實測成功。
- `npm ci` 仍有 `whatwg-encoding`、`source-map@0.8.0-beta.0`、`node-domexception` 三個間接 deprecated 提示；audit 為 0，這輪不強制 override 間接依賴。
- Riot Data Dragon 偶爾回 HTTP 503；render asset 本機 fallback 已實測接手。
- Node coverage 會提示兩個 ES module 重新解析 warning；若要徹底消除需規劃全專案 ESM 遷移，不在本輪輕量化範圍。
- Repo 仍沒有既有 production deployment target；完成 GitHub push 後只驗證 source CI，不建立新付費站點。
