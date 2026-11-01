# 新風格零新增費用素材查核

2026-10-01。使用者選「保留新風格」並要求繼續；不採舊元件降級、不呼叫可能計費的圖片生成、搜尋模型或配音。

## 本轮進度

作者Dino0040公開素材頁：
https://opengameart.org/content/100-grunge-brushstrokes-and-splatters-set

頁面明列CC0，作者說明為自己畫的水彩筆觸及飛濺掃描；increased_opacity版用於較不透明的UI背景。CC0條款頁：https://creativecommons.org/publicdomain/zero/1.0/ 。這是素材作者授權聲明查核，不保證其他第三方素材或隊伍商標權利。

檔案來源：https://opengameart.org/sites/default/files/grunge_brushes.zip

隔離副本：`.impeccable/sources/grunge-brushes/grunge_brushes.zip`，只解出increased_opacity四張候選000／005／017／021，原圖未改。下載壓縮檔沒有執行其中任何程式。

已實際看圖：透明白色筆觸在白底看起來空白，不能誤判素材不存在；用ffmpeg覆於深灰底產生只供檢查的`brush017-inspection.png`後，看見連續刷痕與透明邊緣。017原圖808×844，其餘620×769、629×1338、394×949（sips讀PNG尺寸）。尚未驗證1080×1920放大品質，不把候選當已核可正式背景。

現有黑色`assets/plates/ground-texture.png`實際是颗粒紋理，不能代替核可雙隊色筆觸。已有16.19.1 Riot簡化圖及16.19客戶端匯出地圖底稿可鎖路線，但它們不是新插畫完成品；原版本／來源與限制見主checkout map-correction-checks.md。不把2026-08-27比賽實際地形變體說成已核對。

## 產品意義與後續

分層：免費真實筆觸→核可大片隊色背景；版本地圖底稿→不重畫路線的地圖元件；已驗證隊徽／照片→真實身份；旁白及標籤→可編輯文字。像底紙、貼紙與文字各自組裝，不使用整張comp作影片。

主方案以來源明確的獨立素材重建核可風格，無新增服務費；備援是继续保留已選方向與稿件，缺口未解前不製片，不換舊世界。未知放大品質、背景密度與地圖插畫一致性須實測；spec仍open、plates仍pending，沒有強制通過。

本輪僅素材查核／下載／診斷看圖與文件。未寫影片元件、未全測、未生成MP4、未發布／部署。下一動作是素材組裝前校正核可region框，再量測候選筆觸的放大與風格適配；不擅自宣稱獎項品質。

## 繼續查核結果

已在隔離区複製主checkout的build state／regions與核可comp，不覆寫主checkout。加大右隊徽框為220×226、地圖861×710，comp-spec後實際advance仍exit2。crop參考已打開：隊徽形狀有留白但周邊筆觸延伸；地圖森林確實到達框邊。沒有修改bleed／force／kind繞過。記錄`/tmp/lol-atlas-spec-adjusted.log`。

假說「紅色底本身導致誤判」以已知白色120×120方塊、400×400淺／深紅背景校準，region240×240且四邊留60px：兩者均無裁切警告。因此不能把深紅色本身說成已證實原因；筆觸与插畫物件交疊仍待查。校準圖僅診斷、不用於影片或當comp。masthead量測仍回no separable lettering，未手填字體chosen。

已非阻塞詢問使用者：保留核可大範圍雙隊色／版面／筆觸語言，是否允許真實底稿與免費素材重組細節，不要求逐像素重現。未收到答覆前不降低comp權威；查核與內容接入繼續。
# 2026-10-06 額外候選檢查（未採用）

查看作者 illin 的 [Handpainted Rock Walls](https://opengameart.org/content/handpainted-rock-walls)，原頁明列CC0，直接候選 `DesolatedHut.png` 500×500，存於 `.impeccable/sources/rock-wall-desolated-hut-candidate.png`，SHA256 `1a829423aaf0212b4addc22abc4c1f8cc8ed01a9611d15afe11ec7b1ed01336a`。主代理已實際開圖：它是規則磚牆，不是森林岩壁輪廓；直接貼入地圖會變成另一種地貌，因此未進production素材包／provenance，不用免費授權合理化不合適素材。本輪搜尋不構成「所有免費素材都不存在」的結論。
