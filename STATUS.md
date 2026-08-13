# 專案現況 — LoL 影片生成器

> 2026-08-12 更新。詳細實作與驗證證據見 `HANDOFF.md`。

## 產品

這是把《英雄聯盟》改版與賽事資料做成直式影片的 Next.js + Remotion 工具，包含版本改動、電競賽事 Daily one-click、Player Radar、Meta 內容工廠，以及 Instagram／Threads 發佈與成效控制台。

## 本輪狀態

- 最新 Leaguepedia 實片演練發現並以 TDD 修正「同系列主客隊順序交換會被拆成兩組」；2026-08-12 的 HLE Challengers 對 HANJIN BRION Challengers 現在正確合併為三局 2-1。
- coverage gate 原本緊貼 80% 且受 Node 實驗性統計小幅波動；保留 80% 門檻並補上原始賽事聚合測試後，完整 coverage 連跑兩次均通過。
- 新的中文版 Player Radar canary 已加入授權 BGM 3 並輸出到本機；沒有建立 publish queue、daily run 或遠端貼文，舊 Aphelios canary 已依歷史影片歸零決策移除。
- AI 單次模型請求上限固定為 30 秒；逾時後走既有 deterministic fallback，不再等待 60–100 秒。
- runtime 檔案操作限制在核可的 `.data/`、`public/renders/`、`public/publish-packages/` 與暫存邊界；測試與 worktree 不會互相污染 queue。
- 網站與 Remotion 都改用 repository-hosted Outfit／Cinzel，沒有 Google Fonts 依賴或字型 404。
- Player Radar 第一幀即顯示來源證據，預設 Hook 從 86 幀縮成 45 幀；場景資料不再被入口動畫遮住。
- 已刪除 7 個無 runtime 入口的舊模組與 1 個完成使命的專用測試；假賽事資料已移到 `tests/fixtures/`。
- Remotion 頂層依賴由 14 個降成 2 個，乾淨安裝仍能辨識 8 種 composition 並完成 6 種 QA still。
- GitHub Actions 已更新到 Node 24 runtime 的主版 actions；安全閘門仍維持 `npm audit --audit-level=high`。

## 驗證摘要

- `npm ci`：通過，287 packages，0 vulnerabilities。
- `npm run tdd:doctor`：12 個 TDD slice 全通過。
- `npm run test:coverage`：502 tests；500 pass、2 個外部 contract skip、0 fail；line 94.29%、branch 80.19%（前一次 80.24%）、function 96.38%。
- `npx next build`：26 routes，0 個 dynamic filesystem tracing warnings。
- Player Radar 完整 canary：H.264／AAC、1080×1920、14.72 秒，含已授權 `bgm1.mp3`。
- 網站桌面／手機各兩輪自檢通過；375px 無橫向捲動，字型請求 200，console 0 error／0 warning。
- 隔離 worktree：queue 0、daily runs 0、publish packages 0；主內容 DB SHA-256 仍為 `ff407d384b33d95c82ade5923f6ab174182cd08d4a7194e48d0e8e623130fef0`。

## GitHub 與部署

- 上一輪 18 個 Dependabot alerts 已全部 fixed，舊 PR #2／#3／#4 已由 PR #5 取代並關閉。
- 本輪已合併並推送 `main`；code verification SHA `44091ff971114abb5afe31a4fd6dac538415a64b` 的 CI 與 CodeQL 全綠。
- Dependabot 用 `per_page=1`／`100` 都是 0 open，歷史 18 筆全為 fixed；open PR 兩種分頁都是 0，Code Scanning open 也是 0。
- 最新 checks 使用 `actions/checkout@v7`、`actions/setup-node@v7`，annotations 為 0，沒有 Node 20 deprecation。
- Repository 沒有 production deployment workflow、Pages 或既有正式站，因此不新增付費部署。

## 已知非阻塞項目

- 這台 macOS 舊於 15，Remotion 會顯示相容性提醒；完整影片與 QA still 實測均成功。
- `npm ci` 仍顯示 3 個間接套件 deprecated 提示；它們不是直接依賴，也不是安全漏洞。
- 外部 Riot Data Dragon 偶爾回 HTTP 503；既有本機 fallback 已在測試中接手，未阻斷渲染。
- Node 測試會提示兩個 ES module 重新解析的效能 warning；不影響 build 或產品行為，未為消除提示而把全專案改成 ESM。
