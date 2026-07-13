const test = require("node:test");
const assert = require("node:assert/strict");

const proxy = require("../../utils/proxyHandler");

function withProductionEnv(values, fn) {
  const previous = {
    NODE_ENV: process.env.NODE_ENV,
    PORTFOLIO_OPERATOR_TOKEN: process.env.PORTFOLIO_OPERATOR_TOKEN,
  };
  Object.assign(process.env, values);
  if (!("PORTFOLIO_OPERATOR_TOKEN" in values)) {
    delete process.env.PORTFOLIO_OPERATOR_TOKEN;
  }

  try {
    return fn();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test("proxy rejects production POST API requests without operator access", async () => {
  const response = withProductionEnv({ NODE_ENV: "production" }, () =>
    proxy(new Request("http://localhost/api/render", { method: "POST" }))
  );

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), {
    success: false,
    error: "operator_access_required",
  });
});

test("proxy allows production POST API requests with the exact operator token", () => {
  const response = withProductionEnv(
    {
      NODE_ENV: "production",
      PORTFOLIO_OPERATOR_TOKEN: "owner-secret",
    },
    () =>
      proxy(
        new Request("http://localhost/api/render", {
          method: "POST",
          headers: { "x-operator-token": "owner-secret" },
        })
      )
  );

  assert.equal(response.headers.get("x-middleware-next"), "1");
});

test("proxy leaves GET API requests and non-API paths unchanged", () => {
  withProductionEnv({ NODE_ENV: "production" }, () => {
    const getResponse = proxy(
      new Request("http://localhost/api/publish", { method: "GET" })
    );
    const pageResponse = proxy(
      new Request("http://localhost/workbench", { method: "POST" })
    );

    assert.equal(getResponse.headers.get("x-middleware-next"), "1");
    assert.equal(pageResponse.headers.get("x-middleware-next"), "1");
  });
});

test("proxy leaves local development POST workflows unchanged", () => {
  const response = withProductionEnv({ NODE_ENV: "development" }, () =>
    proxy(new Request("http://localhost/api/render", { method: "POST" }))
  );

  assert.equal(response.headers.get("x-middleware-next"), "1");
});
