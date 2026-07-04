const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "../../..");

test("verifyCandidate returns unavailable when no OP.GG dependency is configured", async () => {
  const { verifyCandidate } = require(path.join(ROOT, "utils/metaFactory/sourceAdapters/opggVerifier.js"));

  const result = await verifyCandidate({ champion: "Velkoz", role: "Support" });

  assert.deepEqual(result, {
    provider: "OP.GG",
    status: "unavailable",
    sourceAgreement: 0.5,
    notes: ["OP.GG verifier dependency is not configured."],
  });
});

test("verifyCandidate returns verified when injected OP.GG lookup agrees", async () => {
  const { verifyCandidate } = require(path.join(ROOT, "utils/metaFactory/sourceAdapters/opggVerifier.js"));
  const candidate = { champion: "Velkoz", role: "Support", patch: "16.12" };
  const observedCandidates = [];

  const result = await verifyCandidate(candidate, {
    lookup: async (lookupCandidate) => {
      observedCandidates.push(lookupCandidate);
      return {
        agrees: true,
        notes: ["OP.GG support data confirms the off-role trend."],
      };
    },
  });

  assert.deepEqual(observedCandidates, [candidate]);
  assert.deepEqual(result, {
    provider: "OP.GG",
    status: "verified",
    sourceAgreement: 1,
    notes: ["OP.GG support data confirms the off-role trend."],
  });
});

test("verifyCandidate returns mismatch when injected OP.GG lookup disagrees", async () => {
  const { verifyCandidate } = require(path.join(ROOT, "utils/metaFactory/sourceAdapters/opggVerifier.js"));

  const result = await verifyCandidate({ champion: "Yuumi", role: "Jungle" }, {
    lookup: async () => ({
      agrees: false,
      notes: ["OP.GG jungle data does not confirm the trend."],
    }),
  });

  assert.deepEqual(result, {
    provider: "OP.GG",
    status: "mismatch",
    sourceAgreement: 0.25,
    notes: ["OP.GG jungle data does not confirm the trend."],
  });
});

test("verifyCandidate reports unavailable lookup results with a useful reason", async () => {
  const { verifyCandidate } = require(path.join(ROOT, "utils/metaFactory/sourceAdapters/opggVerifier.js"));

  const explicitReason = await verifyCandidate({ champion: "Brand", role: "ADC" }, {
    lookup: async () => ({ status: "unavailable", reason: "OP.GG lane page returned 404." }),
  });
  const missingResult = await verifyCandidate({ champion: "Nunu", role: "Mid" }, {
    lookup: async () => null,
  });

  assert.deepEqual(explicitReason, {
    provider: "OP.GG",
    status: "unavailable",
    sourceAgreement: 0.5,
    notes: ["OP.GG lane page returned 404."],
  });
  assert.deepEqual(missingResult, {
    provider: "OP.GG",
    status: "unavailable",
    sourceAgreement: 0.5,
    notes: ["OP.GG verifier did not return usable data."],
  });
});
