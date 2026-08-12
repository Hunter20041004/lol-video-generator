const test = require("node:test");
const assert = require("node:assert/strict");

const { generateModelText, normalizeModelTimeoutMs } = require("../../utils/genaiClient");

test("generateModelText passes the 30-second default timeout to one SDK request", async () => {
  const requests = [];
  const result = await generateModelText({
    apiKey: "test-key",
    model: "gemma-4-31b-it",
    prompt: "prompt",
    clientFactory: () => ({
      models: {
        generateContent: async (request) => {
          requests.push(request);
          return { text: "model text" };
        },
      },
    }),
  });

  assert.equal(result, "model text");
  assert.equal(requests.length, 1);
  assert.equal(requests[0].model, "gemma-4-31b-it");
  assert.equal(requests[0].contents, "prompt");
  assert.equal(requests[0].config.httpOptions.timeout, 30_000);
});

test("normalizeModelTimeoutMs clamps overrides to the supported request budget", () => {
  assert.equal(normalizeModelTimeoutMs(undefined), 30_000);
  assert.equal(normalizeModelTimeoutMs(50), 1_000);
  assert.equal(normalizeModelTimeoutMs(120_000), 60_000);
});
