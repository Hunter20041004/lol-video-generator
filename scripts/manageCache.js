#!/usr/bin/env node
/**
 * scripts/manageCache.js
 * --------------------------------------------------------------------------
 * Google Gemini Cached Content lifecycle CLI 工具。
 * 配合 reasoning.js 的 cold/hot path toggle (USE_GEMINI_CACHE) 使用。
 *
 * Usage:
 *   node scripts/manageCache.js create
 *   node scripts/manageCache.js list
 *   node scripts/manageCache.js delete <cachedContents/abc123>
 *   node scripts/manageCache.js clear-all
 *
 * 或經由 npm scripts：
 *   npm run cache:create
 *   npm run cache:list
 *   npm run cache:delete -- cachedContents/abc123
 *   npm run cache:clear
 *
 * Notes / Caveats:
 *   - Gemini cachedContent 對 model + min token 有官方限制。一般 gemini-1.5-pro
 *     需要 system instruction 至少 32k tokens；gemini-1.5-flash 較寬鬆 (4k+)。
 *     若回 INVALID_ARGUMENT，多半就是 system prompt 太短或 model 不支援 cache。
 *     可在 .env 設 GEMINI_CACHE_MODEL=models/gemini-1.5-flash 切換。
 *   - Prompt 已拆成 per-pipeline prompt。可用 GEMINI_CACHE_DATA_TYPE 指定要 cache 哪條產線。
 *     修改 utils/pipelinePrompts.js 後務必重跑 cache:create 否則 cache hit 拿到的是舊規則。
 *   - Cache 有 ttl，預設 60 分鐘。批次跑大量請求前 create，跑完用 clear-all 收乾淨。
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { GoogleAICacheManager } = require('@google/generative-ai/server');
const { getPipelinePromptForDataType } = require('../utils/pipelinePrompts');

// =========================================================================
// Config
// =========================================================================
const API_KEY = process.env.GEMINI_API_KEY;
// Cache model 與 runtime model 可獨立。預設沿用 runtime 的 GEMINI_MODEL；
// 若 runtime 沒設則用 gemini-1.5-flash（cache API 對 system token 有最低門檻，flash 比 pro 寬鬆）。
// 要強制覆寫：在 .env 設 GEMINI_CACHE_MODEL=models/gemini-1.5-flash
const CACHE_MODEL =
  process.env.GEMINI_CACHE_MODEL ||
  (process.env.GEMINI_MODEL ? `models/${process.env.GEMINI_MODEL}` : 'models/gemini-1.5-flash');
const CACHE_TTL_SECONDS = Number(process.env.GEMINI_CACHE_TTL || 3600); // 60 分鐘
const CACHE_DATA_TYPE = process.env.GEMINI_CACHE_DATA_TYPE || 'PATCH';
const CACHE_PROMPT = getPipelinePromptForDataType(CACHE_DATA_TYPE);
const DISPLAY_NAME = process.env.GEMINI_CACHE_DISPLAY_NAME || `hextech-${CACHE_DATA_TYPE.toLowerCase()}-prompt`;

// =========================================================================
// Helpers
// =========================================================================
function assertApiKey() {
  if (!API_KEY) {
    console.error('❌ 缺少環境變數 GEMINI_API_KEY，請在 .env 設好再跑。');
    process.exit(1);
  }
}

function fmtExpire(expireTime) {
  if (!expireTime) return '(no expire info)';
  const d = new Date(expireTime);
  const remain = Math.round((d.getTime() - Date.now()) / 60000);
  return `${d.toISOString()} (${remain >= 0 ? `${remain} min remaining` : `expired ${-remain} min ago`})`;
}

function describeError(err) {
  // 把 GoogleGenerativeAIError / fetch 失敗 / quota 拒絕 各自降噪到一句重點
  const msg = err?.message || String(err);
  if (/INVALID_ARGUMENT/i.test(msg) && /minimum/i.test(msg)) {
    return `${msg}\n💡 Hint: cache 對 system prompt 有最低 token 數要求；目前選定的 per-pipeline prompt 可能太短。\n   - 試試 GEMINI_CACHE_MODEL=models/gemini-1.5-flash（門檻較低）\n   - 或先不要啟用 cache，直接走 Cold Path`;
  }
  if (/RESOURCE_EXHAUSTED|quota/i.test(msg)) {
    return `${msg}\n💡 Hint: API quota 被吃光了，等冷卻或升級方案。`;
  }
  if (/UNAUTHENTICATED|API key/i.test(msg)) {
    return `${msg}\n💡 Hint: GEMINI_API_KEY 無效或無 caching 權限，到 Google AI Studio 重新確認。`;
  }
  if (/network|ENOTFOUND|ETIMEDOUT|ECONNREFUSED/i.test(msg)) {
    return `${msg}\n💡 Hint: 網路 / DNS 問題，檢查連線後重試。`;
  }
  return msg;
}

// =========================================================================
// Commands
// =========================================================================
async function cmdCreate(mgr) {
  console.log('🔧 建立 cachedContent...');
  console.log(`   model:        ${CACHE_MODEL}`);
  console.log(`   dataType:     ${CACHE_DATA_TYPE}`);
  console.log(`   displayName:  ${DISPLAY_NAME}`);
  console.log(`   ttl:          ${CACHE_TTL_SECONDS}s (${Math.round(CACHE_TTL_SECONDS / 60)} min)`);
  console.log(`   sysPrompt:    ${CACHE_PROMPT.length} chars`);

  const created = await mgr.create({
    model: CACHE_MODEL,
    displayName: DISPLAY_NAME,
    systemInstruction: { role: 'system', parts: [{ text: CACHE_PROMPT }] },
    ttlSeconds: CACHE_TTL_SECONDS,
  });

  const name = created?.name || created?.cachedContent?.name;
  const expireTime = created?.expireTime || created?.cachedContent?.expireTime;
  console.log('');
  console.log('✅ Cache created.');
  console.log(`   name:         ${name}`);
  console.log(`   expires:      ${fmtExpire(expireTime)}`);
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Paste this into your .env to enable Hot Path in reasoning.js:');
  console.log('');
  console.log(`USE_GEMINI_CACHE=true`);
  console.log(`GEMINI_CACHED_CONTENT_NAME=${name}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

async function cmdList(mgr) {
  console.log('📋 列出所有 active caches...');
  const res = await mgr.list();
  const items = res?.cachedContents || [];
  if (items.length === 0) {
    console.log('   (沒有任何 active cache)');
    return;
  }
  console.log(`   找到 ${items.length} 筆：\n`);
  for (const c of items) {
    console.log(`   • ${c.name}`);
    console.log(`     model:       ${c.model || '(unknown)'}`);
    console.log(`     displayName: ${c.displayName || '(none)'}`);
    console.log(`     expires:     ${fmtExpire(c.expireTime)}`);
    if (c.usageMetadata) {
      console.log(`     totalTokens: ${c.usageMetadata.totalTokenCount || '?'}`);
    }
    console.log('');
  }
}

async function cmdDelete(mgr, name) {
  if (!name) {
    console.error('❌ 用法：node scripts/manageCache.js delete <cachedContents/xxx>');
    process.exit(1);
  }
  console.log(`🗑️  刪除 cache: ${name}`);
  await mgr.delete(name);
  console.log('✅ Deleted.');
}

async function cmdClearAll(mgr) {
  console.log('🧹 清空所有 active caches...');
  const res = await mgr.list();
  const items = res?.cachedContents || [];
  if (items.length === 0) {
    console.log('   (沒有任何 cache 可刪)');
    return;
  }
  console.log(`   找到 ${items.length} 筆，逐一刪除：\n`);
  let ok = 0;
  let fail = 0;
  for (const c of items) {
    try {
      await mgr.delete(c.name);
      console.log(`   ✓ ${c.name}`);
      ok += 1;
    } catch (e) {
      console.log(`   ✗ ${c.name} — ${describeError(e)}`);
      fail += 1;
    }
  }
  console.log(`\n刪除完成：${ok} 成功 / ${fail} 失敗`);
}

// =========================================================================
// Entry
// =========================================================================
async function main() {
  assertApiKey();
  const mgr = new GoogleAICacheManager(API_KEY);

  const [, , cmd, ...rest] = process.argv;
  switch (cmd) {
    case 'create':
      await cmdCreate(mgr);
      break;
    case 'list':
      await cmdList(mgr);
      break;
    case 'delete':
      await cmdDelete(mgr, rest[0]);
      break;
    case 'clear-all':
      await cmdClearAll(mgr);
      break;
    default:
      console.log('Hextech Cache Manager — Gemini Cached Content lifecycle CLI');
      console.log('');
      console.log('Usage:');
      console.log('  node scripts/manageCache.js create');
      console.log('  node scripts/manageCache.js list');
      console.log('  node scripts/manageCache.js delete <cachedContents/abc123>');
      console.log('  node scripts/manageCache.js clear-all');
      console.log('');
      console.log('Or via npm scripts:');
      console.log('  npm run cache:create');
      console.log('  npm run cache:list');
      console.log('  npm run cache:delete -- cachedContents/abc123');
      console.log('  npm run cache:clear');
      console.log('');
      console.log('Env knobs (.env):');
      console.log('  GEMINI_API_KEY              required');
      console.log('  GEMINI_MODEL                runtime model (default gemini-2.0-flash)');
      console.log('  GEMINI_CACHE_MODEL          override cache-only model (default mirrors GEMINI_MODEL or gemini-1.5-flash)');
      console.log('  GEMINI_CACHE_TTL            default 3600 (seconds)');
      console.log('  GEMINI_CACHE_DISPLAY_NAME   default hextech-video-system-prompt');
      process.exit(cmd ? 1 : 0);
  }
}

main().catch((e) => {
  console.error(`❌ Cache 操作失敗：${describeError(e)}`);
  process.exit(2);
});
