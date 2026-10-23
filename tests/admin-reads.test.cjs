const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { JSDOM } = require("../server/node_modules/jsdom");
test("authenticated user navigation fetches one summary and only the requested activity page", async () => {
  const dom = new JSDOM(
    fs.readFileSync(
      require("node:path").join(__dirname, "../admin.html"),
      "utf8",
    ),
    { url: "http://127.0.0.1:8080/admin.html" },
  );
  global.document = dom.window.document;
  global.location = dom.window.location;
  global.__HUBPAS_TEST__ = true;
  const user = { uid: "staff", getIdToken: async () => "test" };
  const sdk = [
    { initializeApp: () => ({}) },
    {
      getAuth: () => ({}),
      onAuthStateChanged: (_a, callback) => callback(user),
      signInWithEmailAndPassword: async () => ({ user }),
      signOut: async () => {},
    },
  ];
  const calls = [];
  let pause = false, pauseOverview = false, releaseOverview;
  const app = await (
    await import("../admin-console.mjs")
  ).mountDashboard({
    authLoader: async () => sdk,
    fetcher: async (url, options) => {
      const parsed = new URL(url, "http://localhost");
      const path = parsed.pathname.split("/").pop();
      calls.push({ path, params: parsed.searchParams });
      if (pauseOverview && path === "overview")
        await new Promise((resolve) => { releaseOverview = resolve; });
      if (pause && path === "record")
        return new Promise((resolve, reject) =>
          options.signal.addEventListener(
            "abort",
            () =>
              reject(Object.assign(Error("cancelled"), { name: "AbortError" })),
            { once: true },
          ),
        );
      const profile = {
        id: "customer",
        data: { displayName: "Customer", walletBalance: 25 },
        version: "reviewed",
      };
      const result =
        path === "session"
          ? {
              uid: "staff",
              roles: ["finance"],
              resources: ["users", "walletTransactions", "tickets"],
              actions: [],
              version: "test",
            }
          : path === "records"
            ? {
                rows:
                  parsed.searchParams.get("resource") === "users"
                    ? [profile]
                    : [],
                cursor: null,
              }
            : path === "user-summary"
              ? {
                  profile,
                  financialAccess: true,
                  authStatus: "Active",
                  finance: {
                    transactionCount: 0,
                    funding: 0,
                    withdrawalPrincipal: 0,
                  },
                  transactions: [],
                  tickets: { count: 0 },
                  errors: [],
                  limited: false,
                }
              : { cards: [], errors: [], coverage: "test", asOf: "test" };
      return { ok: true, json: async () => result };
    },
  });
  try {
    await document
      .getElementById("login-form")
      .onsubmit({ preventDefault() {} });
    await app.openModule("users");
    calls.length = 0;
    document.querySelector("[data-open]").click();
    await new Promise(setImmediate);
    assert.deepEqual(
      calls.map((call) => call.path),
      ["user-summary"],
    );
    assert.equal(document.getElementById("detail-page").hidden, false);
    calls.length = 0;
    document.getElementById("profile-all-transactions").click();
    await new Promise(setImmediate);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].path, "records");
    assert.equal(calls[0].params.get("resource"), "walletTransactions");
    assert.equal(calls[0].params.get("search"), "customer");
    calls.length = 0;
    await Promise.all([app.api("health"), app.api("health")]);
    assert.equal(calls.length, 1);
    pause = true;
    const obsolete = app.api(
      "record",
      new URLSearchParams({ resource: "users", id: "customer" }),
    );
    const rejected = assert.rejects(obsolete, { name: "AbortError" });
    await new Promise(setImmediate);
    await app.openModule("users");
    await rejected;
    calls.length = 0;
    pauseOverview = true;
    const opening = app.openModule("overview");
    await new Promise(setImmediate);
    assert.deepEqual(calls.map((call) => call.path).sort(), ["overview", "treasury"]);
    releaseOverview();
    await opening;
  } finally {
    dom.window.close();
    delete global.document;
    delete global.location;
  }
});
