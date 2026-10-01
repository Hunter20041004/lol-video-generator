# Task5 故事編輯工作台驗收（2026-10-01）

範圍：已核可的工作台延伸，不是新故事影片或發布驗收。零新增第三方服務費，無新相依、帳號操作或發布。

## 產品理解檢查點

能力／體驗：人工研究包→來源與事實→選主線→逐段改稿→保存→確認指定版本。修改後原確認失效；換場不沿用舊稿。確認不是製片或發文。

結構／資料流：MatchStoryPanel 經既有本機 HTTP 入口呼叫故事服務，再寫獨立版本檔。來源安全連結與文字呈現和後端契約各自防護；核對引用不等於證明旁白正確。

設計理由／替代：主方案延續工作台表單與版本保存；備援保留尚未完成草稿，明確讀回最新版本，不自動重試寫入。讀回取代本頁未保存編輯，畫面提醒先複製文字；磁碟稿件不變。

安全／成本：研究供應商預設停用。版本必須匹配才能保存或確認；只有唯讀可省略版本。Origin 修補只接受同埠 loopback 別名，不信任 forwarded headers。保留既有正式模式操作權限。

限制：真實 BFX-NS rev2 的交戰精確動作／時間碼仍待補，尚不可確認。新故事影片、40秒編排和影片視覺門檻未完成，不以舊 PlayerRadar 成片替代。

## 前端兩輪自評

截圖位於 `.screenshots/story-editor-round{1,2}/{desktop,mobile}.png`，實測尺寸1280×800、375×812；只涵蓋故事區起始視窗，非全部頁面的視覺驗收。

| 項目 | 第一輪 | 第二輪 |
|---|---|---|
| 層次 | 標題／來源／看點區分清楚 | 保留 |
| 留白 | 分組與欄間距可辨 | 保留 |
| 字體 | 延續既有工作台字型 | 保留，未替換影片字型 |
| 配色 | 版本狀態被一般段落灰色覆蓋 | 局部修正金色狀態 |
| 對齊 | 表單／來源欄對齊 | 保留 |
| 響應式 | 日期斷行不佳；長看點按鈕超出375px | 日期獨立不換行、按鈕可折行，scrollWidth=clientWidth=375 |
| 狀態 | 測保存、確認、忙碌、錯誤、focus | 增加最新讀回恢復與腳本跳轉 |
| 動效 | 新按鈕需限制既有 transition 範圍 | 只限 transform；減少動效與鍵盤 focus 不移動 |

單次 detector `/tmp/lol-story-task5-design.json` 結果[]，無新增 ignore。恢復修補移除 details 內版本輸入，兩輪圖的其餘版面未變；最新真 Next 唯讀讀回成功，375px 無橫向溢出。

## 動效審查

| Before | After | Why |
|---|---|---|
| 繼承廣泛 transition | 新區域按鈕只限 transform，140ms自訂曲線 | 限定可預測的短促操作回饋 |
| 所有按壓可能縮放 | 只有 fine pointer 且非 focus-visible 縮放.985，160ms | 鍵盤／觸控避免位置移動 |
| 全域減少動效仍有極短時長 | 新區域 reduced-motion 明確0s、無transform | 尊重系統偏好；瀏覽器測試確認 |

Approve（僅本輪新增按鈕動效）；不等於全站或影片動效已審查。

## QA 與安全證據

AI 多角度檢查，非真人專家認證：創作者測完整編稿、失敗恢復、換場；LoL編輯核對整系列／單局及報導／回看區別，不虛構交戰證據；手機與鍵盤使用者測跳轉、長標題、減少動效。

18/18 瀏覽器案例通過：`/tmp/lol-story-task5-browser-final.log`。其中一例使用真 HTTP 子程序與磁碟，確認後仍只有候選及草稿檔；一例真 Next 路由檢查本機 Origin 與外部／forwarded Origin。其餘 UI 案例使用標示合成 fixture。

已證實缺陷已修復：本機127/localhost來源誤拒、手機長標題溢出、原始解析錯誤外露、保存成功卻遺失回應時無恢復入口。相關案例先紅後綠；最新服務11/11，獨立唯讀複查相關單元26/26，無剩餘Critical/Important。

攻擊者角度只測自有本機、低量合成 JSON、可執行URL／HTML文字、Origin／Host／forwarded誤信。沒有測第三方、真實帳戶或大量攻擊；沒有全專案安全認證。新服務仍不支援多程序共同寫入。

## 收尾證據

`/tmp/lol-story-task5-verify.log` exit0：769 tests、762 pass、7外部skip、0fail；coverage與Next build通過。4個既有filesystem tracing警告，以及現有ESM測試模式警告保留。既有6種composition still QA與audit 0通過，不代表新故事成片。

獨立finish reviewer disposition **ship**，僅核可Task5工作台延伸。已補桌機／手機腳本及操作、手機恢復入口、從頁首fullpage圖；main agent皆已看。載入／錯誤外觀未逐項截圖，不宣稱這些狀態視覺通過。

獨立documenter查核PRODUCT／DESIGN／方向／sidecar／實作與QA：保留現有文件，未改系統。既有DESIGN描述Barlow／Noto切角直式影片，而工作台為Outfit圓角暗色表單；這項既有差異不升格為影片新標準。既有`.impeccable/design.json`缺席，普通局部延伸不自行建立／重寫共用規則。
