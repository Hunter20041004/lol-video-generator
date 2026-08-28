const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const ROOT = path.resolve(__dirname, "../../..");

test("Leaguepedia authentication logs no account identifier", () => {
  const source = fs.readFileSync(
    path.join(ROOT, "utils/leaguepediaApi.js"),
    "utf8"
  );

  assert.doesNotMatch(source, /console\.log\([^\n]*username_returned/);
});

test("fetchMatchesForDate bounds the Cargo query to the selected UTC date", async () => {
  const originalFetch = global.fetch;
  let requestedUrl = "";
  global.fetch = async (url) => {
    requestedUrl = String(url);
    return {
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => ({ cargoquery: [] }),
    };
  };

  try {
    const { fetchMatchesForDate } = require(path.join(ROOT, "utils/leaguepediaApi.js"));
    await fetchMatchesForDate("2026-08-27", "LCK");
    const where = new URL(requestedUrl).searchParams.get("where");

    assert.match(where, /ScoreboardGames\.Tournament LIKE '%LCK%'/);
    assert.match(where, /ScoreboardGames\.DateTime_UTC >= '2026-08-27 00:00:00'/);
    assert.match(where, /ScoreboardGames\.DateTime_UTC < '2026-08-28 00:00:00'/);
  } finally {
    global.fetch = originalFetch;
  }
});
