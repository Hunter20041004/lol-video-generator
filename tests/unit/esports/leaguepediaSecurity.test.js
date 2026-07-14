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
