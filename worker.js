#!/usr/bin/env node
/**
 * =========================================================================
 * HEXTECH VIDEO STUDIO — Local Worker (Standalone Cron Daemon)
 * =========================================================================
 * A standalone Node.js process that polls Leaguepedia every 15 minutes
 * and auto-generates PLAYER_RADAR videos for newly completed matches.
 *
 * Usage:
 *   npm run worker                  # default: poll every 15 min
 *   npm run worker -- --now         # run once immediately, then start cron
 *   npm run worker -- --dry         # dry run (log only, no pipeline)
 *   npm run worker -- --interval 5  # custom interval in minutes
 *   npm run worker -- --hours 12    # look back 12 hours
 *
 * Requirements:
 *   - GEMINI_API_KEY in .env (for AI reasoning)
 *   - Optional: GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET + GOOGLE_REFRESH_TOKEN (for YouTube upload)
 *
 * This script is fully independent of the Next.js server — it directly
 * imports the shared utils (leaguepediaApi, autoDispatcher) and runs
 * the pipeline in-process without HTTP round-trips.
 * =========================================================================
 */

require('dotenv').config();
const cron = require('node-cron');
const path = require('path');
const fs = require('fs');

const { fetchRecentMatchesWithPlayers } = require('./utils/leaguepediaApi');
const { processMatchAndGenerateRadar } = require('./utils/autoDispatcher');

// =========================================================================
// CLI Argument Parsing
// =========================================================================
const args = process.argv.slice(2);
const FLAG = {
  now:      args.includes('--now'),
  dry:      args.includes('--dry'),
  interval: parseInt(args[args.indexOf('--interval') + 1] || '15', 10),
  hours:    parseInt(args[args.indexOf('--hours') + 1] || '6', 10),
  publish:  args.includes('--publish'),
  locale:   args[args.indexOf('--locale') + 1] || 'zh',
};

// =========================================================================
// Processed Match Store (file-based dedup)
// =========================================================================
const STORE_PATH = path.join(__dirname, 'cache_processed_matches.json');

function loadStore() {
  try {
    if (fs.existsSync(STORE_PATH)) {
      const raw = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
      // Prune entries older than 7 days
      const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const pruned = {};
      for (const [k, v] of Object.entries(raw)) {
        if (v.processedAt && v.processedAt > cutoff) pruned[k] = v;
      }
      return pruned;
    }
  } catch (e) {
    console.warn(`⚠️  Could not load store: ${e.message}`);
  }
  return {};
}

function saveStore(store) {
  try {
    fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), 'utf8');
  } catch (e) {
    console.error(`❌ Could not save store: ${e.message}`);
  }
}

// =========================================================================
// Core Poll Function
// =========================================================================
async function pollAndGenerate() {
  const runId = Date.now();
  const hrLine = '═'.repeat(60);

  console.log(`\n${hrLine}`);
  console.log(`🕒 [Worker] Poll #${runId} — ${new Date().toLocaleString()}`);
  console.log(`   Lookback: ${FLAG.hours}h | Dry: ${FLAG.dry} | Publish: ${FLAG.publish} | Locale: ${FLAG.locale}`);
  console.log(hrLine);

  try {
    // ── STEP 1: Fetch recent matches ──────────────────────────────
    const matchesWithPlayers = await fetchRecentMatchesWithPlayers(FLAG.hours, 5);

    if (matchesWithPlayers.length === 0) {
      console.log('😴 [Worker] No matches found — sleeping until next poll');
      return;
    }

    // ── STEP 2: Filter already-processed ──────────────────────────
    const store = loadStore();
    const newMatches = matchesWithPlayers.filter(mwp => {
      const key = mwp.match.uniqueGame;
      if (!key) return false;
      if (store[key]) {
        console.log(`  ⏭️  Already processed: ${key}`);
        return false;
      }
      return true;
    });

    console.log(`🔍 [Worker] ${matchesWithPlayers.length} matches found, ${newMatches.length} are new`);

    if (newMatches.length === 0) {
      console.log('✅ [Worker] All matches already processed — sleeping');
      return;
    }

    // ── STEP 3: Process each new match ────────────────────────────
    let successCount = 0;

    for (const { match, players } of newMatches) {
      const ctx = match.matchContext;
      const key = match.uniqueGame;

      console.log(`\n🎮 [Worker] Processing: ${ctx.league} · ${ctx.teamA} vs ${ctx.teamB} · ${ctx.seriesScore}`);
      console.log(`   Players: ${players.map(p => `${p.name}(${p.role})`).join(', ')}`);

      // Calculate KP% for all players
      const teamKills = {};
      for (const p of players) {
        if (!teamKills[p.team]) teamKills[p.team] = 0;
        teamKills[p.team] += (p.stats?.kills || 0);
      }
      const enriched = players.map(p => ({
        ...p,
        stats: {
          ...p.stats,
          kp: String(Math.round(((p.stats?.kills || 0) + (p.stats?.assists || 0)) / Math.max(1, teamKills[p.team] || 1) * 100)),
        },
      }));

      // Find MVP (winning team, best KDA)
      const winners = enriched.filter(p => p.isWinner);
      const pool = winners.length > 0 ? winners : enriched;
      const mvp = [...pool].sort((a, b) => {
        const kdaA = parseFloat(a.stats?.kda || '0');
        const kdaB = parseFloat(b.stats?.kda || '0');
        return kdaB - kdaA;
      })[0];

      console.log(`   🏆 MVP: ${mvp.name} (${mvp.role}, ${mvp.team}) — KDA: ${mvp.stats.kda}`);

      if (FLAG.dry) {
        console.log(`   🏷️  DRY RUN — would generate radar video for ${mvp.name}`);
        store[key] = { processedAt: Date.now(), mvp: mvp.name, success: true, dryRun: true };
        saveStore(store);
        continue;
      }

      // ── Dispatch to full pipeline ───────────────────────────
      const dispatchData = {
        matchContext: ctx,
        players: enriched.map(p => ({
          name: p.name, role: p.role, team: p.team, stats: p.stats,
        })),
      };

      const result = await processMatchAndGenerateRadar(dispatchData, {
        autoPublish: FLAG.publish,
        locale: FLAG.locale,
        targetPlayer: mvp.name,
      });

      if (result.success) {
        successCount++;
        console.log(`   ✅ Video ready: ${result.videoUrl}`);
        if (result.youtubeResult) {
          console.log(`   📺 YouTube: ${result.youtubeResult.url}`);
        }
      } else {
        console.error(`   ❌ Pipeline failed: ${result.error}`);
      }

      // Mark processed regardless of outcome (avoid retry loops)
      store[key] = {
        processedAt: Date.now(),
        mvp: mvp.name,
        videoUrl: result.videoUrl || null,
        success: result.success,
        error: result.error || null,
      };
      saveStore(store);
    }

    console.log(`\n📊 [Worker] Poll complete: ${successCount}/${newMatches.length} succeeded`);

  } catch (err) {
    console.error(`\n❌ [Worker] Poll failed: ${err.message}`);
    console.error(err.stack);
  }
}

// =========================================================================
// Startup
// =========================================================================
function boot() {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║   HEXTECH VIDEO STUDIO — Local Worker Daemon            ║');
  console.log('║   PLAYER_RADAR · Leaguepedia Auto-Generation           ║');
  console.log('╠══════════════════════════════════════════════════════════╣');
  console.log(`║  Interval:    Every ${String(FLAG.interval).padStart(2)} minutes                          ║`);
  console.log(`║  Lookback:    ${String(FLAG.hours).padStart(2)} hours                                  ║`);
  console.log(`║  Dry Run:     ${FLAG.dry ? 'YES' : 'NO '}                                      ║`);
  console.log(`║  Auto-Publish:${FLAG.publish ? 'YES' : 'NO '}                                      ║`);
  console.log(`║  Locale:      ${FLAG.locale.padEnd(3)}                                      ║`);
  console.log(`║  Gemini Key:  ${process.env.GEMINI_API_KEY ? '✅ loaded' : '❌ MISSING'}                                ║`);
  console.log(`║  YouTube:     ${process.env.GOOGLE_REFRESH_TOKEN ? '✅ configured' : '⚠️  not configured'}                            ║`);
  console.log('╚══════════════════════════════════════════════════════════╝');

  if (!process.env.GEMINI_API_KEY) {
    console.error('\n❌ GEMINI_API_KEY is required. Add it to .env and restart.');
    process.exit(1);
  }

  // Validate cron expression
  const cronExpr = `*/${FLAG.interval} * * * *`;
  if (!cron.validate(cronExpr)) {
    console.error(`❌ Invalid cron interval: ${FLAG.interval} minutes`);
    process.exit(1);
  }

  // Run immediately if --now flag
  if (FLAG.now) {
    console.log('\n⚡ --now flag detected, running immediately...');
    pollAndGenerate().then(() => {
      console.log('\n🕒 Initial run complete. Starting scheduled polling...');
      startCron(cronExpr);
    });
  } else {
    startCron(cronExpr);
  }
}

function startCron(cronExpr) {
  console.log(`\n🕒 Cron scheduled: "${cronExpr}" — waiting for next trigger...`);
  console.log(`   Next run: ~${FLAG.interval} minutes\n`);

  cron.schedule(cronExpr, async () => {
    await pollAndGenerate();
  });
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n👋 [Worker] Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n\n👋 [Worker] Received SIGTERM, shutting down...');
  process.exit(0);
});

// ── GO ──
boot();
