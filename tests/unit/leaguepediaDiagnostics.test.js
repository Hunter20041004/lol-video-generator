const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const api = require('../../utils/leaguepediaApi');

async function observeResponse(status, body, headers = {}) {
  const cwd = process.cwd();
  const originalFetch = global.fetch;
  const originalWarn = console.warn;
  const originalLog = console.log;
  const username = process.env.FANDOM_BOT_USERNAME;
  const password = process.env.FANDOM_BOT_PASSWORD;
  const logs = [];
  let requests = 0;
  let cooldownLogs = [];
  const server = http.createServer((req, res) => {
    requests++;
    res.writeHead(status, headers);
    res.end(body);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  process.chdir(fs.mkdtempSync(path.join(os.tmpdir(), 'leaguepedia-diagnostic-')));
  delete process.env.FANDOM_BOT_USERNAME;
  delete process.env.FANDOM_BOT_PASSWORD;
  api.clearSession();
  global.fetch = () => originalFetch(`http://127.0.0.1:${server.address().port}`);
  console.warn = (...args) => logs.push(args.join(' '));
  // Keep unrelated Cargo progress output off the test runner's IPC stream.
  console.log = () => {};
  try {
    await assert.rejects(() => api.cargoQuery({ tables: 'ScoreboardGames', fields: 'GameId', limit: 1 }));
    const { readSourceCooldown } = require('../../utils/esports/sourceCooldown');
    if (readSourceCooldown('leaguepedia').active) {
      const before = logs.length;
      await assert.rejects(() => api.cargoQuery({ tables: 'ScoreboardGames', fields: 'GameId', limit: 1 }), /cooldown active/);
      cooldownLogs = logs.slice(before);
    }
    return { logs, requests, cooldownLogs };
  } finally {
    global.fetch = originalFetch;
    console.warn = originalWarn;
    console.log = originalLog;
    api.clearSession();
    process.chdir(cwd);
    if (username === undefined) delete process.env.FANDOM_BOT_USERNAME;
    else process.env.FANDOM_BOT_USERNAME = username;
    if (password === undefined) delete process.env.FANDOM_BOT_PASSWORD;
    else process.env.FANDOM_BOT_PASSWORD = password;
    await new Promise(resolve => server.close(resolve));
  }
}

test('HTTP rejection diagnostics retain only safe fixed fields across a real HTTP boundary', async () => {
  const { logs, requests, cooldownLogs } = await observeResponse(429, 'rate limited secret-password', {
    'content-type': 'text/html; secret-token',
    'retry-after': '900',
    'set-cookie': 'session=secret-cookie',
  });
  assert.equal(logs.length, 1);
  const record = JSON.parse(logs[0].replace('[Leaguepedia diagnostic] ', ''));
  assert.deepEqual({ ...record, timestamp: undefined }, {
    timestamp: undefined, stage: 'http', httpStatus: 429, errorCode: null,
    rateLimitSignal: true, contentType: 'html', retryAfterSeconds: 900,
  });
  assert.ok(Number.isFinite(Date.parse(record.timestamp)));
  assert.doesNotMatch(logs.join(''), /secret|session|password|Cookie/i);
  assert.equal(requests, 1);
  assert.deepEqual(cooldownLogs, []);
});

test('MediaWiki rate limit keeps HTTP 200 distinct from the known payload error', async () => {
  const { logs, requests } = await observeResponse(200, JSON.stringify({
    error: { code: 'ratelimited', info: "You've exceeded your rate limit. secret-password" },
  }), { 'content-type': 'application/json', 'retry-after': 'secret-token' });
  assert.equal(logs.length, 1);
  const record = JSON.parse(logs[0].replace('[Leaguepedia diagnostic] ', ''));
  assert.deepEqual({ ...record, timestamp: undefined }, {
    timestamp: undefined, stage: 'mediawiki', httpStatus: 200, errorCode: 'ratelimited',
    rateLimitSignal: true, contentType: 'json', retryAfterSeconds: null,
  });
  assert.doesNotMatch(logs.join(''), /secret/);
  assert.equal(requests, 1);
});

test('unknown codes and ordinary rejections never copy arbitrary response strings', async () => {
  const httpResult = await observeResponse(503, 'secret-body', { 'content-type': 'secret-type' });
  const httpRecord = JSON.parse(httpResult.logs[0].replace('[Leaguepedia diagnostic] ', ''));
  assert.equal(httpRecord.httpStatus, 503);
  assert.equal(httpRecord.rateLimitSignal, false);
  assert.equal(httpRecord.contentType, 'other');
  const jsonResult = await observeResponse(200, JSON.stringify({ error: {
    code: 'secret-code', info: 'secret-info',
  } }), { 'content-type': 'application/json' });
  const jsonRecord = JSON.parse(jsonResult.logs[0].replace('[Leaguepedia diagnostic] ', ''));
  assert.equal(jsonRecord.errorCode, 'other');
  assert.equal(jsonRecord.rateLimitSignal, false);
  assert.doesNotMatch([...httpResult.logs, ...jsonResult.logs].join(''), /secret/);
});
