const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const packageJson = require(path.resolve(__dirname, "../../../package.json"));

test("the persistent dev server uses the Next.js default Turbopack bundler", () => {
  assert.equal(packageJson.scripts.dev, "next dev");
});
