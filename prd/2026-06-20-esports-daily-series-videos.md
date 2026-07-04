---
status: draft
created: 2026-06-20
---

# PRD: Esports Daily Series Videos

## Why / Background

Hextech Video Studio 目前已具備改版分析、影片算圖、雙語 payload、社群發布與內容測試區等基礎能力，也已有 Leaguepedia 賽事資料查詢與單一選手雷達影片的雛形。下一步要把這些能力整合成可穩定日更的 LoL 電競賽後內容 pipeline，讓系統能在 LCK、LPL、MSI、Worlds 期間自動挑選值得製作的系列賽，產出雙語短影音並送到既有社群發布流程。

決策者視角：目前短影音帳號若只靠手動整理賽後數據，產量、穩定性與雙語一致性都會受限。外部競品通常分成兩類：官方帳號擅長即時高光與結果貼文，但數據分析偏薄；數據網站提供完整查詢，但不會自動轉成社群短影音。此功能的機會點是把「可查資料」轉成「可發布內容」，並利用既有 IG、Threads、雙語與 publish queue 能力降低營運成本。

使用者視角：內容操作者希望每天不用手動找比賽、整理十位選手數據、做中英字幕與逐平台發布。觀眾則希望快速看懂一場 BO3 或 BO5 的五路對位差距，以及勝負關鍵，而不是只看到單一 MVP 或比分結果。

## Solution

系統每天 23:30（Asia/Taipei）自動執行一次「每日賽事精選」流程。它會依目前賽事模式抓取當日已完成的系列賽，評分後最多選出 2 場。常規賽模式涵蓋 LCK 與 LPL；MSI 與 Worlds 期間則只看對應國際賽。每場入選 series 產出 4 支影片：

- Head-to-Head Radar 繁中版
- Head-to-Head Radar 英文版
- Match Recap 繁中版
- Match Recap 英文版

Head-to-Head Radar 是 60-90 秒影片，依序呈現 Top、Jungle、Mid、ADC、Support 五組同位置對位，每段給出數據面 Matchup Edge。Match Recap 是 45-60 秒影片，用系列賽結果與至少 3 個數據推導的勝負關鍵，講出「這場為什麼值得看」。

雙語影片共用同一份語義結構，只在字幕、標題、caption 與 CTA 做 zh/en 在地化，確保兩個語言版本的數據結論一致。通過安全閘門後，影片進入既有 IG 與 Threads 發布流程；未通過者留在測試區，供手動檢查、重產或重發。

## User Stories & Scenarios

**Scenario 1：每日自動產出當日精選賽事**

- Given 一位「內容操作者」已設定每日賽事 pipeline
- When 台北時間 23:30 到達
- Then 系統抓取當日已完成的 series，依評分選出最多 2 場，並為每場產出 Radar 與 Recap 的中英版本
- So that 操作者不需要每天手動整理賽後資料與建立影片任務

**Scenario 2：常規賽期間平衡 LCK 與 LPL**

- Given 一位「內容操作者」處於 regular active mode
- When 同一天 LCK 與 LPL 都有已完成 series
- Then 系統預設各保留 1 場名額，但若某賽區第二場分數明顯高於另一賽區第一場，可依分數破例選取
- So that 內容覆蓋兩大賽區，同時不錯過明顯更高熱度的比賽

**Scenario 3：MSI 或 Worlds 期間只看國際賽**

- Given 一位「內容操作者」將 active mode 設為 MSI 或 Worlds
- When 每日 pipeline 執行
- Then 系統只抓取該國際賽 series，不再同時抓 LCK 或 LPL
- So that 國際賽期間內容焦點保持一致

**Scenario 4：十位選手進行五路對位比較**

- Given 一位「觀眾」觀看 Head-to-Head Radar
- When 影片播放到各位置段落
- Then 觀眾看到同位置兩位選手的 KDA、DPM、KP% 與位置差異指標比較，以及數據面 Matchup Edge
- So that 觀眾能快速理解整個 series 的五路優劣，而不是只看單一 MVP

**Scenario 5：Recap 用數據講勝負關鍵**

- Given 一位「觀眾」觀看 Match Recap
- When 影片進入勝負關鍵段落
- Then 觀眾看到至少 3 個由 series-level 數據支撐的關鍵差距，例如中野輸出與參戰率、下路經濟壓制、視野或物件差距
- So that 觀眾能理解勝負原因，但不會被未驗證的會戰敘事誤導

**Scenario 6：影片通過安全閘門後自動發布**

- Given 一位「內容操作者」啟用自動發布
- When 4 支影片全部產出成功，且十位選手、五路 edge、Recap 勝負關鍵與雙語內容都完整
- Then 系統為 zh 影片建立中文 IG 與 Threads 發布任務，為 en 影片建立英文 IG 與 Threads 發布任務
- So that 正常內容能直接進入既有社群發布流程

**Scenario 7：資料不完整時不自動發布**

- Given 一位「內容操作者」依賴每日自動化流程
- When 某場 series 缺少選手資料、缺少一個位置對位、雙語任一版本產出失敗，或 Recap 不足 3 個勝負關鍵
- Then 系統不建立自動發布任務，並把該 series 記錄在測試區或 run/library 中
- So that 低完整度內容不會直接上線

**Scenario 8：單場測試與每日 dry run**

- Given 一位「內容操作者」正在調整模板或驗證資料
- When 在測試區選擇單場 series
- Then 系統可產出該 series 的 4 支測試影片，但不發布，也不改變已發布狀態
- So that 操作者可以安全調整視覺與文案

**Scenario 9：重跑時避免重複發文**

- Given 一位「內容操作者」當天重新執行 pipeline
- When 某個 series 已由自動流程成功發布過
- Then 系統預設不再次發布同一個 series
- So that 帳號不會因資料晚更新或重跑而重複發同一場內容

**Scenario 10：手動重產與重發**

- Given 一位「內容操作者」發現某場影片需要修正
- When 在測試區手動觸發重產或重發
- Then 系統允許該 series 重新產出影片或重新進入發布流程，並在 run/library 留下狀態記錄
- So that 修正流程可控，不影響自動去重規則

## Implementation Decisions

- **Esports Config**：提供 active mode、每日上限、LCK/LPL 配額策略、評分權重、熱門隊伍與熱門選手分數。主要設定由設定檔管理，環境變數可做臨時 override。Active mode 支援 regular、MSI、Worlds 與 auto；手動設定優先，自動偵測作 fallback。

- **Series Fetcher**：以 Leaguepedia Cargo 為唯一第一階段資料源。它負責抓取指定賽事日與 active mode 內已完成的 series，以及每局十位選手資料。第一階段必須支援 LCK、LPL、MSI、Worlds 的 tournament filter 與 series grouping。

- **Series Aggregator**：以 series 為單位聚合 BO3 或 BO5。KDA 使用 series 的總 K/A/D 計算；DPM、GPM、CSM、Vision per minute 使用總量除以總時長；KP% 使用各局隊伍擊殺加權後計算。聚合後產出每位選手的 normalized radar stats 與 raw stats。

- **Match Scorer**：每日候選 series 以混合評分排序。常規賽預設權重為賽事重要性 40%、流量 35%、數據異常 25%。流量分數第一階段使用可維護的熱門隊伍與選手表，之後可依 IG 與 Threads 成效調整。

- **Selection Policy**：每日最多 2 場。regular mode 預設 LCK 與 LPL 各保留 1 場，但若跨賽區分數差距達到設定門檻，可讓全域高分場次破例入選。MSI 與 Worlds mode 僅在該賽事內選最高分 series。

- **Semantic Content Planner**：先產出一份語義結構，再派生 zh/en 內容。語義結構應包含 match metadata、team result、五路 matchup edges、每路 edge reasons、Recap points、CTA、content confidence 與資料完整性狀態。語言版本只能改變文字表達，不得改變數據結論。

- **Head-to-Head Radar Payload**：描述五個 role segments。每段包含左右隊選手、英雄池資訊、5 個雷達指標、edge winner、edge reasons 與短字幕。核心指標固定為 KDA、DPM、KP%；位置差異指標只使用 Leaguepedia 可穩定取得的 GPM、CSM、Vision 等資料。

- **Match Recap Payload**：描述 series 結果、比分、入選原因、至少 3 個勝負關鍵、關鍵選手與結尾 CTA。Recap 只能用數據推導輕敘事，不得產生第幾分鐘會戰、龍團或巴龍團等未由第一階段資料支撐的內容。

- **Renderer**：支援 2 種新影片型態。Head-to-Head Radar 目標長度為 60-90 秒；Match Recap 目標長度為 45-60 秒。兩者都採短字幕與畫面標籤，不做完整旁白稿。

- **Gatekeeper**：第一版只阻擋硬錯誤與完整性問題。必須確認影片檔存在、算圖成功、zh/en 都成功、十位選手資料齊全、五路 edge 都產生、Recap 至少有 3 個勝負關鍵，且可成功建立 IG 與 Threads 發布任務。未通過者不自動進入發布 queue；若任務進 queue 後才發生平台 API 失敗，該失敗應記錄為 publish failure，並回寫 run/library 供後續重試或手動處理。

- **Esports Run / Library Store**：記錄每日 run、候選 series、評分、入選原因、gate 結果、輸出影片、publish jobs、手動重產紀錄與錯誤。第一階段可使用本地 JSON store，保持與現有 content factory 與 publish queue 風格一致。

- **Publishing Integration**：沿用既有 publish package、queue 與 scheduler。賽事 pipeline 明確指定 IG 與 Threads，不使用 YouTube 或 TikTok。zh 影片只發中文帳號組；en 影片只發英文帳號組。通過 gate 後任務立即進 due queue，不新增另一套社群排程規則。

- **Testing Area**：新增賽事測試區，支援單場 series 測試與每日 dry run。單場測試可產 4 支測試影片，不發布；每日 dry run 可模擬 23:30 的抓資料、評分、選片、產片與 gate，但不建立正式發布任務。

## Testing Decisions

本功能的任何開發都必須採用 TDD。TDD 是此功能的最高開發原則，包括後續 implementation plan 也必須清楚寫出 Red → Green → Refactor 的步驟；若計畫只列「先寫所有測試，再寫所有實作」，該計畫不符合本 PRD。

每一個垂直切片都必須遵守以下循環：

- **Red**：先寫 1 個描述新行為或修正行為的失敗測試，並確認它真的失敗。
- **Green**：只寫通過該測試所需的最少實作。
- **Refactor**：在測試保護下消除重複、改善命名、簡化邏輯，並確認測試仍然通過。

禁止水平切片。不可一次寫完多個測試，再一次寫完多段實作。正確粒度是 t1 → i1 → t2 → i2 → t3 → i3，每次只新增一個失敗測試，通過後再前進到下一個行為。Plan mode 的實作計畫也必須照此粒度拆分，並且每一步都先列測試，再列實作。

修改既有程式碼時，若既有行為沒有測試保護，必須先補上保護性測試，再修改測試反映新行為。Bug fix 必須先寫能重現 bug 的測試，確認紅燈，再修正到綠燈。測試失敗時必須先判斷是產品程式碼錯誤、測試假設錯誤，還是既有 unrelated failure；不得為了通過而盲目改測試。

新的核心模組應以行為測試為主，避免測試內部實作細節。若某個模組會被 UI、排程器或其他 service 呼叫，測試應聚焦在外部輸入輸出契約。測試重點是使用者流程與模組契約不出錯，而不是斷言頁面靜態文字或私有函式形狀。

應優先覆蓋以下模組：

- **Active Mode Resolver**：驗證手動設定優先、自動偵測 fallback、MSI/Worlds 與 regular mode 的候選範圍。
- **Series Aggregator**：驗證 BO3/BO5 聚合公式，包含 KDA、DPM、GPM、CSM、Vision per minute、KP%。
- **Match Scorer**：驗證 40/35/25 權重、熱門隊伍與選手加分、LCK/LPL 保底與破例邏輯。
- **Semantic Content Planner**：驗證 zh/en 共用同一份語義結構，五路 edge 與 Recap points 不會在語言版本間分歧。
- **Gatekeeper**：驗證缺選手、缺 edge、缺語言版本、缺影片檔、Recap points 不足時不發布。
- **Run / Library Store**：驗證每日 run 記錄、series 去重、手動重產與重發狀態。
- **Publishing Integration**：驗證只建立 IG 與 Threads 任務，且 zh/en 正確對應帳號組。
- **Testing Area API**：驗證單場測試與每日 dry run 都不建立正式發布任務。

Mock 只能作為輔助，不可作為外部系統行為的唯一證明。凡是直接呼叫 Leaguepedia、IG、Threads 或其他外部 API 的 client utility，除了 mock-based unit test 之外，必須補上真實邊界的 contract test 或受控 sandbox 測試：

- Leaguepedia 資料 client 需驗證 Cargo 查詢實際可讀到必要欄位，包含 series grouping、GameId、MatchId、Role、K/D/A、Gold、CS、DamageToChampions、VisionScore 與 TeamKills 等欄位。
- IG 與 Threads 發布 adapter 需驗證設定、權限、public media URL 與平台 API 契約；若測試環境不能實際發文，仍需有明確的 sandbox 或 dry-run contract，證明 adapter 送出的 payload 與平台要求一致。
- Publish queue、run/library store 與 render service 應使用接近真實資料的 integration-style 測試，避免只驗證 mock chain 有被呼叫。

如果 mock 測試與真實邊界測試不一致，必須修正真實系統設定、實作邏輯或測試契約，不得調整 mock 讓測試表面通過。

可參考既有測試類型：

- publishing schedule 與 queue 行為測試
- publishing account / adapter 行為測試
- content factory preview 與雙語 render payload 測試
- content factory store 測試
- render service 雙語輸出測試

視覺測試不應以大型 snapshot 為主。對 Remotion 模板，優先測試產生 view-model 的純 helper，再用人工或 Playwright 截圖檢查主要畫面不空白、文字不溢出、五路段落順序正確。

## Out of Scope

- 不接 PandaScore、GRID、Riot Esports Data 或其他付費資料源。
- 不做 live timeline、逐事件戰報或即時比賽過程分析。
- 不講第幾分鐘龍團、巴龍團、關鍵會戰或未被資料支撐的轉折點。
- 不使用 LLM 補不存在的比賽事件。
- 不新增 YouTube 或 TikTok 自動發布。
- 不做完整旁白稿或 TTS 配音。
- 不在第一階段做資料庫服務；本地 store 足以支撐初版。
- 不把品質分數作為第一版 gate 的硬阻擋條件；第一版 gate 只檢查硬錯誤與完整性。

## Further Notes

- 第一版實作採分階段上線，但 PRD 設計一次到位。建議順序為：資料與選片層、內容與測試層、自動化與發布層。
- 第一階段資料源足以支撐 series-level 數據、十人對位與數據型 Recap，但不支撐完整比賽過程敘事。
- 需要修正既有資料欄位映射，確保傷害欄位使用 Leaguepedia 的正式名稱，並保留舊 alias fallback。
- 若未來要做真正的「比賽過程內容」，需另開 PRD，評估事件級資料源或人工 VOD 標記流程。
