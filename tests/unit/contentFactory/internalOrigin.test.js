const test = require("node:test");
const assert = require("node:assert/strict");
const { resolveInternalOrigin, isLoopbackHost } = require("../../../utils/contentFactory/internalOrigin");

const ORIGINAL_ENV = { ...process.env };

test.afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

test("resolveInternalOrigin keeps loopback request origins", () => {
  assert.equal(resolveInternalOrigin("http://localhost:3000/api/content-factory/publish"), "http://localhost:3000");
  assert.equal(resolveInternalOrigin("http://127.0.0.1:4000/api/content-factory/publish"), "http://127.0.0.1:4000");
});

test("resolveInternalOrigin avoids public tunnel origins for server-side self calls", () => {
  assert.equal(
    resolveInternalOrigin("https://stale-tunnel.trycloudflare.com/api/content-factory/publish", { port: "3100" }),
    "http://localhost:3100"
  );
});

test("resolveInternalOrigin honors explicit internal origin config", () => {
  process.env.CONTENT_FACTORY_INTERNAL_ORIGIN = "http://127.0.0.1:4444/";
  assert.equal(
    resolveInternalOrigin("https://stale-tunnel.trycloudflare.com/api/content-factory/publish"),
    "http://127.0.0.1:4444"
  );
});

test("isLoopbackHost recognizes localhost variants", () => {
  assert.equal(isLoopbackHost("localhost"), true);
  assert.equal(isLoopbackHost("127.12.0.1"), true);
  assert.equal(isLoopbackHost("trycloudflare.com"), false);
});
