# 「賽後判讀」LoL 原生短影音重設規格

## 狀態

- 日期：2026-08-13
- 狀態：產品方向、視覺方向、故事節奏、動態、音樂、架構、錯誤處理與 TDD 驗收均已由使用者逐段核可；等待使用者審閱本文件。
- 受眾：一般《英雄聯盟》玩家。
- 格式：音樂＋動態文字，無旁白，直式 1080×1920、30fps，目標 12 秒。
- 對外名稱：`賽後判讀 / POST MATCH READ`。
- 相容策略：第一版保留現有 `PLAYER_RADAR` composition、API 與程式內代號，避免不必要的路由與呼叫端遷移；觀眾端不得再顯示 `Player Radar`。

本規格取代 [2026-07-08-player-radar-dual-read-design.md](./2026-07-08-player-radar-dual-read-design.md) 的對外名稱、視覺層、敘事節奏、證據排序與 MVP 標示規則。舊規格的 Leaguepedia snapshot、雙判讀 payload、手動指定選手、既有 API 與發布流程相容要求仍保留，除非本文件另有明確覆寫。

## 產品目標

目前影片技術上可發布，但畫面像會動的資料後台：資訊同時出現、場景硬切、LoL 辨識度不足，且用不同單位的原始差值排序證據。重設後，觀眾應在第一秒理解衝突，在 12 秒內看懂一項對位證據、一個數據轉折與一句賽事判讀。

成功標準：

- 第一秒能辨認這是 LoL 內容，而不是泛電競 dashboard。
- 靜音觀看仍能完整理解，不依賴旁白或平台字幕。
- 每幕只有一個最高視覺焦點；不要求觀眾同時讀多組卡片。
- 所有數字有單位與範圍，所有比較可由 snapshot 重算。
- 非官方 MVP 不得包裝成官方結果。
- 測試、預覽與 dry run 不得寫入正式 publish queue、daily runs 或 publish packages。
- 正式 canary 為 360 frames／12.0 秒、音訊非靜音、無開頭空白、可在 375px 手機安全區完整閱讀。

## 已選方向與備援

### 主方案：LoL 原生英雄敘事

使用官方英雄原畫、英雄頭像、Smite／地圖素材、Hextech 金藍材質、銳角框線與 LoL 字體氣質。英雄輪廓主導畫面，介面只負責說明對位、數字與結論。

### 備援一：賽事轉播版

若官方英雄素材在特定候選中不足，退回較平面的 LoL Esports 賽事資訊版：保留隊伍、比分、位置與大數字，但不使用灰色假人物或通用漸層肖像。

### 備援二：固定單曲

主方案保留三首已授權音樂自動輪替。若節拍資料無法穩定支援全部曲目，可先為此格式固定一首曲目；這會降低變化，但不得用未對拍或開頭靜音的音訊交件。

## 官方視覺來源與使用界線

- Riot 官方品牌下載頁提供 Hextech metal、Beaufort for LoL、Spiegel、Logo 與 key art 素材：[League of Legends Downloads](https://www.leagueoflegends.com/en-us/league-of-legends-downloads/)。
- Riot Data Dragon 提供第三方開發者使用的英雄、道具、召喚師技能、地圖與其他靜態資產：[Riot Developer Portal — Data Dragon](https://developer.riotgames.com/docs/lol)。
- Riot 的視覺清晰度原則強調英雄輪廓辨識與單一視覺階層：[Clarity in League](https://www.leagueoflegends.com/en-us/news/dev/clarity-in-league/)。

實作要求：

- 英雄原畫、方形頭像、Smite 與地圖優先走既有 render asset resolver 與本機 cache，不在每幀重抓遠端資產。
- v1 不提交或再散布官方 Beaufort／Spiegel 二進位檔；正式 render 使用既有 repository-hosted Cinzel／Outfit，避免在條款不明時把官方字型放上 GitHub。日後只有在 Riot 的再散布條款明確允許時才另案切換。
- 已授權音樂沿用現有 `enabled + verified + SHA-256` 正式曲庫；不得新增未驗證曲目。
- 不冒充 Riot、LoL Esports 或官方轉播；影片品牌是本專案的「賽後判讀」。

## 視覺系統

### 配色

- 深藍黑背景：`#010A13`、`#0A1428`
- Hextech 金：`#C8AA6E`、暗金 `#785A28`
- 魔法青：`#0AC8B9`、亮青白 `#CDFAFA`
- 主文字：`#F0E6D2`
- 每幕最多一個主要強調色；金色代表判讀與勝方證據，青色代表連續動線與轉折。顏色不得成為唯一的勝負提示，仍需文字與數值。

### 字體

- 英文標題與核心數字：v1 使用既有 Cinzel，以 Beaufort for LoL 的大寫、銳利襯線與高對比字級作為排版參考。
- 英文標籤與小型資訊：v1 使用既有 Outfit，以 Spiegel 的緊湊資訊層級作為排版參考。
- 中文主標：新增一份 OFL 授權、repository-hosted、subsetted Noto Serif TC 700 WOFF2；subset 覆蓋本模板所有固定中文文案，並提交對應 OFL license。glyph coverage test 必須在缺字時失敗，不允許靜默退回不同系統字型。
- 核心數字使用 tabular figures，避免計數動畫造成水平抖動。

### 構圖

- 英雄與對位關係佔畫面約 60–70%。
- 文字與核心數字約 20–30%。
- 比分、聯賽、資料範圍與來源約 10%。
- 不使用圓角 dashboard cards、重複 lower-third、整頁雙重框線或純裝飾粒子。
- Hextech 金屬只用於角標、分隔線、角色圖示外框與轉場主線，不能包住每一塊資訊。
- 每幕最多：一個主數字、一句主結論、一組輔助證據。

## 12 秒 storyboard

### 01 Hook：0.0–1.8 秒

- 使用對位雙英雄原畫與中央 Hextech 裂線。
- 顯示聯賽、BO3、隊伍縮寫與比分。
- 核心數字為可驗證的最大相對差距；本次 canary 使用 `KDA 約 21×`，由 `13.67 / 0.64` 四捨五入得到。
- 文案：「這個系列賽，打野差距有多誇張？」
- 不顯示完整隊名、括號真名或其他次要指標。

### 02 Matchup Proof：1.8–5.0 秒

- 顯示 Jungle、Smite 與同位置選手。
- 本次 canary 顯示 Jackal `13.7 KDA` 對 Dinai `0.64 KDA`。
- 明示 `3-game series average`；不得讓觀眾誤以為是單局資料。
- 結論：「不是小贏，是整個系列賽的斷層。」

### 03 Data Twist：5.0–9.0 秒

- 將對位比較線轉成 ADC 英雄的視覺光線，聚焦 Pyeonsik。
- 本次 canary 核心數字為 `806 DPM`，輔助證據為 `9.77 CS/min` 與實際英雄池 Lucian／Varus／Ezreal。
- 標籤必須是「數據 MVP 候選」，除非 snapshot 另有可驗證的官方 MVP 欄位。
- 文案：「但真正把優勢變成傷害的，在下路。」

### 04 Verdict：9.0–12.0 秒

- 英雄圖壓暗，只保留一個中文判讀。
- 結論：「打野拉開局勢，下路把優勢變成勝利。」
- 輔助回顧 Jackal `13.7 KDA` 與 Pyeonsik `806 DPM`。
- CTA：「下一場，你想看哪條路？」
- 最終完整畫面至少停留 1 秒。

### 可變時長備援

主輸出目標維持 12 秒。若真實 1× 閱讀測試顯示一般玩家無法完成閱讀，允許延長至 14–15 秒；不得用縮小字體、加快多元素同時進場或砍掉資料範圍標示來維持 12 秒。

## 動態規則

- 所有主要動態使用 `transform`、`opacity`、`scale` 或 clip reveal，避免動畫化 layout 屬性。
- 每次只揭露一個獨立資訊：英雄 → 主數字 → 主結論 → 輔助證據。
- 英雄原畫只做約 2–3% 緩慢推近，不做大幅漂移。
- Hook：左右英雄進場，中央裂線劃開，`21×` 最後落點。
- Matchup：裂線縮成比較軸，Smite 亮起，兩個 KDA 依序出現。
- Twist：比較軸延續為槍火／魔法光線，帶入 ADC 英雄與 `806 DPM`。
- Verdict：英雄圖壓暗，結論逐行揭露，最後一秒停止。
- 場景共享同一條 Hextech 金藍主線，維持空間連續性；不得再用四幕硬替換。
- 移除反覆 spring 的頂部 badge、26 個旋轉六角形與不能解釋資料的裝飾動效。
- easing 不使用 linear；進場以 ease-out，退出較進場快，動態不可遮住數字。

## 音樂與聲音

### 節拍資料

為正式曲庫中的三首音樂各保存一份節拍座標資料。最低欄位：

- `trackId`
- `sha256`
- `safeSegments[]`
- 每個 safe segment 的 `startSeconds`、`durationSeconds`、`downbeats[]`
- 建議增益或 loudness correction

自動選曲只從 SHA-256 相符且擁有至少一個 12 秒 safe segment 的曲目中抽選。四個場景切點可在不破壞閱讀下，吸附到目標時間前後 0.2 秒內的重拍；總片長維持 12 秒，最後一幕至少 1 秒。

### 音量

- 第一幀即有可聽音樂；開頭靜音不得超過 50ms。
- 成品 integrated loudness 目標為 `-18 至 -16 LUFS`。
- true peak 不高於 `-1 dBFS`。
- 音訊開頭、結尾與任何剪接邊界使用至少 30ms fade，避免爆音。
- 若選中曲目缺節拍資料，跳過該曲；三首都無有效資料時阻擋 render，不產生靜音成品。

## 故事資料模型

第一版延續既有 payload，但在 template 前建立明確的 `postMatchRead` view model：

- `branding`
  - `publicTitle`: `賽後判讀`
  - `publicTitleEn`: `POST MATCH READ`
- `seriesContext`
  - league、seriesId、team abbreviations、score、gameCount、scope label
- `hook`
  - metric、leftRaw、rightRaw、displayValue、comparisonType、approximate、claim
- `matchup`
  - role、edgePlayer、opponentPlayer、evidence、claimScope、hasAllFiveRoles
- `proof`
  - player、labelType、rawStats、champions、reasons
- `assets`
  - splash、square、role／spell、map 與 fallback 狀態
- `audioPlan`
  - trackId、sourceStart、cutFrames、gain、fade
- `storyboard`
  - 固定 `HOOK`、`MATCHUP_EDGE`、`PLAYER_PROOF`、`CONCLUSION_CTA`

Remotion template 只讀這份 view model，不在 render 過程重新選人、重新排序證據或存取 queue。

## 證據排序與誠實文案

### 對位角色選擇

- 只有五個位置對位都完整時，才能使用「最大差距」。
- 角色間差距沿用可比較的 normalized radar score gap；normalized score 只供內部排序，不顯示為 `100／98／87`。
- 五路不完整但指定對位有足夠證據時，只能說「打野差距明顯」等局部文案。
- 指定對位或自動候選缺同位置對手時阻擋 render。

### 理由排序

- 禁止用 `abs(rawDelta)` 比較 DPM、GPM、KDA 等不同單位。
- 同一對位內，先依 normalized score gap 排序，再以角色適用的指標優先序打破平手。
- Jungle 優先：KDA、KP%、GPM、DPM、CSM、VPM。
- ADC 優先：DPM、CSM、KDA、GPM、KP%。
- 其他位置在 implementation plan 中以同一規則明確列出，不允許 template 自行猜測。
- 只顯示 raw value、ratio 或帶單位 delta；normalized score 不進觀眾畫面。

### Hook 形式

- 分母大於 0 且相對倍率至少 2 時，可顯示「約 N×」。
- 分母為 0 時不得顯示無限倍率，改顯示 raw side-by-side。
- 不足以支撐倍率敘事時，退回帶單位差值或問題型 Hook。
- `approximate: true` 時，中文文案必須包含「約」。

### MVP 標籤

- 既有 `recommendedMvp` 或平均 normalized score 推薦都屬於模型建議，對外顯示「數據 MVP 候選」。
- 手動指定且不是推薦者時，顯示「關鍵人物」。
- 只有資料源提供可驗證官方 MVP 欄位時，才允許顯示「官方 MVP」。

## 系統邊界與資料流

```text
Leaguepedia snapshot ─┐
Riot Data Dragon ─────┼→ 故事建構器 → 素材／音樂規劃器 → Remotion → 驗證閘門 → 發布佇列
授權音樂曲庫 ────────┘
```

### 故事建構器

負責選擇對位、證據、Hook 與 proof label，輸出純資料。不得讀寫 render、queue 或 publish package。

### 素材／音樂規劃器

負責 asset resolution、fallback、曲目與 safe segment、cut frame 與 loudness plan。外部資料要先解析成明確結果，template 不直接發網路請求。

### Remotion template

只負責四幕構圖與動態。保留現有 composition ID 作相容層，但 public label 改為 `POST MATCH READ`。

### 驗證閘門

在任何 publish queue 寫入之前驗證資料聲明、素材、片長、視訊／音訊 stream、音量、關鍵幀、runtime path 與正式資料 hash。預覽與測試模式永遠不建立發布任務。

## 錯誤與降級規則

- 五路資料不完整：不用「最大」；核心對位也不完整則停止。
- 原畫缺失：退回 Data Dragon 官方方形頭像＋地圖背景。
- 原畫與頭像都缺失：停止，不使用灰色 placeholder 或通用 AI 人像。
- 指定選手不存在、缺同位置對手、片段不足兩項可驗證證據：停止並回傳可操作錯誤。
- 沒有官方 MVP：使用「數據 MVP 候選」或「關鍵人物」，不視為錯誤。
- 音樂缺節拍資料：跳過該曲；所有曲目無效則停止。
- Data Dragon 暫時 503：先用既有 cache；cache 無可用 fallback 才停止。
- render 成功但驗證失敗：保留本機 preview 供除錯，不建立 queue／daily run／publish package。
- 測試或預覽路徑解析失敗：立即失敗，不回退到 repository 正式 `.data`。

## TDD 實作順序

每個切片都必須完成 `Red → 確認因預期原因失敗 → Green → 確認通過 → Refactor`，一次只處理一個行為。紅綠循環只跑當前測試檔，Task 收尾才跑完整測試。

### 切片 1：修正跨單位排序

- Red：重現 DPM `+86` 因 raw number 大於 KDA `+13.03` 而被錯選為第一理由。
- Green：改用 normalized score gap 與角色優先序，顯示仍使用 raw value。
- Refactor：抽出可測試、無副作用的 evidence ranker。

### 切片 2：誠實 claim 與 MVP label

- Red：五路不完整時不得產生「最大差距」；推薦模型不得輸出官方 MVP。
- Green：加入 claim scope 與 `data-mvp-candidate` label。
- Refactor：集中所有對外字詞，避免 template 分散判斷。

### 切片 3：官方素材與 fallback

- Red：原畫失敗時應使用官方 square asset；兩者都失敗時不得 render。
- Green：加入 resolver 結果與明確 fallback 狀態。
- Refactor：沿用既有 cache／confinement 邊界，template 只收 resolved URL／path。

### 切片 4：三曲節拍與無靜音開場

- Red：自動選曲必須選到可容納 12 秒且含有效 downbeat 的 safe segment，第一個可聽 sample 不得晚於 50ms。
- Green：加入 beat map selection、cut snapping 與 gain plan。
- Refactor：把曲庫驗證與時間軸計畫分離。

### 切片 5：佇列隔離與驗證閘門

- Red：import、unit test、preview render 與 dry run 不得建立或改動正式 queue／daily run／publish package。
- Green：所有 runtime store 以依賴注入或操作時 cwd/path resolution 取得；publish 只在驗證成功後執行。
- Refactor：統一 preview／production mode，不保留 module-load 時固定 cwd。

### 切片 6：四幕 template 與片長

- Red：view model 必須映射四幕；composition 固定 360 frames，沒有額外 35-frame lead-in 或 30-frame 重複 buffer。
- Green：建立 LoL 原生四幕構圖與 shared Hextech transition。
- Refactor：刪除重複 lower-third、badge spring 與無敘事功能的裝飾粒子。

## 測試與驗收

### 邏輯與契約

- Unit：證據排序、claim scope、倍率格式、MVP label、beat selection、asset fallback。
- Filesystem integration：使用 temp root 驗證 queue／daily run／publish package 隔離，並比較正式資料檔 hash。
- Data Dragon contract：對一個已知英雄與 Smite 走真實邊界，驗證 URL、HTTP status、content type 與非空 body；網路不可用時明確標成 contract skip，不以純 mock 冒充通過。
- Music integration：驗證曲庫 SHA-256、safe segment、第一個非靜音 sample、LUFS 與 true peak。

### 真實 render

- 產出一支不發布 canary，預期 H.264／AAC、1080×1920、30fps、360 frames／12.0 秒。
- `ffprobe` 驗證視訊、音訊 stream、尺寸、fps、duration。
- 使用 ebur128／volumedetect 驗證 `-18 至 -16 LUFS` 與 true peak 上限。
- 在 0、約 1.8、5.0、9.0、11.0 秒及每個 transition 前後抽幀。
- 檢查英雄主體裁切、中文換行、數字單位、手機安全區、場景連續性與最後一秒停留。
- 對成品做 timeline/waveform 檢查，確認沒有 flash、audio pop、錯誤 overlay 或開頭靜音。

### Repository 全套

- `npm ci`
- `npm run tdd:doctor`
- `npm run test:coverage`
- `npx next build`
- `npm audit --audit-level=high`
- `npm run qa:render`
- 完整 canary 前後比較 content DB、queue 與 daily runs hash／筆數。

## 非目標

- 不加入旁白、TTS 或真人配音。
- 不加入隊伍 Logo、選手照片或需要額外授權的新素材來源。
- 不重做 Daily one-click、Match Recap 或 H2H Radar。
- 不新增第二支影片，不改 IG／Threads 平台策略。
- 不在本輪重新命名 API route、composition ID 或所有歷史程式欄位。
- 不在 canary 階段建立社群發布任務。
- 不降低 coverage、audit 或現有安全閘門。

## 風險、成本與限制

- 官方英雄素材提高 LoL 辨識度，但 Data Dragon 可能暫時 503；本機 cache 與 square fallback 是必要邊界。
- 官方 Beaufort／Spiegel 可從品牌頁下載，但 v1 明確不提交這兩套二進位檔；Cinzel／Outfit 加上 OFL 的 Noto Serif TC subset 是可重現且可上 GitHub 的確定方案。
- 三曲節拍資料比固定單曲多一份一次性分析與測試成本，但保留自動產片的變化與長期價值。
- 無旁白使自動化更穩、成本為零，但每幕文字必須更少；無法在 12 秒完整解釋複雜戰術。
- 使用英雄原畫不能證明真實比賽當下畫面；文案只描述系列數據，不暗示某張原畫是比賽截圖。

## 交付與 rollout

1. 先依本規格寫 implementation plan，不直接批次改 template。
2. 依六個垂直 TDD 切片逐一完成。
3. 產出不發布 canary，自檢動態、音樂、資料聲明與佇列隔離。
4. 交付產品理解檢查點與 preview；在全套測試前說明能力、體驗、資料流、設計理由、替代方案、安全成本、測試證據與限制。
5. 全套通過後才依 repository 收尾規則 commit、合併、push；repo 目前沒有 production deployment target，因此不建立新付費站點。
