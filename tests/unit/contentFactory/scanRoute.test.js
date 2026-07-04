const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const vm = require("node:vm");
const { createRequire } = require("node:module");

const ROOT = path.resolve(__dirname, "../../..");

function clearModules() {
  [
    "utils/contentFactory/store.js",
    "src/parsers/PatchDataParser.js",
    "app/api/content-factory/scan/route.js",
  ].forEach((file) => {
    delete require.cache[path.join(ROOT, file)];
  });
}

function loadContentFactoryScanRoute() {
  const routePath = path.join(ROOT, "app/api/content-factory/scan/route.js");
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
    .replace(/export\s+async\s+function\s+GET\s*\(/, "async function GET(")
    + "\nmodule.exports = { POST, GET };";

  vm.runInNewContext(source, {
    require: routeRequire,
    module,
    exports: module.exports,
    Response,
  }, { filename: routePath });
  return module.exports;
}

async function withTempContentFactory(callback) {
  const originalCwd = process.cwd();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hvs-content-scan-route-"));
  process.chdir(dir);
  clearModules();
  try {
    return await callback();
  } finally {
    process.chdir(originalCwd);
    clearModules();
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test("content factory scan response only returns items from the scanned patch", async () => {
  await withTempContentFactory(async () => {
    const parserPath = path.join(ROOT, "src/parsers/PatchDataParser.js");
    require.cache[parserPath] = {
      id: parserPath,
      filename: parserPath,
      loaded: true,
      exports: {
        scrapePatchData: async () => ({
          patchUrl: "https://www.leagueoflegends.com/en-us/news/game-updates/league-of-legends-patch-26-13-notes",
          list: [
            {
              dataType: "PATCH",
              championName: "Latest Lower Score",
              changes: [{ ability: "Q", changeDesc: "Changed" }],
            },
          ],
        }),
      },
    };

    const {
      buildPatchItemsFromScanResult,
      upsertPatchItems,
    } = require(path.join(ROOT, "utils/contentFactory/store.js"));
    upsertPatchItems(buildPatchItemsFromScanResult({
      patchUrl: "https://www.leagueoflegends.com/en-us/news/game-updates/league-of-legends-patch-26-10-notes",
      list: [
        {
          dataType: "PATCH",
          championName: "Old High Score",
          changes: [
            { ability: "P", changeDesc: "Changed" },
            { ability: "Q", changeDesc: "Changed" },
            { ability: "W", changeDesc: "Changed" },
            { ability: "E", changeDesc: "Changed" },
            { ability: "R", changeDesc: "Changed" },
          ],
        },
      ],
    }));

    const { POST } = loadContentFactoryScanRoute();
    const response = await POST({ json: async () => ({ projectId: "lol" }) });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.patchUrl, "https://www.leagueoflegends.com/en-us/news/game-updates/league-of-legends-patch-26-13-notes");
    assert.deepEqual(body.items.map((item) => item.patchVersion), ["26.13"]);
    assert.deepEqual(body.items.map((item) => item.targetName), ["Latest Lower Score"]);
    assert.equal(body.stats.total, 2);
  });
});
