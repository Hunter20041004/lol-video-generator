# Meta 黑科技影片 LOL 質感重做設計規格

## 背景

目前 `META_OFFMETA_PICK` 黑科技影片雖然已經修正資料規則與中文文案，但視覺仍像工程 dashboard：框線太多、資訊一次攤開、綠色科技感過重、英雄 splash 只是背景素材，整體不像英雄聯盟內容頻道。

本次只重做黑科技影片模板的視覺呈現與節奏，不改資料抓取、不改候選規則、不改梯度榜單。

## 目標

讓黑科技影片從「後台資料頁」改成「高質感 LOL 短影音」：

- 第一眼要像英雄聯盟內容，不像 SaaS dashboard。
- 節奏要有呼吸感：版本掃描 → 英雄登場 → 核心玩法 → 試玩判斷。
- 核心裝備/符文要清楚，但不能用表格感壓滿畫面。
- 仍保留前次規則：沒有核心玩法資訊的出裝黑科技不可產片。

## 視覺方向

採用 **LOL 內容創作者高質感短影音版**。

主視覺語言：

- 深藍黑、金色、少量青綠魔法光。
- 大面積英雄 splash，搭配暗角、金色邊線、符文石/召喚峽谷感的細節。
- 減少等寬格子、資料表、膠囊按鈕和過多框線。
- 中文標題使用更穩重的高對比層級；資訊文字縮小、分段出現。

## 影片結構

### Scene 1：版本掃描

只顯示版本上下文，不顯示英雄卡。

內容：

- 版本
- 伺服器
- 分段
- 位置
- 黑科技類型

視覺：

- 全螢幕深藍符文背景。
- 一句主標：「版本黑科技掃描」或「先看版本條件」。
- 版本資訊用少量金色 metadata，不使用五格 dashboard。

### Scene 2：英雄登場

顯示英雄 splash 與主 hook。

內容：

- 英雄 + 位置
- 一句創作者語氣 hook
- 勝率 / 登場率 / 樣本數只做小型輔助資訊

視覺：

- 英雄 splash 必須是主角。
- 標題大，資訊少。
- 不顯示題材分、來源一致度、confidence、score。

### Scene 3：核心玩法

顯示觀眾真正要看的黑科技內容。

內容：

- 核心裝備
- 核心符文
- 這套在打什麼節奏

視覺：

- 裝備/符文用 icon + 名稱的 loadout strip。
- 不用表格；不顯示內部風險碼。
- 若是位置黑科技但也有裝備/符文，就同時顯示「位置反常」與「推薦玩法起手」。

### Scene 4：試玩判斷

給觀眾可執行的結論。

內容：

- 適合什麼情境試
- 什麼情境不要抄
- CTA

視覺：

- 左右兩欄結論卡，金色標「可以試」、紅金標「先別抄」。
- CTA 不遮擋主內容。

## 元件設計

`Template_MetaOffmeta.jsx` 將拆成更清楚的視覺元件：

- `CinematicBackdrop`：處理 hero splash、暗角、金色/青綠光暈。
- `VersionScanScene`：第一幕版本掃描。
- `HeroRevealScene`：英雄登場與小型 stats。
- `CoreLoadoutScene`：裝備/符文 icon loadout 與打法節奏。
- `TryOrSkipScene`：試玩/不要抄結論。

保留既有資料介面：

- `versionOverview`
- `coreItems`
- `coreRunes`
- `playerStats`
- `playerTakeaways`
- `storyboard`

## TDD 驗收標準

使用垂直 TDD，每次只寫一個失敗測試再實作。

第一個測試：

- 黑科技模板 source 必須包含四個 scene 元件。
- 黑科技模板 source 不得包含 dashboard 式 `VersionOverview` 五格表格主畫面。
- 黑科技模板 source 不得包含 `題材分`、`來源一致度`、`confidence`、`score` 作為可見內容。

第二個測試：

- render planner 的 zh payload 仍保留 `versionOverview`、`coreItems`、`coreRunes`、`playerStats`、`playerTakeaways`。
- payload 不輸出內部視覺指標。

第三個測試：

- 實際 Remotion still：frame 0 顯示版本掃描幕。
- frame 120 顯示英雄 splash 與主 hook。
- frame 240 顯示核心裝備/符文。

## 非目標

- 不重做梯度榜單模板。
- 不新增付費資料源。
- 不調整 LoLalytics / OP.GG 抓取邏輯。
- 不把影片做成賽事分析台風格。
- 不改前端工作台流程。

## 風險與處理

- 風險：中文長句在直式影片中容易爆版。
  - 處理：主 hook 限制兩行；takeaway 限制短句；仍用 Remotion still 檢查。
- 風險：素材抓不到時畫面質感下降。
  - 處理：保留現有 fallback，但背景用符文質感遮罩，不讓 missing image 成為主視覺。
- 風險：太像一般改版影片，黑科技感不夠。
  - 處理：用「掃描 / 玩法實驗 / 可以試 / 先別抄」語言維持黑科技定位。

