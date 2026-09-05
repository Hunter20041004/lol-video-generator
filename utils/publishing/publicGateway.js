const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const CALLBACK_PATHS = new Set([
  "/api/auth/meta/instagram/callback",
  "/api/auth/meta/threads/callback",
]);
const SAFE_MEDIA_PATH = /^\/renders\/([A-Za-z0-9][A-Za-z0-9._-]*\.mp4)$/;

function notFound(response) {
  response.writeHead(404, { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" });
  response.end("Not Found");
}

function createPublicGatewayHandler({ studioOrigin, rendersDir = path.join(process.cwd(), "public", "renders") } = {}) {
  const upstream = new URL(studioOrigin);
  return (request, response) => {
    let url;
    try { url = new URL(request.url, "http://gateway.invalid"); } catch { return notFound(response); }
    if (CALLBACK_PATHS.has(url.pathname)) {
      if (request.method !== "GET") return notFound(response);
      return proxyCallback(request, response, upstream, url);
    }
    const mediaMatch = url.pathname.match(SAFE_MEDIA_PATH);
    if (!mediaMatch || !["GET", "HEAD"].includes(request.method)) return notFound(response);
    return serveMedia(request, response, path.join(rendersDir, mediaMatch[1]));
  };
}

function startPublicGateway({ studioOrigin, host = "127.0.0.1", port = 0, rendersDir } = {}) {
  if (!studioOrigin) throw new Error("studioOrigin is required.");
  const server = http.createServer(createPublicGatewayHandler({ studioOrigin, rendersDir }));
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      server.off("error", reject);
      const address = server.address();
      resolve({
        origin: `http://${host}:${address.port}`,
        close: () => new Promise((done, fail) => server.close((error) => error ? fail(error) : done())),
      });
    });
  });
}

function proxyCallback(_request, response, upstream, url) {
  const outgoing = http.request({
    protocol: upstream.protocol,
    hostname: upstream.hostname,
    port: upstream.port,
    method: "GET",
    path: `${url.pathname}${url.search}`,
    headers: { accept: "text/html,application/json", host: upstream.host },
  }, (incoming) => {
    response.writeHead(incoming.statusCode || 502, {
      "content-type": incoming.headers["content-type"] || "text/plain; charset=utf-8",
      "cache-control": "no-store",
    });
    incoming.pipe(response);
  });
  outgoing.on("error", () => {
    if (!response.headersSent) response.writeHead(502, { "content-type": "text/plain; charset=utf-8" });
    response.end("Bad Gateway");
  });
  outgoing.end();
}

function serveMedia(request, response, filename) {
  let stat;
  try { stat = fs.lstatSync(filename); } catch { return notFound(response); }
  if (!stat.isFile() || stat.isSymbolicLink()) return notFound(response);
  const rangeMatch = String(request.headers.range || "").match(/^bytes=(\d+)-(\d*)$/);
  let start = 0;
  let end = stat.size - 1;
  let status = 200;
  if (request.headers.range) {
    if (!rangeMatch) {
      response.writeHead(416, { "content-range": `bytes */${stat.size}` });
      return response.end();
    }
    start = Number(rangeMatch[1]);
    end = rangeMatch[2] ? Number(rangeMatch[2]) : end;
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= stat.size) {
      response.writeHead(416, { "content-range": `bytes */${stat.size}` });
      return response.end();
    }
    end = Math.min(end, stat.size - 1);
    status = 206;
  }
  const headers = {
    "content-type": "video/mp4",
    "content-length": end - start + 1,
    "accept-ranges": "bytes",
    "cache-control": "private, max-age=0, must-revalidate",
  };
  if (status === 206) headers["content-range"] = `bytes ${start}-${end}/${stat.size}`;
  response.writeHead(status, headers);
  if (request.method === "HEAD") return response.end();
  fs.createReadStream(filename, { start, end }).pipe(response);
}

module.exports = {
  CALLBACK_PATHS,
  SAFE_MEDIA_PATH,
  createPublicGatewayHandler,
  startPublicGateway,
};
