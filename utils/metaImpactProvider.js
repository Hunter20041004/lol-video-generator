const cheerio = require('cheerio');
const { getItemEntry, getRuneEntry, getChampionTWName } = require('./riotLocalization');

const METABOT_BASE = 'https://metabot.gg/en/league';

function parseIdFromIconUrl(iconUrl, targetType) {
  const raw = String(iconUrl || '');
  if (targetType === 'ITEM') {
    return raw.match(/\/img\/item\/(\d+)\.png/i)?.[1] || '';
  }
  return '';
}

function normalizeTargetType(targetType) {
  return String(targetType || '').toUpperCase() === 'RUNE' ? 'RUNE' : 'ITEM';
}

function normalizeChampionSlug(slug) {
  const cleaned = decodeURIComponent(String(slug || '').trim());
  return cleaned || '';
}

function extractChampionFromListItem(listItem, targetName) {
  const item = listItem?.item || {};
  const url = String(item.url || '');
  const slug = url.match(/\/champion\/([^/?#]+)/i)?.[1];
  if (slug) return normalizeChampionSlug(slug);

  const rawName = String(item.name || '').trim();
  if (!rawName) return '';
  return rawName
    .replace(new RegExp(String(targetName || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'ig'), '')
    .replace(/\b(Build|Rune|Guide|Stats|with|using)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseWinRate(description) {
  const match = String(description || '').match(/(\d+(?:\.\d+)?)%\s+win rate/i);
  return match ? `${match[1]}%` : '';
}

function parseJsonLdBlocks(html) {
  const $ = cheerio.load(html);
  const blocks = [];
  $('script[type="application/ld+json"]').each((_, script) => {
    const raw = $(script).contents().text();
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      blocks.push(parsed);
    } catch {}
  });
  return blocks;
}

async function resolveMetaId(target = {}) {
  const targetType = normalizeTargetType(target.targetType);
  const iconId = parseIdFromIconUrl(target.iconUrl, targetType);
  if (iconId) return iconId;

  const name = target.targetName || target.itemName || target.runeName || target.localizedName;
  if (!name) return '';

  if (targetType === 'RUNE') {
    const rune = await getRuneEntry(name);
    return rune?.id ? String(rune.id) : '';
  }

  const item = await getItemEntry(name);
  return item?.id ? String(item.id) : '';
}

function buildCandidateIds(id) {
  const raw = String(id || '').trim();
  if (!raw) return [];
  const candidates = [raw];
  if (/^[23]\d{4,}$/.test(raw)) candidates.push(raw.slice(2));
  return [...new Set(candidates)];
}

async function buildImpactCopy({ targetType, sourceDate, locale }) {
  if (String(locale || 'zh').toLowerCase().startsWith('en')) {
    return {
      impactDescription: targetType === 'RUNE'
        ? 'This rune change affects champions that can convert the adjusted stat into lane pressure, engage timing, or tempo.'
        : 'This item change affects champions whose build curve depends most on the adjusted stat.',
      impactSource: 'MetaBot live stats',
      criteria: `MetaBot best champion builds${sourceDate ? ` (${sourceDate})` : ''}.`,
    };
  }

  return {
    impactDescription: targetType === 'RUNE'
      ? '這波符文改動會影響最能把新數值轉成對線壓力、進場時機或節奏的英雄。'
      : '這波裝備改動會影響最依賴該數值曲線與成裝節奏的英雄。',
    impactSource: 'MetaBot 即時統計',
    criteria: `MetaBot 最佳使用英雄排序${sourceDate ? `（${sourceDate}）` : ''}`,
  };
}

async function fetchMetaImpact(target = {}, options = {}) {
  const targetType = normalizeTargetType(target.targetType);
  const metaId = await resolveMetaId({ ...target, targetType });
  if (!metaId) {
    return { success: false, reason: 'NO_METABOT_ID' };
  }

  const routeType = targetType === 'RUNE' ? 'rune' : 'item';
  const candidateIds = buildCandidateIds(metaId);
  let lastFailure = null;

  for (const candidateId of candidateIds) {
    const url = `${METABOT_BASE}/${routeType}/${candidateId}/overview`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'HextechVideoStudio/1.0 (+local content pipeline)',
        'Accept': 'text/html,application/xhtml+xml',
      },
      cache: 'no-store',
    });

    if (!res.ok) {
      lastFailure = { success: false, reason: `HTTP_${res.status}`, url };
      continue;
    }

    const html = await res.text();
    const jsonLd = parseJsonLdBlocks(html);
    const targetName = target.targetName || target.itemName || target.runeName || target.localizedName || '';
    const itemList = jsonLd.find((block) => {
      if (block?.['@type'] !== 'ItemList' || !Array.isArray(block.itemListElement)) return false;
      const name = String(block.name || '').toLowerCase();
      if (targetType === 'RUNE') return /best .* champions|champions/i.test(name);
      return /top .* builds|best .* champions|builds/i.test(name);
    });

    const champions = (itemList?.itemListElement || [])
      .map((entry) => {
        const item = entry.item || {};
        const name = extractChampionFromListItem(entry, targetName);
        if (!name) return null;
        return {
          name,
          position: entry.position || null,
          winRate: parseWinRate(item.description),
          description: item.description || '',
          url: item.url || '',
        };
      })
      .filter(Boolean)
      .slice(0, 3);

    if (champions.length === 0) {
      lastFailure = { success: false, reason: 'NO_CHAMPIONS_FOUND', url };
      continue;
    }

    const pageDate = jsonLd.find((block) => block?.dateModified)?.dateModified;
    const sourceDate = pageDate ? String(pageDate).slice(0, 10) : '';
    const copy = await buildImpactCopy({
      targetType,
      champions,
      sourceDate,
      locale: options.locale || target.locale || target.outputLanguage || 'zh',
    });

    return {
      success: true,
      url,
      metaId: candidateId,
      targetType,
      champions,
      synergyImpact: {
        champions: champions.map((champion) => champion.name),
        ...copy,
        stats: champions,
        sourceUrl: url,
      },
    };
  }

  return lastFailure || { success: false, reason: 'NO_CHAMPIONS_FOUND' };
}

module.exports = {
  fetchMetaImpact,
  buildCandidateIds,
};
