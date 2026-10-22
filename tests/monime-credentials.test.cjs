const { test } = require("node:test"),
  assert = require("node:assert/strict");
const {
  monimeCredentials,
  environment,
} = require("../server/monime-credentials.cjs");
function envScope(changes) {
  const previous = Object.fromEntries(
    Object.keys(changes).map((k) => [k, process.env[k]]),
  );
  for (const [k, v] of Object.entries(changes)) {
    if (v == null) delete process.env[k];
    else process.env[k] = v;
  }
  return () => {
    for (const [k, v] of Object.entries(previous)) {
      if (v == null) delete process.env[k];
      else process.env[k] = v;
    }
  };
}
test("production environment aliases are explicit and unknown values are rejected", () => {
  assert.equal(environment("prod"), "live");
  assert.equal(environment("sandbox"), "test");
  assert.throws(() => environment(undefined));
});
test("local secret reads stay server-side, use pinned versions and coalesce refreshes", async () => {
  const restore = envScope({
    HUBPAS_LOCAL_SERVER: "true",
    K_SERVICE: null,
    MONIME_ACCESS_TOKEN: null,
    MONIME_SPACE_ID: null,
  });
  const requests = [];
  let oauth = 0;
  const svc = {
    config: { firebaseProjectId: "fixture-project" },
    auth: {
      app: {
        options: {
          credential: {
            getAccessToken: async () => {
              oauth++;
              return { access_token: "fixture-google-credential" };
            },
          },
        },
      },
    },
  };
  const fetcher = async (url, options) => {
    requests.push({ url, options });
    return {
      ok: true,
      json: async () => ({
        payload: {
          data: Buffer.from(
            url.includes("ACCESS_TOKEN")
              ? "fixture-provider-token"
              : "fixture-space",
          ).toString("base64"),
        },
      }),
    };
  };
  try {
    const loadConfig = () => ({
      monimeEnvironment: "prod",
      monimeSecrets: { accessTokenVersion: "3", spaceIdVersion: "2" },
    });
    const [a, b] = await Promise.all([
      monimeCredentials(svc, { fetcher, now: () => 0, loadConfig }),
      monimeCredentials(svc, { fetcher, now: () => 0, loadConfig }),
    ]);
    assert.equal(a, b);
    assert.equal(requests.length, 2);
    assert.equal(oauth, 1);
    assert.ok(
      requests.some((r) =>
        r.url.endsWith("/MONIME_ACCESS_TOKEN/versions/3:access"),
      ),
    );
    assert.ok(
      requests.some((r) =>
        r.url.endsWith("/MONIME_SPACE_ID/versions/2:access"),
      ),
    );
    assert.ok(requests.every((r) => r.options.redirect === "error"));
    assert.equal(a.environment, "live");
    await monimeCredentials(svc, { fetcher, now: () => 1, loadConfig });
    assert.equal(requests.length, 2);
  } finally {
    restore();
  }
});
test("Cloud Functions cannot fall back to developer Secret Manager reads", async () => {
  const restore = envScope({
    HUBPAS_LOCAL_SERVER: "true",
    K_SERVICE: "cloud-function",
    MONIME_ACCESS_TOKEN: null,
    MONIME_SPACE_ID: null,
  });
  try {
    await assert.rejects(
      () => monimeCredentials({}),
      /credentials are not available/,
    );
  } finally {
    restore();
  }
});
