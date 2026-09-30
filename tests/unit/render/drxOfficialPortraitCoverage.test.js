const test = require("node:test");
const assert = require("node:assert/strict");
const { resolvePlayerPortrait } = require("../../../utils/render/playerPortraitManifest");

test("official DRX portraits use exact registered identities without backdating roster evidence", () => {
  for (const publicName of ["Aiming", "Andil", "Frog (Lee Min-hoi)", "LazyFeel", "Minous", "Rich (Lee Jae-won)", "Ucal", "Willer"]) {
    const identity = { publicName, team: "Kiwoom DRX", season: "2026", matchDate: "2026-09-30" };
    const portrait = resolvePlayerPortrait(identity);
    assert.equal(portrait.sourceUrl.startsWith("https://cdn.imweb.me/"), true);
    assert.equal(portrait.validFrom, "2026-09-30");
    assert.throws(() => resolvePlayerPortrait({ ...identity, matchDate: "2026-01-01" }), /not found|valid|date/i);
  }
});
