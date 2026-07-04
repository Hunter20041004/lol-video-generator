import { NextResponse } from 'next/server';
const { getVisualAsset } = require('../../../fetchAsset');
const { analyzeChange } = require('../../../reasoning');
const { getChampionTWName, getItemTWName, getRuneTWName, getItemIconUrl, getRuneIconUrl } = require('../../../utils/riotLocalization');
const { splitDenseSkillScenes } = require('../../../utils/patchStoryboard');
const { validateAnalyzeRequest } = require('../../../utils/apiGuards');

// =========================================================================
// 嚴格輸入過濾：dataType 對應的白名單欄位 + 大欄位截斷
// 「精準上下文 > 全文塞給 LLM」原則 — 防止前端誤傳整份 patch HTML / 全英雄
// 字典 / 整個 cache_meta.json blob，無聲多燒掉幾千 token。
// 同時亦避免外部 caller 把不相關的 PII / debug payload 偷渡進 LLM context。
// =========================================================================
const ALLOWED_FIELDS_BY_TYPE = {
  PATCH:         ['dataType', 'targetType', 'entityType', 'category', 'championName', 'itemName', 'runeName', 'targetName', 'ability', 'changeDesc', 'itemChanges', 'runeChanges', 'communityComments', 'locale'],
  SYSTEM_UPDATE: ['dataType', 'targetType', 'targetName', 'localizedName', 'headline', 'sectionTitle', 'systemType', 'changeDesc', 'statChanges', 'subtopics', 'affectedRoles', 'communityComments', 'locale'],
  PLAYER_RADAR:  ['dataType', 'playerName', 'player', 'playerRole', 'matchContext', 'compareWith', 'stats', 'locale'],
  ITEM_UPDATE:   ['dataType', 'targetType', 'itemName', 'targetName', 'ability', 'changeDesc', 'itemChanges', 'communityComments', 'locale'],
  RUNE_UPDATE:   ['dataType', 'targetType', 'runeName', 'targetName', 'ability', 'changeDesc', 'runeChanges', 'communityComments', 'locale'],
};

// 標準（嚴格）quota
const STRICT_STRING_LIMIT = 2000;
const STRICT_ARRAY_LIMIT = 25;
// Rework override quota：大型重做 / Mini-rework 的 patch notes 通常需要更多上下文（多技能改寫、被動重設、新增段落）
const REWORK_STRING_LIMIT = 6000;
const REWORK_ARRAY_LIMIT = 50;
// 觸發放寬的關鍵字（整份 raw body 序列化後做 regex 偵測，i flag 容大小寫）
const REWORK_TRIGGER_REGEX = /重製|重做|大型更新|大改|Rework|Mini[- ]?rework|Overhaul|Reworked|Major\s+Update/i;

function clampStringDeep(v, stringLimit, arrayLimit) {
  if (typeof v === 'string') {
    return v.length > stringLimit
      ? v.slice(0, stringLimit) + `…[clipped ${v.length - stringLimit}]`
      : v;
  }
  if (Array.isArray(v)) {
    const trimmed = v.length > arrayLimit ? v.slice(0, arrayLimit) : v;
    return trimmed.map((x) => clampStringDeep(x, stringLimit, arrayLimit));
  }
  if (v && typeof v === 'object') {
    return Object.fromEntries(
      Object.entries(v).map(([k, vv]) => [k, clampStringDeep(vv, stringLimit, arrayLimit)])
    );
  }
  return v;
}

function slimRequestBody(rawBody) {
  const dataType = rawBody.dataType || 'PATCH';
  const allowed = ALLOWED_FIELDS_BY_TYPE[dataType] || ALLOWED_FIELDS_BY_TYPE.PATCH;

  // ---- Dynamic quota：序列化整個 body 一次，掃 rework 關鍵字 ----
  // 用整份 rawBody 而非只看白名單欄位 — 重做的線索常落在 changeDesc、ability、reason 之外的補充欄位上。
  const rawSerialized = JSON.stringify(rawBody);
  const isRework = REWORK_TRIGGER_REGEX.test(rawSerialized);
  const stringLimit = isRework ? REWORK_STRING_LIMIT : STRICT_STRING_LIMIT;
  const arrayLimit = isRework ? REWORK_ARRAY_LIMIT : STRICT_ARRAY_LIMIT;

  const slimmed = {};
  for (const k of allowed) {
    if (rawBody[k] !== undefined) slimmed[k] = clampStringDeep(rawBody[k], stringLimit, arrayLimit);
  }

  // 量化日誌：過濾前後 byte size + 是否觸發 Rework Override
  const beforeBytes = Buffer.byteLength(rawSerialized, 'utf8');
  const afterBytes = Buffer.byteLength(JSON.stringify(slimmed), 'utf8');
  if (isRework) {
    console.log(`⚠️  [Rework Override] 偵測到 rework 關鍵字 → 放寬 quota (string=${stringLimit}, array=${arrayLimit})`);
  }
  console.log(`🔪 [Token Saver] dataType=${dataType} body slim: ${beforeBytes}B → ${afterBytes}B (${beforeBytes - afterBytes}B trimmed) | quota=${isRework ? 'REWORK' : 'STRICT'}`);
  return slimmed;
}

function parseNumericValue(value) {
  const match = String(value || '').match(/-?\d+(?:\.\d+)?/);
  const n = match ? Number(match[0]) : NaN;
  return Number.isFinite(n) ? n : null;
}

function inferMetricTrend(metricName, beforeValue, afterValue) {
  const before = parseNumericValue(beforeValue);
  const after = parseNumericValue(afterValue);
  if (before === null || after === null || before === after) return 'ADJUST';

  const key = String(metricName || '').toLowerCase();
  const negativeStat = /cooldown|cd|冷卻|mana cost|魔力|耗魔|cast time|前搖|recharge|充能|cost|價格|受到傷害|self slow|自我減速/.test(key);
  if (negativeStat) return after < before ? 'BUFF' : 'NERF';
  return after > before ? 'BUFF' : 'NERF';
}

const PATCH_METRIC_TW_MAP = {
  'base ad': '基礎攻擊力',
  'base attack damage': '基礎攻擊力',
  'attack damage': '攻擊力',
  ad: '攻擊力',
  'bonus ad': '額外攻擊力',
  ap: '魔法攻擊',
  'ability power': '魔法攻擊',
  damage: '傷害',
  'base damage': '基礎傷害',
  'bonus damage': '額外傷害',
  'magic damage': '魔法傷害',
  'physical damage': '物理傷害',
  'total damage': '總傷害',
  'crit increase': '暴擊收益',
  'critical strike': '暴擊收益',
  'critical strike chance': '暴擊率',
  'crit chance': '暴擊率',
  'crit damage': '暴擊傷害',
  cooldown: '冷卻時間',
  cd: '冷卻時間',
  'mana cost': '魔力消耗',
  cost: '消耗 / 成本',
  'cast time': '施放前搖',
  range: '距離 / 範圍',
  radius: '範圍半徑',
  duration: '持續時間',
  slow: '緩速效果',
  shield: '護盾值',
  heal: '治療量',
  healing: '治療量',
  health: '生命值',
  armor: '物理防禦',
  'magic resist': '魔法防禦',
  movement: '移動速度',
  'movement speed': '移動速度',
  'attack speed': '攻擊速度',
  'omnivamp': '全能吸血',
  'omnivamp per stack': '每層全能吸血',
  'max stacks': '最大層數',
  'total cost': '總價格',
};

const PATCH_METRIC_EN_MAP = Object.fromEntries(
  Object.entries(PATCH_METRIC_TW_MAP).map(([english, traditional]) => [traditional, english.replace(/\b\w/g, (c) => c.toUpperCase())])
);

const PATCH_TERM_REPLACEMENTS = [
  [/\bInfinity Edge\b/gi, '無盡之刃'],
  [/\bImmortal Shieldbow\b/gi, '不朽盾弓'],
  [/\bKraken Slayer\b/gi, '海妖殺手'],
  [/\bDoran'?s Blade\b/gi, '多蘭之劍'],
  [/\bDoran'?s Bow\b/gi, '多蘭之弓'],
  [/\bBase AD\b/gi, '基礎攻擊力'],
  [/\bAttack Damage\b/gi, '攻擊力'],
  [/\bAttack Speed\b/gi, '攻擊速度'],
  [/\bAbility Power\b/gi, '魔法攻擊'],
  [/\bBonus AD\b/gi, '額外攻擊力'],
  [/\bMagic Damage\b/gi, '魔法傷害'],
  [/\bPhysical Damage\b/gi, '物理傷害'],
  [/\bTotal Damage\b/gi, '總傷害'],
  [/\bCrit Increase\b/gi, '暴擊收益'],
  [/\bCritical Strike Chance\b/gi, '暴擊率'],
  [/\bCritical Strike\b/gi, '暴擊收益'],
  [/\bCrit Damage\b/gi, '暴擊傷害'],
  [/\bCooldown\b/gi, '冷卻時間'],
  [/\bMana Cost\b/gi, '魔力消耗'],
  [/\bCast Time\b/gi, '施放前搖'],
  [/\bRange\b/gi, '距離 / 範圍'],
  [/\bRadius\b/gi, '範圍半徑'],
  [/\bDuration\b/gi, '持續時間'],
  [/\bSlow\b/gi, '緩速效果'],
  [/\bShield\b/gi, '護盾值'],
  [/\bHeal(?:ing)?\b/gi, '治療量'],
  [/\bOmnivamp Per Stack\b/gi, '每層全能吸血'],
  [/\bMax Stacks\b/gi, '最大層數'],
  [/\bTotal Cost\b/gi, '總價格'],
  [/\bfrom\b/gi, '來自'],
  [/\bper\b/gi, '每'],
];

const PATCH_TERM_REPLACEMENTS_EN = [
  [/無盡之刃/g, 'Infinity Edge'],
  [/不朽盾弓/g, 'Immortal Shieldbow'],
  [/海妖殺手/g, 'Kraken Slayer'],
  [/多蘭之劍/g, "Doran's Blade"],
  [/多蘭之弓/g, "Doran's Bow"],
  [/基礎攻擊力/g, 'Base AD'],
  [/額外攻擊力/g, 'Bonus AD'],
  [/攻擊力/g, 'Attack Damage'],
  [/攻擊速度/g, 'Attack Speed'],
  [/魔法攻擊/g, 'Ability Power'],
  [/魔法傷害/g, 'Magic Damage'],
  [/物理傷害/g, 'Physical Damage'],
  [/總傷害/g, 'Total Damage'],
  [/暴擊收益/g, 'Crit Increase'],
  [/暴擊率/g, 'Crit Chance'],
  [/暴擊傷害/g, 'Crit Damage'],
  [/冷卻時間/g, 'Cooldown'],
  [/魔力消耗/g, 'Mana Cost'],
  [/施放前搖/g, 'Cast Time'],
  [/距離 \/ 範圍/g, 'Range'],
  [/範圍半徑/g, 'Radius'],
  [/持續時間/g, 'Duration'],
  [/緩速效果/g, 'Slow'],
  [/護盾值/g, 'Shield'],
  [/治療量/g, 'Healing'],
  [/每層全能吸血/g, 'Omnivamp Per Stack'],
  [/最大層數/g, 'Max Stacks'],
  [/總價格/g, 'Total Cost'],
  [/來自/g, 'from'],
];

function isEnglishLocale(locale = 'zh') {
  return String(locale || 'zh').toLowerCase().startsWith('en');
}

function normalizeMetricKey(name = '') {
  return String(name || '')
    .replace(/[【】[\]]/g, ' ')
    .replace(/^[PQWER]\s*[-:：]\s*/i, '')
    .replace(/[_/()-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function localizePatchMetricName(name = '', locale = 'zh') {
  const raw = String(name || '').replace(/[【】[\]\n]/g, ' ').trim();
  if (isEnglishLocale(locale)) {
    const normalized = normalizeMetricKey(raw);
    if (PATCH_METRIC_TW_MAP[normalized]) return raw.replace(/\b\w/g, (c) => c.toUpperCase());
    if (PATCH_METRIC_EN_MAP[raw]) return PATCH_METRIC_EN_MAP[raw];
    return localizePatchPhrase(raw, locale) || 'Core Stat';
  }

  const normalized = normalizeMetricKey(raw);
  if (PATCH_METRIC_TW_MAP[normalized]) return PATCH_METRIC_TW_MAP[normalized];

  const key = Object.keys(PATCH_METRIC_TW_MAP)
    .sort((a, b) => b.length - a.length)
    .find((candidate) => normalized === candidate || normalized.endsWith(` ${candidate}`) || normalized.includes(candidate));

  if (key) return PATCH_METRIC_TW_MAP[key];
  return localizePatchPhrase(raw) || '核心數值';
}

function localizePatchPhrase(value = '', locale = 'zh') {
  let next = String(value || '').trim();
  if (isEnglishLocale(locale)) {
    for (const [pattern, replacement] of PATCH_TERM_REPLACEMENTS_EN) {
      next = next.replace(pattern, replacement);
    }
    return next
      .replace(/（([^）]*)）/g, '($1)')
      .replace(/\s+/g, ' ')
      .trim();
  }

  for (const [pattern, replacement] of PATCH_TERM_REPLACEMENTS) {
    next = next.replace(pattern, replacement);
  }
  return next
    .replace(/\(([^)]*)\)/g, '（$1）')
    .replace(/\s*([＋+\-−]\d)/g, ' $1')
    .replace(/\s+/g, ' ')
    .replace(/\s*（\s*/g, '（')
    .replace(/\s*）\s*/g, '）')
    .trim();
}

function cleanPatchLine(line = '') {
  return String(line || '')
    .replace(/^[\s•*\-–—]+/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function splitPatchLines(text = '') {
  return String(text || '')
    .split(/\n+/)
    .flatMap((line) => line.split(/(?:^|\s)[•*]\s+/))
    .map(cleanPatchLine)
    .filter(Boolean);
}

function trimDiffValue(value = '', locale = 'zh') {
  return localizePatchPhrase(String(value || '')
    .replace(/\s+(?:and|與)\s+$/i, '')
    .replace(/[。；;]\s*$/g, '')
    .trim(), locale);
}

function parsePatchDiffLine(line = '', locale = 'zh') {
  const cleaned = cleanPatchLine(line);
  const arrowMatch = cleaned.match(/^(.+?)\s*(?:⇒|→|->|>>>|=>|\bto\b)\s*(.+)$/i);
  if (!arrowMatch) return null;

  const left = arrowMatch[1].trim();
  const right = arrowMatch[2].trim();
  const colonIndex = Math.max(left.lastIndexOf(':'), left.lastIndexOf('：'));
  let metricName = isEnglishLocale(locale) ? 'Core Stat' : '核心數值';
  let beforeValue = left;

  if (colonIndex >= 0) {
    metricName = left.slice(0, colonIndex).trim();
    beforeValue = left.slice(colonIndex + 1).trim();
  } else {
    const valueMatch = left.match(/^(.*?)(-?\d+(?:\.\d+)?%?(?:\s*\([^)]*\))?)$/);
    if (valueMatch) {
      metricName = valueMatch[1].trim() || metricName;
      beforeValue = valueMatch[2].trim();
    }
  }

  const localizedName = localizePatchMetricName(metricName, locale);
  const before = trimDiffValue(beforeValue, locale);
  const after = trimDiffValue(right, locale);
  if (!before || !after) return null;

  const trend = inferMetricTrend(localizedName, before, after);
  return {
    metricName: localizedName,
    beforeValue: before,
    afterValue: after,
    trend,
    summary: buildMetricImpactSummary(localizedName, trend, locale),
  };
}

function buildMetricImpactSummary(metricName = '', trend = 'ADJUST', locale = 'zh') {
  const text = String(metricName || '');
  if (isEnglishLocale(locale)) {
    const direction = trend === 'BUFF' ? 'increased' : trend === 'NERF' ? 'decreased' : 'adjusted';
    if (/crit|damage|attack|ability power|ratio/i.test(text)) return `${text} ${direction}, directly changing burst and kill thresholds.`;
    if (/cooldown|mana|cost|cast time/i.test(text)) return `${text} ${direction}, changing combo rhythm and cast windows.`;
    if (/shield|heal|health|armor|resist|omnivamp/i.test(text)) return `${text} ${direction}, changing trade durability and engage margin.`;
    if (/range|radius|slow|duration/i.test(text)) return `${text} ${direction}, forcing players to reassess spacing and engage timing.`;
    return `${text} ${direction}; this is the main evidence behind the verdict.`;
  }

  const direction = trend === 'BUFF' ? '上修' : trend === 'NERF' ? '下修' : '調整';
  if (/暴擊|傷害|攻擊力|魔法攻擊|係數/.test(text)) return `${text}${direction}，爆發與斬殺線會直接改變。`;
  if (/冷卻|魔力|消耗|成本|施放前搖/.test(text)) return `${text}${direction}，連招節奏與出手窗口會改變。`;
  if (/護盾|治療|生命|防禦|魔法防禦|吸血/.test(text)) return `${text}${direction}，換血與進退場容錯會改變。`;
  if (/距離|範圍|緩速|持續/.test(text)) return `${text}${direction}，留人、拉扯與進場判斷要重估。`;
  return `${text}${direction}，這就是實戰結論的主要依據。`;
}

function inferSkillKey(ability = '') {
  const text = String(ability || '').toUpperCase();
  if (text.includes('PASSIVE') || text.includes('被動')) return 'P';
  const match = text.match(/\b([QWER])\b|(^|[^A-Z])([QWER])([^A-Z]|$)/);
  return match?.[1] || match?.[3] || 'BASE';
}

function splitPatchChangeSections(input = {}) {
  const changeDesc = String(input.changeDesc || input.statChange || '').trim();
  if (!changeDesc) return [];

  const sections = [];
  const sectionPattern = /【([^】]+)】[：:]\s*([\s\S]*?)(?=\n{2,}【|$)/g;
  let match;
  while ((match = sectionPattern.exec(changeDesc)) && sections.length < 4) {
    const ability = match[1].trim();
    const desc = match[2].trim();
    if (ability && desc) {
      sections.push({
        ability,
        skillKey: inferSkillKey(ability),
        changeDesc: desc,
      });
    }
  }

  if (sections.length === 0 && changeDesc) {
    sections.push({
      ability: input.ability || input.skill || 'BASE',
      skillKey: inferSkillKey(input.ability || input.skill || 'BASE'),
      changeDesc,
    });
  }

  return sections;
}

function extractMetricsFromText(changeDesc = '', locale = 'zh') {
  const text = String(changeDesc || '');
  const detailedMetrics = splitPatchLines(text)
    .map((line) => parsePatchDiffLine(line, locale))
    .filter(Boolean)
    .slice(0, 8);
  if (detailedMetrics.length > 0) return detailedMetrics;

  const metrics = [];
  const pattern = /([A-Za-z\u4e00-\u9fff%/()（）\s+\-]{1,40}?)[:：]?\s*(-?\d+(?:\.\d+)?%?)\s*(?:⇒|→|->|>>>|=>| to )\s*(-?\d+(?:\.\d+)?%?)/gi;
  let match;

  while ((match = pattern.exec(text)) && metrics.length < 8) {
    const metricName = localizePatchMetricName(match[1].replace(/[【】\[\]\n]/g, ' ').trim() || (isEnglishLocale(locale) ? 'Core Stat' : '核心數值'), locale);
    const beforeValue = trimDiffValue(match[2], locale);
    const afterValue = trimDiffValue(match[3], locale);
    const trend = inferMetricTrend(metricName, beforeValue, afterValue);
    metrics.push({
      metricName,
      beforeValue,
      afterValue,
      trend,
      summary: buildMetricImpactSummary(metricName, trend, locale),
    });
  }

  return metrics;
}

function aggregateChangeType(metrics, changeDesc = '') {
  const buffCount = metrics.filter((m) => m.trend === 'BUFF').length;
  const nerfCount = metrics.filter((m) => m.trend === 'NERF').length;
  if (buffCount > 0 && nerfCount > 0) return 'ADJUST';
  if (buffCount > nerfCount) return 'BUFF';
  if (nerfCount > buffCount) return 'NERF';

  const text = String(changeDesc || '');
  if (/rework|重製|重做|機制/i.test(text)) return 'REWORK';
  if (/nerf|削弱|降低|減少/i.test(text)) return 'NERF';
  if (/buff|增強|提升|增加/i.test(text)) return 'BUFF';
  return 'ADJUST';
}

function skillLabel(skillKey, locale = 'zh') {
  const labels = isEnglishLocale(locale) ? {
    P: 'Passive',
    Q: 'Q Ability',
    W: 'W Ability',
    E: 'E Ability',
    R: 'Ultimate',
    BASE: 'Base Stats',
  } : {
    P: '被動',
    Q: 'Q 技能',
    W: 'W 技能',
    E: 'E 技能',
    R: 'R 大絕',
    BASE: '基礎數值',
  };
  return labels[skillKey] || (isEnglishLocale(locale) ? `${skillKey} Ability` : `${skillKey} 技能`);
}

function compactPatchSentence(text, fallback, max = 44, locale = 'zh') {
  const cleaned = localizePatchPhrase(text, locale)
    .replace(/\s+/g, ' ')
    .replace(/^[•*-]\s*/, '')
    .trim();
  if (!cleaned) return fallback;
  return cleaned.length > max ? `${cleaned.slice(0, max)}…` : cleaned;
}

function splitPatchBullets(text = '', locale = 'zh') {
  const lines = splitPatchLines(text);
  const parsed = lines
    .map((line) => parsePatchDiffLine(line, locale))
    .filter(Boolean)
    .map((metric) => `${metric.metricName}${isEnglishLocale(locale) ? ': ' : '：'}${metric.beforeValue} → ${metric.afterValue}`);

  if (parsed.length > 0) return parsed.slice(0, 8);

  return lines
    .map((line) => compactPatchSentence(line, '', 72, locale))
    .filter(Boolean)
    .slice(0, 8);
}

function inferPatchTags(text = '', locale = 'zh') {
  const value = String(text || '').toLowerCase();
  const tags = [];
  const en = isEnglishLocale(locale);
  if (/cooldown|cd|冷卻|recast|再次施放/i.test(value)) tags.push(en ? 'Cooldown Window' : '冷卻窗口');
  if (/damage|傷害|ratio|係數|scaling/i.test(value)) tags.push(en ? 'Damage Curve' : '傷害曲線');
  if (/shield|護盾|heal|治療/i.test(value)) tags.push(en ? 'Durability' : '生存能力');
  if (/cost|mana|魔力|耗魔/i.test(value)) tags.push(en ? 'Resource Cost' : '資源成本');
  if (/range|距離|radius|範圍/i.test(value)) tags.push(en ? 'Spacing' : '距離判斷');
  if (/slow|stun|knock|cc|控場|緩速/i.test(value)) tags.push(en ? 'Crowd Control' : '控場效果');
  return tags.length > 0 ? tags.slice(0, 4) : (en ? ['Patch Detail', 'Combat Window', 'Ranked Test'] : ['改動細節', '實戰窗口', '排位實測']);
}

function buildMechanicChangeFromSection(section, sceneTrend, locale = 'zh') {
  const en = isEnglishLocale(locale);
  const label = skillLabel(section.skillKey, locale);
  const bullets = splitPatchBullets(section.changeDesc, locale);
  const summary = compactPatchSentence(
    bullets[0] || section.changeDesc,
    en ? `Check the exact ${label} wording before judging the patch.` : `${label} 的實際改動需要回到技能描述確認。`,
    58,
    locale,
  );

  return {
    title: en ? `What Changed in ${label}` : `${label}改了哪裡`,
    changeSummary: summary,
    changeBullets: bullets.length > 0 ? bullets : [summary],
    beforeBehavior: bullets[0]
      ? (en ? `${label} before: ${bullets[0].split('→')[0].trim()}` : `${label} 原始版本：${bullets[0].split('→')[0].trim()}`)
      : (en ? 'The old version followed the previous skill rhythm.' : '舊版技能規則照原本節奏運作。'),
    afterBehavior: summary,
    affectedCombos: inferPatchTags(section.changeDesc, locale),
    proImpact: sceneTrend === 'BUFF'
      ? (en ? `${label} is buffed, making its lane or fight window easier to convert.` : `${label} 上修後，對線或團戰窗口會更容易打出價值。`)
      : sceneTrend === 'NERF'
        ? (en ? `${label} is nerfed, so kill thresholds and engage margin need a reset.` : `${label} 下修後，斬殺線、換血或進場容錯要重新估。`)
        : (en ? `${label} is not a simple buff or nerf; the new usage window matters.` : `${label} 不是單純增弱，重點是新版本的使用窗口。`),
    cards: (bullets.length > 0 ? bullets : [summary]).slice(0, 3).map((body, index) => ({
      title: en ? `Change ${index + 1}` : `改動 ${index + 1}`,
      body,
    })),
  };
}

function buildRawPatchScene(section, fallbackChangeType = 'ADJUST', locale = 'zh') {
  const en = isEnglishLocale(locale);
  const metrics = extractMetricsFromText(section.changeDesc, locale);
  const sceneTrend = metrics.length > 0 ? aggregateChangeType(metrics, section.changeDesc) : fallbackChangeType;
  const label = skillLabel(section.skillKey, locale);

  if (metrics.length > 0) {
    return {
      tag: 'SKILL_SHOWCASE',
      skillKey: section.skillKey,
      text: en ? `${label} changed\nHere is the evidence` : `${label} 改了哪裡\n這段一定要看懂`,
      impactText: sceneTrend === 'BUFF'
        ? (en ? `${label} is buffed, opening earlier tempo windows.` : `${label} 上修，實戰節奏有機會提前。`)
        : sceneTrend === 'NERF'
          ? (en ? `${label} is nerfed, affecting kill pressure or margin for error.` : `${label} 下修，斬殺線或容錯會受影響。`)
          : (en ? `${label} is mixed; the play window needs retesting.` : `${label} 混合調整，打法窗口要重測。`),
      metrics,
      trend: sceneTrend,
      rawChangeDesc: section.changeDesc,
      changeBullets: splitPatchBullets(section.changeDesc, locale),
      durationInFrames: 152,
    };
  }

  return {
    tag: 'MECHANIC_EXPLAINER',
    skillKey: section.skillKey,
    text: en ? `${label} changed\nRead the exact rule` : `${label} 改了哪裡\n先看實際內容`,
    trend: sceneTrend,
    rawChangeDesc: section.changeDesc,
    changeBullets: splitPatchBullets(section.changeDesc, locale),
    durationInFrames: 178,
    mechanicChange: buildMechanicChangeFromSection(section, sceneTrend, locale),
  };
}

function mergeRawPatchScene(existingScene = {}, rawScene = {}) {
  if (!rawScene || !rawScene.skillKey) return existingScene;
  const keepAssets = {
    iconUrl: existingScene.iconUrl,
    skillIconUrl: existingScene.skillIconUrl,
  };

  if (rawScene.tag === 'SKILL_SHOWCASE') {
    return {
      ...existingScene,
      ...rawScene,
      ...Object.fromEntries(Object.entries(keepAssets).filter(([, value]) => value)),
      text: rawScene.text || existingScene.text,
      metrics: rawScene.metrics,
      impactText: existingScene.impactText || rawScene.impactText,
    };
  }

  return {
    ...existingScene,
    ...rawScene,
    ...Object.fromEntries(Object.entries(keepAssets).filter(([, value]) => value)),
    text: rawScene.text || existingScene.text,
    mechanicChange: {
      ...(existingScene.mechanicChange || {}),
      ...(rawScene.mechanicChange || {}),
    },
  };
}

function segmentDensePatchStoryboard(payload = {}, locale = 'zh') {
  if (!payload || payload.dataType !== 'PATCH' || !Array.isArray(payload.storyboard)) return payload;
  return {
    ...payload,
    storyboard: splitDenseSkillScenes(payload.storyboard, {
      locale,
      maxMetricsPerScene: 2,
    }),
  };
}

function ensureAllPatchChangesVisible(payload = {}, input = {}) {
  if ((payload.dataType || input.dataType || 'PATCH') !== 'PATCH') return payload;
  const locale = payload.locale || input.locale || 'zh';
  const en = isEnglishLocale(locale);

  const sections = splitPatchChangeSections(input);
  if (sections.length === 0) return segmentDensePatchStoryboard(payload, locale);

  const rawScenes = sections.map((section) => buildRawPatchScene(section, payload.changeType || 'ADJUST', locale));
  const rawSceneBySkill = new Map(rawScenes.map((scene) => [scene.skillKey, scene]));
  const rawMetrics = rawScenes.flatMap((scene) => Array.isArray(scene.metrics) ? scene.metrics : []);
  const rawChangeType = rawMetrics.length > 0
    ? aggregateChangeType(rawMetrics, input.changeDesc || input.statChange || '')
    : (payload.changeType || 'ADJUST');

  const existing = Array.isArray(payload.storyboard) ? payload.storyboard : [];
  const enrichedExisting = existing.map((scene) => {
    if (!['SKILL_SHOWCASE', 'STAT_REVEAL', 'MECHANIC_EXPLAINER'].includes(scene.tag)) return scene;
    return mergeRawPatchScene(scene, rawSceneBySkill.get(scene.skillKey));
  });
  const existingSkillScenes = existing.filter((scene) => ['SKILL_SHOWCASE', 'STAT_REVEAL', 'MECHANIC_EXPLAINER'].includes(scene.tag));
  const existingMetricCount = existingSkillScenes.reduce((sum, scene) => sum + (Array.isArray(scene.metrics) ? scene.metrics.length : 0), 0);
  const expectedVisualCount = rawMetrics.length > 0 ? Math.min(rawMetrics.length, 8) : Math.min(sections.length, 6);
  const currentVisualCount = existingMetricCount > 0 ? existingMetricCount : existingSkillScenes.length;
  const needsRawRepair = currentVisualCount < expectedVisualCount || existingSkillScenes.length < Math.min(sections.length, 4);

  const next = {
    ...payload,
    changeSections: sections,
    changeCount: Math.max(payload.changeCount || 0, sections.length, rawMetrics.length),
    changeType: rawChangeType,
    overallTrend: rawChangeType,
    storyboard: needsRawRepair ? enrichedExisting : existing,
  };

  if (!needsRawRepair) return segmentDensePatchStoryboard(next, locale);

  const hook = enrichedExisting.find((scene) => scene.tag === 'HOOK') || {
    tag: 'HOOK',
    text: en
      ? `${input.championName || payload.championName || 'Patch Target'} Update\n${rawChangeType}`
      : `${input.championName || payload.championName || '版本英雄'} 版本改動\n${rawChangeType}`,
    durationInFrames: 108,
  };
  const social = enrichedExisting.find((scene) => scene.tag === 'COMMUNITY_BUZZ');
  const verdict = enrichedExisting.find((scene) => ['CONCLUSION_CTA', 'OUTRO', 'VERDICT'].includes(scene.tag)) || {
    tag: 'CONCLUSION_CTA',
    text: en
      ? `Test ${input.championName || payload.championName || 'this pick'} first\nBefore taking it ranked`
      : `${input.championName || payload.championName || '這隻英雄'} 這波先看實戰\n排位前先測一場`,
    durationInFrames: 132,
  };
  const impact = enrichedExisting.find((scene) => scene.tag === 'IMPACT_BREAKDOWN') || {
    tag: 'IMPACT_BREAKDOWN',
    text: en ? 'Retest combos and builds\nBefore chasing LP' : '連招與出裝先重測\n再決定能不能上分',
    durationInFrames: 148,
  };

  next.storyboard = [hook, ...rawScenes, impact, social, verdict].filter(Boolean);
  return segmentDensePatchStoryboard(next, locale);
}

function buildDeterministicPatchAnalysis(input = {}, asset = {}) {
  const championName = input.championName || 'Unknown Champion';
  const ability = input.ability || input.skill || 'BASE';
  const changeDesc = input.changeDesc || input.statChange || '';
  const locale = input.locale || 'zh';
  const en = isEnglishLocale(locale);
  const sections = splitPatchChangeSections(input);
  const normalizedSkillKey = inferSkillKey(ability);
  const metrics = sections.length > 0
    ? sections.flatMap((section) => extractMetricsFromText(section.changeDesc, locale))
    : extractMetricsFromText(changeDesc, locale);
  const changeType = aggregateChangeType(metrics, changeDesc);

  const typeText = en
    ? (changeType === 'BUFF' ? 'Buffed' : changeType === 'NERF' ? 'Nerfed' : changeType === 'REWORK' ? 'Reworked' : 'Adjusted')
    : (changeType === 'BUFF' ? '英雄增強' : changeType === 'NERF' ? '慘遭削弱' : changeType === 'REWORK' ? '機制重塑' : '數值調整');
  const metricText = metrics[0]?.metricName || (en ? 'Core Change' : '核心改動');
  const hasNumericMetrics = metrics.length > 0;
  const mechanicScene = {
    tag: 'MECHANIC_EXPLAINER',
    skillKey: normalizedSkillKey,
    text: en ? 'The core change matters\nCheck the gameplay impact' : '核心改動是重點\n先看實戰影響',
    trend: changeType,
    durationInFrames: 178,
    mechanicChange: {
      title: en
        ? `${normalizedSkillKey === 'BASE' ? 'Base Stats' : `${normalizedSkillKey} Ability`} Focus`
        : `${normalizedSkillKey === 'BASE' ? '基礎數值' : `${normalizedSkillKey} 技能`}機制重點`,
      beforeBehavior: en ? 'The old version used the previous skill interaction and combo rhythm.' : '舊版打法依賴原本的技能互動與連招節奏。',
      afterBehavior: changeDesc ? localizePatchPhrase(changeDesc, locale) : (en ? 'The new interaction changes operation flow and engage decisions.' : '新版互動會影響操作流程與進退場判斷。'),
      affectedCombos: en ? ['Combo Window', 'Engage Timing', 'Ranked Test'] : ['連招窗口', '進退場', '排位實測'],
      proImpact: en ? 'High-mastery players should retest combo timing before taking it ranked.' : '高熟練玩家要先測連招節奏，再決定能不能直接帶進排位。',
      cards: [
        { title: en ? 'Input Flow' : '操作流程', body: en ? 'The interaction changed, so old combos may not transfer cleanly.' : '技能互動改了，舊連招不一定能無痛照搬。' },
        { title: en ? 'Game Rhythm' : '對局節奏', body: en ? 'Engage, disengage, trading, or clear windows need a reset.' : '進場、退場、換血或刷野窗口都要重新評估。' },
        { title: en ? 'Ranked Advice' : '排位建議', body: en ? 'Test feel and build paths before locking it in ranked.' : '先測手感與出裝，再決定是否投入排位。' },
      ],
    },
  };
  const metricScene = {
    tag: 'SKILL_SHOWCASE',
    skillKey: normalizedSkillKey,
    text: en ? `${metricText} matters\nCheck the gameplay impact` : `${metricText} 是重點\n先看實戰影響`,
    impactText: changeType === 'BUFF'
      ? (en ? 'This buff can improve early tempo or teamfight margin.' : '這項上修會讓前期節奏或團戰容錯更好。')
      : changeType === 'NERF'
        ? (en ? 'This nerf lowers burst, sustain, or engage margin.' : '這項下修會壓低爆發、續戰或進場容錯。')
        : (en ? 'This is not a simple buff or nerf; retest the play window.' : '這不是單點增弱，實戰要重新評估打法窗口。'),
    metrics,
    trend: changeType,
    durationInFrames: 152,
  };

  const rawScenes = sections.length > 0
    ? sections.map((section) => buildRawPatchScene(section, changeType, locale))
    : [hasNumericMetrics ? metricScene : mechanicScene];

  const storyboard = splitDenseSkillScenes([
    {
      tag: 'HOOK',
      text: en ? `${championName} Patch Update\n${typeText}` : `${championName} 版本改動\n${typeText}`,
      durationInFrames: 108,
    },
    ...rawScenes,
    {
      tag: 'IMPACT_BREAKDOWN',
      text: en ? 'Retest combos and builds\nBefore chasing LP' : '連招與出裝先重測\n再決定能不能上分',
      durationInFrames: 148,
    },
    {
      tag: 'CONCLUSION_CTA',
      text: en ? `Test ${championName} first\nBefore taking it ranked` : `${championName} 這波先看實戰\n排位前先測一場`,
      durationInFrames: 132,
    },
  ], { locale, maxMetricsPerScene: 2 });

  return {
    dataType: 'PATCH',
    locale,
    championName,
    changeType,
    overallTrend: changeType,
    videoBackgroundUrl: asset.videoUrl || input.videoBackgroundUrl || '',
    heroImageUrl: asset.heroImageUrl || input.heroImageUrl || '',
    splashUrl: asset.splashUrl || input.splashUrl || '',
    skillIconUrl: asset.skillIconUrl || input.skillIconUrl || '',
    skillIcons: asset.skillIcons || input.skillIcons || {},
    sourceStatus: 'gemma_unavailable_deterministic_payload',
    changeSections: sections,
    changeCount: Math.max(sections.length, metrics.length),
    storyboard,
    subtitleScriptText: en ? `${championName} patch update. ${metricText} matters.` : `${championName} 版本改動${typeText}${metricText} 是重點`,
    actionableVerdict: {
      title: en ? 'Gameplay Verdict' : '實戰結論',
      body: changeType === 'BUFF'
        ? (en ? 'Power is up; test feel in normals before ranked.' : '強度有上修空間，先用一般對局測手感再進排位。')
        : changeType === 'NERF'
          ? (en ? 'Power is down; watch win rate and build shifts first.' : '強度被壓低，先觀察勝率與出裝變化再投入排位。')
          : (en ? 'The role is recalibrated; watch how high-level players adapt.' : '定位被重新校準，先看主流玩家怎麼調整打法。'),
      chips: changeType === 'BUFF'
        ? (en ? ['Test First', 'Watch Ban Rate', 'Ranked Check'] : ['可先測試', '注意 Ban 率', '排位觀察'])
        : changeType === 'NERF'
          ? (en ? ['Wait First', 'Find Backup Pick', 'Watch Win Rate'] : ['先觀望', '找替代選角', '看勝率'])
          : (en ? ['Test New Pattern', 'Watch Builds', 'Track Tempo'] : ['測新打法', '觀察出裝', '看對局節奏']),
    },
  };
}

export async function POST(request) {
  let body = {};
  let asset = { videoUrl: '', heroImageUrl: '', splashUrl: '', skillIconUrl: '', skillIcons: {} };
  try {
    const rawBody = await request.json();
    validateAnalyzeRequest(rawBody);
    body = slimRequestBody(rawBody);
    const { championName, ability, changeDesc, locale, dataType } = body;

    // 1. 抓取影片或立繪素材
    // 防呆：非英雄型 dataType 不會帶 ability，不能讓 toUpperCase 在 undefined 上炸開
    const safeAbility = typeof ability === 'string' ? ability : '';
    let skillLetter = "Q";
    const upperAbil = safeAbility.toUpperCase();
    if (upperAbil.includes("PASSIVE") || upperAbil.includes("被動")) {
      skillLetter = "P";
    } else if (upperAbil.includes("Q")) {
      skillLetter = "Q";
    } else if (upperAbil.includes("W")) {
      skillLetter = "W";
    } else if (upperAbil.includes("E")) {
      skillLetter = "E";
    } else if (upperAbil.includes("R")) {
      skillLetter = "R";
    } else {
      skillLetter = (safeAbility.split('-')[0].trim()[0] || "Q").toUpperCase();
    }

    const targetKind = String(body.targetType || body.entityType || body.category || '').toUpperCase();
    const rawTargetName = body.itemName || body.runeName || body.targetName || championName || '';
    const isItemUpdate = targetKind === 'ITEM' || targetKind === 'ITEMS' || dataType === 'ITEM_UPDATE' || Boolean(body.itemName);
    const isRuneUpdate = targetKind === 'RUNE' || targetKind === 'RUNES' || dataType === 'RUNE_UPDATE' || Boolean(body.runeName);

    const NON_CHAMPION_TYPES = new Set(['PLAYER_RADAR', 'ITEM_UPDATE', 'RUNE_UPDATE', 'SYSTEM_UPDATE']);
    asset = { videoUrl: '', heroImageUrl: '', splashUrl: '', skillIconUrl: '', skillIcons: {} };
    if (!NON_CHAMPION_TYPES.has(dataType) && !isItemUpdate && !isRuneUpdate && typeof championName === 'string' && championName.length > 0) {
      asset = await getVisualAsset(championName, skillLetter);
    }

    // Item/Rune balance changes: enrich with official zh_TW name + Data Dragon icon.
    // This prevents the LLM from hallucinating localized item/rune names and lets Remotion
    // render an icon-focused item/rune template instead of a champion splash template.
    let riotLocalization = {};
    if (isItemUpdate && rawTargetName) {
      riotLocalization = {
        targetType: 'ITEM',
        targetName: rawTargetName,
        localizedName: await getItemTWName(rawTargetName),
        iconUrl: await getItemIconUrl(rawTargetName),
      };
    } else if (isRuneUpdate && rawTargetName) {
      riotLocalization = {
        targetType: 'RUNE',
        targetName: rawTargetName,
        localizedName: await getRuneTWName(rawTargetName),
        iconUrl: await getRuneIconUrl(rawTargetName),
      };
    } else if (dataType === 'PATCH' && !isEnglishLocale(locale) && championName) {
      riotLocalization = {
        localizedChampionName: await getChampionTWName(championName),
      };
    }

    // 2. 丟給 AI 大腦進行推理：保留 body 中所有欄位（含 dataType、proPlayer、compName、headline、players…），
    //    再覆蓋掉/補上素材 URL 與必要派生欄位
    const aiAnalysis = await analyzeChange({
      ...body,
      skill: ability,
      statChange: changeDesc,
      videoBackgroundUrl: asset.videoUrl,
      heroImageUrl: asset.heroImageUrl,
      splashUrl: asset.splashUrl,
      skillIconUrl: asset.skillIconUrl,
      skillIcons: asset.skillIcons || {},   // 完整 Q/W/E/R/P + BASE_xxx 圖示 map
      ...riotLocalization,
      locale: locale || 'zh'
    });

    const repairedAnalysis = ensureAllPatchChangesVisible(aiAnalysis, body);
    return NextResponse.json({ success: true, data: repairedAnalysis });
  } catch (error) {
    console.error("API Analyze Error:", error);
    const fallbackDataType = body.dataType || 'PATCH';
    if (fallbackDataType === 'PATCH' && body.championName) {
      console.warn("⚠️ [Analyze Fallback] Gemma unavailable; returning deterministic PATCH payload derived from request data.");
      return NextResponse.json({
        success: true,
        degraded: true,
        warning: error.message,
        data: ensureAllPatchChangesVisible(buildDeterministicPatchAnalysis(body, asset), body),
      });
    }
    return NextResponse.json(
      { success: false, error: error.message },
      { status: error.statusCode || 500 }
    );
  }
}
