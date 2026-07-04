require('dotenv').config();

const { GoogleGenerativeAI } = require('@google/generative-ai');
const { normalizePipelinePayload } = require('./src/schemas/pipelineSchemas');
const { cleanJSONCandidate, extractBalancedJSON } = require('./utils/jsonExtraction');
const { getPipelinePromptForDataType, PROMPTS_BY_DATA_TYPE } = require('./utils/pipelinePrompts');

const LOCKED_MODEL_NAME = 'gemma-4-31b-it';
const MAX_USER_MSG_CHARS = 4000;
const SYSTEM_PROMPT_BASE = PROMPTS_BY_DATA_TYPE.PATCH;

function stringifyCompact(value) {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function buildUserMessage(inputData = {}) {
  const dataType = inputData.dataType || 'PATCH';
  const locale = inputData.locale || 'zh';
  let dataInputs = '';

  if (dataType === 'PATCH' || dataType === 'ITEM_UPDATE' || dataType === 'RUNE_UPDATE') {
    dataInputs = [
      `targetType: ${inputData.targetType || ''}`,
      `targetName: ${inputData.targetName || inputData.itemName || inputData.runeName || inputData.championName || ''}`,
      `localizedName: ${inputData.localizedName || ''}`,
      `iconUrl: ${inputData.iconUrl || ''}`,
      `championName: ${inputData.championName || ''}`,
      `skill: ${inputData.skill || inputData.ability || ''}`,
      `statChange: ${inputData.statChange || inputData.changeDesc || ''}`,
      `itemChanges: ${stringifyCompact(inputData.itemChanges || [])}`,
      `runeChanges: ${stringifyCompact(inputData.runeChanges || [])}`,
    ].join('\n');
  } else if (dataType === 'PRO_BUILD') {
    dataInputs = [
      `proPlayer: ${inputData.proPlayer || ''}`,
      `champion: ${inputData.champion || inputData.championName || ''}`,
      `role: ${inputData.role || ''}`,
      `winRate: ${inputData.winRate || ''}`,
      `items: ${stringifyCompact(inputData.items || [])}`,
      `runes: ${stringifyCompact(inputData.runes || {})}`,
      `tacticalReason: ${inputData.reason || ''}`,
    ].join('\n');
  } else if (dataType === 'TIER_LIST') {
    dataInputs = [
      `role: ${inputData.role || '中路'}`,
      `tierList: ${stringifyCompact(inputData.tierList || [])}`,
    ].join('\n');
  } else if (dataType === 'TFT_INFO') {
    dataInputs = [
      `compName: ${inputData.compName || ''}`,
      `champions: ${stringifyCompact(inputData.champions || [])}`,
      `traits: ${stringifyCompact(inputData.traits || [])}`,
    ].join('\n');
  } else if (dataType === 'ESPORTS_DRAMA') {
    dataInputs = [
      `headline: ${inputData.headline || ''}`,
      `backgroundContext: ${inputData.backgroundContext || inputData.context || ''}`,
      `bullets: ${stringifyCompact(inputData.bullets || [])}`,
    ].join('\n');
  } else if (dataType === 'PLAYER_RADAR') {
    const mc = inputData.matchContext || {};
    dataInputs = [
      `playerName: ${inputData.playerName || inputData.player || ''}`,
      `playerRole: ${inputData.playerRole || inputData.role || ''}`,
      `championPlayed: ${inputData.championPlayed || ''}`,
      `matchContext: league=${mc.league || inputData.league || ''}, ${mc.teamA || inputData.teamA || '?'} vs ${mc.teamB || inputData.teamB || '?'}, ${mc.seriesScore || inputData.seriesScore || ''}`,
      `compareWith: ${inputData.compareWith || '(none)'}`,
      `stats: ${stringifyCompact(inputData.stats || {})}`,
    ].join('\n');
  }

  if (inputData.communityComments) {
    dataInputs += `\n\n[社群留言]\n${stringifyCompact(inputData.communityComments)}`;
  }

  if (dataInputs.length > MAX_USER_MSG_CHARS) {
    const overflow = dataInputs.length - MAX_USER_MSG_CHARS;
    dataInputs = `${dataInputs.slice(0, MAX_USER_MSG_CHARS)}\n\n[... TRUNCATED ${overflow} chars]`;
  }

  return [
    `dataType: ${dataType}`,
    `locale: ${locale}`,
    '',
    '[INPUT DATA]',
    dataInputs,
    '',
    'Output the matching JSON schema from the system prompt.',
  ].join('\n');
}

function stripReasoningInPlace(node, stats = { stripped: 0, sample: '' }) {
  if (Array.isArray(node)) {
    for (const item of node) stripReasoningInPlace(item, stats);
    return stats;
  }
  if (node && typeof node === 'object') {
    if (typeof node._reasoning === 'string') {
      if (!stats.sample) stats.sample = node._reasoning;
      stats.stripped += 1;
      delete node._reasoning;
    }
    for (const key of Object.keys(node)) stripReasoningInPlace(node[key], stats);
  }
  return stats;
}

function inferStatChangesFromStoryboard(parsed) {
  if (Array.isArray(parsed.statChanges) && parsed.statChanges.length > 0) return;
  if (!Array.isArray(parsed.storyboard)) return;

  const targetName = parsed.localizedName || parsed.targetName || parsed.itemName || parsed.runeName || parsed.championName || '';
  const inferred = [];

  for (const scene of parsed.storyboard) {
    if (!Array.isArray(scene?.metrics)) continue;
    for (const metric of scene.metrics) {
      if (metric?.beforeValue === undefined || metric?.afterValue === undefined) continue;
      if (String(metric.beforeValue) === String(metric.afterValue)) continue;
      inferred.push({
        targetName,
        metricName: metric.metricName || scene.statLabel || '核心數值',
        beforeValue: metric.beforeValue,
        afterValue: metric.afterValue,
        trend: metric.trend || scene.trend || 'ADJUST',
        summary: scene.text || '',
      });
    }
  }

  if (inferred.length > 0) parsed.statChanges = inferred.slice(0, 6);
}

function autoBreakLines(text, maxLen = 14) {
  const clean = String(text || '').replace(/\s*\n\s*([？。，！?!,.；：、）」』])/g, '$1').trim();
  if (!clean) return '';
  if (clean.includes('\n')) return clean.split('\n').filter(Boolean).slice(0, 2).join('\n');
  if (clean.length <= maxLen) return `${clean}\n重點看這裡`;

  const breakPoints = ['，', '。', '！', '？', '、', '；', '：', ' '];
  let splitAt = -1;
  for (let i = Math.min(maxLen, clean.length - 1); i >= Math.floor(maxLen * 0.45); i -= 1) {
    if (breakPoints.includes(clean[i])) {
      splitAt = i + 1;
      break;
    }
  }
  if (splitAt < 0) splitAt = Math.min(maxLen, Math.ceil(clean.length / 2));
  return `${clean.slice(0, splitAt).trim()}\n${clean.slice(splitAt, splitAt + maxLen).trim()}`;
}

function normalizeStoryboardText(parsed, locale) {
  if (!Array.isArray(parsed.storyboard)) return;
  const bannedNames = ['吞噬老而', '莉莉安', '塔姆肯琦', '大嘴王'];

  parsed.storyboard = parsed.storyboard.map((scene, index) => {
    const next = { ...scene };
    const text = next.text || '';
    if (locale === 'zh') {
      for (const bad of bannedNames) {
        if (text.includes(bad)) {
          throw new Error(`[審查失敗] 分鏡 ${index} 包含禁用譯名「${bad}」`);
        }
      }
    }
    next.text = autoBreakLines(text, locale === 'zh' ? 14 : 30);
    return next;
  });
}

function backfillRequiredFields(parsed, inputData, dataType, locale) {
  parsed.dataType = parsed.dataType || dataType;
  parsed.locale = parsed.locale || locale;

  if (dataType === 'PATCH' || dataType === 'ITEM_UPDATE' || dataType === 'RUNE_UPDATE') {
    const validChangeTypes = new Set(['BUFF', 'NERF', 'ADJUST', 'REWORK']);
    const inferred = parsed.changeType || parsed.overallTrend || parsed.trend || 'ADJUST';
    parsed.changeType = validChangeTypes.has(inferred) ? inferred : 'ADJUST';
    parsed.overallTrend = parsed.overallTrend || parsed.changeType;
  }

  const passthroughKeys = [
    'championName',
    'targetType',
    'targetName',
    'localizedName',
    'iconUrl',
    'proPlayer',
    'compName',
    'headline',
    'role',
    'skill',
    'videoBackgroundUrl',
    'heroImageUrl',
    'splashUrl',
    'skillIconUrl',
  ];
  for (const key of passthroughKeys) {
    if (inputData[key] && !parsed[key]) parsed[key] = inputData[key];
  }

  parsed.skillIcons = parsed.skillIcons || inputData.skillIcons || {};

  if (Array.isArray(inputData.players) && !Array.isArray(parsed.players)) parsed.players = inputData.players;
  if (Array.isArray(inputData.tierList) && !Array.isArray(parsed.tierList)) parsed.tierList = inputData.tierList;

  if (dataType === 'PLAYER_RADAR') {
    if (inputData.playerName && !parsed.player) {
      parsed.player = { name: inputData.playerName, role: inputData.role || inputData.playerRole || 'Mid', championPlayed: inputData.championPlayed || '' };
    }
    if (!parsed.matchContext && (inputData.matchContext || inputData.league || inputData.teamA)) {
      parsed.matchContext = inputData.matchContext || {
        league: inputData.league || 'LCK',
        teamA: inputData.teamA || '',
        teamB: inputData.teamB || '',
        seriesScore: inputData.seriesScore || '',
      };
    }
    if (!Array.isArray(parsed.radarStats) && inputData.stats && typeof inputData.stats === 'object') {
      const labels = ['KDA', 'DPM', 'KP%', 'Vision', 'Gold'];
      parsed.radarStats = Object.keys(inputData.stats).slice(0, 5).map((key, index) => ({
        label: labels[index] || key.toUpperCase(),
        rawValue: String(inputData.stats[key]),
        normalizedScore: Math.max(0, Math.min(100, Number(inputData.stats[key]) || 0)),
      }));
    }
  }

  if (!parsed.subtitleScriptText && Array.isArray(parsed.storyboard)) {
    parsed.subtitleScriptText = parsed.storyboard.map((scene) => scene.text).join('');
  }
}

async function analyzeChange(inputData = {}) {
  const locale = inputData.locale || 'zh';
  const dataType = inputData.dataType || 'PATCH';
  const target = inputData.championName || inputData.proPlayer || inputData.compName || inputData.headline || inputData.playerName || inputData.role || inputData.targetName || '?';
  console.log(`🧠 [AI] dataType=${dataType} locale=${locale} target=${target}`);

  if (!process.env.GEMINI_API_KEY) {
    throw new Error('尚未設置 GEMINI_API_KEY');
  }

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: LOCKED_MODEL_NAME });
  const systemPrompt = getPipelinePromptForDataType(dataType);
  const userMessage = buildUserMessage(inputData);
  const promptToSend = `${systemPrompt}\n\n=== USER REQUEST ===\n${userMessage}`;

  console.log(`📦 [Prompt] model=${LOCKED_MODEL_NAME} dataType=${dataType} system=${systemPrompt.length} chars user=${userMessage.length} chars total=${promptToSend.length} chars`);

  const maxRetries = Number(process.env.GEMMA_31B_MAX_RETRIES || 2);
  const modelTimeoutMs = Number(process.env.GEMINI_MODEL_TIMEOUT_MS || 60000);
  let rawText = '';
  let lastAIError = null;

  const generateWithTimeout = () => Promise.race([
    model.generateContent(promptToSend),
    new Promise((_, reject) => setTimeout(() => reject(new Error(`MODEL_TIMEOUT after ${modelTimeoutMs}ms`)), modelTimeoutMs)),
  ]);

  for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
    try {
      const result = await generateWithTimeout();
      rawText = result.response.text();
      if (rawText && rawText.trim()) break;
      lastAIError = new Error('Gemma returned empty text');
    } catch (error) {
      lastAIError = error;
      console.warn(`⚠️ [Gemma Attempt ${attempt}/${maxRetries}] ${error.message}`);
    }
  }

  if (!rawText && lastAIError) throw lastAIError;

  const jsonStr = cleanJSONCandidate(extractBalancedJSON(rawText));
  if (!jsonStr) {
    console.error('❌ [AI RAW DEBUG]:', rawText);
    throw new Error('模型回傳內容不包含有效的 JSON 結構');
  }

  let parsed;
  try {
    parsed = JSON.parse(jsonStr);
  } catch (error) {
    console.error('❌ [JSON Parse Error]:', error.message);
    console.error('❌ [Faulty JSON]:', jsonStr);
    throw error;
  }

  const reasoningStats = stripReasoningInPlace(parsed);
  if (reasoningStats.stripped > 0) {
    console.log(`🧹 [CoT Cleanup] stripped ${reasoningStats.stripped} _reasoning fields`);
  }

  inferStatChangesFromStoryboard(parsed);
  backfillRequiredFields(parsed, inputData, dataType, locale);
  normalizeStoryboardText(parsed, locale);

  const normalized = normalizePipelinePayload(parsed);
  if (normalized.issues.length > 0) {
    console.warn(`⚠️ [Schema Contract] ${dataType}: ${normalized.issues.map((issue) => `${issue.path.join('.') || '(root)'}:${issue.message}`).slice(0, 4).join(' | ')}`);
  }

  return normalized.data;
}

module.exports = {
  analyzeChange,
  SYSTEM_PROMPT_BASE,
  buildUserMessage,
  MAX_USER_MSG_CHARS,
};
