const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

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

test("post-match read copy is covered by four reproducible local display font weights", () => {
  const { PUBLIC_COPY } = require(path.join(ROOT, "utils/esports/postMatchReadBuilder"));
  const glyphPath = path.join(ROOT, "config/post-match-read-font-glyphs.txt");
  const fontNames = [
    "BarlowCondensed-PostMatchRead-800.woff2",
    "BarlowCondensed-PostMatchRead-900.woff2",
    "NotoSansTC-PostMatchRead-700.woff2",
    "NotoSansTC-PostMatchRead-900.woff2",
  ];
  const stylesheetSource = fs.readFileSync(path.join(ROOT, "src/video-system/localFonts.css"), "utf8");
  const builderSource = fs.readFileSync(path.join(ROOT, "utils/esports/postMatchReadBuilder.js"), "utf8");
  const rootSource = fs.readFileSync(path.join(ROOT, "src/Root.jsx"), "utf8");
  const roleLabels = ["上路", "打野", "中路", "下路", "輔助"];
  const fixedCopy = Object.values(PUBLIC_COPY.zh).flatMap((value) =>
    typeof value === "function" ? roleLabels.map((role) => value(role)) : [value]
  ).join("") + builderSource + rootSource;
  const requiredHan = new Set(fixedCopy.match(/[\u3400-\u9fff]/g) || []);
  const glyphs = fs.readFileSync(glyphPath, "utf8");
  const hashManifestPath = path.join(ROOT, "config/post-match-read-font-hashes.json");

  for (const fontName of fontNames) {
    assert.equal(fs.existsSync(path.join(ROOT, "public/fonts", fontName)), true, fontName);
  }
  assert.equal(fs.existsSync(hashManifestPath), true, "post-match-read-font-hashes.json");

  for (const character of requiredHan) {
    assert.equal(glyphs.includes(character), true, `missing Han glyph: ${character}`);
  }
  const hashManifest = JSON.parse(fs.readFileSync(hashManifestPath, "utf8"));
  for (const fontName of fontNames) {
    const hash = crypto.createHash("sha256").update(fs.readFileSync(path.join(ROOT, "public/fonts", fontName))).digest("hex");
    assert.equal(hash, hashManifest.files[fontName], fontName);
  }
  assert.match(stylesheetSource, /font-family:\s*["']Barlow Condensed Post Match Read["']/);
  assert.match(stylesheetSource, /BarlowCondensed-PostMatchRead-800\.woff2/);
  assert.match(stylesheetSource, /BarlowCondensed-PostMatchRead-900\.woff2/);
  assert.match(stylesheetSource, /font-family:\s*["']Noto Sans TC Post Match Read["']/);
  assert.match(stylesheetSource, /NotoSansTC-PostMatchRead-700\.woff2/);
  assert.match(stylesheetSource, /NotoSansTC-PostMatchRead-900\.woff2/);
  assert.match(stylesheetSource, /font-weight:\s*700/);
  assert.match(stylesheetSource, /font-weight:\s*800/);
  assert.match(stylesheetSource, /font-weight:\s*900/);
  assert.match(stylesheetSource, /font-display:\s*block/);
});
