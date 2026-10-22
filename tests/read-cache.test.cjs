const { test } = require("node:test");
const assert = require("node:assert/strict");
const { ReadCache, cachedRead } = require("../server/read-cache.cjs");
const {
  loadIdentities,
  clearIdentityCache,
} = require("../server/identity-cache.cjs");
test("read cache coalesces, expires, throttles forced refresh, and never caches failures", async () => {
  let now = 0,
    calls = 0;
  const cache = new ReadCache({ now: () => now });
  const load = async () => ++calls;
  assert.deepEqual(
    await Promise.all([
      cache.get("x", 30000, load),
      cache.get("x", 30000, load),
    ]),
    [1, 1],
  );
  now = 1000;
  assert.equal(await cache.get("x", 30000, load, { fresh: true }), 1);
  now = 6000;
  assert.equal(await cache.get("x", 30000, load, { fresh: true }), 2);
  now = 37000;
  assert.equal(await cache.get("x", 30000, load), 3);
  await assert.rejects(
    cache.get("bad", 30000, async () => {
      throw Error("offline");
    }),
  );
  assert.equal(await cache.get("bad", 30000, load), 4);
});
test("invalidating a cache prevents an older in-flight request from repopulating it", async () => {
  const cache = new ReadCache();
  let finish;
  const old = cache.get(
    "x",
    30000,
    () => new Promise((resolve) => (finish = resolve)),
  );
  await Promise.resolve();
  cache.clear();
  finish("old");
  await old;
  assert.equal(await cache.get("x", 30000, async () => "new"), "new");
});
test("response cache separates identities and permission versions", async () => {
  const services = { db: {} };
  let calls = 0;
  const actor = { uid: "a", roles: ["finance"] };
  const read = (a) =>
    cachedRead(
      services,
      a,
      "records",
      new URLSearchParams(),
      30000,
      async () => ++calls,
    );
  assert.equal(await read(actor), 1);
  assert.equal(await read(actor), 1);
  assert.equal(await read({ ...actor, uid: "b" }), 2);
  assert.equal(await read({ ...actor, deniedResources: ["wallet"] }), 3);
  assert.equal(await read({ ...actor, accessVersion: 2 }), 4);
});
test("contact labels are batched, reused, and invalidated after mutations", async () => {
  let batches = 0;
  const services = {
    db: {
      doc: (path) => ({ path }),
      getAll: async (...args) => {
        batches++;
        return args
          .slice(0, -1)
          .map((ref) => ({
            id: ref.path.split("/").pop(),
            exists: true,
            data: () => ({ name: "Customer" }),
          }));
      },
    },
  };
  await Promise.all([
    loadIdentities(services, "users", ["one", "two"], ["name"]),
    loadIdentities(services, "users", ["two"], ["name"]),
  ]);
  await loadIdentities(services, "users", ["one"], ["name"]);
  assert.equal(batches, 1);
  clearIdentityCache(services);
  await loadIdentities(services, "users", ["one"], ["name"]);
  assert.equal(batches, 2);
});
