const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { createRequire } = require("node:module");

const ROOT = path.resolve(__dirname, "../../..");

function loadPostRoute({
  createPublishJobs = async () => ({ success: true }),
  preflightPublishJobs = () => ({}),
  ensurePublicMediaBaseUrl = async () => ({ skipped: true }),
  validatePublishRequest = () => ({ dataType: "PLAYER_RADAR", platforms: ["instagram"] }),
} = {}) {
  const routePath = path.join(ROOT, "app/api/publish/route.js");
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
    .replace(/export\s+async\s+function\s+GET\s*\(/, "async function GET(")
    .replace(/export\s+async\s+function\s+POST\s*\(/, "async function POST(")
    + "\nmodule.exports = { GET, POST };";

  function requireWithStubs(id) {
    if (id === "../../../utils/publishing") return { createPublishJobs, preflightPublishJobs };
    if (id === "../../../utils/publishing/tunnel") return { ensurePublicMediaBaseUrl };
    if (id === "../../../utils/apiGuards") return { validatePublishRequest };
    return routeRequire(id);
  }

  vm.runInNewContext(source, {
    require: requireWithStubs,
    module,
    exports: module.exports,
    Response,
    console,
  }, { filename: routePath });
  return module.exports.POST;
}

test("publish route preflights player radar locale payloads before public media setup", async () => {
  let tunnelCalls = 0;
  let createCalls = 0;
  const error = new Error("Player Radar localized payload missing for locale: en");
  const POST = loadPostRoute({
    preflightPublishJobs: () => {
      throw error;
    },
    ensurePublicMediaBaseUrl: async () => {
      tunnelCalls += 1;
      return { skipped: false };
    },
    createPublishJobs: async () => {
      createCalls += 1;
      return { success: true };
    },
  });

  const response = await POST({
    json: async () => ({
      videos: [
        { locale: "zh", videoUrl: "/renders/clip-zh.mp4" },
        { locale: "en", videoUrl: "/renders/clip-en.mp4" },
      ],
      analysis: { dataType: "PLAYER_RADAR" },
      platforms: ["instagram"],
    }),
  });
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.equal(body.error, "Player Radar localized payload missing for locale: en");
  assert.equal(tunnelCalls, 0);
  assert.equal(createCalls, 0);
});

test("publish route preserves top-level player radar analysis through preflight and queue creation", async () => {
  const received = [];
  const POST = loadPostRoute({
    preflightPublishJobs: (request) => {
      received.push(["preflight", request.analysis?.dataType]);
    },
    createPublishJobs: async (request) => {
      received.push(["create", request.analysis?.dataType]);
      return { success: true, jobs: [] };
    },
  });

  const response = await POST({
    json: async () => ({
      dataType: "PLAYER_RADAR",
      locale: "zh",
      videoUrl: "/renders/player-radar.mp4",
      platforms: ["instagram"],
    }),
  });

  assert.equal(response.status, 200);
  assert.deepEqual(received, [
    ["preflight", "PLAYER_RADAR"],
    ["create", "PLAYER_RADAR"],
  ]);
});
