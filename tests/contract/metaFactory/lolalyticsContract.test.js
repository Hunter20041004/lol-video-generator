const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "../../..");

test("LoLalytics current page remains reachable for manual contract checks", async (t) => {
  if (process.env.RUN_EXTERNAL_CONTRACTS !== "1") {
    t.skip("Set RUN_EXTERNAL_CONTRACTS=1 to verify the live LoLalytics boundary.");
  }

  const response = await fetch("https://lolalytics.com/lol/tierlist/");
  assert.equal(response.ok, true);
  const html = await response.text();
  assert.match(html, /LoLalytics|tier/i);
});

test("LoLalytics build detail pages expose parseable core items and runes", async (t) => {
  if (process.env.RUN_EXTERNAL_CONTRACTS !== "1") {
    t.skip("Set RUN_EXTERNAL_CONTRACTS=1 to verify the live LoLalytics boundary.");
  }

  const {
    buildLolalyticsBuildUrl,
    extractLolalyticsBuildDetailsFromHtml,
  } = require(path.join(ROOT, "utils/metaFactory/sourceAdapters/lolalyticsAdapter.js"));

  const response = await fetch(buildLolalyticsBuildUrl({
    champion: "Fizz",
    role: "Mid",
    rankPreset: "emerald_plus",
    patch: "16.12",
    region: "global",
  }));
  assert.equal(response.ok, true);

  const html = await response.text();
  const details = extractLolalyticsBuildDetailsFromHtml(html);

  assert.equal(details.builds.some((item) => item.name === "Lich Bane" || item.name === "Zhonya's Hourglass"), true);
  assert.equal(details.runes.some((rune) => rune.name === "Electrocute"), true);
});
