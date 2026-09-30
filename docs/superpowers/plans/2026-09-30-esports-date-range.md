# 區間賽事掃描

已核可：首尾日包含、最多31天、已完成＋未開打一級賽程；只有完整已完成資料可preview。沿用UTC日界與現有風格，不新增相依、不發文。前輪素材與audit blocker保留。

## 架構
日期驗證 → MatchSchedule/Tournaments join（日期與一級來源篩選）→ 過去／今日逐日 candidate scanner重用 → 日期／賽事／雙隊唯一匹配 → snapshot只保存可preview candidates，schedule另供顯示。
無效、倒序、超31天輸入於外連前拒絕。未開打、待結果、結果已完成但無完整數據的賽程保留不可preview；來源中途失敗回錯誤，不宣稱全查完。範圍同日保留舊單日API相容。

## 垂直TDD（inline執行）
1. 日期區間驗證一個測試紅→最小驗證綠；再非法／反向／31日邊界紅綠。
2. schedule client先測來源query與source-row分類紅→實作綠；再分頁上限不可静默截斷、未知日期／取消／次級資料紅綠。真實Cargo驗證欄位與回應。
3. range scanner測首尾日合併與單日保存snapshot紅→實作綠；再同隊跨日、未來不抓stats、缺資料不可preview、來源錯誤、cache原始時間紅綠。
4. 瀏覽器測兩端日期送出與已完成preview紅→UI綠；再未開打disabled、非法區間無請求、變更任一日期清preview紅綠。保持舊date API與預覽發布流程契約。
5. 使用者／LoL編輯／無障礙QA→本機低量日期注入、超界、未知結果安全測試→修正重測。兩輪1280×800／375×812，八項自檢，Impeccable detector。動效沿用，不新增。
6. 教學checkpoint→npm run verify、assets:verify、qa:render、Playwright、audit。audit既有high未核准修補時不合併／push／部署。更新HANDOFF證據與剩餘限制。

環境：現有npm／Node24、Next16.3.6；Next本機route-handlers文件已讀。局部node --test對應test檔；瀏覽器npx playwright test。Leaguepedia bot credentials只從主工作區ignored env取得，不記值。
