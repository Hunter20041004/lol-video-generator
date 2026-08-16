const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../../..');

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

test('primary workbench exposes only esports, version, and advanced tools', () => {
  const page = read('app/page.jsx');
  const shell = read('app/components/studio/StudioShell.jsx');

  assert.match(page, /<StudioShell/);
  assert.match(shell, /賽事影片/);
  assert.match(shell, /版本更新/);
  assert.match(shell, /進階工具/);
  assert.doesNotMatch(shell, /版本改動工廠|電競賽事工廠|發布與成效控制台|Meta 內容工廠/);
});
