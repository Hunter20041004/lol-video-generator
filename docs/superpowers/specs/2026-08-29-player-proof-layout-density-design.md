# 賽後判讀：選手姓名、隊徽安全框與 MVP 證據密度設計

## 產品目標

修正 25 秒「賽後判讀」影片的三個閱讀問題：括號原名把選手主標擠成多行、部分含字樣隊徽與外加隊名形成遮擋／重複、MVP 資訊區位置偏低。完成後，觀眾先看到選手 ID，再看到兩項主數據與判讀，最後才讀到三項次要證據；任何 Leaguepedia 一級聯賽姓名或已核准隊徽都不得互相遮擋。

## 核准方向

採用視覺比較的 `A＋A1`：平衡上移約 96px，原名成為次標，隊徽依「純圖徽／內含字樣」模式顯示，底部新增 KDA、參團率與 GPM。延續現有 Broadcast Hero／Tactical Transmission 視覺、Barlow Condensed＋Noto Sans TC、霧金＋戰術青；不增加新字型、顏色、動畫或遠端素材。

## 資料與元件邊界

```text
Leaguepedia 系列資料
  → postMatchReadBuilder：拆分公開 ID／原名、建立次要證據
  → team crest manifest：提供 external-label／embedded-wordmark 顯示模式
  → PostMatchReadScenes：依固定安全區排版
  → Remotion still／影片與手機縮圖驗收
```

- `utils/esports/postMatchReadBuilder.js` 只負責資料語意，不負責像素。`publicPlayer()` 將尾端括號拆成 `name` 與 `originalName`，並套用到 matchup 與 proof player。
- `proof.secondaryEvidence` 固定按 `KDA → KP% → GPM` 排序，只輸出來源數字完整的項目；KP 由 0–1 比率轉為整數百分比。缺值不補 0、不改用無關指標。
- `config/esports-team-crests.json` 可選 `presentation.labelMode`：`external` 表示純圖徽、由模板補隊名；`embedded` 表示素材已含可讀 wordmark，模板不得再疊隊名。未設定時保留 `external`，避免既有素材靜默改變。
- `utils/render/teamCrestManifest.js` 與 `playerRadarAssetPlanner.js` 將受控的 `labelMode` 帶入 render model；未知值立即失敗，不能猜測。
- `src/templates/player-radar/PostMatchReadScenes.jsx` 只消費已解析資料，不在 render 時用圖片長寬比猜語意。

## 姓名排版

- 主標只顯示公開 ID，例如 `Taeyoon`；原名顯示為下一行 `KIM TAE-YOON`。
- 主標固定單行，使用依字數計算且有上下限的字級：短名維持現有衝擊力，長名逐步縮小，但不得小於 MVP 場景主數據字級。
- 原名採 NUMBER_FONT、全大寫、低對比 muted 色、約主標的 20–25%，固定單行；長原名可縮至安全下限，不用省略號隱藏身份。
- 沒有括號原名時不保留空白列。
- `proof.claim` 使用公開 ID，不再洩漏括號原名到其他觀眾文案。

## 隊徽安全框

- 每隊固定寬度與媒體框；圖片使用 `objectFit: contain`、置中、不拉伸、不裁切。
- `external`：媒體框下方保留明確間距後顯示隊名，隊名依長度縮字但固定單行。
- `embedded`：媒體框可使用完整高度顯示內建 wordmark，外加隊名完全省略；框下仍保留與另一隊一致的佔位高度，避免兩側垂直跳動。
- 先為使用者指出的 HANJIN BRION 標記 `embedded`；施工時產生所有已核准隊徽 contact sheet，逐一標記明確含完整隊名的 lockup。無法確認的維持 `external`，不裁圖猜測。
- 兩隊隊徽的外框、視覺中心與底線必須對齊；長隊名不得侵入另一隊或賽事標籤。

## MVP 資訊密度

- CSM／DPM 主數據、英雄池與判讀句相對目前位置整體上移 96px；維持既有進場節奏，不新增動態事件。
- 判讀句下方加入 `secondaryEvidence` 三欄：KDA、KILL PART.、GOLD / MIN。數字使用 tabular figures，字級與對比低於 CSM／DPM。
- 三欄以 1px 低對比分隔線和 8px 節奏對齊；若只有 1–2 項，使用等寬欄位重新排列，不留下破洞。
- 最底部保留來源標記和呼吸空間，不以裝飾填滿。畫面閱讀順序固定為 `公開 ID → 原名 → CSM/DPM → 英雄池 → 判讀 → 次要證據`。

## 動效

- 不新增動畫。沿用 `enterStyle()` 的 opacity＋transform 與 reduced-motion 行為。
- 上移透過靜態 layout token，不動畫 `top`、`margin`、width 或 height。
- 次要證據與判讀同一進場群組，避免第三個主動態事件。

## 錯誤與備援

- 姓名不符合尾端括號格式時整串視為公開 ID，不做可能傷害名稱的猜測。
- 次要證據缺值時省略該欄；三項全缺時省略整列並保留節奏，不阻擋 render。
- 隊徽 `labelMode` 未設定時使用 `external`；值不是 `external`／`embedded` 時阻擋 manifest 解析。
- 不新增外部依賴、不下載新素材、不修改素材像素或 SHA-256。

## TDD 與驗收

每個行為以單一垂直切片執行 `Red → Green → Refactor`：

1. proof player 尾端原名拆分與公開 claim。
2. KDA／KP%／GPM 次要證據及缺值縮排。
3. 隊徽 `labelMode` 契約與 render model 傳遞。
4. Remotion 姓名字級、安全框與 96px 上移的 composition contract。
5. 真實 Taeyoon 2026-08-27 fixture／canary render。

視覺驗收至少兩輪：

- 1080×1920 原始 still 與 375×667 等比例手機圖。
- Taeyoon、ShowMaker、素材庫最長公開 ID／原名。
- 純圖徽、embedded wordmark、橫式與直式隊徽。
- 主標、原名、照片、主數據、英雄池、判讀、次要數據、底部來源不得重疊或出界。
- 375px 預覽無裁字；文字層級和色彩不能只靠顏色區分。
- 動效 code review 必須確認沒有新增 layout-property animation，reduced-motion 契約維持。

完整收尾執行聚焦測試、coverage、Next build、audit、Remotion QA、Playwright、真實 canary 與 publish queue 零副作用檢查；合併 `main` 後重跑全套並驗證常駐 `http://localhost:49761/`。

## 限制與成本

- `presentation.labelMode` 是人工審核的素材語意；新增隊徽時需要一併判斷是否內含 wordmark，成本低但不能完全自動化。
- 次要數據只描述同一系列的資料表現，不等於官方 MVP；既有 `DATA MVP CANDIDATE` 誠實標籤不變。
- 本輪只修 MVP／結果幕排版，不重寫其他三個場景，也不改發布流程。
