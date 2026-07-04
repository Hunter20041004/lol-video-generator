---
status: draft
created: 2026-06-20
---

# PRD: Pipeline Pruning and Workbench Redesign

## Why / Background

Hextech Video Studio 目前累積了多條內容產線，包含版本改動、黑科技、榜單、TFT、電競場外事件、每日賽事與選手雷達。這些能力讓工具快速長出雛形，但也造成前端入口過多、後端 runtime 保留太多實驗線、發布控制台平台範圍過大，以及測試與資料清理責任不清楚。

本次目標是把工具收斂成少數可維護、可測試、可持續營運的核心產線。版本改動內容維持既有價值，電競內容聚焦於真實賽事資料與選手數據，發布與成效控制台只保留目前已完整支援的 IG 與 Threads。黑科技雷達與幻神榜單未來會重新設計，但這次不沿用舊產線，也不保留任何 UI 空殼或 runtime fallback。

決策重點是「乾淨切除」而不是「先隱藏」。被淘汰的產線必須從前端、後端、schema、prompt、render、composition、測試、資料與可明確歸屬的 render output 中移除。保留產線則要整理成新的工作台式前端，並補齊目前缺少的後端資料契約，避免出現漂亮 UI 但資料流仍然分裂的狀態。

## Solution

產品改版後只保留 3 個主工作區：

1. **版本改動工廠**
   - 英雄改動：`PATCH`
   - 系統改動：`SYSTEM_UPDATE`
   - 裝備 / 符文：`ITEM_UPDATE`、`RUNE_UPDATE`

2. **電競賽事工廠**
   - 每日系列賽：`ESPORTS_H2H_RADAR`、`ESPORTS_MATCH_RECAP`
   - 選手雷達：`PLAYER_RADAR`
   - 共用 Leaguepedia candidates、scan snapshot 與 `scanId`

3. **發布與成效控制台**
   - 授權、發布佇列、重試、成效同步、洞察報表
   - 平台只保留 IG 與 Threads

以下產線必須完全刪除：

- `PRO_BUILD`
- `TIER_LIST`
- `TFT_INFO`
- `ESPORTS_DRAMA`

刪除後，使用者不應在前端看到相關入口；共用 API 不應接受相關 `dataType`；render pipeline 不應能產出相關 composition；publish flow 不應能建立相關任務；測試與 TDD coverage manifest 不應再把刪除產線當作有效功能。

新版前端採工作台布局。左側是 3 個主入口；上方顯示目前工作區名稱、主要狀態與主要操作；中間是工廠操作區；右側或下方是腳本預覽、render 結果、gate 狀態與發布狀態。前端每一個功能建議都必須標註後端狀態：`已支援`、`需補後端`、`刪除` 或 `暫不做`。

## User Stories & Scenarios

**Scenario 1：內容操作者只看到保留產線**

- Given 一位內容操作者打開新版工具
- When 前端完成載入
- Then 他只看到版本改動工廠、電競賽事工廠、發布與成效控制台
- So that 使用者不會被已淘汰的黑科技、幻神、TFT 或場外事件入口干擾

**Scenario 2：版本改動工廠集中管理 patch 內容**

- Given 一位內容操作者進入版本改動工廠
- When 他切換英雄改動、系統改動、裝備 / 符文模式
- Then 前端使用同一個工廠框架與既有內容庫，依模式顯示對應資料、預覽與產片狀態
- So that patch notes 相關內容維持集中管理，但內部仍能依內容型態操作

**Scenario 3：電競賽事工廠先掃描候選賽事**

- Given 一位內容操作者進入電競賽事工廠
- When 他選擇日期與賽事模式並觸發掃描
- Then 後端透過 Leaguepedia 抓取候選 series、players、完整度、推薦 MVP 與 scan snapshot
- So that 每日系列賽與選手雷達可共用同一份資料來源

**Scenario 4：每日系列賽先通過 Gate 再正式產片**

- Given 一位內容操作者已選定某個 series
- When 他按下檢查內容 Gate
- Then 系統檢查五路對位、Recap points、語言輸出與資料完整度，但不建立發布佇列
- So that 重型 render 與發布任務不會在資料不完整時被觸發

**Scenario 5：每日系列賽正式產片後建立發布佇列**

- Given 一個 series 已通過 Gate
- When 操作者按下產生每日系列賽影片
- Then 系統依所選語言產出 H2H Radar 與 Match Recap，並為 IG 與 Threads 建立發布佇列任務
- So that 工廠完成內容生產，正式發布仍由發布與成效控制台接手

**Scenario 6：選手雷達預設推薦 MVP 並可手動指定選手**

- Given 一位內容操作者在電競賽事工廠切到選手雷達
- When 他選擇一個 series
- Then 前端顯示後端推薦 MVP，並允許改選該 series 中任一選手
- So that 使用者可以快速產 MVP 雷達，也能手動製作指定選手影片

**Scenario 7：發布與成效控制台只管理 IG 與 Threads**

- Given 一位內容操作者進入發布與成效控制台
- When 他查看授權、發布任務與成效
- Then 系統只顯示 IG 與 Threads 的帳號、佇列、重試與洞察
- So that 發布控制台聚焦目前已完整支援的平台

**Scenario 8：已刪產線不能被 API 或 render 重新啟動**

- Given 外部 caller 嘗試送出已刪 `dataType`
- When 請求進入分析、算圖或發布流程
- Then 系統拒絕該請求並回傳 unsupported dataType 類型錯誤
- So that 前端刪除不只是視覺隱藏，而是 runtime 層也完全切除

**Scenario 9：清理可明確歸屬的舊資料與產物**

- Given 本機資料、queue、cache 或 render output 中存在已刪產線資料
- When 本次改版實作完成
- Then 可明確歸屬 `PRO_BUILD`、`TIER_LIST`、`TFT_INFO`、`ESPORTS_DRAMA` 的資料與檔案被移除
- So that 使用者電腦儲存空間不再被已淘汰產線占用

**Scenario 10：沒有 sample mode 時仍能測試真實狀態**

- Given 電競賽事工廠不提供 sample mode
- When Chrome 自測時 Leaguepedia 當天沒有符合資料
- Then 前端顯示空狀態或錯誤狀態，測試應驗證該狀態正確
- So that 測試不會用假資料掩蓋真實資料源風險

## Requirements

### Pipeline Scope

保留產線：

- `PATCH`
- `SYSTEM_UPDATE`
- `ITEM_UPDATE`
- `RUNE_UPDATE`
- `ESPORTS_H2H_RADAR`
- `ESPORTS_MATCH_RECAP`
- `PLAYER_RADAR`

刪除產線：

- `PRO_BUILD`
- `TIER_LIST`
- `TFT_INFO`
- `ESPORTS_DRAMA`

刪除產線不得保留：

- 前端入口或空殼
- API route 或隱藏 debug path
- prompt
- schema
- render mapping
- Remotion template
- composition registration
- default props
- publishing label
- content factory 支援
- tests 或 TDD coverage manifest 條目
- runtime sample fallback

黑科技雷達與幻神榜單只保留為產品備註：未來會重新製作，但這次不沿用舊產線、不保留程式碼、不保留 UI 空殼。

### Workbench IA

新版前端第一層導航固定為：

- 版本改動工廠
- 電競賽事工廠
- 發布與成效控制台

版本改動工廠內部模式：

- 英雄改動
- 系統改動
- 裝備 / 符文

電競賽事工廠內部模式：

- 每日系列賽
- 選手雷達

發布與成效控制台內部應聚焦：

- IG / Threads 授權
- 發布佇列
- 發布重試
- 成效同步
- 洞察報表

前端設計實作時必須使用 frontend-design skill，並以工作台工具為設計方向：密度高、資訊層級清楚、操作效率高，不做行銷式 landing page。

### Backend Status Labels

每個前端功能在 PRD、計畫與後續實作紀錄中，都必須標註後端狀態：

- `已支援`：現有 API 或 service 可直接接。
- `需補後端`：必須在本次實作新增或修改後端契約。
- `刪除`：前後端都要移除，不留可呼叫 runtime。
- `暫不做`：未來可能做，但這次不進範圍。

目前判定：

- 版本改動工廠：`已支援`，但需收斂只保留版本改動類型。
- 電競賽事工廠共用 candidates：`需補後端`。
- 每日系列賽：`部分已支援`，需改成可接 `scanId` 與 `seriesId`，並維持 Gate first。
- 選手雷達：`部分已支援`，需新增專用 API 並接 `scanId`、`seriesId`、`playerName`。
- 發布與成效控制台：`已支援` IG / Threads，需移除 YouTube / TikTok 的主要路徑與 UI。
- 刪除產線：`刪除`。

### Esports Candidates API

電競賽事工廠必須新增共用候選資料流程。

候選掃描契約：

- 接收日期、active mode、語言偏好與 tournament scope。
- 使用 Leaguepedia 作為 runtime 資料來源。
- 回傳 `scanId`、候選 series、games、players、完整度、推薦 MVP、候選資料來源狀態。
- 寫入 scan snapshot，供每日系列賽與選手雷達共用。
- 不支援 runtime sample mode。

候選讀取契約：

- 允許透過 `scanId` 重新讀取同一份 scan snapshot。
- 若 snapshot 不存在或過期，回傳明確錯誤。
- 前端不得在模式切換時重新掃描，除非使用者主動觸發。

測試與開發可以使用 mock 或 fixture，但該 mock 不得成為正式 API 的 `useSample` 功能。

### Daily Series API

每日系列賽 API 必須支援：

- `scanId`
- `seriesId`
- `dryRun`
- `languages`
- `allowRepublish` 或等價的手動重跑旗標

行為規格：

- `dryRun: true` 時只檢查資料、計畫內容與 Gate，不建立正式發布任務。
- `dryRun: false` 時必須在 Gate passed 後才產生影片與建立發布佇列。
- 正式產片成功後自動建立 IG / Threads queue jobs。
- 不 immediate publish。
- 語言預設為 `zh` 與 `en`，但可覆寫成單語。
- Gate 必須依使用者選定語言檢查必要影片，不永遠硬性要求 4 支。

### Player Radar API

選手雷達 API 必須支援：

- `scanId`
- `seriesId`
- `playerName`（選填）
- `languages`

行為規格：

- 未提供 `playerName` 時，後端自動挑選 MVP 或最佳表現選手。
- 提供 `playerName` 時，後端產出指定選手雷達。
- 必須使用同一份 scan snapshot 的 series/player 資料，不重新抓一份不一致資料。
- 正式產片成功後自動建立 IG / Threads queue jobs。
- 不 immediate publish。
- 不使用 YouTube auto publish。

### Version Factory

版本改動工廠沿用現有內容工廠資料庫與流程，不新增另一套 scanId。

必須確保：

- 掃描只建立 `PATCH`、`SYSTEM_UPDATE`、`ITEM_UPDATE`、`RUNE_UPDATE`。
- library 可依英雄改動、系統改動、裝備 / 符文過濾。
- preview 與 publish 只接受保留 dataType。
- 已刪 dataType 不再出現在 library、preview、publish 與發布控制台。

### Publishing and Insights

平台範圍：

- 保留：IG、Threads。
- 移除主要 runtime：YouTube、TikTok。

行為規格：

- 所有正式產片 API 預設建立發布佇列任務。
- 工廠不直接發布。
- 發布與成效控制台負責正式送出、重試、授權修復與洞察同步。
- Queue、copy、insights、post links 與 account UI 必須聚焦 IG / Threads。
- 歷史 queue 中可明確歸屬刪除產線或移除平台的資料應在本次切除中清理，不提供額外 cleanup script。

### Data and Storage Cleanup

本次不是新增清理工具，而是在實作刪除產線時直接清理。

必須清理：

- 可明確歸屬刪除產線的本機資料。
- 可明確歸屬刪除產線的發布任務。
- 可明確歸屬刪除產線的 cache。
- 可明確歸屬刪除產線的 render output、props、temp 檔。

不能明確判斷來源的通用影片或素材不得任意刪除，除非已有 metadata、queue 記錄、檔名規則或 props 可證明其屬於刪除產線。

## Implementation Decisions

### Major Modules

建議模組邊界如下：

- **Pipeline Registry**：集中定義可用 dataType、刪除 dataType、render mapping、prompt mapping 與 publish label。避免同一組支援清單散落在前端、後端與 render service。
- **Workbench Navigation Model**：前端用穩定資料模型描述 3 個工作區與內部模式，避免每個區塊自行硬寫 tab。
- **Version Factory Adapter**：封裝版本改動工廠對 content factory store 的讀取、過濾、preview 與 publish 契約。
- **Esports Candidate Store**：負責 scan snapshot、scanId、候選 series 與 player 資料保存。
- **Esports Candidate Scanner**：負責 Leaguepedia 抓取、series grouping、player normalization、MVP 推薦與 completeness 計算。
- **Daily Series Runner**：負責 Gate first、H2H Radar、Match Recap、語言輸出與 queue jobs。
- **Player Radar Runner**：負責從 scan snapshot 中選 player、建立 Player Radar payload、render 與 queue jobs。
- **Removed Pipeline Pruner**：不是使用者可執行工具，而是本次 migration / 實作切除的一部分，用於清掉可明確歸屬刪除產線的資料與產物。
- **Publish Platform Policy**：集中限制 IG / Threads，讓工廠與發布控制台使用同一套平台允許清單。

這些模組應避免只是傳遞資料的淺層 wrapper。每個模組都要有可測試的行為契約，例如「某 dataType 是否被允許」、「某 scanId 是否能讀回一致資料」、「某 series 是否通過 Gate」、「某 render 結果會建立哪些 queue jobs」。

### API Contracts

新增或調整的主要 API 契約：

- Esports candidates scan：掃描 Leaguepedia 並建立 scan snapshot。
- Esports candidates read：依 `scanId` 讀取 snapshot。
- Daily series run：依 `scanId` 與 `seriesId` 執行 Gate 或正式產片。
- Player radar run：依 `scanId`、`seriesId` 與選填 `playerName` 產生選手雷達。
- Analyze：拒絕刪除 dataType。
- Render：拒絕刪除 dataType。
- Publish：拒絕刪除 dataType 與移除平台。
- Content factory：只保留版本改動類型。

### Language Policy

保留產線預設雙語輸出：

- 預設 `languages` 為 `zh` 與 `en`。
- 可覆寫成只產 `zh` 或只產 `en`。
- Queue jobs 必須依語言建立。
- Gate 必須依選定語言檢查，不可把單語模式誤判為缺少另一語言。

### No Sample Mode

正式 runtime 不提供 sample mode。

不允許：

- 前端 `useSample` 開關。
- API `useSample` contract。
- runtime sample data path。
- 使用 sample data 假裝 Leaguepedia 有資料。

允許：

- 單元測試使用 mock dependency。
- integration test 使用受控 fixture。
- Chrome 自測在 Leaguepedia 無資料時驗證空狀態或錯誤狀態。

### Frontend Design Principles

新版 UI 應是一個工具工作台，不是展示頁。

設計原則：

- 左側主導航只保留 3 個工作區。
- 每個工廠內部使用 segmented control 或等價控制切模式。
- 操作區、預覽區、狀態區分工清楚。
- 電競賽事工廠上方必須有共用賽事資料區。
- 工廠內的操作按鈕要區分「掃描」、「檢查 Gate」、「產生影片」與「查看發布任務」。
- 發布與成效控制台不混入內容生產表單。
- 不顯示已刪產線文字、圖示、空狀態或未來預告卡。

## Testing Decisions

本專案採用 TDD 開發，TDD 是任何開發工作的最高原則。後續 implementation plan 必須明確寫出 Red → Green → Refactor 步驟；若計畫缺少 TDD 步驟或採用水平切片，視為不符合本 PRD。

### TDD Rules

每一個垂直切片都必須遵守：

1. **Red**：先寫 1 個失敗測試，反映預期的新行為或修正。
2. **Green**：寫最少量程式碼讓該測試通過。
3. **Refactor**：在測試保護下重構，並確認測試仍然全綠。

禁止水平切片。不可一次寫完多個測試，再一次寫完多段實作。正確流程是：t1 → i1 → t2 → i2 → t3 → i3。

Plan mode 也必須照此粒度拆。每一步都要先列測試，再列實作細節。修改既有程式碼時，若既有行為沒有測試保護，必須先補保護性測試，再修改測試反映新行為。Bug fix 必須先寫可重現 bug 的測試，確認紅燈，再修到綠燈。

測試失敗時，必須判斷是產品程式碼錯誤、測試假設錯誤，還是非本次修改導致的既有失敗。不得為了通過而盲目改測試。

### Required Test Coverage

刪除產線：

- 測試已刪 dataType 在分析、算圖、發布流程被拒絕。
- 測試已刪 API route 不再存在或不再被前端呼叫。
- 測試 schema、prompt、render mapping 與 composition 不包含已刪 dataType。
- 測試 publishing copy、queue 與 insights 不再把已刪產線當作可建立的新任務。
- 測試可明確歸屬刪除產線的資料與 render output 在 migration / 實作切除中被移除。

版本改動工廠：

- 測試 content factory scan 只建立保留版本類型。
- 測試 library 依英雄、系統、裝備 / 符文模式過濾。
- 測試 preview 與 publish 拒絕刪除 dataType。
- 測試正式產片後建立 IG / Threads queue jobs，不 immediate publish。

電競賽事工廠：

- 測試 candidates scan 建立 `scanId` 與 snapshot。
- 測試依 `scanId` 可讀回同一份 candidates。
- 測試沒有 sample mode，API 不接受 `useSample`。
- 測試 Daily Series 可用 `scanId + seriesId` 做 Gate first。
- 測試 Daily Series 正式產片後建立 IG / Threads queue jobs。
- 測試 Gate 依選定語言檢查必要輸出。
- 測試 Player Radar 未提供 `playerName` 時自動挑 MVP。
- 測試 Player Radar 提供 `playerName` 時產指定選手。
- 測試 Player Radar 使用同一份 scan snapshot，不重新抓不一致資料。

發布與成效控制台：

- 測試平台政策只允許 IG / Threads。
- 測試 YouTube / TikTok 不再出現在前端平台選項與預設平台。
- 測試發布控制台可處理 IG / Threads 授權、重試、同步與洞察。

前端：

- 測試主導航只顯示 3 個工作區。
- 測試版本改動工廠內有英雄、系統、裝備 / 符文 3 模式。
- 測試電競賽事工廠內有每日系列賽與選手雷達 2 模式。
- 測試每個需補後端的前端功能在資料缺失、掃描失敗或空 candidates 時顯示可操作的錯誤 / 空狀態。
- 不要求針對純靜態文字做瑣碎斷言。

### Contract and Boundary Tests

純 mock unit test 只能證明程式碼照預期呼叫，不能證明外部系統真的符合契約。凡是直接打 Leaguepedia、IG、Threads 或其他外部 API 的 client utility，除了 mock-based unit test 外，必須補真實邊界或受控 sandbox 的 contract test。

Leaguepedia contract test 應驗證：

- 必要欄位實際可讀。
- series grouping 所需欄位存在。
- player stats 欄位可支撐 H2H Radar、Match Recap 與 Player Radar。
- 空資料、缺欄位、API 失敗時能回傳可理解錯誤。

IG / Threads contract test 應驗證：

- OAuth 與 token 設定契約。
- public media URL 要求。
- publish payload 符合平台 API。
- insights 與 post link 查詢契約。

如果 mock 與真實邊界測試不一致，必須修真實系統設定、實作邏輯或測試契約，不得調整 mock 讓測試表面通過。

### Verification

完成後必須執行：

- TDD manifest / doctor。
- 全部 unit tests。
- coverage gate。
- production build。
- Chrome 詳細自測。

Chrome 自測必須覆蓋：

- 版本改動工廠的 3 個模式。
- 電競賽事工廠 candidates 掃描。
- 每日系列賽 Gate first。
- 選手雷達 auto MVP 或空狀態。
- 發布與成效控制台 IG / Threads。
- 已刪產線入口不存在。

若 Leaguepedia 當下沒有資料，Chrome 自測應驗證空狀態與錯誤處理，不得用 sample mode 假裝有資料。

## Out of Scope

- 不重新製作黑科技雷達。
- 不重新製作幻神榜單。
- 不保留 TFT 戰術板。
- 不保留場外新聞 / 場外事件產線。
- 不新增 sample mode。
- 不新增 cleanup script 或前端清理按鈕。
- 不新增 YouTube 或 TikTok 發布控制台。
- 不把工廠內的產片動作改成 immediate publish。
- 不新增資料庫服務；初版可沿用本機 store。
- 不做 Leaguepedia 以外的新賽事資料源。
- 不做 live timeline 或逐事件戰報。

## Further Notes

- 黑科技雷達與幻神榜單會在未來另開 PRD 重新設計，不沿用舊產線命名、schema、prompt 或模板。
- 本次 PRD 以乾淨切除與工作台重構為主。任何看似方便但會留下刪除產線 runtime path 的 fallback 都不應實作。
- 如果刪除產線牽動大量既有測試，應以垂直切片逐步改寫測試與實作，不得一次性大批修改測試後再修程式碼。
- 前端設計與後端契約必須同步更新；任何前端新互動若缺後端支援，必須在 plan 中標明「需補後端」並先完成後端 TDD 切片。
