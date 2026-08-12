const test = require("node:test");
const assert = require("node:assert/strict");

const { createAnalyzeChange } = require("../../reasoning");

test("analyzeChange makes one model request before surfacing a timeout to fallback", async () => {
  const originalApiKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = "test-key";
  let calls = 0;
  const analyzeChange = createAnalyzeChange({
    generateText: async () => {
      calls += 1;
      throw new Error("MODEL_TIMEOUT after 30000ms");
    },
  });

  try {
    await assert.rejects(
      () => analyzeChange({ dataType: "PATCH", championName: "Ahri", locale: "zh" }),
      /MODEL_TIMEOUT after 30000ms/,
    );
    assert.equal(calls, 1);
  } finally {
    if (originalApiKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalApiKey;
  }
});
