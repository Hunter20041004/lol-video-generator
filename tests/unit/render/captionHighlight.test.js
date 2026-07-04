const test = require("node:test");
const assert = require("node:assert/strict");

test("caption highlighting keeps T1 as one team token instead of coloring only the digit", async () => {
  const { splitCaptionHighlightSegments } = await import("../../../src/video-system/captionHighlight.js");

  const segments = splitCaptionHighlightSegments("第三局人頭只差 2\n但 T1 物件控制更乾淨");

  assert.deepEqual(segments, [
    { text: "第三局人頭只差 ", highlighted: false },
    { text: "2", highlighted: true },
    { text: "\n但 ", highlighted: false },
    { text: "T1", highlighted: true },
    { text: " 物件控制更乾淨", highlighted: false },
  ]);
});

test("caption highlighting does not treat digits inside alphanumeric words as standalone numbers", async () => {
  const { splitCaptionHighlightSegments } = await import("../../../src/video-system/captionHighlight.js");

  const segments = splitCaptionHighlightSegments("T1 3-0 TL，但 Patch16.13 不是比分");

  assert.equal(segments.find((segment) => segment.text === "T1")?.highlighted, true);
  assert.equal(segments.find((segment) => segment.text === "3")?.highlighted, true);
  assert.equal(segments.find((segment) => segment.text === "0")?.highlighted, true);
  assert.equal(segments.some((segment) => segment.text === "16.13" && segment.highlighted), false);
  assert.equal(segments.some((segment) => segment.text === "13" && segment.highlighted), false);
  assert.equal(segments.some((segment) => !segment.highlighted && segment.text.includes("Patch16.13")), true);
});

test("caption highlighting treats KC as a full team token", async () => {
  const { splitCaptionHighlightSegments } = await import("../../../src/video-system/captionHighlight.js");

  const segments = splitCaptionHighlightSegments("T1 3-0 KC，但 KC 有反擊點");

  assert.equal(segments.find((segment) => segment.text === "T1")?.highlighted, true);
  assert.equal(segments.filter((segment) => segment.text === "KC" && segment.highlighted).length, 2);
});
