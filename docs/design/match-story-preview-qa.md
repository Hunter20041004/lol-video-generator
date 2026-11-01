# 故事預覽 QA（施工中）

2026-10-06，隔離分支 `codex/match-story-workflow`，來源 47757b4。Task6 尚未整體完成，未整合 main／推送／更新原49761，未發文。這是 AI 多角度檢查，不是真人編輯、資安或獎項認證。

## 2026-10-06 音樂／地圖敘事用途修正

使用者詢問中段靜音及地圖用途後核准兩項修正；不是重新核准整體美術或真比賽稿。音樂逐幕相對增益1／0.5／0.4／0.85，音源時間連續不重頭播放；末尾60frames安靜。故事成片不插入裝飾地圖，地圖素材僅留proof；尚無已核對位置資料契約，不宣稱有自動戰術路線能力。事件放引用文字，context只有唯一核對的原照片才顯示人像，缺照片回退文字。

- RED→GREEN：Audio3/3、Frame12/12。先證實旧cue造成正文無音樂、無位置故事仍插地圖，再修；版面測試亦先證實短背景contain導致縮窄，再改背景fill（原徽／照片仍contain）。
- 最終合成片 `public/renders/story-synthetic-purpose-40s-v16.mp4`。ffprobe及media validator：H264/AAC、1080×1920、30fps、40.042667秒。不是BFX–NS真稿；v15縮窄背景是失敗中間產物，不交付。
- 聲音測量先以已知1–2秒靜音fixture校準silencedetect，再用相同`noise=-55dB:d=0.5`量v16：只偵測38.01025–40.042667秒，沒有中段≥0.5秒靜音。不是人耳音樂品味／節拍檢驗。
- 兩輪真MP4 Playwright CLI截圖：`.screenshots/story-purpose-round1/{desktop,mobile}.png`為12秒事件，round2同名為35秒結論；1280×800／375×812。四張皆實看，readyState4、error null、無水平overflow；播放時間35→35.416397，非僅metadata。原生播放器兩側／上下黑色letterbox不是缺失畫面。
- 八項自評兩輪：層次（身份→正文→來源）；留白（短合成稿下方有大留白，不為填空造事實）；字型（完整中文、事件72／其他55）；配色（金／紅原隊身份）；對齊（原徽contain、來源固定12%）；375px（無溢出）；狀態（pause／seek／play、無media error）；動效（沿用硬切／閱讀靜止／末尾停留，未新增位移動畫）。判定僅兩项用途修正可用，整體美術與原樣稿落差仍未結案。
- 觀看者QA：沒有無用途地圖、正文與來源可讀、原生控制列不遮來源。電競編輯角度QA：合成標記保留、系列比分不冒充人頭、沒有假路線／假人物。資安範圍未碰登入／輸入／付費；沒有新增第三方或發布副作用。
- Frame／Video detector `[]`，diff-check通過。`npm test`834／827pass／7外部skip／0fail，`/tmp/lol-story-purpose-tests.log`；完整verify另記最新HANDOFF，不沿用舊build數據。
- 產品理解：能力是按段落弱化音樂及有用途畫面；體驗是不再29秒無声／裝飾圖；結構為Audio cues與Frame；資料由引用facts／scene／原素材進入既有renderer；理由為證據優先；備援文字／比分；成本0、無帳號操作；證據如上；限制為真稿未確認、藝術品質未達原樣稿。未merge／push／部署／發文。

## 2026-10-06 最後續作證據（優先於下方歷史待辦）

- 最新 `npm run verify`：`/tmp/lol-story-task6-verify-current.log` exit0，829 tests／822 pass／7外部skip／0fail；coverage 94.73% line／82.20% branch／96.55% function，Next build通過。建置完成後才執行完整瀏覽器測試：`/tmp/lol-story-task6-e2e-current.log` 19/19，避免先前同一`.next`並行build/dev導致404；未放寬503斷言。audit0。
- 程式審查兩項Important已修並複審：手動換行／長Latin文字守門與未引用搜尋線索誤算來源。validation8/8、Frame12/12、preview11/11；字級55不縮，行高1.35，17字保守換行預算，hook3／verdict4／其他5行，標題單行。49W可斷行；20行短稿與換行標題遭拒。來源僅計實際段落引用的已讀來源。獨立複審31/31，限兩項修復無新阻塞。
- v9真合成40秒影片：`public/renders/story-synthetic-40s-v9.mp4`，ffprobe H.264/AAC、1080×1920、30fps、40.042667秒。沿用已校準方法，ebur128 -17.3LUFS／true peak -8.2dBFS；38與39.966666秒SSIM All0.999999（非完全像素相同，程式clock最後60frames固定）。量測log `/tmp/lol-story-v9-{loudness,freeze}.log`。非真實BFX–NS敘事。
- 主代理已看v9四幕解碼幀及同一案例新版T1／GEN，中性隊徽底與44px隊名可見，hook／verdict地圖量級增加。實際Remotion中文字數上限hook50／event80／verdict68靜態幀在`.impeccable/review/story-boundary-*.png`；最初verdict取900frame其實是context，已改1050重驗，不採誤取場景證據。
- 第二輪桌機1280×800與手機375×812：`.screenshots/story-workbench-round2/`含整頁及預覽、`.screenshots/story-video-v9/`含12秒event與35秒verdict，所有截圖已開啟。真影片readyState4／1080×1920，工作台10.048秒測片、手機scrollWidth375，無pageerror；元資料API仍為模擬，不稱完整真API瀏覽器流程。獨立真HTTP／磁碟／製片整合1/1另在全測跑過。
- 八項自評續結：層次與留白以擴大地圖／壓緊身份區修正；字體完整漢字、44px隊名；配色真隊色且原徽中性底；對齊contain無原徽裁切；375px無水平溢出、影片9:16；停用／錯誤保稿／編輯失效／雙擊已有瀏覽器證據；動效仍硬切、閱讀靜止。此為受影響畫面自評，不是獎項品質認證。
- 資產provenance掃描10rasters／0missing；8個proof／public PNG補嵌真實來源（不是偽造AI prompt），兩份pinned原來源bytes未改。DESIGN／v2 sidecar由獨立documenter限定新增新世界，原token深比較保留。
- 像素工具仍未通過：新hook對舊portrait統計comp `comp-diff`0.3289／contradicted（`diff/final/report.json`）；responsive gate26%且多舊KDA等region缺失，state仍responsive。保留舊43.49%失敗及使用者免費重組授權，不force、不把橫向原生播放器誤當portrait網頁、不宣稱整體美術閘門通過。
- Minor剩餘：失敗製片留下孤立MP4／素材目錄，可能累積磁碟；未做任意刪除，既有清理流程是否涵蓋故事素材待查。無通用任意換素材入口／素材版本契約承諾。
- 真稿rev3仍待使用者確認，故Task6真案例驗收與Task7整合／push／原站驗收尚未完成。未發文、未新增費用，原49761及使用者修改保留。最新視覺verdict與文件同步結果續補。

補記：既有六個composition `npm run qa:render` exit0（`/tmp/lol-story-task6-existing-render-qa.log`），是靜態frame45核對，不是六支影片完整播放。documenter完成1.35／換行／來源規則同步；主代理YAML／JSON解析及原四組token深比較通過。工作台初版round2截圖雖ready4仍有原生緩衝圈，獨立review判為無效；已實際play到7.7秒以上再pause，四個同名截圖重拍並逐張開啟，緩衝圈消失，paused=true／seeking=false／ready4。等待最後限定修復verdict。

最終獨立verdict **ship，僅限原列四項修正均resolved**：隊徽對比、手機隊名、地圖比例、設計文件同步。重拍有效，來源位於控制列上方。不是完整工作流／全表面／音訊／獎項品質認證；機械閘門仍未過，真稿未確認。本段取代前文「等待verdict」。

## 範圍與資料流

人工研究 JSON → 同源本機入口 → 身份／引用核對 → 磁碟版本草稿 → 指定版本確認 → 本場素材核對 → 本機影片製作 → 基本媒體規格核對 → 工作台播放。

無付費模型、自動抓任意來源 URL、配音或發布。研究文字是不可信輸入，不能指示工具操作；權利紀錄不能自行解除守門。

## 使用者及領域 QA

- 內容編輯：確認版本、改稿保留歷史、換場清稿、製片期間別視窗改稿；局部 preview service 10/10。素材權利修改清確認已有 store 20/20 證據；本版沒有任意替換素材入口，strict preview 請求拒絕外加素材。預設素材來源固定／pinned SHA，輸出另附 fingerprint；這不等於可任意换素材後沿用簽名。
- 製片操作：真 HTTP／磁碟／Remotion 合成流程 1/1（約10秒可變稿），測完磁碟草稿不變、無發文資料；不是 BFX–NS 成片。40秒合成 canary v5 真 H.264/AAC、1080×1920、30fps、40.042667秒；ffprobe 方法先用已知4秒384×640／24fps樣本校準。
- 無聲手機觀眾：v5 真播放器375×812／1280×800、readyState4；25秒來源可見，35秒長結論不蓋來源。源文字底部2%被控制列蓋住已修到12%；來源字體增到32px。圖 `.screenshots/story-video-safe/`、`.impeccable/review/{desktop,mobile}.png`。先前兩輪失敗截圖保留，不當通過。
- 聲音：v5 ebur128實測 -17.3 LUFS／true peak -8.2dBFS。前後段落音樂、正文靜音；無人聲。SSIM已知同紅1／紅藍0.773094可區分後，v5第38及39.966666秒比較All1.000000。v6／v7是後續排版修正，未沿用v5的視覺結論。
- 工作台：12項Playwright通過，包括確認、版本失效、換場、失敗保稿、雙擊、來源文字惰性、真HTTP草稿與同源。第一輪兩尺寸 `.screenshots/story-workbench-round1/` 真解碼1080×1920、10.048秒測片，metadata API模擬；不是整條真API瀏覽器流程。早先截圖腳本 Buffer 未提供、假fact缺limitations造成崩潰，都不是有效驗收；已換完整fixture重驗。
- 電競編輯：系列比分與單局人頭分開，地圖明示示意／非事件路徑、照片不冒充官方MVP或勝因。發現報導fact被標「片段回看」，先紅後綠改為按 evidenceType 標報導描述／片段回看／賽事資料，Frame11/11。真稿6f41e104…rev3仍未確認，不自行代簽。

## 八項前端自評

|項目|已檢查／剩餘|
|---|---|
|層次|比分／視覺舞台／敘述分區；独立review指出hook／verdict地圖太小，修正中|
|留白|來源移入安全区；地图空白失衡改為身份同列釋出舞台|
|字體|完整Noto TC漢字核對；detail隊名原太小，已紅綠44px／兩行空間，待成片複驗|
|配色|真队徽取色；T1／GEN同色徽融背景已證實，增加中性墨底待成片複驗|
|對齊|原圖contain保留轮廓；比分／隊徽互不覆蓋待最新capture|
|響應|375px工作台scrollWidth375，影片保持9:16；第二輪工作台待補|
|狀態|停用、載入、錯誤保稿、雙擊與改稿失效有操作證據；未逐一截圖所有外觀|
|動效|影片硬切、閱讀時靜止、最後60frame固定；工作台沿用微回饋，見下方審查|

## 動效審查

| Before | After | Why |
|---|---|---|
|正文連續套音樂的舊流程|新 composition 按段落播放；文字場景硬切、閱讀靜止|音樂服務段落，不干擾閱讀；不是全片背景循環|
|結尾可繼續推進時鐘|新時鐘 clamp 至最後60frame起點|結尾停留讓觀眾讀完，不做裝飾性動作|

判定：**Approve，限本輪動效程式**。`MatchStoryVideo.jsx`不動畫布局；`matchStoryValidation.js`凍結時鐘；新操作按鈕繼承140ms transform微回饋，現有 reduced-motion 操作測試通過。這不是最新影片整體視覺或音訊品質判定。

## 安全模擬與依賴

順序：先使用者／編輯QA及局部修復，再跑本機合成輸入邊界25/25：未確認、舊版、跨場、外加production／approved、任意權利、遠端portrait路徑、素材hash改變、同源／尺寸／JSON錯誤。證據 `/tmp/lol-story-task6-security-regression.log`；不測第三方平台、真帳號、交易、大量攻擊或SSRF（本入口不抓任意URL）。

2026-10-06 npm audit發現 source-map-js1.2.1 high、postcss-selector-parser7.1.4 moderate；是已安裝漏洞版本，不等於本故事入口已遭利用。追蹤到Tailwind及Remotion建置鏈，無使用者上傳CSS／source-map入口證據。維護者修補： [source-map-js1.2.2](https://github.com/7rulnik/source-map-js/releases/tag/v1.2.2)、[selector-parser7.1.6公告](https://github.com/postcss/postcss-selector-parser/security/advisories/GHSA-rj75-hqrm-r3gf)。最小更新僅lock兩套件版本／SHA，package.json不變；版本守門先紅後綠。修後audit0，完整重測待跑；不沿用修前全測為修後證據。

## 獨立視覺審查／文件

2026-10-06 fresh finish reviewer disposition **fix**（只限已提供影片幀與預覽截圖）。待回傳同案例新畫面評分：原徽對比、detail隊名、hook／verdict完整地圖量級、設計文件與sidecar。先前43.49%像素gate仍失敗，使用者允許免費重組細節，不當qualitypass。沒有獎項品質認證。

單次detector九筆：Noto Story字體兩筆、暖白五筆／墨色一筆都是新世界文件缺口，要補文件；Outfit一筆為既有未使用舊字體漂移，不修全域、不ignore掩蓋。不再掃第二次。

## 教學與收尾限制

能力是確認稿製片，體驗是改稿不能沿用舊預覽；結構保留原PlayerRadar入口，資料只從本場版本流入。主方案本機免費素材製作；備援缺照片不猜臉、未知權利阻擋。安全／費用不以按預覽等於授權發文。已有合成跨程序實測與821tests／814pass／7明確外部skip／0fail及build證據（修前 `/tmp/lol-story-task6-verify.log`），新修正須再全測。尚需最新成片、第二輪工作台、資產provenance／文件、獨立verdict、真稿人工確認及main收尾；不宣稱完成。
# 2026-10-06 視覺否決後重建（施工證據，不是完成認證）

最新續記：v14修原紅藍基地marker與河流誤分類後，834 tests／827pass／7外部skip／0fail，`/tmp/lol-story-rebuild-tests-latest.log`；Frame detector []／diff-check通過。v14 media validator passed：H264AAC／1080×1920／30fps／40.042667秒。真IAB1280×800、375×812均readyState4／無media error且時間前進；hook來源與文案可見，這僅單輪播放核對，不冒充兩輪存檔／正式finish。獨立美術診斷仍指出平面剪紙、缺外圍岩壁與背景平塗；需重建，不支持完整美術通過。免費岩壁候選是規則磚牆，已看並拒絕直接貼用，見free-materials.md。未重跑coverage／build，不整合main。

本段優先於下方 v9 的美術描述；舊功能測試不能證明新畫面品質。

- 角度：內容觀看者檢查比分／隊伍／姓名與來源可讀；美術檢查者直接對照核可 `rift-atlas-map-correction-safe.png` 的筆觸、焦點與森林厚度。均為 AI 檢查，不是真人專家認證。
- 範圍：隔離分支的素材轉譯與 MatchStoryFrame；不改登入、發布、付費、外部輸入及新資料契約。本輪不另觸發主動第三方資安模擬。
- 第一輪實際 Remotion `story-rebuild-round1-hook.png` 證實比分／隊徽重疊、白色1淺底失讀、地圖陰影黑方塊。先補失敗測試後修復；第二輪四幕確認陰影透明且主構圖分開。
- 第二輪 context 白色姓名及 detail 名稱跨色域失讀；補紅綠測試，第三輪 event/context 真實抽幀確認名稱位置及深墨姓名修復。
- 原透明筆觸空隙不再填滿，放大真掃描輪廓並鏡射，不手造刷形；淡出露紙取代不透明水平矩形。淡金補償避免放大後色值變濁；第四輪四幕是補償後版本。
- 原地圖道路／河流位置保留；森林厚度從原封閉區到道路邊界的距離推導，使用真掃描顏料及受光深淺，不新增戰術路徑／樹木圖示。第五輪 hook 為這版真實抽幀，但仍缺樣稿的外圍森林輪廓、石邊與完整插畫質感。
- 最新局部測試：`node --test tests/unit/render/{matchStoryAssets,matchStoryFrame,riftAtlasMaterials}.test.js` 27/27（真正執行為三個完整檔名），`git diff --check` 通過。全測重新執行中，不沿用 v9 成功作為當前證據。
- v10 合成影片 ffprobe：H264/AAC、1080×1920、30fps、40.042667秒；已用真瀏覽器開MP4並確認readyState4、播放時間向前、無media error。v11為淡金補償後版本；v12為森林距離材質後版本，正在生成。影片均明標合成，不是真BFX–NS研究稿。
- 未完成：最新影片解碼／播放驗收、兩輪桌機1280×800／手機375×812、完整finish reviewer、品質差距修復及build。不得宣稱美術完成、獎項水準、發布或部署。前次diff數值混入內容與尺度差，不是純风格品質量測。
