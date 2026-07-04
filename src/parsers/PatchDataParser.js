const axios = require('axios');
const cheerio = require('cheerio');
const {
  getItemTWName,
  getRuneTWName,
  getItemIconUrl,
  getRuneIconUrl,
} = require('../../utils/riotLocalization');
const { fetchMetaImpact } = require('../../utils/metaImpactProvider');

const PATCH_HOME = 'https://www.leagueoflegends.com/en-us/news/game-updates/';

const SECTION_PATTERNS = {
  CHAMPION: /champions?|英雄/i,
  ITEM: /items?|道具|裝備/i,
  RUNE: /runes?|符文/i,
  SUPPORT: /support adjustments?|輔助調整/i,
  IGNORE: /aram|arena|隨機|競技場|bugfix|bugfixes|錯誤|skin|skins|造型|client|用戶端|leaderboard|排行榜|pride|相關文章/i,
  SYSTEM: /role quest|lane|laning|jungle|objective|voidgrub|grub|system|map|minion|turret|bounty|economy|路線任務|路線|野區|物件|幼蟲|地圖|士兵|防禦塔|賞金|經濟|系統/i,
};

const SYSTEM_LOCALIZED_NAMES = {
  "Role Quest Adjustments": "路線任務調整",
  "Mid Role Quest": "中路任務",
  "Support Adjustments": "輔助調整",
};

const SUPPORT_RUNE_NAMES = new Set([
  "summon aery",
  "aftershock",
  "guardian",
  "glacial augment",
  "font of life",
  "revitalize",
  "unsealed spellbook",
  "召喚艾莉",
  "裂地衝擊",
  "神聖守護",
]);

const SUPPORT_ITEM_NAMES = new Set([
  "dream maker",
  "moonstone renewer",
  "imperial mandate",
  "echoes of helia",
  "locket of the iron solari",
  "knight s vow",
  "knights vow",
  "zeke s convergence",
  "zekes convergence",
  "夢寐以求",
  "月之石再生裝置",
  "帝王命令",
  "希利亞的迴響",
  "日輪的加冕",
  "騎士誓願",
  "錫柯的聚合之力",
]);

function cleanText(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

function normalizeTargetName(name) {
  return cleanText(name).replace(/^\[(NEW|REMOVED|REWORKED|UPDATED)\]\s*/i, '');
}

function normalizeNameKey(name = "") {
  return cleanText(name)
    .toLowerCase()
    .replace(/['’`]/g, " ")
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, " ")
    .trim();
}

function parseNumber(value) {
  const match = String(value || '').match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function extractNumericTokens(text) {
  return String(text || '').match(/[+-]?(?:\d+|\.\d+)(?:\.\d+)?%?/g) || [];
}

function normalizeComparableValue(value) {
  return String(value ?? '')
    .replace(/[,\s]/g, '')
    .replace(/^(-?)\.(\d)/, '$10.$2')
    .toLowerCase();
}

function isUnchangedValue(beforeValue, afterValue) {
  const beforeText = normalizeComparableValue(beforeValue);
  const afterText = normalizeComparableValue(afterValue);
  if (!beforeText || !afterText) return false;
  if (beforeText === afterText) return true;
  const before = parseNumber(beforeText);
  const after = parseNumber(afterText);
  return Number.isFinite(before) && Number.isFinite(after) && before === after;
}

function inferPairedMetricName(metricName, raw, index, beforeTokens = [], afterTokens = []) {
  const text = `${metricName} ${raw}`;
  const base = cleanText(metricName);
  const hasRange = beforeTokens.length >= 2 && afterTokens.length >= 2;
  if (/跑速|move(?:ment)? speed|movement/i.test(text)) {
    if (/近戰|melee/i.test(text) && index === 0) return /[A-Za-z]/.test(base) ? 'Melee Move Speed' : '跑速（近戰）';
    if (/遠程|ranged/i.test(text) && index === 1) return /[A-Za-z]/.test(base) ? 'Ranged Move Speed' : '跑速（遠程）';
    if (/持續|duration/i.test(text) && index === 2) return /[A-Za-z]/.test(base) ? 'Duration' : '持續時間';
  }
  if (/damage.*per|per.*damage|每段傷害|傷害/i.test(text) && hasRange) {
    if (index === 0) return /[A-Za-z]/.test(base) ? 'Minimum Damage' : '最低傷害';
    if (index === 1) return /[A-Za-z]/.test(base) ? 'Maximum Damage' : '最高傷害';
    if (/秒|second|duration/i.test(text) && index === 2) return /[A-Za-z]/.test(base) ? 'Duration' : '持續時間';
  }
  if (/近戰|melee/i.test(text) && index === 0) return `${base}（近戰）`;
  if (/遠程|ranged/i.test(text) && index === 1) return `${base}（遠程）`;
  if (/持續|duration/i.test(text) && index === 2) return /[A-Za-z]/.test(base) ? 'Duration' : '持續時間';
  return index === 0 ? base : `${base} Scaling ${index}`;
}

function buildOfficialSummary(metricName, raw, trend) {
  const direction = trend === 'BUFF' ? '上修' : trend === 'NERF' ? '下修' : '調整';
  if (/近戰|melee/i.test(metricName)) return `近戰觸發跑速${direction}`;
  if (/遠程|ranged/i.test(metricName)) return `遠程觸發跑速${direction}`;
  if (/持續|duration/i.test(metricName)) return `加速持續時間${direction}`;
  if (/最低|min/i.test(metricName)) return `最低傷害${direction}`;
  if (/最高|max/i.test(metricName)) return `最高傷害${direction}`;
  return cleanText(raw);
}

function classifyMetricTrend(metricName, beforeValue, afterValue, rawText) {
  const before = parseNumber(beforeValue);
  const after = parseNumber(afterValue);
  const text = `${metricName} ${rawText}`.toLowerCase();
  if (!Number.isFinite(before) || !Number.isFinite(after)) return 'ADJUST';
  if (after === before) return 'ADJUST';

  if (/(refund|cooldown reduction|減少冷卻|減cd|命中減)/i.test(text)) {
    return after > before ? 'BUFF' : 'NERF';
  }
  const decreaseIsBuff = /(cooldown|mana cost|cost|cast time|recharge|damage taken|self damage|self slow)/i.test(text);
  if (decreaseIsBuff) return after < before ? 'BUFF' : 'NERF';
  return after > before ? 'BUFF' : 'NERF';
}

function aggregateChangeType(statChanges, rawName) {
  if (/^\[REWORKED\]/i.test(rawName)) return 'REWORK';
  if (/^\[NEW\]/i.test(rawName) || /^\[REMOVED\]/i.test(rawName)) return 'ADJUST';

  const hasBuff = statChanges.some((s) => s.trend === 'BUFF');
  const hasNerf = statChanges.some((s) => s.trend === 'NERF');
  if (hasBuff && hasNerf) return 'ADJUST';
  if (hasBuff) return 'BUFF';
  if (hasNerf) return 'NERF';
  return 'ADJUST';
}

function extractStatChangesFromRows(rowData = [], targetName) {
  const changes = [];
  for (const row of rowData) {
    const raw = cleanText(typeof row === "string" ? row : row.raw);
    if (!raw) continue;

    const metricName = cleanText(typeof row === "string" ? "" : row.metricName)
      .replace(/^\[(NEW|REMOVED|REWORKED|UPDATED)\]\s*/i, '') || raw.split(':')[0];
    const afterStrong = cleanText(typeof row === "string" ? "" : row.afterText);
    const arrowMatch = raw.match(/(.+?)(?:⇒|→|->)(.+)$/);

    if (arrowMatch) {
      const beforeText = cleanText(arrowMatch[1].split(':').pop());
      const afterText = cleanText(afterStrong && afterStrong !== metricName ? afterStrong : arrowMatch[2]);
      const beforeTokens = extractNumericTokens(beforeText);
      const afterTokens = extractNumericTokens(afterText);
      if (beforeTokens.length > 1 && beforeTokens.length === afterTokens.length) {
        beforeTokens
          .map((beforeToken, index) => ({ beforeToken, afterToken: afterTokens[index], index }))
          .filter(({ beforeToken, afterToken }) => !isUnchangedValue(beforeToken, afterToken))
          .slice(0, 3)
          .forEach(({ beforeToken, afterToken, index }) => {
          const pairedMetricName = inferPairedMetricName(metricName, raw, index, beforeTokens, afterTokens);
          const trend = classifyMetricTrend(pairedMetricName, beforeToken, afterToken, raw);
          changes.push({
            targetName,
            metricName: pairedMetricName,
            beforeValue: beforeToken,
            afterValue: afterToken,
            trend,
            summary: buildOfficialSummary(pairedMetricName, raw, trend),
            officialText: raw,
          });
        });
      } else {
        if (isUnchangedValue(beforeText, afterText)) continue;
        const trend = classifyMetricTrend(metricName, beforeText, afterText, raw);
        changes.push({
          targetName,
          metricName,
          beforeValue: beforeText,
          afterValue: afterText,
          trend,
          summary: raw,
          officialText: raw,
        });
      }
      continue;
    }

    const valueMatch = raw.match(/^[^:]+:\s*(.+)$/);
    if (valueMatch) {
      changes.push({
        targetName,
        metricName,
        beforeValue: null,
        afterValue: cleanText(valueMatch[1]),
        trend: 'ADJUST',
        summary: raw,
      });
    }
  }

  return changes;
}

function extractStatChanges($, block, targetName) {
  const rowData = [];
  block.find('ul li').each((_, li) => {
    const $li = $(li);
    const raw = cleanText($li.text());
    if (!raw) return;
    rowData.push({
      raw,
      metricName: cleanText($li.find('strong').first().text()),
      afterText: cleanText($li.find('strong').last().text()),
    });
  });

  return extractStatChangesFromRows(rowData, targetName);
}

function detectSection(heading = "") {
  const text = cleanText(heading);
  if (!text) return "";
  if (SECTION_PATTERNS.SUPPORT.test(text)) return "SUPPORT";
  if (SECTION_PATTERNS.CHAMPION.test(text)) return "CHAMPION";
  if (SECTION_PATTERNS.ITEM.test(text)) return "ITEM";
  if (SECTION_PATTERNS.RUNE.test(text)) return "RUNE";
  if (SECTION_PATTERNS.IGNORE.test(text)) return "OTHER";
  if (SECTION_PATTERNS.SYSTEM.test(text)) return "SYSTEM";
  return "";
}

function localizeSystemName(name = "") {
  return SYSTEM_LOCALIZED_NAMES[name] || name;
}

function buildChangeDesc(paragraphs = [], rows = []) {
  const rowText = rows.map((row) => cleanText(typeof row === "string" ? row : row.raw)).filter(Boolean);
  return [...paragraphs.map(cleanText).filter(Boolean), ...rowText].join("\n");
}

function splitPatchChangeBlock($, block) {
  const intro = { paragraphs: [], rows: [] };
  const segments = [];
  let current = null;

  block.find('h3,h4,p,li').each((_, el) => {
    const tag = el.tagName;
    const text = cleanText($(el).text());
    if (!text) return;

    if (tag === 'h3') {
      current = {
        targetName: normalizeTargetName(text),
        paragraphs: [],
        rows: [],
        headings: [],
      };
      segments.push(current);
      return;
    }

    if (!current) {
      if (tag === 'p') intro.paragraphs.push(text);
      if (tag === 'li') intro.rows.push({ raw: text });
      return;
    }

    if (tag === 'h4') {
      current.headings.push(text);
      current.currentHeading = text;
      return;
    }

    if (tag === 'p') current.paragraphs.push(text);
    if (tag === 'li') current.rows.push({ raw: text, metricName: current.currentHeading || "" });
  });

  return { intro, segments };
}

function buildItemRuneTargetFromSegment(segment, category) {
  const targetName = normalizeTargetName(segment.targetName);
  const statChanges = extractStatChangesFromRows(segment.rows, targetName);
  const changeType = aggregateChangeType(statChanges, targetName);
  return {
    id: `${category.toLowerCase()}-${targetName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    dataType: category === 'ITEM' ? 'ITEM_UPDATE' : 'RUNE_UPDATE',
    targetType: category,
    targetName,
    ability: category === 'ITEM' ? 'Item Stats' : 'Rune Effect',
    changeDesc: buildChangeDesc(segment.paragraphs, segment.rows),
    changeType,
    trend: changeType === 'REWORK' ? 'ADJUST' : changeType,
    statChanges,
    iconUrl: '',
  };
}

function inferSupportSegmentCategory(targetName = "") {
  const key = normalizeNameKey(targetName);
  if (SUPPORT_RUNE_NAMES.has(key)) return "RUNE";
  if (SUPPORT_ITEM_NAMES.has(key)) return "ITEM";
  if (/aery|aftershock|guardian|rune|艾莉|裂地|守護/.test(key)) return "RUNE";
  return "ITEM";
}

function buildSystemTarget({
  targetName,
  localizedName,
  sectionTitle,
  paragraphs = [],
  rows = [],
  subtopics = [],
  systemType = "SYSTEM",
}) {
  const cleanTargetName = normalizeTargetName(targetName || sectionTitle || "System Update");
  const statChanges = extractStatChangesFromRows(rows, cleanTargetName);
  const changeDesc = buildChangeDesc(paragraphs, rows);
  const changeType = aggregateChangeType(statChanges, cleanTargetName || sectionTitle || changeDesc);
  return {
    id: `system-${cleanTargetName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    dataType: "SYSTEM_UPDATE",
    targetType: "SYSTEM",
    targetName: cleanTargetName,
    localizedName: localizedName || localizeSystemName(cleanTargetName),
    sectionTitle: sectionTitle || cleanTargetName,
    systemType,
    ability: "System Rules",
    changeDesc,
    changeType,
    trend: changeType === "REWORK" ? "ADJUST" : changeType,
    statChanges,
    subtopics,
  };
}

function extractStandaloneSystemChanges($) {
  const root = $.root();
  const nodes = root.find('h2,h3,h4,p,li').toArray();
  const systemChanges = [];

  nodes.forEach((node, index) => {
    if (node.tagName !== 'h2') return;
    const sectionTitle = cleanText($(node).text());
    const section = detectSection(sectionTitle);
    if (section !== "SYSTEM") return;

    const groups = [];
    let current = null;
    for (let i = index + 1; i < nodes.length; i += 1) {
      const el = nodes[i];
      const tag = el.tagName;
      const text = cleanText($(el).text());
      if (!text) continue;
      if (tag === 'h2') break;

      if (tag === 'h3' || tag === 'h4') {
        current = { targetName: text, paragraphs: [], rows: [] };
        groups.push(current);
        continue;
      }

      if (!current) {
        current = { targetName: sectionTitle, paragraphs: [], rows: [] };
        groups.push(current);
      }

      if (tag === 'p') current.paragraphs.push(text);
      if (tag === 'li') current.rows.push({ raw: text });
    }

    for (const group of groups) {
      if (buildChangeDesc(group.paragraphs, group.rows)) {
        systemChanges.push(buildSystemTarget({
          targetName: group.targetName,
          localizedName: localizeSystemName(group.targetName),
          sectionTitle,
          paragraphs: group.paragraphs,
          rows: group.rows,
          systemType: "ROLE_OR_MAP",
        }));
      }
    }
  });

  return systemChanges;
}

function getBlockImage($, block) {
  return block.find('img').first().attr('src') || '';
}

async function enrichItem(rawTarget) {
  const targetName = normalizeTargetName(rawTarget.targetName);
  const localizedName = await getItemTWName(targetName);
  const iconUrl = await getItemIconUrl(targetName);
  const target = { ...rawTarget, targetName, itemName: targetName, localizedName: localizedName || targetName, iconUrl: iconUrl || rawTarget.iconUrl };
  try {
    const impact = await fetchMetaImpact(target, { locale: 'zh' });
    if (impact.success) return { ...target, synergyImpact: impact.synergyImpact };
  } catch (error) {
    console.warn(`⚠️ [MetaImpact] item lookup skipped for ${targetName}: ${error.message}`);
  }
  return target;
}

async function enrichRune(rawTarget) {
  const targetName = normalizeTargetName(rawTarget.targetName);
  const localizedName = await getRuneTWName(targetName);
  const iconUrl = await getRuneIconUrl(targetName);
  const target = { ...rawTarget, targetName, runeName: targetName, localizedName: localizedName || targetName, iconUrl: iconUrl || rawTarget.iconUrl };
  try {
    const impact = await fetchMetaImpact(target, { locale: 'zh' });
    if (impact.success) return { ...target, synergyImpact: impact.synergyImpact };
  } catch (error) {
    console.warn(`⚠️ [MetaImpact] rune lookup skipped for ${targetName}: ${error.message}`);
  }
  return target;
}

async function parsePatchHtml(html, { patchUrl = "", enrich = true } = {}) {
    const $ = cheerio.load(html);
    const champions = [];
    const rawItems = [];
    const rawRunes = [];
    const rawSystems = extractStandaloneSystemChanges($);
    let currentSection = '';

    $('h2, .patch-change-block').each((_, el) => {
      const node = $(el);
      if (el.tagName === 'h2') {
        const detected = detectSection(node.text());
        if (detected) currentSection = detected;
        return;
      }

      if (!node.hasClass('patch-change-block')) return;

      if (currentSection === 'SUPPORT') {
        const { intro, segments } = splitPatchChangeBlock($, node);
        const introDesc = buildChangeDesc(intro.paragraphs, intro.rows);
        if (introDesc) {
          rawSystems.push(buildSystemTarget({
            targetName: 'Support Adjustments',
            localizedName: localizeSystemName('Support Adjustments'),
            sectionTitle: 'Support Adjustments',
            paragraphs: intro.paragraphs,
            rows: intro.rows,
            subtopics: segments.map((segment) => segment.targetName).filter(Boolean),
            systemType: 'SUPPORT_META',
          }));
        }

        for (const segment of segments) {
          const targetCategory = inferSupportSegmentCategory(segment.targetName);
          const target = buildItemRuneTargetFromSegment(segment, targetCategory);
          if (targetCategory === 'ITEM') rawItems.push(target);
          else rawRunes.push(target);
        }
        return;
      }

      const rawName = cleanText(node.find('h3').first().text());
      if (!rawName) return;

      if (currentSection === 'ITEM' || currentSection === 'RUNE') {
        const { segments } = splitPatchChangeBlock($, node);
        if (segments.length > 0) {
          for (const segment of segments) {
            const target = buildItemRuneTargetFromSegment(segment, currentSection);
            target.iconUrl = getBlockImage($, node);
            if (currentSection === 'ITEM') rawItems.push(target);
            else rawRunes.push(target);
          }
        } else {
          const targetName = normalizeTargetName(rawName);
          const statChanges = extractStatChanges($, node, targetName);
          const changeType = aggregateChangeType(statChanges, rawName);
          const target = {
            id: `${currentSection.toLowerCase()}-${targetName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
            dataType: currentSection === 'ITEM' ? 'ITEM_UPDATE' : 'RUNE_UPDATE',
            targetType: currentSection,
            targetName,
            ability: currentSection === 'ITEM' ? 'Item Stats' : 'Rune Effect',
            changeDesc: cleanText(node.find('ul').text()) || cleanText(node.text()),
            changeType,
            trend: changeType === 'REWORK' ? 'ADJUST' : changeType,
            statChanges,
            iconUrl: getBlockImage($, node),
          };

          if (currentSection === 'ITEM') rawItems.push(target);
          else rawRunes.push(target);
        }
        return;
      }

      if (currentSection !== 'CHAMPION') return;

      const abilities = [];
      node.find('h4').each((_, abl) => {
        const ability = cleanText($(abl).text());
        const allLi = [];
        $(abl).nextAll('ul').first().find('li').each((__, li) => {
          const text = cleanText($(li).text());
          if (text) allLi.push(text);
        });
        const changeDesc = allLi.join('\n');
        if (ability && changeDesc) abilities.push({ ability, changeDesc });
      });

      if (abilities.length > 0) {
        champions.push({
          dataType: 'PATCH',
          championName: rawName,
          changes: abilities,
        });
      }
    });

    const [itemChanges, runeChanges] = enrich
      ? await Promise.all([
          Promise.all(rawItems.map(enrichItem)),
          Promise.all(rawRunes.map(enrichRune)),
        ])
      : [rawItems, rawRunes];

    return {
      list: champions,
      itemChanges,
      runeChanges,
      systemChanges: rawSystems,
      patchUrl,
    };
}

async function scrapePatchData() {
  console.log("🕵️‍♂️ [系統] PatchDataParser 啟動：尋找最新改版公告...");

  try {
    const listRes = await axios.get(PATCH_HOME);
    const $list = cheerio.load(listRes.data);

    let latestPatchUrl = '';
    $list('a').each((_, el) => {
      const href = $list(el).attr('href');
      if (href && href.includes('patch-') && href.includes('-notes')) {
        latestPatchUrl = href.startsWith('http') ? href : 'https://www.leagueoflegends.com' + href;
        return false;
      }
      return undefined;
    });

    if (!latestPatchUrl) throw new Error("找不到最新公告連結");

    const patchRes = await axios.get(latestPatchUrl);
    return await parsePatchHtml(patchRes.data, { patchUrl: latestPatchUrl });
  } catch (error) {
    console.error("❌ [PatchDataParser 錯誤]：", error.message);
    return { list: [], itemChanges: [], runeChanges: [], systemChanges: [] };
  }
}

module.exports = {
  scrapePatchData,
  parsePatchHtml,
  detectSection,
  extractStatChangesFromRows,
};
