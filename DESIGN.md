---
name: Hextech Video Studio — 賽後判讀
description: 真實 LoL 賽事直式影片；既有轉播世界與獨立 Rift Atlas 故事世界各自適用。
colors:
  rift-navy: "#07141C"
  rift-void: "#030B10"
  hextech-gold: "#C89B3C"
  hextech-gold-bright: "#E6C66B"
  rune-cyan: "#0AC8B9"
  moon-white: "#F0E6D2"
  info-steel: "#6B7C86"
  broadcast-panel: "#0D202A"
  story-warm-paper: "#f6f3df"
  story-ink: "#101717"
typography:
  display:
    fontFamily: "Barlow Condensed Post Match Read, sans-serif"
    fontWeight: 900
    lineHeight: 0.82
    letterSpacing: "-0.04em"
  body:
    fontFamily: "Noto Sans TC Post Match Read, sans-serif"
    fontWeight: 900
    lineHeight: 1.28
    letterSpacing: "-0.03em"
  label:
    fontFamily: "Barlow Condensed Post Match Read, sans-serif"
    fontWeight: 800
    letterSpacing: "0.2em"
  story-headline:
    fontFamily: "Noto Sans TC Story"
    fontSize: "72px"
    fontWeight: 900
    lineHeight: 1.18
  story-headline-long:
    fontFamily: "Noto Sans TC Story"
    fontSize: "54px"
    fontWeight: 900
    lineHeight: 1.18
  story-team:
    fontFamily: "Barlow Condensed Post Match Read"
    fontSize: "44px"
    fontWeight: 900
    lineHeight: 1.05
  story-score:
    fontFamily: "Barlow Condensed Post Match Read"
    fontSize: "250px"
    fontWeight: 900
    lineHeight: 0.9
  story-narration:
    fontFamily: "Noto Sans TC Story"
    fontSize: "55px"
    fontWeight: 900
    lineHeight: 1.35
  story-scope:
    fontFamily: "Noto Sans TC Story"
    fontSize: "34px"
    fontWeight: 700
    lineHeight: 1.3
  story-source:
    fontFamily: "Noto Sans TC Story"
    fontSize: "32px"
    fontWeight: 700
    lineHeight: 1.3
spacing:
  safe-x: "70px"
  scene-gap: "58px"
  evidence-padding-x: "58px"
  evidence-padding-y: "48px"
  story-content-inset: "6%"
  story-heading-inset: "5%"
  story-reading-top: "22px"
  story-paragraph-gap: "14px"
components:
  evidence-panel:
    backgroundColor: "{colors.broadcast-panel}"
    textColor: "{colors.moon-white}"
    padding: "{spacing.evidence-padding-y} {spacing.evidence-padding-x}"
  winner-panel:
    backgroundColor: "{colors.rift-navy}"
    textColor: "{colors.hextech-gold-bright}"
  story-headline:
    textColor: "{colors.story-ink}"
    typography: "{typography.story-headline}"
    width: "90%"
  story-team:
    typography: "{typography.story-team}"
    textColor: "{colors.story-ink}"
  story-score:
    typography: "{typography.story-score}"
    width: "50%"
  story-reading:
    backgroundColor: "{colors.story-warm-paper}"
    textColor: "{colors.story-ink}"
    typography: "{typography.story-narration}"
  story-source:
    textColor: "{colors.story-ink}"
    typography: "{typography.story-source}"
---

# Design System: Hextech Video Studio — 賽後判讀

## Overview

**適用範圍（2026-10-06，Asia/Tokyo）。** 下列既有「峽谷賽事轉播」規則仍適用於 PlayerRadar／Post Match Read；不重設既有工作台。各節新增的 **Rift Atlas — MatchStoryVideo** 子節只適用於 `src/templates/MatchStoryFrame.jsx`、`MatchStoryVideo.jsx` 與其素材管線。`story-*` token 只屬於這個已核可的獨立新世界，不把舊世界的金色焦點、切角框、六角節點或四格證據帶套回故事影片。

**Creative North Star:「峽谷賽事轉播」**

「賽後判讀」採用職業賽事轉播 70%＋遊戲結算畫面 30%。真實英雄、隊徽、召喚峽谷與比賽數據負責建立 LoL 身分；框線與光色只負責整理資訊，不冒充內容。

影片每幕只有一個主舞台與一句主判讀，但採三層資訊密度：主數字、當幕比較矩陣、全片固定證據帶。視覺保持專業、可信與高對比；密度來自已驗證賽事資料與戰術關係，不以通用 AI 資訊卡或無意義裝飾填空。

**Key Characteristics:**

- 深藍黑峽谷底色、海克斯金勝方訊號、符文青資源訊號。
- 切角框、六角節點與細窄轉換軸。
- 真實隊徽、英雄、選手與地圖優先於裝飾。
- 主證據保持唯一；次級比較資料可持續可見，不再以輪替後消失的方式浪費空間。

### Rift Atlas — MatchStoryVideo

**Creative North Star: "Rift Atlas — 雙隊筆觸故事"**

大片雙隊色域、掃描筆觸與完整召喚峽谷輪廓建立新的敘事舞台。暖紙色讓中文閱讀段落與色域清楚分開，深墨底保護真實隊徽的辨識；隊伍身分先於裝飾。

這是使用者已核可的免費素材重組方向。原 comp 保留色域、分區、字級對比與筆觸語言的參照作用，插畫細節允許重組；不將重組宣稱為原圖逐像素復現或最終品質驗收。

**Key Characteristics:**

- 由本場已驗證隊徽取色，左右隊伍保有真實身分。
- 暖紙閱讀區、深墨隊徽底與完整地圖形成清楚分區。
- 中文可編輯稿使用完整本機字型；正文閱讀時畫面靜止。
- 來源、單局／系列賽範圍與示意地圖限制始終可追溯。

## Colors

色彩角色固定且稀有：金色代表勝方或已成立證據，青色代表可爭奪物件與轉換路徑，月白負責主要閱讀。

### Primary

- **Hextech Gold** (`#C89B3C`)：勝方、比分、證據成立狀態與目前故事節點。
- **Bright Hextech Gold** (`#E6C66B`)：最終判讀的唯一強調文字。

### Secondary

- **Rune Cyan** (`#0AC8B9`)：早期物件、轉換起點、次要數據名稱與低調導引線。

### Neutral

- **Rift Navy** (`#07141C`)：主背景與大面積留白。
- **Rift Void** (`#030B10`)：最深層背景與隊徽底座。
- **Broadcast Panel** (`#0D202A`)：證據槽與比較面板。
- **Moon White** (`#F0E6D2`)：主要數據、隊名與判讀。
- **Info Steel** (`#6B7C86`)：來源、單位、落敗方與次要資訊。

**The One Gold Rule.** 每幕只允許一個主要金色焦點；金色不能被當成普通裝飾。

### Rift Atlas — MatchStoryVideo

- **Warm Story Paper**（`colors.story-warm-paper`）：背景、頂部標題底與下段閱讀遮罩。
- **Story Ink**（`colors.story-ink`）：中文、左側身分與真隊徽中性底；右側隊名／比分使用暖紙色。
- **雙隊色域**：`extractTeamColour` 從已核對隊徽的飽和、不透明像素取色；不能把某一場的兩個色值變成跨場固定品牌色。色彩不足時沿用素材函式的中性備援。

**The Verified Team Colour Rule.** 故事影片的色域來自本場隊徽，隊徽本身保留原色；不能用科技風金青色覆蓋或為視覺效果猜隊色。

## Typography

- **Display Font:** Barlow Condensed Post Match Read（專案內字型）
- **Body Font:** Noto Sans TC Post Match Read（專案內字型）

**Character:** 壓縮英數字建立賽事轉播的速度與量級；中文粗黑體維持手機上的結論可讀性。執行期不得依賴遠端字型。

### Hierarchy

- **Display**（900、118–270px、0.78–0.82）：比分、差值、選手名稱與主數據。
- **Headline**（900、54–58px、1.28）：每幕唯一完整判讀。
- **Title**（900、34–48px）：隊名、英雄名與物件名稱。
- **Label**（700–800、16–28px、4–8px tracking）：來源、單位、位置與賽事狀態。

**The Evidence First Rule.** 數字與結論形成第一、第二閱讀層；英文標籤不得先於真正內容搶走注意力。

### Rift Atlas — MatchStoryVideo

中文使用完整 `Noto Sans TC Story` 本機 variable 字型；舊的固定文案子集不適合可編輯故事稿。英數身分與比分沿用 `Barlow Condensed Post Match Read`。實際檔案、SHA 與 SIL OFL 見 `THIRD_PARTY_ASSETS.md`，不載入遠端字型。

標題使用 `story-headline`；超過 13 個 Unicode 字元改用 `story-headline-long`，超過 18 字或含 CR／LF 換行由閱讀預算守門拒絕，保持單行，不繼續縮字或裁切。兩側隊名使用 `story-team`，detail 場景保留兩行空間。正文、範圍與來源分別使用 `story-narration`、`story-scope`、`story-source`；正文保留明確換行（`white-space: pre-line`），長英數也能折行（`overflow-wrap: anywhere; word-break: break-all`）。賽事／日期列為 29px、800 weight、5px tracking；比分分隔符為 110px，右側比分用暖紙色。

**The Read Budget Rule.** Hook／verdict／detail 正文預算分別為 50／68／80 字，行數上限分別為 3／4／5 行；伺服器按每 17 個 Unicode 字元一行保守估算，各段明確換行逐段加總，空行至少計一行。超出便要求刪稿，不以自動加速、縮字或溢位換取可製作狀態。

## Layout

- 固定 1080×1920 直式畫布，左右主要安全邊界 70px。
- 頂部是系列遙測列，中段安排本幕唯一主舞台，底部固定呈現四格證據帶、六章節導覽與六角進度。
- 每幕保留至少約四分之一乾淨深色區域；大數字、人物／隊徽與判讀不可同時等大。
- 地圖與人物可以超出內容框形成層次，但關鍵文字與數據不得越過安全邊界。

### Rift Atlas — MatchStoryVideo

固定 1080×1920、30fps 直式畫布；工作台播放器按 9:16 縮放，影片不是重排成手機網頁。全片由實際稿件決定長度，上限 1,200 frames，末尾保留 60 frames 閱讀停留。

2026-10-06 敘事用途修正（優先於以下舊地圖分鏡／正文靜音紀錄）：故事成片不放裝飾地圖；地圖只留在獨立素材 proof。尚未實作可核對位置／路線的故事資料契約。Hook 比分 top 10%、340px，隊徽 top 26%、寬23%，隊名36.5%；verdict 比分11%、250px，隊徽13%、寬18%，隊名25%。Detail 隊名21%、寬40%，原照片23%、寬66%、高32%。正文左右6%；無照片detail／有照片detail／verdict／hook 從36%／62%／42%／49%開始；無照片detail 72px，其餘55px。來源bottom12%，顯示文字摘要或原始選手照片。背景 brush 可按分鏡拉伸，原隊徽／照片必須contain。音樂按段落覆蓋，hook／event／context／verdict 相對增益1／0.5／0.4／0.85，12-frame淡入淡出，音源位置跟隨影片時間，不重頭播放、不循環；末尾60frames靜止且停止音樂，無人聲。缺少照片時保留文字，不再回退裝飾地圖。這次只修敘事用途，並非整體美術品質完成。

- 標題 top 2.2%、左右 5%；賽事日期 top 8.2%。
- Hook／verdict：隊徽 top 13%、兩側各 18% 寬；比分 top 11%、中間 50% 寬；隊名 top 25%。這個緊湊身分區釋出地圖舞台。
- Hook 地圖 top 29%、高 38%；verdict 地圖 top 29%、高 34%；兩者寬 91.5%，保持 contain。
- Detail：隊徽 top 13%、寬 14%；隊名 top 15%、寬 27%；地圖 top 23%、寬 88%、高 36%。有可核對單一人像的 context 用照片替代地圖，top 23%、寬 66%、高 32%。
- 正文左右 6%，detail／verdict／hook 分別從 top 62%／66%／70% 開始；暖紙遮罩提前 2% 開始。分隔線後留 22px，範圍與正文間隔 14px。
- 來源固定 bottom 12%、左右 6%，為播放器控制列留閱讀安全區；不要移回底部 2%。

這些數值描述目前實作。素材／版面 proof 的原 comp placement 不是故事成片的配置，不能用 proof 的地圖 top 39% 覆蓋上述分鏡。

## Elevation & Depth

系統不使用投影堆疊。深度由深藍黑的明度差、真實影像、低對比地圖、1px 金／青邊線與前後遮罩建立；禁止玻璃模糊與霓虹 halo。

### Rift Atlas — MatchStoryVideo

不加卡片投影。深度來自掃描筆觸、雙隊色域、透明素材分層、真隊徽中性墨底與暖紙閱讀遮罩；不在地圖上增加虛構事件軌跡、科技框線或霓虹。

## Shapes

- `18px` 切角多邊形是主要容器輪廓，不使用圓角卡片。
- 六角形只用於故事進度、地圖物件、位置節點與隊徽底座。
- 邊線維持 1px；粗色側條、膠囊標籤與無意義電路線不屬於這個系統。

### Rift Atlas — MatchStoryVideo

掃描水彩筆觸的 alpha 提供不規則分界；地圖／隊徽 contain 保留輪廓與留白，不做 polygon 仿造地圖。閱讀區為平直紙色平面，正文分隔線為 2px 墨線；不沿用舊轉播世界的 18px 切角容器。

## Components

### Series Scoreboard

左右隊伍各自保有隊徽、隊名與比分；只有勝方使用金色輪廓與完整彩度。首秒不加入勝因解釋。

### Matchup Rail

一條路線、兩位英雄或明確身分備援，以及一個真實差值。缺英雄圖時使用選手首字，不混用其他英雄。

### Rift Objective Board

召喚峽谷只提供空間語境；物件節點只顯示資料真正支持的隊伍最終總量，不推測座標、路線或時間。

### Evidence Slot

塔數、經濟差與次要選手數據都在固定位置原位替換。同一時間只有一個主要結果，不改成多欄儀表板。

### Player Card

選手照、隊徽、handle、角色、候選身分與一個主數據形成正式賽事卡。英雄池只在真實系列資料存在時顯示。

### Victory Lockup

勝方隊徽、比分、完整判讀與兩組核心證據形成最後結算；四格證據帶仍保留，frame 1,140 至片尾完全靜止。

### Rift Atlas — MatchStoryVideo

- **Team Territory Ground**：pinned CC0 掃描 brush alpha 經免費本機換色組裝；色域只表達隊伍身分，不表達實際地圖控制率。
- **Identity Row**：正確日期／聯賽、原隊徽、44px 隊名；hook／verdict 顯示系列比分，detail 不重複大比分。隊徽用中性墨底避免同色融背景。
- **Map / Portrait Stage**：示意地圖不畫事件路徑；context 只在日期、隊伍、season 與稿件名字唯一核對時顯示原照片。缺少或歧義照片時保留地圖，不猜臉。
- **Reading Block**：先顯示範圍與證據類型，再呈現該幕正文。`report` 標「報導描述」、`reviewed-video` 標「片段回看」，混合類型標「賽事資料」；單局與系列結論不混寫。
- **Source Line**：32px 字體，明示來源與「示意地圖，非事件路徑」或「原始選手照片」。正式故事預覽只計算實際段落 `factIds` 引用的來源，且 `readStatus` 必須為 `report`／`stats`／`reviewed-video`，顯示「N 份已核對來源」；不把研究包所有來源都計入。範圍標籤則依 facts 的 `evidenceType` 決定，不由來源數推測。
- **Scene / Audio Boundary**：正文場景硬切、閱讀時靜止。已核對音樂只在開場至多 90 frames、結論至多 240 frames 出現，12-frame 淡入淡出，正文靜音、無人聲；最後 60 frames 保持靜止並停止音樂。沒有音樂素材時保持靜音。

對應 `.impeccable/design.json` 僅補充 schema 無法承載的文字規則、硬切／音訊邊界與可預覽故事元件；不替換工作台或舊 PlayerRadar 元件。

## Do's and Don'ts

### Do:

- **Do** 使用 manifest 已驗證、可追溯的隊徽、英雄、選手、地圖與音樂。
- **Do** 讓每幕能指出唯一主焦點與唯一判讀，同時保留可掃讀的次級比較與全局證據。
- **Do** 使用 4–10 frames 的一次性 cubic ease-out，只動 transform 與 opacity；reduced-motion 顯示最終穩定狀態。
- **Do** 在缺少素材時退回隊徽、位置、選手首字與真實數據。

### Don't:

- **Don't** 生成仿真選手、混用錯誤英雄，或捏造遊戲事件、時間與路線。
- **Don't** 使用圓角卡片、玻璃面板、彩虹霓虹、循環脈衝、彈跳、故障閃爍或白閃。
- **Don't** 把「數據 MVP 候選」寫成未經來源證實的官方 MVP。
- **Don't** 用英文 eyebrow、小標或裝飾圖表替代真正的比分、物件與判讀。

完整產品契約與逐幕規格見 `PRODUCT.md` 與 `docs/superpowers/specs/2026-09-27-post-match-read-lol-broadcast-visual-design.md`。

### Rift Atlas — MatchStoryVideo

- **Do** 從本場已驗證隊徽取雙隊色，保留原徽與中性墨底。
- **Do** 使用完整 Noto Sans TC Story、本機字型與暖紙閱讀區，超出閱讀預算便刪稿。
- **Do** 保持地圖 contain、來源 bottom 12% 與末尾 60 frames 靜止。
- **Do** 依 `THIRD_PARTY_ASSETS.md` 與 run provenance 追溯免費 pinned 素材。
- **Don't** 把原 comp 插畫細節、43.49% 失敗像素閘門或使用者允許重組當成品質通過。
- **Don't** 付費生成素材、生成假臉／假隊徽，或為這個世界切換影片框架。
- **Don't** 將舊科技風金青框線、切角容器、四格證據帶強加於獨立故事世界。
- **Don't** 把背景色域、地圖位置或候選人物冒充已證實賽事事件、官方 MVP 或勝因。

新世界核可與限制見 `docs/design/rift-atlas-free-reassembly-contract.md`；本輪成片／手機檢查狀態見 `docs/design/match-story-preview-qa.md`。文件更新不等於整體 review、兩輪前端 QA 或像素閘門通過；既有未使用 Outfit 漂移不在本輪修復範圍。
