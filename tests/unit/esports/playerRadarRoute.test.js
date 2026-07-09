const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { createRequire } = require("node:module");

const ROOT = path.resolve(__dirname, "../../..");

function loadPostRouteWithRunner(runPlayerRadarFromSnapshot) {
  const routePath = path.join(ROOT, "app/api/esports/player-radar/route.js");
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

  function requireWithRunner(id) {
    if (id === "../../../../utils/esports/playerRadarRunner") {
      return { runPlayerRadarFromSnapshot };
    }
    return routeRequire(id);
  }

  vm.runInNewContext(source, {
    require: requireWithRunner,
    module,
    exports: module.exports,
    Response,
  }, { filename: routePath });
  return module.exports.POST;
}

test("player radar route returns 400 for evidence validation failures", async () => {
  const POST = loadPostRouteWithRunner(async () => {
    throw new Error("Player Radar matchup segment needs at least 2 verifiable reasons for Mid.");
  });

  const response = await POST({ json: async () => ({ seriesId: "series-1" }) });
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.equal(body.success, false);
  assert.equal(body.code, "ESPORTS_PIPELINE_ERROR");
  assert.equal(body.status, 400);
  assert.equal(body.recoverable, false);
  assert.equal(body.userMessage, "選手雷達產生失敗。");
  assert.equal(body.error, "Player Radar matchup segment needs at least 2 verifiable reasons for Mid.");
});
