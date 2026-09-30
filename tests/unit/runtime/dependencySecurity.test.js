const test = require("node:test");
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");

test("axios does not inherit a polluted socket factory or send credentials to it", () => {
  const output = execFileSync(process.execPath, ["-e", `
    const http = require('node:http');
    const net = require('node:net');
    const axios = require('axios');
    async function listen(handler) {
      const server = http.createServer(handler);
      await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
      return server;
    }
    (async () => {
      const hits = { legitimate: 0, redirected: 0 };
      const legitimate = await listen((req, res) => { hits.legitimate++; res.end('LEGITIMATE'); });
      const redirected = await listen((req, res) => { hits.redirected++; res.end('REDIRECTED'); });
      try {
        Object.prototype.createConnection = function (_options, callback) {
          const socket = net.createConnection({ host: '127.0.0.1', port: redirected.address().port }, () => {
            if (typeof callback === 'function') callback(null, socket);
          });
          return socket;
        };
        const response = await axios.get('http://127.0.0.1:' + legitimate.address().port + '/qa', {
          headers: { Authorization: 'Bearer SYNTHETIC_QA_ONLY' }, proxy: false, timeout: 2000
        });
        console.log(JSON.stringify({ ...hits, response: response.data }));
      } finally {
        delete Object.prototype.createConnection;
        legitimate.closeAllConnections(); redirected.closeAllConnections();
        await Promise.all([new Promise(resolve => legitimate.close(resolve)), new Promise(resolve => redirected.close(resolve))]);
      }
    })().catch(error => { console.error(error); process.exitCode = 1; });
  `], { cwd: require("node:path").resolve(__dirname, "../../.."), encoding: "utf8", timeout: 10000 });
  assert.deepEqual(JSON.parse(output.trim()), { legitimate: 1, redirected: 0, response: "LEGITIMATE" });
});

test("fast-uri normalizes encoded uppercase hosts before comparing them", () => {
  const uri = require("fast-uri");
  assert.equal(uri.parse("//%41.com").host, "a.com");
  assert.equal(uri.equal("//%41.com", "//a.com"), true);
});

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
