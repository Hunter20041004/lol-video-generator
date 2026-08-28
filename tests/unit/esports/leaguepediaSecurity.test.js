const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const ROOT = path.resolve(__dirname, "../../..");
const ORIGINAL_CWD = process.cwd();

test.beforeEach(() => {
  process.chdir(fs.mkdtempSync(path.join(os.tmpdir(), "leaguepedia-security-")));
});

test.afterEach(() => {
  process.chdir(ORIGINAL_CWD);
});

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

    assert.match(where, /ScoreboardGames\.Tournament LIKE 'LCK\/%'/);
    assert.match(where, /ScoreboardGames\.DateTime_UTC >= '2026-08-27 00:00:00'/);
    assert.match(where, /ScoreboardGames\.DateTime_UTC < '2026-08-28 00:00:00'/);
  } finally {
    global.fetch = originalFetch;
  }
});

test("fetchMatchesForDate keeps league abbreviations from matching unrelated tournaments", async () => {
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
    await fetchMatchesForDate("2026-08-27", "LPL");
    const where = new URL(requestedUrl).searchParams.get("where");

    assert.match(where, /ScoreboardGames\.Tournament = 'LPL'/);
    assert.match(where, /ScoreboardGames\.Tournament LIKE 'LPL %'/);
    assert.match(where, /ScoreboardGames\.Tournament LIKE 'LPL\/%'/);
    assert.doesNotMatch(where, /LIKE '%LPL%'/);
  } finally {
    global.fetch = originalFetch;
  }
});

test("fetchTierOneMatchesForDate combines the exact UTC date with the global registry predicate", async () => {
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
    const { fetchTierOneMatchesForDate } = require(path.join(ROOT, "utils/leaguepediaApi.js"));
    await fetchTierOneMatchesForDate("2026-08-27");
    const url = new URL(requestedUrl);
    const where = url.searchParams.get("where");

    assert.match(where, /ScoreboardGames\.Tournament = 'LCK'/);
    assert.match(where, /ScoreboardGames\.Tournament LIKE 'CBLOL %'/);
    assert.match(where, /ScoreboardGames\.Tournament = '2026 First Stand'/);
    assert.match(where, /ScoreboardGames\.Tournament LIKE 'World Championship %'/);
    assert.match(where, /ScoreboardGames\.DateTime_UTC >= '2026-08-27 00:00:00'/);
    assert.match(where, /ScoreboardGames\.DateTime_UTC < '2026-08-28 00:00:00'/);
    assert.equal(url.searchParams.get("limit"), "50");
  } finally {
    global.fetch = originalFetch;
  }
});
