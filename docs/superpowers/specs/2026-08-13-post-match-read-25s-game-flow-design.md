# 「賽後判讀」25 秒戰局解析重設規格

## 狀態與覆寫範圍

- 日期：2026-08-13
- 書面狀態：使用者已於 2026-08-13 明確回覆「規格通過」，本文件正式核可。
- 受眾：一般《英雄聯盟》玩家，不假設觀眾熟悉進階數據術語。
- 對外名稱：`賽後判讀 / POST MATCH READ`。
- 輸出：音樂＋動態文字，無旁白，直式 1080×1920、30fps、固定 750 frames／25.0 秒。
- 內部相容：保留 `PLAYER_RADAR` composition、`PlayerRadarVideo`、現有 API route 與發布入口；觀眾端不得顯示舊的 Player Radar 名稱。
- 本文件覆寫 [2026-08-13-post-match-read-lol-native-design.md](./2026-08-13-post-match-read-lol-native-design.md) 的 12 秒片長、四幕文案、中央 Hextech 主線、英雄原畫主導、無選手照片與 12 秒音樂片段要求。
- 舊規格已完成的資料誠實、資產 cache、音樂 SHA-256、媒體驗證、預覽／正式佇列隔離與安全閘門繼續有效，除非本文件另有明確修改。

已核可的視覺 mockup 位於本機 ignored brainstorm 資料夾，只供設計過程參考；本文件必須單獨、完整地描述成品，實作與 review 不得依賴暫存 HTML 才能判斷是否正確。

## 產品目標

12 秒版本的資料是正確的，但閱讀過快，英雄原畫經常裁到身體而不是臉，中央裝飾線干擾文字，也缺少一般玩家想看的「這場比賽怎麼被贏下來」。新版本要讓觀眾依序理解：比賽結果、關鍵對位、物件如何反映在地圖與經濟、數據 MVP 候選，以及一句可以記住的賽後判讀。

成功標準：

- 一秒內能辨認 LoL、對戰雙方與系列賽結果。
- 英雄辨識一定由官方方形頭像承擔；氣氛原畫不得再次成為錯誤臉部裁切的唯一辨識來源。
- MVP 幕直接顯示正確、已授權的選手照片，不用英雄圖冒充選手。
- 25 秒在 1× 速度下可讀完，不以縮字、同步塞入多組資料或快速 spring 維持節奏。
- 每個關鍵幀只有一個主角：對位看英雄臉、戰局看地圖證據、MVP 看選手、收尾看判讀。
- 戰局解析只使用 snapshot 可驗證的最終隊伍資料；沒有事件時間軸時不得顯示虛構分鐘數或精確路徑。
- 最後 1.5 秒完全靜止，讓觀眾讀完，不加 CTA 跳動或裝飾特效。
- preview、test、dry run 與 canary 永遠不得建立正式 queue、daily run、publish package 或社群貼文。

## 主方案與備援

### 主方案：Broadcast Hero ＋ Tactical Transmission

對位與 MVP 使用 Broadcast Hero：一位英雄或選手是絕對主角，大名字、大差值與一句中文結論形成三段閱讀。戰局使用 Tactical Transmission：地圖降暗成資料載體，只亮兩組可驗證的物件／塔／經濟證據。

不同場景不再硬套同一張模板。它們只共用品牌列、字體、金／青色、角落定位記號與左右安全區，藉此保留同一支影片的視覺一致性。

推薦理由：這最符合一般玩家的觀看順序；先認人與英雄，再看數字，最後得到結論。它也避免上一版「上半圖、下半數字」的 dashboard 感。

### 備援一：Editorial Split

若某位選手照片的去背品質不足，但已確認正確且可用，可採較冷靜的賽事雜誌式左右分割版；照片仍需保留清楚臉部，不能改用英雄圖替代真人。此方案秩序穩定，但短影音第一眼衝擊較弱。

### 備援二：阻擋 render

若英雄方形頭像、選手照片或戰局資料不足以支撐核可畫面，應阻擋 render 並回傳可操作錯誤。不得用灰色 placeholder、通用 AI 人像、錯誤隊服、任意 splash crop 或虛構事件補洞。

## 25 秒故事節奏

影片使用五個敘事段落，但只建立四種視覺空間；結果 Hook 與對位共用第一個場景，避免五張卡片連續硬切。

### 01 結果 Hook：0.0–4.0 秒

- 顯示聯賽／BO3、隊伍縮寫與 `GEN 2–0 HLE`。
- 比分作為第一個視覺落點，但不能壓住英雄臉或主判讀。
- 進場順序：低對比雙英雄氣氛 → 比分 → 雙方隊徽；英雄方形頭像延後到對位段才出現。
- 不在 Hook 塞入完整對位統計；主數字在下一段才揭露。
- 本段與下一段共享同一空間，只調整焦點，不做全畫面硬切。

### 02 關鍵對位：4.0–9.0 秒

- 使用官方方形英雄頭像作主辨識，原畫只保留低對比氣氛。
- 本次核可示例是 Mid：Chovy 對 Zeka。
- 主數字：`+72 GPM`；輔助證據：Chovy `460 GPM / 768 DPM`，Zeka `388 GPM / 649 DPM`。
- 文案：「不是一波打贏。是每分鐘都在擴大差距。」
- 對位角色與文案必須由 view model 決定；若未來選中 Jungle、ADC 等其他位置，不得殘留硬編碼的「打野」或「中路」。

### 03 遊戲過程：9.0–17.0 秒

- 地圖是證據載體，不是裝飾背景；整體降暗，兩個資料節點依序亮起。
- 核可示例使用 Game 1 最終隊伍資料：HLE `3 Void Grubs + 1 Herald`；GEN `1 Baron / 8 Towers`；GEN 終局經濟領先 `8,917`；塔數 `8–4`。
- 公開主句使用「HLE 拿到前期資源，GEN 最後拿走地圖」，避免把沒有事件時間戳的資料說成精確先後手。
- `1 → 8` 是賽後判讀的視覺縮寫，不是逐事件時間軸；畫面必須同時標明 `1 Baron / 8 Towers` 與 team final totals，不能顯示虛構分鐘數。
- 結論：「物件本身不是勝點，物件之後換到幾座塔才是。」
- 不畫中央連接線、假移動路徑、選手走位、會戰位置或未被資料源驗證的箭頭動畫。

### 04 數據 MVP 候選：17.0–22.0 秒

- 選手本人是唯一視覺主角；照片保留完整臉部與足以辨識隊服的上半身。
- 核可示例顯示 Ruler；公開標籤固定為「數據 MVP 候選」，除非資料源另有可驗證的官方 MVP 欄位。
- 主數字：`9.88 CS/min`；輔助證據：`473 GPM / 739 DPM`；英雄池：Caitlyn／Seraphine 官方方形頭像。
- 文案：「穩定吃下經濟，讓地圖優勢有輸出終點。」
- 選手照片不能被英雄原畫遮臉；去背照下緣必須以遮罩柔化，不能出現水平硬切。

### 05 最後判讀：22.0–25.0 秒

- 背景英雄原畫壓暗，只留下比分、總結與兩條已出現過的證據。
- 主句：「GEN 的勝點不是搶得多，而是把每次領先換成塔與輸出。」
- 回顧 `+72 GPM` 與 `9.88 CSM`；不加入新資料。
- `2–0` 的 `2`、`–`、`0` 必須是三個獨立排版元素：數字約 255px，分隔號約 103px，分隔號左右各至少 24px clear space；不得用負字距把三個字元黏在一起。
- 23.5–25.0 秒完全靜止；音樂可以安全淡出，但視覺不得再移動。

## 視覺系統

### 視覺階層

- 每幕只允許一個最高焦點；英雄臉、地圖證據、選手臉與結論不在同一幕爭主角。
- 主標與正文至少差兩級；主數字不與長句共用同一行。
- 關鍵中文每行以 6–14 個全形字為原則，最多三行；不得出現單一標點或一個中文字落在下一行。
- 資料來源屬第三層資訊，但仍須在 375px 全螢幕下辨識，不得縮成純裝飾細線。

### 構圖與安全區

- 成品左右安全區至少 60px；品牌列、主數字、結論與來源共同對齊此邊界。
- 重要內容放在垂直 110–1580px；底部保留平台 UI 緩衝。資料來源可放在更低處，但不得承擔理解主句所需資訊。
- 可保留四個角落中最多兩個 L 形定位記號；它們只建立賽事轉播感，透明度必須低於主文字。
- 禁用圓角 dashboard cards、大面積玻璃模糊、中央 Hextech 線、重複 lower-third、直排裝飾字、無功能斜切塊與裝飾粒子。
- 場景之間允許不同版型；不得再用「同一套網格，三幕只換內容」作為一致性的定義。

### 英雄與選手素材

- 結果 Hook 使用經來源、SHA-256 與尺寸驗證的雙方隊徽；不得再用英雄頭像代替隊伍識別。隊徽只承擔隊伍辨識，比分仍是本幕最高焦點。
- 英雄方形頭像是身份辨識來源，對位主角約 275×275px，次要對手約 230×230px；不得靠 splash crop 猜臉的位置。
- Splash art 只作低對比氣氛，可做最多 1.5% 緩慢推近；不能搶過方形英雄臉、數字或選手。
- 選手照由獨立 asset manifest 管理，至少保存 `playerId`、公開名稱、隊伍、賽季、來源 URL、license note、SHA-256、檔案尺寸與最後驗證時間。
- 使用者已確認所有選手照片可用於影片並可隨 GitHub repository 保存，不需要逐位再次詢問；實作仍須核對 player／team／season 與 SHA-256，防止抓到錯人或舊隊服。
- 核可的 Ruler 2026 GEN 圖來源為 `https://static.wikia.nocookie.net/lolesports_gamepedia_en/images/e/e3/GEN_Ruler_2026_Split_1.png/revision/latest?cb=20260122171312`，SHA-256 為 `9b10b93cc8368c90c82dd1381151931e6f857a4beb6a34e46469ea6aee9d558d`。
- 照片來源失效或 hash 改變時先停止並回傳資產錯誤，不自動接受遠端替換內容。

### 色彩

- 深藍黑背景：`#03080C`、`#07141D`。
- 判讀金：`#CFAD67`；用於比分、主數字、結論關鍵詞與少量定位記號。
- 戰術青：`#49D8D3`；用於資料轉折與次要勝方證據。
- 主文字：`#F4EAD5`；次要文字：`#93A3AA`。
- 每幕最多一個主要強調色加一個輔助色；不得只靠顏色表達勝負，必須同時顯示隊伍或文字。

### 字體

- 英文、比分與數字使用 OFL 授權的 Barlow Condensed 800／900，自行存放必要 subset 與 license，不在 render 時依賴 Google Fonts 網路。
- 中文主句使用 OFL 授權的 Noto Sans TC 900；資訊文字使用 700。建立 repository-hosted subset 與 glyph coverage test，缺字時必須失敗，不允許靜默退回系統字型。
- 數字使用 tabular figures；比分的三個元素獨立定位，不能用 letter-spacing 模擬間隔。
- 英文只用於 `POST MATCH READ`、資料單位與極短賽事標籤；一般玩家要理解的主句、物件名稱與結果一律中文優先。

## 動態與節奏

- 每個段落最多兩個主動態事件；一個事件可以包含同組元素的短 stagger。
- 進場使用 opacity、transform、scale 或 clip reveal；不動畫化 width、height、top、left 或文字換行。
- 進場以強 ease-out，退出比進場快；不使用反覆 spring、彈跳 badge 或持續旋轉。
- 英雄方形頭像從 0.96 scale＋opacity 進場，不從 scale 0 出現。
- 對位幕：雙英雄頭像先後 50–80ms，接著 `+72 GPM` 揭露；結論最後出現。
- 戰局幕：地圖 crossfade，HLE 前期物件與 GEN 轉換資料依序亮起；不畫兩點連接線。
- MVP 幕：選手照以輕微 clip reveal 顯示，數據與英雄池在臉部穩定後出現。
- 收尾：比分、主句、兩條回顧依序出現，23.5 秒後全部停止。
- 所有動態必須支援 reduced-motion 測試模式；該模式保留短 opacity transition，移除位置與縮放移動。

## 音樂與聲音

- 沿用三首已授權、tracked、SHA-256 驗證的正式曲庫；不新增未驗證音樂。
- 每首曲目必須有至少一段可容納 25 秒的 `safeSegment` 與 downbeat 座標；12 秒有效片段不能直接被視為 25 秒有效。
- 切點目標為 4.0、9.0、17.0、22.0 秒，可在不壓縮閱讀時間的前提下吸附到前後 0.2 秒的重拍。
- 第一個可聽 sample 不得晚於 50ms；integrated loudness 維持 `-18 至 -16 LUFS`，true peak 不高於 `-1 dBFS`。
- 音訊開頭、結尾與實際剪接邊界使用至少 30ms fade；最後 1.5 秒畫面靜止不等於音樂必須突然停止。
- 三首都沒有有效 25 秒片段時阻擋 render，不產出靜音成品。

## 故事資料模型

現有 `postMatchRead` view model 擴充為以下責任區塊；Remotion template 只讀解析完成的 view model，不自行選人、排名或抓遠端資料。

- `branding`
  - `publicTitle`、`publicTitleEn`
- `seriesContext`
  - league、seriesId、snapshotId、隊伍縮寫、比分、gameCount、scope label
- `resultHook`
  - score parts、result claim、display order
- `matchup`
  - role、focus player、opponent player、raw evidence、claim、claim scope
- `gameFlow`
  - game number、team final objective totals、gold、towers、analysis claim、claim basis、`hasEventTimestamps`
- `proof`
  - player、label type、raw stats、champions、reasons
- `finalRead`
  - conclusion、兩條 recap references；只能引用前面已顯示的資料
- `assets`
  - champion square、optional splash、map、player portrait manifest entry、fallback state
- `audioPlan`
  - track ID、source start、25 秒 safe segment、cut frames、gain、fade
- `storyboard`
  - `RESULT_HOOK`、`MATCHUP_EDGE`、`GAME_FLOW`、`PLAYER_PROOF`、`FINAL_READ`

`gameFlow.analysisClaim` 必須由資料建構器產生並保存 claim basis。沒有事件時間戳時，`hasEventTimestamps` 為 false，template 不得出現 `18:00`、龍團位置或其他精確事件敘事。

## 系統邊界與資料流

```text
Leaguepedia player snapshot ─┐
ScoreboardTeams final data ──┼→ 25 秒故事建構器 → 素材／照片／音樂規劃器 → Remotion
Data Dragon champion assets ─┤                                             ↓
授權選手照片 manifest ───────┤                                      媒體驗證閘門
授權音樂曲庫 ────────────────┘                                             ↓
                                                              production 才可寫發布佇列
```

### 故事建構器

負責系列結果、角色對位、戰局證據、MVP 候選、角色感知文案與最後判讀。它是純資料層，不讀寫 render、queue 或 publish package。

### 素材／照片／音樂規劃器

在 render 前解析官方英雄素材、地圖、選手照片 manifest 與 25 秒音訊片段。所有網路來源先轉成本機、SHA 驗證的明確資產；Remotion 不在每幀發網路請求。

### Remotion

只負責四種核可視覺空間、五段時間軸與動態。保留既有 composition ID；將固定 360 frames 改為 750 frames，且不得附加舊的 lead-in 或 final buffer。

### 媒體驗證與發布邊界

媒體閘門在任何 production job 之前驗證片長、stream、fps、音訊、關鍵幀、字型、資產 hash、runtime path 與正式資料封條。preview、test、dry run、canary 即使驗證通過也不建立發布任務。

## 錯誤與降級規則

- 缺同位置對手或不足兩項可驗證對位證據：停止。
- `ScoreboardTeams` 缺失：若仍有同一 snapshot 內兩項可驗證 team-final 指標，可用簡化戰局幕；完全沒有隊伍層級證據則停止，不用選手數據假裝戰局解析。
- 沒有事件時間戳：允許最終隊伍資料與明示的賽後推論；禁止分鐘數、路徑與逐事件因果。
- Champion square 缺失：停止；splash 缺失則改用 square＋低對比地圖氣氛，不影響身份辨識。
- 選手照片缺失、player／team／season 不符或 SHA 改變：停止並回傳具體資產錯誤。
- 沒有官方 MVP：使用「數據 MVP 候選」或「關鍵人物」，不是錯誤。
- 角色文案找不到對應模板：停止，不回退到硬編碼的「打野」。
- 三首音樂都缺 25 秒 safe segment：停止。
- render 成功但媒體驗證失敗：保留 ignored preview 供除錯，不建立 queue、daily run 或 publish package。
- 測試／預覽 runtime root 無法解析：立即失敗，不回退到 repository 正式 `.data`。

## TDD 實作與驗收策略

正式實作必須逐個垂直切片執行 `Red → Green → Refactor`；一次只寫一個會失敗的測試，確認紅燈原因正確後才寫最少實作。

1. **25 秒時間軸**：先讓 12 秒／360 frames 契約測試因新預期紅燈，再改為五段共 750 frames，確認沒有額外 buffer。
2. **角色感知文案**：先用 Mid fixture 重現硬編碼「打野」錯誤，再集中 role-aware copy；逐角色補測試。
3. **戰局資料**：先測 team-final 資料可生成 `gameFlow`，且缺 event timestamps 時拒絕精確分鐘與路徑，再做最小建構器。
4. **選手照片 manifest**：先測正確 Ruler SHA 可解析、錯人／錯隊／hash mismatch 失敗，再加入 cache 與 resolver。
5. **英雄臉與版型**：先以 composition contract 鎖定 square asset、禁止中央線與四個場景責任，再實作核可 A＋C 視覺。
6. **25 秒音樂**：先測 12 秒 safe segment 不足以通過，加入 25 秒選段、切點與 fade 後跑真實音檔 integration。
7. **媒體與佇列**：先讓驗證器拒絕非 25 秒媒體，更新 H.264／AAC／音量契約，並重跑 preview／canary 零佇列測試。
8. **視覺回歸**：先定義五個關鍵時間與閱讀斷言，render 後抽幀做兩輪手機視覺自檢；動態另做逐幀／慢速審查。

### 邏輯與真實邊界

- Unit：750 frames、role-aware copy、gameFlow claim、MVP label、比分 parts、final recap 不得引入新資料。
- Contract：Leaguepedia／ScoreboardTeams response shape、Data Dragon square asset、選手照片 manifest hash、正式音樂 25 秒片段。
- Filesystem integration：使用 temp runtime root 驗證 preview／canary 不寫正式 stores，並比較正式資料 hash。
- 真實 render：H.264／AAC、1080×1920、30fps、25.0 秒；驗證 LUFS、true peak、leading silence 與結尾 fade。

### 視覺驗收

- 抽幀：0.0、3.8、4.2、8.8、9.2、16.8、17.2、21.8、22.2、23.5、24.9 秒。
- 每輪同時檢查 1080×1920 原圖與 375×667 等比例手機預覽。
- 對位：兩個官方英雄臉都能辨認，splash 不搶主角。
- 戰局：先讀中文結論，再讀兩組資料；地圖不比文字亮。
- MVP：選手臉完整、照片下緣無硬切、英雄池不搶焦點。
- 收尾：`2 – 0` 有獨立間距，中文字無孤字／孤標點，23.5–25.0 秒畫面完全相同。
- 不接受只看 render exit code；需以一般玩家實際看到的畫面與 1× 播放節奏驗收。

### Repository 全套

- `npm ci`
- `npm run tdd:doctor`
- `npm run test:coverage`
- `npx next build`
- `npm audit --audit-level=high`
- `npm run qa:render`
- canary 前後比較 content DB、queue、daily runs 與 publish packages。

## 非目標

- 不使用 LCK 官方轉播影片、會戰錄影或未授權比賽片段。
- 不新增旁白、TTS、真人配音或平台自動字幕。
- 不宣稱數據 MVP 候選是官方 MVP。
- 不從 final totals 捏造事件分鐘、逐事件路徑或選手走位。
- 不重做 Daily one-click、Match Recap、H2H Radar、IG／Threads 發布策略或 API 命名。
- 不建立第二支影片，不在 canary 階段建立社群發布任務。
- 不批次下載所有選手照片；只在候選被選中時解析 manifest 中對應資產。
- 不降低 coverage、audit、CodeQL、媒體或佇列隔離閘門。

## 風險、成本與產品取捨

- 25 秒比 12 秒增加約一倍 render 與儲存成本，但一般玩家能真正讀完，且新增戰局解析，產品價值高於成本。
- 選手照片提升人物連結，但必須維護 manifest 與 SHA；這是一份小型、可測試的資產管理成本，優於每次 render 臨時抓圖。
- 五段故事比四段複雜，因此只保留四種視覺空間並限制每段兩個主動效，避免影片再次變趕。
- Barlow Condensed／Noto Sans TC 需要新增 OFL subset 與 license，但能重現核可視覺且不依賴網路；備援是沿用 Outfit／Noto Serif TC，成本較低但視覺性格會明顯偏離核可稿，不推薦。
- ScoreboardTeams 只有最終隊伍資料時，能做賽後推論，不能做逐分鐘復盤；本輪選擇誠實的「物件轉換判讀」，不假裝擁有完整 replay timeline。

## Rollout

1. 使用者已確認本書面規格。
2. 已依本規格另寫逐步 implementation plan，不直接在現有模板上邊看邊改。
3. 依垂直 TDD 切片完成資料、照片、時間軸、音訊、視覺與媒體閘門。
4. 產出一支 GEN 2–0 HLE 的不發布 canary，完成兩輪抽幀與 1× 節奏審查。
5. 交付產品理解檢查點：能力、體驗、技術結構、資料流、設計理由、替代方案、安全成本、測試證據與剩餘限制。
6. 全套通過後依 repository 規則 commit、合併 `main`、push，並等 GitHub CI／CodeQL；repo 沒有 production deployment target，因此不建立新站。
