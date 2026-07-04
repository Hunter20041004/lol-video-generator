const cron = require('node-cron');
const { getTierListByRole } = require('./src/parsers/MetaScanner');

// 定義需要監控的所有路線
const ROLES = ["Top", "Jungle", "Mid", "Adc", "Support"];

console.log("🕒 [Scheduler] 海克斯自動化排程系統已啟動...");

/**
 * 每日凌晨 03:00 自動刷新所有路線數據
 */
cron.schedule('0 3 * * *', async () => {
  console.log("🔄 [Scheduler] 觸發每日凌晨數據同步任務...");
  for (const role of ROLES) {
    try {
      console.log(`📡 正在自動抓取 [${role}] 的最新數據...`);
      await getTierListByRole(role);
      console.log(`✅ [${role}] 同步完成。`);
    } catch (error) {
      console.error(`❌ [${role}] 同步失敗:`, error.message);
    }
  }
  console.log("✨ 每日同步任務執行完畢。");
});

/**
 * 每 30 分鐘輪詢 Leaguepedia，自動為新完成的比賽生成 PLAYER_RADAR 短影音。
 * 走 /api/cron/check-matches 端點（與 Vercel Cron / 外部 scheduler 共用同一邏輯）。
 * 僅在有 GEMINI_API_KEY 時啟動，避免無 key 時無限報錯。
 */
if (process.env.GEMINI_API_KEY) {
  const { fetchRecentMatchesWithPlayers, transformCargoToRadarSchema } = require('./utils/leaguepediaApi');
  const { processMatchAndGenerateRadar, identifyMVP } = require('./utils/autoDispatcher');

  cron.schedule('0,30 8-16 * * *', async () => {
    console.log("🕒 [Scheduler] 觸發 PLAYER_RADAR 自動輪詢 (Leaguepedia)...");
    try {
      const matchesWithPlayers = await fetchRecentMatchesWithPlayers(6, 3);
      console.log(`🏟️ [Scheduler] 找到 ${matchesWithPlayers.length} 場近期比賽`);

      for (const { match, players } of matchesWithPlayers) {
        const ctx = match.matchContext;
        console.log(`🎮 [Scheduler] 處理: ${ctx.league} · ${ctx.teamA} vs ${ctx.teamB}`);

        const dispatchData = {
          matchContext: ctx,
          players: players.map(p => ({ name: p.name, role: p.role, team: p.team, stats: p.stats })),
        };

        const result = await processMatchAndGenerateRadar(dispatchData, { locale: 'zh' });
        if (result.success) {
          console.log(`✅ [Scheduler] RADAR 影片完成: ${result.videoUrl} (MVP: ${result.mvp?.name})`);
        } else {
          console.error(`❌ [Scheduler] RADAR 失敗: ${result.error}`);
        }
      }
    } catch (err) {
      console.error("❌ [Scheduler] PLAYER_RADAR 輪詢失敗:", err.message);
    }
  });
  console.log("🕒 [Scheduler] PLAYER_RADAR 自動輪詢已啟動 (每 30 分鐘, 08:00-16:00 UTC)");
}

// 如果需要立即執行一次測試，可以取消下方註解
// (async () => {
//   console.log("🧪 執行啟動即時同步測試...");
//   for(const r of ROLES) await getTierListByRole(r);
// })();
