const test = require("node:test");
const assert = require("node:assert/strict");

test("Data Dragon exposes a champion square, splash, Smite, and map image", async (t) => {
  if (process.env.RUN_EXTERNAL_CONTRACTS !== "1") {
    return t.skip("Set RUN_EXTERNAL_CONTRACTS=1 to verify the live Data Dragon boundary.");
  }
  const urls = [
    "https://ddragon.leagueoflegends.com/cdn/16.9.1/img/champion/XinZhao.png",
    "https://ddragon.leagueoflegends.com/cdn/img/champion/splash/XinZhao_0.jpg",
    "https://ddragon.leagueoflegends.com/cdn/16.9.1/img/spell/SummonerSmite.png",
    "https://ddragon.leagueoflegends.com/cdn/16.9.1/img/map/map11.png",
  ];
  for (const url of urls) {
    const response = await fetch(url);
    assert.equal(response.ok, true, url);
    assert.match(response.headers.get("content-type") || "", /^image\//, url);
    assert.ok((await response.arrayBuffer()).byteLength > 1000, url);
  }
});
