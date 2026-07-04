const ITEM_RUNE_STAT_ZH = {
  "attack damage": "攻擊力",
  "base attack damage": "基礎攻擊力",
  ad: "攻擊力",
  "attack speed": "攻擊速度",
  "movement speed": "跑速",
  "move speed": "跑速",
  damage: "傷害",
  "total cost": "總價格",
  cost: "總價格",
  cooldown: "冷卻時間",
  duration: "持續時間",
  "max stacks": "最大層數",
  "omnivamp per stack": "每層全能吸血",
  omnivamp: "全能吸血",
  "ability haste": "技能加速",
  "frostfire tempest": "霜火風暴",
};

const ITEM_RUNE_NAME_EN = {
  "多蘭之弓": "Doran's Bow",
  "多蘭之刃": "Doran's Blade",
  "多蘭之盾": "Doran's Shield",
  "多蘭之戒": "Doran's Ring",
  "海妖殺手": "Kraken Slayer",
  "公理弧刃": "Axiom Arc",
  "征服者": "Conqueror",
  "冥火之觸": "Deathfire Touch",
  "貪食脛甲": "Gluttonous Greaves",
  "不朽之路": "Immortal Path",
  "風暴浪湧": "Stormsurge",
  "路線任務調整": "Role Quest Adjustments",
  "中路任務": "Mid Role Quest",
  "輔助調整": "Support Adjustments",
};

function normalizeMetricKey(name = "") {
  return String(name || "")
    .toLowerCase()
    .replace(/['’`]/g, "")
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, " ")
    .trim();
}

function hasLatinWord(value = "") {
  return /[A-Za-z]{3,}/.test(String(value || ""));
}

function localizeKnownZhPhrase(value = "") {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const normalized = raw
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/\s+/g, " ");
  const exactMap = {
    "frostfire tempest": "霜火風暴",
    "triggers on ult cast": "大絕施放觸發",
    "readies on ult cast for the next 5 seconds, triggering the moment an enemy champion gets within the range or after 5 seconds": "大絕後預備5秒",
    "damage triggers on hit, or on certain abilities / items": "命中或特定技能觸發",
    "damage triggers on next damaging attack or ability, reduced for aoe effects (i.e. nami e)": "下次攻擊或技能觸發",
    "damage reduction affects the next non-0 instance of damage, regardless of how large it is": "減免下一次非零傷害",
    "damage reduction affects the next non-0 damage cast source (temporal carry-over)": "減免下一段傷害來源",
  };
  if (exactMap[normalized]) return exactMap[normalized];
  if (/frostfire\s+tempest/.test(normalized)) return "霜火風暴";
  if (/readies.*ult.*5\s*seconds|ult.*readies.*5\s*seconds/.test(normalized)) return "大絕後預備5秒";
  if (/triggers.*ult.*cast|ult.*cast.*triggers/.test(normalized)) return "大絕施放觸發";
  if (/damage\s+triggers.*next.*attack.*ability/.test(normalized)) return "下次攻擊或技能觸發";
  if (/damage\s+triggers.*hit|on-hit/.test(normalized)) return "命中時觸發";
  if (/damage\s+reduction.*cast\s+source/.test(normalized)) return "減免整段傷害來源";
  if (/damage\s+reduction/.test(normalized)) return "減免下一次傷害";
  return "";
}

function localizeStatValue(value = "", phase = "value") {
  const raw = String(value ?? "").trim();
  if (!hasLatinWord(raw)) return raw;
  return localizeKnownZhPhrase(raw) || (phase === "after" ? "新機制" : "舊機制");
}

function getTargetSearchText(target = {}, stats = []) {
  return [
    target.targetName,
    target.localizedName,
    target.itemName,
    target.runeName,
    target.changeDesc,
    ...(Array.isArray(stats)
      ? stats.flatMap((stat) => [
        stat.metricName,
        stat.beforeValue,
        stat.afterValue,
        stat.summary,
        stat.officialText,
      ])
      : []),
  ].filter(Boolean).join(" ").toLowerCase();
}

function isZekesConvergence(target = {}, stats = []) {
  return /zeke|錫柯|frostfire|霜火/.test(getTargetSearchText(target, stats));
}

function getEnglishItemRuneName(value = "") {
  return String(value || "")
    .split(/\s*\/\s*/)
    .map((part) => ITEM_RUNE_NAME_EN[part] || part)
    .join(" / ");
}

function localizeStatChange(stat = {}, locale = "zh") {
  if (locale === "en") {
    const metricName = getEnglishItemRuneName(stat.metricName) || stat.metricName || "Core Stat";
    return {
      ...stat,
      metricName,
      summary: stat.summary || "Retest this stat before locking the setup.",
    };
  }

  const rawMetric = String(stat.metricName || "").trim();
  const key = normalizeMetricKey(rawMetric);
  const metricContext = `${rawMetric} ${stat.summary || ""} ${stat.officialText || ""}`;
  const metricName =
    ITEM_RUNE_STAT_ZH[key] ||
    (/近戰|melee/i.test(metricContext) && /跑速|move\s*speed|movement\s*speed/i.test(metricContext) ? "跑速（近戰）" : "") ||
    (/遠程|ranged/i.test(metricContext) && /跑速|move\s*speed|movement\s*speed/i.test(metricContext) ? "跑速（遠程）" : "") ||
    (/持續|duration/i.test(metricContext) && /跑速|move\s*speed|movement\s*speed/i.test(metricContext) ? "持續時間" : "") ||
    (/move\s*speed|movement\s*speed/.test(key) ? "跑速" : "") ||
    (/attack\s*speed/.test(key) ? "攻擊速度" : "") ||
    (/attack\s*damage|\bad\b/.test(key) ? "攻擊力" : "") ||
    (/total\s*cost|cost/.test(key) ? "總價格" : "") ||
    localizeKnownZhPhrase(rawMetric) ||
    (hasLatinWord(rawMetric) ? "核心機制" : rawMetric) ||
    "核心數值";

  return {
    ...stat,
    metricName,
    beforeValue: localizeStatValue(stat.beforeValue, "before"),
    afterValue: localizeStatValue(stat.afterValue, "after"),
    summary: stat.summary || (stat.trend === "NERF" ? "實戰強度要重估" : "優先級有機會提高"),
  };
}

function filterStatChanges(stats = [], locale = "zh") {
  return stats
    .filter((stat) => {
      const before = String(stat.beforeValue ?? "").replace(/[,\s]/g, "");
      const after = String(stat.afterValue ?? "").replace(/[,\s]/g, "");
      return before && after && before !== after;
    })
    .slice(0, 3)
    .map((stat) => localizeStatChange(stat, locale));
}

function filterSystemStatChanges(stats = [], locale = "zh") {
  return stats
    .filter((stat) => {
      const before = String(stat.beforeValue ?? "").trim();
      const after = String(stat.afterValue ?? "").trim();
      return before && after && before !== after;
    })
    .slice(0, 4)
    .map((stat) => localizeStatChange(stat, locale));
}

function buildVerdict(changeType, targetType, stats, locale = "zh") {
  const isRune = targetType === "RUNE";
  const text = stats.map((stat) => `${stat.metricName} ${stat.summary}`).join(" ").toLowerCase();
  const hasCost = /總價格|cost|價格/.test(text);
  const hasSpeed = /跑速|move speed|movement/.test(text);
  const hasDamage = /攻擊|attack|damage|傷害/.test(text);
  const hasZekes = isZekesConvergence({}, stats);

  if (locale === "en") {
    if (hasZekes) {
      return {
        title: "Gameplay Verdict",
        body: "Best for engage supports that ult from range, then walk in before Frostfire triggers.",
        chips: ["Ranged ult", "Enter range", "Tank support"],
      };
    }
    if (hasCost) {
      return {
        title: "Gameplay Verdict",
        body: "The timing changes more than the label. Retest the first-spike window before forcing it.",
        chips: isRune ? ["Rune timing", "Retest setup", "Avoid autopilot"] : ["Build timing", "Retest first item", "Avoid autopilot"],
      };
    }
    if (hasSpeed) {
      return {
        title: "Gameplay Verdict",
        body: "Mobility changes directly affect roam, chase, and spacing windows.",
        chips: isRune ? ["Roam window", "Spacing", "Rune priority"] : ["Chase window", "Spacing", "Item priority"],
      };
    }
    if (hasDamage) {
      return {
        title: "Gameplay Verdict",
        body: "Damage tempo shifted, so check whether the setup still wins the first real trade.",
        chips: ["Trade timing", "Spike check", "Matchup dependent"],
      };
    }
    return {
      title: "Gameplay Verdict",
      body: changeType === "BUFF" ? "Test it earlier only if your champion converts the changed stat immediately." : "Do not autopilot it; compare the replacement setup first.",
      chips: ["Retest", "Compare", "Context pick"],
    };
  }

  if (hasZekes) {
    return {
      title: "實戰結論",
      body: "遠距離放大後再進場的坦輔最受益，不是後排輸出裝。",
      chips: ["遠距離放大", "進場觸發", "坦輔優先"],
    };
  }
  if (hasCost) {
    return {
      title: "實戰結論",
      body: isRune ? "符文節奏被改動，重點是前期能不能吃到新版收益。" : "成裝時間被改動，重點是第一波強勢期會不會延後。",
      chips: isRune ? ["看前期", "重配符文", "別自動帶"] : ["看首件", "重算成裝", "別自動出"],
    };
  }
  if (hasSpeed) {
    return {
      title: "實戰結論",
      body: isRune ? "跑圖、追擊、拉扯都會受影響，支援型英雄要重看符文優先級。" : "追擊與撤退窗口會變，靠跑速打節奏的英雄要重看出裝順序。",
      chips: isRune ? ["支援節奏", "拉扯窗口", "符文優先"] : ["追擊窗口", "撤退窗口", "出裝優先"],
    };
  }
  if (hasDamage) {
    return {
      title: "實戰結論",
      body: isRune ? "換血門檻被重調，靠符文打前期壓力的英雄要重新測。" : "傷害曲線被重調，靠首件打第一波 all-in 的英雄要重新測。",
      chips: isRune ? ["換血門檻", "重測符文", "看對線"] : ["傷害曲線", "重測首件", "看對線"],
    };
  }
  return {
    title: "實戰結論",
    body: changeType === "BUFF" ? "能直接吃到補強數值才優先，不要只看標籤。" : "核心數值被砍就先找替代，不要硬套舊版本。",
    chips: ["看數值", "看對局", "重測優先級"],
  };
}

function buildSynergy(target, stats, locale = "zh") {
  if (isZekesConvergence(target, stats)) {
    return {
      champions: ["Leona", "Nautilus", "Rell"],
      impactDescription: locale === "en"
        ? "Engage supports that ult from range benefit most from the delayed Frostfire trigger."
        : "最受影響的是遠距離放大後還要進場貼身的坦輔。",
    };
  }
  if (target?.synergyImpact?.champions?.length) {
    return target.synergyImpact;
  }
  const text = getTargetSearchText(target, stats);
  if (/跑速|move speed|movement/.test(text)) {
    return {
      champions: ["Hecarim", "Udyr", "Singed"],
      impactDescription: locale === "en"
        ? "These champions care about roam speed, chase windows, and spacing uptime."
        : "這些英雄最吃跑圖、追擊與拉扯窗口，符文或裝備優先級需要重排。",
    };
  }
  if (/攻擊速度|attack speed|on-hit|觸發/.test(text)) {
    return {
      champions: ["Yasuo", "Yone", "Master Yi"],
      impactDescription: locale === "en"
        ? "Auto-attack tempo and on-hit uptime decide whether the setup still spikes fast enough."
        : "這些英雄依賴普攻節奏與觸發頻率，最需要重測新版強勢期。",
    };
  }
  return {
    champions: [],
    impactDescription: locale === "en"
      ? "No reliable affected-champion data was provided, so avoid forcing a fake champion list."
      : "沒有可靠受影響英雄資料時，不硬塞不相關名單。",
  };
}

function buildSystemVerdict(target, stats, locale = "zh") {
  const text = `${target?.targetName || ""} ${target?.localizedName || ""} ${target?.sectionTitle || ""} ${target?.changeDesc || ""}`.toLowerCase();
  const isSupport = /support|輔助|enchanter|tank/.test(text);
  const isRoleQuest = /role quest|mid role|中路任務|路線任務/.test(text);

  if (locale === "en") {
    if (isSupport) {
      return {
        title: "Gameplay Verdict",
        body: "Support priority shifts toward engage tanks and roam windows; enchanter lanes need a fresh read.",
        chips: ["Tank support", "Roam target", "Retest bot lane"],
      };
    }
    if (isRoleQuest) {
      return {
        title: "Gameplay Verdict",
        body: "Mid lane scaling rewards matter more, so early lane plans should account for the stronger quest payoff.",
        chips: ["Mid scaling", "Lane plan", "Quest payoff"],
      };
    }
    return {
      title: "Gameplay Verdict",
      body: "This is a system-level tempo shift; retest routes and objective timing before autopiloting.",
      chips: ["System shift", "Retest timing", "Patch meta"],
    };
  }

  if (isSupport) {
    return {
      title: "實戰結論",
      body: "輔助優先級會往坦輔與遊走窗口移動，附魔師對線不能再照舊判斷。",
      chips: ["坦輔回歸", "遊走目標", "下路重測"],
    };
  }
  if (isRoleQuest) {
    return {
      title: "實戰結論",
      body: "中路任務獎勵變得更值得打，前期對線與換血節奏要重新算。",
      chips: ["中路成長", "對線節奏", "任務收益"],
    };
  }
  return {
    title: "實戰結論",
    body: "這是版本節奏改動，路線、物件與開戰時間點都要重新測。",
    chips: ["系統改動", "重測節奏", "版本環境"],
  };
}

function buildSystemImpactPoints(target, stats, locale = "zh") {
  const text = `${target?.targetName || ""} ${target?.localizedName || ""} ${target?.sectionTitle || ""} ${target?.changeDesc || ""}`.toLowerCase();
  const isSupport = /support|輔助|enchanter|tank/.test(text);
  const isRoleQuest = /role quest|mid role|中路任務|路線任務/.test(text);

  if (locale === "en") {
    if (isSupport) {
      return [
        { title: "Lane Meta", body: "Enchanter lanes lose some automatic safety." },
        { title: "Tank Window", body: "Engage supports get clearer early-game purpose." },
        { title: "Roam Target", body: "Voidgrubs become a better support destination." },
      ];
    }
    if (isRoleQuest) {
      return [
        { title: "Mid Reward", body: "Quest payoff is stronger after completion." },
        { title: "Lane Trade", body: "Early trades can matter more for scaling plans." },
        { title: "Draft Read", body: "Scaling mids deserve another look." },
      ];
    }
    return [
      { title: "Tempo", body: "Map timing changes before champion strength does." },
      { title: "Draft", body: "Priority picks may move by role." },
      { title: "Practice", body: "Retest routes before ranked." },
    ];
  }

  if (isSupport) {
    return [
      { title: "下路生態", body: "附魔師安全感下降，換血更有意義。" },
      { title: "坦輔窗口", body: "開戰輔助更容易找到前期節奏。" },
      { title: "遊走目標", body: "幼蟲會變成輔助更明確的巡場點。" },
    ];
  }
  if (isRoleQuest) {
    return [
      { title: "中路收益", body: "任務完成後的成長獎勵更高。" },
      { title: "對線換血", body: "前期線權與換血價值要重算。" },
      { title: "選角判斷", body: "成長型中路值得重新評估。" },
    ];
  }
  return [
    { title: "版本節奏", body: "地圖時間點會先影響打法。" },
    { title: "陣容優先", body: "不同位置優先級可能改變。" },
    { title: "實戰測試", body: "先重測路線再打排位。" },
  ];
}

function buildSystemPayload(item, locale = "zh") {
  const target = item.payload || {};
  const statChanges = filterSystemStatChanges(target.statChanges || [], locale);
  const localizedName = locale === "en"
    ? getEnglishItemRuneName(item.targetName || item.localizedName) || item.targetName || "System Update"
    : item.localizedName || item.targetName || "系統改動";
  const targetName = locale === "en"
    ? getEnglishItemRuneName(item.targetName || localizedName) || item.targetName || localizedName
    : item.targetName || localizedName;
  const changeType = item.changeType || target.changeType || "ADJUST";
  const firstMetric = statChanges[0]?.metricName || (locale === "en" ? "Core rule" : "核心規則");
  const subtopics = Array.isArray(target.subtopics) ? target.subtopics.slice(0, 4) : [];

  return {
    ...target,
    dataType: "SYSTEM_UPDATE",
    targetType: "SYSTEM",
    targetName,
    localizedName,
    headline: locale === "en" ? `${localizedName} System Update` : `${localizedName}系統改動`,
    changeType,
    trend: changeType === "REWORK" ? "ADJUST" : changeType,
    statChanges,
    subtopics,
    affectedRoles: target.affectedRoles || [],
    impactPoints: buildSystemImpactPoints(target, statChanges, locale),
    actionableVerdict: buildSystemVerdict(target, statChanges, locale),
    locale,
    outputLanguage: locale,
    storyboard: locale === "en" ? [
      { text: `${localizedName}\nPatch system shift`, tag: "HOOK" },
      { text: `${firstMetric} changed\nTempo needs a retest`, tag: "SKILL_SHOWCASE", skillKey: "SYS", metrics: statChanges },
      { text: "Map and draft priorities\nmove before habits do", tag: "IMPACT_BREAKDOWN" },
      { text: "Retest the route first\nthen lock ranked plans", tag: "CONCLUSION_CTA" },
    ] : [
      { text: `${localizedName}\n版本節奏要重看`, tag: "HOOK" },
      { text: `${firstMetric}改了\n打法時間點要重測`, tag: "SKILL_SHOWCASE", skillKey: "SYS", metrics: statChanges },
      { text: "地圖與選角優先級\n會先影響實戰判斷", tag: "IMPACT_BREAKDOWN" },
      { text: "先重測路線節奏\n再決定排位打法", tag: "CONCLUSION_CTA" },
    ],
  };
}

async function buildChampionFallbackPayload(item, locale = "zh") {
  const payload = item.payload || {};
  const championName = payload.championName || item.targetName;
  const localizedChampionName = locale === "zh"
    ? item.localizedName || item.raw?.localizedChampionName || championName
    : championName;
  return {
    dataType: "PATCH",
    locale,
    outputLanguage: locale,
    championName,
    localizedChampionName,
    changeType: item.changeType || "ADJUST",
    overallTrend: item.changeType || "ADJUST",
    ability: payload.ability || "",
    changeDesc: payload.changeDesc || "",
    storyboard: locale === "en" ? [
      { tag: "HOOK", text: `${championName} patch update\nWatch the changed ability windows` },
      { tag: "SKILL_SHOWCASE", text: "Break down the changed numbers\nthen judge the real impact" },
      { tag: "OUTRO", text: "Retest the matchup\nbefore locking old habits" },
    ] : [
      { tag: "HOOK", text: `${localizedChampionName}版本改動\n先看技能窗口怎麼變` },
      { tag: "SKILL_SHOWCASE", text: "把改動數字攤開\n再判斷實戰影響" },
      { tag: "OUTRO", text: "對局要重新測\n別直接套舊版本" },
    ],
  };
}

function buildItemRunePayload(item, locale = "zh") {
  const target = item.payload || {};
  const targetType = item.category === "RUNE" ? "RUNE" : "ITEM";
  const statChanges = filterStatChanges(target.statChanges || [], locale);
  const localizedName = locale === "en"
    ? getEnglishItemRuneName(item.targetName || item.localizedName) || item.targetName
    : item.localizedName || item.targetName;
  const changeType = item.changeType || target.changeType || "ADJUST";

  return {
    ...target,
    dataType: targetType === "RUNE" ? "RUNE_UPDATE" : "ITEM_UPDATE",
    targetType,
    targetName: locale === "en" ? getEnglishItemRuneName(item.targetName) || item.targetName : item.targetName,
    localizedName,
    iconUrl: target.iconUrl || "",
    changeType,
    trend: changeType === "REWORK" ? "ADJUST" : changeType,
    statChanges,
    synergyImpact: buildSynergy(target, statChanges, locale),
    actionableVerdict: buildVerdict(changeType, targetType, statChanges, locale),
    locale,
    outputLanguage: locale,
    storyboard: locale === "en" ? [
      { text: `${localizedName} patch update\nCheck the exact stat change`, tag: "HOOK" },
      { text: "One stat at a time\njudge timing, not labels", tag: "STAT_REVEAL" },
      { text: "Impacted champions shift\nbecause their setup timing changes", tag: "IMPACT" },
      { text: "Verdict: retest priority\nbefore forcing old builds", tag: "CONCLUSION_CTA" },
    ] : [
      { text: `${localizedName}版本改動\n先看精準數值`, tag: "HOOK" },
      { text: "一項一項看\n重點是節奏不是標籤", tag: "STAT_REVEAL" },
      { text: "受影響英雄會變\n因為配置時間點改了", tag: "IMPACT" },
      { text: "結論：重測優先級\n不要直接套舊版本", tag: "CONCLUSION_CTA" },
    ],
  };
}

module.exports = {
  buildChampionFallbackPayload,
  buildItemRunePayload,
  buildSystemPayload,
  filterStatChanges,
  filterSystemStatChanges,
  localizeStatChange,
  buildVerdict,
  buildSystemVerdict,
  buildSynergy,
};
