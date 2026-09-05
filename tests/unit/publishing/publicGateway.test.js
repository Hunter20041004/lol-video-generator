const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");

const { startPublicGateway } = require("../../../utils/publishing/publicGateway");

function request(origin, pathname, options = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(`${origin}${pathname}`, options, (response) => {
      const chunks = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => resolve({
        status: response.statusCode,
        headers: response.headers,
        body: Buffer.concat(chunks),
      }));
    });
    req.on("error", reject);
    req.end();
  });
}

test("public gateway hides root, Studio APIs, and unknown paths without upstream access", async () => {
  let upstreamHits = 0;
  const upstream = http.createServer((_request, response) => {
    upstreamHits += 1;
    response.end("private");
  });
  await new Promise((resolve) => upstream.listen(0, "127.0.0.1", resolve));
  const upstreamOrigin = `http://127.0.0.1:${upstream.address().port}`;
  const gateway = await startPublicGateway({ studioOrigin: upstreamOrigin, port: 0 });
  try {
    for (const pathname of ["/", "/api/publish", "/api/esports/candidates", "/unknown"]) {
      const response = await request(gateway.origin, pathname);
      assert.equal(response.status, 404);
      assert.equal(response.body.toString(), "Not Found");
    }
    assert.equal(upstreamHits, 0);
  } finally {
    await gateway.close();
    await new Promise((resolve) => upstream.close(resolve));
  }
});

test("public gateway forwards only GET callbacks with sanitized headers", async () => {
  let observed;
  const upstream = http.createServer((request, response) => {
    observed = { method: request.method, url: request.url, headers: request.headers };
    response.writeHead(400, { "content-type": "application/json", "set-cookie": "secret=bad" });
    response.end('{"error":"invalid state"}');
  });
  await new Promise((resolve) => upstream.listen(0, "127.0.0.1", resolve));
  const gateway = await startPublicGateway({
    studioOrigin: `http://127.0.0.1:${upstream.address().port}`, port: 0,
  });
  try {
    const response = await request(
      gateway.origin,
      "/api/auth/meta/instagram/callback?state=opaque&code=provider-code",
      { headers: { authorization: "Bearer hostile", cookie: "hostile=yes", "x-forwarded-host": "hostile" } }
    );
    assert.equal(response.status, 400);
    assert.deepEqual(observed.method, "GET");
    assert.equal(observed.url, "/api/auth/meta/instagram/callback?state=opaque&code=provider-code");
    assert.equal(observed.headers.authorization, undefined);
    assert.equal(observed.headers.cookie, undefined);
    assert.equal(observed.headers["x-forwarded-host"], undefined);
    assert.equal(response.headers["set-cookie"], undefined);
    assert.equal((await request(gateway.origin, "/api/auth/meta/threads/callback", { method: "POST" })).status, 404);
  } finally {
    await gateway.close();
    await new Promise((resolve) => upstream.close(resolve));
  }
});

test("public gateway serves safe MP4 HEAD and byte ranges without listing files", async () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "hvs-gateway-"));
  const rendersDir = path.join(cwd, "renders");
  fs.mkdirSync(rendersDir);
  fs.writeFileSync(path.join(rendersDir, "render_123.mp4"), Buffer.from("0123456789"));
  fs.writeFileSync(path.join(cwd, "private.mp4"), Buffer.from("private"));
  fs.symlinkSync(path.join(cwd, "private.mp4"), path.join(rendersDir, "linked.mp4"));
  const upstream = http.createServer((_request, response) => response.end("unused"));
  await new Promise((resolve) => upstream.listen(0, "127.0.0.1", resolve));
  const gateway = await startPublicGateway({
    studioOrigin: `http://127.0.0.1:${upstream.address().port}`, rendersDir, port: 0,
  });
  try {
    const head = await request(gateway.origin, "/renders/render_123.mp4", { method: "HEAD" });
    assert.equal(head.status, 200);
    assert.equal(head.headers["content-type"], "video/mp4");
    assert.equal(head.headers["content-length"], "10");
    assert.equal(head.body.length, 0);

    const range = await request(gateway.origin, "/renders/render_123.mp4", { headers: { range: "bytes=2-5" } });
    assert.equal(range.status, 206);
    assert.equal(range.headers["content-range"], "bytes 2-5/10");
    assert.equal(range.body.toString(), "2345");

    for (const unsafe of [
      "/renders/", "/renders/sub/render.mp4", "/renders/%2e%2e/secret.mp4",
      "/renders/render.png", "/renders/render_123.mp4/extra", "/renders/linked.mp4",
    ]) assert.equal((await request(gateway.origin, unsafe)).status, 404);
  } finally {
    await gateway.close();
    await new Promise((resolve) => upstream.close(resolve));
  }
});
