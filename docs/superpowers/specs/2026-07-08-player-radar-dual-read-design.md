# 選手雷達雙判讀影片設計規格

## 背景

目前 `PLAYER_RADAR` 影片是單一選手五維雷達：Hook、雷達圖、強弱指標、MVP 留言 CTA。這種內容像資料卡，沒有回答觀眾真正想知道的賽後問題：這一路到底贏輸在哪，以及誰最值得被記住。

本次將「選手雷達」改成一支影片內的雙判讀結構。它仍只產生一支 `PLAYER_RADAR` 影片，不新增第二支影片，也不併入每日賽事影片。影片會包含兩個內容片段：最大對位差距判讀，以及 MVP / 關鍵人物證明。

## 目標

- 取消舊的單人定位雷達主軸。
- 保留 `/api/esports/player-radar` 與工作台「產生選手雷達」入口。
- 一支影片同時回答「哪一路差距最大」與「誰最有 MVP / 關鍵人物 case」。
- 支援全自動選角，也支援通用或分開指定選手。
- 只使用 scan snapshot 中已有的 series、players、role matchups、raw stats、radar stats 與 recommended MVP，不編造會戰、龍團、巴龍或時間點敘事。

## 影片結構

新版 `PLAYER_RADAR` 使用固定四段：

1. `HOOK`
   - 丟出本片問題，例如「這場最大差距和 MVP，是同一個人嗎？」
   - 顯示 league、隊伍、比分與本片判讀主題。
2. `MATCHUP_EDGE`
   - 顯示五路中對位差距最大的一組，或手動指定的選手對位。
   - 左右比較同位置兩位選手。
   - 呈現 2 到 3 個差距理由，例如 KDA、DPM、KP%、GPM、CSM、VPM。
   - 最大差距不限制勝方；敗方打出最大差距也可以成為本段主角。
3. `PLAYER_PROOF`
   - 顯示 MVP 或指定關鍵人物。
   - 預設是系統推薦 MVP；若手動指定但不是系統 MVP，文案稱為「關鍵人物證明」，不硬說他是 MVP。
   - 呈現 3 個支撐理由，優先使用可驗證數據。
4. `CONCLUSION_CTA`
   - 如果最大對位差距選手和 MVP / 關鍵人物是同一位，結論收成「同一人同時拿下最大對位差與關鍵人物 case」。
   - 如果不同人，結論收成「最大對位差距在 A，但關鍵人物 case 在 B」。

字幕與標題避免空話，例如「真實形狀」「強項弱點浮出來」這類舊文案會移除，改成具體賽後判讀。

## Payload 設計

`PLAYER_RADAR` payload 從單人雷達改為雙片段語義：

- `matchupSegment`
  - `role`
  - `edgePlayer`
  - `opponentPlayer`
  - `edgeWinnerTeam`
  - `edgeScore`
  - `edgeType`: `winner-breakpoint` 或 `loser-highlight`
  - `reasons`
- `proofSegment`
  - `player`
  - `proofType`: `mvp` 或 `key-player`
  - `isRecommendedMvp`
  - `proofStats`
  - `proofReasons`
  - `verdict`
- `storyboard`
  - 固定為 `HOOK`、`MATCHUP_EDGE`、`PLAYER_PROOF`、`CONCLUSION_CTA`

舊欄位 `player`、`radarStats`、`highlight`、`weakness` 可以保留作為相容輔助，但不再主導影片內容。Remotion template 應優先讀取 `matchupSegment` 與 `proofSegment`。

## 選人規則

`playerRadarRunner` 仍從既有 scan snapshot 讀資料，不重新掃 Leaguepedia。

選人優先序：

- `playerName`：通用覆寫，兩個片段都用這位選手。
- `mvpPlayerName`：只覆寫 `proofSegment`。
- `matchupPlayerName`：只覆寫 `matchupSegment`。
- 都沒填：
  - `proofSegment` 使用 `recommendedMvp`。
  - 若 `recommendedMvp` 失效，使用平均 radar score 最高者。
  - `matchupSegment` 使用五路 `edgeScore` 最大的 role matchup，不管勝敗方。

手動指定規則：

- 指定選手不存在於 snapshot 時，直接失敗，不自動替換。
- 指定對位片段選手時，必須找到同 series、同 role、不同隊伍的對手。
- 指定 MVP / 關鍵人物時，即使該選手不是系統 MVP，也可以產出，但 `proofType` 必須是 `key-player`。

## 對位差距計算

對位片段應沿用或抽出現有 `contentPlanner` 中的 matchup edge 概念：

- 使用同 role 左右選手的平均 radar score 差距作為 `edgeScore`。
- `edgePlayer` 是分數較高者。
- `opponentPlayer` 是同位置另一方。
- `reasons` 從可用 raw stats 計算正向差距，優先順序包含 KDA、DPM、KP%、GPM，以及非輔助的 CSM 或輔助的 VPM。
- 如果最大差距在敗方，`edgeType` 標為 `loser-highlight`，畫面與文案要誠實呈現「敗方最亮點」而不是勝負突破口。

## MVP / 關鍵人物證明

證明片段不再只是展示五維圖，而是建立一個可被觀眾理解的 case：

- 預設 MVP：
  - 使用 `recommendedMvp`。
  - 若推薦 MVP 已不在 players 中，改用平均 radar score 最高者。
  - `proofType` 為 `mvp`。
- 手動指定：
  - 使用指定選手。
  - 若指定選手不是推薦 MVP，`proofType` 為 `key-player`。
- `proofReasons` 使用該選手 radar stats 與 raw stats 中最有說服力的 3 個指標。
- 不使用資料源沒有支撐的敘事，例如第幾分鐘會戰、龍團、巴龍團、選手溝通或心態。

## Template 設計

`Template_PlayerRadar.jsx` 會從舊的四幕改為雙判讀四幕：

- `HookScene`
  - 顯示 match context 與本片問題。
- `MatchupEdgeScene`
  - 左右對位版面。
  - 顯示 role、雙方選手、隊伍、英雄池或主要英雄。
  - 顯示 2 到 3 個差距理由。
- `PlayerProofScene`
  - 單人聚焦版面。
  - 顯示 MVP 或關鍵人物標籤、選手、隊伍、角色、3 個 proof reasons。
  - 雷達圖可作為輔助視覺，但不再是主畫面唯一內容。
- `ConclusionScene`
  - 對照兩段結果，給出一句可發布的結論與 CTA。

畫面語氣保留 LoL 電競資料感，但減少 dashboard 感與空泛科技字眼。影片要像賽後創作者判讀，不像選手資料頁。

## API 與工作台

API 仍使用 `POST /api/esports/player-radar`。

Request 支援：

- `scanId`
- `seriesId`
- `playerName`
- `mvpPlayerName`
- `matchupPlayerName`
- `languages`
- `scheduledAt`

工作台本次保留現有 `playerName` 欄位，並新增兩個可選欄位：

- `mvpPlayerName`
- `matchupPlayerName`

若只填 `playerName`，兩個片段都用同一位。若分開填，分別覆寫對應片段。

## 錯誤處理

- 找不到 `seriesId`：維持清楚錯誤並回 404。
- 找不到指定選手：整支影片失敗，不自動換人。
- 找不到指定選手的同位置對手：整支影片失敗。
- 找不到任何 role matchup：整支影片失敗。
- 沒有 `recommendedMvp`：使用平均 radar score 最高者。
- `rawStats` 不完整：只使用可用指標；若任一片段不足 2 個可驗證理由，整支影片阻擋 render，不建立發布任務。

## TDD 驗收標準

本專案使用垂直 TDD。每次只寫一個失敗測試，讓它通過後再寫下一個。

第一個切片：自動雙判讀選角

- Red：新增測試，驗證未手動指定時，payload 同時包含最大 `matchupSegment` 與 MVP `proofSegment`。
- Green：實作最小 selector 與 payload 建立邏輯。
- Refactor：抽出共用 matchup / proof selector，維持既有測試全綠。

第二個切片：通用 `playerName` 覆寫

- Red：新增測試，驗證 `playerName` 會同時覆寫 `matchupSegment` 與 `proofSegment`。
- Green：加入通用覆寫邏輯。
- Refactor：整理指定選手查找與錯誤訊息。

第三個切片：分開覆寫

- Red：新增測試，驗證 `mvpPlayerName` 與 `matchupPlayerName` 可分別控制兩個片段。
- Green：加入分開覆寫優先序。
- Refactor：確保優先序可讀，避免巢狀條件膨脹。

第四個切片：storyboard 契約

- Red：新增測試，驗證 storyboard tag 固定為 `HOOK`、`MATCHUP_EDGE`、`PLAYER_PROOF`、`CONCLUSION_CTA`。
- Green：更新 payload storyboard。
- Refactor：移除舊 `STAT_REVEAL` 主流程。

第五個切片：template 靜態契約

- Red：新增 source-level 測試，驗證 template 讀取 `matchupSegment`、`proofSegment`，且舊單人雷達主文案不再主導畫面。
- Green：重做 `Template_PlayerRadar.jsx` 分幕。
- Refactor：保留必要相容 fallback，刪除不再使用的舊敘事文案。

第六個切片：錯誤與資料不足

- Red：新增測試，驗證指定選手不存在、缺同位置對手、差距理由不足時不靜默產出錯誤影片。
- Green：加入明確錯誤與阻擋 render 規則。
- Refactor：統一錯誤文字，讓 API error formatter 維持清楚。

## 非目標

- 不產生第二支影片。
- 不把選手雷達併入每日賽事影片。
- 不新增 Leaguepedia 以外的資料源。
- 不編造時間點、會戰、龍團、巴龍或賽內事件。
- 不重做每日 H2H Radar 或 Match Recap。
- 不改 IG / Threads 發布平台策略。

## 風險與處理

- 風險：最大對位差距在敗方時，觀眾可能誤解為勝負關鍵。
  - 處理：payload 標記 `loser-highlight`，文案明確稱為敗方亮點。
- 風險：MVP 和最大對位選手不同時，影片顯得分散。
  - 處理：Hook 與結論都明確使用「兩個賽後判讀」框架。
- 風險：raw stats 不完整，差距理由不足。
  - 處理：只講可驗證指標；任一片段不足 2 個可驗證理由時阻擋 render，不建立發布任務。
- 風險：保留舊欄位造成 template 混用舊流程。
  - 處理：template 以 `matchupSegment` / `proofSegment` 為主，舊欄位只作 fallback。
