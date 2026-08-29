# HANDOFF — LoL 影片生成器

> 2026-08-29 由 Codex 更新。全球一級賽事素材庫已在 `main` 上線；本輪正在完成賽後判讀最後一幕的動態勝方隊徽背景，分支 canary 已通過，待完整品質閘門與整合。

## 本輪狀態

- 2026-08-29 完成賽後判讀最後一幕的 preview-only 真實 canary：因 Leaguepedia 限流無法取得施工計畫原定 2026-08-27 snapshot，依既定備援改用本機已保存且素材完整的 `LCK · BNK FEARX vs HANJIN BRION · 3-2`；畫面正確使用 BF 勝方隊徽、`3–2`、Raptor `+184 DPM` 與 Taeyoon `10.26 CSM`，沒有固定 GEN／Chovy／Ruler。第二輪影片為 `public/renders/render_1788046934408.mp4`（ignored runtime），SHA-256 `11be0932db1d8ce563b450bce9d0e1e8487001d38a290680aa48bb64c917f093`；H.264／AAC、1080×1920、30fps、25.045333 秒、-17.0 LUFS、true peak -1.9 dBFS、leading silence 49.8125ms，媒體閘門通過。frame 705／749 的 SSIM `1.000000`、PSNR `91.385793 dB`，最後 1.5 秒視覺完全靜止。
- 最終影片自檢圖為 `.screenshots/final-read-winner-crest-round2/final-1080x1920.png` 與 `.screenshots/final-read-winner-crest-round2/final-375x667.png`；第一輪發現結論「次領先」形成孤行，經垂直 TDD 將閱讀欄由 900px 收至 760px，第二輪的層次、留白、字體、霧金／青色／灰階、對齊、375px 可讀性、隊徽安全區、比分一致與動態名稱均通過。工作台最終圖為 `.screenshots/final-read-winner-crest-workbench-round2/desktop.png`、`mobile.png`；375px `scrollWidth = clientWidth = 375`、產品 console error 0，實際預覽停留於「媒體驗證已通過」且 video readyState 4。
- Canary 前後安全封條一致：`.data/patch-content-db.json` 維持 254,084 bytes、SHA-256 `ff407d384b33d95c82ade5923f6ab174182cd08d4a7194e48d0e8e623130fef0`；publish queue、daily runs 與 publish packages 均不存在，publish jobs／packages 0，未點擊確認發布。正式規格與施工計畫為 `docs/superpowers/specs/2026-08-29-final-read-winner-crest-background-design.md`、`docs/superpowers/plans/2026-08-29-final-read-winner-crest-background.md`。
- 2026-08-29 完成賽後判讀選手證據幕的資訊密度與隊徽安全區調整：公開主標只顯示選手 handle，原名改為獨立副標；下方資料區上移 96px，新增 KDA／參團率／每分鐘經濟三項系列賽證據，並依實際局數顯示 `4-GAME AVERAGE`。51 個含文字的隊徽／品牌 lockup 已標記為 `embedded`，畫面不再疊加重複隊名且預留 88% 圖像安全區；無數據時維持省略，不捏造 0。正式規格與計畫分別為 `docs/superpowers/specs/2026-08-29-player-proof-layout-density-design.md`、`docs/superpowers/plans/2026-08-29-player-proof-layout-density.md`。
- 真實 2026-08-27 BNK FEARX 3-1 Nongshim RedForce preview-only canary 為 `public/renders/render_1788021979451.mp4`（ignored runtime）：H.264／AAC、1080×1920、30fps、25.045333 秒、-17 LUFS、true peak -1.9 dB、leading silence 49.8125ms，publish jobs 0。最終影片畫面為 `.screenshots/player-proof-layout-round2/result-1080x1920.png`、`proof-1080x1920.png`、`result-375x667.png`、`proof-375x667.png`；隊徽、原名、4 場標示與三欄證據均無裁切。
- 工作台兩輪桌面／手機自檢完成，最終圖為 `.screenshots/player-proof-workbench-round2/desktop.png` 與 `.screenshots/player-proof-workbench-round2/mobile.png`；375px `scrollWidth = clientWidth = 375`、console error 0。層次、留白、字體、單一霧金配色、對齊、響應式、空／載入狀態與既有微動效均通過；本輪沒有新增動效程式碼。
- 分支完整品質閘門通過：TDD doctor；coverage 618 tests／612 pass／6 個明確外部 skip／0 fail，line 94.30%、branch 80.61%、function 96.13%；Next 26 routes build 通過，僅保留既知 3 個 `playerPortraitManifest.js` tracing warnings；audit 0 vulnerabilities、Remotion QA 6/6、Playwright 4/4。自我 code review 未發現阻擋項，產品行為仍維持 preview-first、素材缺口硬阻擋與不自動發布。
- fast-forward 合併 `main` 後重跑同一套完整品質閘門亦全綠：618 tests／612 pass／6 skip／0 fail、Next 26 routes、audit 0、Remotion QA 6/6、Playwright 4/4。
- 常駐工具清除建置後的 `.next` 編譯快取並重啟後，`http://localhost:49761` 回 HTTP 200。正式網址實際操作 2026-08-27 掃描顯示 BNK FEARX 3-1 Nongshim RedForce，25 秒預覽停留於「媒體驗證已通過」，video readyState 4、console error 0、publish jobs 0；沒有點擊確認發布。source SHA `35ff9bf` 的 CI run `33277127223` 與 CodeQL run `33277126837` 均成功。
- 2026-08-29 修復 2026-08-28 掃描在 LPL `Grand Finals_Knight's Road` GameId 中斷：根因是 `fetchMatchPlayers()` 未逸出 Cargo 單引號，產生不合法 where clause，Leaguepedia 因而回 MediaWiki `MWException`。新增共用 `escapeCargoValue()`，players 與 team stats 均以 `''` 表示資料中的撇號；來源的非限流 JSON error 另分類為可重試 `LEAGUEPEDIA_UPSTREAM_ERROR`／HTTP 502，使用者只看中文恢復提示。聚焦 17/17 通過；真實 2026-08-28 API 跨過所有 `Knight''s Road` 局並回 3 個系列賽，頁面掃描顯示 LEC Team Vitality 2-1 Fnatic、console error 0。完整閘門 608 tests／602 pass／6 個外部 skip／0 fail，line 94.30%、branch 80.61%、function 96.13%；Next 26 routes、audit 0、Remotion 6/6、Playwright 4/4，常駐網址重啟後 HTTP 200。
- 2026-08-28 全球一級賽事素材庫已完成使用者核准批次：LCK、LPL、LEC、LCS、CBLOL、LCP 共匯入 425 個有明確 Leaguepedia 檔案頁的候選（371 張選手照、54 個隊徽），連同既有素材後 manifest 為 373 個選手身分、58 個隊徽身分、431 個唯一檔案。`assets:verify` 實測總容量 20,846,381 bytes、最大單檔 357,615 bytes；2026-08-28 清冊 62 隊覆蓋 58、438 個選手×隊伍身分覆蓋 373。無候選的 4 隊徽與 65 選手身分依產品拍板保持 render 硬阻擋，正式清單在 `config/esports-asset-unresolved-2026.json`，不得用錯隊、錯制服或舊圖代替。
- Leaguepedia 的 `Special:Redirect/file` 對匿名程式下載回 HTTP 403；importer 已用 TDD 改為先向 MediaWiki `imageinfo` 解析 HTTPS 靜態圖，再下載、Sharp 正規化、驗證格式／SHA-256／尺寸。以 LCP 1Jiang 真實邊界校準為 748×621 WebP、45,858 bytes、SHA-256 `c5ec178c68ec726275710800a5a667e765840b262a3a1b4344f27b0346a5ce60`。批次下載上限同時 4 筆，輸出順序與 manifest 寫入保持穩定。
- 主線品質閘門已完成：`npm ci` audit 0、TDD doctor 通過、coverage 605 tests／599 pass／6 個明確外部 skip／0 fail（line 94.30%、branch 80.61%、function 96.13%）、Next 26 routes build 通過、Remotion QA 6/6、Playwright 4/4、素材逐檔驗證通過。Next build 保留既有 3 個 `playerPortraitManifest.js` dynamic filesystem tracing warnings，沒有新增 build failure。
- 工作台全球掃描與素材缺口畫面完成兩輪自檢；最終桌面／手機圖為 `.screenshots/global-tier-one-assets-round2/desktop.png` 與 `.screenshots/global-tier-one-assets-round2/mobile.png`，375px `scrollWidth = clientWidth = 375`、產品 console error 0。候選拍板頁另以桌面／手機兩輪驗證，第二輪 0 error、7/7 拍板 builder 與 494 列搜尋均可用。
- 真實 tier-one contract 第一版因每局都抓 players＋team stats，在前五區通過後觸發 Leaguepedia 15 分鐘 rate limit；已改為每個賽事日期用一筆 match query 驗證已完成系列，再用一局 player query 驗證 10 人五路。冷卻到期後真實邊界 10 tests／9 pass／Worlds 2026 依 8/28 尚未開賽明確 skip／0 fail：LCK、LPL、LEC、LCS、CBLOL、LCP、First Stand、MSI 均找到已完成系列與 10 位選手五路資料。
- 2026-08-27 BNK FEARX vs Nongshim RedForce 真實 UI canary 首次揭露來源完整隊名在畫面層被縮為 `BF`／`NR` 後又誤拿來查素材；以兩個垂直 TDD 切片保留 `teamAIdentity`／`teamBIdentity`，隊徽 preflight 改用完整身分、畫面仍保留短碼。聚焦 18/18 通過後，實際掃描顯示 3-1、Taeyoon，25 秒預覽顯示「媒體驗證已通過」，瀏覽器 console error 0。
- 最終真實預覽為 `public/renders/render_1787971292701.mp4`（ignored runtime），SHA-256 `4b9b28c6f40fbd29c3b5d41275864ab6f972973036e00066a16de78ce44ea3eb`、8,574,235 bytes；H.264／AAC、1080×1920、30fps、25.045333 秒。畫面僅出現「確認發布」入口，未點擊；publish queue 與 daily runs 均不存在，publish jobs 0。
- 常駐 `http://localhost:49761` 合併後驗收另發現 `next dev --webpack` 會在 MP4 寫入 `public/renders` 時自動刷新頁面，API 雖 200 但使用者看不到完成狀態；依 Next 16 本機文件改回預設 Turbopack，並新增啟動契約測試。LaunchAgent 重啟後實際掃描與預覽停留在「媒體驗證已通過」，影片 `render_1787973102151.mp4` 為 25.045333 秒、8,573,621 bytes、SHA-256 `5898949f44ba5261424743e2a7f7ba7be3424d66f66d44a5f2d0aaa56b609958`，readyState 4、console error 0、publish jobs 0。

- 2026-08-28 全球一級賽事素材庫施工計畫已寫入 `docs/superpowers/plans/2026-08-28-global-tier-one-esports-assets.md`：10 個垂直 TDD tasks 依序處理九項賽事登錄、單次精確日期查詢、日期感知素材 identity、聚合缺口、名單盤點、核准匯入／驗證、當前 LCK blocker、六區域素材填充、前端狀態與真實 canary／全套收尾。依使用者明確授權，計畫自我檢查後直接 inline 實作，不另停下選執行方式；禁止使用子代理。
- 2026-08-28 產品負責人核可將素材與掃描範圍擴充為 Riot 2026 全球一級職業體系：LCK、LPL、LEC、LCS、CBLOL、LCP，以及 First Stand、MSI、Worlds。採用版本化本機完整素材庫、官方來源優先／Leaguepedia 備援、自動盤點缺口但人工核准入庫；正式名單含先發與替補，改名／轉隊依比賽日期解析，缺素材仍阻擋且一次回報完整缺口。正式規格為 `docs/superpowers/specs/2026-08-28-global-tier-one-esports-assets-design.md`；使用者明確授權規格完成後直接寫施工計畫並進入實作，不需再次停下拍板。
- 2026-08-28 診斷 BNK FEARX vs Nongshim RedForce 預覽的 `Player portrait not found for Taeyoon (Kim Tae-yoon)`：候選賽事、推薦主角與名稱均正確，根因是正式素材 manifest 只有 Ruler、GEN、HLE；本場同時缺 Taeyoon 照片及 BNK FEARX／Nongshim RedForce 隊徽，只補名稱解析或單張照片都無法打通流程。現行閘門正確阻止錯用他人照片。最初提出的文字識別備援已由產品負責人否決，正式決策改為補齊全球一級賽事素材庫；尚未修改 render 行為、下載外部素材或建立發布工作。
- 2026-08-28 修復賽事工作台選定有賽事日期卻顯示空狀態：根因是 `fetchCompletedSeriesForDate()` 無視選定日期，固定向 Leaguepedia 各取 LCK／LPL 最新 5 局後才在本機篩日期；8/27 賽事已被 8/28 新局數擠出結果。新增 `fetchMatchesForDate(date, tournament)`，把 UTC 日界 `[00:00, 隔日 00:00)` 下推至 Cargo 查詢；LCK／LPL 縮寫只匹配同名或以縮寫加空格開頭的賽事，避免誤抓 LPLOL 與名稱中偶然含 LPL 的資格賽。TDD 回歸先確認舊 recent 入口造成紅燈，再轉為聚焦 10/10 綠；真實 2026-08-27 LCK 邊界回傳 BNK FEARX 對 Nongshim RedForce 4 局並合併為 3-1，10 位選手、5 組位置、完整性全通過。分支與 main 完整驗證皆為 571 tests、567 pass、4 個既有外部 contract skip、0 fail，line 94.28%、branch 80.59%、function 96.10%；Next 26 routes build 通過（保留既知 3 個 portrait tracing warnings），audit 0。瀏覽器重掃後空狀態計數 0，系列選單顯示 `LCK · BNK FEARX vs Nongshim RedForce · 3-1`，console error 0。
- 2026-08-28 修復本機工具常駐服務 `com.cengweiting.lol-video-generator.dev`：LaunchAgent 與啟動腳本由已不存在的 `/Users/cengweiting/Desktop/lol-video-generator` 改指目前專案 `/Users/cengweiting/Developer/lol-video-generator`，固定沿用 `http://localhost:49761`。修前網址為 HTTP 000、launchd `EX_CONFIG` 並累積 20,791 次失敗啟動；修後首頁 HTTP 200（29,865 bytes），刻意送出 SIGTERM 後約 3 秒自動換新 PID 並恢復 HTTP 200，確認登入自啟與 `KeepAlive` 均有效。這是本機登入工作階段的常駐服務，不是網際網路公開的 24/7 正式站。
- 2026-08-16 修正 Leaguepedia 限流錯誤的前後端欄位落差：API 回傳 `cooldownUntil`，工作台現在會顯示中文可重試時間並保留舊 `retryAt` 相容，不再直接露出 Fandom 原始英文錯誤。根因另確認為舊 `frontend-workbench-refactor` dev server 未載入根目錄 `.env`／`.env.local`，已切回主專案並沿用 `http://localhost:49761`。TDD 目標測試 7/7；完整 coverage 568 tests、564 pass、4 個外部 contract skip、0 fail，line 94.28%、branch 80.66%、function 96.10%；Next 26 routes build 通過（保留既知 3 個 portrait tracing warnings）、audit 0、Remotion QA 6/6、Playwright 3/3。最終錯誤狀態截圖為 `.screenshots/rate-limit-round2-desktop.png` 與 `.screenshots/rate-limit-round2-mobile.png`，375px `scrollWidth = clientWidth = 375`、錯誤節點 `role="alert"`。
- 2026-08-15 完成「安靜的 LCK 轉播工作台」前端重構：首頁只保留 `賽事影片`、`版本更新` 與右上角 `進階工具`；桌機為左側控制／右側預覽，375px 手機改為操作後接預覽，沒有橫向溢出。
- 賽事流程固定以 `mode: "preview"`、`languages: ["zh"]` 先渲染及驗證；沒有預覽時不呈現發布動作，確認時把畫面上同一組 `videos` 與 localized PLAYER_RADAR payload 交給 `/api/publish`。部分平台失敗只重試失敗平台。
- 版本流程改為英雄／系統／裝備符文三類單筆選擇，移除選取全部與批次發布；preview route 會保存 `renderedAt` 與 `renderResult.videos`，確認發布只傳 `itemIds: [selectedItem.id]`，publish route 重用已確認影片。
- Meta 掃描／render、Insights GET／sync 與發布佇列 GET 保留於 Sheet 進階工具；portfolio read-only mode 仍停用所有 mutation，GET-only 重新整理可用，`?portfolio=1` 的 synthetic fixture 仍可在進階 Meta 顯示。
- TDD 新增 pure workflow model、preview artifact 真實 filesystem 契約與 3 條 Playwright 使用者流程；瀏覽器用 network boundary mock 驗證賽事 exact-artifact publish、版本單 ID publish 與進階工具 disclosure，不會真的發 Instagram／Threads。
- 前端輕量化：刪除未再引用的舊 `InsightsDashboard.jsx` 359 行；`app/globals.css` 由 2,585 行降至 678 行，移除舊 `.hvsShell`、Hextech card 與舊 insights 樣式。保留最小 shadcn Button／Tabs／Sheet／Select、Tailwind v4、repo-hosted Outfit／Cinzel 與 reduced-motion。
- 最終前端圖：`.screenshots/final-desktop.png`（1280×800）與 `.screenshots/final-mobile.png`（375×812）。層次、留白、字體、單一霧金配色、對齊、響應式、狀態、focus 與動效均通過；console 只有 React devtools／HMR 資訊，沒有產品錯誤。動效審查無阻擋項：沒有 `transition: all`、`scale(0)`、ease-in UI 或超過 300ms 的新動效。
- 賽事 preview-only canary：`public/renders/render_1786859158391.mp4`（ignored），SHA-256 `406d375c8e0be2815e4006cd5de2eb961dafe65693b7b344a250e32f489d80fc`；H.264／AAC、1080×1920、30fps、25.045333 秒、-17.1 LUFS、true peak -8.2 dBFS、leading silence 49.3333ms，媒體閘門通過，publish jobs 0。
- 版本 preview API canary：ITEM_UPDATE `patch_16eee974c930695c` 保持 `READY`，`publishResult: null`，保存中英文 2 支影片；中文 SHA-256 `293bf5849f8745201e7daba4b9e2729e21ec9e928bbb71a4dbefaaa4e66c8678`，英文 `bc3cfbcb775236f1452ebcea2b8a6aa2dd3ef723a1823cca35e28b774fa91c57`。隔離 worktree 的內容 DB SHA-256 為 `069578bcc00191419ec00731bb574043ee20320b4eb62e0d303c66d918ae0f98`。
- Canary 副作用封條：開始時內容 DB／queue／daily runs 都不存在、publish packages 0；完成後只有預期的 ignored canary DB／3 支 MP4，queue 與 daily runs 仍不存在、publish packages 仍為 0。主 worktree runtime 資料未觸碰，Git status 沒有 runtime 檔案。
- 分支完整閘門：`npm ci` 成功且 audit 0；`tdd:doctor` 通過；coverage 568 tests、564 pass、4 個外部 contract skip、0 fail，line 94.28%、branch 80.66%、function 96.10%；Next 26 routes build 成功；`npm audit --audit-level=high` 0 vulnerabilities；Remotion QA 6/6 stills；Playwright 3/3。
- 最終安全覆核補上 3 個產品契約：切換賽事日期／系列會清除過期預覽、媒體驗證前不顯示發布入口、版本內容發布後保留平台結果但禁止重複發布；Meta 硬阻擋與空排名也不得進入渲染。
- `main` 於提交 `fdbf1b0` 重跑安裝、TDD doctor、完整 coverage、Next build、high audit 與 Remotion QA 全綠；遠端 CI run `31930380927`、CodeQL run `31930379984` 成功。Dependabot open alerts 以 API 重新計數為 0，open PR 為 0。
- Next production build 仍有既知 3 個 `playerPortraitManifest.js` dynamic filesystem tracing warnings；沒有新增 warning 或 build failure。Repo 仍無 production deployment target，本輪 push 後只驗證 GitHub source CI／CodeQL，不建立重複正式站。

- 2026-08-13 依使用者核可將 25 秒賽後判讀的 0–4 秒結果幕由 Ryze／Orianna 英雄頭像改為 GEN／HLE 隊徽；4 秒後對位幕仍保留官方英雄方形頭像，其他四幕排版與節奏未改。
- 新增 `config/esports-team-crests.json` 與 `utils/render/teamCrestManifest.js`：render 前核對 team／season、PNG、SHA-256、尺寸與 `public/team-crests/` 路徑；Remotion props 只帶本機路徑與必要尺寸，不帶遠端 URL。官方／來源與商標限制記錄於 `THIRD_PARTY_ASSETS.md`。
- Inline TDD 抓到並修正隊徽未進 `staticFile()` 導致真實 canary 404；新隊徽 resolver 的 Turbopack warnings 已由 2 降為 0，production build 只剩原有 3 個 `playerPortraitManifest.js` tracing warnings。
- 最終不發布 canary：`public/renders/render_1786662935714.mp4`（ignored runtime），SHA-256 `406d375c8e0be2815e4006cd5de2eb961dafe65693b7b344a250e32f489d80fc`，7,541,739 bytes；H.264／AAC、1080×1920、30fps、25.045333 秒、-17.1 LUFS、true peak -8.2 dBFS、leading silence 49.3333ms，publish jobs 0、queue 0、publish packages 0。
- 最終影片抽幀：`.screenshots/team-crests-canary-final/3.8s.png`、`3.8s-mobile.png`、`4.2s.png`；確認首幕雙隊徽、手機辨識與下一幕英雄臉均正確。工具網站兩輪桌面／手機圖位於 `.screenshots/team-crests-tool-round2/`，375px scrollWidth=375、console 0 error／0 warning。
- 2026-08-13 完成 25 秒五拍成品：`結果 → 中路差距 → 第一局物件轉塔 → Ruler 數據 MVP 候選 → 最終判讀`；四個視覺空間、英雄方形臉、已驗證 Ruler 真人照、repo-hosted 中英字體與 25 秒授權音樂均已接上正式 render path。
- 最終 preview-only canary：`public/renders/render_1786660561234.mp4`（ignored runtime），SHA-256 `9abd2e610a383df0442f384ef7f729e2b684b50c00b097ef7cd86e5e172f3242`，選曲 `licensed-bgm-1`，publish jobs 0。
- 媒體實測：H.264／AAC、1080×1920、30fps、25.045333 秒、7,691,334 bytes、48kHz stereo、-17.1 LUFS、true peak -8.2 dBFS、leading silence 49.3333ms；全部通過 25 秒媒體閘門。
- Canary 第一輪發現首幀只有標頭與背景，已用 TDD 讓 `2-0` 從首幀低對比淡入；第二輪截圖位於 `.screenshots/post-match-read-25s-round2/`，包含 0.0／3.8／4.2／8.8／9.2／16.8／17.2／21.8／22.2／23.5／24.9 秒及各自 375×667 預覽。
- 最後 1.5 秒的 source clock 固定於 frame 705；H.264 解碼後 frame 705／749 因有損壓縮不是 byte-identical，但 SSIM `1.000000`、PSNR `105.277454 dB`，視覺上無可辨識變化。不得把 decoded MD5 當有損影片的靜止判準。
- Canary 前後正式資料封條逐字相同：主內容 DB SHA-256 `ff407d384b33d95c82ade5923f6ab174182cd08d4a7194e48d0e8e623130fef0`；主 repo／隔離 worktree 的 queue 與 daily runs 均 `MISSING`；publish packages 0。沒有建立社群工作或正式發布紀錄。
- Task 11 聚焦測試 21/21 與 Next production build 通過；Task 12 canary 測試 4/4 通過。尚待 Task 13 全套 coverage、audit、QA render、main 重跑與 GitHub checks。
- Task 13 分支 CI parity：`npm ci`、`npm run tdd:doctor`、`npm run test:coverage`、`npx next build`、`npm audit --audit-level=high`、`npm run qa:render` 全通過；coverage 562 tests、558 pass、4 個明確外部 contract skip、0 fail，line 94.28%、branch 80.42%、function 96.10%，Remotion QA 6/6 stills 成功。
- Fast-forward 合併 `main` 後已重新執行 `tdd:doctor`、完整 coverage、Next build、audit 與 QA render：562 tests、558 pass、4 skip、0 fail，line 94.28%、branch 80.47%、function 96.10%，audit 0 vulnerabilities、QA 6/6。
- 真實邊界：Data Dragon square／splash／Smite／map、三首授權音樂 25 秒 WAV、Ruler portrait identity／SHA／dimensions 全通過。Leaguepedia Cargo 在最後複驗時回傳 rate-limit，cooldown until `2026-08-13T22:58:40.868Z`；保留為外部限制，不以 mock 宣稱 live contract 通過。
- Next 16.3.0 production build 成功但有 3 個 `playerPortraitManifest.js` dynamic filesystem tracing warnings；可能增加 server bundle，尚未造成 build 或 runtime 失敗，列為下一輪輕量化候選，不在本輪安全／視覺修復中冒險改動。
- GitHub source SHA `6b3aecb60133ffa0483ad1b3291a36a605c348f6` 的 CI run `31751291684` 與 CodeQL run `31751290739` 均成功；Dependabot open 0、open PR 0、Code Scanning open alerts 0。Repo 仍無正式 deployment target，因此沒有建立新站。

- 2026-08-13 使用者已核可下一版「賽後判讀」25 秒視覺：主方案為 Broadcast Hero 對位／MVP＋Tactical Transmission 戰局分析；英雄身份使用官方方形頭像，splash 僅作氣氛，MVP 直接使用已授權選手照片，中央線與 dashboard 同版型不再使用。
- 核可節奏為 `0–4 秒結果 Hook → 4–9 秒對位 → 9–17 秒遊戲過程 → 17–22 秒數據 MVP 候選 → 22–25 秒最後判讀`，最後 1.5 秒完全靜止；GEN 2–0 HLE 為第一支不發布 canary 範例。
- 視覺最後一項修正將大比分拆成獨立 `2`、`–`、`0`，縮小分隔號並保留明確 clear space；其他四幕排版由使用者確認保留。
- 新書面規格 `docs/superpowers/specs/2026-08-13-post-match-read-25s-game-flow-design.md` 已由使用者於 2026-08-13 明確回覆「規格通過」。
- 逐步施工圖為 `docs/superpowers/plans/2026-08-13-post-match-read-25s-game-flow.md`：共 14 個 inline TDD tasks，依序處理 ScoreboardTeams、故事模型／證據鏈、選手照片、英雄方形臉、字體、25 秒授權音樂、媒體／佇列隔離、動效、四個視覺空間、GEN 2–0 HLE canary 與 GitHub 收尾；明確禁止子代理。
- 目前只修改核可文件與交接狀態；12 秒正式影片程式、runtime queue、daily runs、publish packages 與社群狀態均未修改。下一步是依施工圖用 `executing-plans` inline 執行 Task 0–13。

- 2026-08-13 已將對外 Player Radar 全面重做為「賽後判讀／POST MATCH READ」：保留內部 `PLAYER_RADAR`／`PlayerRadarVideo` 相容識別，觀眾端不再出現舊名稱或 dashboard 視覺。
- 新模板固定 360 frames／12 秒，使用同一英雄主視覺、持續 Hextech 主線與四幕 `約 21× → Jackal 13.7 vs Dinai 0.64 KDA → Pyeonsik 806 DPM → 最終判讀`；最後 1 秒完全靜止。
- 對位理由改用 normalized gap＋角色固定優先序排序，不再拿不同單位 raw delta 比大小；只有五路完整且自動選擇時才能聲稱最大差距。
- Pyeonsik 對外明示「數據 MVP 候選」；Jackal 的括號真名只留在來源資料，不進公開短影音。
- 官方 Data Dragon 原畫、方形英雄頭像、Smite 與地圖先解析至 cache；原畫失敗時退回官方 square＋map，原畫與 square 都失敗則阻擋 render。
- 三首使用者確認授權的曲目保留 SHA-256 驗證與自動輪替；12 秒 segment 先用 FFmpeg 烘入增益與 34ms sample-accurate fade，再交給 Remotion，避免 frame fade 造成開頭過長低音量。
- preview／test／dry-run 與 canary 皆只 render＋validate；只有 production 且媒體閘門通過才會建立 publish jobs。Canary 命令本身拒絕 `--publish`、`--queue` 與 production 參數。
- 最終 canary：`public/renders/render_1786651144635.mp4`（ignored runtime），SHA-256 `d9b408c4f59eeb69b6c5d0dedfb810aaded576200380a289b28d9f57ccb24a97`，授權曲 `licensed-bgm-1`，publish jobs 0。
- 媒體報告：H.264／AAC、1080×1920、30fps、12.053333 秒、integrated -17.0 LUFS、true peak -7.1 dBFS；開頭低於 -45dB 區段 49.0625ms，符合 50ms 上限。
- 最終第二輪截圖：`.screenshots/post-match-read-round2/0.0.png`、`1.7.png`、`1.9.png`、`4.9.png`、`5.1.png`、`8.9.png`、`9.1.png`、`11.0.png`。第一輪失敗圖不作最終證據。
- Canary 前後正式資料封條逐字相同：內容 DB SHA-256 `ff407d384b33d95c82ade5923f6ab174182cd08d4a7194e48d0e8e623130fef0`；publish queue 與 daily runs 均 `MISSING`；publish packages 0。沒有建立社群貼文。
- 媒體閘門已自動檢查開頭低音量時間；最終成品報告為 `leadingSilenceMilliseconds: 49.0625`，超過 50ms 會在建立 production jobs 前失敗。
- 分支驗收：`npm ci`、`npm run tdd:doctor`、`npm run test:coverage`、`npx next build`、`npm audit --audit-level=high`、`npm run qa:render` 與 Data Dragon 真實 contract 全通過；coverage 537 tests、534 pass、3 skip、0 fail，line 94.26%、branch 80.34%、function 96.09%。
- `main` 首次 push 的 CodeQL 已通過，但 CI run `31739533436` 揭露 GitHub Ubuntu runner 沒有 FFmpeg，造成 3 個真實授權音檔契約測試與 1 個烘製音訊測試以 `ENOENT` 失敗；不是影片行為或安全套件回歸。
- CI workflow 已用 TDD 加入 `apt-get update` 與安裝 `ffmpeg`，保留三首 tracked 授權音樂的真檔起音／響度／峰值驗證，不把契約測試降級為 skip；修正後 CI run `31739974145` 與 CodeQL run `31739973577` 均成功。
- 修正後 GitHub API 雙重分頁校準：Dependabot open 以 `per_page=1` 與 `per_page=100` 均為 0，18 筆全為 fixed；open PR 兩種分頁均為 0，Code Scanning open alerts 為 0。
- Repo 沒有正式 deployment target，因此本輪 push 後只驗證 GitHub source checks，不建立新站。

- 2026-08-13 完成 Player Radar 的產品與視覺重設決策：對外改名為「賽後判讀／POST MATCH READ」，受眾為一般 LoL 玩家，第一版採音樂＋動態文字、1080×1920、30fps、目標 12 秒。
- 使用者逐段核可 LoL 原生英雄敘事、四幕 `約 21× → 打野對位 → 806 DPM → 賽事判讀`、三首授權音樂節拍規劃、資料誠實規則、錯誤降級、驗證閘門與垂直 TDD。
- 正式設計規格 `docs/superpowers/specs/2026-08-13-post-match-read-lol-native-design.md` 已由使用者通過；逐步實作計畫為 `docs/superpowers/plans/2026-08-13-post-match-read-lol-native.md`，指定 inline TDD、不得使用子代理。
- 原「只完成規格與計畫」狀態已由本輪實作取代，保留此條作歷史紀錄。
- 視覺 brainstorm 與瀏覽器驗證 artifacts 位於 `.superpowers/`、`.screenshots/`，皆為本機忽略項目；正式規格不依賴這些暫存檔才能理解。

- 2026-08-12 以最新 Leaguepedia LCK 資料完成一次不發布的 Player Radar 全流程演練；HLE Challengers 對 HANJIN BRION Challengers 的三局已正確合併為 2-1，而不是因主客隊順序交換被拆成兩個候選。
- 系列分組修正遵守 TDD：新增反轉隊伍順序的回歸測試，先確認 `2 !== 1` 的紅燈，再將分組鍵的隊名正規化排序，目標測試 5/5 通過。
- 合併後發現 Node experimental coverage 在 79.99%／80.04% 間浮動；未降低 80% 門檻，改補原始賽事先聚合再套用候選優先分數的既有行為測試，完整 coverage 連跑兩次均通過。
- 新 canary 為 `public/renders/render_1786580383001.mp4`：中文版、H.264／AAC、1080×1920、30fps、16.62 秒、3,062,072 bytes，自動選用已授權 `licensed-bgm-3`；發布佇列與 daily runs 仍為 0。
- 算圖後已檢查第一幀、7 秒與 13 秒畫面：首幀顯示 Jackal 對 Dinai 的 DPM +86，中段保留 GPM／KDA 證據，結尾分開呈現對位差與 Pyeonsik MVP；截圖為 `.screenshots/player-radar-fresh-first.png`、`.screenshots/player-radar-fresh-mid.png`、`.screenshots/player-radar-fresh-proof.png`。
- 前次 Aphelios 演練留下的 6 支無引用 runtime MP4 已依既有「歷史影片歸零」決策精確移除；目前 `public/renders/` 只保留這次的新 canary，Git tracked `public/demo/meta-tier-ranking.mp4` 未動。
- 本輪 9 個實作提交已完成 AI latency、filesystem confinement、Actions runtime、本機字型、Player Radar 開場、死碼清理、Remotion 依賴瘦身與發布錯誤邊界測試。
- AI 模型透過 `utils/genaiClient.js` 單次呼叫，預設 timeout 30,000ms，可設定範圍 1,000–60,000ms；逾時仍交給既有 deterministic fallback。
- repository-hosted Outfit／Cinzel 已同時供 Next 與 Remotion 使用；Remotion 改用 CSS `@font-face`，避免長片持有未清除的 `delayRender` handle。
- Player Radar 預設 Hook 86→45 幀，timeline 從 frame 0 開始；開場優先顯示第一個 matchup evidence，缺少時才回退到 proof pill。
- runtime 清理只處理 Git 可回復且無入口的程式碼；歷史 runtime 影片已依 2026-08-10 的產品決策歸零，本輪未再刪除媒體或內容資料。
- Remotion 直接依賴 14→2（`@remotion/cli`、`remotion`）；CLI 所需 renderer 等仍由 lockfile 正常帶入。
- 已 fast-forward 合併 `main` 並正常 push；本輪 code verification SHA `44091ff971114abb5afe31a4fd6dac538415a64b` 的 CI 與 CodeQL 均成功。

- GitHub `main`：PR #5 已於 `d91c5a2f7cf374c8c739999b3cd5dc305b5394ea` 合併；原始整合 head 為 `22f8a1fd449e5409aaeee16f68ec18e7dde6d311`。
- 永久救援：`rescue/2026-08-09-main-wip` 指向 `8550fe8c0f9bdba116de46846a4b655a5f9a69c3`；外部救援副本在 `/Users/cengweiting/Developer/lol-video-generator-rescue-20260809.PIixWe`。
- 原本 34 個未提交路徑已整合成 rescue commit；Player Radar 的 30 個原始 commits 已完整搬入。
- 壞掉的 Player Radar worktree 已修復連結，實體仍在 `.worktrees/player-radar-dual-read/`，沒有 prune。
- 2026-08-10 依產品決策將本機與外部 runtime 救援副本的歷史影片資料歸零；Git、原始內容資料與 tracked 示範素材未刪除。
- 歸零後第一組 canary dry run 已用 26.13 Aphelios 產生中英文影片；未建立 queue、daily run 或遠端貼文。
- Aphelios 內容錯標已用 TDD 修正；正式 canary 的四段畫面依序顯示 Calibrum、Severum、Infernum、Crescendum，中英皆沒有 `E 技能`／`Base Stats`。
- 專案擁有者於 2026-08-11 確認三支 BGM 可用於成品並可隨 GitHub repository 再散布；正式曲庫、SHA-256 與第三方權利聲明已納入 tracked source。

## 這輪完成的能力

1. 發佈佇列、每日執行紀錄與 `public/publish-packages/` 改為每次操作時解析目前 worktree，不再把測試 clip 或 dry-run 寫進另一個專案。
2. 保留 Daily one-click、Leaguepedia cooldown／BotPassword 登入、標準化 API 錯誤與 Player Radar 雙讀證據鏈。
3. 保留 GitHub 線的唯讀展示、無 shell 渲染及帳號識別資訊不進 log；本機算圖會從已驗證正式曲庫自動選歌，呼叫者仍可覆蓋或以 `null` 靜音。
4. 合併更新 Next／Sharp／PostCSS／nanoid／Undici／fast-uri，沒有降低 `npm audit --audit-level=high` 閘門。
5. Daily one-click 的預設發布日曆固定為 `America/Los_Angeles`，避免 GitHub UTC runner 把「昨天」算成不同日期；呼叫端仍可明確覆寫時區。
6. Leaguepedia 限流判斷改成線性片語搜尋，並移除 Player Radar 無效的數字自我替換，處理 PR #5 的兩個 CodeQL 警報。
7. PATCH 解析器接受 `【段落】\n內容`，具名武器不再從單字內誤判 Q/W/E/R；同數量的 AI 場景也會被官方 patch 具名段落強制修復。
8. AI 回傳字串型 `metrics` 時，只保留可安全拆成名稱／before／after 的項目；無法解析的字串會丟棄，再由官方 patch 原文補齊。
9. 正式曲庫 `config/licensed-music-library.json` 只選 `enabled + verified + SHA-256 相符` 的曲目；中英雙語每次只選一次並共用同一首。

## 依賴版本

- Next `16.3.0`
- Sharp `0.35.3`
- PostCSS `8.5.23`
- nanoid `3.3.18`
- Undici `7.29.0`
- fast-uri `3.1.5`

## 驗證證據

- 最新 Player Radar 資料驗證：Leaguepedia snapshot `scan-2026-08-12-b509a93dc3` 為 1 個完整候選、3 局、10 位選手、5 組位置對位；series score `2-1`，建議 MVP 為 Pyeonsik。
- 最新 Player Radar 媒體驗證：影片 SHA-256 `3c5eabbd1279b78c95cc39b1d6752ab38eff0dab8940c2f48025a3a01363d28c`；前 10 秒平均音量 -32.6 dB、峰值 -17.4 dB；內容 DB SHA-256 維持 `ff407d384b33d95c82ade5923f6ab174182cd08d4a7194e48d0e8e623130fef0`。
- 2026-08-12 最新 CI parity：`npm ci`、`npm run tdd:doctor`、`npm run test:coverage`、`npx next build`、`npm audit --audit-level=high` 全通過。
- 覆蓋率：502 tests、500 pass、2 個外部 LoLalytics contract skip、0 fail；line 94.29%、branch 80.19%（前一次 80.24%）、function 96.38%；`seriesFetcher.js` line 100%。
- Production build：26 routes；`Dynamic filesystem access causes tracing` 計數 0。
- Remotion dependency canary：乾淨安裝後辨識 8 種 composition；`npm run qa:render` 的 6 種 still 全成功。
- Player Radar 完整 canary：`/tmp/player-radar-canary.mp4`，H.264／AAC、1080×1920、48kHz stereo、14.72 秒、1,189,093 bytes；使用已授權 `audio/bgm1.mp3`，沒有發布。
- Player Radar 動效審查：移除 35 幀 lead-in 與會遮資料的 stage spring；保留不改 layout 的背景光束與 badge 回饋，第一幀即可讀證據。
- 網站兩輪最終截圖：`.screenshots/reliability-round2-desktop.png`、`.screenshots/reliability-round2-mobile.png`；Outfit 200、Cinzel 200、375px scrollWidth=375、console 0 error／0 warning。
- 資料安全：隔離 worktree content DB absent、queue 0、daily runs 0、publish packages 0；主內容 DB SHA-256 仍為 `ff407d384b33d95c82ade5923f6ab174182cd08d4a7194e48d0e8e623130fef0`。

- `npm ci`：通過，`found 0 vulnerabilities`
- `npm run tdd:doctor`：通過
- `npm run test:coverage`：453 tests；451 pass、2 個外部 LoLalytics contract tests skipped、0 fail；line 96.84%、branch 80.31%、function 96.23%
- 惡意重複 Leaguepedia 前綴的限流判斷：修正前約 169ms，修正後約 2.5ms
- `TZ=UTC node --test tests/unit/esports/dailyOneClick.test.js`：2/2 通過，涵蓋 GitHub runner 與本機時區差異
- `npx next build`：通過；26 個頁面／API route 建置完成
- `npm audit --audit-level=high`：通過，0 vulnerabilities
- 2026-08-11 完整 CI parity：`npm ci`、`npm run tdd:doctor`、`npm run test:coverage`、`npx next build`、`npm audit --audit-level=high` 全通過；463 tests、461 pass、2 個外部 contract skip、0 fail；line 96.85%、branch 80.32%、function 96.24%。
- 歷史影片歸零後驗收：queue 0、daily runs 0、78/78 內容題目為 `READY`、舊影片／社群引用 0、既定刪除路徑殘留 0。
- 歸零後重跑 queue isolation 與 content store：20/20 通過；新增 daily-run worktree 隔離回歸測試後，全套為 454 tests、452 pass、2 個外部 contract tests skipped、0 fail。
- Aphelios canary：中英文皆為 H.264、1080×1920、30fps；中文 35.56 秒／19,544,129 bytes，英文 25.28 秒／14,369,308 bytes；內容 DB SHA-256 產片前後皆為 `ff407d384b33d95c82ade5923f6ab174182cd08d4a7194e48d0e8e623130fef0`。
- Canary runtime：`public/renders/render_1786426536139_zh.mp4`、`public/renders/render_1786426536139_en.mp4`；兩支音軌約 -91 dB，等同靜音；queue 與 daily runs 仍不存在。
- 修正版 Aphelios canary：`public/renders/render_1786459693643_zh.mp4` 與 `public/renders/render_1786459693643_en.mp4`；兩支皆 H.264／AAC、1080×1920、30fps，時長 35.41／35.56 秒。
- 修正版音訊驗收：兩支影片前 10 秒 PCM SHA-256 同為 `f28d8a1908e53533e4f92772e83ce46cc0617c1ed7c4773f7a2a92719ccf7d21`；平均音量約 -34 dB、峰值 -18.2 dB，確定是同一首非靜音 BGM。
- 修正版資料副作用：內容 DB SHA-256 仍為 `ff407d384b33d95c82ade5923f6ab174182cd08d4a7194e48d0e8e623130fef0`；publish queue 與 daily runs 仍不存在。
- `npm run qa:render`：6/6 個 1080×1920 stills 均大於 25 KB
- Player Radar H.264 曾通過 1080×1920、30fps 驗收；該暫存影片已隨歷史影片歸零刪除。
- 最終桌面／手機截圖：`.screenshots/round2-desktop.png`、`.screenshots/round2-mobile.png`
- 整合 worktree 沒有產生 `.data/publish-queue.json`。
- 合併後 detached `main` 再跑同一套 CI：453 tests、451 pass、2 skip、0 fail；build 與 audit 均通過。
- GitHub PR #5：CI、CodeQL actions、CodeQL JavaScript 與 PR security gate 全部通過。

## Runtime 資料限制

- 主專案、兩個 worktree 與外部 runtime 救援副本共刪除 2,040 個歷史檔案（87,819,029 bytes），包含 queue、daily runs、renders、publish packages、render assets 與舊內容資料庫快照。
- 主程式目前讀到 publish queue 0 筆、daily runs 0 筆；內容資料庫保留 78 個題目，78 筆全為 `READY`，舊 render／publish 結果與社群貼文 ID／網址引用為 0。
- `public/demo/meta-tier-ranking.mp4` 是 Git tracked 的產品示範素材，刻意保留；其餘 runtime 影片均已移除。
- Instagram／Threads 上既有公開貼文未做遠端刪除；本機已不再保留其貼文 ID，因此後續發布會視為全新任務。

## GitHub 與部署結果

- Dependabot 以 `per_page=1` 與 `per_page=100` 兩種分頁重算均為 0 open；18 筆全數為 `fixed`。
- PR #2／#3／#4 已各附上由 #5 取代的原因並關閉；沒有合併或刪除其分支。
- 本輪 code verification SHA 的 [CI run](https://github.com/Hunter20041004/lol-video-generator/actions/runs/31654522480) 與 [CodeQL run](https://github.com/Hunter20041004/lol-video-generator/actions/runs/31654521867) 全綠；Actions 與 JavaScript/TypeScript 分析都成功。
- 最新三個 checks annotations 均為 0；沒有 Node 20 deprecation，Code Scanning open alerts 為 0。
- open PR 以 `per_page=1` 與 `per_page=100` 重算皆為 0。
- Repo 沒有 deployment workflow、Vercel／Netlify／Pages／Sites 設定；GitHub Deployments 為 0，因此這輪沒有可沿用的正式站可部署。

## 剩餘限制

- 這台 macOS 舊於 15，Remotion 會顯示相容性提醒；完整 H.264／AAC canary 與 QA still 均實測成功。
- `npm ci` 仍有 `whatwg-encoding`、`source-map@0.8.0-beta.0`、`node-domexception` 三個間接 deprecated 提示；audit 為 0，這輪不強制 override 間接依賴。
- Riot Data Dragon 偶爾回 HTTP 503；render asset 本機 fallback 已實測接手。
- Node coverage 會提示兩個 ES module 重新解析 warning；若要徹底消除需規劃全專案 ESM 遷移，不在本輪輕量化範圍。
- Repo 仍沒有既有 production deployment target；完成 GitHub push 後只驗證 source CI，不建立新付費站點。
