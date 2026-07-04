const test = require("node:test");
const assert = require("node:assert/strict");

const { parsePatchHtml } = require("../../../src/parsers/PatchDataParser");

test("parsePatchHtml extracts role quest systems and split support item/rune blocks", async () => {
  const html = `
    <div class="richText">
      <h2>Role Quest Adjustments</h2>
      <h4>Mid Role Quest</h4>
      <p>Buffing the Role Quest reward.</p>
      <ul><li>Bonus AD and AP: 6% ⇒ 8%</li></ul>

      <h2>Support Adjustments</h2>
      <div class="patch-change-block">
        <div>
          <p>We are taking a holistic pass on the support meta.</p>
          <ul>
            <li>Damage Per Tick, Per Grub: 3 / 9 / 12 ⇒ 4 / 12 / 16</li>
          </ul>
          <h3>Summon Aery</h3>
          <p>Early defensive output is being tapped down.</p>
          <ul><li>Shielding: 30 - 100 ⇒ 20 - 100</li></ul>
          <h3>Imperial Mandate</h3>
          <p>Mandate is getting reworked.</p>
          <ul>
            <li>Ability Power: 60 ⇒ 65</li>
            <li>Ability Haste: 20 ⇒ 15</li>
          </ul>
        </div>
      </div>

      <h2>Items</h2>
      <div class="patch-change-block">
        <div>
          <h3>Heartsteel</h3>
          <p>Heartsteel has fallen off.</p>
          <ul><li>HP Conversion: 8% ⇒ 10%</li></ul>
          <h3>Statikk Shiv</h3>
          <p>Shiv is getting more AD.</p>
          <ul><li>Attack Damage: 40 ⇒ 45</li></ul>
        </div>
      </div>
    </div>
  `;

  const result = await parsePatchHtml(html, {
    patchUrl: "https://www.leagueoflegends.com/en-us/news/game-updates/league-of-legends-patch-26-11-notes/",
    enrich: false,
  });

  assert.deepEqual(result.systemChanges.map((item) => item.targetName), ["Mid Role Quest", "Support Adjustments"]);
  assert.deepEqual(result.runeChanges.map((item) => item.targetName), ["Summon Aery"]);
  assert.deepEqual(result.itemChanges.map((item) => item.targetName), ["Imperial Mandate", "Heartsteel", "Statikk Shiv"]);
  assert.equal(result.systemChanges[0].statChanges[0].beforeValue, "6%");
  assert.equal(result.runeChanges[0].statChanges[0].metricName, "Shielding");
  assert.equal(result.itemChanges[0].changeType, "ADJUST");
});
