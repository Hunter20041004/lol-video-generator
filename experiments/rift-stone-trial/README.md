# 峽谷石刻 40 秒獨立試片

本輪授權：使用者偏好第一張石刻森林樣稿，要求「試著做影片」。僅預覽，不替換正式模板、不發文、不操作帳號；原工作台維持原版。

## 方向契約

- 世界：暗色石刻、森林戰場、舊金色，沿用第一張核可樣稿；不是第二張多邊形版本。
- 第一畫面：實際系列賽比分、兩隊已驗證隊徽，峽谷森林佔主要背景。
- 閱讀路徑：比分 5 秒 → 輔助 7 秒 → 資源 7 秒 → 地圖轉換 8 秒 → 射手 8 秒 → 結論 5 秒。
- 招牌動態：背景 40 秒緩推 1.2%；資料 14 幀 cubic ease-out、12px 位移、7 幀層次錯開；最後兩秒定格。影片非頻繁操作 UI，較慢進場為閱讀節奏；reducedMotion 可移除位移與推近。
- 聲音：0–2.5、18.8–26.8、27.8–36.5 秒，既有已授權 BGM2 片段；12 幀進場、21 幀退場。其餘留白。
- 延伸：1080×1920 成片，播放器等比例縮放；不重新設計工作台。
- 真實限制：背景為生成美術示意，不是實際戰術圖；資源為單局終局資料，不具事件時間軸；選手幕是數據 MVP 候選，非官方 MVP。

## 製作

沿用 Remotion 4.0.489，沒有新相依。準備使用已凍結、已驗證的 `/tmp/lol-range-preview.json`；原系列賽 BNK FEARX 3–1 Nongshim RedForce、2026-08-27。不是重新抓取、捏造或更新實際賽事。

```sh
node experiments/rift-stone-trial/prepare.js FROZEN_PREVIEW_JSON APPROVED_BACKGROUND_PNG
npx remotion render experiments/rift-stone-trial/index.jsx RiftStoneTrial public/renders/edit/rift-stone-trial/preview.mp4 --props=public/render-assets/rift-stone-trial/input.json --codec=h264 --crf=18 --concurrency=4
node --test tests/unit/render/riftStoneTrial.test.js
```

這是限定單一已凍結賽事的美術試片，有固定賽事文案；尚未整合成可接受其他賽事的正式模板。正式整合前需將固定隊名與數值全面接回既有資料契約，保留素材／證據守門，另行驗收。

## QA 角色與驗收

觀眾：六幕能讀、字幕不裁切；LoL 編輯：系列與單局統計不混淆，照片隊徽對應實際身分；聲音編輯：數據幕靜音，段落進退不硬切。僅 AI 多角度審查，不是真人認證。

第一輪發現結論字幕被背景圖片正常文流推到畫面外，已將背景固定定位；資料面板從純色改為第一張背景的石刻材質。八項自評：層次、留白、字體、配色、對齊、縮放可讀性、播放器狀態、動態節奏；最終證據另記於 HANDOFF。

本輪不碰登入／權限／付費／對外輸入或資料庫，完整攻擊者模擬未觸發。沒有第三方測試或社群發文。
