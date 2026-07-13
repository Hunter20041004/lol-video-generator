const { timingSafeEqual } = require("node:crypto");

function hasOperatorAccess(request, env = process.env) {
  if (env.NODE_ENV !== "production") {
    return true;
  }

  const expected = String(env.PORTFOLIO_OPERATOR_TOKEN || "");
  const supplied = String(request.headers.get("x-operator-token") || "");
  if (!expected || !supplied) {
    return false;
  }

  const expectedBuffer = Buffer.from(expected, "utf8");
  const suppliedBuffer = Buffer.from(supplied, "utf8");
  return (
    expectedBuffer.length === suppliedBuffer.length &&
    timingSafeEqual(suppliedBuffer, expectedBuffer)
  );
}

module.exports = { hasOperatorAccess };
