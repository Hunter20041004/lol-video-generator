---
name: Classic component material preview
description: Original broadcast layout with independent restrained game-interface materials
colors:
  canvas: "#0A1211"
  depth: "#050A09"
  panel: "#131C1B"
  gold: "#B49A65"
  highlight: "#D8C399"
  objective: "#8F9E85"
  text: "#EBE5D7"
  secondary: "#A0AA9B"
typography:
  display:
    fontFamily: Barlow Condensed Post Match Read
    fontWeight: 900
  body:
    fontFamily: Noto Sans TC Post Match Read
    fontWeight: 900
components:
  evidence:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.text}"
---

# Design System: Component Material Preview

## Overview

替原影片元件换美術，依本輪回饋局部調整排版；主題目前只用於獨立試樣。正式整合需用共享主題，而非生成樣式副本。

## Colors

暗色實心閱讀區、克制舊金邊與低彩度物件色。勝方／成立證據仍用金色，物件色不再是發光青色。次要文字提高明度，圖像仍為既有真實身分素材。

## Typography

保留原版英數字與中文字體。選手名字112px／800、主數字156px／800，避免二者壓過照片；全片判讀54px／900、1.32行高、-1.5px字距。其他資料字級沿用原版。候選資格置於姓名下方，保留語意但不把它當眉標。

## Layout

原1080×1920、70px主要安全邊界、六幕40秒、四格證據帶保持。選手照舞台right70/top260/500×660，身分left70/top300/430寬，照片與文字不重疊。數據row990、英雄1185、結論1270均沿同一左線。預覽播放器等比縮放，不產生新響應式網頁。

## Elevation & Depth

深度來自面板明度、照片與原地圖。主要六類面板共用10%暖白上內緣、28%黑下內緣、12px向下／28px模糊／24%黑陰影；不把陰影套在照片或文字。沒有厚石紋、玻璃模糊、霓虹 halo 或新全屏圖像。原電路網格／交叉裝飾線取消。

## Shapes

容器切角由18px縮為4px，保持外部尺寸；六角標記改成小圓章。細框只提供結構，不增加層層厚框。

## Components

Scoreboard、HeroFace、DataCell、ObjectiveNode、Player Card 與 Final Read 沿用原資料。靜態材質換色、切角收細、人物幕排版優化；原進場節奏、減少動態與最後兩秒定格不改。已驗證分段音樂獨立套用。

## Do's and Don'ts

- Do 保留實際隊徽、照片、英雄及原資料欄位。
- Do 比較同一幀的 original／classic variants。
- Don't 把生成森林圖片當作影片版型。
- Don't 將這次試樣生成器整合成正式模板架構。
