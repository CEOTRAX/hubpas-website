const { test } = require("node:test");
const assert = require("node:assert/strict");
const { sharedCredential } = require("../server/server-credential.cjs");
const { assignmentReader } = require("../server/local-assignment-reader.cjs");
test("server OAuth warm-up and SDK calls reuse a coalesced token without extending expiry", async () => {
  let calls = 0,
    now = 0;
  const credential = sharedCredential(
    {
      getAccessToken: async () => {
        calls++;
        return { access_token: "test-server-only", expires_in: 3600 };
      },
    },
    { now: () => now },
  );
  await Promise.all([credential.getAccessToken(), credential.getAccessToken()]);
  assert.equal(calls, 1);
  now = 100000;
  assert.equal((await credential.getAccessToken()).expires_in, 3500);
  assert.equal(calls, 1);
  now = 3541000;
  await credential.getAccessToken();
  assert.equal(calls, 2);
});
test("failed server-token refreshes can be retried", async () => {
  let fail = true;
  const credential = sharedCredential({
    getAccessToken: async () => {
      if (fail) throw Error("offline");
      return { access_token: "test", expires_in: 3600 };
    },
  });
  await assert.rejects(credential.getAccessToken());
  fail = false;
  assert.equal((await credential.getAccessToken()).access_token, "test");
});
test("local permission reads stay server-authorized, projected, uncached and decode restrictions", async () => {
  let calls = 0;
  const services = {
    config: { firebaseProjectId: "dmap-50136" },
    auth: {
      app: {
        options: {
          credential: {
            getAccessToken: async () => ({ access_token: "test-server-only" }),
          },
        },
      },
    },
  };
  const read = assignmentReader(services, async (url, options) => {
    calls++;
    assert.equal(
      new URL(url).pathname,
      "/v1/projects/dmap-50136/databases/(default)/documents/adminRoleAssignments/customer",
    );
    assert.equal(options.headers.Authorization, "Bearer test-server-only");
    assert.equal(options.redirect, "error");
    assert.deepEqual(new URL(url).searchParams.getAll("mask.fieldPaths"), [
      "active",
      "roles",
      "accessVersion",
      "deniedResources",
      "deniedActions",
    ]);
    return {
      ok: true,
      json: async () => ({
        fields: {
          active: { booleanValue: true },
          roles: { arrayValue: { values: [{ stringValue: "finance" }] } },
          accessVersion: { integerValue: "3" },
          deniedResources: {
            arrayValue: { values: [{ stringValue: "users" }] },
          },
          deniedActions: { arrayValue: {} },
        },
      }),
    };
  });
  assert.deepEqual((await read("customer")).data(), {
    active: true,
    roles: ["finance"],
    accessVersion: 3,
    deniedResources: ["users"],
    deniedActions: [],
  });
  await read("customer");
  assert.equal(calls, 2);
  await assert.rejects(read("../other"), { status: 401 });
  const missing = assignmentReader(services, async () => ({ status: 404 }));
  assert.equal((await missing("customer")).exists, false);
  const unavailable = assignmentReader(services, async () => ({
    status: 403,
    ok: false,
  }));
  await assert.rejects(unavailable("customer"), { status: 503 });
});
