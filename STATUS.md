# 專案現況 — LoL 影片生成器

> 2026-08-10 更新。詳細救援與驗證證據見 `HANDOFF.md`。

## 產品

這是把《英雄聯盟》改版與賽事資料做成直式影片的 Next.js + Remotion 工具，包含：

- 版本改動工廠
- 電競賽事 Daily one-click
- Player Radar 雙讀短影音
- Meta 內容工廠
- Instagram／Threads 發佈與成效控制台

## 本輪狀態

- `codex/lol-recovery-security` 已整合最新 GitHub `main`、34 路徑未提交救援及 Player Radar 30 commits。
- 測試與發佈佇列已隔離，不再因 Node module cache 把另一個 worktree 的 cwd 固定成寫入目標。
- 依賴安全圖在本機 `npm audit --audit-level=high` 為 0。
- Daily one-click 的「昨天」已固定採洛杉磯發布日曆，UTC CI 與本機會選到相同賽事日期。
- PR #5 首輪 CodeQL 找到的多項式正規表示式與無效自我替換已用測試保護並修正。
- CI 等價驗證、production build、6 張 QA stills 與 Player Radar H.264 片段均通過。
- 原本 dirty `main`、rescue ref、外部救援副本與 runtime queue 都仍保留。

## GitHub 待確認

- 整合分支已推送為 PR #5；等修正版 CI 全綠再合併 `main`。
- 合併後用兩種分頁方法重算 Dependabot；目前 GitHub snapshot 是 18 open alerts。
- 讓 #2、#3、#4 在整合修補後標記為 superseded，不要直接合併三張紅 PR。

## Runtime 待人工決策

- 26 個 QUEUED、10 個 FAILED、8 個 MANUAL_DELETE_REQUIRED 歷史任務仍在主 queue。
- 多數非 PUBLISHED 任務已沒有本機影片；不可直接跑 queue。
- Player Radar worktree 的 2 筆 QUEUED 是測試污染，不是真實待發內容。

## 已知非阻塞項目

- Next 16.3 build 的 2 個動態 filesystem tracing warnings。
- Google Fonts 外部 Outfit 檔 404，現有 fallback 正常。
- Player Radar 開頭資料進場約慢 1.5–2 秒，可能影響 Shorts 留存。
