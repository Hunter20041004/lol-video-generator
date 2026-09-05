const test = require("node:test");
const assert = require("node:assert/strict");

const { validateMetaCallbackRequest } = require("../../../utils/publishing/metaOAuthFlow");

test("callback validates and consumes state before exposing provider fields", () => {
  let consumes = 0;
  const consumeOAuthChallenge = () => {
    consumes += 1;
    const error = new Error("invalid");
    error.code = "OAUTH_STATE_INVALID";
    throw error;
  };

  assert.throws(
    () => validateMetaCallbackRequest(
      "https://callback.example/api/auth/meta/instagram/callback?code=secret-code&error=secret-provider-error&state=bad",
      "instagram",
      { consumeOAuthChallenge }
    ),
    (error) => error.code === "OAUTH_STATE_INVALID" && !error.message.includes("secret")
  );
  assert.equal(consumes, 1);
});
