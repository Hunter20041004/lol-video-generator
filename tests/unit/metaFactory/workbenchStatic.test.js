const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "../../..");
const read = (relativePath) => fs.readFileSync(path.join(ROOT, relativePath), "utf8");

test("focused workbench keeps Meta available without exposing it as a primary workspace", () => {
  const shell = read("app/components/studio/StudioShell.jsx");
  const advanced = read("app/components/studio/AdvancedTools.jsx");

  assert.match(shell, /賽事影片/);
  assert.match(shell, /版本更新/);
  assert.match(shell, /進階工具/);
  assert.match(advanced, /\/api\/meta-factory\/scan/);
  assert.match(advanced, /\/api\/meta-factory\/render/);
  assert.match(advanced, /梯度榜/);
  assert.match(advanced, /非主流玩法/);
  assert.doesNotMatch(shell, /Meta 內容工廠|PRO_BUILD|TIER_LIST/);
});

test("esports workflow defaults to yesterday locally and never invokes one-click publishing", () => {
  const workflow = read("app/components/studio/EsportsWorkflow.jsx");

  assert.match(workflow, /function localDateOffset/);
  assert.match(workflow, /date\.setDate\(date\.getDate\(\) \+ days\)/);
  assert.match(workflow, /useState\(\(\) => localDateOffset\(-1\)\)/);
  assert.match(workflow, /type="date"/);
  assert.match(workflow, /mode:\s*"preview"/);
  assert.match(workflow, /languages:\s*\["zh"\]/);
  assert.doesNotMatch(workflow, /daily-one-click|每日一鍵產片並發布/);
});

test("version workflow is single-item and keeps preview and publish separate", () => {
  const workflow = read("app/components/studio/VersionWorkflow.jsx");

  assert.match(workflow, /selectedItemId/);
  assert.match(workflow, /\/api\/content-factory\/preview/);
  assert.match(workflow, /render:\s*true/);
  assert.match(workflow, /\/api\/content-factory\/publish/);
  assert.match(workflow, /itemIds:\s*\[selectedItem\.id\]/);
  assert.doesNotMatch(workflow, /selectedItemIds|選取全部|一鍵發布/);
});

test("preview panel renders real media, validation status, and exact-artifact confirmation", () => {
  const preview = read("app/components/studio/PreviewPanel.jsx");

  assert.match(preview, /<video/);
  assert.match(preview, /controls/);
  assert.match(preview, /canPublishPreview\(preview\)/);
  assert.match(preview, /媒體驗證已通過/);
  assert.match(preview, /確認發布這份成品/);
  assert.match(preview, /不會重新渲染/);
});

test("focused shell styles are global, responsive, and honor reduced motion", () => {
  const page = read("app/page.jsx");
  const globals = read("app/globals.css");

  assert.match(page, /<StudioShell/);
  assert.equal(page.includes("<style jsx"), false);
  assert.match(globals, /\.studio-shell\s*\{/);
  assert.match(globals, /\.studio-workflow\s*\{/);
  assert.match(globals, /@media \(max-width: 720px\)/);
  assert.match(globals, /@media \(prefers-reduced-motion: reduce\)/);
});

test("root layout does not constrain the workbench canvas", () => {
  const layout = read("app/layout.jsx");
  const globals = read("app/globals.css");

  assert.equal(layout.includes("maxWidth: '1200px'"), false);
  assert.equal(layout.includes("padding: '40px'"), false);
  assert.match(layout, /<main className="appRoot">/);
  assert.match(globals, /body\s*\{[\s\S]*padding:\s*0;/);
  assert.match(globals, /\.appRoot\s*\{[\s\S]*min-height:\s*100vh;/);
});

test("root layout declares an existing favicon asset for browser smoke tests", () => {
  const layout = read("app/layout.jsx");
  const favicon = read("public/favicon.svg");

  assert.match(layout, /icons:\s*\{/);
  assert.match(layout, /icon:\s*["']\/favicon\.svg["']/);
  assert.match(favicon, /<svg\b/);
  assert.match(favicon, /HVS/);
});
