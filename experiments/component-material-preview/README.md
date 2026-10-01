# 元件材質試樣

## Direction contract

THESIS：回到使用者偏好的原影片，只改元件美術，不把整張森林圖片當影片。

OWN-WORLD：暗色實心面板、克制舊金邊與低彩度物件色。保留原英數壓縮字與中文字級，以維持閱讀；取消青色霓虹、網格與大切角。

STORY：原六幕、同一真實資料、原隊徽／人物／數值位置。觀看完整40秒並比較，不改製作或發文工作流程。

FIRST VIEWPORT：仍是原版左右隊徽比分板，原70px安全邊界、四格證據带及六幕進度。沒有新全屏圖像。

FORM：既有影片元件換皮，使用者已釘定方向，無新增風格選擇；純色替換、大切角縮為4px、六角標記改成小型圓章、移除背景電路線。

FINISH：獨立預覽及比較圖驗收、測試與交接記錄；不直接取代正式模板。

## 方法及界線

prepare.js 生成原元件的樣式副本到 ignored .data/component-material-preview，不改原 src。materialStyle.js 僅替換配色及框形／去除裝飾線。此工具是試樣，不是正式架構；正式整合時改用共享主題，不保留來源字串轉換。沒有新套件、圖像生成或付費素材。

資料使用上一輪已驗證 frozen model；不更改字句、候選標籤、資料分支、照片、圖像尺寸、外部幾何或轉場。音樂沿用已測過的分段時間配置。靜態框形變更不改動效程式。

```sh
node experiments/component-material-preview/prepare.js
npx remotion render experiments/component-material-preview/index.jsx ClassicComponentPreview public/renders/edit/component-material-preview/preview.mp4 --props=public/render-assets/rift-stone-trial/input.json --codec=h264 --crf=18 --concurrency=4
node --test tests/unit/render/componentMaterialPreview.test.js
```

核可基準：之前可播放影片 public/renders/render_1790784651699.mp4；不是被拒絕的森林石刻試片。比較圖用同一來源及同一幀的 original/classic variants，避免賽事不同誤判美術。
