# HANDOFF — LoL 影片生成器

> 2026-08-10 由 Codex 更新。這份狀態以 `codex/lol-recovery-security` 為準；原本 dirty `main` 工作目錄沒有被 reset、clean、checkout 或覆蓋。

## 本輪狀態

- 整合分支：`codex/lol-recovery-security`，以 GitHub `main` 的 `07bacdbdee98ee408b2c0d590f97db6c5ede28fd` 為基線。
- 永久救援：`rescue/2026-08-09-main-wip` 指向 `8550fe8c0f9bdba116de46846a4b655a5f9a69c3`；外部救援副本在 `/Users/cengweiting/Developer/lol-video-generator-rescue-20260809.PIixWe`。
- 原本 34 個未提交路徑已整合成 rescue commit；Player Radar 的 30 個原始 commits 已完整搬入。
- 壞掉的 Player Radar worktree 已修復連結，實體仍在 `.worktrees/player-radar-dual-read/`，沒有 prune。

## 這輪完成的能力

1. 發佈佇列與 `public/publish-packages/` 改為每次操作時解析目前 worktree，不再把測試 clip 寫進另一個專案。
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
- `npm run qa:render`：6/6 個 1080×1920 stills 均大於 25 KB
- Player Radar H.264：`/tmp/lol-recovery-player-radar.mp4`，1080×1920、30fps、540,931 bytes
- 最終桌面／手機截圖：`.screenshots/round2-desktop.png`、`.screenshots/round2-mobile.png`
- 正式主佇列 SHA-256 測試前後相同：`225bc1a66d7324553ca65171313794729f7897355792249b92e7dc248d19a98b`
- 整合 worktree 沒有產生 `.data/publish-queue.json`。

## Runtime 資料限制

- 主 queue 共 379 筆；歷史盤點為 PUBLISHED 335、QUEUED 26、FAILED 10、MANUAL_DELETE_REQUIRED 8。
- 非 PUBLISHED 任務的影片檔仍大量缺失；GitHub 不包含 `.data/`、renders、publish packages 或 tmp，不能從遠端自動補回。
- Player Radar worktree 的 2 筆 QUEUED 是測試污染證據，不要執行；這輪只阻止新污染，沒有刪除舊資料。

## 剩餘限制與下一步

- GitHub 目前仍會顯示 18 個 open Dependabot alerts，直到安全 lockfile 推上分支並進入 default branch 後才能確認自動關閉。
- PR #2／#3／#4 的舊紅燈根因是各自只修一個套件，而 audit 掃整本 lockfile；整合 PR 綠後再讓它們 superseded。
- Next build 有 2 個動態檔案路徑追蹤 warning；不阻塞建置，但可能增加部署包體積。
- Google Fonts 的一支外部 Outfit woff2 回傳 404，瀏覽器使用既定 fallback；頁面本身可開且沒有 server error。
- Player Radar 前約 1.5–2 秒主數據才進場，屬 Shorts 留存風險；另開視覺節奏工單，不和本輪救援混改。

整合 PR：GitHub #5。等修正版 GitHub Actions 全綠後合併，再重新校準 Dependabot 警報數、處理舊 PR 並檢查既有 production 部署。
