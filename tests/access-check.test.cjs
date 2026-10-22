const { test } = require("node:test");
const assert = require("node:assert/strict");
const { checkAccess, within } = require("../server/access-check.cjs");
test("verified tokens run revocation and current permissions in parallel, awaiting both", async () => {
  let finishRevocation,
    roleRead = false,
    finished = false;
  const flags = [];
  const identity = { uid: "customer" };
  const assignment = { exists: true };
  const pending = checkAccess("signed-token", {
    auth: {
      verifyIdToken: async (_token, revoked) => {
        flags.push(revoked);
        return revoked
          ? new Promise(
              (resolve) => (finishRevocation = () => resolve(identity)),
            )
          : identity;
      },
    },
    db: {
      doc: (path) => {
        assert.equal(path, "adminRoleAssignments/customer");
        return {
          get: async () => {
            roleRead = true;
            return assignment;
          },
        };
      },
    },
  }).then((result) => {
    finished = true;
    return result;
  });
  await new Promise(setImmediate);
  assert.equal(roleRead, true);
  assert.equal(finished, false);
  assert.deepEqual(flags, [false, true]);
  finishRevocation();
  assert.deepEqual(await pending, { identity, assignment });
});
test("invalid signatures never initiate role reads and revoked sessions cannot open access", async () => {
  let reads = 0;
  const db = {
    doc: () => ({
      get: async () => {
        reads++;
        return { exists: true };
      },
    }),
  };
  await assert.rejects(
    checkAccess("invalid", {
      db,
      auth: {
        verifyIdToken: async () => {
          throw Object.assign(Error("invalid"), {
            code: "auth/argument-error",
          });
        },
      },
    }),
    { status: 401 },
  );
  assert.equal(reads, 0);
  await assert.rejects(
    checkAccess("revoked", {
      db,
      auth: {
        verifyIdToken: async (_token, revoked) => {
          if (revoked)
            throw Object.assign(Error("revoked"), {
              code: "auth/id-token-revoked",
            });
          return { uid: "customer" };
        },
      },
    }),
    { status: 401 },
  );
});
test("access dependency outages are retryable and deadlines fail closed", async () => {
  await assert.rejects(
    checkAccess("signed", {
      auth: {
        verifyIdToken: async () => {
          throw Object.assign(Error("offline"), { code: "app/network-error" });
        },
      },
    }),
    { status: 503 },
  );
  await assert.rejects(
    within(new Promise(() => {}), 10, "Access unavailable"),
    { status: 503, message: "Access unavailable" },
  );
});
