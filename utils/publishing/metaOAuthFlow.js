const { consumeOAuthChallenge: defaultConsumeOAuthChallenge } = require("./oauthChallengeStore");

function validateMetaCallbackRequest(requestUrl, platform, deps = {}) {
  const url = new URL(requestUrl);
  const state = url.searchParams.get("state") || "";
  const consumeOAuthChallenge = deps.consumeOAuthChallenge || defaultConsumeOAuthChallenge;
  const identity = consumeOAuthChallenge(state, { platform });
  return {
    ...identity,
    code: url.searchParams.get("code") || "",
    providerError: url.searchParams.get("error") || "",
  };
}

module.exports = { validateMetaCallbackRequest };
