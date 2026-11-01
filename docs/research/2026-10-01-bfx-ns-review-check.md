# BFX–NS回看證據接入

2026-10-01，以正常YouTube播放器重新核對OPLoLReplay EP3kMpvBfQE，未下載影片、未點訂閱／Premium試用，未取得或推定重製權。

第一次seek出現播放器錯誤；正常重開帶262秒的影片網址、用頁面正式略過廣告按鈕後恢復。沒有繞過驗證或存取限制。影片實際duration531.201s、readyState4；此前duration105.921s屬廣告，截圖證實不能把廣告時間當比賽时间。

- 播放器262秒：遊戲16:04、人頭3–5（不是旧筆記16:05）。
- 269–273.02秒正常連續播放；最後畫面遊戲16:15，人頭3–6，Clear側欄死亡計時35秒。河道可見Taeyoon、Kellin、Raptor、VicLa。只說截至此時已死亡，不聲稱精確死亡第一幀。
- 275秒：遊戲16:17，已出現藍方擊殺預示者提示；修正舊筆記16:23。未指定眼睛持有人。
- 278.74秒：遊戲16:21，人頭4–6。
- 285秒：遊戲16:27，人頭6–6、Taeyoon仍存活，提示VicLa擊殺Diable。
- 292秒已是轉場，棄用於交戰證據。

已開啟全部對應截圖，保留於`.screenshots/story-evidence/`；僅研究佐證，未嵌入成片。不是完整逐幀技能／戰術分析或官方原始錄影驗證。旁白改用十六分鐘附近、團隊貢獻及可讀取的結果，不採精確技能连招。

新研究包`2026-10-01-bfx-ns-reviewed.json`、六段腳本`2026-10-01-bfx-ns-reviewed-script.json`經真contract驗證：3來源／6fact／6segment、主候選unresolved0；這些數字讀JSON array length，不是觀眾成效。回看記錄只可由editor入口接受，未放寬模型自稱已看。

原snapshot實際reader仍有效，createdAt2026-09-30T15:16:37.118Z未改。經真service import→revise→read新增draft `6f41e104-a9a0-487d-80a9-da3478b95d1b`，再以expectedRevision2修正研究來源說明並讀回rev3，statusdraft、confirmedRevisionnull。刪除未證實的畫面「系列1／0」描述，避免把其他HUD數字誤讀為系列比分；未改研究時間或來源身份。原80c4809b草稿及新稿舊版本保留，未假簽人工確認。只有本機研究稿保存，無render／publish。這解除原內容待查證項，不等於已完成40秒時長、音樂、素材權利或影片視覺閘門。

局部驗證：`node --test tests/unit/esports/matchStoryContract.test.js tests/integration/esports/matchStoryWorkflow.test.js`，`/tmp/lol-reviewed-story-check.log` exit0、24/24。研究JSON另經真契約驗證，草稿另經真服務與磁碟读回。此輪沒有程式碼改動，不將這項局部檢查說成新影片／全套測試通過。
