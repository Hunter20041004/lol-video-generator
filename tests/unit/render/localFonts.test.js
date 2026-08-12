const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "../../..");

test("Remotion exposes repository-hosted Outfit without a long-lived render lock", () => {
  const stylesheetPath = path.join(ROOT, "src/video-system/localFonts.css");
  const indexSource = fs.readFileSync(path.join(ROOT, "src/index.jsx"), "utf8");

  assert.equal(fs.existsSync(stylesheetPath), true);
  const stylesheetSource = fs.readFileSync(stylesheetPath, "utf8");
  assert.match(indexSource, /import\s+["']\.\/video-system\/localFonts\.css["']/);
  assert.doesNotMatch(indexSource, /ensureLocalVideoFonts/);
  assert.match(stylesheetSource, /@font-face/);
  assert.match(stylesheetSource, /font-family:\s*["']Outfit["']/);
  assert.match(stylesheetSource, /url\(["']?\/public\/fonts\/Outfit-Variable\.woff2["']?\)/);
  assert.match(stylesheetSource, /font-display:\s*block/);
});
