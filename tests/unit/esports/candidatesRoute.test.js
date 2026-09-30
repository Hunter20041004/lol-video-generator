const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { createRequire } = require("node:module");

function load(scanners) {
  const filename = path.resolve(__dirname, "../../../app/api/esports/candidates/route.js");
  const routeRequire = createRequire(filename);
  const module = { exports: {} };
  const source = fs.readFileSync(filename, "utf8")
    .replace(/import.*NextResponse.*from.*;/, "const NextResponse = { json: (body, init = {}) => new Response(JSON.stringify(body), { status: init.status || 200 }) };")
    .replace(/export async function/g, "async function") + "\nmodule.exports = { POST };";
  vm.runInNewContext(source, { module, Response, require: (id) => {
    if (/candidateScanner|rangeScanner/.test(id)) return scanners;
    return routeRequire(id);
  } }, { filename });
  return module.exports.POST;
}

test("candidate endpoint routes ranges while retaining single-day callers", async () => {
  const POST = load({ scanEsportsCandidates: async () => ({ scanId: "single" }), scanEsportsDateRange: async () => ({ scanId: "range" }) });
  assert.equal((await (await POST({ json: async () => ({ date: "2026-09-01" }) })).json()).scanId, "single");
  assert.equal((await (await POST({ json: async () => ({ startDate: "2026-09-01", endDate: "2026-09-02" }) })).json()).scanId, "range");
});

test("invalid JSON shapes reject before calling either source scanner", async () => {
  let calls = 0;
  const POST = load({ scanEsportsCandidates: async () => { calls++; }, scanEsportsDateRange: async () => { calls++; } });
  for (const body of [null, [], "2026-09-01", 42]) {
    const response = await POST({ json: async () => body });
    assert.equal(response.status, 400);
  }
  assert.equal(calls, 0);
});
