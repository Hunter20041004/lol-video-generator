const assert = require("node:assert/strict");
const test = require("node:test");

const {
  buildLocalizedAnalysis,
  defaultAnalyzeFn,
} = require("../../../utils/contentFactory/analysisBuilder");

test("buildLocalizedAnalysis returns bilingual champion analysis from analyzer", async () => {
  const item = {
    id: "champion-galio",
    category: "CHAMPION",
    targetName: "Galio",
    localizedName: "加里歐",
    patchVersion: "26.10",
    payload: { dataType: "PATCH", championName: "Galio", changeDesc: "Q Damage 10 -> 12" },
  };
  const calls = [];
  const analysis = await buildLocalizedAnalysis("http://localhost:3000", item, {
    analyzeFn: async (origin, payload, locale) => {
      calls.push({ origin, payload, locale });
      return {
        dataType: "PATCH",
        championName: payload.championName,
        storyboard: [{ tag: "HOOK", text: locale === "en" ? "Galio update" : "加里歐改動" }],
      };
    },
  });

  assert.equal(analysis.championName, "Galio");
  assert.equal(analysis.locale, "zh");
  assert.deepEqual(Object.keys(analysis.localizedPayloads), ["zh", "en"]);
  assert.equal(analysis.localizedPayloads.en.locale, "en");
  assert.equal(analysis.localizedPayloads.zh.patchVersion, "26.10");
  assert.equal(analysis.localizedPayloads.en.patchVersion, "26.10");
  assert.deepEqual(calls.map((call) => call.locale).sort(), ["en", "zh"]);
});

test("buildLocalizedAnalysis falls back for champion preview when analyzer fails", async () => {
  const item = {
    id: "champion-quinn",
    category: "CHAMPION",
    targetName: "Quinn",
    localizedName: "葵恩",
    changeType: "BUFF",
    payload: { dataType: "PATCH", championName: "Quinn", ability: "Q", changeDesc: "Attack Damage 60 -> 62" },
  };
  const analysis = await buildLocalizedAnalysis("http://localhost:3000", item, {
    analyzeFn: async () => {
      throw new Error("Gemma unavailable");
    },
  });

  assert.equal(analysis.dataType, "PATCH");
  assert.equal(analysis.championName, "Quinn");
  assert.equal(analysis.localizedPayloads.zh.localizedChampionName, "葵恩");
  assert.equal(analysis.localizedPayloads.en.championName, "Quinn");
});

test("buildLocalizedAnalysis builds item and rune preview payloads without analyzer calls", async () => {
  let callCount = 0;
  const item = {
    id: "rune-stormsurge",
    category: "RUNE",
    targetName: "風暴浪湧",
    localizedName: "風暴浪湧",
    patchVersion: "26.10",
    changeType: "BUFF",
    payload: {
      targetName: "風暴浪湧",
      statChanges: [
        { metricName: "Move Speed", beforeValue: "40%", afterValue: "48%", trend: "BUFF" },
      ],
    },
  };

  const analysis = await buildLocalizedAnalysis("http://localhost:3000", item, {
    analyzeFn: async () => {
      callCount += 1;
      throw new Error("should not be called");
    },
  });

  assert.equal(callCount, 0);
  assert.equal(analysis.dataType, "RUNE_UPDATE");
  assert.equal(analysis.localizedPayloads.zh.patchVersion, "26.10");
  assert.equal(analysis.localizedPayloads.en.patchVersion, "26.10");
  assert.equal(analysis.localizedPayloads.zh.statChanges[0].metricName, "跑速");
  assert.equal(analysis.localizedPayloads.en.localizedName, "Stormsurge");
});

test("buildLocalizedAnalysis rejects missing content factory items", async () => {
  await assert.rejects(
    () => buildLocalizedAnalysis("http://localhost:3000", null),
    /Valid content factory item is required/
  );
});

test("defaultAnalyzeFn posts to analyze API and returns parsed data", async () => {
  const originalFetch = global.fetch;
  global.fetch = async (url, init) => {
    assert.equal(url, "http://localhost:3000/api/analyze");
    assert.equal(init.method, "POST");
    assert.equal(JSON.parse(init.body).locale, "zh");
    return {
      ok: true,
      json: async () => ({ success: true, data: { dataType: "PATCH", championName: "Galio" } }),
    };
  };

  try {
    const data = await defaultAnalyzeFn("http://localhost:3000", { dataType: "PATCH" }, "zh");
    assert.equal(data.championName, "Galio");
  } finally {
    global.fetch = originalFetch;
  }
});

test("defaultAnalyzeFn rejects non-loopback origins before fetch", async () => {
  const originalFetch = global.fetch;
  let called = false;
  global.fetch = async () => {
    called = true;
    throw new Error("must not fetch");
  };

  try {
    await assert.rejects(
      () => defaultAnalyzeFn("https://attacker.example", {}, "zh"),
      /loopback origin/
    );
    assert.equal(called, false);
  } finally {
    global.fetch = originalFetch;
  }
});

test("defaultAnalyzeFn rejects malformed loopback-looking IPv4 origins", async () => {
  const originalFetch = global.fetch;
  let called = false;
  global.fetch = async () => {
    called = true;
    throw new Error("must not fetch");
  };

  try {
    await assert.rejects(
      () => defaultAnalyzeFn("http://127.999.1.1:3000", {}, "zh"),
      /loopback origin/
    );
    assert.equal(called, false);
  } finally {
    global.fetch = originalFetch;
  }
});

test("defaultAnalyzeFn surfaces API error messages", async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => ({
    ok: false,
    json: async () => ({ success: false, error: "model unavailable" }),
  });

  try {
    await assert.rejects(
      () => defaultAnalyzeFn("http://localhost:3000", { dataType: "PATCH" }, "en"),
      /model unavailable/
    );
  } finally {
    global.fetch = originalFetch;
  }
});

test("defaultAnalyzeFn handles malformed API JSON responses", async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => ({
    ok: false,
    json: async () => {
      throw new Error("bad json");
    },
  });

  try {
    await assert.rejects(
      () => defaultAnalyzeFn("http://localhost:3000", { dataType: "PATCH" }, "zh"),
      /Analyze failed for zh/
    );
  } finally {
    global.fetch = originalFetch;
  }
});
