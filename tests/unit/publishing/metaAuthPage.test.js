const test = require("node:test");
const assert = require("node:assert/strict");

const { renderMetaAuthPage } = require("../../../utils/publishing/metaAuthPage");

test("Meta connection status page is branded, responsive, and never renders provider details", () => {
  const html = renderMetaAuthPage({ platform: "instagram", status: "invalid-state", unsafeDetail: "secret-code" });
  assert.match(html, /Instagram 連線已失效/);
  assert.match(html, /請回到工作台重新開始/);
  assert.match(html, /name="viewport"/);
  assert.match(html, /prefers-reduced-motion/);
  assert.match(html, /word-break:keep-all/);
  assert.doesNotMatch(html, /secret-code/);
});
