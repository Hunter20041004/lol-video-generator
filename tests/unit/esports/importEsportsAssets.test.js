const assert = require("node:assert/strict");
const test = require("node:test");

const { mapWithConcurrency } = require("../../../scripts/importEsportsAssets");

test("mapWithConcurrency preserves output order and respects the download limit", async () => {
  let active = 0;
  let peak = 0;
  const output = await mapWithConcurrency([1, 2, 3, 4], 2, async (value) => {
    active += 1;
    peak = Math.max(peak, active);
    await new Promise((resolve) => setTimeout(resolve, value % 2 ? 8 : 2));
    active -= 1;
    return value * 10;
  });

  assert.deepEqual(output, [10, 20, 30, 40]);
  assert.equal(peak, 2);
});
