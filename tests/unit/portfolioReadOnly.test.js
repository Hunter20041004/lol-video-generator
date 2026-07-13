const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "../..");

test("portfolio mode explains and disables owner-only POST actions", () => {
  const page = fs.readFileSync(path.join(ROOT, "app/page.jsx"), "utf8");
  const styles = fs.readFileSync(path.join(ROOT, "app/globals.css"), "utf8");

  assert.match(
    page,
    /NEXT_PUBLIC_PORTFOLIO_READ_ONLY\s*===\s*["']true["']/
  );
  assert.match(page, /function PortfolioSecurityNotice/);
  assert.match(page, /作品集唯讀模式/);
  assert.match(page, /live render.*owner-only/i);
  assert.match(page, /function MutationButton/);
  assert.match(page, /disabled=\{portfolioReadOnly \|\| disabled\}/);
  assert.ok((page.match(/<MutationButton/g) || []).length >= 9);
  assert.match(page, /<VersionFactory portfolioReadOnly=\{portfolioReadOnly\}/);
  assert.match(page, /<MetaFactory portfolioReadOnly=\{portfolioReadOnly\}/);
  assert.match(page, /<EsportsFactory portfolioReadOnly=\{portfolioReadOnly\}/);
  assert.match(styles, /\.hvsShell \.portfolioSecurityNotice/);
});
