---
name: Rift Stone Trial
description: Independent portrait film trial, not the production workbench design system
colors:
  ink: "#101a1b"
  stone: "#182223"
  gold: "#c6aa72"
  text: "#eee9dc"
  muted: "#bdb8a9"
  rule: "#776849"
typography:
  display:
    fontFamily: Cinzel
    fontWeight: 700
    fontSize: 110px
    lineHeight: 1.2
  headline:
    fontFamily: Noto Trial
    fontWeight: 900
    fontSize: 62px
    lineHeight: 1.3
  label:
    fontFamily: Noto Trial
    fontWeight: 700
    fontSize: 31px
    letterSpacing: 3px
spacing:
  panel-x: 36px
  panel-y: 30px
components:
  stone-panel:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.text}"
    padding: 30px 36px
---

# Design System: Rift Stone Trial

## Overview

Creative North Star: 峽谷石刻戰報。第一張核可森林／石刻樣稿延伸為六幕影片。這份只描述獨立試片，不取代根目錄工作台的設計系統，也不代表正式模板已核可。

## Colors

暗石與森林是主要材質，舊金色標示比分和關鍵數字；暖白負責中文主題，低飽和灰褐承載次要說明。

## Typography

Cinzel 用於拉丁字與數字。Noto Trial 是專案既有 Noto Sans TC 本地字體的試片別名。主題、核心數字和補充統計分級，不新增英文分類眉標。素材上的正式隊徽文字保留。

## Layout

固定 1080×1920、30fps、1200 幀。標頭、中央內容、下方石刻結論與來源列各佔自己的閱讀區。播放器等比例縮放，不重新排版。開場三個焦點各自不換行。隊徽 object-fit contain，人物完整臉部、英雄方形圖不扭曲。

## Elevation & Depth

深度來自森林背景與石刻材質，沒有玻璃、霓虹光或浮起陰影。統計面板使用同一張背景的上部石紋，覆蓋森林以保證可讀性。

## Shapes

直角面板配細舊金上下邊界，保留背景石雕框架。沒有新增裝飾性科技幾何。

## Components

Stone panel：橫向證據、對位與結論閱讀區。Headline：單一中文標題。Stat：金色數字與灰褐指標名。Crest：已驗證真實隊徽。Entry：14 幀 cubic ease-out、12px 位移；reducedMotion 保留透明度進場、移除移動。背景總推近1.2%，最後兩秒定格。

## Do's and Don'ts

- Do 分開標示系列賽與單局終局統計。
- Do 將候選 MVP 與官方評選區分。
- Do 保留示意背景的揭露與實際身分素材。
- Don't 把森林示意圖解讀成實際對戰位置或事件順序。
- Don't 將這支限定賽事試片的固定文案直接當作正式通用模板。
