# Rift Atlas 免費素材重組契約

2026-10-01，使用者對「保留新風格、大片雙隊配色與構圖，但允許森林／地圖細節用免費素材重組」明確答「可以」。原核可comp對插畫細節不再是逐像素契約，仍是雙隊色域、分區、字級對比與筆觸語言的參照。不得解讀成換回舊科技風、付費生成、假臉、假隊徽或扭曲地圖路線。

## 組裝

- 背景：Dino0040 CC0真實水彩筆觸alpha，雙隊色分層。不是生成森林、不是整張核可圖裁切。
- 隊徽：2026-08-27身份／SHA驗證的BNK FEARX及Nongshim原檔，contain放置保留四周。
- 地圖：既有Riot client map11 16.19 base-baron1，保留路線、不畫事件路徑；僅視覺識別，不聲稱本場歷史地形已驗證。
- 人像：後續只接已核對的本場隊服原照片；不生成臉。
- 文字：新六段研究稿取代已失效KDA/VPM題材；範圍／來源不得改成官方MVP或單人逆轉。

製作script `scripts/buildRiftAtlasMaterials.js`只做已授權免費素材的尺寸／alpha／顏色組裝，不開模型或搜尋服務。manifest `assets/plates/rift-atlas-provenance.json`列來源。spec／plates像素閘門實際未過，已用工具支援的force記錄上述使用者授權，不冒稱修正裁切／像素相似。實際畫面仍須檢查：大片隊色、正確身份、文字對比、比例、手機閱讀及地圖輪廓完整。

## 設計文件適用範圍（2026-10-06，Asia/Tokyo）

`DESIGN.md` 以 merge 方式保留既有 PlayerRadar／Post Match Read 規則，在各節新增獨立的 **Rift Atlas — MatchStoryVideo** 範圍；`story-*` token 不重設工作台或舊轉播世界。`.impeccable/design.json` v2 sidecar 補充 schema 無法承載的場景／音訊規則與五個故事元件預覽；色彩 tonal ramp 僅供面板示意，不是影片新增色票。未修既有未使用 Outfit 字型漂移。

設計文件記錄目前實作：暖紙底／深墨字與中性隊徽底、完整 Noto Sans TC Story、44px 隊名、hook／verdict 緊湊身分區、top 29% 的地圖舞台（高 38%／34%）、來源 bottom 12%。標題為 72px，14–18 字用 54px，超過 18 字或含 CR／LF 換行拒絕。正文 55px、line-height 1.35，使用 pre-line／overflow-wrap anywhere／word-break break-all；hook／verdict／其他場景的字數上限 50／68／80、行數上限 3／4／5，伺服器每 17 個 Unicode 字元保守估一行，明確換行逐段加總、空行至少計一行，超出便阻擋過密稿。

來源數只涵蓋實際段落 factIds 引用、readStatus 為 report／stats／reviewed-video 的來源，不能把研究包未用來源算入「已核對來源」；scope 標籤另依每幕 facts 的 evidenceType 顯示。

主方案沿用 Remotion 與免費 pinned 資產；素材核對／權利缺失時阻擋，context 缺少唯一可核對照片時保留示意地圖。原 comp 像素閘門 **43.49% 仍失敗**；使用者允許細節免費重組不等於像素、最終 review 或獎項品質通過。最新手機／成片驗證以 `docs/design/match-story-preview-qa.md` 為準。

## 預覽邊界

`MatchStoryVisualProof`只是一幀素材／版面核對，不能當40秒成片。故事草稿rev3仍未人工確認；新製片入口完成後，只有當前已確認版本可製作。零新增服務費、不下載比賽影片、不發文。確認故事版本與授權發文是兩個不同動作。

## 本輪驗證記錄

素材函式逐項紅→綠：大片雙隊換色、拒絕異常尺寸、地图contain保留四角與透明留白，3/3。Frame素材分層與獨立proof composition逐項紅→綠，2/2；SSR只替代Remotion圖像就緒邊界，另以真正Remotion still驗證載入。全片、動效、音訊與全套尚未驗收，不宣稱完成。
