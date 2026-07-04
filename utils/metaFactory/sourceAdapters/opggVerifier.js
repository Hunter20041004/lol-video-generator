async function verifyCandidate(candidate = {}, deps = {}) {
  if (typeof deps.lookup !== "function") {
    return {
      provider: "OP.GG",
      status: "unavailable",
      sourceAgreement: 0.5,
      notes: ["OP.GG verifier dependency is not configured."],
    };
  }

  const result = await deps.lookup(candidate);
  if (!result || result.status === "unavailable") {
    return {
      provider: "OP.GG",
      status: "unavailable",
      sourceAgreement: 0.5,
      notes: [result?.reason || "OP.GG verifier did not return usable data."],
    };
  }

  return {
    provider: "OP.GG",
    status: result.agrees === false ? "mismatch" : "verified",
    sourceAgreement: result.agrees === false ? 0.25 : 1,
    notes: Array.isArray(result.notes) ? result.notes : [],
  };
}

module.exports = { verifyCandidate };
