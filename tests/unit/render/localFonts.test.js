const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "../../..");

test("Remotion registers repository-hosted Outfit before rendering", () => {
  const helperPath = path.join(ROOT, "src/video-system/localFonts.js");
  const indexSource = fs.readFileSync(path.join(ROOT, "src/index.jsx"), "utf8");

  assert.equal(fs.existsSync(helperPath), true);
  const helperSource = fs.readFileSync(helperPath, "utf8");
  assert.match(indexSource, /import\s+\{\s*ensureLocalVideoFonts\s*\}\s+from\s+["']\.\/video-system\/localFonts["']/);
  assert.match(indexSource, /ensureLocalVideoFonts\(\)/);
  assert.match(helperSource, /staticFile\(["']fonts\/Outfit-Variable\.woff2["']\)/);
  assert.match(helperSource, /delayRender\(/);
  assert.match(helperSource, /continueRender\(/);
});
