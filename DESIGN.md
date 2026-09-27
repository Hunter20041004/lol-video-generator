---
name: Hextech Video Studio — 賽後判讀
description: 用真實 LoL 賽事資產與單一證據節奏完成的直式賽後轉播。
colors:
  rift-navy: "#07141C"
  rift-void: "#030B10"
  hextech-gold: "#C89B3C"
  hextech-gold-bright: "#E6C66B"
  rune-cyan: "#0AC8B9"
  moon-white: "#F0E6D2"
  info-steel: "#6B7C86"
  broadcast-panel: "#0D202A"
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
spacing:
  safe-x: "70px"
  scene-gap: "58px"
  evidence-padding-x: "58px"
  evidence-padding-y: "48px"
components:
  evidence-panel:
    backgroundColor: "{colors.broadcast-panel}"
    textColor: "{colors.moon-white}"
    padding: "{spacing.evidence-padding-y} {spacing.evidence-padding-x}"
  winner-panel:
    backgroundColor: "{colors.rift-navy}"
    textColor: "{colors.hextech-gold-bright}"
---

# Design System: Hextech Video Studio — 賽後判讀

## Overview

**Creative North Star:「峽谷賽事轉播」**

「賽後判讀」採用職業賽事轉播 70%＋遊戲結算畫面 30%。真實英雄、隊徽、召喚峽谷與比賽數據負責建立 LoL 身分；框線與光色只負責整理資訊，不冒充內容。

影片每幕只有一個主舞台、一句判讀與一筆當下證據。視覺保持專業、可信與高對比，避免通用電競 HUD、AI 資訊卡堆疊，以及只為填滿空間而增加的裝飾。

**Key Characteristics:**

- 深藍黑峽谷底色、海克斯金勝方訊號、符文青資源訊號。
- 切角框、六角節點與細窄轉換軸。
- 真實隊徽、英雄、選手與地圖優先於裝飾。
- 資訊依時間輪替，同一瞬間只顯示一個主證據。

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

## Layout

- 固定 1080×1920 直式畫布，左右主要安全邊界 70px。
- 頂部是系列資訊，底部六枚六角節點顯示故事進度，中段只安排本幕唯一主舞台。
- 每幕保留至少約四分之一乾淨深色區域；大數字、人物／隊徽與判讀不可同時等大。
- 地圖與人物可以超出內容框形成層次，但關鍵文字與數據不得越過安全邊界。

## Elevation & Depth

系統不使用投影堆疊。深度由深藍黑的明度差、真實影像、低對比地圖、1px 金／青邊線與前後遮罩建立；禁止玻璃模糊與霓虹 halo。

## Shapes

- `18px` 切角多邊形是主要容器輪廓，不使用圓角卡片。
- 六角形只用於故事進度、地圖物件、位置節點與隊徽底座。
- 邊線維持 1px；粗色側條、膠囊標籤與無意義電路線不屬於這個系統。

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

勝方隊徽、比分與完整判讀形成最後結算。38 秒後移除輪替證據，frame 1,140 至片尾完全靜止。

## Do's and Don'ts

### Do:

- **Do** 使用 manifest 已驗證、可追溯的隊徽、英雄、選手、地圖與音樂。
- **Do** 讓每幕能指出唯一主焦點、唯一判讀與當下唯一主證據。
- **Do** 使用 4–10 frames 的一次性 cubic ease-out，只動 transform 與 opacity；reduced-motion 顯示最終穩定狀態。
- **Do** 在缺少素材時退回隊徽、位置、選手首字與真實數據。

### Don't:

- **Don't** 生成仿真選手、混用錯誤英雄，或捏造遊戲事件、時間與路線。
- **Don't** 使用圓角卡片、玻璃面板、彩虹霓虹、循環脈衝、彈跳、故障閃爍或白閃。
- **Don't** 把「數據 MVP 候選」寫成未經來源證實的官方 MVP。
- **Don't** 用英文 eyebrow、小標或裝飾圖表替代真正的比分、物件與判讀。

完整產品契約與逐幕規格見 `PRODUCT.md` 與 `docs/superpowers/specs/2026-09-27-post-match-read-lol-broadcast-visual-design.md`。
