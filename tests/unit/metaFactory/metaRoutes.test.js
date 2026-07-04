const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { createRequire } = require("node:module");

const ROOT = path.resolve(__dirname, "../../..");

function loadPostRoute(relativePath) {
  const routePath = path.join(ROOT, relativePath);
  const routeRequire = createRequire(routePath);
  const module = { exports: {} };
  const source = fs.readFileSync(routePath, "utf8")
    .replace(
      /import\s+\{\s*NextResponse\s*\}\s+from\s+['"]next\/server['"];?/,
      `const NextResponse = {
        json(body, init = {}) {
          return new Response(JSON.stringify(body), {
            status: init.status || 200,
            headers: { "content-type": "application/json" },
          });
        },
      };`
    )
    .replace(/export\s+async\s+function\s+POST\s*\(/, "async function POST(")
    + "\nmodule.exports = { POST };";

  vm.runInNewContext(source, {
    require: routeRequire,
    module,
    exports: module.exports,
    Response,
  }, { filename: routePath });
  return module.exports.POST;
}

function malformedJsonRequest() {
  return {
    json: async () => {
      throw new SyntaxError("Unexpected end of JSON input");
    },
  };
}

test("scan route returns 400 for malformed JSON bodies", async () => {
  const POST = loadPostRoute("app/api/meta-factory/scan/route.js");

  const response = await POST(malformedJsonRequest());
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.deepEqual(body, { success: false, error: "Malformed JSON body." });
});

test("render route returns 400 for malformed JSON bodies", async () => {
  const POST = loadPostRoute("app/api/meta-factory/render/route.js");

  const response = await POST(malformedJsonRequest());
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.deepEqual(body, { success: false, error: "Malformed JSON body." });
});
