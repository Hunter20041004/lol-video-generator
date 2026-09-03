const test = require("node:test");
const assert = require("node:assert/strict");

test("fast-uri resolves scheme-relative IDN hosts consistently with the browser", () => {
  const uri = require("fast-uri");
  const base = "https://example.com/base";
  const reference = "//例子.com/path";
  assert.equal(uri.resolve(base, reference), new URL(reference, base).href);
});

test("browserslist uses the security-patched release and resolves supported targets", () => {
  const browserslist = require("browserslist");
  const [major, minor, patch] = require("browserslist/package.json").version.split(".").map(Number);
  assert.ok(major > 4 || (major === 4 && (minor > 28 || (minor === 28 && patch >= 7))), "browserslist must include the 4.28.7 security fixes");
  assert.deepEqual(browserslist("chrome 120"), ["chrome 120"]);
  const lock = require("../../../package-lock.json");
  assert.equal(lock.packages["node_modules/browserslist"].version, require("browserslist/package.json").version);
});
