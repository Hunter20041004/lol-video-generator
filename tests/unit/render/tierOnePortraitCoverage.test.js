const test = require("node:test");
const assert = require("node:assert/strict");
const { resolvePlayerPortrait } = require("../../../utils/render/playerPortraitManifest");

test("new verified 2026 regional portraits resolve on their source split dates", () => {
  const registrations = [
    ["Betty", "Ground Zero Gaming", "2026-07-25"],
    ["Chika", "MVK Esports", "2026-04-04"],
    ["Daglas", "Team Heretics", "2026-03-28"],
    ["Fisher (Lee Jeong-tae)", "DetonatioN FocusMe", "2026-04-04"],
    ["Gloryy", "GAM Esports", "2026-07-25"],
    ["Harky", "MVK Esports", "2026-04-04"],
    ["Hype (Byeon Jeong-hyeon)", "Team Heretics", "2026-07-24"],
    ["Kaiwing", "Ground Zero Gaming", "2026-07-25"],
    ["Kino", "CTBC Flying Oyster", "2026-07-25"],
    ["Momo (Sora Tobita)", "DetonatioN FocusMe", "2026-04-04"],
    ["POUT", "CTBC Flying Oyster", "2026-07-25"],
    ["SiuLoong", "MVK Esports", "2026-04-04"],
    ["Steller", "MVK Esports", "2026-04-04"],
    ["Uniboy", "Ground Zero Gaming", "2026-07-25"],
    ["Way (Han Gil)", "Team Heretics", "2026-03-28"],
    ["Woody", "DetonatioN FocusMe", "2026-04-04"],
  ];
  for (const [publicName, team, matchDate] of registrations) {
    const asset = resolvePlayerPortrait({ publicName, team, season: "2026", matchDate });
    assert.equal(asset.team, team);
    assert.match(asset.publicPath, /\.webp$/);
    assert.throws(() => resolvePlayerPortrait({ publicName, team, season: "2026", matchDate: "2026-01-01" }), /not found|valid|date/i);
  }
});
