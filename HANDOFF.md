# HANDOFF — LoL 影片生成器

> 2026-08-10 由 Codex 更新。整合 PR #5 已合併到 GitHub `main`；原本 dirty `main` 工作目錄沒有被 reset、clean、checkout 或覆蓋。

## 本輪狀態

- GitHub `main`：PR #5 已於 `d91c5a2f7cf374c8c739999b3cd5dc305b5394ea` 合併；原始整合 head 為 `22f8a1fd449e5409aaeee16f68ec18e7dde6d311`。
- 永久救援：`rescue/2026-08-09-main-wip` 指向 `8550fe8c0f9bdba116de46846a4b655a5f9a69c3`；外部救援副本在 `/Users/cengweiting/Developer/lol-video-generator-rescue-20260809.PIixWe`。
- 原本 34 個未提交路徑已整合成 rescue commit；Player Radar 的 30 個原始 commits 已完整搬入。
- 壞掉的 Player Radar worktree 已修復連結，實體仍在 `.worktrees/player-radar-dual-read/`，沒有 prune。
- 2026-08-10 依產品決策將本機與外部 runtime 救援副本的歷史影片資料歸零；Git、原始內容資料與 tracked 示範素材未刪除。

## 這輪完成的能力

1. 發佈佇列、每日執行紀錄與 `public/publish-packages/` 改為每次操作時解析目前 worktree，不再把測試 clip 或 dry-run 寫進另一個專案。
2. 保留 Daily one-click、Leaguepedia cooldown／BotPassword 登入、標準化 API 錯誤與 Player Radar 雙讀證據鏈。
3. 保留 GitHub 線的唯讀展示、無 shell 渲染、呼叫者提供音樂及帳號識別資訊不進 log。
4. 合併更新 Next／Sharp／PostCSS／nanoid／Undici／fast-uri，沒有降低 `npm audit --audit-level=high` 閘門。
5. Daily one-click 的預設發布日曆固定為 `America/Los_Angeles`，避免 GitHub UTC runner 把「昨天」算成不同日期；呼叫端仍可明確覆寫時區。
6. Leaguepedia 限流判斷改成線性片語搜尋，並移除 Player Radar 無效的數字自我替換，處理 PR #5 的兩個 CodeQL 警報。

## 依賴版本

- Next `16.3.0`
- Sharp `0.35.3`
- PostCSS `8.5.23`
- nanoid `3.3.18`
- Undici `7.29.0`
- fast-uri `3.1.5`

## 驗證證據

- `npm ci`：通過，`found 0 vulnerabilities`
- `npm run tdd:doctor`：通過
- `npm run test:coverage`：453 tests；451 pass、2 個外部 LoLalytics contract tests skipped、0 fail；line 96.84%、branch 80.31%、function 96.23%
- 惡意重複 Leaguepedia 前綴的限流判斷：修正前約 169ms，修正後約 2.5ms
- `TZ=UTC node --test tests/unit/esports/dailyOneClick.test.js`：2/2 通過，涵蓋 GitHub runner 與本機時區差異
- `npx next build`：通過；26 個頁面／API route 建置完成
- `npm audit --audit-level=high`：通過，0 vulnerabilities
- 歷史影片歸零後驗收：queue 0、daily runs 0、78/78 內容題目為 `READY`、舊影片／社群引用 0、既定刪除路徑殘留 0。
- 歸零後重跑 queue isolation 與 content store：20/20 通過；新增 daily-run worktree 隔離回歸測試後，全套為 454 tests、452 pass、2 個外部 contract tests skipped、0 fail。
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

- Next build 有 2 個動態檔案路徑追蹤 warning；不阻塞建置，但可能增加部署包體積。
- Google Fonts 的一支外部 Outfit woff2 回傳 404，瀏覽器使用既定 fallback；頁面本身可開且沒有 server error。
- Player Radar 前約 1.5–2 秒主數據才進場，屬 Shorts 留存風險；另開視覺節奏工單，不和本輪救援混改。
