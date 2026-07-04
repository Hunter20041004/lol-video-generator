---
status: draft
created: 2026-06-21
---

# PRD: Meta Content Factory Redesign

## Why / Background

Hextech Video Studio 前一輪已經把舊的黑科技與梯度榜單產線乾淨切除。舊 `PRO_BUILD` 與 `TIER_LIST` 不應被復活，因為它們的 schema、prompt、template 與 runtime fallback 已經被判定不適合長期維護。這次要重新建立的是新的 Meta 內容工廠，目標是用資料驅動的方式重新製作兩條內容產線：黑科技與梯度榜單。

新的 Meta 內容工廠必須以可信資料、明確候選、可覆核產片與可測試契約為核心。黑科技不再是手動輸入一個 build 後直接產片，而是由系統從第三方 meta 資料找出「非主流但有證據」的題材。梯度榜單也不再是單純用勝率排序，而是用勝率、登場率、禁用率、樣本數、資料源一致性與版本動能組成綜合強度分。

本次設計採用 LoLalytics 作為主資料源，OP.GG 或 OP.GG MCP 作為備援與交叉驗證來源。系統採手動掃描，不做排程。掃描結果寫入 snapshot，後續候選檢視、產片與發布佇列建立都必須以 snapshot 為唯一來源，避免掃描與產片時資料不一致。

## Solution

新增一個主工作區：Meta 內容工廠。此工作區內部有 2 個模式：

- 黑科技：對應新的 `META_OFFMETA_PICK` 題材。
- 梯度榜單：對應新的 `META_TIER_RANKING` 題材。

Meta 內容工廠採方案 B：Snapshot + Cross-check 正式化。

- LoLalytics 負責產生主要候選與數據基礎。
- OP.GG 或 OP.GG MCP 負責交叉驗證與 source agreement，不主導排名。
- 若 OP.GG 或 MCP 不可用，scan 仍可完成，但候選必須降級 source agreement，並顯示風險標籤。
- scan 不支援 runtime sample mode。測試可使用 fixture 或 mock adapter，但正式 API 不得提供 `useSample` 這類切換。
- render 不重新抓第三方資料，只能讀取 snapshot 中的候選內容。
- 正式產片固定輸出 zh 與 en 雙語。
- 產片成功後只建立 Instagram 與 Threads 發布佇列任務，不 immediate publish。

## User Stories & Scenarios

**Scenario 1：內容操作者進入 Meta 內容工廠**

- Given 一位內容操作者打開工作台
- When 他進入 Meta 內容工廠
- Then 他看到黑科技與梯度榜單兩個模式
- So that 新產線以同一個 meta 資料工作台管理，而不是恢復舊的散落入口

**Scenario 2：手動掃描 meta 候選**

- Given 操作者選擇 patch、region、queue 與模式
- When 他按下掃描
- Then 系統從 LoLalytics 取得主資料，並嘗試用 OP.GG 或 MCP 做交叉驗證
- So that 工作台產生可覆核的 snapshot，而不是直接進入 render

**Scenario 3：黑科技候選可被覆核**

- Given 掃描結果包含黑科技候選
- When 操作者查看候選列表
- Then 每個候選顯示分數、信心、樣本數、來源一致性、風險標籤與故事角度
- So that 操作者能判斷這是可拍題材，還是只是小樣本噪音

**Scenario 4：梯度榜單以單位置 Top 5 或 Top 7 產出**

- Given 操作者選擇一個位置
- When 系統完成梯度榜單計算
- Then 預設產生 Top 7，若資料信心不足則降級為 Top 5
- So that 榜單保持單一路線、可解釋、適合短影音呈現

**Scenario 5：預設人工覆核，也可使用最高分題材產片**

- Given snapshot 已產生候選
- When 操作者選擇某個候選，或按下使用最高分題材產片
- Then 系統只從 snapshot 讀取候選資料，產生 zh 與 en 影片，並建立 IG 與 Threads queue
- So that 產線兼顧人工控制與快速出片

**Scenario 6：外部驗證來源不可用時降級而非中斷所有流程**

- Given LoLalytics 成功但 OP.GG 或 MCP 不可用
- When 系統建立候選
- Then 候選仍可顯示，但 source agreement 降級並加上風險標籤
- So that 主要資料源可用時不因備援暫時失敗而完全停止產線

**Scenario 7：硬阻擋候選不得產片**

- Given 某個候選樣本不足、缺少核心欄位，或主備資料明確衝突
- When 操作者嘗試產片
- Then UI 停用 render 行為，API 也拒絕該候選
- So that 黑科技不會因話題性而犧牲可信度

## Requirements

### Pipeline Scope

新 data type：

- `META_OFFMETA_PICK`
- `META_TIER_RANKING`

不得復活或重用的舊 data type：

- `PRO_BUILD`
- `TIER_LIST`

新產線可以使用「黑科技」與「梯度榜單」作為產品文案，但 runtime 契約、schema、prompt、render mapping 與測試都必須使用新的 `META_*` 命名。

### Data Source Strategy

資料來源策略：

- 主資料源：LoLalytics。
- 備援與交叉驗證：OP.GG 或 OP.GG MCP。
- 策略：一主一備。
- 更新節奏：手動掃描。
- 不做每日排程、不做背景自動抓取、不做無人值守自動產片。

玩家環境策略：

- 梯度榜單以 Emerald+、Global、current patch 作為預設排名基準。
- 黑科技以 Diamond+ 或 Master+ 先找異常候選，再用 Emerald+、Global 做二次檢查。
- Queue 預設為 Ranked Solo/Duo。
- Region 預設為 Global。

### Snapshot Contract

Meta scan 必須產生 snapshot。Snapshot 是後續候選檢視、產片與 queue handoff 的唯一資料來源。

Snapshot 必須包含：

- snapshot ID。
- 建立時間。
- patch。
- source status。
- 掃描 filters。
- 黑科技候選池。
- 梯度榜單候選池。
- 主資料源與備援來源的可用狀態。

每個候選必須包含：

- candidate ID。
- kind。
- champion。
- role。
- score。
- confidence。
- source agreement。
- sample size。
- risk labels。
- evidence。
- recommended story angle。
- hard block 狀態與原因。

若 snapshot 不存在或過期，讀取流程必須回傳明確錯誤。前端不得在模式切換時自動重新掃描，除非操作者主動觸發。

### Offmeta Scoring

黑科技候選分成 2 類：

- Off-role pick：英雄走非主流位置。
- Offmeta build：非主流出裝、符文或召喚師技能。

黑科技分數由下列因素組成：

- 異常程度：題材與主流位置或主流 build 的差異。
- 表現：勝率是否高於同位置或同英雄 baseline。
- 證據：樣本數、patch 新鮮度與資料源一致性。
- 內容性：是否能形成清楚的短影音故事。

風險標籤至少包含：

- 樣本偏小。
- 只在高端成立。
- 主備資料源差異大。
- 登場率過低。
- 版本波動。
- One-trick 偏差。
- Build order 不清楚。

硬性阻擋條件：

- 樣本數低於最低門檻。
- 主資料源缺少 champion、role 或核心統計欄位。
- 勝率低於 baseline 太多，只剩話題性。
- 備援資料明確反向，且主資料源樣本也不足。

### Tier Ranking Scoring

梯度榜單第一版只支援單位置榜單，不做全位置總榜，不跨位置比較。

支援位置：

- Top。
- Jungle。
- Mid。
- ADC。
- Support。

排序使用綜合強度分，至少包含：

- 勝率。
- 登場率。
- 禁用壓力。
- 樣本可信度。
- 來源一致性。
- 版本動能。

分層規則：

- S：綜合強度明顯高於同位置均值，且來源一致性不差。
- A：穩定強勢，樣本足夠。
- B：可推薦但有條件。
- Watch：正在上升、有話題，但不進主榜。

產片規則：

- 預設 Top 7。
- 若可用候選不足或資料信心不足，降級 Top 5。
- 使用者可以排除英雄後重算榜單。
- 使用者不可手動改分數。

### Workbench UX

Meta 內容工廠必須是工具型工作台，不是 landing page。

共用控制區包含：

- Patch。
- Region。
- Queue。
- 主資料源狀態。
- 備援來源狀態。
- 固定雙語輸出狀態。
- 掃描 Meta 候選。
- 載入 snapshot。
- 使用最高分題材產片。
- 產生所選題材影片。

黑科技模式必須顯示：

- 題材。
- Offmeta score。
- Confidence。
- Sample size。
- Source agreement。
- Risk labels。
- Story angle。
- Evidence。
- 預計 storyboard。

梯度榜單模式必須顯示：

- Position selector。
- Top 7 或 Top 5 狀態。
- 排名表。
- S、A、B、Watch 分層。
- 降級原因。
- 排除英雄後重算的結果。

UI 設計與開發必須使用 frontend-design skill。設計方向應是密度高、資訊層級清楚、操作效率高的工具介面，不做行銷式頁面，不顯示舊 `PRO_BUILD` 或 `TIER_LIST` runtime 文案。

### API Behavior

Meta Factory 必須提供下列能力：

- Scan：依模式、patch、region、position 與 rank preset 產生 snapshot。
- Snapshot read：用 snapshot ID 讀取同一份掃描結果。
- Render：用 snapshot ID 與 candidate ID，或最高分候選，產生雙語影片並建立 queue。

行為限制：

- Scan 可以抓第三方資料。
- Render 不得抓第三方資料。
- Render 必須從 snapshot 讀候選。
- Render 成功後建立 IG 與 Threads queue。
- 不 immediate publish。
- Hard-blocked candidate 不得 render。
- Queue 建立失敗時，應保留 render 結果並標示發布交接失敗。

### Publishing

新產線遵循既有發布平台政策：

- 只建立 Instagram 與 Threads 任務。
- 固定 zh 與 en 雙語影片。
- 每個語言各自建立平台任務。
- 不建立 YouTube 或 TikTok 任務。
- 不在工廠內直接正式發布。

## Development Method

本專案採用 TDD 作為任何開發時的最高原則。本 PRD 的實作計畫與實作過程都必須遵守 Red → Green → Refactor。

核心循環：

- Red：先寫一個失敗測試，反映預期的新行為、契約或修正。
- Green：寫最少量程式碼讓該測試通過。
- Refactor：在測試保護下改善命名、消除重複、簡化邏輯，並確認測試仍然全綠。

開發粒度：

- 一次只寫一個失敗測試。
- 該測試通過後，才寫下一個測試。
- 禁止水平切片，不可先一次寫完多個測試，再一次寫完多段實作。
- 計畫也必須用垂直切片描述，不能寫成「先列所有測試，再列所有實作」。

修改既有程式碼時：

- 先確認既有行為是否已有測試。
- 若沒有測試，先補既有行為保護測試。
- 再寫新預期的失敗測試。
- 讓測試通過後才重構。

測試失敗時：

- 先判斷是實作錯誤、測試錯誤，還是外部契約改變。
- 不可盲目改測試讓它通過。
- 若有非本次修改導致的既有測試失敗，必須回報失敗清單與建議處理方式。

Mock 邊界：

- Mock-based unit test 只能驗證程式碼鏈路，不代表外部 API 真的符合契約。
- 凡是直接接 LoLalytics、OP.GG 或 MCP 的 client utility，除了 mock unit test 外，必須補真實邊界的 contract test 或可重現的外部契約 smoke test。
- 若 mock 與真實來源契約不同，應修正 adapter、資料契約或實作邏輯，不可調整 mock 掩蓋問題。

## Testing Strategy

測試必須納入 TDD coverage manifest。新增 production module 與 test module 必須成為明確 slice，避免新產線未受 coverage gate 約束。

測試切片：

1. Meta Source Adapter。
   - 測 LoLalytics fixture 能轉成 normalized snapshot。
   - 測缺欄、空資料與來源錯誤會產生 source status，而不是壞候選。

2. OP.GG Verifier。
   - 測一致、不一致與 unavailable。
   - 測 source agreement 與 risk labels。

3. Offmeta Scoring。
   - 測 off-role 高分案例。
   - 測 build 或 rune 高分案例。
   - 測 low sample、source mismatch、high elo only。
   - 測 hard block 不可 render。

4. Tier Ranking Scoring。
   - 測 Top 7 排序。
   - 測資料不足降 Top 5。
   - 測 S、A、B、Watch band。
   - 測排除英雄後重算，但不能手動改分數。

5. Snapshot Store 與 API Boundary。
   - 測 scan 寫入 snapshot。
   - 測 snapshot ID 讀取。
   - 測過期與不存在錯誤。
   - 測 render 只從 snapshot 取資料，不重新抓來源。

6. Render 與 Publish Queue。
   - 測 `META_OFFMETA_PICK` 與 `META_TIER_RANKING` render mapping。
   - 測 zh 與 en 雙語輸出。
   - 測只建立 Instagram 與 Threads queue。
   - 測 hard-blocked candidate 不 render。

7. Workbench UI。
   - 測左側有 Meta 內容工廠。
   - 測內部有黑科技與梯度榜單兩模式。
   - 測舊 `PRO_BUILD` 與 `TIER_LIST` 字串仍不出現在 runtime UI。
   - 測 scan empty/error state。
   - 用 Chrome 驗收工作台切換、候選列表、錯誤狀態與 queue handoff。

建議 TDD rollout：

- 第一個垂直切片：registry/schema 新增 `META_OFFMETA_PICK` 的一個失敗測試，通過後再處理 render guard。
- 第二個垂直切片：registry/schema 新增 `META_TIER_RANKING` 的一個失敗測試，通過後再處理 render guard。
- 第三個垂直切片：LoLalytics fixture 產生一個 offmeta snapshot。
- 第四個垂直切片：OP.GG unavailable 時候選降級但 scan 成功。
- 第五個垂直切片：Offmeta hard block 阻止 render。
- 第六個垂直切片：Tier Top 7 排序與 Top 5 降級。
- 第七個垂直切片：render 從 snapshot 取資料並建立雙語 IG/Threads queue。
- 第八個垂直切片：Workbench UI 接上 scan、snapshot 與 render 狀態。

每個垂直切片都必須遵守：一個失敗測試 → 最小實作 → 重構 → 相關測試全綠。

## Acceptance Criteria

完成後必須符合：

- 工作台新增 Meta 內容工廠。
- Meta 內容工廠內有黑科技與梯度榜單兩模式。
- 新 runtime data type 使用 `META_OFFMETA_PICK` 與 `META_TIER_RANKING`。
- 舊 `PRO_BUILD` 與 `TIER_LIST` 不被復活，不出現在 schema、prompt、render mapping、composition registration 或 UI runtime。
- Scan 使用 LoLalytics 作為主資料源，OP.GG 或 MCP 作為交叉驗證。
- Scan 產生 snapshot，render 只讀 snapshot。
- 黑科技候選有 score、confidence、source agreement、sample size、risk labels 與 hard block。
- 梯度榜單支援單位置 Top 7，資料不足時降級 Top 5。
- 正式產片固定 zh 與 en 雙語。
- 產片後只建立 Instagram 與 Threads queue。
- 不提供 runtime sample mode。
- TDD coverage manifest 包含新切片。
- Unit、coverage、build 與 Chrome 驗收通過。

## Out of Scope

本次不做：

- 每日自動掃描。
- 背景排程。
- 無人值守自動 render。
- 全位置總榜。
- YouTube 或 TikTok 發布。
- 復活舊 `PRO_BUILD` 或 `TIER_LIST`。
- 工廠內 immediate publish。
- 發布後成效回饋到候選 scoring。
- 歷史 snapshot 趨勢分析。
- 題材冷卻期與去重策略。

## Risks

- 第三方資料來源頁面或回應格式可能改變，adapter 必須有 contract test 與清楚錯誤狀態。
- LoLalytics 與 OP.GG 數據口徑可能不同，source agreement 只能作為信心加權，不應直接覆蓋主資料。
- 黑科技題材容易被小樣本誤導，hard block 與 risk labels 必須比文案吸引力更優先。
- 雙語固定輸出會讓 render 與 queue 數量翻倍，UI 必須清楚顯示每個語言的狀態。
- 若 UI 只顯示漂亮候選但不顯示風險，會讓使用者誤以為所有候選都可直接拍。

## Rollout

建議分階段：

1. PRD review 完成後，建立 TDD implementation plan。
2. 先做 data type、schema 與 guard 的最小垂直切片。
3. 再做 scan snapshot 與 source adapter。
4. 再做 scoring engine 與 hard block。
5. 再做 render payload 與 queue handoff。
6. 最後接 Workbench UI 與 Chrome 驗收。

每一階段都必須維持測試全綠，並且不得以大批測試先行、實作後補的水平方式推進。
