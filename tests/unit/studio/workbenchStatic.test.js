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

test('esports workflow scans candidates and renders an explicit preview before publishing', () => {
  const workflow = read('app/components/studio/EsportsWorkflow.jsx');

  assert.match(workflow, /\/api\/esports\/candidates/);
  assert.match(workflow, /\/api\/esports\/player-radar/);
  assert.match(workflow, /\/api\/publish/);
  assert.match(workflow, /mode:\s*["']preview["']/);
  assert.match(workflow, /languages:\s*\[["']zh["']\]/);
  assert.doesNotMatch(workflow, /daily-one-click/);
  assert.match(workflow, /全球一級賽事中沒有找到已完成且資料完整的賽事/);
});

test('version workflow uses one selected item and preview-first content factory routes', () => {
  const workflow = read('app/components/studio/VersionWorkflow.jsx');

  assert.match(workflow, /\/api\/content-factory\/library/);
  assert.match(workflow, /\/api\/content-factory\/scan/);
  assert.match(workflow, /\/api\/content-factory\/preview/);
  assert.match(workflow, /\/api\/content-factory\/publish/);
  assert.match(workflow, /itemIds:\s*\[selectedItem\.id\]/);
  assert.doesNotMatch(workflow, /selectedItemIds|選取全部|一鍵發布/);
});

test('advanced tools keeps meta, insights, and publish queue out of the primary workflows', () => {
  const shell = read('app/components/studio/StudioShell.jsx');
  const tools = read('app/components/studio/AdvancedTools.jsx');

  assert.match(shell, /<AdvancedTools/);
  assert.match(tools, /\/api\/meta-factory\/scan/);
  assert.match(tools, /\/api\/meta-factory\/render/);
  assert.match(tools, /\/api\/insights/);
  assert.match(tools, /\/api\/publish/);
});

test('publish confirmation is absent until media validation passes', () => {
  const preview = read('app/components/studio/PreviewPanel.jsx');

  assert.match(preview, /publishReady\s*&&/);
  assert.doesNotMatch(preview, /disabled=\{!canPublishPreview\(preview\)/);
});

test('long global series labels can shrink inside the mobile control panel', () => {
  const styles = read('app/globals.css');

  assert.match(styles, /\.studio-select\s*\{[^}]*min-width:\s*0/s);
  assert.match(styles, /\.studio-select\s*\{[^}]*max-width:\s*100%/s);
});
