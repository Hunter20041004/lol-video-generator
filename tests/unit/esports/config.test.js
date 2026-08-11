const test = require("node:test");
const assert = require("node:assert/strict");

test("resolveActiveMode honors manual MSI mode and excludes regional leagues", () => {
  const { resolveActiveMode } = require("../../../utils/esports/config");

  const result = resolveActiveMode({ activeMode: "msi" }, new Date("2026-06-20T15:30:00.000Z"));

  assert.equal(result.mode, "msi");
  assert.deepEqual(result.leagues, ["MSI"]);
  assert.equal(result.source, "manual");
});

test("resolveActiveMode uses configured auto windows before falling back to regular leagues", () => {
  const { resolveActiveMode } = require("../../../utils/esports/config");

  const worlds = resolveActiveMode({
    activeMode: "auto",
    modeWindows: [{ mode: "worlds", start: "2026-10-01T00:00:00.000Z", end: "2026-11-15T23:59:59.999Z" }],
  }, new Date("2026-10-20T12:00:00.000Z"));
  const regular = resolveActiveMode({
    activeMode: "auto",
    modeWindows: [{ mode: "worlds", start: "2026-10-01T00:00:00.000Z", end: "2026-11-15T23:59:59.999Z" }],
  }, new Date("2026-06-20T12:00:00.000Z"));

  assert.equal(worlds.mode, "worlds");
  assert.deepEqual(worlds.leagues, ["Worlds"]);
  assert.equal(regular.mode, "regular");
  assert.deepEqual(regular.leagues, ["LCK", "LPL"]);
});

test("resolveActiveMode defaults auto to MSI during the 2026 MSI window", () => {
  const { resolveActiveMode } = require("../../../utils/esports/config");

  const result = resolveActiveMode({ activeMode: "auto" }, new Date("2026-07-06T15:30:00.000Z"));

  assert.equal(result.mode, "msi");
  assert.equal(result.source, "auto");
  assert.deepEqual(result.leagues, ["MSI"]);
  assert.deepEqual(result.tournaments, ["MSI", "Mid-Season Invitational"]);
});

test("resolveActiveMode normalizes world aliases and merges custom tournament filters", () => {
  const { normalizeMode, resolveActiveMode } = require("../../../utils/esports/config");

  const result = resolveActiveMode({
    activeMode: "World Championship",
    tournamentFilters: { worlds: ["World Championship 2026"] },
  }, new Date("2026-10-20T12:00:00.000Z"));

  assert.equal(normalizeMode("unknown"), "auto");
  assert.equal(normalizeMode("mid-season invitational"), "msi");
  assert.equal(result.mode, "worlds");
  assert.deepEqual(result.tournaments, ["World Championship 2026"]);
});
