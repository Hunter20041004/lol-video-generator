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

test("post-match read Chinese copy is covered by the reproducible local display font", () => {
  const { PUBLIC_COPY } = require(path.join(ROOT, "utils/esports/postMatchReadBuilder"));
  const glyphPath = path.join(ROOT, "config/post-match-read-font-glyphs.txt");
  const fontPath = path.join(ROOT, "public/fonts/NotoSerifTC-PostMatchRead-700.woff2");
  const stylesheetSource = fs.readFileSync(path.join(ROOT, "src/video-system/localFonts.css"), "utf8");
  const roleLabels = ["上路", "打野", "中路", "下路", "輔助"];
  const fixedCopy = Object.values(PUBLIC_COPY.zh).flatMap((value) =>
    typeof value === "function" ? roleLabels.map((role) => value(role)) : [value]
  ).join("");
  const requiredHan = new Set(fixedCopy.match(/[\u3400-\u9fff]/g) || []);
  const glyphs = fs.readFileSync(glyphPath, "utf8");

  for (const character of requiredHan) {
    assert.equal(glyphs.includes(character), true, `missing Han glyph: ${character}`);
  }
  const hash = crypto.createHash("sha256").update(fs.readFileSync(fontPath)).digest("hex");
  assert.equal(hash, "22cfa6a3c60cb2b314d451958213a0a65ce9f0af4d4aa3c28796937be725c830");
  assert.match(stylesheetSource, /font-family:\s*["']Noto Serif TC Post Match Read["']/);
  assert.match(stylesheetSource, /NotoSerifTC-PostMatchRead-700\.woff2/);
  assert.match(stylesheetSource, /font-weight:\s*700/);
  assert.match(stylesheetSource, /font-display:\s*block/);
});
