const test = require("node:test");
const assert = require("node:assert/strict");

const { hasOperatorAccess } = require("../../utils/operatorAccess");

const requestWithToken = (token) => ({
  headers: new Headers(token ? { "x-operator-token": token } : {}),
});

test("operator access stays open outside production for local authoring", () => {
  assert.equal(
    hasOperatorAccess(requestWithToken(), { NODE_ENV: "development" }),
    true
  );
});

test("operator access rejects production requests when no token is configured", () => {
  assert.equal(
    hasOperatorAccess(requestWithToken(), { NODE_ENV: "production" }),
    false
  );
});

test("operator access rejects an incorrect production token", () => {
  assert.equal(
    hasOperatorAccess(requestWithToken("wrong-secret"), {
      NODE_ENV: "production",
      PORTFOLIO_OPERATOR_TOKEN: "owner-secret",
    }),
    false
  );
});

test("operator access accepts an exact production token", () => {
  assert.equal(
    hasOperatorAccess(requestWithToken("owner-secret"), {
      NODE_ENV: "production",
      PORTFOLIO_OPERATOR_TOKEN: "owner-secret",
    }),
    true
  );
});
