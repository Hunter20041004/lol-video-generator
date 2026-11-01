# 賽事看點提案與確認：施工計畫

日期：2026-10-01。使用者以「ㄎˇ以」核可 [設計規格](../specs/2026-10-01-match-story-workflow-design.md)。本計畫不是實作完成證據。

## 目標／驗收

選一場已完成一級賽事，取得最多三個來源可追查的候選，選一條主線，編輯中文腳本並確認指定版本，再製作有素材與證據驗證的預覽。未確認、改稿後、來源衝突、錯賽事或素材未授權不可直接製片。研究與確認不建立發布佇列。
缺可靠故事有精簡摘要；服務停用／失敗與「沒有看點」分開。約40秒是內容預算，實片另測，不填充或硬加速。

## 範圍／非目標／授權

- **2026-10-01 後續使用者限制：零額外服務費。** 付費研究試跑不授權；Task4外部供應商啟用暫不執行，保留停用守門。以已核可人工研究包備援接續Task5/6，本轮Codex可查公開資料並整理，不冒稱專案自動搜尋免費上線。既有文字模型不改，但新故事流程不呼叫可能計費的模型／搜尋／配音；不用billing或可能付費的API額度碰碰運氣，不自動升級付費。原Task4細目保留為未啟用歷史規劃，這不是任務完成證據。
- 已核可：依比賽選題、自動搜尋方向、確認後製片、人工補研究來源、中文第一版、既有美術與發布邊界。
- 本輪可施工：無外部費用的資料契約、保存／版本確認、本機研究包流程、成本守門與合成資料測試。
- 外部服務啟用須另取得具體模型／方案／用量費用授權。不得用「可以寫規格」開啟billing或付費請求。
- 非目標：自動觀看／理解影片、批量研究、英文新故事、第三方影像下載重製、新配音服務、自動發文、改舊入口全部行為。

## 環境與現況

- root main HEAD `6506ab20d55966c9b2b060a3d245ac03b6fa4f2a`；已有使用者prepareMetaConnection兩檔與研究文件未提交，禁止混入或覆蓋。
- 附著工作區 `/Users/cengweiting/.codex/worktrees/decisive-frame-40s/lol-video-generator`，`codex/component-material-preview`、HEAD7deadab、tracked乾淨，但有舊視覺歷史與untracked素材，不直接用其舊分支混合本輪。執行前比對來源版本與分工，確認可安全重用隔離區／建立授權隔離分支，不刪舊素材或未提交內容。
- 已有node_modules；實際Node v24.15.0／npm11.12.1，README與CI使用Node22。記錄版本差異，使用既有鎖檔，不為開工升級套件。
- 安裝：必要才`npm ci`；啟動`npm run dev -- --hostname 127.0.0.1 --port 49765`，先確認未占用，不影響49761常駐站／49763既有E2E。
- 單檔TDD：`node --test tests/unit/esports/<本項測試>.test.js`。一行為一紅綠循環，不一次寫全部測試。
- Task全測：`npm test`；收尾完整`npm run verify`（doctor／coverage／Next build）、`npm run qa:render`、`npm audit --audit-level=high`、UI後`npx playwright test`。package未提供獨立lint／typecheck，不捏造已跑。
- Playwright目前固定49763且reuseExistingServer；隔離執行要先證實目標checkout／服務版本，或在測試設定中以本輪局部變數指定49765，不能連錯站當通過。
- Env僅記名稱：既有`GEMINI_API_KEY`來自使用者本機ignored設定，不索取／複製到交接。新研究開關、模型與成本授權設定由Task4依批准結果定義，預設關閉。

## 架構與共同介面

`candidateStore.readCandidateSnapshot` → 新story research service → 新storyDraftStore → 草稿／確認API → 工作台 → 新story preview service → renderService新故事分支。

既有`playerRadarRunner`／`postMatchReadBuilder`／`playerRadarEvidence`固定六幕保持相容。不能為新故事放寬其斷言。`reasoning.js`鎖定`gemma-4-31b-it`、`genaiClient.generateModelText`只回文字；搜尋研究另建接點，不替換原模型。

新共享契約唯一放`utils/esports/matchStoryContract.js`，以既有JS／Zod慣例實作：

- identity：scanId、seriesId、date、league、雙隊身份、seriesScore；以伺服器snapshot核對，不信客戶端的聯賽／賽果。
- source：id、URL、title、publishedAt可null、retrievedAt、kind、readStatus（線索／報導內容／人工回看），保留本場匹配說明。
- fact：id、statement、sourceIds、evidenceType（stats／report／search-lead／reviewed-video）、scope、限制／衝突；reviewed-video必須人工觀察紀錄且雙時鐘欄位不混用。
- candidate：id、kind、headline、whyInteresting、factIds、unresolved；最多三個，不用假分數冒稱留存。
- draft：id、identity、revision、sources、facts、candidates、selectedCandidateId、segments（id、purpose、narration、factIds、durationSeconds、component、assetRefs）、rights、status、confirmedRevision、createdAt／updatedAt。
- component只提供核可視覺用途，不要求固定六幕；不接任意HTML／程式碼。最終元件enum由Task6依核可plates落定。
- public輸出不得包含key、provider原始錯誤、prompt或未遮罩外部回應；用穩定錯誤code搭配中文訊息。
- 草稿資料独立存本機`.data/`安全邊界，schema version1；持久化保留歷次版本，外來id不能當路徑。

## 執行順序與TDD

以下每列都獨立執行「新增一個測試→單檔看見預期失敗→最小實作→同檔綠→重構」；完成該列再開始下一列。每Task收尾先交付產品理解檢查點，再全測及diff檢查。

### Task 1：本場證據不混成別場／不把線索當事實

Files：新增`utils/esports/matchStoryContract.js`、`tests/unit/esports/matchStoryContract.test.js`、`tests/fixtures/match-story/`；擴充`config/tdd-coverage.json`新slice。
Dependencies：snapshot身份與核可規格，不需外部AI。
Focused：`node --test tests/unit/esports/matchStoryContract.test.js`。

1. Red：有效的本場研究包可正規化，publishedAt未知仍為null；Green最小schema／函式並保持不改輸入。
2. Red：只改seriesId為另場，需拒絕；Green伺服器身份核對。再獨立測同隊不同日期不能共用。
3. Red：candidate引用不存在factId需拒絕；Green引用完整性。下一循環測fact的sourceId不存在。
4. Red：核心旁白只引用search-lead不可確認；Green事實資格守門，不用文字正則冒充語義核實。
5. Red：模型回應自行標reviewed-video但無人工紀錄需拒絕；Green要求人工紀錄入口／來源區分。下一循環測兩種時鐘分開保留。
6. Red：來源與事實衝突不能支撐所選故事；Green阻擋並保留衝突而非刪來源。最後獨立測空候選可回摘要狀態，不造候選。

驗收：有背景／無背景戰術／僅統計三个合成樣本逐一通過各自允許內容，不把合成樣本宣稱真實事件。資料編輯審查看身份、統計範圍與來源分級。

### Task 2：草稿保存、確認與修改失效

Files：新增`utils/esports/storyDraftStore.js`、`tests/unit/esports/storyDraftStore.test.js`。
Dependencies：Task1。Focused：`node --test tests/unit/esports/storyDraftStore.test.js`。

1. Red：在mktemp隔離目錄保存一稿，再用新store實例讀得同版；Green真實檔案保存，不寫主站`.data/`。
2. Red：讀不存在稿件明確not-found；Green錯誤。下一循環：壞JSON需明確store-corrupt，不當空庫覆寫。
3. Red：確認revision1會記錄confirmedRevision1；Green服務端確認。
4. Red：改旁白後成revision2、清除現行確認、保留revision1歷史；Green版本更新。下一循環測改來源／素材也失效。
5. Red：用舊revision更新／確認需version-conflict；Green預期版本檢查。下一循環：跨稿／跨賽事確認被拒絕。
6. Red：帶路徑穿越稿件id不能讀／寫外部檔案；Green固定檔與id查找。
7. Red：兩個並行更新相同版本只有一個成功且JSON可讀；Green原子寫入與本機寫入序列，明示不宣稱支援多主機。

真實邊界：磁碟新實例／重啟讀回與並行寫入皆實測，清理僅本輪明確暫存目錄。確認版本像簽過校樣，修改不沿用舊簽名。

### Task 3：不付費也能跑研究包→提案→確認的本機流程

Files：新增`utils/esports/matchStoryService.js`、`app/api/esports/story/route.js`、`tests/unit/esports/matchStoryService.test.js`、`tests/unit/esports/matchStoryRoute.test.js`、`tests/integration/esports/matchStoryWorkflow.test.js`。
Dependencies：Task1–2。寫Next路由前讀`node_modules/next/dist/docs/`相關路由／請求指南。

共享request：action `research|import|read|revise|confirm`；research/import由scanId、seriesId定位；read/revise/confirm用稿件id與expectedRevision。import只收结构化研究包，不抓任意URL。server每次校驗基础snapshot有效／可製作。

1. Red（service單檔）：未啟用研究時回service-disabled且不呼叫provider；Green預設關閉與訊息。
2. Red：有效人工研究包可建草稿，但不呼叫render／publish；Green契約與store串接。下一循環測未完成賽事拒絕。
3. Red：相同research key並行請求共享執行；Green進行中去重，不擴成跨主機queue。下一循環測失敗後明確點擊可重試、無自動循環。
4. Red：revise/confirm只作用目前版本；Green串接Task2。下一循環測客戶端approved:true不當放行。
5. Red（route單檔）：malformed／過大／未知action請求400、不洩漏provider錯誤；Green入口安全與可理解訊息。
6. Red（integration單檔）：真實本機HTTP import→read→confirm→revise，最後舊確認失效；Green補路由接點，不只VM測試。正式呼叫無key亦可驗證停用狀態。

驗收：研究包與真HTTP不能假裝「自動搜尋上線」；動作錯誤可恢復，不改queue或舊Player Radar。

### Task 4：外部搜尋接點、來源映射與成本授權

Files：提議新增`utils/esports/matchStoryResearchProvider.js`、`tests/unit/esports/matchStoryResearchProvider.test.js`、`tests/contract/matchStoryResearch.live.test.js`；不修改原`generateModelText`契約。
Dependencies：Task3；真服務啟用另需成本授權。

先調查installed `@google/genai`實際型別、支持API／模型與官方文件；核對已部署模型名稱，不從最新網頁示例猜本機SDK相容。向使用者提出具體模型、token／查詢计費、每次／每日用量限制與free-tier限制；確認前不得送真AI請求或開billing。未批准可完成停用守門／本機adapter測試，不能宣稱live通過。

1. Red：未有已批准服務設定不發HTTP請求；Green成本守門。
2. Red：已知公開identity只生成公開研究輸入，不帶env／OAuth／聊天；Green最小輸入映射。
3. Red：具來源與事實引用的已核對response樣本可映射，輸出沒有raw response；Green依實際SDK shape映射，不造最新API shape。
4. Red：模型未返回来源或只有摘要时不升格報導／已回看；Green線索狀態。下一循環測模型聲称已看影片被拒。
5. Red：來源矛盾／另一日期比賽保留限制並排除候選核心；Green候選過濾。
6. Red：逾時／限流回穩定失敗，不換貴模型／無背景重試；Green上限與取消行為，測失敗後去重釋放。
7. 授權後真實少量請求：驗證來源URL、claim關聯、空結果、timeout與計量欄位；只存遮罩response shape與公開查詢。live測試未跑要明列，不能用skip當通過。

備援：人工研究包可继续提案；不加入第二搜尋供應商。供應商search suggestions展示要求須在UI前核對，無法安全合規則停外部入口而不是注入原始HTML。

### Task 5：工作台看得到來源、改得了稿、確認不跳發文

Files：既有`app/components/studio/EsportsWorkflow.jsx`、`studioModel.js`，新增`MatchStoryPanel.jsx`、`tests/unit/studio/matchStoryModel.test.js`、`tests/e2e/matchStory.spec.js`；既有PreviewPanel依需要最小接入。
Dependencies：Task3；Task4未啟用時UI清楚显示未啟用，人工包可走流程。

前置：讀frontend-codex詳規、impeccable／emil-design-eng；保留PRODUCT與核可美術，不重新跑方向。若缺PRODUCT按政策init，只有缺產品事實才問。
每行為先單檔TDD：選比賽清舊稿→來源安全顯示→換題改稿清確認→確認後顯示待製作→研究失敗可恢復→雙擊不重複研究。E2E逐案紅綠，不能只檢查靜態文字。manual reviewed-video輸入不自動代表素材有授權。
兩輪1280×800／375×812各截圖，八項自評、修正，hooks逐條分類；動效若有新增必讀review-animations。HTML文字注入、javascript URL被擋；來源連結不把token放URL。無聲觀眾、LoL編輯与產品使用者AI QA實际操作此局部流程。

### Task 6：確認稿製成故事預覽，不挪用舊六幕

Files：提議新增`utils/esports/matchStoryPreview.js`、`utils/render/matchStoryValidation.js`、`src/templates/MatchStoryFrame.jsx`；既有`utils/render/renderService.js`與Remotion composition註冊檔，先查實際註冊符號再改；新對應unit與render integration test。
Dependencies：Task1–5＋核可視覺spec/plates閘門，不繞過目前impeccable spec open。

1. Red：未確認／舊版／錯賽事製作請求不呼叫renderer；Green只從服務端load已確認稿。
2. Red：素材／權利未知時不進實況渲染；Green阻擋或使用使用者選定的合法文字／照片方案，不靜默更換確認稿。下一循環測所有新素材更換清確認。
3. Red：非固定六幕的合法故事可轉為scene時間表；Green新契約不改舊validator。下一循環测秒數總和、最后閱讀段、空旁白與缺素材。
4. Red：本場隊色／身份與確認稿一致、未生成選手臉／錯队徽；Green沿用verified asset接點與核可元件。
5. Red：preview入口不接production mode、不呼叫createPublishJobs；Green独立preview-only service。
6. 真實渲染：BFX–NS文字／原照片合法素材版＋無前東家合成戰術稿兩種結構；驗證H.264／直式尺寸／實際時長、文字範圍、音樂分段、最後靜止。合成稿明標，不對外當真實賽事。

說明：無實况權利時不能承諾重播比賽畫面，只有來源支持的事件敘述。圖像／UI兩輪證據之外，還要看片驗收，不以still代替成片。

### Task 7：跨流程QA、安全模擬、整合與交接

Dependencies：實作範圍完成，付費／素材未授權仍明列未完成，不宣稱A/B全完成。
順序：使用者與電競編輯實際QA→缺陷修正與重測→自有本機合成資料安全模擬→修正重測→全測→既有收尾。

安全範圍限本機故事入口與相連資料：來源內嵌惡意指令不能改稿授權、文字XSS／URL scheme、穿越id、跨賽事確認、版本重放、過大資料、雙擊濫用、provider錯誤敏感資訊。若未額外抓任意URL，就不冒稱完整SSRF測試；將來抓URL必須另補redirect／內網界限測試。無真帳號操作／第三方攻擊／發文。
檢查新流程不觸動發文queue／原內容DB／舊Player Radar回歸；從使用者視角驗原工作台。
產品理解檢查點含能力、操作、結構、資料流、選擇理由／備援、安全成本、測試證據與限制，再跑完整必要檢查。
更新HANDOFF記來源版本、工作區／分支、每個紅綠證據／完整log、UI／成片與安全結果、成本與素材待決。
全綠后依AGENTS預設合併main→main全測→push確認遠端SHA→沿用原部署流程。主站有使用者未提交內容不可覆蓋；先確認安全更新方式，必要時停整合而不硬推。尚無production workflow則不另造正式站；本機原49761更新後真實驗本輪流程。push若触發CI／部署追蹤既有執行，不重复部署。

## 計畫自評與下一動作

覆蓋規格：來源分級、不同題材、摘要、確認版本、preview-only、成本與權利、舊流程相容及真實邊界皆有Task。模組名為局部施工決定，不新增資料供應商。
費用未決限制Task4 live啟用，不阻擋Task1–3；視覺閘門限制Task6，不阻擋内容資料流程。不得为了開發進度把未確認搜尋／影片用量或素材默認授權。
下一個具體動作：確立安全隔離工作區與main基線，跑基線測試；Task1從「合法研究包保留未知發布時間」第一個紅綠循環開始。不再要求重複核可選題方向／本規格。
