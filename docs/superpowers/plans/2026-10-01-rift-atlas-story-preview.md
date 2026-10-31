# 峽谷圖鑑：問題帶動的40秒試片實作計畫

> 暫停：使用者指出KDA／VPM主線未打中比賽看點。新內容先依 [賽事故事研究](../specs/2026-10-01-bfx-ns-match-story-research.md) 核對實際片段；不要執行本計畫的舊內容轉換。素材分層、40秒、自檢與發布邊界仍可沿用，內容與驗收需待新故事修訂。

## 目標與驗收

以使用者已核可的大範圍雙隊色、首幕構圖與新敘事，製作BNK FEARX 3–1 Nongshim（2026-08-27）的獨立40秒預覽。六幕內容以 [設計規格](../specs/2026-10-01-rift-atlas-scenes-design.md) 為唯一內容權威。最後2秒靜止；閱讀段音樂留白；無聲也看懂問題、數據與結尾。不能以原40秒試片或舊測試證據宣稱新版驗收通過。

## 範圍與非目標

- 本輪授權為影片製作與預覽，不包含發文、帳號連線、發布佇列、素材採購或新付費相依。
- 先在既有隔離工作區新增 `experiments/rift-atlas-story/`；不覆寫主專案未提交的prepareMetaConnection兩檔，不刪舊影片。
- 此試片只採已有真實凍結model；不建立通用自動論點生成、不重新抓整個聯賽、不替其他賽事編造同樣反差。
- 字、數字、原隊徽、原照片、地圖與材質分層。不得把整張生成樣稿當作正式影片背景。
- 先不新增配音服務或宣稱已完成配音。旁白稿用於節奏參照；字幕與主標可獨立理解。

## 架構與資料流

既有frozen model → trialModel（只讀轉換）→ 六幕語義元件＋隊色／原素材 → Remotion試片 → 原生播放器驗收。

model位置：隔離工作區 `public/render-assets/rift-stone-trial/input.json` 的model，忽略已否決的background。每幕標示系列數據；單局終局資料不再進入主敘事。試片的入口獨立於 `src/Root.jsx`，避免試樣誤進正式工作台。

推薦：沿用現有Remotion／React與素材解析工具，不引入新框架。備援：若地圖插畫輪廓不能保持正確，使用版本鎖定原始底圖＋隊色層；不因美術要求扭曲路線。若照片不可用，姓名＋原隊徽保留身份，不生成假人。

## 工作區、環境與真實指令

- 主工作區：`/Users/cengweiting/Developer/lol-video-generator`，main來源6506ab2；本轮主程式不動。
- 隔離工作區：`/Users/cengweiting/.codex/worktrees/decisive-frame-40s/lol-video-generator`，現分支 `codex/component-material-preview`、HEAD7deadab；實作前重新核對status與來源，不假設一直未變。
- 已查看package.json：Node v24.14.0、npm及既有lockfile；Next16.3.6、Remotion4.0.489、React19.2.5。保持相依不變。
- Focused：`node --test tests/unit/render/riftAtlasStory.test.js`（新檔）。每次僅寫一個失敗行為，看到紅才實作，同檔綠才繼續。
- 收尾：`npm run verify`（tdd:doctor→coverage→Next build）；依既有規則另做 `npm audit --audit-level=high`。沒有獨立lint／type script，不捏造。
- Remotion真實邊界：`npx remotion compositions experiments/rift-atlas-story/index.jsx`；確定composition與props契約後，再用同入口 `npx remotion render ... RiftAtlasStoryPreview <output> --props=<props.json>`。
- 媒體：`ffprobe`驗證H264/AAC、1080×1920、30fps與40秒附近時長；先以既有40.042667秒片校準量測。不要把容器尾端AAC padding當多出劇情。

## 開始程式前的設計關卡

- 已完成comps→spec：保留歷史approval但只讓最新map-correction-safe為active approval，側車名稱使用工具要求的 `.png.json`。
- 已建 `.impeccable/build/rift-atlas-regions.json` 與 `spec.json`。文字量測：date成功；masthead／score-left目前工具無法分離字形，不可手填chosen或宣稱字體已精確匹配。
- crest-right／map框緣檢查尚未通過：先重新量框並比對實際圖像，不得以force清除。背景深紅可能造成邊緣分類誤判只是待驗證假說。
- 新第三幕storyboard僅證明敘事可讀，不取代已核可首幕作為構圖權威。不得重新開方向競賽或要求重複核可大片隊色。
- spec→plates完成前不寫影片UI。正式地圖不能用生成圖證明拓樸正確；原素材來源及每個新raster需provenance。

## Task 1：凍結資料轉為六幕內容，數據與範圍可靠

**Files**：新 `experiments/rift-atlas-story/trialModel.js`、`tests/unit/render/riftAtlasStory.test.js`。

**介面**：`buildTrialStory(model)`回傳六幕、主數字、系列標籤與只用來呈現的隊色識別；不修改input，不觸碰網路或DB。

1. Red：用本場fixture期望KDA比較由4/7/59與4/19/39導出9／2.26，標示系列合計；先只寫此行為。跑focused並確認缺少實作造成失敗。
2. Green：最小只讀轉換，focused綠；重構後仍綠。
3. 下一循環：VPM3.70／4.14同隊位置固定、缺欄不填零且明示這一段無法產生。不得用未定義的通用論點補洞。
4. 下一循環：六幕只使用系列資料，不引用矛盾局號、gameFlow勝因、官方MVP或假英雄固定對位；檢查輸入未變。
5. 產品檢查點：影片回答同一個問題，不承諾KDA／VPM能決定勝負；數據来自model，不由美術圖辨識。

## Task 2：分層排版與大片隊色，不遮擋文字或身份

**Files**：新 `experiments/rift-atlas-story/index.jsx`、`Frame.jsx`、`Scenes.jsx`、`theme.js`、原素材與生成材質的來源側車。

**依賴**：Task1與設計spec／plates關卡完成；先讀craft-floor及相關Remotion既有入口。若碰Next程式才讀其本機版本指南，這個獨立影片入口不改Next API。

1. Red：先測隊色跟model隊名走、不跟勝敗或實際紅藍方走。只針對本場既有已核可配色表，不新增自動取色承諾。
2. Green：最小主題解析並跑focused；重構保持綠。
3. 下一循環：佈局區域不能讓score／crest／姓名碰撞；以具體矩形契約保護，加圖像實測，不能只靠測到class名稱。
4. 下一循環：照片／隊徽缺檔明確失敗或使用已核可姓名備援；用真實檔案系統小fixture，不能只mock存在。
5. 建立1080×1920語義文字與元件：第一幕先量測還原核可構圖，再按已核可問題改標；第3/4幕左右固定；第5幕姓名照片分欄；第6幕三個文字選項。
6. 每個新raster保存精確prompt／原始來源，`embed-prompt --scan`查驗；生成照片與隊徽不得入正式成片。

## Task 3：40秒節奏、分段音樂與最後靜止

**Files**：新 `experiments/rift-atlas-story/timing.js`、試片入口；focused同檔一個行為接一個。

1. Red：六幕150/210/210/240/240/150幀，共1200幀，frame0已看得到問題。缺少timeline先紅。
2. Green：只實作timeline，focused綠再重構。
3. 下一循環：frame1140–1199全視覺取同一freeze frame；驗證文字、照片、地圖均不繼續動。
4. 下一循環：音樂只在指定段落播放，12–27秒閱讀區與38–40秒留白；沿用已驗證授權曲，不新增歌曲採購。
5. 少量opacity／transform引導主焦點，不做持續漂浮／大量數字滾動。寫動效後套用review-animations；時間軸用Remotion幀值，不依賴真實時鐘CSS動畫。

## Task 4：新成片驗收、教學與收尾

1. 觀眾QA：frame0能讀問題；靜音完整觀看仍理解反差；實際播放與seek30秒成功。
2. LoL編輯QA：對照frozen字段、左右身份、系列合計KDA標籤；不把VPM當插眼數／視野品質，無局號、假因果或官方MVP宣稱。
3. 動態／聲音QA：新成片聽音量、轉幕及閱讀留白；以校準過的靜音檢測確認分段，而不是只看timeline程式。
4. 兩輪自檢：每輪1280×800與375×812播放器截圖，按八項美感檢查留下實際缺陷與修正；固定影片等比縮放，不為手機重排影片內容。新成片需自身證據，不能沿用舊影片截圖。
5. 完成獨立finish review與文件；代理只依技能必要範圍使用。回報review實際scope，不以自評或reviewer認證獎項品質。
6. 全測／commit前產品理解檢查點：能力、體驗、元件結構、數據流、設計理由、備援、安全／成本、測試證據及限制。再跑verify與audit，保留真正退出碼。
7. 更新HANDOFF：分支／來源／影片路径、實際影片及音訊證據、兩輪截圖、review verdict、未測項目。交付可播放本機預覽，尚未發布社群。
8. 若進入正式模板整合，遵守AGENTS全測→main全測→既有遠端push；已知衝突、使用者未提交修改或全測失敗時停止，不硬推。未確認正式整合的實驗影片不擅自替換正式模板。本repo目前記錄無production部署流程，不新建站點。

## 自審

本計畫沒有將新框架、配音服務、通用論點生成或發文當作隱含授權；全部數據來自已讀模型。實作門檻仍有字形量測與兩個素材框緣判定，需處理後才能宣稱可以進入UI實作。此文件只是計畫，未執行TDD、新成片QA或全套測試。
