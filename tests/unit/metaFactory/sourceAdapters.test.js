const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "../../..");

test("Lolalytics build paths are decoded once at the HTML boundary", () => {
  const source = fs.readFileSync(
    path.join(ROOT, "utils/metaFactory/sourceAdapters/lolalyticsAdapter.js"),
    "utf8"
  );

  assert.doesNotMatch(source, /rawPath\.replace\(\/&amp;\/g/);
});

test("normalizeLolalyticsRows converts champion role stats into internal meta rows", () => {
  const { normalizeLolalyticsRows } = require(path.join(ROOT, "utils/metaFactory/sourceAdapters/lolalyticsAdapter.js"));

  const result = normalizeLolalyticsRows([
    {
      champion: "Velkoz",
      lane: "support",
      tier: "diamond_plus",
      games: "18420",
      winrate: "52.8",
      pickrate: "2.1",
      banrate: "0.8",
      baselineWinrate: "50.1",
      primaryLane: "middle",
      patch: "16.12",
      region: "global",
      builds: [{ name: "Seraphs Embrace", winrate: "55.1", games: "1220" }],
      runes: [{ name: "First Strike", winrate: "54.2", games: "980" }],
      summoners: [{ name: "Barrier", winrate: "53.9", games: "760" }],
    },
  ], { rankPreset: "diamond_plus", patch: "16.12", region: "global" });

  assert.equal(result.sourceStatus.status, "ready");
  assert.equal(result.rows.length, 1);
  assert.deepEqual(result.rows[0], {
    champion: "Velkoz",
    role: "Support",
    rankPreset: "diamond_plus",
    sampleSize: 18420,
    winRate: 52.8,
    pickRate: 2.1,
    banRate: 0.8,
    baselineWinRate: 50.1,
    primaryRole: "Mid",
    patch: "16.12",
    region: "global",
    builds: [{ name: "Seraphs Embrace", winRate: 55.1, sampleSize: 1220 }],
    runes: [{ name: "First Strike", winRate: 54.2, sampleSize: 980 }],
    summonerSpells: [{ name: "Barrier", winRate: 53.9, sampleSize: 760 }],
  });
});

test("fetchLolalyticsRows reports unavailable source instead of producing bad candidates", async () => {
  const { fetchLolalyticsRows } = require(path.join(ROOT, "utils/metaFactory/sourceAdapters/lolalyticsAdapter.js"));

  const result = await fetchLolalyticsRows({ patch: "16.12" }, { fetchImpl: null });

  assert.equal(result.sourceStatus.status, "unavailable");
  assert.equal(result.sourceStatus.provider, "LoLalytics");
  assert.deepEqual(result.rows, []);
});

test("fetchLolalyticsRows can fetch and normalize LoLalytics SSR tier rows without an injected source parser", async () => {
  const { fetchLolalyticsRows } = require(path.join(ROOT, "utils/metaFactory/sourceAdapters/lolalyticsAdapter.js"));
  const html = `
    <a href="/lol/ahri/build/"><img alt="Ahri" src="/champx46/ahri.webp" /></a>
    <div><a href="/lol/ahri/build/">Ahri</a></div>
    <div>S</div>
    <img alt="middle lane" src="/lane27/middle.webp" />96.33
    <span>52.49</span><br><span>+1.68</span>
    <div>10.05</div><div>3.94</div><div>7</div><div>222,036</div>
    <a href="/lol/katarina/build/"><img alt="Katarina" src="/champx46/katarina.webp" /></a>
    <div><a href="/lol/katarina/build/">Katarina</a></div>
    <div>S+</div>
    <img alt="middle lane" src="/lane27/middle.webp" />89.21
    <span>52.87</span><br><span>+1.72</span>
    <div>7.22</div><div>12.07</div><div>9</div><div>159,463</div>
  `;

  const result = await fetchLolalyticsRows({
    patch: "16.12",
    region: "global",
    position: "Mid",
    rankPreset: "emerald_plus",
  }, {
    fetchImpl: async (url) => ({
      ok: true,
      status: 200,
      url,
      text: async () => html,
    }),
  });

  assert.equal(result.sourceStatus.provider, "LoLalytics");
  assert.equal(result.sourceStatus.status, "ready");
  assert.equal(result.rows.length, 2);
  assert.deepEqual(result.rows[0], {
    champion: "Ahri",
    role: "Mid",
    rankPreset: "emerald_plus",
    sampleSize: 222036,
    winRate: 52.49,
    pickRate: 10.05,
    banRate: 3.94,
    baselineWinRate: 50.81,
    primaryRole: "Mid",
    patch: "16.12",
    region: "global",
    builds: [],
    runes: [],
    summonerSpells: [],
  });
});

test("fetchLolalyticsRows follows champion build pages and extracts core items and runes", async () => {
  const { fetchLolalyticsRows } = require(path.join(ROOT, "utils/metaFactory/sourceAdapters/lolalyticsAdapter.js"));
  const requestedUrls = [];
  const tierHtml = `
    <a href="/lol/ahri/build/"><img alt="Ahri" src="/champx46/ahri.webp" /></a>
    <div><a href="/lol/ahri/build/">Ahri</a></div>
    <div>S</div>
    <img alt="middle lane" src="/lane27/middle.webp" />94.10
    <span>52.49</span><br><span>+1.68</span>
    <div>10.05</div><div>3.94</div><div>7</div><div>222,036</div>
  `;
  const detailHtml = `
    <section>
      <h2>Ahri Build</h2>
      <div>Starting Items</div>
      <img src="https://cdn5.lolalytics.com/item64/1055.webp" alt="Doran&#39;s Blade" />
      <strong>51.11</strong><span>30,000</span>
      <div>Item 1</div>
      <img src="https://cdn5.lolalytics.com/item64/6655.webp" alt="Luden&#39;s Companion" />
      <strong>53.22</strong><span>12,345</span>
      <div>Item 2</div>
      <img src="https://cdn5.lolalytics.com/item64/3020.webp" alt="Sorcerer&#39;s Shoes" />
      <strong>52.80</strong><span>44,123</span>
      <h2>Ahri Runes</h2>
      <img src="https://cdn5.lolalytics.com/runes/8214.webp" alt="Summon Aery" />
      <strong>54.12</strong><span>9,876</span>
      <img class="grayscale opacity-70" src="https://cdn5.lolalytics.com/runes/8128.webp" alt="Dark Harvest" />
      <strong>50.00</strong><span>1,111</span>
      <img src="https://cdn5.lolalytics.com/runes/8226.webp" alt="Manaflow Band" />
      <strong>53.40</strong><span>8,765</span>
    </section>
  `;

  const result = await fetchLolalyticsRows({
    patch: "16.12",
    region: "global",
    position: "Mid",
    rankPreset: "emerald_plus",
  }, {
    fetchImpl: async (url) => {
      requestedUrls.push(String(url));
      return {
        ok: true,
        status: 200,
        text: async () => String(url).includes("/lol/ahri/build/") ? detailHtml : tierHtml,
      };
    },
  });

  assert.equal(requestedUrls.length, 2);
  assert.match(requestedUrls[1], /\/lol\/ahri\/build\/\?lane=middle/);
  assert.deepEqual(result.rows[0].builds, [
    { name: "Luden's Companion", winRate: 53.22, sampleSize: 12345 },
    { name: "Sorcerer's Shoes", winRate: 52.8, sampleSize: 44123 },
  ]);
  assert.deepEqual(result.rows[0].runes, [
    { name: "Summon Aery", winRate: 54.12, sampleSize: 9876 },
    { name: "Manaflow Band", winRate: 53.4, sampleSize: 8765 },
  ]);
});

test("fetchLolalyticsRows maps the internal all_ranks preset to LoLalytics all tier URLs", async () => {
  const { fetchLolalyticsRows } = require(path.join(ROOT, "utils/metaFactory/sourceAdapters/lolalyticsAdapter.js"));
  const requestedUrls = [];
  const html = `
    <a href="/lol/ahri/build/?lane=middle&amp;tier=all&amp;region=kr"><img alt="Ahri" src="/champx46/ahri.webp" /></a>
    <div><a href="/lol/ahri/build/?lane=middle&amp;tier=all&amp;region=kr">Ahri</a></div>
    <div>S</div>
    <img alt="middle lane" src="/lane27/middle.webp" />23.31
    <span>53.17</span><br><span>+2.79</span>
    <div>30.90</div><div>13</div><div>46,230</div><div>18</div>
  `;

  const result = await fetchLolalyticsRows({
    patch: "16.12",
    region: "kr",
    position: "Mid",
    rankPreset: "all_ranks",
  }, {
    fetchImpl: async (url) => {
      requestedUrls.push(url);
      return {
        ok: true,
        status: 200,
        text: async () => html,
      };
    },
  });

  const url = new URL(requestedUrls[0]);
  assert.equal(url.searchParams.get("tier"), "all");
  assert.equal(url.searchParams.get("region"), "kr");
  assert.equal(result.rows[0].rankPreset, "all_ranks");
  assert.equal(result.rows[0].sampleSize, 46230);
});

test("fetchLolalyticsRows can skip champion detail fetching for tier-only scans", async () => {
  const { fetchLolalyticsRows } = require(path.join(ROOT, "utils/metaFactory/sourceAdapters/lolalyticsAdapter.js"));
  const requestedUrls = [];
  const html = `
    <a href="/lol/ahri/build/"><img alt="Ahri" src="/champx46/ahri.webp" /></a>
    <img alt="middle lane" src="/lane27/middle.webp" />94.10
    <span>52.49</span><br><span>+1.68</span>
    <div>10.05</div><div>3.94</div><div>7</div><div>222,036</div>
  `;

  const result = await fetchLolalyticsRows({
    patch: "16.12",
    position: "Mid",
  }, {
    fetchDetails: false,
    fetchImpl: async (url) => {
      requestedUrls.push(String(url));
      return { ok: true, status: 200, text: async () => html };
    },
  });

  assert.equal(requestedUrls.length, 1);
  assert.deepEqual(result.rows[0].builds, []);
  assert.deepEqual(result.rows[0].runes, []);
});

test("fetchLolalyticsRows keeps tier rows when champion detail fetches fail", async () => {
  const { fetchLolalyticsRows } = require(path.join(ROOT, "utils/metaFactory/sourceAdapters/lolalyticsAdapter.js"));
  const html = `
    <a href="/lol/ahri/build/"><img alt="Ahri" src="/champx46/ahri.webp" /></a>
    <img alt="middle lane" src="/lane27/middle.webp" />94.10
    <span>52.49</span><br><span>+1.68</span>
    <div>10.05</div><div>3.94</div><div>7</div><div>222,036</div>
    <a href="/lol/katarina/build/"><img alt="Katarina" src="/champx46/katarina.webp" /></a>
    <img alt="middle lane" src="/lane27/middle.webp" />89.21
    <span>52.87</span><br><span>+1.72</span>
    <div>7.22</div><div>12.07</div><div>9</div><div>159,463</div>
  `;

  const result = await fetchLolalyticsRows({ patch: "16.12", position: "Mid" }, {
    fetchImpl: async (url) => {
      const value = String(url);
      if (value.includes("/lol/ahri/build/")) {
        return { ok: false, status: 503, text: async () => "" };
      }
      if (value.includes("/lol/katarina/build/")) {
        throw new Error("detail timeout");
      }
      return { ok: true, status: 200, text: async () => html };
    },
  });

  assert.equal(result.sourceStatus.status, "ready");
  assert.equal(result.rows.length, 2);
  assert.deepEqual(result.rows.map((row) => row.builds), [[], []]);
  assert.deepEqual(result.rows.map((row) => row.runes), [[], []]);
});

test("fetchLolalyticsRows reports tier HTTP and thrown fetch failures as unavailable", async () => {
  const { fetchLolalyticsRows } = require(path.join(ROOT, "utils/metaFactory/sourceAdapters/lolalyticsAdapter.js"));

  const httpFailure = await fetchLolalyticsRows({ patch: "16.12" }, {
    fetchImpl: async () => ({ ok: false, status: 404, text: async () => "" }),
  });
  const thrownFailure = await fetchLolalyticsRows({ patch: "16.12" }, {
    fetchImpl: async () => {
      throw new Error("network down");
    },
  });

  assert.equal(httpFailure.sourceStatus.status, "unavailable");
  assert.match(httpFailure.sourceStatus.error, /HTTP 404/);
  assert.deepEqual(httpFailure.rows, []);
  assert.equal(thrownFailure.sourceStatus.status, "unavailable");
  assert.match(thrownFailure.sourceStatus.error, /network down/);
  assert.deepEqual(thrownFailure.rows, []);
});

test("fetchLolalyticsRows normalizes injected empty rawRows fixtures", async () => {
  const { fetchLolalyticsRows } = require(path.join(ROOT, "utils/metaFactory/sourceAdapters/lolalyticsAdapter.js"));

  const result = await fetchLolalyticsRows({ patch: "16.12" }, { rawRows: [] });

  assert.equal(result.sourceStatus.status, "empty");
  assert.equal(result.sourceStatus.provider, "LoLalytics");
  assert.deepEqual(result.rows, []);
});

test("fetchLolalyticsRows ignores inherited rawRows fixtures", async () => {
  const { fetchLolalyticsRows } = require(path.join(ROOT, "utils/metaFactory/sourceAdapters/lolalyticsAdapter.js"));

  const deps = Object.create({ rawRows: [] });
  deps.fetchImpl = null;
  const result = await fetchLolalyticsRows({ patch: "16.12" }, deps);

  assert.equal(result.sourceStatus.status, "unavailable");
  assert.equal(result.sourceStatus.provider, "LoLalytics");
  assert.deepEqual(result.rows, []);
});

test("fetchLolalyticsRows uses injected fetchSource and applies row fallbacks", async () => {
  const { fetchLolalyticsRows } = require(path.join(ROOT, "utils/metaFactory/sourceAdapters/lolalyticsAdapter.js"));
  const requests = [];

  const result = await fetchLolalyticsRows({
    patch: "16.13",
    rankPreset: "master_plus",
    region: "KR",
  }, {
    fetchSource: async (options) => {
      requests.push(options);
      return [
        {
          name: "Brand",
          role: "bot",
          games: "1,240",
          winRate: "bad-number",
          pickRate: "1.8",
          banRate: "0.2",
          averageWinRate: "49.7",
          item: "ignored-row-level-item",
          builds: [{ item: "Liandrys Torment", games: "900" }],
          runes: [{ rune: "Dark Harvest", sampleSize: "700" }],
          summonerSpells: [{ spell: "Flash", winRate: "51.2" }],
        },
      ];
    },
  });

  assert.deepEqual(requests, [{ patch: "16.13", rankPreset: "master_plus", region: "KR" }]);
  assert.equal(result.sourceStatus.status, "ready");
  assert.deepEqual(result.rows[0], {
    champion: "Brand",
    role: "ADC",
    rankPreset: "master_plus",
    sampleSize: 1240,
    winRate: 0,
    pickRate: 1.8,
    banRate: 0.2,
    baselineWinRate: 49.7,
    primaryRole: "ADC",
    patch: "16.13",
    region: "kr",
    builds: [{ name: "Liandrys Torment", winRate: 0, sampleSize: 900 }],
    runes: [{ name: "Dark Harvest", winRate: 0, sampleSize: 700 }],
    summonerSpells: [{ name: "Flash", winRate: 51.2, sampleSize: 0 }],
  });
});
