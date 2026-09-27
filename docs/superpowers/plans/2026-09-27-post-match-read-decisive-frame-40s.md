# 40 秒「決勝一幀」賽後判讀實作計畫

**狀態：** 2026-09-27 使用者已核可。

**目標：** 將既有 25 秒、五幕的賽後判讀影片升級為 40 秒、六幕的「決勝一幀」版本；以比分為第一焦點，每幕只保留一個判讀與一個當下證據，最後兩秒完全定格。

**產品結果：** 一般 LoL 觀眾在靜音觀看時，能依序重述系列賽結果、對位差距、前期資源、地圖轉換、數據 MVP 候選與最後判讀；內容編輯能把每個公開數字追回既有故事模型資料。

**架構與資料流：** `Leaguepedia/既有 snapshot → postMatchRead 純資料模型 → 已驗證圖像/音樂資產 → Remotion 六幕模板 → 40 秒媒體驗證 → 預覽`。本輪不更動 OAuth、發布佇列、Meta container 或正式貼文。

**核可契約：** 1080×1920、30fps、1,200 frames；`RESULT_HOOK 150 → MATCHUP_EDGE 210 → EARLY_CONTROL 210 → MAP_CONVERSION 240 → PLAYER_PROOF 240 → FINAL_READ 150`；frame 1,140 起凍結至片尾。

## 執行原則

- 使用隔離分支 `codex/decisive-frame-40s`。
- 垂直 TDD：每次只新增一個會失敗的行為測試，確認失敗原因後做最小實作，再重構。
- 視覺依已核可 comp「比分主導」施工；不新增付費服務、遠端字型、生成選手照或未驗證賽事資產。
- 40 秒音訊必須由既有完整授權來源重新切段，不重複 25 秒片段、不補靜音。
- QA 以本機／隔離測試資料為限；不建立發布工作或遠端社群內容。

## Task 1：時間軸與資料契約升級為六幕 1,200 frames

**修改：** `utils/esports/postMatchReadBuilder.js`、`utils/esports/playerRadarEvidence.js`、`src/Root.jsx`、對應單元測試。

1. RED：把 storyboard 測試改為六幕精確時長與總和 1,200，確認目前仍回傳五幕／750。
2. GREEN：更新共同 storyboard 常數與 evidence 總長驗證；`GAME_FLOW` 拆為 `EARLY_CONTROL`、`MAP_CONVERSION`。
3. RED→GREEN：驗證早期資源與地圖轉換皆沿用 `ScoreboardTeams team-final`，缺資料時不生成精確事件因果。
4. 更新 Remotion mock metadata，確保 composition 從資料計算為 1,200 frames。

**局部驗證：**

```bash
node --test tests/unit/esports/postMatchReadBuilder.test.js tests/unit/esports/playerRadarRunner.test.js
node --test tests/unit/render/rootComposition.test.js
```

## Task 2：修正 metric 單位並建立六幕視覺骨架

**修改：** `src/templates/Template_PlayerRadar.jsx`、`src/templates/player-radar/PostMatchReadFrame.jsx`、`src/templates/player-radar/PostMatchReadScenes.jsx`、相關 JSX 渲染測試。

1. RED：新增實際 JSX 測試，KDA 差距必須顯示 `KDA` 而不是 `GPM`。
2. GREEN：主數值與單位都由 `primaryEvidence.metric` 驅動。
3. RED→GREEN：模板能分別選到 `EARLY_CONTROL` 與 `MAP_CONVERSION` 場景。
4. 以核可 palette `#080909/#F1ECE2/#E94B35/#77736C` 重建共用節目框、六拍進度與暗房／校樣語言；移除青金電競面板與同時並列的多欄數據。
5. 每幕只留一個主焦點、一句判讀、一個目前證據；次要證據改為同位置按拍替換。

**局部驗證：**

```bash
node --test tests/unit/render/postMatchReadFrame.test.js tests/unit/render/postMatchReadScenes.test.js
```

## Task 3：40 秒音樂切段與媒體契約

**修改：** `config/licensed-music-library.json`、`utils/render/postMatchReadAudioPlan.js`、`utils/render/licensedMusicLibrary.js`、`utils/render/postMatchReadValidation.js`、相關測試。

1. RED：audio plan 需回傳六個切點區間與 1,200 frames，確認目前只有 750。
2. GREEN：更新預設切點 `[0,150,360,570,810,1050,1200]`，仍只在六 frames 內吸附 downbeat。
3. RED→GREEN：授權音樂選擇器只接受 `post-match-read-40s` 且完整來源足以覆蓋 40 秒。
4. 為三首既有 verified 曲目建立 40 秒 segment，產出 WAV 後實測 48kHz/stereo、起音 ≤50ms、-18 至 -16 LUFS、true peak ≤-1 dBFS。
5. RED→GREEN：媒體 validator 改為約 40 秒，舊 25 秒必須被拒絕。

**局部驗證：**

```bash
node --test tests/unit/render/postMatchReadAudioPlan.test.js tests/unit/render/licensedMusicLibrary.test.js tests/integration/render/postMatchReadAudioSegments.test.js tests/unit/render/postMatchReadValidation.test.js
```

## Task 4：動效與最後兩秒凍結

**修改：** `src/templates/player-radar/postMatchReadMotion.js`、場景程式、動效測試。

1. RED：frame 1,140 後視覺時間必須固定；確認目前在 705 凍結。
2. GREEN：改為 1,140，六幕 motion event 各不超過兩個。
3. 實作 8–12 frames 曝光定稿、5–7 frames 紅筆確認、2–3 frames 暗場閘門；reduced-motion 移除位移與縮放。
4. 套用 `review-animations`，修正會造成閱讀競爭、過度彈跳或片尾仍變動的項目。

**局部驗證：**

```bash
node --test tests/unit/render/postMatchReadMotion.test.js
```

## Task 5：真實渲染與兩輪視覺 QA

1. 用既有可重現 fixture 產出 40 秒 canary；確認只使用可追溯隊徽、英雄、地圖、選手照與音樂。
2. 第 1 輪抽六幕 1080×1920 驗收影格組成 contact sheet，檢查層次、留白、字體、配色、對齊、資料、資產與停留時間；修正後重跑受影響局部測試。
3. 第 2 輪重新渲染同樣六幕 contact sheet，重做八項檢查。
4. 校準凍結驗證方法：先用已知不同影格確認 SSIM/PSNR 能分辨，再比較 38–40 秒影格；不能以壓縮後 byte hash 當靜止證據。
5. 執行 40 秒媒體閘門與 canary 驗證；確認 queue、daily runs、publish packages、Meta container／遠端貼文皆未建立。

## Task 6：產品理解檢查點與收尾

在全測與 commit 前記錄：

- 能力：40 秒六幕賽後判讀與兩秒閱讀停留。
- 體驗：第一秒先懂賽果，後續一次只讀一件事。
- 結構／資料流：故事模型與時間軸是共同契約，Remotion 只負責呈現。
- 理由／備援：主方案為比分主導；若缺可靠人物照，退回 verified 隊徽與賽事素材。
- 安全／成本：不碰發布權限；主要增加約 60% 本機算圖時間與檔案大小。
- 測試證據與剩餘限制：只回報實際跑過的範圍。

接著執行：

```bash
npm run tdd:doctor
npm run test:coverage
npx next build
npm run qa:render
```

再做本輪簡短 QA：一般觀眾靜音重述、電競內容編輯資料追溯、營運確認零發布副作用。若全綠，更新 `HANDOFF.md`，只提交本輪檔案；依專案規則合併 `main`、在 `main` 重跑全套、推送並確認 GitHub checks。專案若仍無 production 站，明確回報沒有正式部署目標，不建立新的站。
