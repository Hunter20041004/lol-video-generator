const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "../..");
const read = (relativePath) => fs.readFileSync(path.join(ROOT, relativePath), "utf8");

test("portfolio mode explains and disables every owner-only workflow", () => {
  const page = read("app/page.jsx");
  const esports = read("app/components/studio/EsportsWorkflow.jsx");
  const version = read("app/components/studio/VersionWorkflow.jsx");
  const advanced = read("app/components/studio/AdvancedTools.jsx");

  assert.match(page, /NEXT_PUBLIC_PORTFOLIO_READ_ONLY\s*===\s*["']true["']/);
  assert.match(page, /portfolioReadOnly=\{portfolioReadOnly\}/);
  assert.match(esports, /作品集唯讀模式/);
  assert.match(version, /作品集唯讀模式/);
  assert.ok((esports.match(/portfolioReadOnly/g) || []).length >= 5);
  assert.ok((version.match(/portfolioReadOnly/g) || []).length >= 5);
  assert.match(advanced, /disabled=\{busy \|\| portfolioReadOnly\}/);
  assert.match(advanced, /disabled=\{!selectedId \|\| busy \|\| portfolioReadOnly\}/);
});
