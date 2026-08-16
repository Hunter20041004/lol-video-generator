# 精簡影片工作台設計規格

日期：2026-08-15
狀態：使用者已逐段核可；使用者明確授權略過書面規格複閱並直接進入 TDD 計畫與實作
執行限制：全程 inline，不使用子代理

## 1. 目標

把目前同時呈現四個工作區、九種模式的前端，重構為兩條每天真的會使用、且能從選題一路跑到安全發布的流程：

1. 賽事影片：選日期與系列賽，產生 25 秒賽後判讀預覽，驗證後由使用者確認發布。
2. 版本更新：載入版本內容，手動單選一則，產生預覽，驗證後由使用者確認發布。

Meta、洞察報表與原始發布佇列保留功能，但退出主要資訊層級，改收納於「進階工具」。本輪不刪除後端 route、資料、影片模板、授權素材或既有 pipeline。

## 2. 問題定義與盤點證據

目前 `app/page.jsx` 為 1,121 行，`app/globals.css` 為 1,409 行。首頁同時暴露：

- 4 個頂層工作區：版本改動、電競賽事、發布與成效、Meta。
- 9 個模式。
- 多個工程欄位，例如 `scanId`、`seriesId`、選手 override。
- 重複的「已支援」徽章與原始 JSON 結果。
- 賽事頁的「每日一鍵產片並發布」會繞過使用者最近建立的視覺審核習慣。
- 現行賽後判讀按鈕未傳 `mode`，而 `runPlayerRadarFromSnapshot()` 預設 `production`，會建立 queue jobs；這不符合「先預覽、後確認」決策。
- 版本預覽會生成影片，但不把 `renderResult` 存回內容項目；確認發布時可能重新算片，使最終發布內容和已確認預覽不一致。

唯讀盤點另確認版本更新不是廢功能：內容庫有 78 筆 `READY`（英雄 52、裝備 17、系統 3、符文 6），相關目標測試 50/50 通過。因此保留為第二條主流程。

## 3. 使用者決策

- 保留賽事影片與版本更新兩條日常流程。
- 版本更新採手動單選，不保留批次勾選與批次發布 UI。
- 兩條流程都先產生預覽，使用者確認後才可發布。
- Meta、洞察與原始佇列保留於進階工具，不從程式與資料層刪除。
- 桌機採 B 方案：左側操作、右側預覽並排。
- 視覺採低裝飾 LCK 轉播工作台，而非霓虹、玻璃或卡片堆疊。
- 使用者已核可本規格各段，並明確要求不再停下複閱規格，直接寫 TDD 計畫與實作。

## 4. 產品資訊架構

### 4.1 主要導覽

首頁只顯示兩個頂層分頁：

- `賽事影片`：預設選中。
- `版本更新`。

右上角提供 `進階工具`。它使用 Sheet／抽屜，不與兩條日常流程處於同一導覽層級。

### 4.2 桌機與手機

桌機：

- 左欄約 40%：日期、候選、單選與主要動作。
- 右欄約 60%：直式影片、驗證摘要與確認發布。
- 預覽區在工作期間保持穩定，不因錯誤或載入造成版面跳動。

手機：

- 單欄順序固定為操作 → 預覽 → 確認發布。
- 375px viewport 不得有橫向捲動。
- 所有觸控目標至少 44px。

### 4.3 進階工具

進階工具收納：

- Meta 內容工廠。
- 洞察報表。
- 發布佇列。
- `scanId`、`seriesId`、選手 override 與原始回應等工程資訊。

抽屜預設關閉；日常流程不需要開啟它即可完成。

## 5. 視覺系統

方向名稱：安靜的 LCK 轉播工作台。

- 背景：深海軍藍／近黑，但避免純黑造成 OLED smear。
- 主色：單一霧金，用於選中、主要 CTA 與焦點。
- 狀態色：成功綠與錯誤紅僅在功能狀態使用，不作裝飾。
- 字體：沿用 repository-hosted Outfit 與 Cinzel；Cinzel 僅用於品牌／大比分類顯示，正文與操作使用 Outfit。
- 不使用霓虹、glitch、玻璃模糊、持續背景動畫、大量陰影或重複卡片。
- 不重複顯示「已支援」徽章。
- 動效只用於按壓、分頁切換、抽屜與預覽完成，160–220ms，使用 ease-out；支援 `prefers-reduced-motion`。

基礎 UI 使用 Tailwind CSS 與最小集合的 shadcn/ui 元件，只納入 Button、Tabs、Sheet、Select／必要表單基礎。不得安裝整個元件目錄。Lucide SVG icon 只在文字不足以表意時使用，不用 emoji 作圖示。

## 6. 元件邊界

`app/page.jsx` 只負責頁面入口與 portfolio read-only mode，不再承載全部工作流實作。

預定元件：

- `app/components/studio/StudioShell.jsx`：品牌、主分頁、進階工具入口、響應式骨架。
- `app/components/studio/EsportsWorkflow.jsx`：日期、候選單選、preview-only render、確認發布。
- `app/components/studio/VersionWorkflow.jsx`：內容類型、內容單選、預覽、確認發布。
- `app/components/studio/PreviewPanel.jsx`：固定比例播放、媒體檢查、發布 CTA 與平台結果。
- `app/components/studio/AdvancedToolsSheet.jsx`：Meta、洞察、佇列與工程資訊。
- `app/components/studio/WorkflowStatus.jsx`：載入、空資料、可恢復錯誤與成功摘要。
- `app/components/ui/*`：經 shadcn/ui 建立的最小基礎元件。

每個 workflow 自己擁有選擇與預覽 state；切換主分頁時元件保持 mounted，使已選內容與預覽不會遺失。

## 7. 賽事影片資料流

1. 日期預設為使用者本機日曆的昨天。
2. `POST /api/esports/candidates` 取得真實候選並顯示為可理解的系列賽列，不顯示 raw IDs。
3. 使用者單選一場；預設選第一個可用候選。
4. `POST /api/esports/player-radar` 必須帶：
   - `mode: "preview"`
   - `languages: ["zh"]` 作為日常 UI 預設，避免無意生成不使用的英文片；進階工具仍可覆寫。
   - 選定的 `scanId` 與 `seriesId`。
5. route 回傳 `videos`、`payloads`、`validationReports`；只有每一份 validation 都 `passed` 才進入 `previewReady`。
6. 確認發布時呼叫 `POST /api/publish`，使用同一份已驗證的 `videos` 與 localized PLAYER_RADAR analysis，不重新 render。
7. 兩平台結果分開顯示；若只有一個平台失敗，只能重試失敗 job，不重複發布成功平台。

## 8. 版本更新資料流

1. 預設載入現有內容庫，不要求使用者先按掃描才看到資料。
2. 類型保留英雄、系統、裝備／符文篩選。
3. 使用者一次只能選一則；切換類型後保留該類型自己的合理預設選擇。
4. `POST /api/content-factory/preview` 以 `render: true` 生成預覽。
5. preview route 在 render 與必要檢查成功後，把 `renderResult.videos`、`renderedAt` 寫回該內容項目；不得改成 PUBLISHED 或建立 queue。
6. 確認發布呼叫既有 `POST /api/content-factory/publish`，只傳單一 `itemIds: [id]`。route 必須重用保存的 `renderResult`，不得重算。
7. 成功後刷新該內容項目的狀態與平台連結。

## 9. 狀態機與發布安全

兩條流程共用概念狀態：

`idle → scanning/loading → selected → rendering → previewReady → publishing → published | partialFailure | recoverableError`

安全規則：

- `previewReady` 前不渲染發布按鈕，不只是 disabled。
- 新選擇、重新掃描或會改變輸出的設定，必須清除舊 preview。
- render 或 validation 失敗保留選擇，顯示原因與重試。
- publish 中按鈕 disabled，防止重複送出。
- portfolio read-only mode 對所有 mutation 按鈕維持 disabled 與說明。
- 工程用 raw payload 只能在進階工具查看。
- 預覽與 canary 不得建立 publish queue、daily run 或 publish package。

## 10. 錯誤與空狀態

- 候選為空：說明該日期沒有已完成且資料完整的賽事，提供換日期與重新掃描。
- Leaguepedia 限流：顯示可重試時間，不清掉目前日期。
- 內容庫為空：提供掃描版本內容 CTA。
- render 失敗：顯示人類可理解原因，不顯示完整 stack trace。
- validation 失敗：列出失敗檢查，禁止發布。
- publish auth 失敗：指出需要重新連接哪個平台，但不顯示 token 或帳號識別資訊。
- 部分發布失敗：成功平台保持成功狀態，僅提供失敗平台重試。

## 11. TDD 與驗收

垂直切片順序：

1. 精簡 shell：先測首頁只暴露兩個主流程與進階入口，再實作。
2. 賽事 preview-only：先重現 UI 未傳 mode 導致 production 的風險，再實作。
3. 預覽發布閘門：先測未驗證不可發布，再實作。
4. 同一支賽事影片發布：先測確認發布沿用已驗證影片，再實作。
5. 版本單選：先測多選 UI 消失且一次只有一個 itemId，再實作。
6. 版本預覽持久化：先測 preview 不保存 renderResult，再修 route。
7. 版本發布重用：先測 publish 不再次呼叫 renderer，再實作。
8. 進階工具：先測主畫面無 Meta／洞察／raw queue，再實作 Sheet。
9. 狀態與響應式：逐一補 loading、empty、error、partial failure 與 mobile flow。

驗證層級：

- Unit：狀態轉換、response normalization、route guards、preview persistence。
- Integration／contract：實際 filesystem 隔離、內容 store、publish queue、API response shape。
- Browser：兩條主要操作流程、鍵盤、focus、手機無 overflow。
- Preview-only canary：一支真實賽後判讀預覽與一支版本更新預覽；前後驗證 queue／daily runs／publish packages 無新增。
- 完整 gates：`npm ci`、`npm run tdd:doctor`、`npm run test:coverage`、`npx next build`、`npm audit --audit-level=high`、`npm run qa:render`。
- 前端截圖：兩輪，每輪只截 1280×800 與 375×812；逐項檢查層次、留白、字體、配色、對齊、響應式、狀態與動效。

本輪不以真實 IG／Threads 發文作 UI 驗收。發布使用隔離 queue／provider boundary；任何真實發文仍需使用者當下明確確認。

## 12. 非目標

- 不刪除 Meta、Insights、publishing、content factory 或 esports backend。
- 不改 25 秒賽後判讀影片的已核可畫面與節奏。
- 不重做 Remotion 模板。
- 不新增資料來源。
- 不恢復歷史影片或歷史 queue。
- 不增加批次版本選取。
- 不把此工作台部署成新的重複正式站；若 repository 仍無既有 deployment target，push 後只驗證 GitHub source checks。

## 13. 完成定義

- 首頁第一屏只看到賽事影片、版本更新與進階工具。
- 賽事影片預設純預覽，無 preview 時不可能發布。
- 版本更新一次只能選一則，確認發布重用已確認影片。
- 兩條流程都有 loading、empty、error、validation、success 與 partial failure 狀態。
- Meta、洞察與 queue 可從進階工具抵達，但不干擾日常流程。
- 375px 無橫向捲動，鍵盤 focus 清楚，prefers-reduced-motion 有效。
- 所有測試、build、audit、QA render 與兩輪截圖驗收通過。
- `HANDOFF.md` 記錄最終截圖、測試、canary、副作用封條與 GitHub checks。
