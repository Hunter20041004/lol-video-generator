const test = require("node:test");
const assert = require("node:assert/strict");

const leaguepedia = require("../../utils/leaguepediaApi");
const {
  clearSourceCooldown,
  readStore,
  readSourceCooldown,
  recordSourceCooldown,
} = require("../../utils/esports/sourceCooldown");

test("cargoQuery records a Leaguepedia cooldown when Fandom returns a rate-limit error", async () => {
  clearSourceCooldown("leaguepedia");
  const originalFetch = global.fetch;
  let fetchCalls = 0;

  global.fetch = async () => {
    fetchCalls += 1;
    return {
      ok: true,
      headers: { get: () => "" },
      json: async () => ({
        error: { info: "You've exceeded your rate limit. Please wait some time and try again." },
      }),
    };
  };

  try {
    await assert.rejects(
      () => leaguepedia.cargoQuery({ tables: "ScoreboardGames", fields: "GameId", limit: 1 }),
      /exceeded your rate limit/
    );

    const cooldown = readSourceCooldown("leaguepedia");
    assert.equal(fetchCalls, 1);
    assert.equal(cooldown.active, true);
    assert.equal(cooldown.reason, "rate_limit");
    assert.equal(cooldown.retryAfterSeconds > 0, true);
  } finally {
    global.fetch = originalFetch;
    clearSourceCooldown("leaguepedia");
  }
});

test("cargoQuery short-circuits active Leaguepedia cooldown before fetching", async () => {
  clearSourceCooldown("leaguepedia");
  const originalFetch = global.fetch;
  let fetchCalls = 0;

  global.fetch = async () => {
    fetchCalls += 1;
    throw new Error("fetch should not run while source cooldown is active");
  };

  try {
    recordSourceCooldown("leaguepedia", {
      cooldownMs: 15 * 60 * 1000,
      reason: "rate_limit",
    });

    await assert.rejects(
      () => leaguepedia.cargoQuery({ tables: "ScoreboardGames", fields: "GameId", limit: 1 }),
      /Leaguepedia API cooldown active/
    );

    assert.equal(fetchCalls, 0);
  } finally {
    global.fetch = originalFetch;
    clearSourceCooldown("leaguepedia");
  }
});

test("cargoQuery clears Leaguepedia cooldown history after a successful fetch", async () => {
  clearSourceCooldown("leaguepedia");
  const originalFetch = global.fetch;
  const nowMs = Date.now();

  recordSourceCooldown("leaguepedia", {
    attempts: 2,
    nowMs: nowMs - 2 * 60 * 60 * 1000,
    untilMs: nowMs - 60 * 1000,
    reason: "rate_limit",
  });

  global.fetch = async () => ({
    ok: true,
    headers: { get: () => "" },
    json: async () => ({ cargoquery: [] }),
  });

  try {
    const rows = await leaguepedia.cargoQuery({ tables: "ScoreboardGames", fields: "GameId", limit: 1 });
    const store = readStore();

    assert.deepEqual(rows, []);
    assert.equal(store.cooldowns.some((record) => record.source === "leaguepedia"), false);
  } finally {
    global.fetch = originalFetch;
    clearSourceCooldown("leaguepedia");
  }
});

test("cargoQuery authenticates Fandom bot passwords with the legacy login API before Cargo", async () => {
  clearSourceCooldown("leaguepedia");
  leaguepedia.clearSession();
  const originalFetch = global.fetch;
  const originalUsername = process.env.FANDOM_BOT_USERNAME;
  const originalPassword = process.env.FANDOM_BOT_PASSWORD;
  const postActions = [];
  let cargoFetches = 0;

  process.env.FANDOM_BOT_USERNAME = "User@HextechVideoStudio";
  process.env.FANDOM_BOT_PASSWORD = "generated-bot-password";

  global.fetch = async (url, options = {}) => {
    const parsedUrl = new URL(url);
    const action = parsedUrl.searchParams.get("action");
    if (action === "query") {
      return {
        ok: true,
        headers: { get: () => "session=token" },
        json: async () => ({ query: { tokens: { logintoken: "login-token" } } }),
      };
    }
    if (options.method === "POST") {
      const body = new URLSearchParams(options.body);
      postActions.push(body.get("action"));
      if (body.get("action") !== "login") {
        throw new Error(`Expected legacy action=login, got ${body.get("action")}`);
      }
      assert.equal(body.get("lgname"), "User@HextechVideoStudio");
      assert.equal(body.get("lgpassword"), "generated-bot-password");
      assert.equal(body.get("lgtoken"), "login-token");
      return {
        ok: true,
        headers: { get: () => "session=authed" },
        json: async () => ({
          login: {
            result: "Success",
            lgusername: "User",
          },
        }),
      };
    }
    if (action === "cargoquery") {
      cargoFetches += 1;
      assert.match(options.headers?.Cookie || "", /session=authed/);
      return {
        ok: true,
        headers: { get: () => "" },
        json: async () => ({ cargoquery: [] }),
      };
    }
    throw new Error(`Unexpected fetch: ${url}`);
  };

  try {
    const rows = await leaguepedia.cargoQuery({ tables: "ScoreboardGames", fields: "GameId", limit: 1 });

    assert.deepEqual(rows, []);
    assert.deepEqual(postActions, ["login"]);
    assert.equal(cargoFetches, 1);
  } finally {
    global.fetch = originalFetch;
    if (originalUsername === undefined) delete process.env.FANDOM_BOT_USERNAME;
    else process.env.FANDOM_BOT_USERNAME = originalUsername;
    if (originalPassword === undefined) delete process.env.FANDOM_BOT_PASSWORD;
    else process.env.FANDOM_BOT_PASSWORD = originalPassword;
    leaguepedia.clearSession();
    clearSourceCooldown("leaguepedia");
  }
});

test("fetchMatchPlayers requests Leaguepedia DamageToChampions field and normalizes it", async () => {
  clearSourceCooldown("leaguepedia");
  leaguepedia.clearSession();
  const originalFetch = global.fetch;
  const originalUsername = process.env.FANDOM_BOT_USERNAME;
  const originalPassword = process.env.FANDOM_BOT_PASSWORD;
  let requestedFields = "";

  delete process.env.FANDOM_BOT_USERNAME;
  delete process.env.FANDOM_BOT_PASSWORD;

  global.fetch = async (url) => {
    const parsedUrl = new URL(url);
    requestedFields = parsedUrl.searchParams.get("fields") || "";
    assert.equal(parsedUrl.searchParams.get("tables"), "ScoreboardGames,ScoreboardPlayers");
    assert.match(requestedFields, /ScoreboardPlayers\.DamageToChampions/);
    assert.doesNotMatch(requestedFields, /ScoreboardPlayers\.DamageToChamps(?:,|$)/);

    return {
      ok: true,
      headers: { get: () => "" },
      json: async () => ({
        cargoquery: [{
          title: {
            Tournament: "MSI 2026",
            Team1: "T1",
            Team2: "Team Liquid",
            WinTeam: "T1",
            LossTeam: "Team Liquid",
            Gamelength: "30:00",
            "DateTime UTC": "2026-07-08 03:14:00",
            Link: "Faker",
            Name: "Faker",
            Champion: "Azir",
            Role: "Mid",
            Team: "T1",
            Kills: "3",
            Deaths: "1",
            Assists: "8",
            CS: "280",
            Gold: "14000",
            DamageToChampions: "12345",
            VisionScore: "31",
          },
        }],
      }),
    };
  };

  try {
    const result = await leaguepedia.fetchMatchPlayers("game-1");

    assert.match(requestedFields, /DamageToChampions/);
    assert.equal(result.players[0].stats.damageToChampions, "12345");
    assert.equal(result.players[0].damageToChampions, 12345);
  } finally {
    global.fetch = originalFetch;
    if (originalUsername === undefined) delete process.env.FANDOM_BOT_USERNAME;
    else process.env.FANDOM_BOT_USERNAME = originalUsername;
    if (originalPassword === undefined) delete process.env.FANDOM_BOT_PASSWORD;
    else process.env.FANDOM_BOT_PASSWORD = originalPassword;
    leaguepedia.clearSession();
    clearSourceCooldown("leaguepedia");
  }
});

test("cargoQuery stops when configured Fandom bot credentials fail instead of falling back to anonymous Cargo", async () => {
  clearSourceCooldown("leaguepedia");
  leaguepedia.clearSession();
  const originalFetch = global.fetch;
  const originalUsername = process.env.FANDOM_BOT_USERNAME;
  const originalPassword = process.env.FANDOM_BOT_PASSWORD;
  let cargoFetches = 0;

  process.env.FANDOM_BOT_USERNAME = "InvalidBot@HextechBot";
  process.env.FANDOM_BOT_PASSWORD = "bad-password";

  global.fetch = async (url, options = {}) => {
    const parsedUrl = new URL(url);
    const action = parsedUrl.searchParams.get("action");
    if (action === "query") {
      return {
        ok: true,
        headers: { get: () => "" },
        json: async () => ({ query: { tokens: { logintoken: "login-token" } } }),
      };
    }
    if (options.method === "POST") {
      return {
        ok: true,
        headers: { get: () => "" },
        json: async () => ({
          clientlogin: {
            status: "FAIL",
            message: "The supplied credentials could not be authenticated.",
          },
        }),
      };
    }
    if (action === "cargoquery") {
      cargoFetches += 1;
      return {
        ok: true,
        headers: { get: () => "" },
        json: async () => ({ cargoquery: [] }),
      };
    }
    throw new Error(`Unexpected fetch: ${url}`);
  };

  try {
    await assert.rejects(
      () => leaguepedia.cargoQuery({ tables: "ScoreboardGames", fields: "GameId", limit: 1 }),
      (error) => {
        assert.equal(error.code, "LEAGUEPEDIA_AUTH_FAILED");
        assert.equal(error.status, 401);
        assert.match(error.message, /Fandom bot authentication failed/);
        return true;
      }
    );
    assert.equal(cargoFetches, 0);
  } finally {
    global.fetch = originalFetch;
    if (originalUsername === undefined) delete process.env.FANDOM_BOT_USERNAME;
    else process.env.FANDOM_BOT_USERNAME = originalUsername;
    if (originalPassword === undefined) delete process.env.FANDOM_BOT_PASSWORD;
    else process.env.FANDOM_BOT_PASSWORD = originalPassword;
    leaguepedia.clearSession();
    clearSourceCooldown("leaguepedia");
  }
});
