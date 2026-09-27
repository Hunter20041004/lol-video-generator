# 賽後判讀 LoL 賽事轉播視覺施工計畫

**Goal and acceptance:** 將現有 40 秒六幕賽後判讀從暗房編輯風改為可辨認的 LoL 賽事轉播／遊戲結算視覺。完成後，首幕一秒能讀到隊伍與比分；英雄、隊徽、召喚峽谷、物件控制與勝利結算形成 LoL 身分；每幕仍只有一個主焦點，最後 2 秒完全靜止。中英文真實 canary、媒體閘門與發布零副作用都要通過。

**Scope and non-goals:** 依 [核可設計](../specs/2026-09-27-post-match-read-lol-broadcast-visual-design.md) 修改 `PostMatchReadFrame`、六幕視覺元件、視覺 token、動態語意、必要的本機抽象裝飾資產、`DESIGN.md` 與測試。保留 1,200 frames、故事模型、真實資料、音樂、OAuth、公開媒體 gateway、queue 與社群文案；不建立 Meta container、publish job 或遠端貼文，不新增付費或執行期外部依賴。

**Architecture and interfaces:** `postMatchReadBuilder` 仍提供 `seriesContext`、`resultHook`、`matchup`、`gameFlow`、`proof`、`finalRead`；`playerRadarAssetPlanner` 仍提供已驗證隊徽、英雄頭像／氣氛圖、選手照與 `mapSrc`。`PostMatchReadFrame.jsx` 負責共用 LoL 舞台，`PostMatchReadScenes.jsx` 只消費既有 model 並依幕呈現。資料流：已驗證證據 → 既有 story model → 既有 asset plan → LoL 共用舞台與六幕 → Remotion → 媒體驗證。

**Environment and checks:** Node 與 npm 版本沿用 lockfile／GitHub CI。Focused tests 用 `node --test tests/unit/render/<file>.test.js`；Task 收尾用 `npm run verify`、`npm run qa:render`、`npm audit --audit-level=high`。真實影片用 `npm run canary:post-match-read`，再以 `ffprobe`、抽幀與已校準 freeze 比對驗證。前端視覺依專案規則做兩輪 1280×800 接觸表與 375×812 檢視，並執行 `impeccable detect` 與動效審查。

**Execution and finish:** Codex 在既有 managed worktree `codex/lol-broadcast-visual` 逐項執行。每個行為遵守 Red → Green → Refactor；不平行修改相同檔案。完成簡短使用者／LoL 內容編輯 QA、自我 code review、全測後合併 `main`、在 `main` 重跑全測、push、等待 CI／CodeQL，更新原本機 `http://localhost:49761/` 並驗證。專案沒有公開 production target，不建立新站。

## Task 1：共用舞台一眼具有 LoL 身分

**Acceptance:** 任一幕的靜態 HTML 都使用峽谷深藍黑、海克斯金、符文青、月白 token，具有峽谷地形層、切角邊框與六角進度節點；不存在舊朱紅、底片顆粒與校樣記號。中英文標頭不重複。

**Files:** `src/templates/player-radar/PostMatchReadFrame.jsx`、`src/templates/player-radar/postMatchReadVisuals.js`（新增）、`tests/unit/render/postMatchReadFrame.test.js`、`DESIGN.md`

- [ ] Red：在 `postMatchReadFrame.test.js` 新增一個舞台契約測試，斷言 LoL token／六角進度語意存在、舊 `#E94B35` 與 film-grain 不存在；執行該檔，確認因現有暗房舞台而失敗。
- [ ] Green：建立單一視覺 token／切角 helper，最小改寫 Frame 背景、header、側標與進度列；執行同一測試通過。
- [ ] Refactor：把共用色彩、字型與切角樣式集中在 `postMatchReadVisuals.js`，避免六幕各自發明顏色；保持測試全綠。
- [ ] 更新 `DESIGN.md` 的核心概念、色彩、形狀、素材與動態規則，明記舊暗房語言被取代。

## Task 2：賽果與對位像 LoL 賽事轉播

**Acceptance:** Result 首幕是 BO5 比分板，兩隊隊徽與巨大比分清楚、勝方使用唯一金色焦點；Matchup 是有位置標識、兩位真實英雄頭像與單一 metric 的對位面板。缺英雄時仍以選手／隊伍身份安全退回，不出現破圖或假英雄。

**Files:** `src/templates/player-radar/PostMatchReadScenes.jsx`、`tests/unit/render/postMatchReadScenes.test.js`（新增）、`tests/unit/render/postMatchReadCanary.test.js`

- [ ] Red：新增 Result 場景渲染測試，給定 T1 2–3 HLE 與已驗證 crest，斷言兩隊身份、score、winner treatment 與 `SERIES RESULT`，並斷言沒有 proof-mark／灰階濾鏡；確認失敗。
- [ ] Green：建立 `BroadcastScoreboard`／`TeamIdentity` 私有元件並改寫 Result；同檔測試通過。
- [ ] Red：新增 Matchup 場景測試，給定 MID、Ryze/Orianna 與 KDA delta，斷言 role、雙英雄、單一主 metric 及缺圖安全 fallback；確認失敗。
- [ ] Green：建立切角英雄框與中央 matchup rail；保留 metric-driven 單位與單一焦點；同檔測試通過。
- [ ] Refactor：抽出共用 `HexFrame`、`WinnerAccent`，不改 story model 介面。

## Task 3：前期資源與地圖轉換使用峽谷語法

**Acceptance:** Early Control 以已驗證 Summoner's Rift map、幼蟲／預示者語意節點與主數字呈現；Map Conversion 以同一證據槽依序顯示塔數與經濟差。不得暗示 model 未提供的精確座標、路線、擊殺或時間。

**Files:** `src/templates/player-radar/PostMatchReadScenes.jsx`、`tests/unit/render/postMatchReadScenes.test.js`

- [ ] Red：新增 Early Control 測試，斷言 map asset、`VOID GRUBS`／`RIFT HERALD` 語意與 team-final 來源，並確保 markup 沒有 event timestamp／path claims；確認失敗。
- [ ] Green：建立 `RiftObjectiveBoard`，只把 `voidGrubs`、`riftHeralds` 與 team identity 映射成節點；測試通過。
- [ ] Red：新增 Map Conversion 前後拍測試，分別斷言 tower 與 gold 共用單一 evidence slot，不同時並列；確認失敗。
- [ ] Green：建立轉換軸與單一 evidence slot，保留 frame 120 swap；測試通過。
- [ ] Refactor：讓 map backdrop 與 objective nodes 共用 token，避免多餘框線。

## Task 4：選手證明與最後判讀像正式結算

**Acceptance:** Player Proof 是正式賽事選手卡，保留真實選手照、隊徽、handle、角色、數據 MVP 候選與單一主數據；Final Read 是勝方金色結算框與一句結論，38 秒後沒有輪替證據。

**Files:** `src/templates/player-radar/PostMatchReadScenes.jsx`、`tests/unit/render/postMatchReadScenes.test.js`、`tests/unit/render/postMatchReadMotion.test.js`

- [ ] Red：新增 Player Proof 測試，斷言 portrait、crest／team identity、handle、candidate label、主數據與單一 secondary slot；確認失敗。
- [ ] Green：建立 `PlayerBroadcastCard`，將人物照片由灰階暗房圖改成隊伍色彩受控的賽事卡；測試通過。
- [ ] Red：新增 Final Read 讀取期／freeze 期測試，斷言 35–38 秒可輪替已顯示證據、38 秒後只剩 winner、score、conclusion；確認失敗。
- [ ] Green：建立 `VictoryLockup` 並移除 proof mark；保持 frame 1,140 freeze；測試通過。
- [ ] Refactor：統一 winner treatment，不讓金色同時出現在多個競爭焦點。

## Task 5：動態符合賽事導播、沒有裝飾性躁動

**Acceptance:** 每幕最多兩個 motion event；進場 8–10 frames ease-out、地圖節點只點亮一次、換幕無白閃／故障／彈跳；reduced-motion 無位移縮放；frame 1,140 後視覺完全相同。

**Files:** `src/templates/player-radar/postMatchReadMotion.js`、`src/templates/player-radar/PostMatchReadScenes.jsx`、`tests/unit/render/postMatchReadMotion.test.js`、`tests/unit/render/postMatchReadScenes.test.js`

- [ ] Red：調整 motion contract 測試為 broadcast 語意（score lock、matchup rail、objective lock、conversion swap、player reveal、victory lock），確認舊 event 名稱失敗。
- [ ] Green：只改 motion event 合約與必要的 scene 呼叫；同檔測試通過。
- [ ] Red：新增 node highlight 一次性與 freeze 後不變測試；確認缺少 helper 或行為不符。
- [ ] Green：補最小 deterministic progress helper；reduced-motion 回傳終態而非位移；測試通過。
- [ ] 使用 `review-animations` 逐項檢查 purpose、properties、curve、duration、interruption、reduced motion，修正後重跑 focused tests。

## Task 6：真實中英文成品與兩輪視覺 QA

**Acceptance:** 中文與英文 canary 都是 LoL 賽事轉播視覺、1080×1920、30fps、約 40 秒、音訊合格、frame 1,140 後靜止、publish jobs 0。桌機接觸表與手機檢視兩輪均無擁擠、溢位、身份錯置或 AI 模板感。

**Files:** `scripts/renderPostMatchReadCanary.js`（僅必要時）、`.screenshots/post-match-read-lol-broadcast-round{1,2}/`（ignored evidence）、`HANDOFF.md`

- [ ] 執行 focused render tests 與 `npm run canary:post-match-read` 產生中文成品；使用既有 locale 入口產生英文成品，不改發布狀態。
- [ ] 先用已知不同影格校準 SSIM／PSNR 可分辨，再驗證 38.0 秒與片尾 freeze；記錄測量方法與結果。
- [ ] 第一輪擷取六幕 1280×800 接觸表與 375×812 檢視；以一般 LoL 觀眾（辨識題材／讀懂勝因）與電競內容編輯（資料／身份可追溯）角度列出已證實缺陷、待驗證風險、改善提案。
- [ ] 對已證實缺陷逐一 Red → Green → Refactor，重跑受影響 focused tests 與抽幀。
- [ ] 第二輪重做雙尺寸檢視，執行 `impeccable detect`；動效程式若有修訂，再跑 `review-animations`。
- [ ] 更新 `HANDOFF.md`：成品路徑、媒體規格、兩輪證據、publish 零副作用、測試與剩餘限制。

## Task 7：完整驗證、合併與原工作台更新

**Acceptance:** 所有修改在分支與合併後 `main` 都通過既有關卡；遠端 main、CI／CodeQL 與本機常駐工作台都含最終提交；使用者既有未提交 Meta 修改完整保留。

- [ ] 產品理解檢查點：回報產品能力、使用者體驗、技術區塊、資料流、設計理由、備援、安全與成本、focused 證據、剩餘限制。
- [ ] 執行 `npm run verify`、`npm run qa:render`、`npm audit --audit-level=high`；分開記錄既有 warnings 與本輪失敗。
- [ ] 自我 code review：核對設計規格、資料真實性、locale、資產 fallback、motion、freeze、無發布副作用與 diff 範圍；修正後重跑受影響檢查。
- [ ] `git diff --check`，只提交本輪檔案；快轉合併 `main`，不得納入原工作區的 Meta callback 修改、`.impeccable/`、`assets/`、`AGENTS.md` 或 `CLAUDE.md`。
- [ ] 在 `main` 重跑 `npm run verify`、`npm run qa:render`、audit；push 並確認遠端 SHA，等待 CI／CodeQL 成功。
- [ ] 重新啟動既有 LaunchAgent，驗證 `http://localhost:49761/` HTTP 200 與使用者視角核心流程；無 production target，因此不建立新站。
