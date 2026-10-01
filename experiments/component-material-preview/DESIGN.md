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

只替原影片元件换美術，不取代原版型；主題目前只用於獨立試樣。正式整合需用共享主題，而非生成樣式副本。

## Colors

暗色實心閱讀區、克制舊金邊與低彩度物件色。勝方／成立證據仍用金色，物件色不再是發光青色。次要文字提高明度，圖像仍為既有真實身分素材。

## Typography

保留原版英數字與中文字體、尺寸、字重及資料位置。此輪不為了古典氣氛換大襯線字，避免犧牲緊密資料的閱讀。

## Layout

原1080×1920、70px主要安全邊界、六幕40秒、四格證據帶與照片位置皆保持。素材 contain／cover 方法保持。預覽播放器縮放，不產生新響應式網頁。

## Elevation & Depth

深度來自面板明度、照片與原地圖，不引入厚石紋、玻璃模糊、霓虹 halo 或新全屏圖像。原電路網格／交叉裝飾線取消。

## Shapes

容器切角由18px縮為4px，保持外部尺寸；六角標記改成小圓章。細框只提供結構，不增加層層厚框。

## Components

Scoreboard、HeroFace、DataCell、ObjectiveNode、Player Card 與 Final Read 沿用原資料與位置。静態材質换色、切角收細；原進場節奏、減少動態與最後兩秒定格不改。已驗證分段音樂獨立套用。

## Do's and Don'ts

- Do 保留實際隊徽、照片、英雄及原資料欄位。
- Do 比較同一幀的 original／classic variants。
- Don't 把生成森林圖片當作影片版型。
- Don't 將這次試樣生成器整合成正式模板架構。
