# 專案現況 — LoL 影片生成器（lol-video-generator）

> 由 Claude 於 2026-07-23 整理。**新對話請先讀這份**。

## 這是什麼

**《英雄聯盟》改版資訊自動化影音生成** — 把賽事／改版資料自動做成影片內容。
（相關企劃書：`prd/`）

## 技術棧

- **Next.js** + **Remotion**（用 React 寫影片，`durationInFrames` 那套）
- `app/`、`src/`、`utils/`、`config/`、`scripts/`、`tests/`
- `public/render-assets/`、`public/avatars/` — 影片素材
- `reasoning.js`、`fetchAsset.js` — 資料處理

## 這是你用 Codex 最多的專案

Codex 對話紀錄顯示 **90 場對話**都在這個專案（佔全部的 4 成），
主題包括：賽後影片管線、選手雷達影片、管線修剪與工作台重設、每日系列影片。

## 2026-07-23 的整理

1. 從 `~/lol-video-generator`（更早是 `~/Desktop/lol-video-generator`）搬到 `~/Developer/`
2. **刪除已發布的舊影片**：`public/renders/`（499M、68 支）與 `tmp/`（136M）
   —— 你說影片都發布過了不需要留
3. 相關的 1.8GB Codex 對話紀錄（內含大量 base64 圖片傾印）已刪除

## ⚠️ 已知狀況

- `node_modules` 約 **1.5GB**（最肥的專案）；長期不開發的話可刪掉，
  要用時 `npm install` 就回來
- 最後 commit 是 2026-07-08（`chore: ignore local worktrees`），
  以及 player radar dual-read 的設計與實作計畫

## 下一步

若要接續，先看 `docs/` 裡的 **player radar dual-read** 設計與計畫。
