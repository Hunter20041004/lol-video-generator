# HANDOFF — LoL 影片生成器（lol-video-generator）

> 兩個貼上區塊：規劃找 🧠 Claude、實作找 🖐 Codex。由 Claude 於 2026-07-23 整理。
> 一句話現況：**上次成功自動發布一支「選手雷達」影片到 IG＋Threads，佇列還有舊任務沒處理。最後活動 2026-07-10。**

---
## ▼ 貼給 🧠 Claude（討論／規劃／決策）

我要規劃 LoL 影片生成器的下一步。先讀 `STATUS.md`。

這是《英雄聯盟》改版/賽事資訊自動化影音生成（Next.js + Remotion）。上次成功發了一支 HLE vs BLG 的選手雷達影片到 Instagram 和 Threads。

幫我想清楚：接下來要做哪種內容、要不要把「工具商業化」（我之前有討論過）、佇列裡的舊任務哪些還要跑。想清楚後切成工單。

我完全沒有程式背景，專有名詞第一次出現請先用白話解釋。

---
## ▼ 貼給 🖐 Codex（照計畫實作）

我要接續實作 LoL 影片生成器。先讀 `STATUS.md` 與 `HANDOFF.md`。

Next.js + Remotion（React 做影片）；`docs/` 有 player radar dual-read 的設計與計畫。

**這次要做的**：先幫我列出佇列裡還有哪些待發布/待處理的任務，我再決定要不要跑。

⚠️ 2026-07-23 已清掉 `public/renders/`（已發布的舊影片）與 `tmp/`；若流程需要那些檔案請告訴我。`node_modules` 若不在時可先 `npm install`。
