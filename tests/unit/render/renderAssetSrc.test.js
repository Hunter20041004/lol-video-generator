const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("resolveRenderAssetSrc bundles repository player portraits as Remotion static files", () => {
  const source = fs.readFileSync(path.resolve(__dirname, "../../../src/video-system/renderAssetSrc.js"), "utf8");

  assert.match(source, /render-assets\|player-portraits/);
  assert.match(source, /return staticFile\(value\.replace/);
});
